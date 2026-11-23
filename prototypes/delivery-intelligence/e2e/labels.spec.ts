import { expect, test, type Page } from '@playwright/test';
import { expectClean, FLOW, HERO, horizontalOverflow, LABELS_KEY, open, resetDemo, watch } from './helpers';

// The twelve routes; the two dynamic ones are opened for both story deliverables.
const ROUTES: Array<{ name: string; path: string }> = [
  { name: 'portfolio', path: '/' },
  { name: 'hierarchy', path: '/hierarchy/' },
  { name: 'deliverable (main storyline)', path: `/deliverables/${HERO}/` },
  { name: 'deliverable (workflow story)', path: `/deliverables/${FLOW}/` },
  { name: 'plan', path: '/plan/' },
  { name: 'global', path: '/global/' },
  { name: 'lifecycle', path: '/lifecycle/' },
  { name: 'workflow (workflow story)', path: `/lifecycle/${FLOW}/` },
  { name: 'workflow (main storyline)', path: `/lifecycle/${HERO}/` },
  { name: 'agents', path: '/agents/' },
  { name: 'blueprint', path: '/blueprint/' },
  { name: 'evidence', path: '/evidence/' },
  { name: 'slides', path: '/slides/' },
  { name: 'about', path: '/about/' },
];

const html = (page: Page) => page.locator('html');
const labelled = (page: Page) => page.locator('.di-demo-label, .di-demo-note').filter({ visible: true });
const toggle = (page: Page) => page.getByTestId('labels-toggle');

for (const width of [1920, 1366]) {
  test.describe(`labels off at ${width}px`, () => {
    for (const route of ROUTES) {
      test(`${route.name}`, async ({ page }) => {
        await page.setViewportSize({ width, height: width === 1920 ? 1080 : 768 });
        const w = watch(page);
        await open(page, route.path);
        await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
        await page.waitForLoadState('networkidle');

        // Default is on, and the page really has labels (so the check below is not vacuous).
        await expect(html(page)).toHaveAttribute('data-labels', 'on');
        await expect(page.getByTestId('prototype-marker')).toBeHidden();
        expect(await labelled(page).count(), 'labels visible while on').toBeGreaterThan(0);

        await toggle(page).click();
        await expect(html(page)).toHaveAttribute('data-labels', 'off');
        // Reload so the stored value is applied before first paint.
        await page.reload();
        await expect(page.getByTestId('page-title')).toBeVisible();
        await page.waitForLoadState('networkidle');
        await expect(html(page)).toHaveAttribute('data-labels', 'off');

        await expect(labelled(page)).toHaveCount(0);
        await expect(page.getByTestId('prototype-marker')).toBeVisible();
        await expect(page.getByTestId('prototype-marker')).toHaveText('Prototype');
        await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByText('Synthetic data for demonstration only')).toBeVisible();
        expect(await horizontalOverflow(page), 'horizontal page overflow in px').toBeLessThanOrEqual(0);
        expectClean(w);
      });
    }
  });
}

test('the toggle names its state, shows a tooltip, and Shift+L flips it', async ({ page }) => {
  const w = watch(page);
  await open(page, '/');
  const btn = toggle(page);
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
  await expect(btn).toHaveAccessibleName('Labels on');

  await btn.hover();
  await expect(page.getByRole('tooltip')).toHaveText('Labels on');
  await btn.click();
  await expect(html(page)).toHaveAttribute('data-labels', 'off');
  await expect(btn).toHaveAttribute('aria-pressed', 'false');
  await expect(btn).toHaveAccessibleName('Labels off');
  await expect(page.getByRole('tooltip')).toHaveText('Labels off');

  await page.mouse.move(600, 600);
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Shift+L');
  await expect(html(page)).toHaveAttribute('data-labels', 'on');
  await expect(btn).toHaveAccessibleName('Labels on');
  await page.keyboard.press('Shift+L');
  await expect(html(page)).toHaveAttribute('data-labels', 'off');

  // Keyboard focus shows the tooltip too.
  await btn.focus();
  await expect(page.getByRole('tooltip')).toHaveText('Labels off');
  expectClean(w);
});

test('Shift+L is ignored while focus is in an input, select or textarea', async ({ page }) => {
  await open(page, '/');
  await page.getByTestId('demo-start').click();
  const box = page.getByTestId('demo-start-labels');
  await box.focus();
  await page.keyboard.press('Shift+L');
  await expect(html(page)).toHaveAttribute('data-labels', 'on');

  // A text field and a select on the page, created in place so the test does not depend on a screen.
  await page.evaluate(() => {
    for (const tag of ['input', 'select', 'textarea']) {
      const el = document.createElement(tag);
      el.id = `probe-${tag}`;
      document.body.appendChild(el);
    }
  });
  for (const tag of ['input', 'select', 'textarea']) {
    await page.locator(`#probe-${tag}`).focus();
    await page.keyboard.press('Shift+L');
    await expect(html(page)).toHaveAttribute('data-labels', 'on');
  }
});

test('the choice survives a reload and Reset demo does not change it', async ({ page }) => {
  const w = watch(page);
  await open(page, '/');
  await toggle(page).click();
  await expect(html(page)).toHaveAttribute('data-labels', 'off');
  expect(await page.evaluate((k) => localStorage.getItem(k), LABELS_KEY)).toBe('off');

  await page.reload();
  await expect(page.getByTestId('page-title')).toBeVisible();
  await expect(html(page)).toHaveAttribute('data-labels', 'off');

  await resetDemo(page);
  await expect(html(page)).toHaveAttribute('data-labels', 'off');
  expect(await page.evaluate((k) => localStorage.getItem(k), LABELS_KEY)).toBe('off');

  await toggle(page).click();
  await resetDemo(page);
  await expect(html(page)).toHaveAttribute('data-labels', 'on');
  await page.reload();
  await expect(html(page)).toHaveAttribute('data-labels', 'on');
  expectClean(w);
});

test('the guided demo start popover has a Labels on checkbox that sets the same preference', async ({ page }) => {
  await open(page, '/');
  await page.getByTestId('demo-start').click();
  const box = page.getByTestId('demo-start-labels');
  await expect(box).toBeChecked();
  await box.uncheck();
  await expect(html(page)).toHaveAttribute('data-labels', 'off');
  await expect(toggle(page)).toHaveAccessibleName('Labels off');
  await box.check();
  await expect(html(page)).toHaveAttribute('data-labels', 'on');
});

test('Pilot evidence keeps a visible placeholder notice in both modes', async ({ page }) => {
  await open(page, '/evidence/');
  const notice = page.getByText('Nothing below the baseline is a measured result yet.');
  await expect(notice).toBeVisible();
  await expect(page.getByText('Placeholder', { exact: true }).first()).toBeVisible();
  await toggle(page).click();
  await expect(notice).toBeVisible();
  await expect(page.getByText('Placeholder', { exact: true }).first()).toBeVisible();
});
