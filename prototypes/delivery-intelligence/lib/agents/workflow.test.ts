/**
 * End to end: walks the workflow-story deliverable from the first stage to
 * `ready` through the store actions, acting as each Core Four role holder in
 * turn (specialist confirmations first, then the Product Manager's gate),
 * including a failed test that sends it back a stage and a passing rerun,
 * asserting the three measures at each step.
 */
import { describe, expect, it } from 'vitest';
import { stageDefinition } from '@/lib/config/pdlc';
import { PRESENTER_PERSON_ID as ME, WORKFLOW_DELIVERABLE_ID as TD } from '@/lib/config/story';
import { createDemoActions } from '@/lib/store/actions';
import { createDemoStore } from '@/lib/store/store';
import type { ActionResult, CoreRole, DemoState, PdlcStageId } from '@/lib/types';
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

function setup() {
  const store = createDemoStore();
  const a = createDemoActions(store);
  const s = () => store.getState();
  const holder = (role: CoreRole) => s().data.deliverables.find((d) => d.id === TD)!.coreTeam[role]!.personId;
  const nameOf = (id: string) => s().data.people.find((p) => p.id === id)!.name;
  const view = () => describeWorkflow(s().data, s().results, TD, s().actingAsPersonId)!;
  /** Follows the workflow's next review step: switch persona when it says so, then decide as that person. */
  const decideNext = (label: string) => {
    const step = view().nextReview!;
    expect(step.label).toBe(label);
    expect(step.blocked).toBeNull();
    if (step.needsActAs) a.setActingAs(step.personId!);
    expect(view().nextReview!.needsActAs).toBe(false);
    must(a.approveReview(TD, step.stageId, step.roleId, s().actingAsPersonId));
  };
  /** Approves every review of the current stage by its holder, in order. */
  const approveStage = (stage: PdlcStageId) => {
    for (const role of stageDefinition(stage).reviews) must(a.approveReview(TD, stage, role, holder(role)));
  };
  return { store, a, s, holder, nameOf, view, decideNext, approveStage };
}

