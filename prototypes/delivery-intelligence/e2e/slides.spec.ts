import { readFileSync, statSync } from 'node:fs';
import { expect, test, type Download, type Page } from '@playwright/test';
import JSZip from 'jszip';
import { expectClean, HERO, open, resetDemo, watch } from './helpers';

/** Reads a downloaded .pptx: every slide's text runs, in slide order. */
async function readDeck(download: Download): Promise<{ name: string; size: number; slides: string[][] }> {
  const file = await download.path();
  const size = statSync(file).size;
  const zip = await JSZip.loadAsync(readFileSync(file));
  const parts = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(/(\d+)\.xml$/.exec(a)![1]) - Number(/(\d+)\.xml$/.exec(b)![1]));
  const decode = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const slides: string[][] = [];
  for (const part of parts) {
    const xml = await zip.file(part)!.async('string');
    slides.push([...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => decode(m[1]!)));
  }
  return { name: download.suggestedFilename(), size, slides };
}

async function exportAndRead(page: Page, click: () => Promise<void>): Promise<Awaited<ReturnType<typeof readDeck>>> {
  const [download] = await Promise.all([page.waitForEvent('download'), click()]);
  return readDeck(download);
}

test('deliverable pack: exported from the TD-1001 page, 18 or more slides, first slide names TD-1001', async ({ page }) => {
  const w = watch(page);
  await open(page, `/deliverables/${HERO}/`);
  await page.getByTestId('verdict').getByTestId('export-pack').click();
  const dialog = page.getByRole('dialog', { name: 'Technology Deliverable pack' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId('opt-narrative')).toBeChecked();

  const deck = await exportAndRead(page, () => dialog.getByTestId('export-pack-go').click());
  expect(deck.name).toBe('TD-1001-deliverable-pack-2027-03-08.pptx');
  expect(deck.size).toBeGreaterThan(0);
  expect(deck.slides.length).toBeGreaterThanOrEqual(18);
  expect(deck.slides[0]!.join(' ')).toContain('TD-1001');
  await expect(dialog.getByTestId('export-done')).toHaveText(`Saved ${deck.name} · ${deck.slides.length} slides`);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expectClean(w);
});

test('basket: three slides from three screens, reorder, export keeps count and order, survives navigation', async ({ page }) => {
  const w = watch(page);
  await open(page, '/');
  await expect(page.getByTestId('basket-count')).toHaveText('0');
  await page.getByTestId('add-to-slides').and(page.locator('[data-slide-kind="portfolio-headline"]')).click();
  await expect(page.getByTestId('basket-count')).toHaveText('1');
  await expect(page.getByTestId('basket-live')).toHaveText('Added to slides (1)');

  // Client-side navigation to the global view, then the deliverable page.
  await page.getByTestId('nav-global').click();
  await expect(page.getByTestId('page-title')).toHaveText('Global delivery');
  await page.locator('[data-slide-kind="portfolio-hubs"]').click();
  await expect(page.getByTestId('basket-live')).toHaveText('Added to slides (2)');

  await page.goto(`/deliverables/${HERO}/`); // a full reload: the basket comes back from session storage
  await expect(page.getByTestId('page-title')).toBeVisible();
  await expect(page.getByTestId('basket-count')).toHaveText('2');
  const verdict = page.locator('[data-slide-kind="td-verdict"]').first();
  await verdict.click();
  await expect(verdict).toHaveAttribute('data-added', 'true');
  await expect(page.getByTestId('basket-count')).toHaveText('3');
  await verdict.click(); // adding twice does not duplicate
  await expect(page.getByTestId('basket-count')).toHaveText('3');
  await expect(page.getByTestId('basket-live')).toHaveText('Already in slides (3)');

  await page.getByTestId('basket-button').click();
  const drawer = page.getByRole('dialog');
  const items = drawer.getByTestId('basket-item');
  await expect(items).toHaveCount(3);
  await expect(drawer.getByTestId('basket-footer-text')).toContainText('Prototype · synthetic data · as at 8 Mar 2027');
  expect(await items.evaluateAll((els) => els.map((e) => e.getAttribute('data-kind')))).toEqual(['portfolio-headline', 'portfolio-hubs', 'td-verdict']);

  // Move the deliverable verdict to the top with the keyboard-reachable buttons.
  await items.nth(2).getByTestId('basket-up').focus();
  await page.keyboard.press('Enter');
  await items.nth(1).getByTestId('basket-up').focus();
  await page.keyboard.press('Enter');
  expect(await items.evaluateAll((els) => els.map((e) => e.getAttribute('data-kind')))).toEqual(['td-verdict', 'portfolio-headline', 'portfolio-hubs']);
  const titles = await drawer.getByTestId('basket-item-title').allInnerTexts();
  await drawer.getByTestId('basket-name').fill('Steering pack');

  const deck = await exportAndRead(page, () => drawer.getByTestId('basket-export').click());
  expect(deck.name).toBe('TD-1001-slides-2027-03-08.pptx');
  expect(deck.size).toBeGreaterThan(0);
  expect(deck.slides).toHaveLength(3);
  expect(deck.slides.map((runs) => runs[0])).toEqual(titles.map((t) => t.trim()));
  await expect(drawer.getByTestId('export-done')).toHaveText(`Saved ${deck.name} · 3 slides`);

  // Reset demo clears the basket.
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  await resetDemo(page);
  await expect(page.getByTestId('basket-count')).toHaveText('0');
  await page.reload();
  await expect(page.getByTestId('basket-count')).toHaveText('0');
  expectClean(w);
});

test('builder: a programme pack from a hash, a deliverable by search, picked slides and the basket', async ({ page }) => {
  const w = watch(page);
  await open(page, '/slides/#scope=pm-node:pm-ccr&pack=programme');
  await expect(page.getByTestId('page-title')).toHaveText('Slide builder');
  await expect(page.getByTestId('scope-type-programme')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('pack-programme')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-testid="entity-option"][aria-pressed="true"]')).toContainText('PG-CCR');
  await expect(page.getByTestId('builder-footer-text')).toContainText('Prototype · synthetic data · as at 8 Mar 2027');
  await expect(page.getByTestId('deck-preview').getByRole('group', { name: /^Slide 1:/ })).toBeVisible();

  const deck = await exportAndRead(page, () => page.getByTestId('builder-export').click());
  expect(deck.name).toBe('PG-CCR-programme-pack-2027-03-08.pptx');
  expect(deck.size).toBeGreaterThan(0);
  expect(deck.slides.length).toBeGreaterThanOrEqual(8);
  expect(deck.slides[0]!.join(' ')).toContain('PG-CCR');
  await expect(page.getByTestId('export-done')).toHaveText(`Saved ${deck.name} · ${deck.slides.length} slides`);

  // The hash is read again when it changes.
  await page.evaluate(() => {
    window.location.hash = 'scope=deliverable:td-1001&pack=deliverable';
  });
  await expect(page.getByTestId('scope-type-deliverable')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('pack-deliverable')).toHaveAttribute('aria-pressed', 'true');

  // Search another deliverable, then pick two slides in a chosen order.
  await page.getByTestId('entity-search').fill('TD-1006');
  await page.getByTestId('entity-option').first().click();
  await page.getByTestId('mode-pick').click();
  await page.getByTestId('pick-td-readiness').check();
  await page.getByTestId('pick-td-verdict').check();
  await page.getByTestId('order-item').nth(1).getByRole('button', { name: /^Move up/ }).click();
  const picked = await exportAndRead(page, () => page.getByTestId('builder-export').click());
  expect(picked.name).toBe('TD-1006-slides-2027-03-08.pptx');
  expect(picked.slides).toHaveLength(2);
  expect(picked.slides[0]![0]).toMatch(/TD-1006/);

  // An unknown scope says so instead of building anything.
  await page.evaluate(() => {
    window.location.hash = 'scope=deliverable:td-nope';
  });
  await expect(page.getByTestId('builder-problem')).toContainText('Nothing in the current data matches');
  expectClean(w);
});

test('builder: opens the basket from the drawer and offers pack options', async ({ page }) => {
  const w = watch(page);
  await open(page, '/');
  await page.locator('[data-slide-kind="portfolio-rag"]').click();
  await page.locator('[data-slide-kind="portfolio-disagreements"]').click();
  await page.getByTestId('basket-button').click();
  await page.getByTestId('basket-open-builder').click();
  await expect(page.getByTestId('page-title')).toHaveText('Slide builder');
  await expect(page.getByTestId('mode-basket')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('order-item')).toHaveCount(2);
  await expect(page.getByTestId('deck-preview').getByRole('group')).toHaveCount(2);

  // Pack dialog on the portfolio screen: options, then a file.
  await page.getByTestId('nav-plan').click();
  await expect(page.locator('[data-slide-kind="portfolio-quarter"]')).toBeVisible();
  await page.getByTestId('nav-portfolio').click();
  await page.getByTestId('export-pack').click();
  const dialog = page.getByRole('dialog', { name: 'Portfolio pack' });
  await dialog.getByTestId('opt-narrative').uncheck();
  await dialog.getByTestId('opt-topn').selectOption('5');
  const deck = await exportAndRead(page, () => dialog.getByTestId('export-pack-go').click());
  expect(deck.name).toBe('Portfolio-portfolio-pack-2027-03-08.pptx');
  expect(deck.slides.length).toBeGreaterThan(8);
  expectClean(w);
});

test('hierarchy and outcome rows offer slide and pack buttons that work by keyboard', async ({ page }) => {
  const w = watch(page);
  await open(page, '/hierarchy/');
  const programme = page.getByRole('treeitem', { name: /PG-CCR/ }).first();
  await programme.getByTestId('add-to-slides').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('basket-count')).toHaveText('1');
  await programme.getByTestId('export-pack').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'PG-CCR pack' })).toBeVisible();
  await page.keyboard.press('Escape');

  await open(page, `/deliverables/${HERO}/`);
  const outcome = page.getByTestId('outcome-oc-1001-2');
  await outcome.getByTestId('export-pack').click();
  const dialog = page.getByRole('dialog', { name: /OC-1001-2 pack/ });
  await expect(dialog).toContainText('has no options');
  const deck = await exportAndRead(page, () => dialog.getByTestId('export-pack-go').click());
  expect(deck.name).toBe('OC-1001-2-outcome-pack-2027-03-08.pptx');
  expect(deck.slides.length).toBeGreaterThanOrEqual(6);
  expectClean(w);
});
