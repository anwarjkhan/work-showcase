import { expect, type Page } from '@playwright/test';

/** Ids of the two story deliverables (lib/config/story.ts) and one other. */
export const HERO = 'td-1001';
export const FLOW = 'td-2001';
export const OTHER = 'td-1006';

export interface Watch {
  errors: string[];
  failed: string[];
  external: string[];
}

/**
 * Collects console errors, page errors, failed requests (HTTP 400 and above, or
 * network failures other than the browser cancelling a prefetch) and any request
 * that leaves the machine.
 */
export function watch(page: Page): Watch {
  const w: Watch = { errors: [], failed: [], external: [] };
  page.on('console', (msg) => {
    if (msg.type() === 'error') w.errors.push(msg.text());
  });
  page.on('pageerror', (err) => w.errors.push(`pageerror: ${err.message}`));
  page.on('response', (res) => {
    if (res.status() >= 400) w.failed.push(`${res.status()} ${res.url()}`);
  });
  page.on('requestfailed', (req) => {
    const text = req.failure()?.errorText ?? '';
    if (!text.includes('ERR_ABORTED')) w.failed.push(`${text} ${req.url()}`);
  });
  page.on('request', (req) => {
    const url = req.url();
    if (url.startsWith('data:') || url.startsWith('blob:')) return;
    const host = new URL(url).hostname;
    if (host !== '127.0.0.1' && host !== 'localhost') w.external.push(url);
  });
  return w;
}

export function expectClean(w: Watch): void {
  expect(w.errors, 'console and page errors').toEqual([]);
  expect(w.failed, 'failed requests').toEqual([]);
  expect(w.external, 'requests leaving the machine').toEqual([]);
}

/** Opens a route and waits until the shell and the page title are there. */
export async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.getByTestId('page-title')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
}

export async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

export async function resetDemo(page: Page): Promise<void> {
  await page.getByTestId('reset-demo').click();
  await expect(page.getByTestId('reset-demo')).toContainText('Demo reset');
}

export async function number(page: Page, testId: string): Promise<number> {
  const text = await page.getByTestId(testId).first().innerText();
  return Number(text.replace(/[^0-9]/g, ''));
}

/** localStorage key and the Playwright storage state that starts every page with labels off. */
export const LABELS_KEY = 'di-labels';
export const LABELS_OFF_STATE = {
  cookies: [],
  origins: [{ origin: 'http://127.0.0.1:4173', localStorage: [{ name: LABELS_KEY, value: 'off' }] }],
};
