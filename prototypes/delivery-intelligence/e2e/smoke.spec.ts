import { expect, test } from '@playwright/test';

// Smoke test for the shell (D1). D14 extends e2e/ with the full journeys.

const ROUTE_TITLES: Array<[string, string]> = [
  ['portfolio', 'Portfolio'],
  ['hierarchy', 'Hierarchy explorer'],
  ['deliverable', 'Deliverable detail'],
  ['plan', 'Plan'],
  ['global', 'Global delivery'],
  ['lifecycle', 'Lifecycle'],
  ['workflow', 'PDLC workflow'],
  ['agents', 'Agent centre'],
  ['blueprint', 'Template blueprint'],
  ['evidence', 'Pilot evidence'],
  ['about', 'About this build'],
];

test('loads the portfolio inside the shell, navigates every route and switches theme', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
  page.on('pageerror', (err) => errors.push(err.message));
  // Nothing may leave the machine.
  const external: string[] = [];
  page.on('request', (req) => {
    const host = new URL(req.url()).hostname;
    if (!['127.0.0.1', 'localhost'].includes(host) && !req.url().startsWith('data:')) external.push(req.url());
  });

  await page.goto('/');
  await expect(page.getByTestId('page-title')).toHaveText('Portfolio');
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();

  for (const [id, title] of ROUTE_TITLES) {
    await page.getByTestId(`nav-${id}`).click();
    await expect(page.getByTestId('page-title')).toHaveText(title);
    await expect(page.getByTestId(`nav-${id}`)).toHaveAttribute('aria-current', 'page');
  }

  const html = page.locator('html');
  await page.getByTestId('theme-dark').click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await page.getByTestId('theme-light').click();
  await expect(html).toHaveAttribute('data-theme', 'light');

  await page.getByTestId('reset-demo').click();
  await expect(page.getByTestId('reset-demo')).toContainText('Demo reset');

  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
