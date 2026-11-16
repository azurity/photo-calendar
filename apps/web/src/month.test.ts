import { describe, expect, it } from 'vitest';
import type { Manifest } from '@photo-calendar/shared';
import { renderMonth } from './month';

function entry(date: string, caption = '这一天的文案。') {
  return {
    date,
    photo: `data/photos/${date}-a1b2c3d4.webp`,
    thumbnail: `data/photos/thumbs/${date}-a1b2c3d4.webp`,
    caption,
    createdAt: '2026-11-15T09:50:00Z',
    updatedAt: '2026-11-15T09:55:00Z',
  };
}

function manifest(entries: Manifest['entries'] = []): Manifest {
  return { version: 1, updatedAt: '2026-11-15T10:00:00Z', entries };
}

describe('renderMonth', () => {
  it('renders 2026-11 with Monday-first cells and thumbnails', () => {
    document.body.replaceChildren();
    const view = renderMonth({
      year: 2026,
      month: 11,
      manifest: manifest([entry('2026-11-08', '风把下午吹得很慢。')]),
      today: '2026-11-08',
    });
    document.body.append(view);

    expect(view.querySelectorAll('a.day-cell')).toHaveLength(30);
    expect(view.querySelectorAll('.day-cell.is-blank')).toHaveLength(12);
    const first = view.querySelector('a.day-cell');
    expect(first?.getAttribute('href')).toBe('./day.html?date=2026-11-01');

    const eighth = view.querySelector('a[href="./day.html?date=2026-11-08"]');
    expect(eighth?.classList.contains('is-today')).toBe(true);
    expect(eighth?.getAttribute('aria-current')).toBe('date');
    expect(eighth?.querySelector('img')?.getAttribute('alt')).toContain('风把下午吹得很慢');
  });

  it('leaves dates without entries empty', () => {
    document.body.replaceChildren();
    const view = renderMonth({ year: 2026, month: 11, manifest: manifest([]) });
    document.body.append(view);
    expect(view.querySelectorAll('img')).toHaveLength(0);
    expect(view.querySelectorAll('a.day-cell')).toHaveLength(30);
    expect(view.querySelectorAll('.day-print')).toHaveLength(0);
    expect(view.querySelectorAll('.day-stamp')).toHaveLength(30);
  });

  it('handles a February starting mid-week', () => {
    document.body.replaceChildren();
    const view = renderMonth({ year: 2024, month: 2, manifest: manifest([]) });
    document.body.append(view);
    expect(view.querySelectorAll('a.day-cell')).toHaveLength(29);
    expect(view.querySelectorAll('.day-cell.is-blank')).toHaveLength(6);
  });

  it('removes a broken thumbnail without leaving a broken image', () => {
    document.body.replaceChildren();
    const view = renderMonth({
      year: 2026,
      month: 11,
      manifest: manifest([entry('2026-11-08')]),
    });
    document.body.append(view);
    const image = view.querySelector('img');
    expect(image).not.toBeNull();
    image?.dispatchEvent(new Event('error'));
    expect(view.querySelector('img')).toBeNull();
    expect(view.querySelector('.photo-missing')).not.toBeNull();
    expect(view.querySelector('.day-print')).toBeNull();
  });
});
