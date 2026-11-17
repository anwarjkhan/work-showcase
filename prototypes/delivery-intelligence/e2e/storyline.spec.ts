import { expect, test } from '@playwright/test';
import { expectClean, HERO, open, watch } from './helpers';

test('main storyline: reported Green, evidence Red, 82%, 1 of 4, Not ready; the drafted status is fully cited', async ({ page }) => {
  const w = watch(page);
  await open(page, `/deliverables/${HERO}/#status`);

  const rag = page.getByTestId('rag-pair');
  await expect(rag).toContainText('Green');
  await expect(rag).toContainText('Red');
  const verdict = page.getByTestId('verdict');
  await expect(verdict).toContainText(/82\s*%/);
  await expect(verdict).toContainText(/1\s*of\s*4/);
  await expect(verdict).toContainText('Not ready');

  await page.getByTestId('draft-status').click();
  const draft = page.getByTestId('status-draft');
  await expect(draft).toBeVisible();
  const sentences = page.locator('[data-sentence]');
  const total = await sentences.count();
  expect(total).toBeGreaterThan(5);
  // Every sentence has at least one citation marker.
  await expect(page.locator('[data-sentence]:has([data-citation])')).toHaveCount(total);

  // Activating a citation opens the cited record.
  const marker = page.locator('[data-citation^="evidence:"]').first();
  await marker.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(/Evidence record/i);
  await expect(dialog).toContainText('Fail');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expectClean(w);
});
