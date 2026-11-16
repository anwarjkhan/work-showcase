/**
 * RAID items, cross-deliverable dependencies and milestones for the generated
 * deliverables. The hero and workflow story keep their own records in story.ts;
 * the hero's late market-data dependency is declared here so every dependency
 * lives in one list.
 */
import { HERO_DELIVERABLE_ID } from '@/lib/config/story';
import type { Dependency, DependencyStatus, Milestone, RaidItem, RaidKind, Severity, WorkItem } from '@/lib/types';
import { PROJECT_KEYS, type DeliverableSpec } from './catalogue';
import { addDays, dateAtFraction, stampOn, TODAY } from './dates';
import type { Hierarchy } from './hierarchy';
import type { OutcomePlan } from './outcomes';
import type { Rng } from './random';
import type { Reference } from './reference';
import { isStoryLevel } from './workitems';

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

interface DependencySpec {
  from: string;
  to: string;
  title: string;
  needBy: string;
  committed: string | null;
  status: DependencyStatus;
  critical?: boolean;
  deliveredOn?: string;
  workItemKey?: string;
  raidKey?: string;
}

/** `from` provides, `to` receives. Hubs come from each deliverable's lead hub. */
const DEPENDENCY_SPECS: DependencySpec[] = [
  { from: 'td-1016', to: HERO_DELIVERABLE_ID, title: 'Stressed market-data extract for scenario reconciliation', needBy: '2027-02-27', committed: '2027-03-08', status: 'late', critical: true, workItemKey: 'CCR-301', raidKey: 'CCR-R-07' },
  { from: 'td-1017', to: 'td-1008', title: 'Legal entity golden source for default risk grouping', needBy: '2027-04-30', committed: '2027-02-19', status: 'delivered', deliveredOn: '2027-02-19' },
  { from: 'td-1018', to: 'td-1008', title: 'Trade and position feed quality attestations', needBy: '2027-03-12', committed: '2027-03-26', status: 'late', critical: true },
  { from: 'td-1016', to: 'td-1007', title: 'Stressed and historical curves for sensitivity calculation', needBy: '2027-05-14', committed: '2027-05-07', status: 'on-track' },
  { from: 'td-1019', to: 'td-1007', title: 'Intraday position deltas for desk capital', needBy: '2027-07-30', committed: '2027-07-23', status: 'on-track' },
  { from: 'td-1002', to: 'td-1010', title: 'Lineage metadata for the desk capital pack', needBy: '2027-06-18', committed: '2027-06-11', status: 'on-track' },
  { from: 'td-1013', to: 'td-1014', title: 'Intercompany reconciliation outputs for accrual attestation', needBy: '2027-03-26', committed: '2027-04-09', status: 'late' },
  { from: 'td-1017', to: 'td-1012', title: 'Reference data feed for chart-of-accounts mapping', needBy: '2027-02-12', committed: '2027-02-10', status: 'delivered', deliveredOn: '2027-02-10' },
  { from: 'td-1015', to: 'td-1012', title: 'Derivative subledger posting rules for the parallel run', needBy: '2027-03-31', committed: '2027-02-26', status: 'delivered', deliveredOn: '2027-02-26' },
  { from: 'td-1004', to: 'td-1005', title: 'Wrong-way flag feed for CVA sensitivities', needBy: '2027-04-23', committed: '2027-04-30', status: 'at-risk' },
  { from: 'td-1003', to: HERO_DELIVERABLE_ID, title: 'Collateral dispute log feeding exposure adjustments', needBy: '2027-03-26', committed: '2027-03-24', status: 'on-track' },
  { from: 'td-1018', to: 'td-1009', title: 'Risk factor observation quality scorecards', needBy: '2027-04-02', committed: '2027-04-02', status: 'on-track' },
  { from: 'td-1019', to: 'td-1018', title: 'Streaming schema registry entries for rule execution', needBy: '2027-05-28', committed: '2027-05-21', status: 'on-track' },
  { from: 'td-1016', to: 'td-1019', title: 'Curve snapshot interface for streaming consumers', needBy: '2027-06-11', committed: '2027-06-04', status: 'on-track' },
  { from: 'td-1017', to: 'td-1014', title: 'Entity hierarchy for accrual ownership', needBy: '2027-04-16', committed: '2027-02-19', status: 'delivered', deliveredOn: '2027-02-19' },
  { from: 'td-1009', to: 'td-1007', title: 'Risk factor eligibility results for non-modellable charges', needBy: '2027-05-28', committed: '2027-05-21', status: 'on-track' },
  { from: 'td-1010', to: 'td-1011', title: 'Desk capital pack template for attribution reporting', needBy: '2027-06-25', committed: '2027-06-18', status: 'on-track' },
  { from: 'td-1012', to: 'td-1013', title: 'Chart-of-accounts mapping tables for intercompany matching', needBy: '2027-03-19', committed: '2027-03-19', status: 'on-track' },
  { from: 'td-2002', to: 'td-2003', title: 'Exception ageing metrics for the evidence export', needBy: '2027-03-05', committed: '2027-03-02', status: 'delivered', deliveredOn: '2027-03-02' },
  { from: 'td-2005', to: 'td-2004', title: 'Stress run scheduler interface for library tagging', needBy: '2027-06-04', committed: '2027-05-28', status: 'on-track' },
  { from: 'td-2006', to: 'td-2005', title: 'Reverse stress export format for the scheduler', needBy: '2027-05-14', committed: '2027-05-07', status: 'on-track' },
  { from: 'td-1016', to: 'td-2002', title: 'Vendor quote snapshots for exception ageing', needBy: '2027-03-26', committed: '2027-03-26', status: 'on-track' },
  { from: 'td-1017', to: 'td-1002', title: 'Legal entity identifiers for lineage nodes', needBy: '2027-03-15', committed: '2027-02-19', status: 'delivered', deliveredOn: '2027-02-19' },
  { from: 'td-1006', to: 'td-1004', title: 'Netting agreement flags for wrong-way checks', needBy: '2027-04-09', committed: '2027-04-02', status: 'on-track' },
  { from: 'td-1018', to: 'td-1013', title: 'Quality rule results for intercompany balances', needBy: '2027-03-31', committed: '2027-03-29', status: 'on-track' },
  { from: 'td-1005', to: 'td-1003', title: 'CVA sensitivities for collateral dispute valuation', needBy: '2027-04-23', committed: '2027-04-16', status: 'on-track' },
  { from: 'td-1012', to: 'td-1014', title: 'Trial balance snapshots for accrual testing', needBy: '2027-04-09', committed: '2027-04-09', status: 'on-track' },
  { from: 'td-2004', to: 'td-2006', title: 'Scenario tag taxonomy for the reverse stress export', needBy: '2027-04-02', committed: '2027-03-26', status: 'on-track' },
  { from: 'td-1011', to: 'td-1010', title: 'Attribution results for the desk capital pack', needBy: '2027-09-17', committed: '2027-09-10', status: 'on-track' },
  { from: 'td-1019', to: 'td-1009', title: 'Intraday feed samples for eligibility testing', needBy: '2027-03-26', committed: '2027-04-02', status: 'at-risk' },
];

