import { expect, test, type Page } from '@playwright/test';
import { DEMO_STEPS } from '../lib/config/demo-script';
import { expectClean, open, resetDemo, watch } from './helpers';

const TOTAL = DEMO_STEPS.length;

/** Path (and hash) a step should land on. */
function expectedPath(route: string): { path: string; hash: string } {
  const [p, h] = route.split('#');
  const path = !p || p === '/' ? '/' : `${p.replace(/\/+$/, '')}/`;
  return { path, hash: h ? `#${h}` : '' };
}

async function expectStep(page: Page, index: number): Promise<void> {
  const step = DEMO_STEPS[index]!;
  const { path, hash } = expectedPath(step.route);
  await expect(page.getByTestId('demo-overlay-step')).toHaveText(`Step ${step.n} of ${TOTAL}`);
  await expect(page.getByTestId('demo-step-title')).toHaveText(step.title);
  await expect(page.getByTestId('demo-step-indicator')).toHaveText(`Step ${step.n} of ${TOTAL}`);
  await expect.poll(() => new URL(page.url()).pathname).toBe(path);
  await expect.poll(() => new URL(page.url()).hash).toBe(hash);
  await expect(page.getByTestId('page-title')).toBeVisible();
}

async function startDemo(page: Page): Promise<void> {
  await page.getByTestId('demo-start').click();
  await expect(page.getByRole('dialog', { name: 'Start guided demo' })).toBeVisible();
  await page.getByTestId('demo-start-reset').click();
  await expect(page.getByTestId('demo-overlay')).toBeVisible();
}

test('guided journey: start, step through all eleven steps by keyboard, exit', async ({ page }) => {
  const w = watch(page);
  await open(page, '/');
  await expect(page.getByTestId('demo-start')).toHaveText('Start guided demo');
  await startDemo(page);
  await expectStep(page, 0);
  await expect(page.getByTestId('demo-prompts').getByRole('listitem')).not.toHaveCount(0);
  await expect(page.getByTestId('demo-point')).not.toBeEmpty();
  await expect(page.getByTestId('demo-prev')).toBeDisabled();

  // Forward through every step. Focus is on the page body or inside the overlay.
  for (let i = 1; i < TOTAL; i++) {
    await page.keyboard.press(i % 2 === 0 ? 'ArrowRight' : 'n');
    await expectStep(page, i);
  }
  await expect(page.getByTestId('demo-next')).toBeDisabled();
  await page.keyboard.press('PageDown'); // does nothing at the last step
  await expectStep(page, TOTAL - 1);

  // And back again.
  for (let i = TOTAL - 2; i >= 0; i--) {
    await page.keyboard.press(i % 2 === 0 ? 'ArrowLeft' : 'p');
    await expectStep(page, i);
  }
  await page.keyboard.press('PageDown');
  await expectStep(page, 1);
  await page.keyboard.press('PageUp');
  await expectStep(page, 0);

  // No real name or internal word in what the presenter sees.
  const shown = (await page.getByTestId('demo-overlay').innerText()).toLowerCase();
  expect(shown).not.toContain('hero');

  await page.getByTestId('demo-exit').click();
  await expect(page.getByTestId('demo-overlay')).toHaveCount(0);
  await expect(page.getByTestId('demo-start')).toBeVisible();
  expectClean(w);
});

test('guided demo uses the real reference and title, and screens honour the hash', async ({ page }) => {
  await open(page, '/');
  await startDemo(page);
  await page.getByTestId('demo-list-toggle').click();
  await page.getByTestId('demo-step-list').getByRole('button', { name: /A status report where every sentence is cited/ }).click();
  await expect(page.getByTestId('demo-point')).toContainText('TD-1001');
  await expect(page.getByTestId('status-section')).toBeVisible();
  await page.getByTestId('demo-list-toggle').click();
  await page.getByTestId('demo-step-list').getByRole('button', { name: /The late dependency crosses hubs/ }).click();
  await expect(page.getByTestId('hero-callout')).toContainText('9');
  await page.getByTestId('demo-list-toggle').click();
  await page.getByTestId('demo-step-list').getByRole('button', { name: /Walk one deliverable through the stages/ }).click();
  await expect(page.getByTestId('demo-point')).toContainText('Limit-monitoring dashboard filters');
  await expect(page.getByTestId('workflow-screen')).toBeVisible();
});

test('keyboard shortcuts leave text fields and widgets alone, Alt+arrows work anywhere', async ({ page }) => {
  await open(page, '/hierarchy/');
  await startDemo(page);
  await expectStep(page, 0);
  await page.getByTestId('demo-next').click();
  await expectStep(page, 1);

  // Focus in a tree: plain arrows belong to the tree; Alt+Right moves the demo.
  const tree = page.getByRole('treeitem').first();
  await tree.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('n');
  await expect(page.getByTestId('demo-overlay-step')).toHaveText(`Step 2 of ${TOTAL}`);
  await page.keyboard.press('Alt+ArrowRight');
  await expectStep(page, 2);
  await page.keyboard.press('Alt+ArrowLeft');
  await expectStep(page, 1);

  // Focus in a select or input on another screen: nothing fires, even Alt+arrows.
  await page.getByTestId('demo-next').click();
  await expectStep(page, 2);
  await page.locator('#deliverable-switcher').focus();
  await page.keyboard.press('p');
  await page.keyboard.press('Alt+ArrowLeft');
  await expect(page.getByTestId('demo-overlay-step')).toHaveText(`Step 3 of ${TOTAL}`);
  await page.locator('#deliverable-switcher').blur();
  await page.locator('body').click({ position: { x: 5, y: 400 } });
  await page.keyboard.press('p');
  await expectStep(page, 1);
});

test('collapse to a pill and expand again with the keyboard; state survives a reload; reset clears it', async ({ page }) => {
  await open(page, '/');
  await startDemo(page);
  await page.getByTestId('demo-next').click();
  await page.getByTestId('demo-next').click();
  await expectStep(page, 2);

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('demo-overlay')).toHaveAttribute('data-collapsed', 'true');
  await expect(page.getByTestId('demo-expand')).toContainText(`Step 3 of ${TOTAL}`);
  await expect(page.getByTestId('demo-point')).toHaveCount(0);

  await page.reload();
  await expect(page.getByTestId('demo-overlay')).toHaveAttribute('data-collapsed', 'true');
  await expect.poll(() => new URL(page.url()).pathname).toBe('/deliverables/td-1001/');
  await expect(page.getByTestId('demo-step-indicator')).toHaveText(`Step 3 of ${TOTAL}`);

  await page.getByTestId('demo-expand').click();
  await expect(page.getByTestId('demo-overlay')).toHaveAttribute('data-collapsed', 'false');
  await expectStep(page, 2);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('demo-overlay')).toHaveAttribute('data-collapsed', 'true');

  await resetDemo(page);
  await expect(page.getByTestId('demo-overlay')).toHaveCount(0);
  await expect(page.getByTestId('demo-start')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('demo-start')).toBeVisible();
  await expect(page.getByTestId('demo-overlay')).toHaveCount(0);
});
