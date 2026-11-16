import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

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

async function routeData(page: import('@playwright/test').Page, data = manifest): Promise<void> {
  await page.route('**/data/calendar.json*', (route) => route.fulfill({ json: data }));
  await page.route('**/data/photos/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
        'base64',
      ),
    }),
  );
}

async function expectNoSeriousViolations(page: import('@playwright/test').Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
  expect(serious).toEqual([]);
}

test('month page has no serious accessibility violations', async ({ page }) => {
  await routeData(page);
  await page.goto('index.html?month=2026-11');
  await expectNoSeriousViolations(page);
});

test('photo day page has no serious accessibility violations', async ({ page }) => {
  await routeData(page);
  await page.goto('day.html?date=2026-11-08');
  await expectNoSeriousViolations(page);
});

test('fallback day page has no serious accessibility violations', async ({ page }) => {
  await routeData(page, { version: 1, updatedAt: '2026-11-15T10:00:00Z', entries: [] });
  await page.goto('day.html?date=2026-11-09');
  await expectNoSeriousViolations(page);
});

test('dark month page has no serious accessibility violations', async ({ page }) => {
  await routeData(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('index.html?month=2026-11');
  await expectNoSeriousViolations(page);
});

test('dark photo day page has no serious accessibility violations', async ({ page }) => {
  await routeData(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('day.html?date=2026-11-08');
  await expectNoSeriousViolations(page);
});

test('dark fallback day page has no serious accessibility violations', async ({ page }) => {
  await routeData(page, { version: 1, updatedAt: '2026-11-15T10:00:00Z', entries: [] });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('day.html?date=2026-11-09');
  await expectNoSeriousViolations(page);
});
