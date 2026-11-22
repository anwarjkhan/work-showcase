/**
 * Extractors on the synthetic portfolio (docs/SLIDES_PLAN.md section 10, "Unit: extract").
 */
import { describe, expect, it } from 'vitest';
import { computeHierarchyRollups } from '@/lib/engine';
import { syntheticContext } from '../compose/test-helpers';
import { deliverableFacts, nodeFacts, outcomeFacts, portfolioFacts, quarterOf, scopeKey, parseScopeKey, scopePath, slideEnv } from '.';

const ctx = syntheticContext();
const env = slideEnv(ctx);

describe('deliverable facts', () => {
  const f = deliverableFacts(env, 'td-1001');

  it('give the TD-1001 verdict: 82%, 1 of 4, not ready, reported Green, evidence Red', () => {
    expect(f.views.work.value).toBe('82%');
    expect(f.views.accepted.value).toBe('1 of 4');
    expect(f.views.readiness.state).toBe('not-ready');
    expect(f.views.readiness.stateText).toBe('Not ready');
    expect(f.rag.reported).toBe('green');
    expect(f.rag.evidence).toBe('red');
    expect(f.verdict).toBe('TD-1001 is reported Green; the evidence says Red');
  });

  it('read measures from the engine result rather than recomputing them', () => {
    expect(f.measures).toBe(ctx.result.deliverables['td-1001']);
    expect(f.rag).toBe(ctx.result.deliverableRag['td-1001']);
    expect(f.forecast).toBe(env.forecasts.get('td-1001'));
  });

  it('name the path by refs and titles', () => {
    expect(scopePath(env, { kind: 'deliverable', deliverableId: 'td-1001' })).toBe('IR-2027-001 › Counterparty Credit Risk Modernisation › TD-1001');
  });

  it('carry the latest status draft only when the store holds one', () => {
    expect(f.statusDraft).toBeNull();
    const withDrafts = deliverableFacts(slideEnv(syntheticContext(true)), 'td-1001');
    expect(withDrafts.statusDraft?.kind).toBe('weekly-status');
  });
});

describe('outcome facts', () => {
  it('OC-1001-2 is reported on track and not accepted', () => {
    const f = outcomeFacts(env, 'oc-1001-2');
    expect(f.outcome.ref).toBe('OC-1001-2');
    expect(f.outcome.reportedStatus).toBe('on-track');
    expect(f.measures.acceptance.accepted).toBe(false);
    expect(f.measures).toBe(ctx.result.outcomes['oc-1001-2']);
    expect(f.criteria.length).toBe(3);
    expect(f.items.length).toBeGreaterThan(0);
  });
});

describe('node facts', () => {
  it('a programme roll-up equals computeHierarchyRollups', () => {
    const expected = computeHierarchyRollups(ctx.data, ctx.result).pmNodes['pm-ccr'];
    const f = nodeFacts(env, 'pm-ccr');
    expect(f.rollup).toEqual(expected);
    expect(f.deliverables.map((l) => l.deliverable.id)).toEqual(expected?.deliverableIds);
    expect(f.children.map((c) => c.node.ref)).toEqual(['PJ-CCR-01', 'PJ-CCR-02']);
  });

  it('every node yields facts', () => {
    for (const n of ctx.data.pmNodes) expect(nodeFacts(env, n.id).node.id).toBe(n.id);
  });
});

describe('portfolio facts', () => {
  const f = portfolioFacts(env);

  it('use the engine portfolio summary and disagreement order', () => {
    expect(f.summary).toBe(ctx.result.portfolio);
    expect(f.disagreeing.map((l) => l.deliverable.id)).toEqual(ctx.result.portfolio.disagreementDeliverableIds);
    expect(f.disagreeing[0]?.deliverable.ref).toBe('TD-1001');
  });

  it('take the quarter containing the clock', () => {
    expect(quarterOf('2027-03-08')).toEqual({ label: 'Q1 2027', start: '2027-01-01', end: '2027-03-31' });
    expect(quarterOf('2027-11-30')).toEqual({ label: 'Q4 2027', start: '2027-10-01', end: '2027-12-31' });
    expect(f.quarter.label).toBe('Q1 2027');
    expect(f.quarter.due.every((l) => l.deliverable.plannedEnd >= '2027-01-01' && l.deliverable.plannedEnd <= '2027-03-31')).toBe(true);
  });

  it('group findings per rule, most severe first, covering every finding', () => {
    expect(f.rules.reduce((n, r) => n + r.count, 0)).toBe(ctx.result.findings.length);
    expect(f.rules[0]?.severity).toBe('critical');
  });

  it('keep regions to a small set of categories', () => {
    expect(f.regions.length).toBeGreaterThan(0);
    expect(f.regions.length).toBeLessThanOrEqual(8);
  });
});

describe('scope keys', () => {
  it('round-trip', () => {
    for (const s of [{ kind: 'portfolio' as const }, { kind: 'deliverable' as const, deliverableId: 'td-1001' }, { kind: 'pm-node' as const, pmNodeId: 'pm-ccr' }, { kind: 'outcome' as const, outcomeId: 'oc-1001-2' }]) {
      expect(parseScopeKey(scopeKey(s))).toEqual(s);
    }
    expect(parseScopeKey('nonsense:x')).toBeNull();
  });
});
