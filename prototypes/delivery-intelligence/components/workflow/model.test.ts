/**
 * Drives the workflow-story deliverable from the first stage to ready by doing
 * only what the guided next step says, as the screen does, and checks the
 * walk-through order: stories approved, work closed (simulated) before the
 * deliberate failed test, the move back, the passing rerun, then acceptance.
 */
import { describe, expect, it } from 'vitest';
import { describeWorkflow } from '@/lib/agents/workflow';
import { HERO_DELIVERABLE_ID, PRESENTER_PERSON_ID as ME, WORKFLOW_DELIVERABLE_ID as TD } from '@/lib/config/story';
import { createDemoActions } from '@/lib/store/actions';
import { indexPortfolio } from '@/lib/store/indexes';
import { createDemoStore } from '@/lib/store/store';
import type { DemoState, EvidenceKind } from '@/lib/types';
import { buildHistory, deriveNextStep, type NextStep } from './model';

function nextFor(s: DemoState, id: string, walkthrough: boolean): NextStep | null {
  const idx = indexPortfolio(s.data);
  const view = describeWorkflow(s.data, s.results, id)!;
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
    for (let i = 0; i < 60; i++) {
      const step = nextFor(s(), TD, true);
      expect(step).not.toBeNull();
      labels.push(step!.label);
      const t = step!.target;
      if (t === 'ready') break;
      let r: { ok: boolean; reason?: string };
      if (t === 'run-agent') r = a.runStageAgent(TD);
      else if (t.startsWith('approve-proposal:')) r = a.approveProposal(t.split(':')[1]!, ME);
      else if (t.startsWith('approve-review:')) {
        const run = s().data.pdlcRuns.find((x) => x.deliverableId === TD)!;
        r = a.approveReview(TD, run.currentStage, t.split(':')[1] as never, ME);
      } else if (t === 'simulate-work:half') r = a.simulateWorkClosed(TD, ME, { share: 0.5 });
      else if (t === 'simulate-work:rest') r = a.simulateWorkClosed(TD, ME);
      else if (t.startsWith('simulate:')) {
        const [, kind, result] = t.split(':');
        r = a.recordEvidence({ deliverableId: TD, kind: kind as EvidenceKind, result: result as 'pass' | 'fail', title: 'Filter regression suite', recordedById: ME, simulated: true });
        if (result === 'fail') {
          expect(s().results.deliverables[TD]!.readiness.state).toBe('not-ready');
          sawNotReady = true;
        }
      } else if (t.startsWith('record:')) r = a.recordEvidence({ deliverableId: TD, kind: t.split(':')[1] as EvidenceKind, result: 'pass', title: 'Recorded', recordedById: ME, simulated: false });
      else if (t.startsWith('record-acceptance:')) r = a.recordEvidence({ deliverableId: TD, kind: 'business-acceptance', result: 'pass', title: 'Accepted', outcomeId: t.split(':')[1]!, recordedById: ME, simulated: false });
      else if (t.startsWith('accept-criterion:')) r = a.acceptCriterion(t.split(':')[1]!, ME);
      else if (t === 'move-forward') r = a.moveStage(TD, 'forward', ME);
      else if (t === 'move-back-offer') r = a.moveStage(TD, 'back', ME, step!.detail ?? 'Failing evidence');
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
    expect(order(/business acceptance/)).toBeLessThan(order(/release checklist/));
    const m = s().results.deliverables[TD]!;
    expect(work()).toBe(100);
    expect(m.acceptedOutcomes.computable && m.acceptedOutcomes.value.percent).toBe(100);
    expect(m.readiness.state).toBe('ready');
    expect(labels.length).toBeLessThan(35);

    const history = buildHistory({ data: s().data, deliverableId: TD, run: s().data.pdlcRuns.find((x) => x.deliverableId === TD), audit: s().audit, proposals: s().proposals });
    expect(history.some((h) => h.kind === 'move-back' && h.detail)).toBe(true);
    expect(history.some((h) => h.kind === 'work' && h.provenance === 'simulated')).toBe(true);
  });

  it('asks the presenter to act as the named reviewer when someone else is acting', () => {
    const store = createDemoStore();
    const a = createDemoActions(store);
    a.runStageAgent(HERO_DELIVERABLE_ID);
    const step = nextFor(store.getState(), HERO_DELIVERABLE_ID, false);
    expect(step).not.toBeNull();
  });
});
