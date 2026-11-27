/**
 * Tiny fixture builder for engine tests. `baseline()` is one deliverable that
 * computes clean: two Epics, three closed stories, two accepted outcomes (one
 * drawing work from both Epics), all T1 evidence passing and current, no RAID,
 * dependencies or milestones. Tests change one thing and assert the effect.
 * Test-only; not imported by application code.
 */
import { createPdlcRun } from '@/lib/config/pdlc';
import type {
  AcceptanceCriterion,
  DemoClock,
  Dependency,
  Evidence,
  Milestone,
  Outcome,
  PortfolioData,
  RaidItem,
  TechDeliverable,
  WorkItem,
} from '@/lib/types';

export const CLOCK: DemoClock = { today: '2027-03-08', now: '2027-03-08T09:00:00.000Z', timeZone: 'UTC' };

export function item(p: Partial<WorkItem> & Pick<WorkItem, 'key'>): WorkItem {
  return {
    type: 'story',
    summary: `Item ${p.key}`,
    status: 'Done',
    statusCategory: 'done',
    deliverableId: null,
    epicKey: null,
    outcomeId: null,
    parentKey: null,
    assigneeType: 'human',
    assigneeId: 'p-eng',
    reviewerId: null,
    podId: 'pod-1',
    hubId: 'hub-1',
    sprintId: null,
    points: 3,
    riskTier: null,
    created: '2027-01-05T09:00:00.000Z',
    updated: '2027-02-20T09:00:00.000Z',
    due: null,
    resolved: '2027-02-20T09:00:00.000Z',
    startDate: null,
    targetDate: null,
    ownerId: null,
    labels: [],
    ...p,
  };
}

export function epic(key: string, deliverableId: string | null, p: Partial<WorkItem> = {}): WorkItem {
  return item({
    key,
    type: 'epic',
    deliverableId,
    status: 'In Progress',
    statusCategory: 'in-progress',
    points: null,
    resolved: null,
    startDate: '2027-01-04',
    targetDate: '2027-06-30',
    ownerId: 'p-owner',
    ...p,
  });
}

/** Story under an Epic. Closed by default. */
export function story(key: string, epicKey: string, outcomeId: string | null, p: Partial<WorkItem> = {}): WorkItem {
  return item({ key, epicKey, parentKey: epicKey, outcomeId, ...p });
}

/** Open story (to do, unresolved). */
export function openStory(key: string, epicKey: string, outcomeId: string | null, p: Partial<WorkItem> = {}): WorkItem {
  return story(key, epicKey, outcomeId, { status: 'To Do', statusCategory: 'to-do', resolved: null, ...p });
}

export function deliverable(p: Partial<TechDeliverable> & Pick<TechDeliverable, 'id'>): TechDeliverable {
  return {
    ref: p.id.toUpperCase(),
    title: `Deliverable ${p.id}`,
    summary: '',
    pmNodeId: 'pm-1',
    investmentRequestId: 'ir-1',
    epicKeys: [],
    template: 'advanced',
    reportedRag: 'green',
    reportedAt: '2027-03-01',
    reportedCommentary: '',
    pdlcStage: 'build-test-validate',
    riskTier: 'T1',
    hubIds: ['hub-1'],
    podId: 'pod-1',
    ownerId: 'p-owner',
    coreTeam: {
      'product-manager': { personId: 'p-accept', joinedAt: '2026-12-01' },
      'tech-lead': { personId: 'p-owner', joinedAt: '2026-12-01' },
      'risk-lead': { personId: 'p-risk', joinedAt: '2026-12-01' },
      'ux-lead': { personId: 'p-ux', joinedAt: '2026-12-01' },
    },
    plannedStart: '2027-01-04',
    plannedEnd: '2027-06-30',
    reportedForecastEnd: null,
    ...p,
  };
}

export function outcome(id: string, deliverableId: string, p: Partial<Outcome> = {}): Outcome {
  return {
    id,
    ref: id.toUpperCase(),
    deliverableId,
    title: `Outcome ${id}`,
    description: '',
    weight: 1,
    dueDate: '2027-06-30',
    reportedStatus: 'on-track',
    acceptanceOwnerId: 'p-accept',
    ...p,
  };
}

