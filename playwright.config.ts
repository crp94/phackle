// T23 — Playwright E2E (master spec §8.5).
//
// AGAINST THE PRODUCTION BUILD, NEVER THE DEV SERVER. `webServer` below runs
// `vite build` and then `vite preview`, every time, because the defect class
// this suite exists to catch is precisely the class that only exists after
// bundling: T29's non-analyzable dynamic import resolved fine under `vite dev`
// and 404'd in `dist/`, leaving the Published screen's "Face the truth"
// overlay EMPTY in the shipped artifact. A dev-server run would have been
// green for that bug. See e2e/harness.ts for the other two.
import { defineConfig, devices } from '@playwright/test';

const PORT = 4317;
const HOST = '127.0.0.1';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,

  // NO RETRIES, anywhere, on purpose. A retry converts "this suite is flaky"
  // into "this suite is green", and a standing guard that hides its own
  // instability is not a guard. Every wait in here is on an event or a
  // locator state, never on a clock, so a failure means something moved.
  retries: 0,

  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],

  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: `http://${HOST}:${PORT}`,

    // The fixed clock in e2e/harness.ts pins an INSTANT; this pins the zone
    // it is read in. `daily.localIsoDate()` reads local calendar components,
    // so without this the puzzle date would depend on the machine running the
    // suite — the one thing a determinism suite may not tolerate.
    timezoneId: 'UTC',
    locale: 'en-GB',

    // The app ships a precaching service worker (vite-plugin-pwa,
    // registerType: 'autoUpdate'). Left enabled it would serve a PREVIOUS
    // build's content-hashed assets into a later test — the exact trap the
    // T29/T31 CDP harnesses hit and had to work around with
    // Storage.clearDataForOrigin. Blocking it makes every test read the build
    // that is actually on disk. The service worker itself is T21's subject,
    // not this suite's.
    serviceWorkers: 'block',

    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],

  webServer: {
    command: `npm run build && npm run preview -- --host ${HOST} --port ${PORT} --strictPort`,
    url: `http://${HOST}:${PORT}/`,
    // Never reuse: a stale `dist/` is indistinguishable from a passing suite,
    // and this suite's whole claim is about what `dist/` contains.
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
