import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { deterministicIndex, deterministicPick, deterministicSeed, hash32 } from './seed';

describe('deterministic selection', () => {
  it('matches fixed FNV-1a snapshots', () => {
    expect(hash32('2026-11-08|phrase|v1')).toBe(4023462265);
    expect(hash32('2026-11-08|pattern|v1')).toBe(1833765402);
    expect(hash32('2026-11-08|seed|v1')).toBe(2640208565);
  });

  it('derives stable indexes and seeds', () => {
    expect(deterministicIndex('2026-11-08', 'phrase', 49)).toBe(39);
    expect(deterministicIndex('2026-11-08', 'pattern', 12)).toBe(6);
    expect(deterministicSeed('2026-11-08')).toBe(2640208565);
  });

  it('allows different domains to select different items', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const phrase = deterministicPick('2026-11-08', 'phrase', items);
    const pattern = deterministicPick('2026-11-08', 'pattern', items);
    expect(typeof phrase).toBe('string');
    expect(typeof pattern).toBe('string');
    expect(deterministicPick('2026-11-08', 'phrase', items)).toBe(phrase);
  });

  it('never uses Math.random in fallback modules', () => {
    const source = readFileSync(
      new URL('../../../apps/web/src/fallback/index.ts', import.meta.url),
      'utf8',
    );
    expect(source).not.toContain('Math.random');
  });
});
