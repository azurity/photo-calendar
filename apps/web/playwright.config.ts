import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    channel: 'chrome',
    baseURL: 'http://127.0.0.1:4173/photo-calendar/',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node tests/support/serve.mjs',
    url: 'http://127.0.0.1:4173/photo-calendar/index.html',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
