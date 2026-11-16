import { describe, expect, it } from 'vitest';
import type { PortfolioData, WorkItem } from '@/lib/types';
import { computeAll } from './index';
import {
  CLOCK,
  baseline,
  change,
  criterion,
  deliverable,
  dependency,
  epic,
  evidence,
  milestone,
  openStory,
  outcome,
  portfolio,
  raid,
  story,
} from './test-fixtures';

describe('computeAll', () => {
  it('is deterministic: same input gives deeply equal output, on the same and on a cloned snapshot', () => {
    const data = change(baseline(), (d) => {
      d.evidence[1]!.result = 'fail';
      d.workItems.push(openStory('S-4', 'E-1', null, { due: '2027-03-01', points: 5 }));
      d.raid.push(raid('r-1', 'td-1', { ownerId: null }));
    });
    const a = computeAll(data, CLOCK);
    const b = computeAll(data, CLOCK);
    const c = computeAll(structuredClone(data), CLOCK);
    expect(b).toEqual(a);
    expect(c).toEqual(a);
    expect(JSON.stringify(c)).toBe(JSON.stringify(a));
  });

  it('takes the clock as a parameter: a later clock changes date-driven results', () => {
    const data = change(baseline(), (d) => {
      d.workItems.push(openStory('S-4', 'E-1', 'oc-1', { due: '2027-03-10' }));
    });
    expect(computeAll(data, CLOCK).findings.filter((f) => f.ruleId === 'R3')).toHaveLength(0);
    const later = { ...CLOCK, today: '2027-03-15', now: '2027-03-15T09:00:00.000Z' };
    const r = computeAll(data, later);
    expect(r.computedFor).toBe('2027-03-15');
    expect(r.findings.filter((f) => f.ruleId === 'R3')).toHaveLength(1);
  });

  it('does not mutate its input', () => {
    const data = baseline();
    const before = structuredClone(data);
    computeAll(data, CLOCK);
    expect(data).toEqual(before);
  });

  it('returns a record for every deliverable and outcome, even an empty snapshot', () => {
    const r = computeAll(portfolio({}), CLOCK);
    expect(r.findings).toEqual([]);
    expect(r.portfolio.workCompletion.computable).toBe(false);
    const full = computeAll(baseline(), CLOCK);
    expect(Object.keys(full.deliverables)).toEqual(['td-1']);
    expect(Object.keys(full.outcomes)).toEqual(['oc-1', 'oc-2']);
  });

  it('summarises the portfolio', () => {
    const data = change(baseline(), (d) => {
      d.deliverables.push(deliverable({ id: 'td-s', pmNodeId: null, reportedRag: 'amber', pdlcStage: 'ideation-requirements', epicKeys: ['E-9'] }));
      d.workItems.push(epic('E-9', 'td-s'), openStory('S-90', 'E-9', null, { assigneeType: 'agent', assigneeId: 'ai-1', reviewerId: 'p-eng' }));
      d.pdlcRuns = d.pdlcRuns.filter((run) => run.deliverableId !== 'td-s');
    });
    const p = computeAll(data, CLOCK).portfolio;
    expect(p.counts).toMatchObject({ investmentRequests: 1, programmes: 1, deliverables: 2, standaloneDeliverables: 1, epics: 3, outcomes: 2, workItems: 7 });
    expect(p.reportedRag).toEqual({ red: 0, amber: 1, green: 1, unknown: 0 });
    expect(p.evidenceRag.green).toBe(1);
    expect(p.stageDistribution).toMatchObject({ 'build-test-validate': 1, 'ideation-requirements': 1 });
    expect(p.stageWorkShare['ideation-requirements']).toEqual({ human: 0, agent: 1, agentShare: 1 });
    expect(p.stageWorkShare['build-test-validate']).toEqual({ human: 3, agent: 0, agentShare: 0 });
    expect(p.readiness).toEqual({ ready: 1, 'not-ready': 0, unknown: 1 });
    expect(p.findingsBySeverity.low).toBe(1); // R9 on S-90
  });
});

/**
 * A generated portfolio at the design's volumes: 26 deliverables, ~45 Epics,
 * ~900 work items, ~70 outcomes, ~200 criteria, ~300 evidence records,
 * ~40 RAID items, ~30 dependencies. Deterministic (fixed-step generator).
 */
