/**
 * @file Playwright for the Board's browser smoke test: the built page, opened from disk, in Chromium. The IRL view
 * needs WebGL, so Chromium is allowed its software fallback (SwiftShader), which a runner with no GPU, the publish
 * workflow's, would otherwise refuse (ADR-0011 Decision 3, ADR-0023 Decision 7). Forcing ANGLE on SwiftShader for
 * everything was tried and slowed the whole page enough to time a flow out, so only the fallback is allowed.
 * Owner context: Board (adapter).
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'test/e2e',
  timeout: 60000,
  use: {
    browserName: 'chromium',
    launchOptions: { args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  reporter: 'list',
});
