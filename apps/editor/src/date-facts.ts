import { dayOfWeek, parseIsoDate } from '@photo-calendar/shared';
import { Solar } from 'lunar-javascript';

export interface DateFacts {
  gregorian: string[];
  lunar: string[];
  solarTerm: string | null;
  summary: string;
}

const FIXED_GREGORIAN: Record<string, string[]> = {
  '01-01': ['元旦'],
  '02-14': ['情人节'],
  '03-08': ['妇女节'],
  '03-12': ['植树节'],
  '04-01': ['愚人节'],
  '05-01': ['劳动节'],
  '05-04': ['青年节'],
  '06-01': ['儿童节'],
  '07-01': ['建党节'],
  '08-01': ['建军节'],
  '09-10': ['教师节'],
  '10-01': ['国庆节'],
  '12-24': ['平安夜'],
  '12-25': ['圣诞节'],
};

function normalizeFestival(name: string): string {
  if (name === '春节') return name;
  return name.replace(/节$/, '');
}

function floatingFestivals(date: string): string[] {
  const parts = parseIsoDate(date);
  if (!parts) return [];
  const weekday = dayOfWeek(date);
  const result: string[] = [];
  if (parts.month === 5 && weekday === 6 && Math.ceil(parts.day / 7) === 2) {
    result.push('母亲节');
  }
  if (parts.month === 6 && weekday === 6 && Math.ceil(parts.day / 7) === 3) {
    result.push('父亲节');
  }
  if (parts.month === 11 && weekday === 3 && Math.ceil(parts.day / 7) === 4) {
    result.push('感恩节');
  }
  return result;
}

export function getDateFacts(date: string): DateFacts {
  const parts = parseIsoDate(date);
  if (!parts || parts.year < 1900 || parts.year > 2100) {
    return { gregorian: [], lunar: [], solarTerm: null, summary: '无已知日期特征' };
  }

  const gregorian = new Set(FIXED_GREGORIAN[date.slice(5)] ?? []);
  for (const name of floatingFestivals(date)) gregorian.add(name);

  let lunarFestivals: string[] = [];
  let solarTerm: string | null = null;
  try {
    const solar = Solar.fromYmd(parts.year, parts.month, parts.day);
    for (const name of solar.getFestivals() as string[]) {
      gregorian.add(normalizeFestival(name));
    }
    const lunar = solar.getLunar();
    lunarFestivals = (lunar.getFestivals() as string[]).map(normalizeFestival);
    const jieQi = lunar.getJieQi();
    solarTerm = typeof jieQi === 'string' && jieQi.length > 0 ? jieQi : null;
  } catch {
    return { gregorian: [], lunar: [], solarTerm: null, summary: '无已知日期特征' };
  }

  const all = [...gregorian, ...lunarFestivals, ...(solarTerm ? [solarTerm] : [])];
  return {
    gregorian: [...gregorian],
    lunar: lunarFestivals,
    solarTerm,
    summary: all.length > 0 ? all.join('、') : '无已知日期特征',
  };
}

export function formatDateFacts(facts: DateFacts): string {
  return `公历特征：${facts.gregorian.join('、') || '无'}；农历特征：${
    facts.lunar.join('、') || '无'
  }；节气：${facts.solarTerm ?? '无'}；汇总：${facts.summary}`;
}