function generated(): PortfolioData {
  let seed = 7;
  const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const base = portfolio({});
  const deliverables = [];
  const workItems: WorkItem[] = [];
  const outcomes = [];
  const criteria = [];
  const evidenceList = [];
  const raidList = [];
  const deps = [];
  const milestones = [];
  const kinds = ['requirements-sign-off', 'design-review', 'control-assessment', 'test-result', 'business-acceptance', 'release-checklist'] as const;
  let epicNo = 0;
  for (let i = 0; i < 26; i++) {
    const id = `td-${i}`;
    const epics = Array.from({ length: i % 3 === 0 ? 1 : 2 }, () => `EP-${epicNo++}`);
    deliverables.push(deliverable({ id, epicKeys: epics, riskTier: (['T1', 'T2', 'T3', 'T4'] as const)[i % 4], pmNodeId: i < 20 ? 'pm-1' : null }));
    for (const key of epics) workItems.push(epic(key, id));
    const ocs = Array.from({ length: 3 }, (_, k) => `oc-${i}-${k}`);
    for (const oc of ocs) {
      outcomes.push(outcome(oc, id, { weight: 1 + (oc.length % 3) }));
      for (let c = 0; c < 3; c++) criteria.push(criterion(`c-${oc}-${c}`, oc, next() < 0.5 ? {} : { state: 'open', acceptedById: null, acceptedAt: null }));
    }
    for (let s = 0; s < 33; s++) {
      const key = `W-${i}-${s}`;
      const closed = next() < 0.6;
      const props = {
        points: 1 + Math.floor(next() * 8),
        due: next() < 0.2 ? '2027-03-01' : null,
        assigneeType: next() < 0.2 ? ('agent' as const) : ('human' as const),
        updated: `2027-0${1 + Math.floor(next() * 3)}-1${Math.floor(next() * 9)}T09:00:00.000Z`,
      };
      const ep = epics[s % epics.length]!;
      const oc = next() < 0.9 ? ocs[s % 3]! : null;
      workItems.push(closed ? story(key, ep, oc, { ...props, resolved: props.updated }) : openStory(key, ep, oc, props));
    }
    for (let e = 0; e < 12; e++) {
      evidenceList.push(
        evidence(`ev-${i}-${e}`, id, kinds[e % 6]!, {
          result: next() < 0.15 ? 'fail' : 'pass',
          workItemKey: e % 2 === 0 ? `W-${i}-${e}` : null,
          outcomeId: e % 6 === 4 ? ocs[e % 3]! : null,
          observedAt: `2027-0${1 + Math.floor(next() * 3)}-0${1 + Math.floor(next() * 8)}T10:00:00.000Z`,
        }),
      );
    }
    raidList.push(raid(`r-${i}-a`, id, { title: `Risk about item ${i} feed` }), raid(`r-${i}-b`, id, { title: `Risk about item ${i} feed late`, ownerId: null }));
    deps.push(dependency(`dep-${i}`, id, `td-${(i + 1) % 26}`, { needBy: '2027-03-01', committed: next() < 0.5 ? '2027-03-20' : '2027-02-20', status: next() < 0.3 ? 'late' : 'on-track' }));
    milestones.push(milestone(`ms-${i}`, id, { date: '2027-03-15', workItemKeys: [`W-${i}-1`, `W-${i}-2`] }));
  }
  return { ...base, deliverables, workItems, outcomes, criteria, evidence: evidenceList, raid: raidList, dependencies: deps, milestones };
}

describe('performance', () => {
  it('computes ~900 work items well under 50 ms', () => {
    const data = generated();
    expect(data.workItems.length).toBeGreaterThanOrEqual(880);
    computeAll(data, CLOCK); // warm up
    const runs = 5;
    const start = performance.now();
    for (let i = 0; i < runs; i++) computeAll({ ...data }, CLOCK); // new snapshot object each time: no index cache hit
    const perRun = (performance.now() - start) / runs;
    expect(perRun).toBeLessThan(50);
    const r = computeAll(data, CLOCK);
    for (const rule of ['R1', 'R3', 'R4', 'R5', 'R6', 'R7', 'R9', 'R10', 'R12', 'R13']) {
      expect(r.findings.some((f) => f.ruleId === rule)).toBe(true);
    }
  });
});
