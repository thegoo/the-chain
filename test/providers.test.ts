import { describe, it, expect } from 'vitest';
import { requirementAnalyzeProvider } from '../src/providers/requirement-analyze.ts';
import type { ProviderContext } from '../src/types.ts';

const makeContext = (input: unknown, signal?: AbortSignal): ProviderContext => ({
  executionId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  capability: 'requirement.analyze',
  input,
  signal: signal ?? new AbortController().signal,
});

describe('requirementAnalyzeProvider', () => {
  it('has capability requirement.analyze', () => {
    expect(requirementAnalyzeProvider.capability).toBe('requirement.analyze');
  });

  it('resolves with a plain object when signal is not aborted', async () => {
    const result = await requirementAnalyzeProvider.run(makeContext('parse this'));
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
  });

  it('payload contains analyzed: true', async () => {
    const result = await requirementAnalyzeProvider.run(makeContext('spec text')) as Record<string, unknown>;
    expect(result['analyzed']).toBe(true);
  });

  it('payload contains inputSummary derived from the input string', async () => {
    const result = await requirementAnalyzeProvider.run(makeContext('hello world')) as Record<string, unknown>;
    expect(typeof result['inputSummary']).toBe('string');
    expect((result['inputSummary'] as string).length).toBeGreaterThan(0);
  });

  it('does not throw for non-string input', async () => {
    await expect(requirementAnalyzeProvider.run(makeContext({ nested: true }))).resolves.not.toThrow();
    const result = await requirementAnalyzeProvider.run(makeContext(42)) as Record<string, unknown>;
    expect(typeof result['inputSummary']).toBe('string');
  });

  it('resolves (does not throw or reject) when signal is pre-aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      requirementAnalyzeProvider.run(makeContext('anything', controller.signal))
    ).resolves.toBeDefined();
  });

  it('resolves gracefully when signal is aborted mid-delay', async () => {
    const controller = new AbortController();
    const runPromise = requirementAnalyzeProvider.run(makeContext('anything', controller.signal));
    controller.abort();
    await expect(runPromise).resolves.toBeDefined();
  });
});
