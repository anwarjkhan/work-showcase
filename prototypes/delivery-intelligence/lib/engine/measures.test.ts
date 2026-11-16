import { describe, expect, it } from 'vitest';
import type { Computable } from '@/lib/types';
import { computeAll } from './index';
import { CLOCK, baseline, change, criterion, dependency, deliverable, epic, evidence, openStory, outcome, story } from './test-fixtures';

function value<T>(m: Computable<T>): T {
  if (!m.computable) throw new Error(`expected computable, got ${m.reason}: ${m.detail}`);
  return m.value;
}

describe('baseline fixture', () => {
  it('computes clean: 100% work, all outcomes accepted, ready, Green, no findings', () => {
    const r = computeAll(baseline(), CLOCK);
    const m = r.deliverables['td-1']!;
    expect(value(m.workCompletion).percent).toBe(100);
    expect(value(m.acceptedOutcomes).acceptedCount).toBe(2);
    expect(m.readiness.state).toBe('ready');
    expect(r.deliverableRag['td-1']!.evidence).toBe('green');
    expect(r.findings).toEqual([]);
  });
});

describe('work completion', () => {
  it('sums closed and total points across all Epics of a deliverable', () => {
    const data = change(baseline(), (d) => {
      d.workItems.push(openStory('S-4', 'E-1', 'oc-1', { points: 8 }), openStory('S-5', 'E-2', 'oc-2', { points: 2 }));
    });
    const wc = value(computeAll(data, CLOCK).deliverables['td-1']!.workCompletion);
    expect(wc.closedPoints).toBe(10); // 5 (E-1) + 3 + 2 (E-2)
    expect(wc.totalPoints).toBe(20);
    expect(wc.percent).toBe(50);
    expect(wc.epicKeys).toEqual(['E-1', 'E-2']);
    expect(wc.itemCount).toBe(5);
    expect(wc.closedItemCount).toBe(3);
  });

  it('includes an Epic that carries the Deliverable ID even if the book of record does not list it', () => {
    const data = change(baseline(), (d) => {
      d.workItems.push(epic('E-3', 'td-1'), story('S-6', 'E-3', 'oc-2', { points: 4 }));
    });
    const wc = value(computeAll(data, CLOCK).deliverables['td-1']!.workCompletion);
    expect(wc.epicKeys).toEqual(['E-1', 'E-2', 'E-3']);
    expect(wc.totalPoints).toBe(14);
  });

  it('counts sub-tasks under neither the ratio nor the item count (stories carry the points)', () => {
    const data = change(baseline(), (d) => {
      d.workItems.push({ ...openStory('ST-1', 'E-1', null, { points: 50 }), type: 'sub-task', parentKey: 'S-1' });
    });
    expect(value(computeAll(data, CLOCK).deliverables['td-1']!.workCompletion).totalPoints).toBe(10);
  });

  it('excludes unestimated items from the ratio and counts them separately', () => {
    const data = change(baseline(), (d) => {
      d.workItems.push(openStory('S-4', 'E-1', 'oc-1', { points: null }));
    });
    const wc = value(computeAll(data, CLOCK).deliverables['td-1']!.workCompletion);
    expect(wc.percent).toBe(100);
    expect(wc.unestimatedItemCount).toBe(1);
  });

  it('computes per outcome across the Epics its items sit under', () => {
    const data = change(baseline(), (d) => {
      d.workItems.push(openStory('S-4', 'E-2', 'oc-1', { points: 10 }));
    });
    const om = computeAll(data, CLOCK).outcomes['oc-1']!;
    expect(om.epicKeys).toEqual(['E-1', 'E-2']);
    expect(om.workItemKeys.sort()).toEqual(['S-1', 'S-2', 'S-4']);
    expect(value(om.workCompletion)).toMatchObject({ closedPoints: 8, totalPoints: 18 });
  });

  it('accepts an Outcome ID given as the outcome ref', () => {
    const data = change(baseline(), (d) => {
      d.workItems.push(openStory('S-4', 'E-2', 'OC-2', { points: 2 }));
    });
    expect(value(computeAll(data, CLOCK).outcomes['oc-2']!.workCompletion).totalPoints).toBe(4);
  });

  it('is not computable when no work is linked, or when the work has no points', () => {
    const data = change(baseline(), (d) => {
      d.deliverables.push(deliverable({ id: 'td-empty', epicKeys: ['E-9'] }), deliverable({ id: 'td-nopts', epicKeys: ['E-8'] }));
      d.workItems.push(epic('E-9', 'td-empty'), epic('E-8', 'td-nopts'), openStory('S-80', 'E-8', null, { points: null }));
      d.outcomes.push(outcome('oc-empty', 'td-empty'));
    });
    const r = computeAll(data, CLOCK);
    expect(r.deliverables['td-empty']!.workCompletion).toMatchObject({ computable: false, reason: 'no-linked-work' });
    expect(r.deliverables['td-nopts']!.workCompletion).toMatchObject({ computable: false, reason: 'no-points' });
    expect(r.outcomes['oc-empty']!.workCompletion).toMatchObject({ computable: false, reason: 'no-linked-work' });
  });
});

