import { describe, expect, it } from 'vitest';
import { createPdlcRun, PDLC_STAGES } from '@/lib/config/pdlc';
import type { PdlcRun, PdlcStageId, TechDeliverable } from '@/lib/types';
import { canMoveBack, canMoveForward, checkStageMove, computeAll, moveBackSuggestion, outstandingReviews } from './index';
import { CLOCK, baseline, change } from './test-fixtures';

// The UX Design Lead seat is left empty on purpose: the run still lists the review, with no named person.
const coreTeam: TechDeliverable['coreTeam'] = {
  'product-manager': { personId: 'p-accept', joinedAt: '2026-12-01' },
  'tech-lead': { personId: 'p-owner', joinedAt: '2026-12-01' },
  'risk-lead': { personId: 'p-risk', joinedAt: '2026-12-01' },
};
const runAt = (stage: PdlcStageId): PdlcRun => createPdlcRun({ id: 'td-1', coreTeam }, stage, '2027-01-04T09:00:00.000Z');

describe('stage reviews (Core Four)', () => {
  it('ends every stage with the Product Manager gate, after the specialist confirmations', () => {
    expect(PDLC_STAGES.map((s) => s.reviews)).toEqual([
      ['risk-lead', 'ux-lead', 'product-manager'],
      ['tech-lead', 'ux-lead', 'product-manager'],
      ['risk-lead', 'product-manager'],
      ['tech-lead', 'product-manager'],
      ['tech-lead', 'product-manager'],
    ]);
    for (const s of PDLC_STAGES) for (const r of s.reviews) expect(s.confirms[r]?.confirms, `${s.id} ${r}`).toBeTruthy();
  });

  it('seeds earlier stages approved by the role holders in order, PM last, and skips empty seats', () => {
    const run = runAt('risk-control-compliance');
    const ideation = run.stages['ideation-requirements'].reviews;
    expect(ideation.map((r) => [r.roleId, r.state, r.reviewerId])).toEqual([
      ['risk-lead', 'approved', 'p-risk'],
      ['ux-lead', 'approved', null],
      ['product-manager', 'approved', 'p-accept'],
    ]);
    expect(ideation[1]!.decisions).toEqual([]);
    expect(ideation[2]!.decisions[0]).toMatchObject({ roleId: 'product-manager', reviewerId: 'p-accept', decision: 'approved' });
    expect(run.stages['risk-control-compliance'].reviews.every((r) => r.state === 'not-requested')).toBe(true);
  });
});

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
    expect(check.reason).toBe(
      'Moving to Design & Specifications needs the In-Business Risk Lead to name the obligations that apply (not requested), the UX Design Lead to confirm the user context (not requested) and the Product Manager to approve the stage gate (not requested).',
    );
    expect(check.outstandingReviews).toEqual([
      { roleId: 'risk-lead', state: 'not-requested', reviewerId: 'p-risk' },
      { roleId: 'ux-lead', state: 'not-requested', reviewerId: null },
      { roleId: 'product-manager', state: 'not-requested', reviewerId: 'p-accept' },
    ]);
  });

  it('is allowed once the review is approved', () => {
    const check = canMoveForward(approveAll(runAt('ideation-requirements'), 'ideation-requirements'));
    expect(check).toMatchObject({ allowed: true, code: 'ok', to: 'design-specifications' });
  });

  it('needs every review of a stage: Delivery & Launch has two (Tech Lead, then the Product Manager gate)', () => {
    const run = runAt('delivery-launch');
    run.stages['delivery-launch'].reviews[0]!.state = 'approved';
    run.stages['delivery-launch'].reviews[1]!.state = 'pending';
    expect(outstandingReviews(run, 'delivery-launch')).toEqual([{ roleId: 'product-manager', state: 'pending', reviewerId: 'p-accept' }]);
    expect(canMoveForward(run).reason).toBe('Delivery & Launch is the last stage.');
    const atBuild = runAt('build-test-validate');
    atBuild.stages['build-test-validate'].reviews[0]!.state = 'returned';
    expect(canMoveForward(atBuild).reason).toContain('the Tech Lead to confirm the technical validation (returned)');
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