export function criterion(id: string, outcomeId: string, p: Partial<AcceptanceCriterion> = {}): AcceptanceCriterion {
  return {
    id,
    outcomeId,
    text: `Criterion ${id}`,
    mandatory: true,
    state: 'accepted',
    acceptedById: 'p-accept',
    acceptedAt: '2027-03-04T10:00:00.000Z',
    rejectedById: null,
    rejectionReason: null,
    ...p,
  };
}

export function evidence(id: string, deliverableId: string, kind: Evidence['kind'], p: Partial<Evidence> = {}): Evidence {
  return {
    id,
    kind,
    title: `Evidence ${id}`,
    deliverableId,
    outcomeId: null,
    workItemKey: null,
    stageId: null,
    result: 'pass',
    source: 'document-store',
    sourceRef: `REF-${id}`,
    observedAt: '2027-03-05T10:00:00.000Z',
    recordedById: 'p-accept',
    provenance: 'sample',
    ...p,
  };
}

export function raid(id: string, deliverableId: string, p: Partial<RaidItem> = {}): RaidItem {
  return {
    id,
    key: id.toUpperCase(),
    kind: 'risk',
    title: `Risk ${id}`,
    description: '',
    deliverableId,
    ownerId: 'p-owner',
    severity: 'medium',
    status: 'open',
    created: '2027-02-01T09:00:00.000Z',
    updated: '2027-03-04T09:00:00.000Z',
    mitigationDue: '2027-03-31',
    ...p,
  };
}

export function dependency(id: string, from: string, to: string, p: Partial<Dependency> = {}): Dependency {
  return {
    id,
    title: `Dependency ${id}`,
    fromDeliverableId: from,
    toDeliverableId: to,
    fromHubId: 'hub-2',
    toHubId: 'hub-1',
    needBy: '2027-04-15',
    committed: '2027-04-10',
    deliveredOn: null,
    status: 'on-track',
    critical: true,
    raidKey: null,
    workItemKey: null,
    origin: 'reported',
    ...p,
  };
}

export function milestone(id: string, deliverableId: string, p: Partial<Milestone> = {}): Milestone {
  return {
    id,
    deliverableId,
    title: `Milestone ${id}`,
    date: '2027-05-01',
    regulatory: false,
    status: 'planned',
    outcomeIds: [],
    workItemKeys: [],
    ...p,
  };
}

