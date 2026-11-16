import { describe, expect, it } from 'vitest';
import { createPdlcRun } from '@/lib/config/pdlc';
import type { PdlcRun, PdlcStageId } from '@/lib/types';
import { canMoveBack, canMoveForward, checkStageMove, computeAll, moveBackSuggestion, outstandingReviews } from './index';
import { CLOCK, baseline, change } from './test-fixtures';

const reviewers = { 'requirements-owner': 'p-owner', 'business-owner': 'p-accept', 'release-owner': 'p-owner' };
const runAt = (stage: PdlcStageId): PdlcRun => createPdlcRun({ id: 'td-1', reviewers }, stage, '2027-01-04T09:00:00.000Z');

function approveAll(run: PdlcRun, stage: PdlcStageId): PdlcRun {
  const copy = structuredClone(run);
  for (const r of copy.stages[stage].reviews) r.state = 'approved';
  return copy;
}

describe('moving forward', () => {
  it('is refused until the current stage review is approved, with the reason for the UI', () => {
    const run = runAt('ideation-requirements');
    const check = canMoveForward(run);
    expect(check).toMatchObject({ allowed: false, code: 'review-not-approved', from: 'ideation-requirements', to: 'design-specifications' });
    expect(check.reason).toBe('Moving to Design & Specifications needs the requirements owner review (not requested) approved first.');
    expect(check.outstandingReviews).toEqual([{ roleId: 'requirements-owner', state: 'not-requested', reviewerId: 'p-owner' }]);
  });

  it('is allowed once the review is approved', () => {
    const check = canMoveForward(approveAll(runAt('ideation-requirements'), 'ideation-requirements'));
    expect(check).toMatchObject({ allowed: true, code: 'ok', to: 'design-specifications' });
  });

  it('needs every review of a stage: Delivery & Launch has two (business owner, then release owner)', () => {
    const run = runAt('delivery-launch');
    run.stages['delivery-launch'].reviews[0]!.state = 'approved';
    run.stages['delivery-launch'].reviews[1]!.state = 'pending';
    expect(outstandingReviews(run, 'delivery-launch')).toEqual([{ roleId: 'release-owner', state: 'pending', reviewerId: 'p-owner' }]);
    const atBuild = runAt('build-test-validate');
    atBuild.stages['build-test-validate'].reviews[0]!.state = 'returned';
    expect(canMoveForward(atBuild).reason).toContain('independent validator review (returned)');
  });

  it('is refused from the last stage', () => {
    const run = approveAll(runAt('delivery-launch'), 'delivery-launch');
    expect(canMoveForward(run)).toMatchObject({ allowed: false, code: 'no-next-stage', to: null });
  });
});

describe('moving back', () => {
  it('is always allowed between neighbours with a reason, even with reviews outstanding', () => {
    const check = canMoveBack(runAt('build-test-validate'), 'Reconciliation test failing');
    expect(check).toMatchObject({ allowed: true, to: 'risk-control-compliance', code: 'ok' });
    expect(check.reason).toBe('Moving back to Risk, Control & Compliance Reviews: Reconciliation test failing');
  });

  it('needs a reason to be recorded', () => {
    for (const reason of [undefined, null, '', '   ']) {
      expect(canMoveBack(runAt('build-test-validate'), reason)).toMatchObject({ allowed: false, code: 'reason-required' });
    }
  });

  it('is refused from the first stage', () => {
    expect(canMoveBack(runAt('ideation-requirements'), 'x')).toMatchObject({ allowed: false, code: 'no-previous-stage' });
  });
});

describe('moves to a chosen stage', () => {
  it('refuses non-neighbour moves in either direction', () => {
    const run = approveAll(runAt('design-specifications'), 'design-specifications');
    expect(checkStageMove(run, 'build-test-validate')).toMatchObject({ allowed: false, code: 'not-neighbour', direction: 'forward' });
    expect(checkStageMove(runAt('delivery-launch'), 'ideation-requirements', 'reason')).toMatchObject({ allowed: false, code: 'not-neighbour', direction: 'back' });
  });

  it('refuses a move to the same stage', () => {
    expect(checkStageMove(runAt('design-specifications'), 'design-specifications').code).toBe('same-stage');
  });

  it('delegates neighbour moves to the forward and back rules', () => {
    const run = runAt('design-specifications');
    expect(checkStageMove(run, 'risk-control-compliance').code).toBe('review-not-approved');
    expect(checkStageMove(approveAll(run, 'design-specifications'), 'risk-control-compliance').allowed).toBe(true);
    expect(checkStageMove(run, 'ideation-requirements').code).toBe('reason-required');
    expect(checkStageMove(run, 'ideation-requirements', 'Scope changed').allowed).toBe(true);
  });
});

describe('move-back suggestion from failing evidence', () => {
  it('offers the move back when a required test result fails at or after Build, Test & Validate', () => {
    const data = change(baseline(), (d) => {
      d.evidence[1]!.result = 'fail';
    });
    const readiness = computeAll(data, CLOCK).deliverables['td-1']!.readiness;
    const s = moveBackSuggestion(runAt('build-test-validate'), readiness);
    expect(s).toMatchObject({ offer: true, to: 'risk-control-compliance' });
    expect(s.reason).toContain('test result');
    expect(moveBackSuggestion(runAt('design-specifications'), readiness).offer).toBe(false); // test not produced yet
  });

  it('does not offer it when nothing fails', () => {
    const readiness = computeAll(baseline(), CLOCK).deliverables['td-1']!.readiness;
    expect(moveBackSuggestion(runAt('delivery-launch'), readiness).offer).toBe(false);
  });
});
