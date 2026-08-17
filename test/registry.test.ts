import { describe, it, expect } from 'vitest';
import { buildRegistry } from '../src/registry.ts';
import type { Provider } from '../src/types.ts';

const makeProvider = (capability: string): Provider => ({
  capability,
  async run() { return null; },
});

describe('buildRegistry', () => {
  it('returns a map with one entry for a single provider', () => {
    const p = makeProvider('test.one');
    const registry = buildRegistry([p]);
    expect(registry.size).toBe(1);
    expect(registry.get('test.one')).toBe(p);
  });

  it('returns both entries for two providers with distinct capabilities', () => {
    const p1 = makeProvider('test.one');
    const p2 = makeProvider('test.two');
    const registry = buildRegistry([p1, p2]);
    expect(registry.size).toBe(2);
    expect(registry.get('test.one')).toBe(p1);
    expect(registry.get('test.two')).toBe(p2);
  });

  it('succeeds and returns an empty registry for an empty array', () => {
    const registry = buildRegistry([]);
    expect(registry.size).toBe(0);
  });

  it('throws when the same capability is registered twice', () => {
    const p = makeProvider('test.duplicate');
    expect(() => buildRegistry([p, p])).toThrow('test.duplicate');
  });
});
