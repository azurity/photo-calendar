import { monthKey, parseIsoDate, parseMonth, shiftMonth, todayIso } from '@photo-calendar/shared';
import { loadCalendarData } from './data';
import { h } from './dom';
import { renderMonth } from './month';
import { updatePageMeta } from './meta';

const app = document.querySelector<HTMLElement>('#app')!;
if (!app) throw new Error('Missing #app');

const today = todayIso();
const todayParts = parseIsoDate(today) ?? { year: 2026, month: 1, day: 1 };
let current = parseMonth(new URL(location.href).searchParams.get('month') ?? '') ?? {
  year: todayParts.year,
  month: todayParts.month,
};
const initialMonthInvalid =
  new URL(location.href).searchParams.has('month') &&
  parseMonth(new URL(location.href).searchParams.get('month') ?? '') === null;

function writeMonthToUrl(mode: 'replace' | 'push'): void {
  const url = new URL(location.href);
  url.searchParams.set('month', monthKey(current.year, current.month));
  if (mode === 'replace') history.replaceState(null, '', url);
  else history.pushState(null, '', url);
}

function syncUrlIfNeeded(): void {
  const raw = new URL(location.href).searchParams.get('month');
  if (raw !== monthKey(current.year, current.month)) writeMonthToUrl('replace');
}

function showLoading(): void {
  app.replaceChildren(h('p', { class: 'loading' }, ['正在翻开日历…']));
}

async function boot(): Promise<void> {
  showLoading();
  syncUrlIfNeeded();
  const data = await loadCalendarData();
  const notices = [data.error, ...data.warnings].filter(Boolean) as string[];
  if (initialMonthInvalid) notices.unshift('月份参数无效，已回到当前月份。');
  if (!new URL(location.href).searchParams.has('month')) {
    notices.push('已为你打开当前月份。');
  }

  const render = (): void => {
    const view = renderMonth({
      year: current.year,
      month: current.month,
      manifest: data.manifest,
      today,
    });
    const nodes: Node[] = [];
    if (notices.length > 0) {
      nodes.push(h('p', { class: 'notice', role: 'status' }, [notices.join(' ')]));
    }
    nodes.push(view);
    app.replaceChildren(...nodes);
    updatePageMeta({
      title: `${current.year} 年 ${current.month} 月 · 照片日历`,
      description: `${current.year} 年 ${current.month} 月的照片日历：${data.manifest.entries.length} 个值得记住的日子。`,
    });
  };

  app.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const action = target.closest<HTMLElement>('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'prev') {
      current = shiftMonth(current.year, current.month, -1);
    } else if (action === 'next') {
      current = shiftMonth(current.year, current.month, 1);
    } else if (action === 'today') {
      current = { year: todayParts.year, month: todayParts.month };
    } else {
      return;
    }
    writeMonthToUrl('push');
    render();
  });

  window.addEventListener('popstate', () => {
    const parsed = parseMonth(new URL(location.href).searchParams.get('month') ?? '');
    current = parsed ?? { year: todayParts.year, month: todayParts.month };
    render();
  });

  render();
}

void boot();
