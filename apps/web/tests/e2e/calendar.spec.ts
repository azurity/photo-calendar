import { test, expect, type Page } from '@playwright/test';

const PHOTO = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#8a9b8f"/><circle cx="720" cy="330" r="140" fill="#e8d9bf"/></svg>',
);

const now = new Date();
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
  now.getDate(),
).padStart(2, '0')}`;

const manifest = {
  version: 1,
  updatedAt: '2026-11-15T10:00:00Z',
  entries: [
    {
      date: '2026-11-08',
      photo: 'data/photos/2026-11-08-a1b2c3d4.webp',
      thumbnail: 'data/photos/thumbs/2026-11-08-a1b2c3d4.webp',
      caption: '风把下午吹得很慢，连影子都愿意多留一会儿。',
      createdAt: '2026-11-15T09:50:00Z',
      updatedAt: '2026-11-15T09:55:00Z',
    },
  ],
};

async function withManifest(page: Page, data = manifest): Promise<void> {
  await page.route('**/data/calendar.json*', (route) => route.fulfill({ json: data }));
  await page.route('**/data/photos/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/svg+xml', body: PHOTO }),
  );
}

test.describe('month view', () => {
  test('renders the requested month and links to a day', async ({ page }) => {
    await withManifest(page);
    await page.goto('index.html?month=2026-11');
    await expect(page.getByRole('heading', { name: '2026 年 11 月' })).toBeVisible();
    await expect(page.locator('a.day-cell')).toHaveCount(30);
    await expect(page.locator('.day-thumb')).toHaveCount(1);
    await expect(page.locator('a[href="./day.html?date=2026-11-08"] img')).toHaveAttribute(
      'alt',
      /2026 年 11 月 8 日/,
    );
    await page.locator('a[href="./day.html?date=2026-11-08"]').click();
    await expect(page).toHaveURL(/day\.html\?date=2026-11-08/);
  });

  test('navigates months and normalizes an invalid month', async ({ page }) => {
    await withManifest(page, { version: 1, updatedAt: '2026-11-15T10:00:00Z', entries: [] });
    await page.goto('index.html?month=2026-13');
    await expect(page.locator('.notice')).toContainText('无效');
    await expect(page).toHaveURL(/month=\d{4}-\d{2}/);
    const before = await page.locator('.month-heading').textContent();
    await page.getByRole('button', { name: '下一月' }).click();
    await expect(page.locator('.month-heading')).not.toHaveText(before ?? '');
    await expect(page).toHaveURL(/month=/);
  });

  test('restores the month on browser back and forward', async ({ page }) => {
    await withManifest(page, { version: 1, updatedAt: '2026-11-15T10:00:00Z', entries: [] });
    await page.goto('index.html?month=2026-11');
    await page.getByRole('button', { name: '下一月' }).click();
    await expect(page.locator('.month-heading')).toHaveText('2026 年 12 月');
    await page.goBack();
    await expect(page.locator('.month-heading')).toHaveText('2026 年 11 月');
    await page.goForward();
    await expect(page.locator('.month-heading')).toHaveText('2026 年 12 月');
  });

  test('fits a mobile viewport without horizontal scrolling', async ({ page }) => {
    await withManifest(page, { version: 1, updatedAt: '2026-11-15T10:00:00Z', entries: [] });
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('index.html?month=2026-11');
    await expect(page.locator('.month-grid')).toBeVisible();
    const widths = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      inner: window.innerWidth,
    }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.inner);
  });

  test('supports keyboard focus on date links', async ({ page }) => {
    await withManifest(page);
    await page.goto('index.html?month=2026-11');
    await page.locator('a.day-cell').first().focus();
    await expect(page.locator('a.day-cell').first()).toBeFocused();
  });

  test('shows fallback data notice when the manifest is unavailable', async ({ page }) => {
    await page.route('**/data/calendar.json*', (route) =>
      route.fulfill({ status: 404, body: 'nope' }),
    );
    await page.goto('index.html?month=2026-11');
    await expect(page.locator('.notice')).toContainText('HTTP 404');
    await expect(page.locator('a.day-cell')).toHaveCount(30);
  });
});

test.describe('day view', () => {
  test('renders a photo day with caption and navigation inside the paper note', async ({
    page,
  }) => {
    await withManifest(page);
    await page.goto('day.html?date=2026-11-08');
    const paper = page.locator('figure.photo-paper');
    const note = paper.locator('figcaption.photo-paper-note');
    await expect(page.locator('.day-photo')).toBeVisible();
    await expect(note).toContainText('2026 年 11 月 8 日');
    await expect(note).toContainText('星期日');
    await expect(note.locator('.day-caption')).toContainText('风把下午吹得很慢');
    await expect(page.locator('.day-copy')).toHaveCount(0);
    await expect(page.locator('.photo-paper-mark')).toHaveCount(0);
    await expect(page.locator('a[rel="prev"]')).toHaveAttribute('href', /2026-11-07/);
    await expect(page.locator('a[rel="next"]')).toHaveAttribute('href', /2026-11-09/);
  });

  test('grows the paper bottom margin around the date and caption', async ({ page }) => {
    await withManifest(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('day.html?date=2026-11-08');
    await expect(page.locator('.photo-paper-note')).toBeVisible();
    const boxes = await page.evaluate(() => {
      const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
      return {
        paper: rect('figure.photo-paper'),
        image: rect('img.day-photo'),
        note: rect('.photo-paper-note'),
        caption: rect('.day-caption'),
        stage: rect('.day-photo-stage'),
      };
    });
    expect(boxes.note.top).toBeGreaterThanOrEqual(boxes.image.bottom - 4);
    expect(boxes.paper.height - boxes.image.height).toBeGreaterThan(40);
    expect(boxes.caption.bottom).toBeLessThanOrEqual(boxes.paper.bottom + 1);
    expect(boxes.paper.top).toBeGreaterThanOrEqual(boxes.stage.top - 4);
    expect(boxes.paper.bottom).toBeLessThanOrEqual(boxes.stage.bottom + 4);
  });

  test('loads the handwriting font stylesheet only on the day page', async ({ page }) => {
    await page.route('https://cdn.jsdelivr.net/**', (route) => route.abort());
    await withManifest(page, { version: 1, updatedAt: '2026-11-15T10:00:00Z', entries: [] });
    await page.goto('index.html?month=2026-11');
    await expect(page.locator('link[href*="hongleixingshu"]')).toHaveCount(0);
    await page.goto('day.html?date=2026-11-09');
    await expect(page.locator('link[href*="hongleixingshu"]')).toHaveCount(1);
    const fallbackFamily = await page
      .locator('.fallback-copy')
      .evaluate((element) => getComputedStyle(element).fontFamily);
    expect(fallbackFamily).not.toContain('LXGW WenKai');
  });

  test('renders a deterministic fallback for a day without a photo', async ({ page }) => {
    await withManifest(page, { version: 1, updatedAt: '2026-11-15T10:00:00Z', entries: [] });
    await page.goto('day.html?date=2026-11-09');
    const phrase = await page.locator('.fallback-phrase').textContent();
    expect(phrase?.length).toBeGreaterThan(8);
    await page.reload();
    await expect(page.locator('.fallback-phrase')).toHaveText(phrase ?? '');
  });

  test('falls back when the photo is missing', async ({ page }) => {
    await page.route('**/data/calendar.json*', (route) => route.fulfill({ json: manifest }));
    await page.route('**/data/photos/**', (route) => route.fulfill({ status: 404, body: 'gone' }));
    await page.goto('day.html?date=2026-11-08');
    await expect(page.locator('.fallback-view')).toBeVisible();
    await expect(page.locator('img.day-photo')).toHaveCount(0);
  });

  test('falls back to today for an invalid date and shows a notice', async ({ page }) => {
    await withManifest(page, { version: 1, updatedAt: '2026-11-15T10:00:00Z', entries: [] });
    await page.goto('day.html?date=2026-02-30');
    await expect(page.locator('.notice')).toContainText('日期参数无效');
    await expect(page).toHaveURL(new RegExp(`date=${today}`));
  });

  test('keeps the fallback readable when the doodle CDN is blocked', async ({ page }) => {
    await page.route('https://unpkg.com/**', (route) => route.abort());
    await withManifest(page, { version: 1, updatedAt: '2026-11-15T10:00:00Z', entries: [] });
    await page.goto('day.html?date=2026-11-09');
    await expect(page.locator('.fallback-view')).toHaveClass(/pattern-fallback/);
    await expect(page.locator('.fallback-phrase')).toBeVisible();
  });

  test('keeps the handwritten caption readable when the font CDN is blocked', async ({ page }) => {
    await page.route('https://cdn.jsdelivr.net/**', (route) => route.abort());
    await withManifest(page);
    await page.goto('day.html?date=2026-11-08');
    await expect(page.locator('.day-caption')).toBeVisible();
    await expect(page.locator('.day-caption')).toContainText('风把下午吹得很慢');
    await expect(page.locator('.photo-paper-note')).not.toHaveClass(/handwriting-ready/);
    const handwritingFaces = await page.evaluate(() =>
      Array.from(document.fonts).filter((face) => face.family.includes('hongleixingshu')),
    );
    expect(handwritingFaces).toHaveLength(0);
  });

  test('wraps a 120 character caption without clipping at desktop and mobile widths', async ({
    page,
  }) => {
    const longCaption =
      '沿着河岸慢慢走，把风、光和水声都记下来；今天的路不必赶，抬头看见云，就当作世界递来的一封信。'
        .repeat(3)
        .slice(0, 120);
    const data = {
      ...manifest,
      entries: [{ ...manifest.entries[0], caption: longCaption }],
    };
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 375, height: 667 },
      { width: 320, height: 667 },
    ]) {
      await page.setViewportSize(viewport);
      await withManifest(page, data);
      await page.goto('day.html?date=2026-11-08');
      await expect(page.locator('.day-caption')).toHaveText(longCaption);
      const layout = await page.evaluate(() => {
        const rect = (selector: string) =>
          document.querySelector(selector)!.getBoundingClientRect();
        const caption = document.querySelector('.day-caption')!;
        return {
          captionChars: Array.from(caption.textContent ?? '').length,
          paper: rect('figure.photo-paper'),
          image: rect('img.day-photo'),
          caption: rect('.day-caption'),
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        };
      });
      expect(layout.captionChars).toBe(120);
      expect(layout.caption.width).toBeLessThanOrEqual(layout.paper.width);
      expect(layout.caption.bottom).toBeLessThanOrEqual(layout.paper.bottom + 1);
      expect(layout.image.bottom).toBeLessThanOrEqual(layout.paper.bottom);
      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.innerWidth);
      await expect(page.locator('.day-photo')).toBeVisible();
    }
  });

  test('fits a mobile day view and honors reduced motion', async ({ page }) => {
    await withManifest(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('day.html?date=2026-11-08');
    const widths = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      inner: window.innerWidth,
    }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.inner);
    await expect(page.locator('.photo-paper-note .day-caption')).toBeVisible();
  });
});
