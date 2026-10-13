/**
 * @file Playwright for the Board's browser smoke test: the built page, opened from disk, in Chromium.
 * Owner context: Board (adapter).
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'test/e2e',
  timeout: 60000,
  use: { browserName: 'chromium' },
  reporter: 'list',
});