describe('accepted outcomes', () => {
  it('weights accepted outcomes: accepted weight over total weight', () => {
    const data = change(baseline(), (d) => {
      d.evidence = d.evidence.filter((e) => e.id !== 'ev-ba-2');
    });
    const ao = value(computeAll(data, CLOCK).deliverables['td-1']!.acceptedOutcomes);
    expect(ao).toMatchObject({ acceptedCount: 1, totalCount: 2, acceptedWeight: 2, totalWeight: 3, percent: 67 });
  });

  it('needs every mandatory criterion accepted; optional criteria do not count', () => {
    const data = change(baseline(), (d) => {
      d.criteria.push(criterion('c-4', 'oc-1', { state: 'open', acceptedById: null, acceptedAt: null }));
    });
    const a = computeAll(data, CLOCK).outcomes['oc-1']!.acceptance;
    expect(a.accepted).toBe(false);
    expect(a).toMatchObject({ mandatoryCount: 2, mandatoryAccepted: 1 });
    expect(a.reasons[0]!.refs).toEqual([{ kind: 'criterion', id: 'c-4' }]);
    expect(computeAll(baseline(), CLOCK).outcomes['oc-2']!.acceptance.accepted).toBe(true); // c-3 is optional and open
  });

  it('does not count a criterion accepted by an agent or by nobody', () => {
    for (const acceptedById of ['ai-1', null, 'p-unknown']) {
      const data = change(baseline(), (d) => {
        d.criteria[0] = criterion('c-1', 'oc-1', { acceptedById });
      });
      expect(computeAll(data, CLOCK).outcomes['oc-1']!.acceptance.accepted).toBe(false);
    }
  });

  it('needs a passing business-acceptance record for the outcome', () => {
    const missing = change(baseline(), (d) => {
      d.evidence = d.evidence.filter((e) => e.id !== 'ev-ba-1');
    });
    const failing = change(baseline(), (d) => {
      d.evidence = d.evidence.map((e) => (e.id === 'ev-ba-1' ? { ...e, result: 'fail' as const } : e));
    });
    for (const data of [missing, failing]) {
      const a = computeAll(data, CLOCK).outcomes['oc-1']!.acceptance;
      expect(a.accepted).toBe(false);
      expect(a.reasons.map((r) => r.code)).toEqual(['no-business-acceptance']);
    }
  });

  it('is not computable with no outcomes, or when every weight is zero', () => {
    const data = change(baseline(), (d) => {
      d.deliverables.push(deliverable({ id: 'td-none' }), deliverable({ id: 'td-zero' }));
      d.outcomes.push(outcome('oc-z1', 'td-zero', { weight: 0 }), outcome('oc-z2', 'td-zero', { weight: 0 }));
    });
    const r = computeAll(data, CLOCK);
    expect(r.deliverables['td-none']!.acceptedOutcomes).toMatchObject({ computable: false, reason: 'no-outcomes' });
    expect(r.deliverables['td-zero']!.acceptedOutcomes).toMatchObject({ computable: false, reason: 'zero-weight' });
  });
});

