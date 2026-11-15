import {
  addDays,
  formatChineseDate,
  parseIsoDate,
  weekdayName,
  type Manifest,
} from '@photo-calendar/shared';
import { fallbackFor } from './fallback';
import { resolveAssetPath } from './data';
import { domId, h, truncateText } from './dom';
import { mountDoodle } from './doodle';
import { monthHref } from './month';
import { updatePageMeta } from './meta';

export interface DayRenderOptions {
  date: string;
  manifest: Manifest;
  notice?: string;
  forceFallback?: boolean;
}

export interface DayRenderResult {
  element: HTMLElement;
  usedFallback: boolean;
}

function navFor(date: string): HTMLElement {
  const parts = parseIsoDate(date);
  const monthLink = parts ? monthHref(parts.year, parts.month) : './index.html';
  return h('nav', { class: 'day-navigation', 'aria-label': '日期导航' }, [
    h('a', { class: 'day-nav-link', href: `./day.html?date=${addDays(date, -1)}`, rel: 'prev' }, [
      '← 前一天',
    ]),
    h('a', { class: 'day-nav-link', href: monthLink }, ['回到月历']),
    h('a', { class: 'day-nav-link', href: `./day.html?date=${addDays(date, 1)}`, rel: 'next' }, [
      '后一天 →',
    ]),
  ]);
}

function noticeElement(text?: string): HTMLElement | null {
  return text ? h('p', { class: 'notice', role: 'status' }, [text]) : null;
}

function photoAlt(date: string, caption: string): string {
  return `${formatChineseDate(date)}的照片：${truncateText(caption, 60)}`;
}

function renderPhotoDay(
  options: DayRenderOptions,
  entry: Manifest['entries'][number],
): DayRenderResult {
  const { date, notice } = options;
  const captionId = domId('caption');
  const element = h('article', { class: 'day-view', 'aria-labelledby': 'day-heading' });
  const noticeNode = noticeElement(notice);

  const image = h('img', {
    class: 'day-photo',
    src: resolveAssetPath(entry.photo),
    alt: photoAlt(date, entry.caption),
    decoding: 'async',
    fetchpriority: 'high',
  });
  const stage = h('div', { class: 'day-photo-stage' }, [image]);

  const copyChildren: Array<Node | string> = [
    h('p', { class: 'day-eyebrow' }, ['一天一张 · 有照片的日子']),
    h('h1', { class: 'day-date', id: 'day-heading' }, [
      h('time', { datetime: date }, [formatChineseDate(date)]),
    ]),
    h('p', { class: 'day-weekday' }, [weekdayName(date)]),
    h('p', { class: 'day-caption', id: captionId }, [entry.caption]),
  ];
  if (noticeNode) copyChildren.unshift(noticeNode);
  const copy = h('div', { class: 'day-copy' }, copyChildren);

  element.append(stage, copy, navFor(date));

  image.addEventListener('error', () => {
    const fallback = renderDay({
      ...options,
      forceFallback: true,
      notice: '这一天的照片暂时无法加载，先读一句今天的寄语。',
    });
    element.replaceWith(fallback.element);
  });

  updatePageMeta({
    title: `${formatChineseDate(date)} · 照片日历`,
    description: entry.caption,
    image: resolveAssetPath(entry.photo),
  });
  return { element, usedFallback: false };
}

function renderFallbackDay(options: DayRenderOptions): DayRenderResult {
  const { date, notice } = options;
  const content = fallbackFor(date);
  const element = h('article', { class: 'fallback-view', 'aria-labelledby': 'day-heading' });
  mountDoodle(element, content);

  const copyChildren: Array<Node | string> = [
    h('p', { class: 'day-eyebrow' }, ['没有照片的一天']),
    h('h1', { class: 'day-date', id: 'day-heading' }, [
      h('time', { datetime: date }, [formatChineseDate(date)]),
    ]),
    h('p', { class: 'day-weekday' }, [weekdayName(date)]),
    h('p', { class: 'fallback-phrase' }, [content.phrase]),
    h('p', { class: 'fallback-meta' }, [`今日寄语 · 内容库 v${content.contentVersion}`]),
  ];
  const noticeNode = noticeElement(notice);
  if (noticeNode) copyChildren.unshift(noticeNode);
  const copy = h('div', { class: 'fallback-copy' }, copyChildren);
  element.append(copy, navFor(date));

  updatePageMeta({
    title: `${formatChineseDate(date)} · 照片日历`,
    description: content.phrase,
  });
  return { element, usedFallback: true };
}

export function renderDay(options: DayRenderOptions): DayRenderResult {
  const entry = options.manifest.entries.find((candidate) => candidate.date === options.date);
  if (entry && !options.forceFallback) return renderPhotoDay(options, entry);
  return renderFallbackDay(options);
}
