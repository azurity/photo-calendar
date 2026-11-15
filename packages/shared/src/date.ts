export interface DateParts {
  year: number;
  month: number;
  day: number;
}

export interface MonthParts {
  year: number;
  month: number;
}

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_MONTH_RE = /^(\d{4})-(\d{2})$/;

export function isValidDateParts(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function parseIsoDate(value: string): DateParts | null {
  const match = ISO_DATE_RE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return isValidDateParts(year, month, day) ? { year, month, day } : null;
}

export function isValidIsoDate(value: string): boolean {
  return parseIsoDate(value) !== null;
}

export function toIsoDate(parts: DateParts): string {
  const year = String(parts.year).padStart(4, '0');
  const month = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dateToUtc(parts: DateParts): Date {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

export function addDays(date: string, days: number): string {
  const parts = parseIsoDate(date);
  if (!parts) throw new Error(`Invalid date: ${date}`);
  const next = dateToUtc(parts);
  next.setUTCDate(next.getUTCDate() + days);
  return toIsoDate({
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  });
}

export function dayOfWeek(date: string): number {
  const parts = parseIsoDate(date);
  if (!parts) throw new Error(`Invalid date: ${date}`);
  return (dateToUtc(parts).getUTCDay() + 6) % 7;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthMatrix(year: number, month: number): (string | null)[][] {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid month: ${year}-${month}`);
  }
  const leading = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const total = daysInMonth(year, month);
  const cells: (string | null)[] = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= total; day += 1) {
    cells.push(toIsoDate({ year, month, day }));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  while (cells.length < 35) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }
  return weeks;
}

export function parseMonth(value: string): MonthParts | null {
  const match = ISO_MONTH_RE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 1 || year > 9999 || month < 1 || month > 12) return null;
  return { year, month };
}

export function monthKey(year: number, month: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

export function shiftMonth(year: number, month: number, delta: number): MonthParts {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function todayIso(now: Date = new Date()): string {
  return toIsoDate({ year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() });
}

export const WEEKDAY_NAMES = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];

export function weekdayName(date: string): string {
  return WEEKDAY_NAMES[dayOfWeek(date)] ?? '';
}

export function formatChineseDate(date: string): string {
  const parts = parseIsoDate(date);
  if (!parts) return date;
  return `${parts.year} 年 ${parts.month} 月 ${parts.day} 日`;
}

export function compareIsoDate(a: string, b: string): number {
  return a.localeCompare(b);
}
