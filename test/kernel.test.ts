import { describe, it, expect } from 'vitest';
import { Kernel, KernelError } from '../src/kernel.ts';
import { buildRegistry } from '../src/registry.ts';
import type { Provider, ProviderContext, EvidenceEnvelope } from '../src/types.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const successProvider: Provider = {
  capability: 'test.success',
  async run(ctx: ProviderContext) {
    return { analyzed: true, input: ctx.input };
  },
};

const throwingProvider: Provider = {
  capability: 'test.throw',
  async run() {
    throw new Error('deliberate failure');
  },
};

const throwStringProvider: Provider = {
  capability: 'test.throwstring',
  async run() {
    throw 'raw string error'; // eslint-disable-line no-throw-literal
  },
};

const slowProvider: Provider = {
  capability: 'test.slow',
  async run({ signal }: ProviderContext) {
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, 10_000);
      signal.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
    });
    return null;
  },
};

const makeKernel = (...providers: Provider[]) =>
  new Kernel(buildRegistry(providers));

function assertEnvelopeShape(e: EvidenceEnvelope, capability: string) {
  expect(typeof e.executionId).toBe('string');
  expect(e.executionId).toMatch(UUID_RE);
  expect(e.capability).toBe(capability);
  expect(['SUCCEEDED', 'FAILED', 'CANCELLED']).toContain(e.status);
  expect(typeof e.startedAt).toBe('string');
  expect(e.startedAt.length).toBeGreaterThan(0);
  expect(() => new Date(e.startedAt)).not.toThrow();
  expect(typeof e.completedAt).toBe('string');
  expect(e.completedAt.length).toBeGreaterThan(0);
  expect(() => new Date(e.completedAt)).not.toThrow();
  expect('payload' in e).toBe(true);
  expect('failure' in e).toBe(true);
}

// ── KernelError ──────────────────────────────────────────────────────────────

describe('KernelError', () => {
  it('is instanceof KernelError', () => {
    expect(new KernelError('msg', 'CODE')).toBeInstanceOf(KernelError);
  });

  it('is instanceof Error', () => {
    expect(new KernelError('msg', 'CODE')).toBeInstanceOf(Error);
  });

  it('has name KernelError', () => {
    expect(new KernelError('msg', 'CODE').name).toBe('KernelError');
  });

  it('stores code', () => {
    expect(new KernelError('msg', 'MY_CODE').code).toBe('MY_CODE');
  });
});

// ── Scenario A — Successful execution ────────────────────────────────────────

describe('Scenario A — Successful execution', () => {
  it('returns an ExecutionHandle synchronously', () => {
    const kernel = makeKernel(successProvider);
    const handle = kernel.execute('test.success', 'my input');
    expect(typeof handle.executionId).toBe('string');
    expect(handle.executionId).toMatch(UUID_RE);
    expect(handle.capability).toBe('test.success');
  });

  it('completed resolves as SUCCEEDED', async () => {
    const kernel = makeKernel(successProvider);
    const handle = kernel.execute('test.success', 'my input');
    const evidence = await handle.completed;
    expect(evidence.status).toBe('SUCCEEDED');
  });

  it('evidence has the full 7-field envelope structure', async () => {
    const kernel = makeKernel(successProvider);
    const evidence = await kernel.execute('test.success', 'input').completed;
    assertEnvelopeShape(evidence, 'test.success');
  });

  it('payload contains provider output; failure is null', async () => {
    const kernel = makeKernel(successProvider);
    const evidence = await kernel.execute('test.success', 'abc').completed;
    expect(evidence.payload).toMatchObject({ analyzed: true, input: 'abc' });
    expect(evidence.failure).toBeNull();
  });

  it('handle.status reflects SUCCEEDED after completion', async () => {
    const kernel = makeKernel(successProvider);
    const handle = kernel.execute('test.success', null);
    await handle.completed;
    expect(handle.status).toBe('SUCCEEDED');
  });

  it('inspect returns handle with same terminal state', async () => {
    const kernel = makeKernel(successProvider);
    const handle = kernel.execute('test.success', null);
    await handle.completed;
    const inspected = kernel.inspect(handle.executionId);
    expect(inspected.status).toBe('SUCCEEDED');
    expect(inspected.executionId).toBe(handle.executionId);
  });
});

