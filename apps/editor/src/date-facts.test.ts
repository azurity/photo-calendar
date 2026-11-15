import { describe, expect, it } from 'vitest';
import { getDateFacts } from './date-facts';

describe('date facts', () => {
  it('finds Gregorian New Year', () => {
    expect(getDateFacts('2026-01-01').gregorian).toContain('元旦');
  });

  it('finds Lunar New Year', () => {
    const facts = getDateFacts('2026-02-17');
    expect(facts.lunar).toContain('春节');
    expect(facts.summary).toContain('春节');
  });

  it('finds a solar term', () => {
    const facts = getDateFacts('2026-11-07');
    expect(facts.solarTerm).toBe('立冬');
  });

  it('does not invent features outside the supported range', () => {
    const facts = getDateFacts('1800-01-01');
    expect(facts.summary).toBe('无已知日期特征');
    expect(facts.gregorian).toEqual([]);
  });

  it('finds floating festivals', () => {
    expect(getDateFacts('2026-05-10').gregorian).toContain('母亲节');
    expect(getDateFacts('2026-06-21').gregorian).toContain('父亲节');
  });
});
