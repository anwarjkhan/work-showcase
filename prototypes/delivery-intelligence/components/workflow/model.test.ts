/**
 * Drives the workflow-story deliverable from the first stage to ready by doing
 * only what the guided next step says, as the screen does (a review step
 * switches the persona to the role holder and then acts, in one click), and
 * checks the walk-through order: stories approved, the Core Four's
 * confirmations then the Product Manager's gate at each stage, work closed
 * (simulated) before the deliberate failed test, the move back, the passing
 * rerun, then acceptance.
 */
import { describe, expect, it } from 'vitest';
import { describeWorkflow } from '@/lib/agents/workflow';
import { PRESENTER_PERSON_ID as ME, WORKFLOW_DELIVERABLE_ID as TD } from '@/lib/config/story';
import type { CORE_ROLES } from '@/lib/config/pdlc';
import { terms } from '@/lib/config/terminology';
import { createDemoActions } from '@/lib/store/actions';
import { indexPortfolio } from '@/lib/store/indexes';
import { createDemoStore } from '@/lib/store/store';
import type { DemoState, EvidenceKind } from '@/lib/types';
import { buildHistory, deriveNextStep, type NextStep } from './model';

function nextFor(s: DemoState, id: string, walkthrough: boolean): NextStep | null {
  const idx = indexPortfolio(s.data);
  const view = describeWorkflow(s.data, s.results, id, s.actingAsPersonId)!;
  const outcomes = idx.outcomesByDeliverable.get(id) ?? [];
  return deriveNextStep({
    view,
    measures: s.results.deliverables[id]!,
    proposals: s.proposals.filter((p) => p.deliverableId === id),
    outcomes,
    criteriaByOutcome: idx.criteriaByOutcome,
    evidence: idx.evidenceByDeliverable.get(id) ?? [],
    actingAs: s.actingAsPersonId,
    personName: (p) => idx.people.get(p)?.name ?? p,
    walkthrough,
    playing: false,
  });
}