/** Wraps parts into a full snapshot with reference data and PDLC runs. */
export function portfolio(parts: Partial<PortfolioData>): PortfolioData {
  const deliverables = parts.deliverables ?? [];
  return {
    meta: {
      sourceId: 'fixture',
      sourceKind: 'stub',
      seed: null,
      generatedAt: CLOCK.now,
      asOf: CLOCK.today,
      freshness: [],
      heroDeliverableId: deliverables[0]?.id ?? '',
      workflowDeliverableId: deliverables[0]?.id ?? '',
    },
    investmentRequests: [
      { id: 'ir-1', ref: 'IR-1', title: 'Request one', objective: '', ownerId: 'p-owner', activityRisk: 'high', route: 'formal', theme: 'Theme', status: 'in-delivery', approvedOn: '2026-11-01' },
    ],
    pmNodes: [
      { id: 'pm-1', ref: 'PG-1', title: 'Programme one', level: 'programme', parentId: null, investmentRequestId: 'ir-1', ownerId: 'p-owner', reportedRag: 'green', reportedAt: '2027-03-01', plannedStart: '2027-01-04', plannedEnd: '2027-12-17' },
    ],
    deliverables,
    outcomes: [],
    criteria: [],
    workItems: [],
    evidence: [],
    raid: [],
    dependencies: [],
    milestones: [],
    hubs: [
      { id: 'hub-1', name: 'London', city: 'London', country: 'United Kingdom', continent: 'europe', latitude: 51.5, longitude: -0.1, timeZone: 'Europe/London' },
      { id: 'hub-2', name: 'Singapore', city: 'Singapore', country: 'Singapore', continent: 'asia', latitude: 1.35, longitude: 103.8, timeZone: 'Asia/Singapore' },
    ],
    pods: [{ id: 'pod-1', name: 'Pod one', hubId: 'hub-1', focus: '', memberIds: ['p-eng'], agentIdentityIds: ['ai-1'], leadId: 'p-owner' }],
    people: [
      { id: 'p-owner', name: 'Olive Owner', title: 'Delivery lead', roles: ['delivery-lead'], hubId: 'hub-1', podId: null, initials: 'OO' },
      { id: 'p-accept', name: 'Ada Acceptor', title: 'Product manager', roles: ['business-owner'], hubId: 'hub-1', podId: null, initials: 'AA' },
      { id: 'p-risk', name: 'Rita Risk', title: 'In-business risk lead', roles: ['risk-manager'], hubId: 'hub-1', podId: null, initials: 'RR' },
      { id: 'p-ux', name: 'Uma Ux', title: 'UX design lead', roles: ['analyst'], hubId: 'hub-1', podId: null, initials: 'UU' },
      { id: 'p-eng', name: 'Eli Engineer', title: 'Engineer', roles: ['engineer'], hubId: 'hub-1', podId: 'pod-1', initials: 'EE' },
    ],
    agentIdentities: [{ id: 'ai-1', agentId: 'status-reporting', handle: 'agent-status-01', podId: 'pod-1', hubId: 'hub-1', accountableOwnerId: 'p-owner' }],
    sprints: Array.from({ length: 26 }, (_, i) => {
      const start = new Date(Date.UTC(2027, 0, 4 + i * 14));
      const end = new Date(start.getTime() + 13 * 86_400_000);
      const n = String(i + 1).padStart(2, '0');
      return { id: `spr-${n}`, name: `2027 S${n}`, index: i + 1, start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
    }),
    pdlcRuns: deliverables.map((d) => createPdlcRun(d, d.pdlcStage, '2027-01-04T09:00:00.000Z')),
    ...parts,
  };
}

/** One clean deliverable "td-1" (see header). */
export function baseline(): PortfolioData {
  const d = deliverable({ id: 'td-1', epicKeys: ['E-1', 'E-2'] });
  return portfolio({
    deliverables: [d],
    workItems: [
      epic('E-1', 'td-1'),
      epic('E-2', 'td-1'),
      story('S-1', 'E-1', 'oc-1', { points: 5, resolved: '2027-02-20T09:00:00.000Z', updated: '2027-02-20T09:00:00.000Z' }),
      story('S-2', 'E-2', 'oc-1', { points: 3, resolved: '2027-03-01T09:00:00.000Z', updated: '2027-03-01T09:00:00.000Z' }),
      story('S-3', 'E-2', 'oc-2', { points: 2, resolved: '2027-03-02T09:00:00.000Z', updated: '2027-03-02T09:00:00.000Z' }),
    ],
    outcomes: [outcome('oc-1', 'td-1', { weight: 2 }), outcome('oc-2', 'td-1', { weight: 1 })],
    criteria: [criterion('c-1', 'oc-1'), criterion('c-2', 'oc-2'), criterion('c-3', 'oc-2', { mandatory: false, state: 'open', acceptedById: null, acceptedAt: null })],
    evidence: [
      evidence('ev-req', 'td-1', 'requirements-sign-off'),
      evidence('ev-test', 'td-1', 'test-result', { workItemKey: 'S-2', source: 'test-harness', recordedById: null }),
      evidence('ev-ba-1', 'td-1', 'business-acceptance', { outcomeId: 'oc-1' }),
      evidence('ev-ba-2', 'td-1', 'business-acceptance', { outcomeId: 'oc-2' }),
      evidence('ev-rel', 'td-1', 'release-checklist'),
    ],
  });
}

/** Deep copy of `data` with `fn` applied to the copy (the original is left untouched). */
export function change(data: PortfolioData, fn: (d: PortfolioData) => void): PortfolioData {
  const copy = structuredClone(data);
  fn(copy);
  return copy;
}
