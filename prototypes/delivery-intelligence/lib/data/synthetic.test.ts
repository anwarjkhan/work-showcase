import { describe, expect, it } from 'vitest';
import { DEMO_CLOCK } from '@/lib/config/clock';
import { HERO_DELIVERABLE_ID, PRESENTER_PERSON_ID, WORKFLOW_DELIVERABLE_ID } from '@/lib/config/story';
import { computeAll } from '@/lib/engine';
import type { PortfolioData, RuleId } from '@/lib/types';
import { createSyntheticPortfolio, DEFAULT_SEED } from './synthetic';

const data: PortfolioData = createSyntheticPortfolio();
const within = (actual: number, target: number, tolerance = 0.1): boolean => Math.abs(actual - target) <= target * tolerance;
const ids = <T extends { id: string }>(rows: T[]): Set<string> => new Set(rows.map((r) => r.id));

describe('determinism', () => {
  it('gives deeply equal data for the same seed', () => {
    expect(createSyntheticPortfolio(DEFAULT_SEED)).toEqual(createSyntheticPortfolio(DEFAULT_SEED));
  });
  it('gives different data for a different seed', () => {
    const other = createSyntheticPortfolio(DEFAULT_SEED + 1);
    expect(other).not.toEqual(data);
    expect(other.people.map((p) => p.name)).not.toEqual(data.people.map((p) => p.name));
  });
  it('is marked synthetic and uses the demo clock', () => {
    expect(data.meta.sourceKind).toBe('synthetic');
    expect(data.meta.asOf).toBe(DEMO_CLOCK.today);
    expect(data.meta.heroDeliverableId).toBe(HERO_DELIVERABLE_ID);
  });
});

describe('volumes (within 10% of the design)', () => {
  const epics = data.workItems.filter((w) => w.type === 'epic');
  const cases: Array<[string, number, number]> = [
    ['investment requests', data.investmentRequests.length, 6],
    ['programmes', data.pmNodes.filter((n) => n.level === 'programme').length, 4],
    ['deliverables', data.deliverables.length, 26],
    ['standalone deliverables', data.deliverables.filter((d) => d.pmNodeId === null).length, 6],
    ['epics', epics.length, 45],
    ['outcomes', data.outcomes.length, 70],
    ['criteria', data.criteria.length, 200],
    ['work items', data.workItems.length, 900],
    ['evidence', data.evidence.length, 300],
    ['hubs', data.hubs.length, 18],
    ['pods', data.pods.length, 12],
    ['RAID', data.raid.length, 40],
    ['dependencies', data.dependencies.length, 30],
    ['sprints', data.sprints.length, 26],
  ];
  it.each(cases)('%s', (_name, actual, target) => {
    expect(within(actual, target)).toBe(true);
  });
  it('covers six continents and has real coordinates', () => {
    expect(new Set(data.hubs.map((h) => h.continent)).size).toBe(6);
    const london = data.hubs.find((h) => h.city === 'London');
    expect(london?.latitude).toBeCloseTo(51.5, 0);
    expect(london?.longitude).toBeCloseTo(-0.1, 0);
    const sydney = data.hubs.find((h) => h.city === 'Sydney');
    expect(sydney?.latitude).toBeLessThan(0);
    expect(sydney?.longitude).toBeGreaterThan(150);
  });
  it('has milestones, some regulatory, and sprints that are two weeks long', () => {
    expect(data.milestones.some((m) => m.regulatory)).toBe(true);
    for (const s of data.sprints) expect((Date.parse(s.end) - Date.parse(s.start)) / 86_400_000).toBe(13);
  });
  it('mixes human and agent members in pods', () => {
    expect(data.pods.every((p) => p.memberIds.length > 0 && p.agentIdentityIds.length > 0)).toBe(true);
  });
});

