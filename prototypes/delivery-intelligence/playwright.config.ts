import { defineConfig, devices } from '@playwright/test';

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
