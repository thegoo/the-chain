import type { Provider } from './types.ts';

export type ProviderRegistry = ReadonlyMap<string, Provider>;

export function buildRegistry(providers: Provider[]): ProviderRegistry {
  const map = new Map<string, Provider>();
  for (const provider of providers) {
    if (map.has(provider.capability)) {
      throw new Error(
        `Duplicate provider registered for capability: ${provider.capability}`,
      );
    }
    map.set(provider.capability, provider);
  }
  return map;
}
