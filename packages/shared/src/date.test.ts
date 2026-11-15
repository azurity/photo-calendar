import { describe, expect, it } from 'vitest';
import {
  addDays,
  dayOfWeek,
  daysInMonth,
  formatChineseDate,
  isValidIsoDate,
  monthMatrix,
  parseIsoDate,
  parseMonth,
  shiftMonth,
  toIsoDate,
  weekdayName,
} from './date';

describe('date utilities', () => {
  it('parses valid dates and rejects impossible ones', () => {
    expect(parseIsoDate('2024-02-29')).toEqual({ year: 2024, month: 2, day: 29 });
    expect(parseIsoDate('2026-02-29')).toBeNull();
    expect(parseIsoDate('2026-02-30')).toBeNull();
    expect(parseIsoDate('2026-13-01')).toBeNull();
    expect(parseIsoDate('2026-1-01')).toBeNull();
    expect(isValidIsoDate('2026-11-08')).toBe(true);
  });

  it('formats dates without timezone conversion', () => {
    expect(toIsoDate({ year: 2026, month: 1, day: 2 })).toBe('2026-01-02');
    expect(formatChineseDate('2026-11-08')).toBe('2026 年 11 月 8 日');
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('uses Monday as the first weekday', () => {
    expect(dayOfWeek('2026-11-08')).toBe(6);
    expect(weekdayName('2026-11-08')).toBe('星期日');
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
  });

  it('builds complete month grids', () => {
    const weeks = monthMatrix(2026, 11);
    expect(weeks).toHaveLength(6);
    expect(weeks[0]).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
    expect(weeks.flat().filter(Boolean)[0]).toBe('2026-11-01');
    expect(weeks.flat().filter(Boolean)[29]).toBe('2026-11-30');
  });

  it('parses and shifts months', () => {
    expect(parseMonth('2026-11')).toEqual({ year: 2026, month: 11 });
    expect(parseMonth('2026-13')).toBeNull();
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });
});
