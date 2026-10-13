/**
 * @file Vitest for the Board: the wording tests run in Node; the browser flows are Playwright's.
 * Owner context: Board (adapter).
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['test/**/*.test.ts'], exclude: ['test/e2e/**'] },
});
