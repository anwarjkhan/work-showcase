/**
 * STUB — replaced wholesale by deliverable D2 (Synthetic portfolio).
 *
 * A deliberately tiny, hand-written dataset so the shell, placeholders and
 * static params work before D2 lands. D2 replaces everything in
 * lib/data/synthetic/ but must keep this module's public contract:
 *
 *   export const DEFAULT_SEED: number;
 *   export function createSyntheticPortfolio(seed?: number): PortfolioData;
 *
 * and must use the pinned story ids in lib/config/story.ts.
 */
import { DEMO_CLOCK } from '@/lib/config/clock';
import { createPdlcRun } from '@/lib/config/pdlc';
import { HERO_DELIVERABLE_ID, HERO_PROGRAMME_ID, PRESENTER_PERSON_ID, WORKFLOW_DELIVERABLE_ID } from '@/lib/config/story';
import type {
  AcceptanceCriterion,
  Evidence,
  Hub,
  Outcome,
  Person,
  PortfolioData,
  TechDeliverable,
  WorkItem,
} from '@/lib/types';

export const DEFAULT_SEED = 20270308;

const T0 = '2027-01-04T09:00:00.000Z';

function workItem(partial: Partial<WorkItem> & Pick<WorkItem, 'key' | 'type' | 'summary'>): WorkItem {
  return {
    status: 'To Do',
    statusCategory: 'to-do',
    deliverableId: null,
    epicKey: null,
    outcomeId: null,
    parentKey: null,
    assigneeType: 'human',
    assigneeId: 'p-eng-1',
    reviewerId: null,
    podId: 'pod-risk-ldn',
    hubId: 'hub-ldn',
    sprintId: 'spr-2027-04',
    points: null,
    riskTier: null,
    created: T0,
    updated: T0,
    due: null,
    resolved: null,
    startDate: null,
    targetDate: null,
    ownerId: null,
    labels: [],
    ...partial,
  };
}

const hubs: Hub[] = [
  { id: 'hub-ldn', name: 'London', city: 'London', country: 'United Kingdom', continent: 'europe', latitude: 51.51, longitude: -0.13, timeZone: 'Europe/London' },
  { id: 'hub-sgp', name: 'Singapore', city: 'Singapore', country: 'Singapore', continent: 'asia', latitude: 1.35, longitude: 103.82, timeZone: 'Asia/Singapore' },
  { id: 'hub-nyc', name: 'New York', city: 'New York', country: 'United States', continent: 'north-america', latitude: 40.71, longitude: -74.01, timeZone: 'America/New_York' },
];

const people: Person[] = [
  { id: PRESENTER_PERSON_ID, name: 'Alex Morgan', title: 'Head of delivery (presenter)', roles: ['delivery-lead', 'business-owner'], hubId: 'hub-ldn', podId: null, initials: 'AM' },
  { id: 'p-owner-1', name: 'Priya Raman', title: 'Programme lead', roles: ['programme-lead', 'investment-owner'], hubId: 'hub-ldn', podId: null, initials: 'PR' },
  { id: 'p-eng-1', name: 'Tomás Silva', title: 'Engineer', roles: ['engineer'], hubId: 'hub-ldn', podId: 'pod-risk-ldn', initials: 'TS' },
  { id: 'p-val-1', name: 'Mei Lin Tan', title: 'Independent validator', roles: ['independent-validator'], hubId: 'hub-sgp', podId: 'pod-data-sgp', initials: 'MT' },
  { id: 'p-ctl-1', name: 'Jordan Ellis', title: 'Control owner', roles: ['control-owner', 'risk-manager'], hubId: 'hub-nyc', podId: null, initials: 'JE' },
];

