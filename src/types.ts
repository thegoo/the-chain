export type ExecutionStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED';

export interface FailureDetail {
  readonly message: string;
  readonly code: string | null;
  readonly stack: string | null;
}

export interface EvidenceEnvelope {
  readonly executionId: string;
  readonly capability: string;
  readonly status: 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
  readonly startedAt: string;
  readonly completedAt: string;
  readonly payload: unknown;
  readonly failure: FailureDetail | null;
}

export interface ProviderContext {
  readonly executionId: string;
  readonly capability: string;
  readonly input: unknown;
  readonly signal: AbortSignal;
}

export interface Provider {
  readonly capability: string;
  run(context: ProviderContext): Promise<unknown>;
}

export interface ExecutionHandle {
  readonly executionId: string;
  readonly capability: string;
  readonly status: ExecutionStatus;
  readonly completed: Promise<EvidenceEnvelope>;
}