describe('referential integrity', () => {
  const hubs = ids(data.hubs);
  const pods = ids(data.pods);
  const people = ids(data.people);
  const agents = ids(data.agentIdentities);
  const deliverables = ids(data.deliverables);
  const outcomes = ids(data.outcomes);
  const sprints = ids(data.sprints);
  const keys = new Set(data.workItems.map((w) => w.key));
  const raidKeys = new Set(data.raid.map((r) => r.key));
  const epicKeys = new Set(data.workItems.filter((w) => w.type === 'epic').map((w) => w.key));
  /** Epics that deliberately carry a missing or dangling Deliverable ID (rule R14). */
  const r14Epics = data.workItems.filter((w) => w.type === 'epic' && (w.deliverableId === null || !deliverables.has(w.deliverableId)));

  it('has unique ids in every collection', () => {
    for (const rows of [data.investmentRequests, data.pmNodes, data.deliverables, data.outcomes, data.criteria, data.evidence, data.raid, data.dependencies, data.milestones, data.hubs, data.pods, data.people, data.agentIdentities, data.sprints, data.pdlcRuns]) {
      expect(ids(rows as Array<{ id: string }>).size).toBe(rows.length);
    }
    expect(keys.size).toBe(data.workItems.length);
    expect(raidKeys.size).toBe(data.raid.length);
  });

  it('resolves hierarchy and reference references', () => {
    for (const ir of data.investmentRequests) expect(people.has(ir.ownerId)).toBe(true);
    const nodes = ids(data.pmNodes);
    const requests = ids(data.investmentRequests);
    for (const n of data.pmNodes) {
      expect(requests.has(n.investmentRequestId)).toBe(true);
      expect(people.has(n.ownerId)).toBe(true);
      if (n.parentId) expect(nodes.has(n.parentId)).toBe(true);
    }
    for (const d of data.deliverables) {
      expect(requests.has(d.investmentRequestId)).toBe(true);
      if (d.pmNodeId) expect(nodes.has(d.pmNodeId)).toBe(true);
      expect(pods.has(d.podId)).toBe(true);
      expect(people.has(d.ownerId)).toBe(true);
      for (const h of d.hubIds) expect(hubs.has(h)).toBe(true);
      for (const seat of Object.values(d.coreTeam)) expect(people.has(seat!.personId)).toBe(true);
      for (const k of d.epicKeys) expect(epicKeys.has(k)).toBe(true);
    }
    for (const p of data.pods) {
      expect(hubs.has(p.hubId)).toBe(true);
      expect(people.has(p.leadId)).toBe(true);
      for (const m of p.memberIds) expect(people.has(m)).toBe(true);
      for (const a of p.agentIdentityIds) expect(agents.has(a)).toBe(true);
    }
    for (const person of data.people) {
      expect(hubs.has(person.hubId)).toBe(true);
      if (person.podId) expect(pods.has(person.podId)).toBe(true);
    }
    for (const a of data.agentIdentities) {
      expect(people.has(a.accountableOwnerId)).toBe(true);
      if (a.podId) expect(pods.has(a.podId)).toBe(true);
      if (a.hubId) expect(hubs.has(a.hubId)).toBe(true);
    }
  });

  it('resolves outcome, criterion and work-item references', () => {
    for (const o of data.outcomes) {
      expect(deliverables.has(o.deliverableId)).toBe(true);
      expect(people.has(o.acceptanceOwnerId)).toBe(true);
    }
    for (const c of data.criteria) {
      expect(outcomes.has(c.outcomeId)).toBe(true);
      if (c.acceptedById) expect(people.has(c.acceptedById)).toBe(true);
      if (c.rejectedById) expect(people.has(c.rejectedById)).toBe(true);
    }
    for (const w of data.workItems) {
      if (w.epicKey) expect(epicKeys.has(w.epicKey)).toBe(true);
      if (w.parentKey) expect(keys.has(w.parentKey)).toBe(true);
      if (w.outcomeId) expect(outcomes.has(w.outcomeId)).toBe(true);
      if (w.podId) expect(pods.has(w.podId)).toBe(true);
      if (w.hubId) expect(hubs.has(w.hubId)).toBe(true);
      if (w.sprintId) expect(sprints.has(w.sprintId)).toBe(true);
      if (w.assigneeId) expect((w.assigneeType === 'agent' ? agents : people).has(w.assigneeId)).toBe(true);
      if (w.reviewerId) expect(people.has(w.reviewerId)).toBe(true);
      if (w.ownerId) expect(people.has(w.ownerId)).toBe(true);
    }
  });

  it('resolves evidence, RAID, dependency, milestone and run references', () => {
    const evidence = ids(data.evidence);
    for (const e of data.evidence) {
      expect(deliverables.has(e.deliverableId)).toBe(true);
      if (e.outcomeId) expect(outcomes.has(e.outcomeId)).toBe(true);
      if (e.workItemKey) expect(keys.has(e.workItemKey)).toBe(true);
      if (e.recordedById) expect(people.has(e.recordedById)).toBe(true);
    }
    for (const r of data.raid) {
      expect(deliverables.has(r.deliverableId)).toBe(true);
      if (r.ownerId) expect(people.has(r.ownerId)).toBe(true);
    }
    for (const d of data.dependencies) {
      expect(deliverables.has(d.fromDeliverableId) && deliverables.has(d.toDeliverableId)).toBe(true);
      expect(hubs.has(d.fromHubId) && hubs.has(d.toHubId)).toBe(true);
      if (d.raidKey) expect(raidKeys.has(d.raidKey)).toBe(true);
      if (d.workItemKey) expect(keys.has(d.workItemKey)).toBe(true);
    }
    for (const m of data.milestones) {
      expect(deliverables.has(m.deliverableId)).toBe(true);
      for (const o of m.outcomeIds) expect(outcomes.has(o)).toBe(true);
      for (const k of m.workItemKeys) expect(keys.has(k)).toBe(true);
    }
    for (const run of data.pdlcRuns) {
      expect(deliverables.has(run.deliverableId)).toBe(true);
      for (const stage of Object.values(run.stages)) {
        for (const id of stage.evidenceIds) expect(evidence.has(id)).toBe(true);
        for (const review of stage.reviews) {
          if (review.reviewerId) expect(people.has(review.reviewerId)).toBe(true);
        }
      }
    }
    expect(data.pdlcRuns).toHaveLength(data.deliverables.length);
  });

  it('lists every Epic under exactly one deliverable', () => {
    const owners = new Map<string, string[]>();
    for (const d of data.deliverables) for (const k of d.epicKeys) owners.set(k, [...(owners.get(k) ?? []), d.id]);
    const epics = data.workItems.filter((w) => w.type === 'epic');
    for (const e of epics) expect(owners.get(e.key)).toHaveLength(1);
    // Jira's Deliverable ID agrees with the listing, except for the few Epics planted for rule R14.
    const planted = new Set(r14Epics.map((e) => e.key));
    expect(planted.size).toBeGreaterThanOrEqual(2);
    expect(planted.size).toBeLessThanOrEqual(4);
    for (const e of epics.filter((x) => !planted.has(x.key))) expect(e.deliverableId).toBe(owners.get(e.key)?.[0]);
  });

  it('shapes deliverables for the multi-Epic acceptance criteria', () => {
    expect(data.deliverables.filter((d) => d.epicKeys.length > 1).length).toBeGreaterThanOrEqual(8);
    const epicsByOutcome = new Map<string, Set<string>>();
    for (const w of data.workItems) if (w.outcomeId && w.epicKey) epicsByOutcome.set(w.outcomeId, (epicsByOutcome.get(w.outcomeId) ?? new Set()).add(w.epicKey));
    expect([...epicsByOutcome.values()].some((s) => s.size >= 2)).toBe(true);
  });

  it('has criteria and evidence for every deliverable that has started requirements work', () => {
    for (const d of data.deliverables.filter((x) => x.id !== WORKFLOW_DELIVERABLE_ID)) {
      expect(data.criteria.some((c) => data.outcomes.find((o) => o.id === c.outcomeId)?.deliverableId === d.id)).toBe(true);
    }
    const results = new Set(data.evidence.map((e) => e.result));
    expect(results).toEqual(new Set(['pass', 'fail', 'pending']));
  });

  it('spreads deliverables across stages, tiers and the year', () => {
    expect(new Set(data.deliverables.map((d) => d.pdlcStage)).size).toBe(5);
    expect(new Set(data.deliverables.map((d) => d.riskTier)).size).toBe(4);
    expect(data.deliverables.some((d) => d.plannedEnd < DEMO_CLOCK.today)).toBe(true);
    expect(data.deliverables.some((d) => d.plannedStart > DEMO_CLOCK.today)).toBe(true);
    expect(data.deliverables.some((d) => d.plannedEnd >= '2027-10-01')).toBe(true);
    expect(data.workItems.some((w) => w.assigneeType === 'agent' && !w.reviewerId)).toBe(true);
    expect(data.people.some((p) => p.id === PRESENTER_PERSON_ID)).toBe(true);
  });
});

