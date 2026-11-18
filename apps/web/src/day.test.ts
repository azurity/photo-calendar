import { describe, expect, it } from 'vitest';
import type { Manifest } from '@photo-calendar/shared';
import { renderDay } from './day';

const entry = {
  date: '2026-11-08',
  photo: 'data/photos/2026-11-08-a1b2c3d4.webp',
  thumbnail: 'data/photos/thumbs/2026-11-08-a1b2c3d4.webp',
  caption: '风把下午吹得很慢，连影子都愿意多留一会儿。',
  createdAt: '2026-11-15T09:50:00Z',
  updatedAt: '2026-11-15T09:55:00Z',
};

function manifest(entries: Manifest['entries'] = []): Manifest {
  return { version: 1, updatedAt: '2026-11-15T10:00:00Z', entries };
}

describe('renderDay', () => {
  it('renders a photo as the main subject with navigation and metadata', () => {
    document.head.replaceChildren();
    document.body.replaceChildren();
    const result = renderDay({ date: '2026-11-08', manifest: manifest([entry]) });
    document.body.append(result.element);

    expect(result.usedFallback).toBe(false);
    expect(result.element.querySelector('img')?.getAttribute('alt')).toContain('风把下午吹得很慢');
    expect(result.element.querySelector('.day-caption')?.textContent).toContain('风把下午');
    expect(result.element.querySelector('a[rel="prev"]')?.getAttribute('href')).toContain(
      '2026-11-07',
    );
    expect(result.element.querySelector('a[rel="next"]')?.getAttribute('href')).toContain(
      '2026-11-09',
    );
    expect(document.title).toContain('2026 年 11 月 8 日');
    expect(
      document.head.querySelector('meta[property="og:image"]')?.getAttribute('content'),
    ).toContain('2026-11-08-a1b2c3d4.webp');
  });

  it('places the date and caption inside the photo paper note', () => {
    document.head.replaceChildren();
    document.body.replaceChildren();
    const result = renderDay({ date: '2026-11-08', manifest: manifest([entry]) });
    document.body.append(result.element);

    const figure = result.element.querySelector('figure.photo-paper');
    const note = figure?.querySelector('figcaption.photo-paper-note');
    expect(figure).not.toBeNull();
    expect(note).not.toBeNull();
    expect(figure?.querySelector('img.day-photo')).not.toBeNull();
    expect(note?.querySelector('.day-caption')?.textContent).toContain('风把下午');
    expect(note?.querySelector('h1#day-heading')).not.toBeNull();
    expect(note?.querySelector('.day-weekday')?.textContent).toBe('星期日');
    expect(result.element.querySelector('.day-copy')).toBeNull();
    expect(result.element.querySelector('.photo-paper-mark')).toBeNull();
    expect(result.element.getAttribute('aria-labelledby')).toBe('day-heading');
    expect(result.element.querySelectorAll('#day-heading')).toHaveLength(1);
  });

  it('renders fallback phrase and doodle when there is no photo', () => {
    document.head.replaceChildren();
    document.body.replaceChildren();
    const result = renderDay({ date: '2026-11-09', manifest: manifest([]) });
    document.body.append(result.element);

    expect(result.usedFallback).toBe(true);
    expect(result.element.querySelector('img')).toBeNull();
    expect(result.element.querySelector('.fallback-phrase')?.textContent?.length).toBeGreaterThan(
      8,
    );
    expect(result.element.querySelector('css-doodle')).not.toBeNull();
    expect(result.element.querySelector('.fallback-copy')).not.toBeNull();
    expect(result.element.querySelector('figure.photo-paper')).toBeNull();
    expect(result.element.querySelector('.day-copy')).toBeNull();
    expect(document.head.querySelector('meta[property="og:image"]')).toBeNull();
  });

  it('falls back when the photo fails to load', () => {
    document.head.replaceChildren();
    document.body.replaceChildren();
    const result = renderDay({ date: '2026-11-08', manifest: manifest([entry]) });
    document.body.append(result.element);
    const image = result.element.querySelector('img');
    image?.dispatchEvent(new Event('error'));
    expect(document.body.querySelector('.fallback-view')).not.toBeNull();
    expect(document.body.querySelector('img')).toBeNull();
  });

  it('renders unknown HTML in captions as text', () => {
    document.body.replaceChildren();
    const result = renderDay({
      date: '2026-11-08',
      manifest: manifest([{ ...entry, caption: '<script>alert(1)</script>' }]),
    });
    document.body.append(result.element);
    expect(result.element.querySelector('.day-caption')?.textContent).toBe(
      '<script>alert(1)</script>',
    );
    expect(result.element.querySelector('script')).toBeNull();
  });

  it('supports a forced fallback with a notice', () => {
    document.body.replaceChildren();
    const result = renderDay({
      date: '2026-11-08',
      manifest: manifest([entry]),
      forceFallback: true,
      notice: '照片无法加载。',
    });
    document.body.append(result.element);
    expect(result.usedFallback).toBe(true);
    expect(result.element.querySelector('.notice')?.textContent).toContain('照片无法加载');
  });
});
