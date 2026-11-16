import { expect, test, type Page } from '@playwright/test';

const emptyManifest = { version: 1, updatedAt: '2026-11-15T10:00:00Z', entries: [] };

async function withData(page: Page): Promise<void> {
  await page.route('**/data/calendar.json*', (route) => route.fulfill({ json: emptyManifest }));
}

async function themeState(page: Page) {
  return page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    return {
      paper: root.getPropertyValue('--paper').trim(),
      colorScheme: root.colorScheme,
      metas: Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')).map(
        (meta) => ({ content: meta.content, media: meta.media }),
      ),
    };
  });
}

test('month and day share light theme tokens and metadata', async ({ page }) => {
  await withData(page);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('index.html?month=2026-11');
  const month = await themeState(page);

  await page.goto('day.html?date=2026-11-09');
  const day = await themeState(page);

  expect(month.paper).toBe('#f4eee3');
  expect(day.paper).toBe(month.paper);
  expect(month.colorScheme).toBe('light dark');
  expect(day.colorScheme).toBe('light dark');
  expect(month.metas).toEqual([
    { content: '#f4eee3', media: '(prefers-color-scheme: light)' },
    { content: '#171310', media: '(prefers-color-scheme: dark)' },
  ]);
  expect(day.metas).toEqual(month.metas);
});

test('month and day share dark theme tokens', async ({ page }) => {
  await withData(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('index.html?month=2026-11');
  const month = await themeState(page);

  await page.goto('day.html?date=2026-11-09');
  const day = await themeState(page);

  expect(month.paper).toBe('#171310');
  expect(day.paper).toBe('#171310');
  expect(month.colorScheme).toBe('light dark');
  expect(day.colorScheme).toBe('light dark');
});

test('theme switches without a reload', async ({ page }) => {
  await withData(page);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('index.html?month=2026-11');
  expect((await themeState(page)).paper).toBe('#f4eee3');

  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(async () => (await themeState(page)).paper).toBe('#171310');

  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(async () => (await themeState(page)).paper).toBe('#f4eee3');
});

test('polaroid cards remain reachable and fit a 320px viewport', async ({ page }) => {
  await withData(page);
  await page.setViewportSize({ width: 320, height: 667 });
  await page.goto('index.html?month=2026-11');

  const cell = page.locator('a.day-cell').first();
  await expect(cell.locator('.day-stamp')).toBeVisible();
  await expect(cell.locator('.day-print')).toHaveCount(0);
  const box = await cell.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    inner: window.innerWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.inner);

  await cell.click();
  await expect(page).toHaveURL(/day\.html\?date=/);
});

test('polaroid pages fit a 1440px desktop viewport', async ({ page }) => {
  await withData(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const url of ['index.html?month=2026-11', 'day.html?date=2026-11-09']) {
    await page.goto(url);
    const widths = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      inner: window.innerWidth,
    }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.inner);
  }
  await expect(page.locator('.postcard-paper')).toBeVisible();
});

test('all month rows are equal height on desktop and mobile', async ({ page }) => {
  await withData(page);
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 375, height: 667 },
    { width: 320, height: 667 },
  ]) {
    await page.setViewportSize(viewport);
    for (const month of ['2026-11', '2024-02']) {
      await page.goto(`index.html?month=${month}`);
      const heights = await page
        .locator('a.day-cell')
        .evaluateAll((cells) =>
          cells.map((cell) => Math.round(cell.getBoundingClientRect().height)),
        );
      expect(new Set(heights).size).toBe(1);
      expect(heights[0]).toBeGreaterThanOrEqual(44);
    }
  }
});

test('polaroid transitions are removed with reduced motion', async ({ page }) => {
  await withData(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('index.html?month=2026-11');
  const durations = await page.evaluate(() => {
    const button = document.querySelector<HTMLElement>('.pill-button');
    const cell = document.querySelector<HTMLElement>('.day-cell');
    return [button, cell].map((element) =>
      element ? getComputedStyle(element).transitionDuration : null,
    );
  });
  for (const duration of durations) {
    expect(duration).not.toBeNull();
    const seconds = duration?.endsWith('ms')
      ? Number.parseFloat(duration) / 1000
      : Number.parseFloat(duration ?? '999');
    expect(seconds).toBeLessThanOrEqual(0.001);
  }
});