describe('guided next step', () => {
  it('walks the workflow-story deliverable to ready in the README order', () => {
    const store = createDemoStore();
    const a = createDemoActions(store);
    const s = () => store.getState();
    const labels: string[] = [];
    const work = () => {
      const m = s().results.deliverables[TD]!.workCompletion;
      return m.computable ? m.value.percent : -1;
    };
    let sawNotReady = false;
    let switches = 0;
    const gates: string[] = [];
    for (let i = 0; i < 80; i++) {
      const step = nextFor(s(), TD, true);
      expect(step).not.toBeNull();
      labels.push(step!.label);
      const t = step!.target;
      if (t === 'ready') break;
      // The highlighted control switches persona first when the step asks for another person, then acts.
      if (step!.actAs && step!.actAs !== s().actingAsPersonId) {
        a.setActingAs(step!.actAs);
        switches++;
      }
      const me = s().actingAsPersonId;
      let r: { ok: boolean; reason?: string };
      if (t === 'run-agent') r = a.runStageAgent(TD);
      else if (t.startsWith('approve-proposal:')) r = a.approveProposal(t.split(':')[1]!, me);
      else if (t.startsWith('approve-review:')) {
        const run = s().data.pdlcRuns.find((x) => x.deliverableId === TD)!;
        const role = t.split(':')[1] as (typeof CORE_ROLES)[number];
        if (role === 'product-manager') gates.push(run.currentStage);
        r = a.approveReview(TD, run.currentStage, role, me);
      } else if (t === 'simulate-work:half') r = a.simulateWorkClosed(TD, me, { share: 0.5 });
      else if (t === 'simulate-work:rest') r = a.simulateWorkClosed(TD, me);
      else if (t.startsWith('simulate:')) {
        const [, kind, result] = t.split(':');
        r = a.recordEvidence({ deliverableId: TD, kind: kind as EvidenceKind, result: result as 'pass' | 'fail', title: 'Filter regression suite', recordedById: me, simulated: true });
        if (result === 'fail') {
          expect(s().results.deliverables[TD]!.readiness.state).toBe('not-ready');
          sawNotReady = true;
        }
      } else if (t.startsWith('record:')) r = a.recordEvidence({ deliverableId: TD, kind: t.split(':')[1] as EvidenceKind, result: 'pass', title: 'Recorded', recordedById: me, simulated: false });
      else if (t.startsWith('record-acceptance:')) r = a.recordEvidence({ deliverableId: TD, kind: 'business-acceptance', result: 'pass', title: 'Accepted', outcomeId: t.split(':')[1]!, recordedById: me, simulated: false });
      else if (t.startsWith('accept-criterion:')) r = a.acceptCriterion(t.split(':')[1]!, me);
      else if (t === 'move-forward') r = a.moveStage(TD, 'forward', me);
      else if (t === 'move-back-offer') r = a.moveStage(TD, 'back', me, step!.detail ?? 'Failing evidence');
      else throw new Error(`unexpected target ${t}`);
      expect(r.ok, `${step!.label}: ${r.reason ?? ''}`).toBe(true);
    }
    expect(labels.at(-1)).toMatch(/^Ready/);
    expect(sawNotReady).toBe(true);
    const order = (re: RegExp) => labels.findIndex((l) => re.test(l));
    expect(order(/^Run the requirements structuring/)).toBe(0);
    expect(order(/^Approve the proposed stories/)).toBe(1);
    expect(order(/work closed: the first half/)).toBeLessThan(order(/test result: fail/));
    expect(order(/test result: fail/)).toBeLessThan(order(/^Move back to Risk/));
    expect(order(/^Move back/)).toBeLessThan(order(/rerun: pass/));
    expect(order(/rerun: pass/)).toBeLessThan(order(/criteria/));
    expect(order(/Record business acceptance/)).toBeGreaterThan(order(/^Record the release checklist/));
    const m = s().results.deliverables[TD]!;
    expect(work()).toBe(100);
    expect(m.acceptedOutcomes.computable && m.acceptedOutcomes.value.percent).toBe(100);
    expect(m.readiness.state).toBe('ready');
    expect(labels.length).toBeLessThan(60);
    // The Product Manager's gate closes every stage (stage 3 twice: the move back returns there), and the persona switched by itself.
    expect(new Set(gates).size).toBe(5);
    expect(switches).toBeGreaterThan(5);
    // Specialist confirmations always come before the gate in the same stage.
    const firstGate = labels.findIndex((l) => l.startsWith('Approve the gate as'));
    expect(labels.slice(0, firstGate).filter((l) => l.startsWith('Confirm as')).length).toBe(2);
    expect(labels[firstGate]).toBe(`Approve the gate as ${terms.coreRoles['product-manager']} (Anwar Khan)`);

    const history = buildHistory({ data: s().data, deliverableId: TD, run: s().data.pdlcRuns.find((x) => x.deliverableId === TD), audit: s().audit, proposals: s().proposals });
    expect(history.some((h) => h.kind === 'move-back' && h.detail)).toBe(true);
    expect(history.some((h) => h.kind === 'work' && h.provenance === 'simulated')).toBe(true);
  });

  it('derives the next step from the Core Four: the first open review, as its holder, one click', () => {
    const store = createDemoStore();
    const a = createDemoActions(store);
    a.runStageAgent(TD);
    const step = nextFor(store.getState(), TD, true);
    expect(step!.target).toMatch(/^approve-proposal:/);
    a.approveProposal(step!.target.split(':')[1]!, ME);
    const s = store.getState();
    const view = describeWorkflow(s.data, s.results, TD, s.actingAsPersonId)!;
    const first = view.nextReview!;
    const next = nextFor(s, TD, true)!;
    expect(next.target).toBe(`approve-review:${first.roleId}`);
    expect(next.label).toBe(first.label);
    expect(first.roleId).not.toBe('product-manager');
    // The presenter is the Product Manager, so a confirmation by another role holder needs a persona switch.
    expect(next.actAs).toBe(first.personId);
  });

  it('points at the Core Four gap when the seat of the next review is empty', () => {
    const store = createDemoStore();
    const s = store.getState();
    // Find a deliverable whose next review is blocked by an empty seat or a person in two seats.
    const blocked = s.data.deliverables.find((d) => describeWorkflow(s.data, s.results, d.id, s.actingAsPersonId)?.nextReview?.blocked);
    expect(blocked, 'the sample data has a deliverable whose next review is blocked by its Core Four').toBeDefined();
    const step = nextFor(s, blocked!.id, false);
    expect(step?.target).toBe('core-four-gap');
    expect(step?.tone).toBe('warn');
    expect(step?.detail).toBeTruthy();
  });
});
