/**
 * End to end: walks the workflow-story deliverable from the first stage to
 * `ready` through the store actions, including a failed test that sends it
 * back a stage and a passing rerun, asserting the three measures at each step.
 */
import { describe, expect, it } from 'vitest';
import { PRESENTER_PERSON_ID as ME, WORKFLOW_DELIVERABLE_ID as TD } from '@/lib/config/story';
import { createDemoActions } from '@/lib/store/actions';
import { createDemoStore } from '@/lib/store/store';
import type { ActionResult, DemoState, PdlcStageId } from '@/lib/types';
import { describeWorkflow } from './workflow';

function measures(s: DemoState) {
  const m = s.results.deliverables[TD]!;
  return {
    work: m.workCompletion.computable ? `${m.workCompletion.value.closedPoints}/${m.workCompletion.value.totalPoints}` : 'n/c',
    accepted: m.acceptedOutcomes.computable ? `${m.acceptedOutcomes.value.acceptedCount}/${m.acceptedOutcomes.value.totalCount}` : 'n/c',
    readiness: m.readiness.state,
  };
}

function must<T>(r: ActionResult<T>): T {
  if (!r.ok) throw new Error(r.reason);
  return r.value;
}

describe('PDLC workflow: the workflow-story deliverable from first stage to ready', () => {
  it('walks every stage with reviews, evidence, a failed test, a move back and a passing rerun', () => {
    const store = createDemoStore();
    const a = createDemoActions(store);
    const s = () => store.getState();
    const stage = () => s().data.pdlcRuns.find((r) => r.deliverableId === TD)!.currentStage;
    const deliverableStage = () => s().data.deliverables.find((d) => d.id === TD)!.pdlcStage;
    const expectStage = (id: PdlcStageId) => {
      expect(stage()).toBe(id);
      expect(deliverableStage()).toBe(id);
    };

    // --- Start: thin Epic, nothing accepted, readiness unknown.
    expectStage('ideation-requirements');
    expect(measures(s())).toEqual({ work: '0/8', accepted: '0/1', readiness: 'unknown' });
    const blockedForward = a.moveStage(TD, 'forward', ME);
    expect(blockedForward.ok).toBe(false);
    if (!blockedForward.ok) expect(blockedForward.reason).toMatch(/needs the requirements owner review/);

    // --- 1. Ideation & Requirements: agent drafts stories; a named person approves them.
    const run1 = must(a.runStageAgent(TD));
    const draftProposal = s().proposals.find((p) => p.runId === run1.runId)!;
    expect(draftProposal.status).toBe('pending');
    expect(s().drafts.at(-1)?.kind).toBe('requirements');
    must(a.approveProposal(draftProposal.id, ME));
    const added = draftProposal.patch.op === 'add-work-items' ? draftProposal.patch.items.reduce((n, w) => n + (w.points ?? 0), 0) : 0;
    expect(measures(s())).toEqual({ work: `0/${8 + added}`, accepted: '0/1', readiness: 'unknown' });
    must(a.approveReview(TD, 'ideation-requirements', 'requirements-owner', ME));
    must(a.recordEvidence({ deliverableId: TD, kind: 'requirements-sign-off', result: 'pass', title: 'Requirements signed off', recordedById: ME, simulated: false }));
    expect(measures(s()).readiness).toBe('unknown');
    expect(must(a.moveStage(TD, 'forward', ME)).to).toBe('design-specifications');
    expectStage('design-specifications');

    // --- 2. Design & Specifications: outcome mapping auto-applies under T1.
    const run2 = must(a.runStageAgent(TD));
    expect(s().proposals.filter((p) => p.runId === run2.runId).map((p) => p.status)).toEqual(['auto-applied']);
    expect(s().data.workItems.find((w) => w.key === 'LIM-13')?.outcomeId).toBe('oc-2001-1');
    must(a.approveReview(TD, 'design-specifications', 'design-reviewer', ME));
    must(a.moveStage(TD, 'forward', ME));
    expectStage('risk-control-compliance');

    // --- 3. Risk, Control & Compliance.
    must(a.runStageAgent(TD));
    must(a.approveReview(TD, 'risk-control-compliance', 'control-owner', ME));
    must(a.moveStage(TD, 'forward', ME));
    expectStage('build-test-validate');

    // --- 4. Build, Test & Validate: the simulated test fails.
    must(a.runStageAgent(TD));
    const failId = must(a.recordEvidence({ deliverableId: TD, kind: 'test-result', result: 'fail', title: 'Filter regression suite', recordedById: ME, simulated: true })).evidenceId;
    expect(s().data.evidence.find((e) => e.id === failId)?.provenance).toBe('simulated');
    expect(measures(s())).toEqual({ work: `0/${8 + added}`, accepted: '0/1', readiness: 'not-ready' });
    const validatorRefused = a.approveReview(TD, 'build-test-validate', 'independent-validator', ME);
    expect(validatorRefused.ok).toBe(false);
    if (!validatorRefused.ok) expect(validatorRefused.reason).toMatch(/failing/);
    const view = describeWorkflow(s().data, s().results, TD)!;
    expect(view.backSuggestion.offer).toBe(true);
    expect(view.backSuggestion.to).toBe('risk-control-compliance');
    expect(a.moveStage(TD, 'back', ME).ok).toBe(false); // a reason is required
    must(a.moveStage(TD, 'back', ME, 'Filter regression suite failed; control mapping must cover the saved-default behaviour.'));
    expectStage('risk-control-compliance');
    expect(s().data.pdlcRuns.find((r) => r.deliverableId === TD)!.moves.at(-1)).toMatchObject({ direction: 'back', reason: expect.stringMatching(/failed/) });
    expect(measures(s()).readiness).toBe('not-ready');

    // Rework: the control review is needed again, then forward.
    expect(a.moveStage(TD, 'forward', ME).ok).toBe(false);
    must(a.approveReview(TD, 'risk-control-compliance', 'control-owner', ME));
    must(a.moveStage(TD, 'forward', ME));
    expectStage('build-test-validate');

    // Passing rerun clears the failure; readiness is still unknown (acceptance and checklist missing).
    must(a.recordEvidence({ deliverableId: TD, kind: 'test-result', result: 'pass', title: 'Filter regression suite (rerun)', recordedById: ME, simulated: true }));
    expect(measures(s())).toEqual({ work: `0/${8 + added}`, accepted: '0/1', readiness: 'unknown' });
    expect(describeWorkflow(s().data, s().results, TD)!.backSuggestion.offer).toBe(false);
    must(a.approveReview(TD, 'build-test-validate', 'independent-validator', ME));
    must(a.moveStage(TD, 'forward', ME));
    expectStage('delivery-launch');

    // --- 5. Delivery & Launch: acceptance, then the release checklist.
    must(a.runStageAgent(TD));
    const early = a.recordEvidence({ deliverableId: TD, kind: 'business-acceptance', result: 'pass', title: 'Desk heads accept the filters', outcomeId: 'oc-2001-1', recordedById: ME, simulated: false });
    expect(early.ok).toBe(false); // criteria first
    must(a.acceptCriterion('ac-oc-2001-1-1', ME));
    must(a.acceptCriterion('ac-oc-2001-1-2', ME));
    expect(measures(s()).accepted).toBe('0/1'); // criteria alone do not accept the outcome
    must(a.recordEvidence({ deliverableId: TD, kind: 'business-acceptance', result: 'pass', title: 'Desk heads accept the filters', outcomeId: 'oc-2001-1', recordedById: ME, simulated: false }));
    expect(measures(s())).toEqual({ work: `0/${8 + added}`, accepted: '1/1', readiness: 'unknown' });
    must(a.approveReview(TD, 'delivery-launch', 'business-owner', ME));
    must(a.recordEvidence({ deliverableId: TD, kind: 'release-checklist', result: 'pass', title: 'Release checklist complete', recordedById: ME, simulated: false }));
    must(a.approveReview(TD, 'delivery-launch', 'release-owner', ME));

    // Ready. Work completion stays independent of readiness and acceptance.
    expect(measures(s())).toEqual({ work: `0/${8 + added}`, accepted: '1/1', readiness: 'ready' });
    const last = a.moveStage(TD, 'forward', ME);
    expect(last.ok).toBe(false);
    expectStage('delivery-launch');
    expect(s().data.pdlcRuns.find((r) => r.deliverableId === TD)!.stages['delivery-launch'].status).toBe('approved');

    // Every step is on the audit trail; reported RAG never moved.
    const log = s().audit.map((e) => e.action);
    for (const action of ['pdlc.stage-agent-run', 'pdlc.review-approved', 'pdlc.moved-forward', 'pdlc.moved-back', 'evidence.recorded', 'evidence.simulated', 'criterion.accepted', 'proposal.approved', 'proposal.auto-applied'] as const) {
      expect(log).toContain(action);
    }
    expect(s().audit.map((e) => e.seq)).toEqual(s().audit.map((_, i) => i + 1));
    expect(s().data.deliverables.find((d) => d.id === TD)!.reportedRag).toBe(s().seed.deliverables.find((d) => d.id === TD)!.reportedRag);
  });

  it('returning a review records the reason and moves the deliverable back', () => {
    const store = createDemoStore();
    const a = createDemoActions(store);
    must(a.approveReview(TD, 'ideation-requirements', 'requirements-owner', ME));
    must(a.moveStage(TD, 'forward', ME));
    expect(a.returnReview(TD, 'design-specifications', 'design-reviewer', ME, '').ok).toBe(false);
    must(a.returnReview(TD, 'design-specifications', 'design-reviewer', ME, 'Outcome map misses the saved default.'));
    const run = store.getState().data.pdlcRuns.find((r) => r.deliverableId === TD)!;
    expect(run.currentStage).toBe('ideation-requirements');
    expect(run.stages['design-specifications'].reviews[0]?.decisions.at(-1)).toMatchObject({ decision: 'returned', reason: 'Outcome map misses the saved default.' });
    expect(run.moves.at(-1)?.reason).toMatch(/Outcome map misses/);
    const actions = store.getState().audit.map((e) => e.action);
    expect(actions).toContain('pdlc.review-returned');
    expect(actions.at(-1)).toBe('pdlc.moved-back');
  });

  it('only the named reviewer can decide a review, and only for the current stage', () => {
    const store = createDemoStore();
    const a = createDemoActions(store);
    const wrong = a.approveReview(TD, 'ideation-requirements', 'requirements-owner', 'p-owner-1');
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.reason).toMatch(/assigned to/);
    expect(a.approveReview(TD, 'design-specifications', 'design-reviewer', ME).ok).toBe(false);
    expect(a.runStageAgent(TD, 'build-test-validate').ok).toBe(false);
  });
});