describe('delivery readiness', () => {
  it('uses the required evidence for the risk tier from config', () => {
    const t3 = change(baseline(), (d) => {
      d.deliverables[0]!.riskTier = 'T3';
    });
    const rd = computeAll(t3, CLOCK).deliverables['td-1']!.readiness;
    expect(rd.requiredEvidence).toContain('control-assessment');
    expect(rd.missing).toEqual(['design-review', 'control-assessment']);
    expect(rd.state).toBe('unknown');
  });

  it('is not ready when required evidence fails', () => {
    const data = change(baseline(), (d) => {
      d.evidence[1]!.result = 'fail';
    });
    const rd = computeAll(data, CLOCK).deliverables['td-1']!.readiness;
    expect(rd.state).toBe('not-ready');
    expect(rd.failing).toEqual(['test-result']);
    expect(rd.reasons[0]!.code).toBe('evidence-failing');
  });

  it('is not ready while a critical incoming dependency is open, even with all evidence passing', () => {
    const data = change(baseline(), (d) => {
      d.deliverables.push(deliverable({ id: 'td-p' }));
      d.dependencies.push(dependency('dep-1', 'td-p', 'td-1'));
    });
    const rd = computeAll(data, CLOCK).deliverables['td-1']!.readiness;
    expect(rd.state).toBe('not-ready');
    expect(rd.blockingDependencyIds).toEqual(['dep-1']);
    expect(rd.reasons.map((r) => r.message)).toEqual(['Critical dependency “Dependency dep-1” from TD-P is not yet delivered (on track, needed by 15 Apr 2027).']);
  });

  it('ignores non-critical or delivered dependencies', () => {
    const data = change(baseline(), (d) => {
      d.deliverables.push(deliverable({ id: 'td-p' }));
      d.dependencies.push(dependency('dep-1', 'td-p', 'td-1', { critical: false }));
      d.dependencies.push(dependency('dep-2', 'td-p', 'td-1', { status: 'delivered', deliveredOn: '2027-03-01' }));
    });
    expect(computeAll(data, CLOCK).deliverables['td-1']!.readiness.state).toBe('ready');
  });

  it('is unknown, never ready, when required evidence is missing, stale or pending', () => {
    const missing = change(baseline(), (d) => {
      d.evidence = d.evidence.filter((e) => e.kind !== 'release-checklist');
    });
    const stale = change(baseline(), (d) => {
      d.workItems.find((w) => w.key === 'S-2')!.updated = '2027-03-06T12:00:00.000Z';
    });
    const pending = change(baseline(), (d) => {
      d.evidence[0]!.result = 'pending';
    });
    const m = computeAll(missing, CLOCK).deliverables['td-1']!.readiness;
    expect(m.state).toBe('unknown');
    expect(m.missing).toEqual(['release-checklist']);
    const s = computeAll(stale, CLOCK).deliverables['td-1']!.readiness;
    expect(s.state).toBe('unknown');
    expect(s.stale).toEqual(['test-result', 'business-acceptance']); // S-2 is also oc-1 work
    expect(s.held.find((h) => h.kind === 'test-result')).toMatchObject({ state: 'stale', evidenceId: 'ev-test', workChangedAt: '2027-03-06T12:00:00.000Z' });
    expect(computeAll(pending, CLOCK).deliverables['td-1']!.readiness.state).toBe('unknown');
  });

  it('lets a later passing rerun of the same scope clear an earlier failure', () => {
    const data = change(baseline(), (d) => {
      d.evidence[1]!.result = 'fail';
      d.evidence.push(evidence('ev-test-2', 'td-1', 'test-result', { workItemKey: 'S-2', observedAt: '2027-03-07T10:00:00.000Z' }));
    });
    expect(computeAll(data, CLOCK).deliverables['td-1']!.readiness.state).toBe('ready');
  });

  it('lets a later deliverable-wide record supersede earlier scoped records of its kind', () => {
    const data = change(baseline(), (d) => {
      d.evidence[1]!.result = 'fail';
      d.evidence.push(evidence('ev-test-all', 'td-1', 'test-result', { observedAt: '2027-03-07T10:00:00.000Z', provenance: 'simulated' }));
    });
    expect(computeAll(data, CLOCK).deliverables['td-1']!.readiness.state).toBe('ready');
  });

  it('keeps a failure in one scope when another scope passes', () => {
    const data = change(baseline(), (d) => {
      d.evidence.push(evidence('ev-test-s1', 'td-1', 'test-result', { workItemKey: 'S-1', result: 'fail', observedAt: '2027-03-04T10:00:00.000Z' }));
    });
    const rd = computeAll(data, CLOCK).deliverables['td-1']!.readiness;
    expect(rd.state).toBe('not-ready');
    expect(rd.held.find((h) => h.kind === 'test-result')!.evidenceId).toBe('ev-test-s1');
  });
});

