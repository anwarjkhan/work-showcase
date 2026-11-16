/**
 * Hand-written records the demo story is pinned to (design section 3):
 *  - the hero deliverable "Counterparty exposure — stress scenario reconciliation"
 *  - the workflow-story deliverable "Limit-monitoring dashboard filters"
 * Nothing here is randomised.
 */
import { HERO_DELIVERABLE_ID, PRESENTER_PERSON_ID, WORKFLOW_DELIVERABLE_ID } from '@/lib/config/story';
import type {
  AcceptanceCriterion,
  Evidence,
  Milestone,
  Outcome,
  RaidItem,
  StatusCategory,
  WorkItem,
  WorkItemType,
} from '@/lib/types';
import { sprintEnd, sprintIdFor, stamp } from './dates';
import type { Reference } from './reference';

export interface StoryRecords {
  workItems: WorkItem[];
  outcomes: Outcome[];
  criteria: AcceptanceCriterion[];
  evidence: Evidence[];
  raid: RaidItem[];
  milestones: Milestone[];
}

type Row = {
  key: string;
  epic: string;
  outcome: string | null;
  type: WorkItemType;
  summary: string;
  points: number | null;
  status: 'Done' | 'In Progress' | 'In Review' | 'Blocked' | 'To Do';
  assignee: string;
  /** Resolved date for Done items, last update date otherwise. */
  on: string;
  created: string;
  due?: string | null;
  parent?: string;
  reviewer?: string | null;
};

const CATEGORY: Record<Row['status'], StatusCategory> = {
  Done: 'done',
  'In Progress': 'in-progress',
  'In Review': 'in-progress',
  Blocked: 'in-progress',
  'To Do': 'to-do',
};