describe('the pinned story records', () => {
  const result = computeAll(data, DEMO_CLOCK);
  const hero = data.deliverables.find((d) => d.id === HERO_DELIVERABLE_ID)!;

  it('builds the hero as in the design', () => {
    expect(hero.title).toBe('Counterparty exposure — stress scenario reconciliation');
    expect(hero.reportedRag).toBe('green');
    expect(hero.epicKeys).toHaveLength(3);
    const epicHubs = new Set(data.workItems.filter((w) => hero.epicKeys.includes(w.key)).map((w) => w.hubId));
    expect(epicHubs.size).toBe(2);
    const outcomes = data.outcomes.filter((o) => o.deliverableId === hero.id);
    expect(outcomes).toHaveLength(4);

    // 82% by points, computed here from the raw items (story-level, estimated).
    const stories = data.workItems.filter((w) => w.epicKey && hero.epicKeys.includes(w.epicKey) && w.type !== 'sub-task' && w.points !== null);
    const total = stories.reduce((s, w) => s + (w.points as number), 0);
    const closed = stories.filter((w) => w.statusCategory === 'done').reduce((s, w) => s + (w.points as number), 0);
    expect(Math.round((closed / total) * 100)).toBe(82);

    // Exactly one outcome fully accepted, with a business-acceptance record.
    const accepted = outcomes.filter((o) => {
      const mandatory = data.criteria.filter((c) => c.outcomeId === o.id && c.mandatory);
      return mandatory.length > 0 && mandatory.every((c) => c.state === 'accepted' && c.acceptedById);
    });
    expect(accepted).toHaveLength(1);
    expect(data.evidence.some((e) => e.deliverableId === hero.id && e.kind === 'business-acceptance' && e.outcomeId === accepted[0]!.id && e.result === 'pass')).toBe(true);
    // Two others reported on track with no acceptance recorded at all.
    const onTrackUnaccepted = outcomes.filter((o) => o.reportedStatus === 'on-track' && data.criteria.filter((c) => c.outcomeId === o.id).every((c) => c.state !== 'accepted'));
    expect(onTrackUnaccepted).toHaveLength(2);

    // A failing reconciliation test, missing control evidence, a nine-day-late dependency, a 23-day-old risk.
    expect(data.evidence.some((e) => e.deliverableId === hero.id && e.kind === 'test-result' && e.result === 'fail')).toBe(true);
    expect(data.evidence.some((e) => e.deliverableId === hero.id && e.kind === 'control-assessment')).toBe(false);
    const dep = data.dependencies.find((d) => d.toDeliverableId === hero.id && d.status === 'late')!;
    const hubOf = (id: string) => data.hubs.find((h) => h.id === id)!;
    expect(hubOf(dep.fromHubId).continent).not.toBe(hubOf(dep.toHubId).continent);
    expect((Date.parse(dep.committed!) - Date.parse(dep.needBy)) / 86_400_000).toBe(9);
    const risk = data.raid.find((r) => r.deliverableId === hero.id && r.kind === 'risk')!;
    expect(Math.round((Date.parse(DEMO_CLOCK.today) - Date.parse(risk.updated.slice(0, 10))) / 86_400_000)).toBe(23);
    expect(result.deliverables[hero.id]!.workCompletion).toMatchObject({ computable: true, value: { percent: 82 } });
  });

  it('builds the workflow story as in the design', () => {
    const d = data.deliverables.find((x) => x.id === WORKFLOW_DELIVERABLE_ID)!;
    expect(d.title).toBe('Limit-monitoring dashboard filters');
    expect(d.pmNodeId).toBeNull();
    expect(d.riskTier).toBe('T1');
    expect(d.pdlcStage).toBe('ideation-requirements');
    expect(d.epicKeys).toHaveLength(1);
    const stories = data.workItems.filter((w) => w.epicKey === d.epicKeys[0]);
    expect(stories.length).toBeGreaterThanOrEqual(2);
    expect(stories.length).toBeLessThanOrEqual(3);
    expect(data.evidence.some((e) => e.deliverableId === d.id)).toBe(false);
    const run = data.pdlcRuns.find((r) => r.deliverableId === d.id)!;
    expect(run.currentStage).toBe('ideation-requirements');
    expect(run.moves).toHaveLength(0);
  });
});