// ── Scenario B — Provider failure ────────────────────────────────────────────

describe('Scenario B — Provider failure', () => {
  it('completed resolves as FAILED (no try/catch needed)', async () => {
    const kernel = makeKernel(throwingProvider);
    const evidence = await kernel.execute('test.throw', null).completed;
    expect(evidence.status).toBe('FAILED');
  });

  it('evidence has the full 7-field envelope structure', async () => {
    const kernel = makeKernel(throwingProvider);
    const evidence = await kernel.execute('test.throw', null).completed;
    assertEnvelopeShape(evidence, 'test.throw');
  });

  it('payload is null; failure is structured and non-null', async () => {
    const kernel = makeKernel(throwingProvider);
    const evidence = await kernel.execute('test.throw', null).completed;
    expect(evidence.payload).toBeNull();
    expect(evidence.failure).not.toBeNull();
    expect(typeof evidence.failure!.message).toBe('string');
    expect(evidence.failure!.message).toBe('deliberate failure');
    expect(typeof evidence.failure!.stack).toBe('string');
    expect(evidence.failure!.stack).toContain('deliberate failure');
    expect('code' in evidence.failure!).toBe(true);
  });

  it('handle.status reflects FAILED after completion', async () => {
    const kernel = makeKernel(throwingProvider);
    const handle = kernel.execute('test.throw', null);
    await handle.completed;
    expect(handle.status).toBe('FAILED');
  });

  it('coerces non-Error throws to structured FailureDetail', async () => {
    const kernel = makeKernel(throwStringProvider);
    const evidence = await kernel.execute('test.throwstring', null).completed;
    expect(evidence.status).toBe('FAILED');
    expect(evidence.failure).not.toBeNull();
    expect(typeof evidence.failure!.message).toBe('string');
    expect(evidence.failure!.message).toBe('raw string error');
  });
});

// ── Scenario C — Cancellation ─────────────────────────────────────────────────

describe('Scenario C — Cancellation', () => {
  it('completed resolves immediately as CANCELLED without waiting for slow provider', async () => {
    const kernel = makeKernel(slowProvider);
    const handle = kernel.execute('test.slow', null);
    kernel.cancel(handle.executionId);
    const evidence = await handle.completed;
    expect(evidence.status).toBe('CANCELLED');
  });

  it('evidence has the full 7-field envelope structure', async () => {
    const kernel = makeKernel(slowProvider);
    const handle = kernel.execute('test.slow', null);
    kernel.cancel(handle.executionId);
    const evidence = await handle.completed;
    assertEnvelopeShape(evidence, 'test.slow');
  });

  it('payload is null and failure is null on CANCELLED', async () => {
    const kernel = makeKernel(slowProvider);
    const handle = kernel.execute('test.slow', null);
    kernel.cancel(handle.executionId);
    const evidence = await handle.completed;
    expect(evidence.payload).toBeNull();
    expect(evidence.failure).toBeNull();
  });

  it('handle.status reflects CANCELLED', async () => {
    const kernel = makeKernel(slowProvider);
    const handle = kernel.execute('test.slow', null);
    kernel.cancel(handle.executionId);
    await handle.completed;
    expect(handle.status).toBe('CANCELLED');
  });

  it('late provider resolution does not alter CANCELLED terminal state', async () => {
    const lateProvider: Provider = {
      capability: 'test.late',
      async run({ signal }: ProviderContext) {
        await new Promise<void>((resolve) => {
          const t = setTimeout(resolve, 20);
          signal.addEventListener('abort', () => { clearTimeout(t); setTimeout(resolve, 5); }, { once: true });
        });
        return { late: true };
      },
    };
    const kernel = makeKernel(lateProvider);
    const handle = kernel.execute('test.late', null);
    kernel.cancel(handle.executionId);
    const evidence = await handle.completed;
    // Give the late resolution a chance to fire
    await new Promise((r) => setTimeout(r, 50));
    expect(evidence.status).toBe('CANCELLED');
    expect(handle.status).toBe('CANCELLED');
  });
});

// ── Scenario D — Unknown capability ──────────────────────────────────────────