// ---------------------------------------------------------------------------
// RAID vocabulary
// ---------------------------------------------------------------------------

const RISKS = [
  'Test environment capacity limits the overnight regression runs',
  'Key engineer availability drops during the quarter-end freeze',
  'Source system changes late and invalidate the {obj} mapping',
  'Volumes for {obj} are higher than the performance test assumed',
  'Independent validation slot is not confirmed before the planned review date',
  'Interface specification for {obj} is not yet signed off by the provider',
  'Data quality of {obj} is below the level the design assumes',
  'Regulatory interpretation of {obj} may change before release',
];
const ASSUMPTIONS = [
  'Production-sized test data for {obj} is available from February',
  'Business owners can attend the weekly acceptance sessions',
  'The existing entitlements model covers the new users',
  'The platform team keeps the agreed release cadence',
  'Legal and compliance review {obj} within five working days',
];
const ISSUES = [
  'Defects in {obj} reopen after each environment refresh',
  'Access to the user acceptance environment is delayed for the Asia team',
  'Reference data for {obj} contains duplicates that block testing',
  'Overnight batch window overruns on month-end',
];
const IMPACTS = [
  'If unmanaged it puts the next milestone at risk.',
  'The pod reviews mitigation in the weekly delivery meeting.',
  'The impact falls mainly on the later outcomes.',
  'A workaround exists but adds manual effort for operations.',
  'Owners are agreed and the mitigation is under way.',
];

