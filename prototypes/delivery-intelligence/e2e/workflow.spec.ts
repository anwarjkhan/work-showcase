import { expect, test } from '@playwright/test';
import { expectClean, FLOW, open, resetDemo, watch } from './helpers';

test('workflow walk-through: the Core Four take a deliverable from the first stage to Ready, with the failing test and the move back; reset returns to the start', async ({ page }) => {
  const w = watch(page);
  // The final approvals ask for confirmation; the presenter says yes.
  page.on('dialog', (dialog) => void dialog.accept());
  await open(page, `/lifecycle/${FLOW}/`);

  const screen = page.getByTestId('workflow-screen');
  const next = page.getByTestId('next-step');
  const measures = page.getByTestId('workflow-measures');
  const forward = page.getByTestId('move-forward');
  const actingAs = page.getByTestId('acting-as');
  await expect(next).toBeVisible();
  await expect(screen).toHaveAttribute('data-stage', 'ideation-requirements');

  // The beat is the Core Four review: each confirmation as a row, the Product Manager's gate last and distinct.
  const panel = page.getByTestId('review-panel');
  await expect(panel).toContainText('The Core Four review');
  const rows = panel.locator('li[data-testid^="review-"]');
  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toHaveAttribute('data-testid', 'review-risk-lead');
  await expect(rows.last()).toHaveAttribute('data-testid', 'review-product-manager');
  await expect(rows.last()).toHaveAttribute('data-gate', 'true');
  await expect(rows.last()).toContainText('Gate · Product Manager');
  await expect(page.getByTestId('review-holder-risk-lead')).not.toHaveText('');

  // Forward is disabled until the reviews are decided, and says who must still confirm.
  await expect(forward).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByTestId('forward-reason')).toContainText(/needs the In-Business Risk Lead to name the obligations/);

  // The "Acting as" list leads with the Core Four, with their roles.
  await expect(actingAs.locator('optgroup').first()).toHaveAttribute('label', 'Core Four');
  const coreOptions = actingAs.locator('optgroup').first().locator('option');
  await expect(coreOptions).toHaveCount(4);
  await expect(coreOptions.filter({ hasText: 'PM' })).toHaveCount(1);

  // Follow the highlighted control (stage agent, then its stories) until the first Core Four confirmation is next.
  let clicks = 0;
  for (let guard = 0; guard < 10 && (await next.getAttribute('data-next-target')) !== 'approve-review:risk-lead'; guard++) {
    const before = await next.getAttribute('data-next-target');
    await page.locator('[data-next="true"]').first().click({ timeout: 3000 }).catch(() => undefined);
    if (before !== 'skip-playback') clicks++;
    await page.waitForTimeout(150);
  }
  await expect(next).toHaveAttribute('data-next-target', 'approve-review:risk-lead');
  await expect(next).toContainText(/Confirm as In-Business Risk Lead \(/);

  // The Product Manager cannot take the gate while a confirmation is outstanding: switch persona by hand and try.
  const pmName = (await page.getByTestId('review-holder-product-manager').innerText()).trim();
  const pmOption = actingAs.locator('option', { hasText: `${pmName} · PM` });
  await actingAs.selectOption(await pmOption.getAttribute('value') as string);
  await expect(page.getByTestId('acting-as-note')).toContainText('Product Manager');
  await panel.getByTestId('review-product-manager').getByRole('button', { name: 'Approve the gate' }).click();
  const notice = page.getByTestId('workflow-notice');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText(/Refused\./);
  await expect(notice).toContainText(/Waiting on the In-Business Risk Lead/);
  await expect(page.getByTestId('review-product-manager')).toHaveAttribute('data-state', /not-requested|pending/);
  await expect(page.getByTestId('review-risk-lead')).not.toHaveAttribute('data-state', 'approved');

  // Follow the highlighted control to the end: each click does everything the step names, persona switch included.
  const signature = async (): Promise<string> =>
    [await screen.getAttribute('data-stage'), await next.getAttribute('data-next-target'), await measures.innerText(), await next.innerText(), await actingAs.inputValue()].join('|');

  const started = Date.now();
  let sawFailure = false;
  let sawRecovery = false;
  const stages = new Set<string>();
  const roleOrder = new Map<string, string[]>();
  for (let guard = 0; guard < 80; guard++) {
    // While an agent's steps play, the presenter can skip ahead; if playback ends first, carry on.
    if ((await next.getAttribute('data-next-target')) === 'skip-playback') {
      await page.locator('[data-next="true"]').first().click({ timeout: 1500 }).catch(() => undefined);
      await expect(next).not.toHaveAttribute('data-next-target', 'skip-playback');
    }
    const target = (await next.getAttribute('data-next-target')) ?? '';
    const stage = (await screen.getAttribute('data-stage')) ?? '';
    stages.add(stage);
    if (target === 'ready') break;
    const before = await signature();
    const control = page.locator('[data-next="true"]').first();
    await expect(control, `highlighted control for ${target}`).toBeVisible();
    await control.click();
    clicks++;
    await expect.poll(signature, { message: `state change after ${target}` }).not.toBe(before);

    if (target.startsWith('approve-review:')) {
      const role = target.split(':')[1]!;
      roleOrder.set(stage, [...(roleOrder.get(stage) ?? []), role]);
      // The persona is now the role holder (the click switched it): the select shows that person.
      const holder = (await page.getByTestId(`review-holder-${role}`).innerText()).trim();
      await expect(actingAs.locator('option:checked')).toContainText(holder);
    }
    if (target === 'simulate:test-result:fail') {
      sawFailure = true;
      await expect(measures).toContainText('Not ready');
      await expect(page.getByTestId('move-back-offer')).toBeVisible();
    }
    if (target === 'simulate:test-result:pass') {
      sawRecovery = true;
      await expect(measures).not.toContainText('Not ready');
      await expect(page.getByTestId('move-back-offer')).toHaveCount(0);
    }
  }
  const elapsed = Date.now() - started;
  console.log(`walk-through: ${clicks} clicks of the highlighted control, ${(elapsed / 1000).toFixed(1)} s`);

  expect(sawFailure, 'the walk-through meets the simulated failing test').toBe(true);
  expect(sawRecovery, 'the walk-through reruns the test and it passes').toBe(true);
  expect(stages.size, 'stages visited').toBeGreaterThanOrEqual(4);
  // Specialists first, the Product Manager's gate last, at every stage.
  expect(roleOrder.get('ideation-requirements')).toEqual(['risk-lead', 'ux-lead', 'product-manager']);
  expect(roleOrder.get('design-specifications')).toEqual(['tech-lead', 'ux-lead', 'product-manager']);
  expect(roleOrder.get('risk-control-compliance')?.slice(0, 2)).toEqual(['risk-lead', 'product-manager']);
  expect(roleOrder.get('build-test-validate')).toEqual(['tech-lead', 'product-manager']);
  expect(roleOrder.get('delivery-launch')).toEqual(['tech-lead', 'product-manager']);
  await expect(next).toHaveAttribute('data-next-target', 'ready');
  await expect(measures).toContainText(/100\s*%/);
  await expect(measures).toContainText(/1\s*of\s*1/);
  await expect(measures).toContainText('Ready');
  await expect(measures).not.toContainText(/Not ready|Unknown/);

  // Reset demo returns it to the first stage with nothing left over.
  await resetDemo(page);
  await expect(screen).toHaveAttribute('data-stage', 'ideation-requirements');
  await expect(next).toHaveAttribute('data-next-target', 'run-agent');
  await expect(page.getByTestId('agent-output')).toHaveCount(0);
  await expect(measures).toContainText(/0 of 8 points/);
  await expect(forward).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByTestId('review-risk-lead')).not.toHaveAttribute('data-state', 'approved');
  expectClean(w);
});

