import { describe, expect, it } from 'vitest';
import type { EvidenceRag } from '@/lib/types';
import { computeAll, computeHierarchyRollups, statusDisagreements, worstRag } from './index';
import { CLOCK, baseline, change, deliverable, dependency, milestone, openStory } from './test-fixtures';

describe('evidence-based RAG per deliverable', () => {
  it('Green: no critical or high findings, no missed dates, current report', () => {
    const rag = computeAll(baseline(), CLOCK).deliverableRag['td-1']!;
    expect(rag).toMatchObject({ reported: 'green', evidence: 'green', disagrees: false });
    expect(rag.reasons.map((r) => r.code)).toEqual(['no-exceptions']);
  });

  it('Red: a critical finding (failing required test)', () => {
    const data = change(baseline(), (d) => {
      d.evidence[1]!.result = 'fail';
    });
    const rag = computeAll(data, CLOCK).deliverableRag['td-1']!;
    expect(rag.evidence).toBe('red');
    expect(rag.disagrees).toBe(true);
    expect(rag.reasons[0]).toMatchObject({ code: 'critical-finding-R13', refs: [{ kind: 'finding', id: 'f-R13-evidence-ev-test' }] });
  });

  it('Red: a missed committed date', () => {
    const data = change(baseline(), (d) => {
      d.milestones.push(milestone('ms-1', 'td-1', { date: '2027-03-01', title: 'Pilot release' }));
    });
    const rag = computeAll(data, CLOCK).deliverableRag['td-1']!;
    expect(rag.evidence).toBe('red');
    expect(rag.reasons[0]!.message).toBe('Milestone “Pilot release” was due on 1 Mar 2027 and has not been met.');
  });

  it('Red: planned end passed with work still open', () => {
    const data = change(baseline(), (d) => {
      d.deliverables[0]!.plannedEnd = '2027-03-01';
      d.workItems.push(openStory('S-4', 'E-1', 'oc-1'));
    });
    expect(computeAll(data, CLOCK).deliverableRag['td-1']!.reasons.map((r) => r.code)).toContain('missed-planned-end');
  });

  it('Amber: a high finding (agent item with no reviewer)', () => {
    const data = change(baseline(), (d) => {
      d.workItems.push(openStory('S-4', 'E-1', 'oc-1', { assigneeType: 'agent', assigneeId: 'ai-1' }));
    });
    const rag = computeAll(data, CLOCK).deliverableRag['td-1']!;
    expect(rag.evidence).toBe('amber');
    expect(rag.reasons.map((r) => r.code)).toEqual(['high-finding-R10']);
  });

  it('Amber: stale data (reported status older than the stale window)', () => {
    const data = change(baseline(), (d) => {
      d.deliverables[0]!.reportedAt = '2027-02-15';
    });
    const rag = computeAll(data, CLOCK).deliverableRag['td-1']!;
    expect(rag.evidence).toBe('amber');
    expect(rag.reasons[0]!.code).toBe('stale-report');
  });

  it('Amber: stale evidence (via R12, a high finding)', () => {
    const data = change(baseline(), (d) => {
      d.workItems.find((w) => w.key === 'S-3')!.updated = '2027-03-07T09:00:00.000Z';
    });
    expect(computeAll(data, CLOCK).deliverableRag['td-1']!.evidence).toBe('amber');
  });

  it('Unknown: too little data (no evidence or no work), never Green', () => {
    const data = change(baseline(), (d) => {
      d.deliverables.push(deliverable({ id: 'td-new', epicKeys: [] }));
    });
    const rag = computeAll(data, CLOCK).deliverableRag['td-new']!;
    expect(rag).toMatchObject({ evidence: 'unknown', disagrees: false });
    expect(rag.reasons.map((r) => r.code)).toEqual(['no-work', 'no-evidence']);
  });

  it('a known problem is never hidden behind Unknown', () => {
    const data = change(baseline(), (d) => {
      d.deliverables.push(deliverable({ id: 'td-new', epicKeys: [] }));
      d.milestones.push(milestone('ms-1', 'td-new', { date: '2027-03-01' }));
    });
    expect(computeAll(data, CLOCK).deliverableRag['td-new']!.evidence).toBe('red');
  });

  it('never changes the reported RAG', () => {
    const data = change(baseline(), (d) => {
      d.evidence[1]!.result = 'fail';
    });
    const r = computeAll(data, CLOCK);
    expect(r.deliverableRag['td-1']!.reported).toBe('green');
    expect(data.deliverables[0]!.reportedRag).toBe('green');
  });
});