describe('evidence staleness', () => {
  it('is stale when the covered item changed after the evidence was observed', () => {
    const data = change(baseline(), (d) => {
      d.workItems.find((w) => w.key === 'S-2')!.updated = '2027-03-05T10:00:01.000Z';
    });
    expect(computeAll(data, CLOCK).deliverables['td-1']!.readiness.stale).toEqual(['test-result', 'business-acceptance']);
  });

  it('is not stale when the change happened before the observation', () => {
    expect(computeAll(baseline(), CLOCK).deliverables['td-1']!.readiness.stale).toEqual([]);
  });

  it('follows changes to children of the covered item (a sub-task under the story)', () => {
    const data = change(baseline(), (d) => {
      d.workItems.push({ ...story('ST-1', 'E-2', null, { updated: '2027-03-06T09:00:00.000Z' }), type: 'sub-task', parentKey: 'S-2' });
    });
    const held = computeAll(data, CLOCK).deliverables['td-1']!.readiness.held;
    expect(held.find((h) => h.kind === 'test-result')).toMatchObject({ state: 'stale', workChangedAt: '2027-03-06T09:00:00.000Z' });
  });

  it('covers every item carrying the Outcome ID for outcome-linked evidence', () => {
    const data = change(baseline(), (d) => {
      d.workItems.find((w) => w.key === 'S-1')!.updated = '2027-03-06T09:00:00.000Z'; // oc-1, under E-1
    });
    const r = computeAll(data, CLOCK);
    expect(r.deliverables['td-1']!.readiness.stale).toEqual(['business-acceptance']);
    expect(r.findings.filter((f) => f.ruleId === 'R12').map((f) => f.subject.id)).toEqual(['ev-ba-1']);
  });

  it('never makes deliverable-wide evidence stale (it has no linked work)', () => {
    const data = change(baseline(), (d) => {
      for (const w of d.workItems) w.updated = '2027-03-07T09:00:00.000Z';
      d.evidence = d.evidence.filter((e) => e.kind !== 'test-result' && e.kind !== 'business-acceptance');
    });
    const rd = computeAll(data, CLOCK).deliverables['td-1']!.readiness;
    expect(rd.held.find((h) => h.kind === 'requirements-sign-off')!.state).toBe('passing');
  });
});

describe('the three measures are independent', () => {
  it('100% work completion with no acceptance gives zero accepted outcomes', () => {
    const data = change(baseline(), (d) => {
      d.criteria = d.criteria.map((c) => ({ ...c, state: 'open' as const, acceptedById: null, acceptedAt: null }));
      d.evidence = d.evidence.filter((e) => e.kind !== 'business-acceptance');
    });
    const m = computeAll(data, CLOCK).deliverables['td-1']!;
    expect(value(m.workCompletion).percent).toBe(100);
    expect(value(m.acceptedOutcomes)).toMatchObject({ acceptedCount: 0, acceptedWeight: 0, percent: 0 });
  });

  it('all outcomes accepted with a failing required test gives not ready', () => {
    const data = change(baseline(), (d) => {
      d.evidence[1]!.result = 'fail';
    });
    const m = computeAll(data, CLOCK).deliverables['td-1']!;
    expect(value(m.acceptedOutcomes).percent).toBe(100);
    expect(m.readiness.state).toBe('not-ready');
  });

  it('missing evidence gives unknown, never ready, even with all work closed and all outcomes accepted', () => {
    const data = change(baseline(), (d) => {
      d.evidence = d.evidence.filter((e) => e.kind !== 'requirements-sign-off');
    });
    const m = computeAll(data, CLOCK).deliverables['td-1']!;
    expect(value(m.workCompletion).percent).toBe(100);
    expect(value(m.acceptedOutcomes).percent).toBe(100);
    expect(m.readiness.state).toBe('unknown');
  });

  it('ready with no work closed: readiness does not read work completion', () => {
    const data = change(baseline(), (d) => {
      d.workItems = d.workItems.map((w) => (w.type === 'story' ? { ...w, statusCategory: 'to-do' as const, status: 'To Do', resolved: null, updated: '2027-01-05T09:00:00.000Z' } : w));
    });
    const m = computeAll(data, CLOCK).deliverables['td-1']!;
    expect(value(m.workCompletion).percent).toBe(0);
    expect(m.readiness.state).toBe('ready');
    expect(value(m.acceptedOutcomes).percent).toBe(100);
  });
});
