import { expect, test } from '@playwright/test';
import { expectClean, FLOW, open, resetDemo, watch } from './helpers';

test('workflow walk-through: first stage to Ready, with the failing test and the move back; reset returns to the start', async ({ page }) => {
  const w = watch(page);
  // The final approvals ask for confirmation; the presenter says yes.
  page.on('dialog', (dialog) => void dialog.accept());
  await open(page, `/lifecycle/${FLOW}/`);

  const screen = page.getByTestId('workflow-screen');
  const next = page.getByTestId('next-step');
  const measures = page.getByTestId('workflow-measures');
  const forward = page.getByTestId('move-forward');
  await expect(next).toBeVisible();
  await expect(screen).toHaveAttribute('data-stage', 'ideation-requirements');

  // Forward is disabled until the first review is approved, and says why.
  await expect(forward).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByTestId('forward-reason')).toContainText(/needs the requirements owner review/);

  const signature = async (): Promise<string> =>
    [await screen.getAttribute('data-stage'), await next.getAttribute('data-next-target'), await measures.innerText(), await next.innerText()].join('|');

  let sawFailure = false;
  let sawRecovery = false;
  const stages = new Set<string>();
  for (let guard = 0; guard < 60; guard++) {
    // While an agent's steps play, the presenter can skip ahead; if playback ends first, carry on.
    if ((await next.getAttribute('data-next-target')) === 'skip-playback') {
      await page.locator('[data-next="true"]').first().click({ timeout: 1500 }).catch(() => undefined);
      await expect(next).not.toHaveAttribute('data-next-target', 'skip-playback');
    }
    const target = (await next.getAttribute('data-next-target')) ?? '';
    stages.add((await screen.getAttribute('data-stage')) ?? '');
    if (target === 'ready') break;
    const before = await signature();
    const control = page.locator('[data-next="true"]').first();
    await expect(control, `highlighted control for ${target}`).toBeVisible();
    await control.click();
    await expect.poll(signature, { message: `state change after ${target}` }).not.toBe(before);

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

  expect(sawFailure, 'the walk-through meets the simulated failing test').toBe(true);
  expect(sawRecovery, 'the walk-through reruns the test and it passes').toBe(true);
  expect(stages.size, 'stages visited').toBeGreaterThanOrEqual(4);
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
  expectClean(w);
});