test('an empty Core Four seat is shown plainly, with no control that could decide the review', async ({ page }) => {
  const w = watch(page);
  // TD-1014 has no In-Business Risk Lead named and sits in the stage where that role confirms.
  await open(page, '/lifecycle/td-1014/');
  const risk = page.getByTestId('review-risk-lead');
  await expect(risk).toBeVisible();
  await expect(page.getByTestId('review-holder-risk-lead')).toHaveText('Not named');
  await expect(page.getByTestId('review-blocked-risk-lead')).toContainText(/no In-Business Risk Lead named/);
  await expect(risk.getByRole('button')).toHaveCount(0);
  await expect(page.getByTestId('next-step')).toContainText(/In-Business Risk Lead/);
  await expect(page.getByTestId('next-step')).toHaveAttribute('data-next-target', 'core-four-gap');
  expectClean(w);
});

test('the persona can be preselected from a link and still be changed by hand', async ({ page }) => {
  const w = watch(page);
  await open(page, `/lifecycle/${FLOW}/`);
  const actingAs = page.getByTestId('acting-as');
  const coreOptions = actingAs.locator('optgroup').first().locator('option');
  const riskOption = coreOptions.filter({ hasText: 'Risk Lead' });
  const riskId = (await riskOption.getAttribute('value')) as string;
  await open(page, '/about/');
  await page.goto(`/lifecycle/${FLOW}/#act-as=${riskId}`);
  await expect(page.getByTestId('page-title')).toBeVisible();
  await expect(actingAs).toHaveValue(riskId);
  const pmId = (await coreOptions.filter({ hasText: 'PM' }).getAttribute('value')) as string;
  await actingAs.selectOption(pmId);
  await expect(actingAs).toHaveValue(pmId);
  expectClean(w);
});
