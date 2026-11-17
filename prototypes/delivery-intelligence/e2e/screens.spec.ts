import { expect, test } from '@playwright/test';
import { expectClean, HERO, open, watch } from './helpers';

test('plan: the four zooms switch and a deliverable opens in the side panel', async ({ page }) => {
  const w = watch(page);
  await open(page, '/plan/');
  const title = page.getByTestId('plan-window-title');
  const seen = new Set<string>();
  for (const zoom of ['Year', 'Quarter', 'Month', 'Sprint']) {
    const tab = page.getByRole('tab', { name: zoom });
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    await expect(title).toBeVisible();
    seen.add((await title.innerText()).trim());
  }
  expect(seen.size, 'each zoom shows a different window title').toBe(4);

  await page.getByRole('tab', { name: 'Quarter' }).click();
  await page.locator(`[data-plan-bar="${HERO}"]`).first().click();
  const panel = page.getByRole('dialog');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Counterparty exposure');
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  expectClean(w);
});

test('global: the focused dependency view shows the nine-day callout, and the list view renders', async ({ page }) => {
  const w = watch(page);
  await open(page, '/global/#hero');
  const callout = page.getByTestId('hero-callout');
  await expect(callout).toBeVisible();
  await expect(callout).toContainText(/9\s*days late/);
  await expect(callout).toContainText('TD-1001');

  await page.getByRole('tab', { name: 'List' }).click();
  await expect(page.getByTestId('global-list')).toBeVisible();
  await expect(page.getByTestId('global-map')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Map' }).click();
  await expect(page.getByTestId('global-map')).toBeVisible();
  expectClean(w);
});

test('hierarchy: expanding the main storyline deliverable shows its three Epics', async ({ page }) => {
  const w = watch(page);
  await open(page, '/hierarchy/');
  const tree = page.getByRole('tree').first();
  const row = tree.getByRole('treeitem', { name: /Counterparty exposure — stress scenario reconciliation/ }).first();
  await row.scrollIntoViewIfNeeded();
  await expect(row).toHaveAttribute('aria-expanded', 'false');
  await row.focus();
  await page.keyboard.press('Enter');
  await expect(row).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('boundary-band').first()).toBeVisible();
  for (const epic of ['CCR-100', 'CCR-200', 'CCR-300']) {
    await expect(tree.getByRole('treeitem', { name: new RegExp(epic) })).toBeVisible();
  }
  await expect(tree.locator('[role=treeitem][aria-level="4"]').filter({ hasText: /Epic/ })).toHaveCount(3);
  expectClean(w);
});
