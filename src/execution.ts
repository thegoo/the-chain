import type { ExecutionStatus, EvidenceEnvelope } from './types.ts';

export interface ExecutionRecord {
  readonly executionId: string;
  readonly capability: string;
  readonly startedAt: string;
  status: ExecutionStatus;
  readonly controller: AbortController;
  readonly completed: Promise<EvidenceEnvelope>;
  readonly _resolve: (envelope: EvidenceEnvelope) => void;
}

export function createExecutionRecord(
  executionId: string,
  capability: string,
): ExecutionRecord {
  let _resolve!: (envelope: EvidenceEnvelope) => void;

  const completed = new Promise<EvidenceEnvelope>((resolve) => {
    _resolve = resolve;
  });

  return {
    executionId,
    capability,
    startedAt: new Date().toISOString(),
    status: 'PENDING',
    controller: new AbortController(),
    completed,
    _resolve,
  };
}
