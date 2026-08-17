import { randomUUID } from 'node:crypto';
import type { Provider, EvidenceEnvelope, ExecutionHandle, FailureDetail } from './types.ts';
import type { ProviderRegistry } from './registry.ts';
import { createExecutionRecord } from './execution.ts';
import type { ExecutionRecord } from './execution.ts';

export class KernelError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'KernelError';
    this.code = code;
  }
}

const TERMINAL_STATES = new Set(['SUCCEEDED', 'FAILED', 'CANCELLED']);

function isTerminal(status: string): boolean {
  return TERMINAL_STATES.has(status);
}

function toFailureDetail(err: unknown): FailureDetail {
  if (err instanceof Error) {
    return {
      message: err.message,
      code: (err as { code?: string }).code ?? null,
      stack: err.stack ?? null,
    };
  }
  return {
    message: String(err),
    code: null,
    stack: null,
  };
}

function makeHandle(record: ExecutionRecord): ExecutionHandle {
  return {
    executionId: record.executionId,
    capability: record.capability,
    get status() { return record.status; },
    completed: record.completed,
  };
}

export class Kernel {
  readonly #registry: ProviderRegistry;
  readonly #executions = new Map<string, ExecutionRecord>();

  constructor(registry: ProviderRegistry) {
    this.#registry = registry;
  }

  execute(capability: string, input: unknown): ExecutionHandle {
    const provider = this.#registry.get(capability);
    if (!provider) {
      throw new KernelError(
        `Unknown capability: ${capability}`,
        'UNKNOWN_CAPABILITY',
      );
    }

    const executionId = randomUUID();
    const record = createExecutionRecord(executionId, capability);
    this.#executions.set(executionId, record);

    record.status = 'RUNNING';

    this.#run(record, provider, input);

    return makeHandle(record);
  }

  inspect(executionId: string): ExecutionHandle {
    const record = this.#executions.get(executionId);
    if (!record) {
      throw new KernelError(
        `Unknown execution: ${executionId}`,
        'UNKNOWN_EXECUTION',
      );
    }
    return makeHandle(record);
  }

  cancel(executionId: string): void {
    const record = this.#executions.get(executionId);
    if (!record) {
      throw new KernelError(
        `Unknown execution: ${executionId}`,
        'UNKNOWN_EXECUTION',
      );
    }
    if (isTerminal(record.status)) return;

    record.status = 'CANCELLED';

    const envelope: EvidenceEnvelope = {
      executionId: record.executionId,
      capability: record.capability,
      status: 'CANCELLED',
      startedAt: record.startedAt,
      completedAt: new Date().toISOString(),
      payload: null,
      failure: null,
    };

    record._resolve(envelope);
    record.controller.abort();
  }

  #run(record: ExecutionRecord, provider: Provider, input: unknown): void {
    const context = {
      executionId: record.executionId,
      capability: record.capability,
      input,
      signal: record.controller.signal,
    };

    provider.run(context).then(
      (payload) => {
        if (record.status !== 'RUNNING') return;
        record.status = 'SUCCEEDED';
        record._resolve({
          executionId: record.executionId,
          capability: record.capability,
          status: 'SUCCEEDED',
          startedAt: record.startedAt,
          completedAt: new Date().toISOString(),
          payload,
          failure: null,
        });
      },
      (err: unknown) => {
        if (record.status !== 'RUNNING') return;
        record.status = 'FAILED';
        record._resolve({
          executionId: record.executionId,
          capability: record.capability,
          status: 'FAILED',
          startedAt: record.startedAt,
          completedAt: new Date().toISOString(),
          payload: null,
          failure: toFailureDetail(err),
        });
      },
    );
  }
}
