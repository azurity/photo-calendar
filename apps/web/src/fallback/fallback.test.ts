import { describe, expect, it } from 'vitest';
import { fallbackFor } from './index';
import { FALLBACK_CONTENT_VERSION, PHRASES } from './phrases';
import { PATTERNS } from './patterns';

describe('fallback content', () => {
  it('has at least 40 unique, reasonably sized phrases', () => {
    expect(PHRASES.length).toBeGreaterThanOrEqual(40);
    expect(new Set(PHRASES).size).toBe(PHRASES.length);
    for (const phrase of PHRASES) {
      expect(phrase.length).toBeGreaterThan(8);
      expect(phrase.length).toBeLessThan(60);
    }
  });

  it('has at least 12 non-animated doodle patterns', () => {
    expect(PATTERNS.length).toBeGreaterThanOrEqual(12);
    for (const pattern of PATTERNS) {
      expect(pattern.name.length).toBeGreaterThan(0);
      expect(pattern.rule.length).toBeGreaterThan(20);
      expect(pattern.rule.toLowerCase()).not.toContain('animation');
    }
  });

  it('is stable for a date and can differ across dates', () => {
    const first = fallbackFor('2026-11-08');
    const again = fallbackFor('2026-11-08');
    expect(again).toEqual(first);
    expect(first.contentVersion).toBe(FALLBACK_CONTENT_VERSION);
    const other = fallbackFor('2026-11-09');
    expect(other.phrase !== first.phrase || other.pattern.name !== first.pattern.name).toBe(true);
  });

  it('selects deterministic known values', () => {
    const content = fallbackFor('2026-11-08');
    expect(content.seed).toBe(2640208565);
    expect(content.phrase).toBe(PHRASES[39]);
    expect(content.pattern).toBe(PATTERNS[6]);
  });
});
