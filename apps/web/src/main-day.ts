import { parseIsoDate, todayIso } from '@photo-calendar/shared';
import { loadCalendarData } from './data';
import { renderDay } from './day';
import { h } from './dom';

const app = document.querySelector<HTMLElement>('#app')!;
if (!app) throw new Error('Missing #app');

const today = todayIso();
const rawDate = new URL(location.href).searchParams.get('date');
const parsedDate = rawDate ? parseIsoDate(rawDate) : null;
const invalid = rawDate !== null && parsedDate === null;
const date = parsedDate && rawDate ? rawDate : today;

if (invalid) {
  const url = new URL(location.href);
  url.searchParams.set('date', today);
  history.replaceState(null, '', url);
}

function showLoading(): void {
  app.replaceChildren(h('p', { class: 'loading' }, ['正在翻开这一天…']));
}

async function boot(): Promise<void> {
  showLoading();
  const data = await loadCalendarData();
  const notices = [
    invalid ? '日期参数无效，已回到今天。' : undefined,
    data.error,
    ...data.warnings,
  ].filter(Boolean) as string[];
  const result = renderDay({
    date,
    manifest: data.manifest,
    notice: notices.length > 0 ? notices.join(' ') : undefined,
  });
  app.replaceChildren(result.element);
}

void boot();
