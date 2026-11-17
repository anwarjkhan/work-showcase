import { expect, test, type Page } from '@playwright/test';
import { expectClean, number, open, resetDemo, watch } from './helpers';

async function runRaidQuality(page: Page): Promise<void> {
  await page.getByTestId('run-button').click();
  await page.getByTestId('skip-button').click();
  await expect(page.locator('[data-testid=run-view][data-done]')).toBeVisible();
}

test('agent centre: run, approve, refusal as the assignee, reset restores everything', async ({ page }) => {
  const w = watch(page);
  await open(page, '/agents/#run-raid-quality');
  await expect(page.getByTestId('agent-select')).toHaveValue('raid-quality');
  await expect(page.getByTestId('run-view')).toHaveCount(0);
  const initial = await number(page, 'headline-findings');
  expect(initial).toBeGreaterThan(0);
  expect(await number(page, 'pending-count')).toBe(0);

  await runRaidQuality(page);
  await expect(page.getByTestId('run-summary')).toContainText('RAID');
  const pending = await number(page, 'pending-count');
  expect(pending).toBeGreaterThan(0);
  // A T4 item is advisory only: it has no approve control.
  await expect(page.locator('[data-testid=proposal-card][data-status=advisory]').first()).toBeVisible();
  await expect(page.locator('[data-testid=proposal-card][data-status=advisory] [data-testid=approve-button]')).toHaveCount(0);

  // Approve one proposal: the findings count drops and an audit event appears.
  const card = page.locator('[data-testid=proposal-card][data-status=pending]').first();
  await card.getByTestId('approve-button').click();
  await expect(page.getByTestId('effect-strip')).toBeVisible();
  await expect.poll(() => number(page, 'headline-findings')).toBe(initial - 1);
  await expect(page.getByTestId('portfolio-findings-count')).toHaveText(String(initial - 1));
  await expect(page.locator('[data-testid=audit-event][data-action="proposal.approved"]')).toHaveCount(1);

  // Act as the assignee of another pending item and attempt the approval: refused, with the reason.
  const assigneeCard = page.locator('[data-testid=proposal-card][data-status=pending]', { hasText: 'Assignee:' }).first();
  const proposalId = await assigneeCard.getAttribute('data-proposal-id');
  const name = (await assigneeCard.locator('text=Assignee:').innerText()).replace(/.*Assignee:\s*/, '').trim();
  const optionValue = await page.getByTestId('persona-select').locator('option', { hasText: name }).first().getAttribute('value');
  await page.getByTestId('persona-select').selectOption(optionValue!);
  const target = page.locator(`[data-proposal-id="${proposalId}"]`);
  await expect(target.getByTestId('approve-blocked-reason')).toContainText('assignee');
  await target.getByTestId('attempt-approve').click();
  await expect(target.getByTestId('governance-refusal')).toContainText(/is the assignee of .* cannot approve/);
  await expect(page.locator('[data-testid=audit-event][data-action="governance.blocked"]')).toHaveCount(1);
  // The refusal changed nothing.
  expect(await number(page, 'headline-findings')).toBe(initial - 1);

  // Reset demo restores the original count, an empty queue and an empty audit trail.
  await resetDemo(page);
  await expect.poll(() => number(page, 'headline-findings')).toBe(initial);
  expect(await number(page, 'pending-count')).toBe(0);
  await expect(page.getByTestId('run-view')).toHaveCount(0);
  await expect(page.getByTestId('effect-strip')).toHaveCount(0);
  await expect(page.getByTestId('audit-event')).toHaveCount(0);
  await expect(page.getByTestId('agent-select')).toHaveValue('raid-quality');
  expectClean(w);
});

test('an approval in the agent centre changes the deliverable page, and reset brings the finding back', async ({ page }) => {
  const w = watch(page);
  const DELIVERABLE = 'td-1010';
  const findings = page.locator('[data-finding]');

  // Before: this deliverable carries one record-quality finding (R4, a RAID item with no owner).
  await open(page, `/deliverables/${DELIVERABLE}/`);
  await expect(page.locator('[data-finding="R4"]')).toHaveCount(1);
  const before = await findings.count();
  expect(before).toBeGreaterThan(0);

  // Run the agent and approve the proposal that names this deliverable (client-side navigation keeps the store).
  await page.getByTestId('nav-agents').click();
  await expect(page.getByTestId('agent-select')).toBeVisible();
  await runRaidQuality(page);
  const card = page.locator('[data-testid=proposal-card][data-status=pending]', { hasText: new RegExp(`in\\s*${DELIVERABLE.toUpperCase()}`) }).first();
  await expect(card).toBeVisible();
  await card.getByTestId('approve-button').click();
  const effect = page.getByTestId('effect-strip');
  await expect(effect).toContainText(`${DELIVERABLE.toUpperCase()} findings`);
  await expect(effect).toContainText('Cleared');

  // After: the finding is gone from that deliverable's page.
  await page.getByTestId('effect-deliverable-link').click();
  await expect(page.getByTestId('page-title')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/deliverables/${DELIVERABLE}/`));
  await expect(page.locator('[data-finding="R4"]')).toHaveCount(0);
  await expect(findings).toHaveCount(before - 1);

  // Reset: it is back.
  await resetDemo(page);
  await expect(page.locator('[data-finding="R4"]')).toHaveCount(1);
  await expect(findings).toHaveCount(before);

  // The agent centre is back to its first state too.
  await page.getByTestId('nav-agents').click();
  expect(await number(page, 'pending-count')).toBe(0);
  expectClean(w);
});
