import { test, expect, type Page } from '@playwright/test';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
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
    route.fulfill({ status: 200, contentType: 'image/png', body: PNG }),
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
  test('renders a photo day with caption and navigation', async ({ page }) => {
    await withManifest(page);
    await page.goto('day.html?date=2026-11-08');
    await expect(page.locator('.day-photo')).toBeVisible();
    await expect(page.locator('.day-caption')).toContainText('风把下午吹得很慢');
    await expect(page.locator('a[rel="prev"]')).toHaveAttribute('href', /2026-11-07/);
    await expect(page.locator('a[rel="next"]')).toHaveAttribute('href', /2026-11-09/);
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
    await expect(page.locator('.day-caption')).toBeVisible();
  });
});
