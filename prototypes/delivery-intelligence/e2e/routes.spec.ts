import { expect, test } from '@playwright/test';
import { expectClean, FLOW, HERO, horizontalOverflow, open, OTHER, watch } from './helpers';

// Every route, including both dynamic routes for the two story deliverables and one other.
const ROUTES: Array<{ name: string; path: string; title: string | RegExp }> = [
  { name: 'portfolio', path: '/', title: 'Portfolio' },
  { name: 'hierarchy', path: '/hierarchy/', title: 'Hierarchy explorer' },
  { name: 'deliverable (main storyline)', path: `/deliverables/${HERO}/`, title: /Counterparty exposure/ },
  { name: 'deliverable (workflow story)', path: `/deliverables/${FLOW}/`, title: /Limit-monitoring dashboard filters/ },
  { name: 'deliverable (other)', path: `/deliverables/${OTHER}/`, title: /\S/ },
  { name: 'plan', path: '/plan/', title: 'Plan' },
  { name: 'global', path: '/global/', title: 'Global delivery' },
  { name: 'lifecycle', path: '/lifecycle/', title: 'Lifecycle' },
  { name: 'workflow (workflow story)', path: `/lifecycle/${FLOW}/`, title: /\S/ },
  { name: 'workflow (main storyline)', path: `/lifecycle/${HERO}/`, title: /\S/ },
  { name: 'workflow (other)', path: `/lifecycle/${OTHER}/`, title: /\S/ },
  { name: 'agents', path: '/agents/', title: 'Agent centre' },
  { name: 'blueprint', path: '/blueprint/', title: 'Template blueprint' },
  { name: 'evidence', path: '/evidence/', title: 'Pilot evidence' },
  { name: 'slides', path: '/slides/', title: 'Slide builder' },
  { name: 'about', path: '/about/', title: 'About this build' },
];

for (const width of [1920, 1366]) {
  test.describe(`routes at ${width}px`, () => {
    for (const route of ROUTES) {
      test(`${route.name} loads cleanly`, async ({ page }) => {
        await page.setViewportSize({ width, height: width === 1920 ? 1080 : 768 });
        const w = watch(page);
        await open(page, route.path);
        await expect(page.getByTestId('page-title')).toHaveText(route.title);
        await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
        await page.waitForLoadState('networkidle');
        expect(await horizontalOverflow(page), 'horizontal page overflow in px').toBeLessThanOrEqual(0);
        expectClean(w);
      });
    }
  });
}

test('left navigation reaches every screen and marks the current one', async ({ page }) => {
  const w = watch(page);
  await open(page, '/');
  const ids: Array<[string, string | RegExp]> = [
    ['hierarchy', 'Hierarchy explorer'],
    ['deliverable', /Counterparty exposure/],
    ['plan', 'Plan'],
    ['global', 'Global delivery'],
    ['lifecycle', 'Lifecycle'],
    ['workflow', /\S/],
    ['agents', 'Agent centre'],
    ['blueprint', 'Template blueprint'],
    ['evidence', 'Pilot evidence'],
    ['about', 'About this build'],
    ['portfolio', 'Portfolio'],
  ];
  for (const [id, title] of ids) {
    await page.getByTestId(`nav-${id}`).click();
    await expect(page.getByTestId(`nav-${id}`)).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('page-title')).toHaveText(title);
  }
  expectClean(w);
});
