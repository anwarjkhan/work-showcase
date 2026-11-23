import { defineConfig, devices } from '@playwright/test';
import { LABELS_OFF_STATE } from './e2e/helpers';

// Browser tests run against the static export (the artefact we ship), served
// on loopback by scripts/serve-static.mjs. `npm run e2e` builds first.
const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// Playwright uses its own pre-installed browser (PLAYWRIGHT_BROWSERS_PATH). If a
// machine has a browser elsewhere, point PW_CHROMIUM_PATH at it (for example
// /opt/pw-browsers/chromium). Never run `playwright install` for this project.
const launchOptions = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  timeout: 30_000,
  use: {
    baseURL: BASE_URL,
    trace: 'off',
    viewport: { width: 1920, height: 1080 },
  },
  projects: [
    { name: 'chromium-1920', use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 }, launchOptions } },
    // The same suite again with the labels toggle off (localStorage seeded before first paint).
    // labels.spec.ts drives the toggle itself, so it runs only in the project above.
    {
      name: 'chromium-1920-labels-off',
      testIgnore: /labels\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 }, launchOptions, storageState: LABELS_OFF_STATE },
    },
  ],
  webServer: {
    command: `npm run build && node scripts/serve-static.mjs ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