const DUPLICATE_PAIRS: Record<string, [string, string]> = {
  'td-1003': ['Test environment capacity limits the overnight regression runs', 'Test environment capacity limits overnight regression runs'],
  'td-1012': ['Parallel run balances cannot be refreshed during the close window', 'Parallel run balances cannot be refreshed inside the close window'],
  'td-1018': ['Quality rule results are delayed by slow feed loads', 'Quality rule results are delayed by slow feed loads overnight'],
};

/** Planted RAID conditions (R4): no owner, no mitigation date, or no update for over a fortnight. */
const NO_OWNER = new Set(['td-1004', 'td-1010', 'td-2005']);
const NO_MITIGATION_DATE = new Set(['td-1008', 'td-1014', 'td-1019']);
const STALE_UPDATE = new Set(['td-1002', 'td-1005', 'td-1007', 'td-1012', 'td-1016', 'td-1018']);

export interface RaidPlan {
  raid: RaidItem[];
  dependencies: Dependency[];
  milestones: Milestone[];
}

function fill(template: string, obj: string): string {
  return template.replace('{obj}', obj);
}

export function buildRaidAndDependencies(root: Rng, hierarchy: Hierarchy, ref: Reference, plan: OutcomePlan, items: WorkItem[]): RaidPlan {
  const rng = root.fork('raid');
  const raid: RaidItem[] = [];
  const raidCounters: Record<string, number> = { CCR: 12, FRT: 1, LED: 1, DAT: 1, STR: 1, LIM: 2 };
  const nextRaidKey = (spec: DeliverableSpec): string => {
    const prefix = PROJECT_KEYS[spec.programme];
    const n = raidCounters[prefix] as number;
    raidCounters[prefix] = n + 1;
    return `${prefix}-R-${String(n).padStart(2, '0')}`;
  };
  const specOf = (id: string): DeliverableSpec => hierarchy.specs.get(id) as DeliverableSpec;
  const deliverableOf = (id: string) => hierarchy.deliverables.find((d) => d.id === id)!;
  const podLead = (podId: string): string => ref.pods.find((p) => p.id === podId)?.leadId as string;

  const itemsByDeliverable = new Map<string, WorkItem[]>();
  for (const d of hierarchy.deliverables) {
    const keys = new Set(d.epicKeys);
    itemsByDeliverable.set(d.id, items.filter((i) => i.epicKey !== null && keys.has(i.epicKey)));
  }

  const addRaid = (
    spec: DeliverableSpec,
    kind: RaidKind,
    title: string,
    opts: { severity?: Severity; stale?: boolean; ownerless?: boolean; noDate?: boolean; closed?: boolean; key?: string; created?: string; updatedDaysAgo?: number } = {},
  ): RaidItem => {
    const dr = rng.fork(`${spec.id}-${raid.length}`);
    const deliverable = deliverableOf(spec.id);
    const severity: Severity = opts.severity ?? dr.weighted<Severity>([['low', 20], ['medium', 45], ['high', 28], ['critical', 7]]);
    const status = opts.closed ? 'closed' : dr.weighted<'open' | 'mitigating'>([['open', 5], ['mitigating', 4]]);
    const startFloor = spec.start < TODAY ? spec.start : addDays(TODAY, -30);
    const createdDate = opts.created ?? addDays(startFloor, dr.int(0, Math.max(1, Math.min(40, 60))));
    const safeCreated = createdDate > addDays(TODAY, -20) ? addDays(TODAY, -20) : createdDate;
    const updatedAgo = opts.updatedDaysAgo ?? (opts.stale ? dr.int(16, 38) : dr.int(1, 11));
    let updatedDate = addDays(TODAY, -updatedAgo);
    if (updatedDate < safeCreated) updatedDate = safeCreated;
    const item: RaidItem = {
      id: `raid-${spec.n}-${raid.filter((r) => r.deliverableId === spec.id).length + 1}`,
      key: opts.key ?? nextRaidKey(spec),
      kind,
      title,
      description: `${title}. ${dr.pick(IMPACTS)}`,
      deliverableId: spec.id,
      ownerId: opts.ownerless ? null : dr.chance(0.5) ? deliverable.ownerId : podLead(spec.podId),
      severity,
      status,
      created: stampOn(safeCreated, dr),
      updated: stampOn(updatedDate, dr),
      mitigationDue: opts.noDate ? null : opts.closed ? addDays(TODAY, -dr.int(3, 20)) : addDays(TODAY, dr.int(4, 50)),
    };
    raid.push(item);
    return item;
  };

  // ---- General RAID items ---------------------------------------------------
  for (const d of hierarchy.deliverables) {
    const spec = specOf(d.id);
    if (spec.pinned) continue;
    const dr = rng.fork(`general-${spec.id}`);
    const object = spec.objects[0] ?? 'the data';
    const flagged = { ownerless: NO_OWNER.has(spec.id), noDate: NO_MITIGATION_DATE.has(spec.id), stale: STALE_UPDATE.has(spec.id) };
    const healthyLaunch = spec.accepted === spec.outcomes.length && spec.outcomes.length > 0;

    const duplicate = DUPLICATE_PAIRS[spec.id];
    if (duplicate) {
      addRaid(spec, 'risk', duplicate[0], { severity: 'medium' });
      addRaid(spec, 'risk', duplicate[1], { severity: 'medium' });
    } else {
      const kind: RaidKind = dr.weighted<RaidKind>([['risk', 5], ['assumption', 2], ['issue', 3]]);
      const pool = kind === 'risk' ? RISKS : kind === 'assumption' ? ASSUMPTIONS : ISSUES;
      addRaid(spec, kind, fill(dr.pick(pool), object), { ...flagged, closed: healthyLaunch && dr.chance(0.6) });
    }
    if (spec.tier === 'T3' || spec.tier === 'T4') {
      const second = dr.pick([...RISKS, ...ASSUMPTIONS]);
      addRaid(spec, RISKS.includes(second) ? 'risk' : 'assumption', fill(second, spec.objects[1] ?? object), { closed: healthyLaunch });
    }
  }

  // ---- Dependencies ---------------------------------------------------------
  const leadHub = (id: string): string => deliverableOf(id).hubIds[0] as string;
  const dependencies: Dependency[] = DEPENDENCY_SPECS.map((spec, i) => {
    const toSpec = specOf(spec.to);
    const receiverItems = itemsByDeliverable.get(spec.to) ?? [];
    let workItemKey = spec.workItemKey ?? null;
    if (!workItemKey) {
      const open = receiverItems.filter((it) => isStoryLevel(it) && it.statusCategory !== 'done' && (it.type === 'task' || it.type === 'story'));
      const closed = receiverItems.filter((it) => isStoryLevel(it) && it.statusCategory === 'done');
      const dr = rng.fork(`dep-${i}`);
      const pool = spec.status === 'delivered' ? closed : open.length > 0 ? open : closed;
      workItemKey = pool.length > 0 ? dr.pick(pool).key : null;
    }
    let raidKey = spec.raidKey ?? null;
    if (!raidKey && (spec.status === 'late' || spec.status === 'blocked' || spec.status === 'at-risk')) {
      const item = addRaid(toSpec, 'dependency', `Dependency on ${spec.title.charAt(0).toLowerCase()}${spec.title.slice(1)} may slip past the need-by date`, {
        severity: spec.critical ? 'high' : 'medium',
        updatedDaysAgo: 2 + (i % 6),
      });
      raidKey = item.key;
    }
    return {
      id: `dep-${String(i + 1).padStart(2, '0')}`,
      title: spec.title,
      fromDeliverableId: spec.from,
      toDeliverableId: spec.to,
      fromHubId: leadHub(spec.from),
      toHubId: leadHub(spec.to),
      needBy: spec.needBy,
      committed: spec.committed,
      deliveredOn: spec.deliveredOn ?? null,
      status: spec.status,
      critical: spec.critical ?? false,
      raidKey,
      workItemKey,
      origin: 'reported',
    };
  });

  // ---- Milestones -----------------------------------------------------------
  const MILESTONE_TITLES: Record<string, [string, string, string]> = {
    ccr: ['Design authority approval', 'Credit risk user acceptance start', 'Production release'],
    frtb: ['Design authority approval', 'Regulatory dry run', 'Capital reporting go-live'],
    ledger: ['Mapping sign-off', 'Parallel run complete', 'Go-live at period end'],
    data: ['Design authority approval', 'Consumer onboarding complete', 'Platform release'],
    stress: ['Design sign-off', 'User acceptance testing exit', 'Release to analysts'],
    limits: ['Requirements sign-off', 'User acceptance testing exit', 'Release to desk heads'],
  };
  const R1_TITLES: Record<string, { title: string; regulatory: boolean }> = {
    'td-1005': { title: 'Hedging desk user acceptance start', regulatory: false },
    'td-1012': { title: 'Parallel run sign-off with finance', regulatory: false },
    'td-1014': { title: 'Accrual control attestation to the controllers', regulatory: true },
  };

  const milestones: Milestone[] = [];
  const completion = (deliverableId: string, outcomeId: string): number => {
    const own = (itemsByDeliverable.get(deliverableId) ?? []).filter((it) => it.outcomeId === outcomeId && it.points !== null);
    const total = own.reduce((sum, it) => sum + (it.points as number), 0);
    const closed = own.filter((it) => it.statusCategory === 'done').reduce((sum, it) => sum + (it.points as number), 0);
    return total === 0 ? 1 : closed / total;
  };

  for (const d of hierarchy.deliverables) {
    const spec = specOf(d.id);
    if (spec.pinned) continue;
    const dr = rng.fork(`ms-${spec.id}`);
    const titles = MILESTONE_TITLES[spec.programme] as [string, string, string];
    const fractions = spec.pmNodeId === null ? [0.55, 1] : [0.3, 0.68, 1];
    const chosenTitles = spec.pmNodeId === null ? [titles[1], titles[2]] : titles;
    fractions.forEach((f, i) => {
      let date = f >= 1 ? spec.end : dateAtFraction(spec.start, spec.end, f);
      const inWindow = date >= TODAY && date <= addDays(TODAY, 16);
      if (inWindow && spec.progress < 0.6) date = addDays(TODAY, 20 + dr.int(0, 6));
      const last = i === fractions.length - 1;
      let status: Milestone['status'] = date < TODAY ? 'met' : 'planned';
      if (spec.flags?.missedMilestone && last && date < TODAY) status = 'missed';
      milestones.push({
        id: `ms-${spec.n}-${i + 1}`,
        deliverableId: spec.id,
        title: chosenTitles[i] as string,
        date,
        regulatory: last && (spec.tier === 'T4' || (spec.tier === 'T3' && (spec.programme === 'frtb' || spec.programme === 'ccr'))),
        status,
        outcomeIds: [],
        workItemKeys: [],
      });
    });

    const planted = R1_TITLES[spec.id];
    if (spec.flags?.r1Milestone && planted) {
      const outcomes = plan.outcomes.filter((o) => o.deliverableId === spec.id);
      const lowest = [...outcomes].sort((a, b) => completion(spec.id, a.id) - completion(spec.id, b.id))[0];
      milestones.push({
        id: `ms-${spec.n}-${fractions.length + 1}`,
        deliverableId: spec.id,
        title: planted.title,
        date: addDays(TODAY, dr.int(5, 12)),
        regulatory: planted.regulatory,
        status: 'planned',
        outcomeIds: lowest ? [lowest.id] : [],
        workItemKeys: [],
      });
    }
  }
  return { raid, dependencies, milestones };
}
