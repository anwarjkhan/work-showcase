import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Browser tests run against the static export (the artefact we ship), served
// on loopback by scripts/serve-static.mjs. `npm run e2e` builds first.
const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// The browser is pre-installed on this machine; fall back to the known path if
// Playwright cannot find its own copy. Never run `playwright install` here.
const PREINSTALLED_CHROMIUM = '/opt/pw-browsers/chromium';
const launchOptions =
  process.env.PW_CHROMIUM_PATH || existsSync(PREINSTALLED_CHROMIUM)
    ? { executablePath: process.env.PW_CHROMIUM_PATH ?? PREINSTALLED_CHROMIUM }
    : {};

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
