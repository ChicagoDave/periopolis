/**
 * @file Playwright for the Board's browser smoke test: the built page, opened from disk, in Chromium. The IRL view
 * needs WebGL, so Chromium is allowed its software fallback (SwiftShader), which a runner with no GPU, the publish
 * workflow's, would otherwise refuse (ADR-0011 Decision 3, ADR-0023 Decision 7). Forcing ANGLE on SwiftShader for
 * everything was tried and slowed the whole page enough to time a flow out, so only the fallback is allowed. The
 * built page is served by `vite preview` rather than opened from disk, because the IRL view fetches its kit models
 * from the assets folder beside the page (ADR-0024 Decision 4) and a page opened from disk may not fetch.
 * Owner context: Board (adapter).
 */
import { defineConfig } from '@playwright/test';

/** The preview server that serves the build, unless BOARD_URL points the flows at a published page. */
const webServer = process.env.BOARD_URL
  ? {}
  : { webServer: { command: 'npx vite preview --port 4173 --strictPort', url: 'http://localhost:4173/', reuseExistingServer: true, timeout: 60000 } };

export default defineConfig({
  testDir: 'test/e2e',
  timeout: 60000,
  use: {
    browserName: 'chromium',
    launchOptions: { args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  reporter: 'list',
  ...webServer,
});
