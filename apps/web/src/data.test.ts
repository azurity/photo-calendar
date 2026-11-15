import { describe, expect, it, vi } from 'vitest';
import { loadCalendarData } from './data';

const manifest = {
  version: 1,
  updatedAt: '2026-11-15T10:00:00Z',
  entries: [],
};

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('loadCalendarData', () => {
  it('loads valid data with the build version as cache key', async () => {
    const fetchImpl = vi.fn(async () => response(manifest)) as unknown as typeof fetch;
    const result = await loadCalendarData({
      baseUrl: 'https://example.test/photo-calendar/',
      version: '2026-11-15T10:00:00Z',
      fetchImpl,
    });
    expect(result.error).toBeUndefined();
    expect(result.manifest.entries).toEqual([]);
    const calledUrl = String((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]);
    expect(calledUrl).toBe(
      'https://example.test/photo-calendar/data/calendar.json?v=2026-11-15T10%3A00%3A00Z',
    );
  });

  it('degrades on HTTP errors', async () => {
    const fetchImpl = vi.fn(async () => response({}, 404)) as unknown as typeof fetch;
    const result = await loadCalendarData({
      baseUrl: 'https://example.test/photo-calendar/',
      fetchImpl,
    });
    expect(result.error).toContain('HTTP 404');
    expect(result.manifest.entries).toEqual([]);
  });

  it('degrades on invalid JSON', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('bad json');
      },
    })) as unknown as typeof fetch;
    const result = await loadCalendarData({
      baseUrl: 'https://example.test/photo-calendar/',
      fetchImpl,
    });
    expect(result.error).toContain('JSON');
    expect(result.manifest.entries).toEqual([]);
  });

  it('degrades on invalid or future schema', async () => {
    const fetchImpl = vi.fn(async () =>
      response({ version: 2, updatedAt: 'x', entries: [] }),
    ) as unknown as typeof fetch;
    const result = await loadCalendarData({
      baseUrl: 'https://example.test/photo-calendar/',
      fetchImpl,
    });
    expect(result.error).toContain('版本');
    expect(result.manifest.entries).toEqual([]);
  });

  it('keeps valid entries and reports warnings for duplicates', async () => {
    const duplicate = {
      ...manifest,
      entries: [
        {
          date: '2026-11-08',
          photo: 'data/photos/2026-11-08-a1b2c3d4.webp',
          thumbnail: 'data/photos/thumbs/2026-11-08-a1b2c3d4.webp',
          caption: '较早的一条。',
          createdAt: '2026-11-15T09:50:00Z',
          updatedAt: '2026-11-15T09:55:00Z',
        },
        {
          date: '2026-11-08',
          photo: 'data/photos/2026-11-08-e5f6a7b8.webp',
          thumbnail: 'data/photos/thumbs/2026-11-08-e5f6a7b8.webp',
          caption: '较晚的一条。',
          createdAt: '2026-11-15T09:50:00Z',
          updatedAt: '2026-11-15T09:55:00Z',
        },
      ],
    };
    const fetchImpl = vi.fn(async () => response(duplicate)) as unknown as typeof fetch;
    const result = await loadCalendarData({
      baseUrl: 'https://example.test/photo-calendar/',
      fetchImpl,
    });
    expect(result.manifest.entries).toHaveLength(1);
    expect(result.manifest.entries[0]?.caption).toBe('较晚的一条。');
    expect(result.warnings.join(' ')).toContain('重复');
  });
});
