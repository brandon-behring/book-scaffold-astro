import { defineConfig } from '@playwright/test';

// Visual-regression for the component gallery. Uses the SYSTEM Chrome
// (`channel: 'chrome'`) — this is what dissolves the original
// "chromium-headless-shell doesn't build on every distro" objection that
// drove the old raw-chrome run.sh. Full-page screenshots + pixelmatch
// (`maxDiffPixels`) replace the viewport-capped, byte-AE run.sh.
//
// Baselines are committed per-platform (filenames carry the OS, e.g. `-linux`)
// and MUST be generated in CI (ubuntu-latest), as today — local font rendering
// diverges. Regenerate via the `visual-pw` workflow's `update` dispatch.
export default defineConfig({
  testDir: './tests',
  // The fixture-route suite has its own config (playwright.fixtures.config.ts)
  // with the 6-fixture webServer array; exclude it here so the component suite
  // doesn't try to run those specs against the gallery's own server.
  testIgnore: ['**/fixtures/**'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    // Dedicated port (NOT 4321) — the portfolio/other Astro apps default to
    // 4321 on the dev box; `reuseExistingServer` would otherwise silently adopt
    // that listener and serve a 404 for /provenance/. A unique port isolates us.
    baseURL: 'http://127.0.0.1:4331',
    channel: 'chrome',
    viewport: { width: 1280, height: 900 },
  },
  expect: {
    // Tune from the first CI run's diff; small tolerance for AA noise.
    toHaveScreenshot: { maxDiffPixels: 250 },
  },
  webServer: {
    command: 'npm run build && npm run preview',
    // Poll the actual gallery page (not `/`) so we only proceed once the built
    // gallery is truly serving — never a foreign listener.
    url: 'http://127.0.0.1:4331/provenance/',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
