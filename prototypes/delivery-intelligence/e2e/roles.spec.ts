import { expect, test, type Page } from '@playwright/test';
import { describeWorkflow } from '../lib/agents/workflow';
import { CORE_ROLES } from '../lib/config/pdlc';
import { terms } from '../lib/config/terminology';
import { createDemoStore } from '../lib/store/store';
import { expectClean, FLOW, HERO, open, watch } from './helpers';

// Expectations come from the same logic the screen uses (describeWorkflow over the seeded data), not from the screen.
const state = createDemoStore().getState();
const views = state.data.deliverables.map((d) => ({ d, view: describeWorkflow(state.data, state.results, d.id)! }));

type Role = (typeof CORE_ROLES)[number];
const SLUG: Record<Role, string> = { 'product-manager': 'product-manager', 'tech-lead': 'tech-lead', 'risk-lead': 'risk-lead', 'ux-lead': 'ux-lead' };

/** Deliverables whose next review on the current stage belongs to `role` and can be decided by its holder. */
function waitingFor(role: Role): string[] {
  return views
    .filter(({ view }) => {
      const next = view.stages.find((s) => s.current)?.reviews.find((r) => r.next);
      return next?.roleId === role && !next.holderBlocked;
    })
    .map(({ d }) => d.id);
}

function comingUpFor(role: Role): string[] {
  return views
    .filter(({ view }) => {
      const r = view.stages.find((s) => s.current)?.reviews.find((x) => x.roleId === role);
      return !!r && r.state !== 'approved' && !r.next && !r.holderBlocked;
    })
    .map(({ d }) => d.id);
}

async function itemIds(page: Page, list: string): Promise<string[]> {
  return page.locator(`[data-testid="${list}"] [data-testid="role-item"]`).evaluateAll((els) => els.map((e) => e.getAttribute('data-deliverable') ?? ''));
}

test('By role: each role tab renders, and the counts and lists match the workflow logic', async ({ page }) => {
  const w = watch(page);
  await open(page, '/roles/');
  await expect(page.getByTestId('roles-screen')).toHaveAttribute('data-role', 'product-manager');
  const tabs = page.getByRole('tablist', { name: 'Core Four role' }).getByRole('tab');
  await expect(tabs).toHaveCount(4);
  await expect(tabs.first()).toContainText(terms.coreRoles['product-manager']);
  await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');

  for (const role of CORE_ROLES) {
    const expected = waitingFor(role);
    await expect(page.getByTestId(`role-count-value-${role}`)).toHaveText(String(expected.length));
    await page.getByRole('tab', { name: new RegExp(terms.coreRoles[role]) }).click();
    await expect(page.getByTestId('roles-screen')).toHaveAttribute('data-role', SLUG[role]);
    const waiting = await itemIds(page, 'role-waiting');
    expect([...waiting].sort(), `waiting on the ${role}`).toEqual([...expected].sort());
    const coming = await itemIds(page, 'role-coming');
    expect([...coming].sort(), `coming up for the ${role}`).toEqual([...comingUpFor(role)].sort());
    await expect(page.getByTestId('role-summary')).toContainText(`${expected.length}`);
  }

  // The walk-through deliverable waits on its In-Business Risk Lead; the hero waits on its Tech Lead (both from the logic layer).
  for (const id of [FLOW, HERO]) {
    const next = views.find(({ d }) => d.id === id)!.view.stages.find((s) => s.current)!.reviews.find((r) => r.next)!;
    await page.getByRole('tab', { name: new RegExp(terms.coreRoles[next.roleId]) }).click();
    const row = page.locator(`[data-testid="role-waiting"] [data-deliverable="${id}"]`);
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(next.personName ?? '');
  }
  expectClean(w);
});

test('By role: "Open workflow as" lands on the workflow with that persona preselected', async ({ page }) => {
  const w = watch(page);
  const next = views.find(({ d }) => d.id === FLOW)!.view.stages.find((s) => s.current)!.reviews.find((r) => r.next)!;
  await open(page, `/roles/#role=${next.roleId}`);
  const row = page.locator(`[data-testid="role-waiting"] [data-deliverable="${FLOW}"]`);
  await expect(row).toBeVisible();
  const link = row.getByTestId('open-workflow-as');
  await expect(link).toContainText(`Open workflow as ${next.personName}`);
  await link.click();
  await expect(page.getByTestId('workflow-screen')).toHaveAttribute('data-deliverable', FLOW);
  await expect(page.getByTestId('acting-as').locator('option:checked')).toContainText(next.personName!);
  // The strip points at that person's confirmation, and the persona no longer needs switching.
  await expect(page.getByTestId('next-step')).toHaveAttribute('data-next-target', /run-agent/);
  expectClean(w);
});

test('By role: hashes select the role and the person', async ({ page }) => {
  const w = watch(page);
  const riskPeople = new Map<string, string>();
  for (const { view } of views) {
    const seat = view.coreTeam.find((s) => s.roleId === 'risk-lead');
    if (seat?.personId) riskPeople.set(seat.personId, seat.personName ?? seat.personId);
  }
  const [personId, personName] = [...riskPeople.entries()][0]!;
  await open(page, `/roles/#role=risk-lead&person=${personId}`);
  const screen = page.getByTestId('roles-screen');
  await expect(screen).toHaveAttribute('data-role', 'risk-lead');
  await expect(screen).toHaveAttribute('data-person', personId);
  await expect(page.getByTestId('role-person')).toHaveValue(personId);
  // Only that person's items remain.
  const expected = views
    .filter(({ view }) => {
      const next = view.stages.find((s) => s.current)?.reviews.find((r) => r.next);
      return next?.roleId === 'risk-lead' && next.personId === personId && !next.holderBlocked;
    })
    .map(({ d }) => d.id);
  expect((await itemIds(page, 'role-waiting')).sort()).toEqual(expected.sort());
  await expect(page.getByTestId('role-summary')).toContainText(personName);

  // A role alone clears the person; a person alone selects the role they hold.
  await page.goto('/roles/#role=tech-lead');
  await expect(screen).toHaveAttribute('data-role', 'tech-lead');
  await expect(screen).toHaveAttribute('data-person', '');
  await page.goto(`/roles/#person=${personId}`);
  await expect(screen).toHaveAttribute('data-person', personId);
  expectClean(w);
});

test('By role: seat gaps list the empty and the doubled seats', async ({ page }) => {
  const w = watch(page);
  const missing = views.filter(({ view }) => view.coreTeam.some((s) => s.roleId === 'risk-lead' && !s.personId)).map(({ d }) => d.id);
  expect(missing.length, 'the sample data has a deliverable with no In-Business Risk Lead').toBeGreaterThan(0);
  await open(page, '/roles/#role=risk-lead');
  const gaps = page.getByTestId('role-gaps');
  for (const id of missing) await expect(gaps.locator(`[data-kind="not-named"][data-deliverable="${id}"]`)).toHaveCount(1);
  const shared = views.filter(({ view }) => view.coreTeam.some((s) => s.shared)).map(({ d }) => d.id);
  expect(shared.length, 'the sample data has a person holding two roles').toBeGreaterThan(0);
  const roleOfShared = CORE_ROLES.find((r) => views.some(({ view }) => view.coreTeam.some((s) => s.roleId === r && s.shared)))!;
  await page.getByRole('tab', { name: new RegExp(terms.coreRoles[roleOfShared]) }).click();
  await expect(page.getByTestId('role-gaps').locator('[data-kind="two-roles"]').first()).toBeVisible();
  expectClean(w);
});