const deliverables: TechDeliverable[] = [
  {
    id: HERO_DELIVERABLE_ID,
    ref: 'TD-1001',
    title: 'Counterparty exposure — stress scenario reconciliation',
    summary: 'Reconcile stressed counterparty exposures between the risk engine and the reporting layer.',
    pmNodeId: HERO_PROGRAMME_ID,
    investmentRequestId: 'ir-ccr',
    epicKeys: ['CCR-100', 'CCR-200', 'CCR-300'],
    template: 'advanced',
    reportedRag: 'green',
    reportedAt: '2027-03-01',
    reportedCommentary: 'On track for quarter-end.',
    pdlcStage: 'build-test-validate',
    riskTier: 'T3',
    hubIds: ['hub-ldn', 'hub-sgp'],
    podId: 'pod-risk-ldn',
    ownerId: 'p-owner-1',
    reviewers: { 'requirements-owner': 'p-owner-1', 'design-reviewer': 'p-owner-1', 'control-owner': 'p-ctl-1', 'independent-validator': 'p-val-1', 'business-owner': PRESENTER_PERSON_ID, 'release-owner': 'p-owner-1' },
    plannedStart: '2027-01-04',
    plannedEnd: '2027-03-31',
    reportedForecastEnd: '2027-03-31',
  },
  {
    id: WORKFLOW_DELIVERABLE_ID,
    ref: 'TD-2001',
    title: 'Limit-monitoring dashboard filters',
    summary: 'Add desk and limit-type filters to the limit-monitoring dashboard.',
    pmNodeId: null,
    investmentRequestId: 'ir-limits',
    epicKeys: ['LIM-10'],
    template: 'rapid',
    reportedRag: 'green',
    reportedAt: '2027-03-01',
    reportedCommentary: 'Starting requirements.',
    pdlcStage: 'ideation-requirements',
    riskTier: 'T1',
    hubIds: ['hub-nyc'],
    podId: 'pod-data-sgp',
    ownerId: PRESENTER_PERSON_ID,
    reviewers: { 'requirements-owner': PRESENTER_PERSON_ID, 'design-reviewer': 'p-owner-1', 'control-owner': 'p-ctl-1', 'independent-validator': 'p-val-1', 'business-owner': PRESENTER_PERSON_ID, 'release-owner': 'p-owner-1' },
    plannedStart: '2027-03-01',
    plannedEnd: '2027-04-30',
    reportedForecastEnd: null,
  },
  {
    id: 'td-1002',
    ref: 'TD-1002',
    title: 'Exposure data lineage for regulatory reporting',
    summary: 'Lineage from trade capture to regulatory exposure figures.',
    pmNodeId: HERO_PROGRAMME_ID,
    investmentRequestId: 'ir-ccr',
    epicKeys: ['CCR-400'],
    template: 'advanced',
    reportedRag: 'amber',
    reportedAt: '2027-03-01',
    reportedCommentary: 'Lineage tooling onboarding slower than planned.',
    pdlcStage: 'design-specifications',
    riskTier: 'T4',
    hubIds: ['hub-sgp'],
    podId: 'pod-data-sgp',
    ownerId: 'p-owner-1',
    reviewers: { 'design-reviewer': 'p-owner-1', 'control-owner': 'p-ctl-1' },
    plannedStart: '2027-02-01',
    plannedEnd: '2027-06-30',
    reportedForecastEnd: '2027-07-15',
  },
];

const outcomes: Outcome[] = [1, 2, 3, 4].map((n) => ({
  id: `oc-1001-${n}`,
  ref: `OC-1001-${n}`,
  deliverableId: HERO_DELIVERABLE_ID,
  title: ['Scenario set agreed', 'Exposure deltas reconciled', 'Breaks explained to users', 'Control evidence filed'][n - 1] ?? '',
  description: '',
  weight: 1,
  dueDate: '2027-03-31',
  reportedStatus: n === 1 ? 'complete' : n === 4 ? 'at-risk' : 'on-track',
  acceptanceOwnerId: PRESENTER_PERSON_ID,
}));

const criteria: AcceptanceCriterion[] = outcomes.map((o, i) => ({
  id: `ac-${o.id}-1`,
  outcomeId: o.id,
  text: `Business owner confirms "${o.title}"`,
  mandatory: true,
  state: i === 0 ? 'accepted' : 'open',
  acceptedById: i === 0 ? PRESENTER_PERSON_ID : null,
  acceptedAt: i === 0 ? '2027-02-12T10:00:00.000Z' : null,
  rejectedById: null,
  rejectionReason: null,
}));

