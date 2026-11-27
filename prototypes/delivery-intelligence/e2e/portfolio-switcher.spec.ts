import { expect, test, type Page } from '@playwright/test';
import { expectClean, horizontalOverflow, open, watch } from './helpers';

const switcher = (page: Page) => page.getByTestId('portfolio-switcher');
const menu = (page: Page) => page.getByTestId('portfolio-menu');
const preview = (page: Page) => page.getByTestId('portfolio-preview');

test('the switcher shows the loaded portfolio and the top bar names it', async ({ page }) => {
  const w = watch(page);
  await open(page, '/');
  await expect(page.getByTestId('portfolio-switcher-name')).toHaveText('Risk & Finance Technology');
  await expect(page.getByTestId('topbar-eyebrow')).toContainText('Risk & Finance Technology');
  await expect(menu(page)).toHaveCount(0);
  expectClean(w);
});

test('the menu opens by click and by keyboard, moves with arrows and closes with Escape returning focus', async ({ page }) => {
  await open(page, '/');
  await switcher(page).click();
  await expect(menu(page)).toBeVisible();
  const options = page.getByRole('menuitemradio');
  await expect(options).toHaveCount(5);
  await expect(page.getByTestId('portfolio-option-risk-finance')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('portfolio-option-markets')).toHaveAttribute('aria-checked', 'false');
  await page.keyboard.press('Escape');
  await expect(menu(page)).toHaveCount(0);
  await expect(switcher(page)).toBeFocused();

  await page.keyboard.press('ArrowDown');
  await expect(menu(page)).toBeVisible();
  await expect(page.getByTestId('portfolio-option-risk-finance')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('portfolio-option-markets')).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.getByTestId('portfolio-option-all')).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(page.getByTestId('portfolio-option-treasury')).toBeFocused();
  await page.keyboard.press('Home');
  await expect(page.getByTestId('portfolio-option-risk-finance')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(switcher(page)).toBeFocused();

  // Enter opens too (native button), and choosing the current portfolio only closes the menu.
  await page.keyboard.press('Enter');
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(menu(page)).toHaveCount(0);
  await expect(preview(page)).toHaveCount(0);
});

test('choosing a not-loaded portfolio opens a preview, leaves the Portfolio figures alone and Return closes it', async ({ page }) => {
  const w = watch(page);
  await open(page, '/');
  await expect(page.getByTestId('headline-sentence')).toBeVisible();
  const before = await page.getByTestId('headline-sentence').innerText();
  expect(before).toContain('6 of 26');

  await switcher(page).click();
  await page.getByTestId('portfolio-option-markets').click();
  const dialog = page.getByRole('dialog', { name: 'Markets Technology' });
  await expect(dialog).toBeVisible();
  // Plain in both label modes: the portfolio is not loaded, and the figures are placeholders.
  await expect(page.getByTestId('portfolio-preview-status')).toHaveText('Not loaded in this prototype');
  await expect(dialog.getByText('Expected estate (round placeholder figures)')).toBeVisible();
  await expect(dialog.getByText('Projects on the standard templates')).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'View the connection plan' })).toHaveAttribute('href', '/about/#plugging-in');
  await expect(dialog.getByRole('button', { name: 'Return to Risk & Finance Technology' })).toBeFocused();

  // Demo labelling follows the toggle.
  const labelsOn = (await page.locator('html').getAttribute('data-labels')) === 'on';
  const note = page.getByTestId('portfolio-preview-note');
  if (labelsOn) {
    await expect(note).toHaveText('This prototype holds one portfolio. Switching loads another portfolio’s records through the same screens.');
    await expect(dialog.locator('[data-provenance="planned"]')).toHaveText('Placeholder');
  } else {
    await expect(note).toBeHidden();
    await expect(dialog.locator('[data-provenance="planned"]')).toBeHidden();
  }

  await dialog.getByRole('button', { name: 'Return to Risk & Finance Technology' }).click();
  await expect(preview(page)).toHaveCount(0);
  await expect(switcher(page)).toBeFocused();
  await expect(page.getByTestId('portfolio-switcher-name')).toHaveText('Risk & Finance Technology');
  await expect(page.getByTestId('headline-sentence')).toHaveText(before);
  await expect(page).toHaveURL(/\/$/);
  expectClean(w);
});

test('All portfolios explains the roll-up, Escape closes, and the menu still marks the loaded one current', async ({ page }) => {
  await open(page, '/');
  await switcher(page).click();
  await page.getByTestId('portfolio-option-all').click();
  const dialog = page.getByRole('dialog', { name: 'All portfolios' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('How the roll-up works')).toBeVisible();
  await expect(dialog.getByText('Each programme carries its portfolio tag')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(preview(page)).toHaveCount(0);
  await switcher(page).click();
  await expect(page.getByTestId('portfolio-option-risk-finance')).toHaveAttribute('aria-checked', 'true');
});

test('the connection plan link lands on the plugging-in section of About', async ({ page }) => {
  await open(page, '/');
  await switcher(page).click();
  await page.getByTestId('portfolio-option-treasury').click();
  await page.getByTestId('portfolio-preview-plan').click();
  await expect(page).toHaveURL(/\/about\/#plugging-in$/);
  await expect(preview(page)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Plugging in' })).toBeVisible();
});

test('no horizontal overflow at 1366 with the menu or the preview open', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const w = watch(page);
  await open(page, '/');
  await switcher(page).click();
  await expect(menu(page)).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  await page.getByTestId('portfolio-option-shared-data').click();
  await expect(preview(page)).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expectClean(w);
});
