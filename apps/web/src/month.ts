import {
  compareIsoDate,
  formatChineseDate,
  monthMatrix,
  monthKey,
  parseIsoDate,
  todayIso,
  type Manifest,
} from '@photo-calendar/shared';
import { h, truncateText } from './dom';
import { resolveAssetPath } from './data';

export interface MonthRenderOptions {
  year: number;
  month: number;
  manifest: Manifest;
  today?: string;
}

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

function entryMap(manifest: Manifest): Map<string, Manifest['entries'][number]> {
  return new Map(manifest.entries.map((entry) => [entry.date, entry]));
}

function photoAlt(date: string, caption: string): string {
  const formatted = formatChineseDate(date);
  return `${formatted}的照片：${truncateText(caption, 40)}`;
}

export function renderMonth(options: MonthRenderOptions): HTMLElement {
  const today = options.today ?? todayIso();
  const entries = entryMap(options.manifest);
  const root = h('section', { class: 'month-view', 'aria-labelledby': 'month-heading' });

  const heading = h('h1', { class: 'month-heading', id: 'month-heading' }, [
    `${options.year} 年 ${options.month} 月`,
  ]);
  const subtitle = h('p', { class: 'month-subtitle' }, [
    `${options.manifest.entries.length} 个值得记住的日子`,
  ]);
  const headCopy = h('div', {}, [heading, subtitle]);

  const actions = h('div', { class: 'month-actions' }, [
    h(
      'button',
      {
        class: 'pill-button',
        type: 'button',
        'data-action': 'prev',
        'aria-label': '上一月',
      },
      ['← 上一月'],
    ),
    h(
      'button',
      { class: 'pill-button', type: 'button', 'data-action': 'today', 'aria-label': '回到今天' },
      ['今天'],
    ),
    h(
      'button',
      {
        class: 'pill-button',
        type: 'button',
        'data-action': 'next',
        'aria-label': '下一月',
      },
      ['下一月 →'],
    ),
  ]);

  const head = h('div', { class: 'month-head' }, [headCopy, actions]);
  const weekdayRow = h(
    'div',
    { class: 'weekday-row', 'aria-hidden': 'true' },
    WEEKDAY_LABELS.map((label) => h('div', { class: 'weekday' }, [label])),
  );

  const grid = h('div', {
    class: 'month-grid',
    'aria-label': `${options.year} 年 ${options.month} 月`,
  });
  for (const week of monthMatrix(options.year, options.month)) {
    for (const date of week) {
      if (!date) {
        grid.append(h('span', { class: 'day-cell is-blank', 'aria-hidden': 'true' }));
        continue;
      }
      const entry = entries.get(date);
      const isToday = date === today;
      const attributes: Record<string, string | boolean> = {
        class: `day-cell${isToday ? ' is-today' : ''}${entry ? ' has-photo' : ''}`,
        href: `./day.html?date=${date}`,
      };
      if (isToday) attributes['aria-current'] = 'date';
      const cell = h('a', attributes);
      const number = h('span', { class: 'day-number day-stamp' }, [
        String(parseIsoDate(date)?.day ?? ''),
      ]);
      if (isToday)
        number.append(h('span', { class: 'today-label', 'aria-hidden': 'true' }, ['今天']));
      cell.append(number);
      if (entry) {
        const print = h('span', { class: 'day-print' });
        const image = h('img', {
          class: 'day-thumb',
          src: resolveAssetPath(entry.thumbnail),
          alt: photoAlt(date, entry.caption),
          loading: 'lazy',
          decoding: 'async',
        });
        image.addEventListener('error', () => {
          image.remove();
          print.remove();
          cell.classList.remove('has-photo');
          cell.classList.add('photo-missing');
        });
        print.append(image);
        print.append(
          h('span', { class: 'day-cell-caption', 'aria-hidden': 'true' }, [
            truncateText(entry.caption, 24),
          ]),
        );
        cell.append(print);
      }
      grid.append(cell);
    }
  }

  const gridWrap = h('div', { class: 'month-grid-wrap' }, [weekdayRow, grid]);
  root.append(head, gridWrap);
  return root;
}

export function monthHref(year: number, month: number): string {
  return `./index.html?month=${monthKey(year, month)}`;
}

export function sortedEntries(manifest: Manifest) {
  return [...manifest.entries].sort((a, b) => compareIsoDate(b.date, a.date));
}
