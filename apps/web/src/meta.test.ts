import { describe, expect, it } from 'vitest';
import { updatePageMeta } from './meta';

describe('updatePageMeta', () => {
  it('sets title, description and Open Graph data', () => {
    document.head.replaceChildren();
    updatePageMeta({
      title: '2026 年 11 月 8 日 · 照片日历',
      description: '风把下午吹得很慢。',
      image: 'https://example.test/photo.webp',
    });
    expect(document.title).toBe('2026 年 11 月 8 日 · 照片日历');
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      '风把下午吹得很慢。',
    );
    expect(document.head.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe(
      '2026 年 11 月 8 日 · 照片日历',
    );
    expect(document.head.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(
      'https://example.test/photo.webp',
    );
  });

  it('removes the image meta when there is no photo', () => {
    document.head.replaceChildren();
    updatePageMeta({ title: '无照片', description: '一句寄语。', image: 'old.webp' });
    updatePageMeta({ title: '无照片', description: '一句寄语。' });
    expect(document.head.querySelector('meta[property="og:image"]')).toBeNull();
  });
});