describe('integration with the engine', () => {
  const result = computeAll(data, DEMO_CLOCK);
  const rag = (id: string) => result.deliverableRag[id]!;
  const findingsFor = (id: string) => result.findings.filter((f) => f.deliverableId === id);

  it('computes the hero as designed', () => {
    const m = result.deliverables[HERO_DELIVERABLE_ID]!;
    expect(m.workCompletion).toMatchObject({ computable: true, value: { percent: 82 } });
    expect(m.acceptedOutcomes).toMatchObject({ computable: true, value: { acceptedCount: 1, totalCount: 4 } });
    expect(m.readiness.state).toBe('not-ready');
    expect(rag(HERO_DELIVERABLE_ID).reported).toBe('green');
    expect(rag(HERO_DELIVERABLE_ID).evidence).toBe('red');
    const rules = new Set(findingsFor(HERO_DELIVERABLE_ID).map((f) => f.ruleId));
    for (const r of ['R5', 'R6', 'R11', 'R13', 'R4'] as RuleId[]) expect(rules.has(r)).toBe(true);
  });

  it('computes the workflow story as unknown with no critical findings', () => {
    expect(result.deliverables[WORKFLOW_DELIVERABLE_ID]!.readiness.state).toBe('unknown');
    expect(findingsFor(WORKFLOW_DELIVERABLE_ID).filter((f) => f.severity === 'critical')).toEqual([]);
  });

  it('is a believable book: mostly green, some amber, few red', () => {
    const counts = { red: 0, amber: 0, green: 0, unknown: 0 };
    for (const d of data.deliverables) counts[rag(d.id).evidence] += 1;
    const n = data.deliverables.length;
    expect(counts.green / n).toBeGreaterThanOrEqual(0.5);
    expect(counts.green / n).toBeLessThanOrEqual(0.68);
    expect(counts.amber / n).toBeGreaterThanOrEqual(0.15);
    expect(counts.amber / n).toBeLessThanOrEqual(0.32);
    expect(counts.red / n).toBeGreaterThanOrEqual(0.08);
    expect(counts.red / n).toBeLessThanOrEqual(0.2);
    expect(counts.unknown).toBeLessThanOrEqual(2);
  });

  it('has four to six deliverables reported green where evidence says red or amber', () => {
    const disagreeing = data.deliverables.filter((d) => d.reportedRag === 'green' && ['red', 'amber'].includes(rag(d.id).evidence));
    expect(disagreeing.length).toBeGreaterThanOrEqual(4);
    expect(disagreeing.length).toBeLessThanOrEqual(6);
    expect(disagreeing.map((d) => d.id)).toContain(HERO_DELIVERABLE_ID);
  });

  it('gives every rule a few natural hits and none a flood', () => {
    const counts = new Map<RuleId, number>();
    for (const f of result.findings) counts.set(f.ruleId, (counts.get(f.ruleId) ?? 0) + 1);
    for (let i = 1; i <= 16; i += 1) {
      const rule = `R${i}` as RuleId;
      expect(counts.get(rule) ?? 0, rule).toBeGreaterThanOrEqual(2);
      expect(counts.get(rule) ?? 0, rule).toBeLessThanOrEqual(25);
    }
  });

  it('has a spread of readiness, with completed final-stage work ready', () => {
    const counts = { ready: 0, 'not-ready': 0, unknown: 0 };
    for (const d of data.deliverables) counts[result.deliverables[d.id]!.readiness.state] += 1;
    expect(counts.ready).toBeGreaterThanOrEqual(8);
    expect(counts.ready).toBeLessThanOrEqual(10);
    expect(counts['not-ready']).toBeGreaterThanOrEqual(3);
    expect(counts['not-ready']).toBeLessThanOrEqual(5);
    expect(counts.unknown).toBeGreaterThan(0);
    const completedFinal = data.deliverables.filter((d) => d.pdlcStage === 'delivery-launch' && data.outcomes.filter((o) => o.deliverableId === d.id).every((o) => o.reportedStatus === 'complete'));
    const pending = completedFinal.filter((d) => result.deliverables[d.id]!.readiness.state !== 'ready');
    expect(completedFinal.length).toBeGreaterThanOrEqual(8);
    expect(pending.length).toBeLessThanOrEqual(2);
  });

  it('produces R11 for the hero and the deliberate disagreements, not for healthy in-flight work', () => {
    const r11 = new Set(result.findings.filter((f) => f.ruleId === 'R11').map((f) => f.deliverableId));
    for (const id of [HERO_DELIVERABLE_ID, 'td-1005', 'td-1008', 'td-1009', 'td-1014', 'td-2006']) expect(r11.has(id), id).toBe(true);
    expect(r11.size).toBeLessThanOrEqual(8);
  });
});