describe('status disagreements', () => {
  const rag = (id: string, reported: EvidenceRag['reported'], evidence: EvidenceRag['evidence']): EvidenceRag => ({
    entity: { kind: 'deliverable', id },
    reported,
    evidence,
    disagrees: evidence !== 'unknown' && evidence !== reported,
    reasons: [],
  });

  it('lists only disagreeing deliverables, widest gap and worst evidence first', () => {
    const ids = statusDisagreements({
      a: rag('a', 'green', 'amber'),
      b: rag('b', 'green', 'red'),
      c: rag('c', 'green', 'green'),
      d: rag('d', 'green', 'unknown'),
      e: rag('e', 'red', 'green'),
      f: rag('f', 'amber', 'red'),
    });
    expect(ids).toEqual(['b', 'e', 'f', 'a']);
  });

  it('feeds the portfolio summary', () => {
    const data = change(baseline(), (d) => {
      d.evidence[1]!.result = 'fail';
    });
    expect(computeAll(data, CLOCK).portfolio.disagreementDeliverableIds).toEqual(['td-1']);
  });
});

describe('roll-ups up the hierarchy', () => {
  function twoDeliverables() {
    return change(baseline(), (d) => {
      d.pmNodes.push({ ...d.pmNodes[0]!, id: 'pj-1', ref: 'PJ-1', level: 'project', parentId: 'pm-1', title: 'Project one' });
      d.deliverables.push(deliverable({ id: 'td-2', pmNodeId: 'pj-1', epicKeys: [] }));
    });
  }

  it('orders Red > Amber > Unknown > Green', () => {
    expect(worstRag(['green', 'unknown'])).toBe('unknown');
    expect(worstRag(['green', 'amber', 'unknown'])).toBe('amber');
    expect(worstRag(['red', 'amber'])).toBe('red');
    expect(worstRag(['green', 'green'])).toBe('green');
    expect(worstRag([])).toBe('unknown');
  });

  it('rolls PM node RAG up from every deliverable in its subtree', () => {
    const r = computeAll(twoDeliverables(), CLOCK);
    expect(r.pmNodeRag['pj-1']!.evidence).toBe('unknown');
    expect(r.pmNodeRag['pm-1']!.evidence).toBe('unknown'); // td-1 Green, td-2 Unknown via the project
    expect(r.pmNodeRag['pm-1']!.reasons.map((x) => x.code)).toEqual(['deliverables-unknown', 'deliverables-green']);
    expect(r.portfolio.programmeHealth).toEqual([
      { pmNodeId: 'pm-1', deliverableIds: ['td-1', 'td-2'], reported: 'green', evidence: 'unknown', deliverableRag: { red: 0, amber: 0, green: 1, unknown: 1 } },
    ]);
  });

  it('rolls up the three measures for PM nodes and investment requests', () => {
    const data = change(twoDeliverables(), (d) => {
      d.deliverables[1]!.epicKeys = ['E-9'];
      d.workItems.push({ ...d.workItems[0]!, key: 'E-9', deliverableId: 'td-2' }, openStory('S-90', 'E-9', null, { points: 10 }));
      d.deliverables.push(deliverable({ id: 'td-p', pmNodeId: null })); // standalone, same request
      d.dependencies.push(dependency('dep-1', 'td-p', 'td-1'));
    });
    const r = computeAll(data, CLOCK);
    const roll = computeHierarchyRollups(data, r);
    const pm = roll.pmNodes['pm-1']!;
    expect(pm.workCompletion).toMatchObject({ computable: true, value: { closedPoints: 10, totalPoints: 20, percent: 50 } });
    expect(pm.acceptedOutcomes).toMatchObject({ computable: true, value: { acceptedCount: 2, totalCount: 2 } });
    expect(pm.readiness).toEqual({ ready: 0, 'not-ready': 1, unknown: 1 });
    expect(roll.pmNodes['pj-1']!.deliverableIds).toEqual(['td-2']);
    const ir = roll.investmentRequests['ir-1']!;
    expect(ir.deliverableIds).toEqual(['td-1', 'td-2', 'td-p']);
    expect(ir.rag.entity).toEqual({ kind: 'investment-request', id: 'ir-1' });
    expect(r.portfolio.workCompletion).toMatchObject({ computable: true, value: { totalPoints: 20 } });
  });
});