describe('PDLC workflow: the workflow-story deliverable from first stage to ready', () => {
  it('walks every stage with Core Four reviews, evidence, a failed test, a move back and a passing rerun', () => {
    const { a, s, holder, nameOf, view, decideNext } = setup();
    const stage = () => s().data.pdlcRuns.find((r) => r.deliverableId === TD)!.currentStage;
    const deliverableStage = () => s().data.deliverables.find((d) => d.id === TD)!.pdlcStage;
    const expectStage = (id: PdlcStageId) => {
      expect(stage()).toBe(id);
      expect(deliverableStage()).toBe(id);
    };
    const PM = holder('product-manager');
    const TL = holder('tech-lead');
    const RL = holder('risk-lead');
    const UX = holder('ux-lead');
    expect(PM).toBe(ME);
    expect(new Set([PM, TL, RL, UX]).size).toBe(4);
    const as = (role: string, id: string) => `${role} (${nameOf(id)})`;

    // --- Start: thin Epic, nothing accepted, readiness unknown.
    expectStage('ideation-requirements');
    expect(measures(s())).toEqual({ work: '0/8', accepted: '0/1', readiness: 'unknown' });
    const blockedForward = a.moveStage(TD, 'forward', ME);
    expect(blockedForward.ok).toBe(false);
    if (!blockedForward.ok) expect(blockedForward.reason).toMatch(/needs the In-Business Risk Lead to name the obligations that apply/);
    const tooEarly = a.simulateWorkClosed(TD, ME);
    expect(tooEarly.ok).toBe(false);
    if (!tooEarly.ok) expect(tooEarly.reason).toMatch(/only from Build, Test & Validate onwards/);

    // The workflow view names every review's holder and what they confirm.
    const first = view().stages[0]!;
    expect(first.reviews.map((r) => [r.roleLabel, r.personName, r.confirms])).toEqual([
      ['In-Business Risk Lead', nameOf(RL), 'name the obligations that apply'],
      ['UX Design Lead', nameOf(UX), 'confirm the user context'],
      ['Product Manager', nameOf(PM), 'approve the stage gate'],
    ]);
    expect(view().coreTeam.map((c) => [c.roleId, c.personId])).toEqual([
      ['product-manager', PM],
      ['tech-lead', TL],
      ['risk-lead', RL],
      ['ux-lead', UX],
    ]);
    expect(view().coreTeamGaps).toEqual({ missing: [], shared: [] });

    // --- 1. Ideation & Requirements: agent drafts stories; a named person approves them.
    const run1 = must(a.runStageAgent(TD));
    const draftProposal = s().proposals.find((p) => p.runId === run1.runId)!;
    expect(draftProposal.status).toBe('pending');
    expect(s().drafts.at(-1)?.kind).toBe('requirements');
    must(a.approveProposal(draftProposal.id, ME));
    const added = draftProposal.patch.op === 'add-work-items' ? draftProposal.patch.items.reduce((n, w) => n + (w.points ?? 0), 0) : 0;
    expect(measures(s())).toEqual({ work: `0/${8 + added}`, accepted: '0/1', readiness: 'unknown' });

    // The Product Manager cannot approve the gate while confirmations are outstanding.
    const early = a.approveReview(TD, 'ideation-requirements', 'product-manager', PM);
    expect(early).toEqual({
      ok: false,
      reason: `Waiting on the In-Business Risk Lead (${nameOf(RL)}) to name the obligations that apply and the UX Design Lead (${nameOf(UX)}) to confirm the user context.`,
    });
    // A non-holder cannot confirm; an agent cannot decide.
    const notHolder = a.approveReview(TD, 'ideation-requirements', 'risk-lead', PM);
    expect(notHolder).toEqual({ ok: false, reason: `Only the In-Business Risk Lead of TD-2001, ${nameOf(RL)}, can confirm this review; ${nameOf(PM)} cannot.` });
    const agent = s().data.agentIdentities[0]!.id;
    const byAgent = a.approveReview(TD, 'ideation-requirements', 'risk-lead', agent);
    expect(byAgent.ok).toBe(false);
    if (!byAgent.ok) expect(byAgent.reason).toMatch(/^Agents cannot/);
    expect(s().audit.slice(-3).map((e) => [e.action, e.details.code])).toEqual([
      ['governance.blocked', 'review-out-of-order'],
      ['governance.blocked', 'not-role-holder'],
      ['governance.blocked', 'agent-actor'],
    ]);
    // The presenter (the PM) may decide nothing yet; the next step switches persona to the risk lead.
    expect(view().stages[0]!.reviews.map((r) => r.canDecide)).toEqual([false, false, false]);
    expect(view().nextReview).toMatchObject({ kind: 'confirm', roleId: 'risk-lead', personId: RL, needsActAs: true, label: `Confirm as ${as('In-Business Risk Lead', RL)}` });

    decideNext(`Confirm as ${as('In-Business Risk Lead', RL)}`);
    expect(s().actingAsPersonId).toBe(RL);
    decideNext(`Confirm as ${as('UX Design Lead', UX)}`);
    expect(a.moveStage(TD, 'forward', PM).ok).toBe(false); // the gate is not approved yet
    decideNext(`Approve the gate as ${as('Product Manager', PM)}`);
    expect(s().actingAsPersonId).toBe(PM);
    expect(view().nextReview).toBeNull();
    must(a.recordEvidence({ deliverableId: TD, kind: 'requirements-sign-off', result: 'pass', title: 'Requirements signed off', recordedById: PM, simulated: false }));
    expect(measures(s()).readiness).toBe('unknown');
    expect(must(a.moveStage(TD, 'forward', PM)).to).toBe('design-specifications');
    expectStage('design-specifications');

    // --- 2. Design & Specifications: outcome mapping auto-applies under T1.
    const run2 = must(a.runStageAgent(TD));
    expect(s().proposals.filter((p) => p.runId === run2.runId).map((p) => p.status)).toEqual(['auto-applied']);
    expect(s().data.workItems.find((w) => w.key === 'LIM-13')?.outcomeId).toBe('oc-2001-1');
    decideNext(`Confirm as ${as('Tech Lead', TL)}`);
    decideNext(`Confirm as ${as('UX Design Lead', UX)}`);
    decideNext(`Approve the gate as ${as('Product Manager', PM)}`);
    must(a.moveStage(TD, 'forward', PM));
    expectStage('risk-control-compliance');
    expect(measures(s())).toEqual({ work: `0/${8 + added}`, accepted: '0/1', readiness: 'unknown' });

    // --- 3. Risk, Control & Compliance: the risk lead confirms risk and controls, then the gate.
    must(a.runStageAgent(TD, undefined, PM));
    const pmTooEarly = a.approveReview(TD, 'risk-control-compliance', 'product-manager', PM);
    expect(pmTooEarly).toEqual({ ok: false, reason: `Waiting on the In-Business Risk Lead (${nameOf(RL)}) to confirm risk and controls.` });
    decideNext(`Confirm as ${as('In-Business Risk Lead', RL)}`);
    decideNext(`Approve the gate as ${as('Product Manager', PM)}`);
    must(a.moveStage(TD, 'forward', PM));
    expectStage('build-test-validate');
    expect(measures(s())).toEqual({ work: `0/${8 + added}`, accepted: '0/1', readiness: 'unknown' });

    // --- 4. Build, Test & Validate: work is closed (simulated, in two clicks), then the simulated test fails.
    must(a.runStageAgent(TD, undefined, PM));
    const T = 8 + added;
    const buildStep = view().stages.find((x) => x.definition.id === 'build-test-validate')!.simulatedSteps[0]!;
    expect(buildStep).toMatchObject({ id: 'simulate-work-closed', enabled: true });
    expect(a.simulateWorkClosed(TD, agent).ok).toBe(false); // never an agent
    const half = must(a.simulateWorkClosed(TD, TL, { share: 0.5 }));
    expect(half.closedKeys.length).toBeGreaterThan(0);
    const mid = measures(s());
    const midClosed = Number(mid.work.split('/')[0]);
    expect(midClosed).toBeGreaterThan(0);
    expect(midClosed).toBeLessThan(T);
    expect(mid).toEqual({ work: `${midClosed}/${T}`, accepted: '0/1', readiness: 'unknown' });
    expect(s().audit.at(-1)).toMatchObject({ action: 'evidence.simulated', details: { simulated: true, simulation: 'work-closed' } });
    must(a.simulateWorkClosed(TD, TL));
    expect(measures(s())).toEqual({ work: `${T}/${T}`, accepted: '0/1', readiness: 'unknown' });
    expect(s().data.workItems.filter((w) => w.epicKey === 'LIM-10' || w.parentKey === 'LIM-10').every((w) => w.statusCategory === 'done' && w.resolved !== null)).toBe(true);
    const nothingLeft = a.simulateWorkClosed(TD, TL);
    expect(nothingLeft.ok).toBe(false);
    if (!nothingLeft.ok) expect(nothingLeft.reason).toMatch(/already closed/);
    expect(view().stages.find((x) => x.current)!.reviews[0]!.evidenceBefore).toBe('test-result');
    const failId = must(a.recordEvidence({ deliverableId: TD, kind: 'test-result', result: 'fail', title: 'Filter regression suite', recordedById: TL, simulated: true })).evidenceId;
    expect(s().data.evidence.find((e) => e.id === failId)?.provenance).toBe('simulated');
    expect(measures(s())).toEqual({ work: `${T}/${T}`, accepted: '0/1', readiness: 'not-ready' });
    const validationRefused = a.approveReview(TD, 'build-test-validate', 'tech-lead', TL);
    expect(validationRefused.ok).toBe(false);
    if (!validationRefused.ok) expect(validationRefused.reason).toMatch(/failing/);
    const failed = view();
    expect(failed.backSuggestion.offer).toBe(true);
    expect(failed.backSuggestion.to).toBe('risk-control-compliance');
    expect(a.moveStage(TD, 'back', TL).ok).toBe(false); // a reason is required
    must(a.moveStage(TD, 'back', TL, 'Filter regression suite failed; control mapping must cover the saved-default behaviour.'));
    expectStage('risk-control-compliance');
    expect(s().data.pdlcRuns.find((r) => r.deliverableId === TD)!.moves.at(-1)).toMatchObject({ direction: 'back', reason: expect.stringMatching(/failed/), by: { kind: 'human', personId: TL } });
    expect(measures(s()).readiness).toBe('not-ready');

    // Rework: the risk lead confirms again, then the PM approves the gate, then forward.
    expect(a.moveStage(TD, 'forward', PM).ok).toBe(false);
    decideNext(`Confirm as ${as('In-Business Risk Lead', RL)}`);
    decideNext(`Approve the gate as ${as('Product Manager', PM)}`);
    must(a.moveStage(TD, 'forward', PM));
    expectStage('build-test-validate');
    expect(measures(s())).toEqual({ work: `${T}/${T}`, accepted: '0/1', readiness: 'not-ready' });

    // Passing rerun clears the failure; readiness is still unknown (acceptance and checklist missing).
    must(a.recordEvidence({ deliverableId: TD, kind: 'test-result', result: 'pass', title: 'Filter regression suite (rerun)', recordedById: TL, simulated: true }));
    expect(measures(s())).toEqual({ work: `${T}/${T}`, accepted: '0/1', readiness: 'unknown' });
    expect(view().backSuggestion.offer).toBe(false);
    decideNext(`Confirm as ${as('Tech Lead', TL)}`);
    decideNext(`Approve the gate as ${as('Product Manager', PM)}`);
    must(a.moveStage(TD, 'forward', PM));
    expectStage('delivery-launch');
    expect(measures(s())).toEqual({ work: `${T}/${T}`, accepted: '0/1', readiness: 'unknown' });

    // --- 5. Delivery & Launch: business acceptance by the PM, the release checklist, then the reviews.
    must(a.runStageAgent(TD, undefined, PM));
    const tooSoon = a.recordEvidence({ deliverableId: TD, kind: 'business-acceptance', result: 'pass', title: 'Desk heads accept the filters', outcomeId: 'oc-2001-1', recordedById: PM, simulated: false });
    expect(tooSoon.ok).toBe(false); // criteria first
    expect(a.acceptCriterion('ac-oc-2001-1-1', TL).ok).toBe(false); // business acceptance is the PM's
    must(a.acceptCriterion('ac-oc-2001-1-1', PM));
    must(a.acceptCriterion('ac-oc-2001-1-2', PM));
    expect(measures(s()).accepted).toBe('0/1'); // criteria alone do not accept the outcome
    must(a.recordEvidence({ deliverableId: TD, kind: 'business-acceptance', result: 'pass', title: 'Desk heads accept the filters', outcomeId: 'oc-2001-1', recordedById: PM, simulated: false }));
    expect(measures(s())).toEqual({ work: `${T}/${T}`, accepted: '1/1', readiness: 'unknown' });
    must(a.recordEvidence({ deliverableId: TD, kind: 'release-checklist', result: 'pass', title: 'Release checklist complete', recordedById: TL, simulated: false }));
    expect(measures(s())).toEqual({ work: `${T}/${T}`, accepted: '1/1', readiness: 'ready' });
    expect(a.approveReview(TD, 'delivery-launch', 'product-manager', PM)).toEqual({ ok: false, reason: `Waiting on the Tech Lead (${nameOf(TL)}) to confirm the release checklist.` });
    decideNext(`Confirm as ${as('Tech Lead', TL)}`);
    decideNext(`Approve the gate as ${as('Product Manager', PM)}`);

    // Ready: 100% of work closed, every outcome accepted, readiness ready.
    expect(measures(s())).toEqual({ work: `${T}/${T}`, accepted: '1/1', readiness: 'ready' });
    const final = s().results.deliverables[TD]!;
    expect(final.workCompletion.computable && final.workCompletion.value.percent).toBe(100);
    expect(final.acceptedOutcomes.computable && final.acceptedOutcomes.value.percent).toBe(100);
    const last = a.moveStage(TD, 'forward', PM);
    expect(last.ok).toBe(false);
    expectStage('delivery-launch');
    const finalRun = s().data.pdlcRuns.find((r) => r.deliverableId === TD)!;
    expect(finalRun.stages['delivery-launch'].status).toBe('approved');
    // Every stage's last decision is the Product Manager's gate approval.
    for (const st of Object.values(finalRun.stages)) {
      const decisions = st.reviews.flatMap((r) => r.decisions).sort((x, y) => x.decidedAt.localeCompare(y.decidedAt));
      expect(decisions.at(-1)).toMatchObject({ roleId: 'product-manager', reviewerId: PM, decision: 'approved' });
    }

    // Every step is on the audit trail; reported RAG never moved.
    const log = s().audit.map((e) => e.action);
    for (const action of ['pdlc.stage-agent-run', 'pdlc.review-approved', 'pdlc.moved-forward', 'pdlc.moved-back', 'evidence.recorded', 'evidence.simulated', 'criterion.accepted', 'proposal.approved', 'proposal.auto-applied', 'governance.blocked'] as const) {
      expect(log).toContain(action);
    }
    expect(s().audit.some((e) => e.details.simulation === 'work-closed')).toBe(true);
    expect(s().audit.map((e) => e.seq)).toEqual(s().audit.map((_, i) => i + 1));
    expect(s().data.deliverables.find((d) => d.id === TD)!.reportedRag).toBe(s().seed.deliverables.find((d) => d.id === TD)!.reportedRag);
  });

  it('returning a review records the reason and moves the deliverable back', () => {
    const { store, a, holder, approveStage } = setup();
    approveStage('ideation-requirements');
    must(a.moveStage(TD, 'forward', ME));
    const TL = holder('tech-lead');
    expect(a.returnReview(TD, 'design-specifications', 'tech-lead', TL, '').ok).toBe(false);
    expect(a.returnReview(TD, 'design-specifications', 'tech-lead', ME, 'Not mine to return.').ok).toBe(false);
    must(a.returnReview(TD, 'design-specifications', 'tech-lead', TL, 'Outcome map misses the saved default.'));
    const run = store.getState().data.pdlcRuns.find((r) => r.deliverableId === TD)!;
    expect(run.currentStage).toBe('ideation-requirements');
    expect(run.stages['design-specifications'].reviews[0]?.decisions.at(-1)).toMatchObject({ roleId: 'tech-lead', decision: 'returned', reviewerId: TL, reason: 'Outcome map misses the saved default.' });
    expect(run.moves.at(-1)?.reason).toMatch(/Returned by the Tech Lead .*Outcome map misses/);
    const actions = store.getState().audit.map((e) => e.action);
    expect(actions).toContain('pdlc.review-returned');
    expect(actions.at(-1)).toBe('pdlc.moved-back');
    // Coming back, the first stage's reviews are needed again, in order.
    expect(run.stages['ideation-requirements'].reviews.map((r) => r.state)).toEqual(['pending', 'pending', 'pending']);
  });

  it('closing work after evidence was recorded makes that evidence stale, by the engine rule', () => {
    const { store, a, approveStage } = setup();
    for (const stage of ['ideation-requirements', 'design-specifications', 'risk-control-compliance'] as const) {
      approveStage(stage);
      must(a.moveStage(TD, 'forward', ME));
    }
    must(a.recordEvidence({ deliverableId: TD, kind: 'test-result', result: 'pass', title: 'Desk filter test', workItemKey: 'LIM-11', recordedById: ME, simulated: true }));
    expect(store.getState().results.deliverables[TD]!.readiness.held.find((h) => h.kind === 'test-result')?.state).toBe('passing');
    must(a.simulateWorkClosed(TD, ME));
    expect(store.getState().results.deliverables[TD]!.readiness.held.find((h) => h.kind === 'test-result')?.state).toBe('stale');
  });

  it('only the role holder can decide a review, and only for the current stage', () => {
    const { a, holder } = setup();
    const wrong = a.approveReview(TD, 'ideation-requirements', 'risk-lead', 'p-owner-1');
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.reason).toMatch(/^Only the In-Business Risk Lead of TD-2001, .+, can confirm this review; Priya Raman cannot\.$/);
    expect(a.approveReview(TD, 'design-specifications', 'tech-lead', holder('tech-lead')).ok).toBe(false);
    expect(a.runStageAgent(TD, 'build-test-validate').ok).toBe(false);
  });
});