const workItems: WorkItem[] = [
  workItem({ key: 'CCR-100', type: 'epic', summary: 'Stress scenario ingestion', deliverableId: HERO_DELIVERABLE_ID, status: 'In Progress', statusCategory: 'in-progress' }),
  workItem({ key: 'CCR-200', type: 'epic', summary: 'Exposure reconciliation engine', deliverableId: HERO_DELIVERABLE_ID, status: 'In Progress', statusCategory: 'in-progress' }),
  workItem({ key: 'CCR-300', type: 'epic', summary: 'Market-data feed (partner hub)', deliverableId: HERO_DELIVERABLE_ID, hubId: 'hub-sgp', podId: 'pod-data-sgp' }),
  workItem({ key: 'CCR-101', type: 'story', summary: 'Load scenario definitions', epicKey: 'CCR-100', parentKey: 'CCR-100', outcomeId: 'oc-1001-1', points: 8, status: 'Done', statusCategory: 'done', resolved: '2027-02-10T12:00:00.000Z' }),
  workItem({ key: 'CCR-201', type: 'story', summary: 'Compute exposure deltas', epicKey: 'CCR-200', parentKey: 'CCR-200', outcomeId: 'oc-1001-2', points: 13, status: 'Done', statusCategory: 'done', resolved: '2027-03-01T12:00:00.000Z' }),
  workItem({ key: 'CCR-202', type: 'story', summary: 'Break explanation view', epicKey: 'CCR-200', parentKey: 'CCR-200', outcomeId: 'oc-1001-3', points: 5, assigneeType: 'agent', assigneeId: 'ai-status-01', reviewerId: 'p-eng-1' }),
  workItem({ key: 'CCR-301', type: 'task', summary: 'Stressed market-data extract', epicKey: 'CCR-300', parentKey: 'CCR-300', outcomeId: 'oc-1001-2', points: 3, hubId: 'hub-sgp', due: '2027-02-27' }),
  workItem({ key: 'CCR-400', type: 'epic', summary: 'Lineage capture', deliverableId: 'td-1002', hubId: 'hub-sgp', podId: 'pod-data-sgp' }),
  workItem({ key: 'LIM-10', type: 'epic', summary: 'Dashboard filters', deliverableId: WORKFLOW_DELIVERABLE_ID, hubId: 'hub-nyc', podId: 'pod-data-sgp' }),
];

const evidence: Evidence[] = [
  { id: 'ev-1001-tr', kind: 'test-result', title: 'Reconciliation regression suite', deliverableId: HERO_DELIVERABLE_ID, outcomeId: 'oc-1001-2', workItemKey: 'CCR-201', stageId: 'build-test-validate', result: 'fail', source: 'test-harness', sourceRef: 'RUN-5521', observedAt: '2027-03-05T18:00:00.000Z', recordedById: null, provenance: 'sample' },
  { id: 'ev-1001-ba', kind: 'business-acceptance', title: 'Scenario set acceptance', deliverableId: HERO_DELIVERABLE_ID, outcomeId: 'oc-1001-1', workItemKey: null, stageId: 'delivery-launch', result: 'pass', source: 'document-store', sourceRef: 'DOC-118', observedAt: '2027-02-12T10:00:00.000Z', recordedById: PRESENTER_PERSON_ID, provenance: 'sample' },
];