describe('Scenario D — Unknown capability', () => {
  it('throws KernelError synchronously for an unknown capability', () => {
    const kernel = makeKernel();
    expect(() => kernel.execute('nonexistent.capability', null)).toThrow(KernelError);
  });

  it('thrown error has code UNKNOWN_CAPABILITY', () => {
    const kernel = makeKernel();
    let err: unknown;
    try { kernel.execute('nonexistent.capability', null); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(KernelError);
    expect((err as KernelError).code).toBe('UNKNOWN_CAPABILITY');
  });

  it('no execution record is created; inspect throws UNKNOWN_EXECUTION', () => {
    const kernel = makeKernel();
    try { kernel.execute('nonexistent.capability', null); } catch { /* expected */ }
    expect(() => kernel.inspect('00000000-0000-0000-0000-000000000000')).toThrow(KernelError);
    let err: unknown;
    try { kernel.inspect('00000000-0000-0000-0000-000000000000'); } catch (e) { err = e; }
    expect((err as KernelError).code).toBe('UNKNOWN_EXECUTION');
  });
});

// ── inspect() ─────────────────────────────────────────────────────────────────

describe('inspect()', () => {
  it('returns a live handle for a known executionId', () => {
    const kernel = makeKernel(slowProvider);
    const handle = kernel.execute('test.slow', null);
    const inspected = kernel.inspect(handle.executionId);
    expect(inspected.executionId).toBe(handle.executionId);
    kernel.cancel(handle.executionId);
  });

  it('throws KernelError UNKNOWN_EXECUTION for an unrecognised ID', () => {
    const kernel = makeKernel();
    let err: unknown;
    try { kernel.inspect('00000000-0000-4000-8000-000000000000'); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(KernelError);
    expect((err as KernelError).code).toBe('UNKNOWN_EXECUTION');
  });
});

// ── cancel() edge cases ───────────────────────────────────────────────────────

describe('cancel() edge cases', () => {
  it('cancelling an already-SUCCEEDED execution is a no-op', async () => {
    const kernel = makeKernel(successProvider);
    const handle = kernel.execute('test.success', null);
    const evidence = await handle.completed;
    expect(() => kernel.cancel(handle.executionId)).not.toThrow();
    expect(handle.status).toBe('SUCCEEDED');
    expect(await handle.completed).toBe(evidence);
  });

  it('cancelling an already-FAILED execution is a no-op', async () => {
    const kernel = makeKernel(throwingProvider);
    const handle = kernel.execute('test.throw', null);
    const evidence = await handle.completed;
    expect(() => kernel.cancel(handle.executionId)).not.toThrow();
    expect(handle.status).toBe('FAILED');
    expect(await handle.completed).toBe(evidence);
  });

  it('cancelling an already-CANCELLED execution is a no-op', async () => {
    const kernel = makeKernel(slowProvider);
    const handle = kernel.execute('test.slow', null);
    kernel.cancel(handle.executionId);
    const evidence = await handle.completed;
    expect(() => kernel.cancel(handle.executionId)).not.toThrow();
    expect(handle.status).toBe('CANCELLED');
    expect(await handle.completed).toBe(evidence);
  });

  it('cancelling an unknown executionId throws KernelError UNKNOWN_EXECUTION', () => {
    const kernel = makeKernel();
    let err: unknown;
    try { kernel.cancel('00000000-0000-4000-8000-000000000000'); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(KernelError);
    expect((err as KernelError).code).toBe('UNKNOWN_EXECUTION');
  });
});

// ── Concurrent executions ────────────────────────────────────────────────────

describe('Concurrent executions', () => {
  it('two executions produce distinct executionIds', () => {
    const kernel = makeKernel(slowProvider);
    const h1 = kernel.execute('test.slow', null);
    const h2 = kernel.execute('test.slow', null);
    expect(h1.executionId).not.toBe(h2.executionId);
    kernel.cancel(h1.executionId);
    kernel.cancel(h2.executionId);
  });

  it("one execution's terminal state does not affect another's", async () => {
    const kernel = makeKernel(successProvider, throwingProvider);
    const h1 = kernel.execute('test.success', null);
    const h2 = kernel.execute('test.throw', null);
    const [e1, e2] = await Promise.all([h1.completed, h2.completed]);
    expect(e1.status).toBe('SUCCEEDED');
    expect(e2.status).toBe('FAILED');
  });
});
