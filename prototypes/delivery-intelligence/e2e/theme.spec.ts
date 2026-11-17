import { expect, test } from '@playwright/test';
import { expectClean, open, resetDemo, watch } from './helpers';

test('both themes render the portfolio screen and the choice survives a reload', async ({ page }) => {
  const w = watch(page);
  const html = page.locator('html');
  await open(page, '/');
  await expect(page.getByTestId('portfolio-screen')).toBeVisible();

  const canvas = (): Promise<string> => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  await page.getByTestId('theme-dark').click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByTestId('theme-dark')).toHaveAttribute('aria-checked', 'true');
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByTestId('portfolio-screen')).toBeVisible();
  const dark = await canvas();

  await page.getByTestId('theme-light').click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await expect(page.getByTestId('portfolio-screen')).toBeVisible();
  expect(await canvas()).not.toBe(dark);

  await resetDemo(page);
  expectClean(w);
});