describe('the Core Four', () => {
  const result = computeAll(data, DEMO_CLOCK);
  const roles = ['product-manager', 'tech-lead', 'risk-lead', 'ux-lead'] as const;
  const byId = (id: string) => data.deliverables.find((d) => d.id === id)!;
  const distinct = (id: string) => new Set(roles.map((r) => byId(id).coreTeam[r]?.personId)).size;

  it('gives every deliverable four different people except the deliberate gaps', () => {
    const missing = data.deliverables.filter((d) => roles.some((r) => !d.coreTeam[r])).map((d) => d.id).sort();
    expect(missing).toEqual(['td-1007', 'td-1014', 'td-1019']);
    expect(byId('td-1014').coreTeam['risk-lead']).toBeUndefined();
    expect(['T3', 'T4']).toContain(byId('td-1014').riskTier);
    const shared = data.deliverables.filter((d) => roles.every((r) => d.coreTeam[r]) && distinct(d.id) < 4).map((d) => d.id);
    expect(shared).toEqual(['td-1005']);
    for (const d of data.deliverables.filter((x) => !['td-1007', 'td-1014', 'td-1019', 'td-1005'].includes(x.id))) expect(distinct(d.id), d.id).toBe(4);
  });

  it('pins a complete Core Four on the hero and the walk-through, with the presenter as walk-through Product Manager', () => {
    expect(distinct(HERO_DELIVERABLE_ID)).toBe(4);
    expect(distinct(WORKFLOW_DELIVERABLE_ID)).toBe(4);
    expect(byId(WORKFLOW_DELIVERABLE_ID).coreTeam['product-manager']?.personId).toBe(PRESENTER_PERSON_ID);
    for (const id of [HERO_DELIVERABLE_ID, WORKFLOW_DELIVERABLE_ID]) {
      expect(result.findings.filter((f) => f.deliverableId === id && (f.ruleId === 'R15' || f.ruleId === 'R16'))).toEqual([]);
    }
  });

  it('makes each outcome\'s acceptance owner its deliverable\'s Product Manager', () => {
    for (const o of data.outcomes) expect(o.acceptanceOwnerId, o.id).toBe(byId(o.deliverableId).coreTeam['product-manager']?.personId);
  });

  it('flags exactly the deliberate gaps, high only for the T3 deliverable missing its risk lead', () => {
    const r15 = result.findings.filter((f) => f.ruleId === 'R15');
    expect(r15.map((f) => `${f.deliverableId}:${f.severity}`).sort()).toEqual(['td-1005:medium', 'td-1007:medium', 'td-1014:high', 'td-1019:medium']);
    const r16 = result.findings.filter((f) => f.ruleId === 'R16');
    expect(r16.map((f) => f.deliverableId).sort()).toEqual(['td-1007', 'td-1009', 'td-1014', 'td-1019', 'td-2005']);
    for (const f of r16) expect(f.severity).toBe('medium');
  });

  it('records seeded review decisions by the role holders in order, the Product Manager last', () => {
    for (const run of data.pdlcRuns) {
      const d = byId(run.deliverableId);
      for (const stage of Object.values(run.stages)) {
        const decided = stage.reviews.flatMap((r) => r.decisions);
        for (const dec of decided) expect(dec.reviewerId).toBe(d.coreTeam[dec.roleId]?.personId);
        const times = decided.map((x) => x.decidedAt);
        expect(times).toEqual([...times].sort());
        if (decided.length > 0) expect(stage.reviews.at(-1)!.roleId).toBe('product-manager');
      }
    }
  });
});