export function buildStoryRecords(ref: Reference): StoryRecords {
  const personById = new Map(ref.people.map((p) => [p.id, p]));
  const agentById = new Map(ref.agentIdentities.map((a) => [a.id, a]));

  const toItem = (row: Row): WorkItem => {
    const agent = agentById.get(row.assignee);
    const person = personById.get(row.assignee);
    const category = CATEGORY[row.status];
    const hour = 9 + ((row.key.length + (row.points ?? 0)) % 8);
    const updated = stamp(row.on, hour, 15);
    const sprintDate = row.status === 'Done' ? row.on : row.status === 'To Do' ? '2027-03-15' : '2027-03-04';
    return {
      key: row.key,
      type: row.type,
      summary: row.summary,
      status: row.status,
      statusCategory: category,
      deliverableId: null,
      epicKey: row.epic,
      outcomeId: row.outcome,
      parentKey: row.parent ?? row.epic,
      assigneeType: agent ? 'agent' : 'human',
      assigneeId: row.assignee,
      reviewerId: row.reviewer === undefined ? null : row.reviewer,
      podId: agent ? agent.podId : (person?.podId ?? null),
      hubId: agent ? agent.hubId : (person?.hubId ?? null),
      sprintId: sprintIdFor(sprintDate),
      points: row.points,
      riskTier: null,
      created: stamp(row.created, 10, 0),
      updated,
      due: row.due ?? null,
      resolved: category === 'done' ? updated : null,
      startDate: null,
      targetDate: null,
      ownerId: null,
      labels: [],
    };
  };

  // =========================================================================
  // Hero: three Epics, two hubs, four outcomes, 82 of 100 points closed.
  // =========================================================================
  const heroEpic = (key: string, summary: string, hubId: string, podId: string, status: 'In Progress', updated: string): WorkItem => ({
    key,
    type: 'epic',
    summary,
    status,
    statusCategory: 'in-progress',
    deliverableId: HERO_DELIVERABLE_ID,
    epicKey: null,
    outcomeId: null,
    parentKey: null,
    assigneeType: 'human',
    assigneeId: 'p-owner-1',
    reviewerId: null,
    podId,
    hubId,
    sprintId: null,
    points: null,
    riskTier: null,
    created: stamp('2026-12-18', 10, 0),
    updated: stamp(updated, 11, 30),
    due: '2027-03-31',
    resolved: null,
    startDate: '2027-01-04',
    targetDate: '2027-03-31',
    ownerId: 'p-owner-1',
    labels: ['ccr', 'regulatory'],
  });

  const L = 'p-risk-ldn';
  const N = 'p-xva-nyc';
  const heroRows: Row[] = [
    // Epic CCR-100: scenario ingestion (London)
    { key: 'CCR-101', epic: 'CCR-100', outcome: 'oc-1001-1', type: 'story', summary: 'Load stress scenario definitions from the scenario library', points: 8, status: 'Done', assignee: `${L}-2`, on: '2027-01-22', created: '2026-12-21' },
    { key: 'CCR-102', epic: 'CCR-100', outcome: 'oc-1001-1', type: 'story', summary: 'Validate shock vectors against the approved scenario set', points: 5, status: 'Done', assignee: `${L}-3`, on: '2027-02-08', created: '2026-12-21' },
    { key: 'CCR-103', epic: 'CCR-100', outcome: 'oc-1001-1', type: 'task', summary: 'Version and checksum scenario files on ingest', points: 3, status: 'Done', assignee: 'ai-ctrl-01', reviewer: `${L}-1`, on: '2027-02-05', created: '2027-01-05' },
    { key: 'CCR-104', epic: 'CCR-100', outcome: 'oc-1001-2', type: 'story', summary: 'Map stressed risk factors to reporting-layer identifiers', points: 8, status: 'Done', assignee: `${L}-2`, on: '2027-02-22', created: '2027-01-12' },
    { key: 'CCR-105', epic: 'CCR-100', outcome: 'oc-1001-2', type: 'bug', summary: 'Fix currency mapping for stressed FX shocks', points: 2, status: 'Done', assignee: `${L}-4`, on: '2027-02-19', created: '2027-02-10' },
    { key: 'CCR-106', epic: 'CCR-100', outcome: 'oc-1001-2', type: 'story', summary: 'Handle missing tenor points in stressed curves', points: 3, status: 'In Progress', assignee: `${L}-3`, on: '2027-03-02', created: '2027-02-15', due: '2027-03-12' },
    // Epic CCR-200: reconciliation engine (London)
    { key: 'CCR-201', epic: 'CCR-200', outcome: 'oc-1001-2', type: 'story', summary: 'Compute stressed exposure deltas per netting set', points: 13, status: 'Done', assignee: `${L}-2`, on: '2027-02-12', created: '2027-01-06' },
    { key: 'CCR-202', epic: 'CCR-200', outcome: 'oc-1001-2', type: 'story', summary: 'Aggregate stressed exposures to counterparty and legal entity', points: 8, status: 'Done', assignee: `${L}-3`, on: '2027-02-26', created: '2027-01-14' },
    { key: 'CCR-203', epic: 'CCR-200', outcome: 'oc-1001-2', type: 'story', summary: 'Reconcile stressed potential future exposure between the risk engine and the reporting layer', points: 8, status: 'Done', assignee: `${L}-4`, on: '2027-03-03', created: '2027-01-20' },
    { key: 'CCR-204', epic: 'CCR-200', outcome: 'oc-1001-3', type: 'new-feature', summary: 'Classify breaks by cause: valuation, static data or timing', points: 5, status: 'Done', assignee: `${L}-2`, on: '2027-02-24', created: '2027-01-26' },
    { key: 'CCR-205', epic: 'CCR-200', outcome: 'oc-1001-3', type: 'bug', summary: 'Fix break tolerance applied in the wrong currency', points: 2, status: 'Done', assignee: `${L}-4`, on: '2027-02-27', created: '2027-02-17' },
    { key: 'CCR-206', epic: 'CCR-200', outcome: 'oc-1001-3', type: 'story', summary: 'Build the break explanation view for risk users', points: 5, status: 'In Review', assignee: `${L}-4`, on: '2027-03-04', created: '2027-02-02', due: '2027-03-12' },
    { key: 'CCR-207', epic: 'CCR-200', outcome: 'oc-1001-3', type: 'story', summary: 'Add break tolerance settings by asset class', points: 3, status: 'To Do', assignee: `${L}-3`, on: '2027-02-20', created: '2027-02-20', due: '2027-03-19' },
    // Epic CCR-300: break reporting and sign-off (New York)
    { key: 'CCR-301', epic: 'CCR-300', outcome: 'oc-1001-2', type: 'task', summary: 'Consume the stressed market-data extract from the shared data platform', points: 5, status: 'Blocked', assignee: `${N}-2`, on: '2027-03-01', created: '2027-01-25', due: '2027-02-27' },
    { key: 'CCR-302', epic: 'CCR-300', outcome: 'oc-1001-3', type: 'story', summary: 'Agree the break report layout with desk heads', points: 8, status: 'Done', assignee: `${N}-3`, on: '2027-02-17', created: '2027-01-18' },
    { key: 'CCR-303', epic: 'CCR-300', outcome: 'oc-1001-3', type: 'story', summary: 'Distribute the daily break report to risk users', points: 5, status: 'Done', assignee: `${N}-2`, on: '2027-02-26', created: '2027-02-01' },
    { key: 'CCR-304', epic: 'CCR-300', outcome: 'oc-1001-4', type: 'task', summary: 'Compile the model validation evidence pack', points: 5, status: 'Done', assignee: `${N}-4`, on: '2027-03-02', created: '2027-02-08' },
    { key: 'CCR-305', epic: 'CCR-300', outcome: 'oc-1001-4', type: 'task', summary: 'Map reconciliation controls to the control library', points: 2, status: 'Done', assignee: `${N}-3`, on: '2027-03-03', created: '2027-02-12' },
    { key: 'CCR-306', epic: 'CCR-300', outcome: 'oc-1001-4', type: 'task', summary: 'Submit control evidence to the control register', points: 2, status: 'To Do', assignee: `${N}-4`, on: '2027-02-24', created: '2027-02-24', due: '2027-03-19' },
    // Sub-tasks (not estimated)
    { key: 'CCR-151', epic: 'CCR-200', outcome: 'oc-1001-2', type: 'sub-task', summary: 'Write unit tests for netting set aggregation', points: null, status: 'Done', assignee: `${L}-2`, on: '2027-02-10', created: '2027-01-06', parent: 'CCR-201' },
    { key: 'CCR-152', epic: 'CCR-200', outcome: 'oc-1001-2', type: 'sub-task', summary: 'Prepare reconciliation test data for stressed scenarios', points: null, status: 'Done', assignee: `${L}-4`, on: '2027-02-28', created: '2027-01-20', parent: 'CCR-203' },
    { key: 'CCR-153', epic: 'CCR-200', outcome: 'oc-1001-3', type: 'sub-task', summary: 'Review break explanations with two risk users', points: null, status: 'In Progress', assignee: `${L}-3`, on: '2027-03-04', created: '2027-02-22', parent: 'CCR-206' },
    { key: 'CCR-154', epic: 'CCR-100', outcome: 'oc-1001-2', type: 'sub-task', summary: 'Add monitoring for missing tenor points', points: null, status: 'To Do', assignee: `${L}-3`, on: '2027-02-16', created: '2027-02-16', parent: 'CCR-106' },
  ];

  const heroItems: WorkItem[] = [
    heroEpic('CCR-100', 'Stress scenario ingestion and validation', 'hub-ldn', 'pod-risk-ldn', 'In Progress', '2027-03-02'),
    heroEpic('CCR-200', 'Exposure reconciliation engine', 'hub-ldn', 'pod-risk-ldn', 'In Progress', '2027-03-04'),
    heroEpic('CCR-300', 'Break reporting and sign-off', 'hub-nyc', 'pod-xva-nyc', 'In Progress', '2027-03-03'),
    ...heroRows.map(toItem),
  ];

  const oc = (n: number, title: string, description: string, weight: number, dueDate: string, reportedStatus: Outcome['reportedStatus']): Outcome => ({
    id: `oc-1001-${n}`,
    ref: `OC-1001-${n}`,
    deliverableId: HERO_DELIVERABLE_ID,
    title,
    description,
    weight,
    dueDate,
    reportedStatus,
    acceptanceOwnerId: PRESENTER_PERSON_ID,
  });
  const heroOutcomes: Outcome[] = [
    oc(1, 'Quarter-end stress scenario set agreed and loaded', 'The approved scenario set loads without manual edits and the business owner has confirmed it.', 2, '2027-02-12', 'complete'),
    oc(2, 'Stressed exposures reconcile between the risk engine and the reporting layer', 'Stressed exposures agree by netting set within the agreed tolerance and reruns reproduce the result.', 3, '2027-03-19', 'on-track'),
    oc(3, 'Reconciliation breaks explained to risk users', 'Every break above tolerance carries a cause and risk users can see it in one view.', 3, '2027-03-26', 'on-track'),
    oc(4, 'Control evidence filed for model validation and reporting sign-off', 'Evidence for the reconciliation controls is filed in the control register and confirmed complete.', 2, '2027-03-31', 'at-risk'),
  ];

  const crit = (outcomeN: number, k: number, text: string, accepted: boolean): AcceptanceCriterion => ({
    id: `ac-oc-1001-${outcomeN}-${k}`,
    outcomeId: `oc-1001-${outcomeN}`,
    text,
    mandatory: true,
    state: accepted ? 'accepted' : 'open',
    acceptedById: accepted ? PRESENTER_PERSON_ID : null,
    acceptedAt: accepted ? stamp(k === 3 ? '2027-02-12' : '2027-02-11', 10, k * 10) : null,
    rejectedById: null,
    rejectionReason: null,
  });
  const heroCriteria: AcceptanceCriterion[] = [
    crit(1, 1, 'The approved scenario set loads without manual edits', true),
    crit(1, 2, 'Shock vectors are validated against the scenario library', true),
    crit(1, 3, 'Business owner confirms the scenario set for quarter-end', true),
    crit(2, 1, 'Stressed exposures agree between the risk engine and the reporting layer within tolerance for all netting sets', false),
    crit(2, 2, 'Differences above tolerance are listed with the netting set and the cause', false),
    crit(2, 3, 'Reconciliation reruns reproduce the same result', false),
    crit(3, 1, 'Every break above tolerance carries a classified cause', false),
    crit(3, 2, 'Risk users confirm the explanation view answers their questions', false),
    crit(4, 1, 'Model validation evidence pack is filed', false),
    crit(4, 2, 'Reconciliation controls are mapped to the control library', false),
    crit(4, 3, 'Control owner confirms the evidence is complete', false),
  ];

  const ev = (
    id: string,
    kind: Evidence['kind'],
    title: string,
    result: Evidence['result'],
    workItemKey: string | null,
    outcomeId: string | null,
    observedAt: string,
    source: Evidence['source'],
    sourceRef: string,
    recordedById: string | null,
  ): Evidence => ({
    id,
    kind,
    title,
    deliverableId: HERO_DELIVERABLE_ID,
    outcomeId,
    workItemKey,
    stageId: { 'requirements-sign-off': 'ideation-requirements', 'design-review': 'design-specifications', 'control-assessment': 'risk-control-compliance', 'test-result': 'build-test-validate', 'business-acceptance': 'delivery-launch', 'release-checklist': 'delivery-launch' }[kind] as Evidence['stageId'],
    result,
    source,
    sourceRef,
    observedAt,
    recordedById,
    provenance: 'sample',
  });
  const heroEvidence: Evidence[] = [
    ev('ev-1001-rs', 'requirements-sign-off', 'Requirements sign-off for the reconciliation scope', 'pass', 'CCR-101', null, stamp('2027-01-27', 11, 0), 'document-store', 'DOC-1120', 'p-owner-1'),
    ev('ev-1001-dr', 'design-review', 'Design review of the reconciliation approach', 'pass', 'CCR-101', null, stamp('2027-02-03', 14, 30), 'document-store', 'DOC-1138', 'p-owner-1'),
    ev('ev-1001-tr1', 'test-result', 'Scenario ingestion regression suite', 'pass', 'CCR-102', null, stamp('2027-02-10', 16, 0), 'test-harness', 'RUN-5470', null),
    ev('ev-1001-tr2', 'test-result', 'Identifier mapping check', 'pass', 'CCR-104', null, stamp('2027-02-24', 15, 0), 'test-harness', 'RUN-5493', null),
    ev('ev-1001-tr3', 'test-result', 'Aggregation unit and integration run', 'pass', 'CCR-202', null, stamp('2027-03-01', 17, 0), 'test-harness', 'RUN-5508', null),
    ev('ev-1001-tr', 'test-result', 'Reconciliation regression suite', 'fail', 'CCR-203', 'oc-1001-2', stamp('2027-03-05', 18, 0), 'test-harness', 'RUN-5521', null),
    ev('ev-1001-ba', 'business-acceptance', 'Scenario set acceptance', 'pass', null, 'oc-1001-1', stamp('2027-02-12', 10, 0), 'document-store', 'DOC-118', PRESENTER_PERSON_ID),
  ];

  const heroRaid: RaidItem[] = [
    { id: 'raid-1001-1', key: 'CCR-R-07', kind: 'risk', title: 'Stressed market data arrives late from the Singapore data hub', description: 'The stressed extract is needed for the quarter-end run and is committed later than the reconciliation needs it.', deliverableId: HERO_DELIVERABLE_ID, ownerId: 'p-owner-1', severity: 'high', status: 'open', created: stamp('2027-01-18', 9, 0), updated: stamp('2027-02-13', 9, 0), mitigationDue: '2027-03-12' },
    { id: 'raid-1001-2', key: 'CCR-R-04', kind: 'assumption', title: 'Scenario library stays frozen until quarter-end', description: 'Changes to approved scenarios after ingestion would invalidate the reconciliation baseline.', deliverableId: HERO_DELIVERABLE_ID, ownerId: `${L}-1`, severity: 'medium', status: 'open', created: stamp('2027-01-12', 9, 0), updated: stamp('2027-03-03', 15, 0), mitigationDue: '2027-03-31' },
    { id: 'raid-1001-3', key: 'CCR-R-11', kind: 'issue', title: 'Break volumes above the agreed review capacity for risk users', description: 'Early runs produce more breaks than the review team can explain inside the daily window.', deliverableId: HERO_DELIVERABLE_ID, ownerId: `${N}-1`, severity: 'medium', status: 'mitigating', created: stamp('2027-02-22', 9, 0), updated: stamp('2027-03-04', 10, 0), mitigationDue: '2027-03-19' },
  ];

  const heroMilestones: Milestone[] = [
    { id: 'ms-1001-1', deliverableId: HERO_DELIVERABLE_ID, title: 'Quarter-end stress run', date: '2027-03-19', regulatory: true, status: 'planned', outcomeIds: [], workItemKeys: [] },
    { id: 'ms-1001-2', deliverableId: HERO_DELIVERABLE_ID, title: 'Reconciliation sign-off to the risk committee', date: '2027-03-31', regulatory: false, status: 'planned', outcomeIds: [], workItemKeys: [] },
  ];

  // =========================================================================
  // Workflow story: standalone, T1, first stage, one thin Epic, no evidence.
  // =========================================================================
  const W = 'p-xva-nyc';
  const workflowEpic: WorkItem = {
    key: 'LIM-10',
    type: 'epic',
    summary: 'Desk and limit-type filters',
    status: 'To Do',
    statusCategory: 'to-do',
    deliverableId: WORKFLOW_DELIVERABLE_ID,
    epicKey: null,
    outcomeId: null,
    parentKey: null,
    assigneeType: 'human',
    assigneeId: PRESENTER_PERSON_ID,
    reviewerId: null,
    podId: 'pod-xva-nyc',
    hubId: 'hub-nyc',
    sprintId: null,
    points: null,
    riskTier: null,
    created: stamp('2027-02-26', 10, 0),
    updated: stamp('2027-03-01', 9, 30),
    due: '2027-04-30',
    resolved: null,
    startDate: '2027-03-01',
    targetDate: '2027-04-30',
    ownerId: PRESENTER_PERSON_ID,
    labels: ['limits'],
  };
  const wfRow = (key: string, summary: string, points: number | null, outcome: string | null, created: string): Row => ({
    key, epic: 'LIM-10', outcome, type: 'story', summary, points, status: 'To Do', assignee: `${W}-2`, on: created, created,
  });
  const wfItems: WorkItem[] = [
    workflowEpic,
    { ...toItem(wfRow('LIM-11', 'Add a desk filter to the limit breach table', 3, 'oc-2001-1', '2027-03-02')), sprintId: sprintIdFor('2027-03-15'), due: sprintEnd(5) },
    { ...toItem(wfRow('LIM-12', 'Add a limit-type filter with a saved default', 5, 'oc-2001-1', '2027-03-02')), assigneeId: `${W}-3`, sprintId: sprintIdFor('2027-03-15') },
    { ...toItem(wfRow('LIM-13', 'Show active filters as removable chips', null, null, '2027-03-04')), assigneeId: `${W}-3`, sprintId: null },
  ];
  const wfOutcomes: Outcome[] = [
    { id: 'oc-2001-1', ref: 'OC-2001-1', deliverableId: WORKFLOW_DELIVERABLE_ID, title: 'Desk heads can filter limit breaches by desk and limit type', description: 'A desk head sees only the breaches for their desk and the limit type they choose.', weight: 1, dueDate: '2027-04-30', reportedStatus: 'on-track', acceptanceOwnerId: PRESENTER_PERSON_ID },
  ];
  const wfCriteria: AcceptanceCriterion[] = [
    { id: 'ac-oc-2001-1-1', outcomeId: 'oc-2001-1', text: 'Filtering by desk returns only breaches for that desk in the user acceptance environment', mandatory: true, state: 'open', acceptedById: null, acceptedAt: null, rejectedById: null, rejectionReason: null },
    { id: 'ac-oc-2001-1-2', outcomeId: 'oc-2001-1', text: 'The chosen limit-type filter is kept when the user returns to the dashboard', mandatory: true, state: 'open', acceptedById: null, acceptedAt: null, rejectedById: null, rejectionReason: null },
  ];
  const wfRaid: RaidItem[] = [
    { id: 'raid-2001-1', key: 'LIM-R-01', kind: 'assumption', title: 'Filter response time on the full limit table has not yet been assessed', description: 'The dashboard loads all limits for every desk; filtering may need server-side support.', deliverableId: WORKFLOW_DELIVERABLE_ID, ownerId: PRESENTER_PERSON_ID, severity: 'low', status: 'open', created: stamp('2027-03-02', 9, 0), updated: stamp('2027-03-05', 14, 0), mitigationDue: '2027-03-26' },
  ];
  const wfMilestones: Milestone[] = [
    { id: 'ms-2001-1', deliverableId: WORKFLOW_DELIVERABLE_ID, title: 'Requirements sign-off', date: '2027-03-26', regulatory: false, status: 'planned', outcomeIds: [], workItemKeys: [] },
    { id: 'ms-2001-2', deliverableId: WORKFLOW_DELIVERABLE_ID, title: 'Release to desk heads', date: '2027-04-30', regulatory: false, status: 'planned', outcomeIds: [], workItemKeys: [] },
  ];

  return {
    workItems: [...heroItems, ...wfItems],
    outcomes: [...heroOutcomes, ...wfOutcomes],
    criteria: [...heroCriteria, ...wfCriteria],
    evidence: heroEvidence,
    raid: [...heroRaid, ...wfRaid],
    milestones: [...heroMilestones, ...wfMilestones],
  };
}
