import type { Provider, ProviderContext } from '../types.ts';

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    if (signal.aborted) { resolve(); return; }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
  });
}

export const requirementAnalyzeProvider: Provider = {
  capability: 'requirement.analyze',

  async run(context: ProviderContext): Promise<unknown> {
    if (context.signal.aborted) {
      return { analyzed: false, inputSummary: '', requirementCount: 0, confidence: 0 };
    }

    await delay(10, context.signal);

    const inputSummary =
      typeof context.input === 'string'
        ? context.input.slice(0, 100)
        : '[non-string input]';

    return {
      analyzed: true,
      inputSummary,
      requirementCount: 1,
      confidence: 0.95,
    };
  },
};