describe('forecast plausibility', () => {
  const result = computeAll(data, DEMO_CLOCK);
  const slipOf = (id: string): number => result.plan.spans.find((sp) => sp.level === 'deliverable' && sp.entity.id === id)!.slipDays;
  it('keeps every in-flight deliverable within 30 days of its planned end', () => {
    const inFlight = data.deliverables.filter((d) => {
      const m = result.deliverables[d.id]!.workCompletion;
      return d.plannedStart <= DEMO_CLOCK.today && m.computable && m.value.closedPoints < m.value.totalPoints;
    });
    expect(inFlight.length).toBeGreaterThanOrEqual(10);
    for (const d of inFlight) {
      const slip = slipOf(d.id);
      expect(slip, d.id).toBeGreaterThanOrEqual(-30);
      expect(slip, d.id).toBeLessThanOrEqual(30);
    }
  });
});

describe('PDLC runs', () => {
  const order = ['ideation-requirements', 'design-specifications', 'risk-control-compliance', 'build-test-validate', 'delivery-launch'] as const;
  it('records earlier stages as approved and the current review consistently with progress', () => {
    for (const run of data.pdlcRuns) {
      const current = order.indexOf(run.currentStage);
      expect(run.stages[run.currentStage].status).not.toBe('not-started');
      order.slice(0, current).forEach((id) => {
        expect(run.stages[id].status).toBe('approved');
        for (const review of run.stages[id].reviews) expect(review.state).toBe('approved');
      });
    }
    for (const d of data.deliverables.filter((x) => x.pdlcStage === 'delivery-launch')) {
      const run = data.pdlcRuns.find((r) => r.deliverableId === d.id)!;
      for (const review of run.stages['delivery-launch'].reviews) expect(review.state).not.toBe('not-requested');
    }
    const mid = data.pdlcRuns.filter((r) => ['risk-control-compliance', 'build-test-validate'].includes(r.currentStage));
    expect(mid.some((r) => r.stages[r.currentStage].reviews.some((rv) => rv.state === 'pending'))).toBe(true);
  });
});

describe('no placeholder or banned text', () => {
  const strings: string[] = [];
  const walk = (value: unknown): void => {
    if (typeof value === 'string') strings.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(data);
  it('contains no generic placeholder strings', () => {
    expect(strings.length).toBeGreaterThan(1000);
    const bad = strings.filter((s) => /todo|lorem|ipsum|tbd|placeholder|deliverable \d+$/i.test(s));
    expect(bad).toEqual([]);
  });
});