/** Builds the stub snapshot. The seed is accepted for contract compatibility and ignored. */
export function createSyntheticPortfolio(seed: number = DEFAULT_SEED): PortfolioData {
  return {
    meta: {
      sourceId: 'synthetic',
      sourceKind: 'stub',
      seed,
      generatedAt: DEMO_CLOCK.now,
      asOf: DEMO_CLOCK.today,
      freshness: [
        { system: 'portfolio-system', lastSyncedAt: '2027-03-07T22:00:00.000Z', recordCount: 6 },
        { system: 'work-tracker', lastSyncedAt: '2027-03-08T06:00:00.000Z', recordCount: workItems.length },
      ],
      heroDeliverableId: HERO_DELIVERABLE_ID,
      workflowDeliverableId: WORKFLOW_DELIVERABLE_ID,
    },
    investmentRequests: [
      { id: 'ir-ccr', ref: 'IR-2027-001', title: 'Counterparty credit risk modernisation', objective: 'Modernise counterparty exposure calculation and reporting.', ownerId: 'p-owner-1', activityRisk: 'high', route: 'formal', theme: 'Counterparty credit risk', status: 'in-delivery', approvedOn: '2026-11-02' },
      { id: 'ir-limits', ref: 'IR-2027-006', title: 'Limit-monitoring usability', objective: 'Make limit breaches faster to find.', ownerId: PRESENTER_PERSON_ID, activityRisk: 'low', route: 'standalone', theme: 'Price risk controls', status: 'in-delivery', approvedOn: '2027-02-15' },
    ],
    pmNodes: [
      { id: HERO_PROGRAMME_ID, ref: 'PG-CCR', title: 'Counterparty Credit Risk Modernisation', level: 'programme', parentId: null, investmentRequestId: 'ir-ccr', ownerId: 'p-owner-1', reportedRag: 'green', reportedAt: '2027-03-01', plannedStart: '2027-01-04', plannedEnd: '2027-12-17' },
    ],
    deliverables,
    outcomes,
    criteria,
    workItems,
    evidence,
    raid: [
      { id: 'raid-1001-1', key: 'CCR-R-07', kind: 'risk', title: 'Stressed market data arrives late from partner hub', description: '', deliverableId: HERO_DELIVERABLE_ID, ownerId: 'p-owner-1', severity: 'high', status: 'open', created: T0, updated: '2027-02-13T09:00:00.000Z', mitigationDue: '2027-03-12' },
    ],
    dependencies: [
      { id: 'dep-1', title: 'Stressed market-data extract', fromDeliverableId: 'td-1002', toDeliverableId: HERO_DELIVERABLE_ID, fromHubId: 'hub-sgp', toHubId: 'hub-ldn', needBy: '2027-02-27', committed: '2027-03-08', deliveredOn: null, status: 'late', critical: true, raidKey: 'CCR-R-07', workItemKey: 'CCR-301', origin: 'reported' },
    ],
    milestones: [
      { id: 'ms-1001-1', deliverableId: HERO_DELIVERABLE_ID, title: 'Quarter-end stress run', date: '2027-03-19', regulatory: true, status: 'planned', outcomeIds: [], workItemKeys: [] },
    ],
    hubs,
    pods: [
      { id: 'pod-risk-ldn', name: 'Risk analytics', hubId: 'hub-ldn', focus: 'Exposure calculation', memberIds: ['p-eng-1'], agentIdentityIds: ['ai-status-01'], leadId: 'p-owner-1' },
      { id: 'pod-data-sgp', name: 'Market data', hubId: 'hub-sgp', focus: 'Market and reference data', memberIds: ['p-val-1'], agentIdentityIds: [], leadId: 'p-val-1' },
    ],
    people,
    agentIdentities: [{ id: 'ai-status-01', agentId: 'status-reporting', handle: 'agent-status-01', podId: 'pod-risk-ldn', hubId: 'hub-ldn', accountableOwnerId: 'p-owner-1' }],
    sprints: Array.from({ length: 26 }, (_, i) => {
      const start = new Date(Date.UTC(2027, 0, 4 + i * 14));
      const end = new Date(start.getTime() + 13 * 86_400_000);
      const n = String(i + 1).padStart(2, '0');
      return { id: `spr-2027-${n}`, name: `2027 S${n}`, index: i + 1, start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
    }),
    pdlcRuns: deliverables.map((d) => createPdlcRun(d, d.pdlcStage, T0)),
  };
}
