import { describe, it, expect } from 'vitest';
import { createExecutionRecord } from '../src/execution.ts';
import type { EvidenceEnvelope } from '../src/types.ts';

const TEST_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const TEST_CAP = 'test.capability';

describe('createExecutionRecord', () => {
  it('creates a record with status PENDING', () => {
    const record = createExecutionRecord(TEST_ID, TEST_CAP);
    expect(record.status).toBe('PENDING');
  });

  it('sets executionId to the passed id', () => {
    const record = createExecutionRecord(TEST_ID, TEST_CAP);
    expect(record.executionId).toBe(TEST_ID);
  });

  it('sets capability to the passed capability', () => {
    const record = createExecutionRecord(TEST_ID, TEST_CAP);
    expect(record.capability).toBe(TEST_CAP);
  });

  it('sets startedAt to a valid ISO 8601 string', () => {
    const record = createExecutionRecord(TEST_ID, TEST_CAP);
    expect(typeof record.startedAt).toBe('string');
    expect(record.startedAt.length).toBeGreaterThan(0);
    expect(() => new Date(record.startedAt).toISOString()).not.toThrow();
  });

  it('exposes completed as a Promise', () => {
    const record = createExecutionRecord(TEST_ID, TEST_CAP);
    expect(record.completed).toBeInstanceOf(Promise);
  });

  it('exposes controller as an AbortController with a signal', () => {
    const record = createExecutionRecord(TEST_ID, TEST_CAP);
    expect(record.controller).toBeInstanceOf(AbortController);
    expect(record.controller.signal).toBeInstanceOf(AbortSignal);
  });

  it('resolves completed when _resolve is called with an envelope', async () => {
    const record = createExecutionRecord(TEST_ID, TEST_CAP);
    const envelope: EvidenceEnvelope = {
      executionId: TEST_ID,
      capability: TEST_CAP,
      status: 'SUCCEEDED',
      startedAt: record.startedAt,
      completedAt: new Date().toISOString(),
      payload: { ok: true },
      failure: null,
    };
    record._resolve(envelope);
    const result = await record.completed;
    expect(result).toBe(envelope);
  });
});
