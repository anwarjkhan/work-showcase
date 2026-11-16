/**
 * Shared domain, engine and agent contracts for the Delivery Intelligence prototype.
 *
 * Owned by D1. Other deliverables import from here and must not edit it.
 *
 * Conventions
 * - Ids are plain strings. Every record has a stable `id`; Jira-style records also
 *   carry a human `key` or `ref` (for work items the key IS the id).
 * - Dates are ISO strings: `IsoDate` = "YYYY-MM-DD", `IsoDateTime` = full ISO 8601 with "Z".
 * - Enumerations are kebab-case string-literal unions. Human-readable labels for
 *   them live in `lib/config/terminology.ts`, never in components.
 * - Nothing here holds money or headcount (design section 7).
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** Calendar date, "YYYY-MM-DD". */
export type IsoDate = string;
/** Timestamp, "YYYY-MM-DDTHH:mm:ss.sssZ" (or without milliseconds). */
export type IsoDateTime = string;

/** The fixed demo clock (see lib/config/clock.ts). Every engine function takes it as a parameter. */
export interface DemoClock {
  /** "Today" for every computation: 2027-03-08. */
  today: IsoDate;
  /** Start-of-demo timestamp; the store derives deterministic later timestamps from it. */
  now: IsoDateTime;
  /** IANA zone used only for display. */
  timeZone: string;
}

/** RAG as recorded in the portfolio system (book of record). */
export type RagStatus = 'red' | 'amber' | 'green';
/** RAG computed from evidence. Adds `unknown` when there is too little data. */
export type EvidenceRagStatus = RagStatus | 'unknown';

/** Activity risk of an investment request. Decides the route through the hierarchy. */
export type ActivityRisk = 'low' | 'moderate' | 'high';
/** Route through the hierarchy: low activity risk takes the standalone route. */
export type DeliveryRoute = 'formal' | 'standalone';

/** Work-item risk tier (T1 Low .. T4 Critical / Regulated). Sets the agent autonomy ceiling and required evidence. */
export type RiskTier = 'T1' | 'T2' | 'T3' | 'T4';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

/**
 * Where a figure or record comes from. Drives the provenance badge.
 * The five labels from design section 4, plus `simulated` for evidence created by
 * the "Simulate evidence arriving" control (design section 5).
 */
export type Provenance = 'sample' | 'computed' | 'scripted-agent' | 'reported' | 'planned' | 'simulated';

/** Templates a deliverable's Jira project uses. `target` is the proposed blueprint. */
export type TemplateId = 'rapid' | 'advanced' | 'target';

/** Systems a record or evidence item can come from. Labels in terminology.systems. */
export type SourceSystemId = 'portfolio-system' | 'work-tracker' | 'test-harness' | 'document-store' | 'control-register' | 'release-tool' | 'in-app';

export type Continent = 'europe' | 'north-america' | 'south-america' | 'asia' | 'africa' | 'oceania';

// ---------------------------------------------------------------------------
// Entity references (used by findings, citations, audit, agent steps)
// ---------------------------------------------------------------------------

export type EntityKind =
  | 'investment-request'
  | 'pm-node'
  | 'deliverable'
  | 'outcome'
  | 'criterion'
  | 'work-item'
  | 'evidence'
  | 'raid'
  | 'dependency'
  | 'milestone'
  | 'hub'
  | 'pod'
  | 'person'
  | 'agent-identity'
  | 'sprint'
  | 'pdlc-run'
  | 'finding'
  | 'agent-run'
  | 'proposal'
  | 'approval'
  | 'status-draft'
  | 'audit-event';

/** Pointer to any record. For work items `id` is the work-item key (e.g. "CCR-142"). */
export interface EntityRef {
  kind: EntityKind;
  id: string;
}

// ---------------------------------------------------------------------------
// Reference data: Hub, Pod, Person, AgentIdentity, Sprint
// ---------------------------------------------------------------------------

export interface Hub {
  id: string;
  /** Display name, usually the city. */
  name: string;
  city: string;
  country: string;
  continent: Continent;
  latitude: number;
  longitude: number;
  /** IANA time zone, e.g. "Europe/London". */
  timeZone: string;
}

export interface Pod {
  id: string;
  name: string;
  hubId: string;
  /** Short description of what the pod works on. */
  focus: string;
  /** Human members (Person ids). */
  memberIds: string[];
  /** Agent identities attached to the pod. */
  agentIdentityIds: string[];
  leadId: string;
}

/** Roles a person can hold. One person can hold several. */
export type PersonRole =
  | 'investment-owner'
  | 'programme-lead'
  | 'delivery-lead'
  | 'engineer'
  | 'analyst'
  | 'requirements-owner'
  | 'design-reviewer'
  | 'control-owner'
  | 'independent-validator'
  | 'business-owner'
  | 'release-owner'
  | 'risk-manager';

/** A synthetic human. No real names. */
export interface Person {
  id: string;
  name: string;
  /** Job title as free text, e.g. "Delivery lead". */
  title: string;
  roles: PersonRole[];
  hubId: string;
  podId: string | null;
  /** Two-letter initials for avatars. */
  initials: string;
}

/** Agent ids from the catalogue in design section 5. */
export type AgentId =
  | 'requirements-structuring'
  | 'outcome-mapping'
  | 'control-evidence-check'
  | 'release-readiness'
  | 'raid-quality'
  | 'dependency-discovery'
  | 'portfolio-reconciliation'
  | 'status-reporting'
  | 'executive-briefing';

/** An agent as it appears on work items (assignee) and in pods. */
export interface AgentIdentity {
  id: string;
  /** Which catalogue agent this identity runs. */
  agentId: AgentId;
  /** Identifier as shown on work items, e.g. "agent-reqs-01". */
  handle: string;
  podId: string | null;
  hubId: string | null;
  /** Named human accountable for the identity. */
  accountableOwnerId: string;
}

export interface Sprint {
  id: string;
  /** e.g. "2027 S05". */
  name: string;
  /** 1-based index within the year. */
  index: number;
  start: IsoDate;
  end: IsoDate;
}

// ---------------------------------------------------------------------------
// Hierarchy: InvestmentRequest -> PmNode -> TechDeliverable -> Outcome
// ---------------------------------------------------------------------------

export interface InvestmentRequest {
  id: string;
  /** Book-of-record reference, e.g. "IR-2027-004". */
  ref: string;
  title: string;
  objective: string;
  ownerId: string;
  activityRisk: ActivityRisk;
  /** `standalone` when activityRisk is `low`. */
  route: DeliveryRoute;
  /** Programme theme, e.g. "Counterparty credit risk". */
  theme: string;
  status: 'proposed' | 'approved' | 'in-delivery' | 'closed';
  approvedOn: IsoDate | null;
}

export type PmNodeLevel = 'initiative' | 'programme' | 'project';

/** Initiative / Programme / Project. Only exists on the formal route (moderate and high activity risk). */
export interface PmNode {
  id: string;
  ref: string;
  title: string;
  level: PmNodeLevel;
  /** Parent PmNode, or null at the top of the formal structure. */
  parentId: string | null;
  investmentRequestId: string;
  ownerId: string;
  reportedRag: RagStatus;
  reportedAt: IsoDate;
  plannedStart: IsoDate;
  plannedEnd: IsoDate;
}

/** The five PDLC stages, in order. Definitions in lib/config/pdlc.ts. */
export type PdlcStageId =
  | 'ideation-requirements'
  | 'design-specifications'
  | 'risk-control-compliance'
  | 'build-test-validate'
  | 'delivery-launch';

/** Human review roles used by PDLC stages. A stage can need more than one, in order. */
export type ReviewRoleId =
  | 'requirements-owner'
  | 'design-reviewer'
  | 'control-owner'
  | 'independent-validator'
  | 'business-owner'
  | 'release-owner';

export interface TechDeliverable {
  id: string;
  /** Deliverable ID as carried on Epics, e.g. "TD-1001". */
  ref: string;
  title: string;
  summary: string;
  /** Owning PmNode (formal route) or null (standalone route). */
  pmNodeId: string | null;
  investmentRequestId: string;
  /** One or more Epic keys. Each Epic belongs to exactly one deliverable. */
  epicKeys: string[];
  template: TemplateId;
  /** Book-of-record RAG. Never changed by an agent or an approval. */
  reportedRag: RagStatus;
  reportedAt: IsoDate;
  /** Commentary from the last portfolio-system update. */
  reportedCommentary: string;
  /** Stage as recorded in the portfolio system. The PdlcRun is authoritative inside the app; D5 keeps both in step. */
  pdlcStage: PdlcStageId;
  riskTier: RiskTier;
  /** Hubs where the work sits; the first is the lead hub. */
  hubIds: string[];
  podId: string;
  ownerId: string;
  /** Named human per review role (who approves each PDLC review / accepts criteria). */
  reviewers: Partial<Record<ReviewRoleId, string>>;
  plannedStart: IsoDate;
  plannedEnd: IsoDate;
  /** Forecast end as recorded in the portfolio system; the engine computes its own forecast too. */
  reportedForecastEnd: IsoDate | null;
}

/**
 * Outcome under a deliverable. Story-level items carry its id in their Outcome ID field.
 * `reportedStatus` replaces the design's `reportedOnTrack` boolean: "reported on track"
 * means `on-track` or `complete` (rule R11).
 */
export interface Outcome {
  id: string;
  /** Outcome ID as carried on story-level items, e.g. "OC-1001-2". */
  ref: string;
  deliverableId: string;
  title: string;
  description: string;
  /** Relative weight for the accepted-outcomes measure. May be 0 (then "not computable" if all are 0). */
  weight: number;
  dueDate: IsoDate;
  reportedStatus: 'on-track' | 'at-risk' | 'off-track' | 'complete';
  acceptanceOwnerId: string;
}

export type CriterionState = 'open' | 'accepted' | 'rejected';

export interface AcceptanceCriterion {
  id: string;
  outcomeId: string;
  text: string;
  mandatory: boolean;
  state: CriterionState;
  /** Named human who accepted (never an agent). Null unless state is `accepted`. */
  acceptedById: string | null;
  acceptedAt: IsoDateTime | null;
  /** Set when state is `rejected`. */
  rejectedById: string | null;
  rejectionReason: string | null;
}

// ---------------------------------------------------------------------------
// Jira side: WorkItem
// ---------------------------------------------------------------------------

/** Jira hierarchy levels (design section 2). Labels in terminology.workItemTypes. */
export type WorkItemType =
  | 'theme'
  | 'initiative'
  | 'epic'
  | 'tech-deliverable'
  | 'story'
  | 'new-feature'
  | 'task'
  | 'bug'
  | 'improvement'
  | 'raid'
  | 'production-issue'
  | 'spike'
  | 'sub-task';

/** Which hierarchy band a work-item type sits in. */
export type WorkItemLevel = 'theme' | 'initiative' | 'epic' | 'story' | 'sub-task';

export type StatusCategory = 'to-do' | 'in-progress' | 'done';

export type AssigneeType = 'human' | 'agent';

export interface WorkItem {
  /** Jira key, e.g. "CCR-142". Also the record id. */
  key: string;
  type: WorkItemType;
  summary: string;
  /** Workflow status name as Jira shows it, e.g. "In Review". */
  status: string;
  statusCategory: StatusCategory;
  /** Deliverable ID field. Only set on Epics / Tech Deliverable items; may be missing or dangling (rule R14). */
  deliverableId: string | null;
  /** Parent Epic for story-level items and sub-tasks (via parent); null on Epics and above. */
  epicKey: string | null;
  /** Outcome ID field on story-level items; null when unmapped (rule R9). */
  outcomeId: string | null;
  /** Direct parent key (story for a sub-task, epic for a story, initiative for an epic). */
  parentKey: string | null;
  assigneeType: AssigneeType;
  /** Person id when assigneeType is `human`, AgentIdentity id when `agent`; null if unassigned. */
  assigneeId: string | null;
  /** Named human reviewer. Required for agent-assigned items (rule R10). */
  reviewerId: string | null;
  podId: string | null;
  hubId: string | null;
  sprintId: string | null;
  /** Story points; null when not estimated (excluded from work completion). */
  points: number | null;
  /** Work-item risk tier; null inherits the deliverable's tier. */
  riskTier: RiskTier | null;
  created: IsoDateTime;
  updated: IsoDateTime;
  due: IsoDate | null;
  resolved: IsoDateTime | null;
  /** Epic-level dates and owner as held in Jira (compared with the book of record by rule R8). */
  startDate: IsoDate | null;
  targetDate: IsoDate | null;
  ownerId: string | null;
  labels: string[];
}

// ---------------------------------------------------------------------------
// Evidence, RAID, dependencies, milestones
// ---------------------------------------------------------------------------

export type EvidenceKind =
  | 'requirements-sign-off'
  | 'design-review'
  | 'control-assessment'
  | 'test-result'
  | 'business-acceptance'
  | 'release-checklist';

export type EvidenceResult = 'pass' | 'fail' | 'pending';

export interface Evidence {
  id: string;
  kind: EvidenceKind;
  title: string;
  deliverableId: string;
  outcomeId: string | null;
  workItemKey: string | null;
  /** Stage that produced it, when known. */
  stageId: PdlcStageId | null;
  result: EvidenceResult;
  source: SourceSystemId;
  /** Identifier in the source system, e.g. a test run id. */
  sourceRef: string;
  observedAt: IsoDateTime;
  /** Named human who recorded it; null for system-fed evidence. */
  recordedById: string | null;
  provenance: Provenance;
}

export type RaidKind = 'risk' | 'assumption' | 'issue' | 'dependency';
export type RaidStatus = 'open' | 'mitigating' | 'closed';

export interface RaidItem {
  id: string;
  /** Jira key of the RAID item, e.g. "CCR-R-07". */
  key: string;
  kind: RaidKind;
  title: string;
  description: string;
  deliverableId: string;
  ownerId: string | null;
  severity: Severity;
  status: RaidStatus;
  created: IsoDateTime;
  updated: IsoDateTime;
  mitigationDue: IsoDate | null;
}

export type DependencyStatus = 'on-track' | 'at-risk' | 'late' | 'blocked' | 'delivered';

/**
 * Cross-deliverable dependency. Direction: `from` PROVIDES, `to` RECEIVES (needs it by `needBy`).
 */
export interface Dependency {
  id: string;
  title: string;
  fromDeliverableId: string;
  toDeliverableId: string;
  fromHubId: string;
  toHubId: string;
  /** Date the receiver needs it. */
  needBy: IsoDate;
  /** Date the provider has committed to; null when uncommitted. */
  committed: IsoDate | null;
  deliveredOn: IsoDate | null;
  status: DependencyStatus;
  critical: boolean;
  raidKey: string | null;
  workItemKey: string | null;
  /** `agent-proposed` when added by approving a dependency-discovery proposal. */
  origin: 'reported' | 'agent-proposed';
}

export interface Milestone {
  id: string;
  deliverableId: string;
  title: string;
  date: IsoDate;
  regulatory: boolean;
  status: 'planned' | 'met' | 'missed';
  /** Work that counts towards the milestone (rule R1). Empty means "all work of the deliverable". */
  outcomeIds: string[];
  workItemKeys: string[];
}

// ---------------------------------------------------------------------------
// PDLC workflow
// ---------------------------------------------------------------------------

export type PdlcStageStatus = 'not-started' | 'in-progress' | 'in-review' | 'approved' | 'returned';

export type ReviewState = 'not-requested' | 'pending' | 'approved' | 'returned';

export interface PdlcReviewDecision {
  id: string;
  stageId: PdlcStageId;
  roleId: ReviewRoleId;
  decision: 'approved' | 'returned';
  /** Named human; never an agent. */
  reviewerId: string;
  decidedAt: IsoDateTime;
  /** Required for `returned`. */
  reason: string | null;
}

export interface PdlcReviewState {
  roleId: ReviewRoleId;
  state: ReviewState;
  /** Person expected to review (from TechDeliverable.reviewers). */
  reviewerId: string | null;
  decisions: PdlcReviewDecision[];
}

export type WorkProductState = 'missing' | 'drafted' | 'complete';

export interface PdlcWorkProductState {
  /** Matches a work product id in lib/config/pdlc.ts. */
  id: string;
  state: WorkProductState;
  /** Draft or record that produced it. */
  ref: EntityRef | null;
}

export interface PdlcStageState {
  stageId: PdlcStageId;
  status: PdlcStageStatus;
  workProducts: PdlcWorkProductState[];
  /** One entry per review role the stage requires, in order. */
  reviews: PdlcReviewState[];
  agentRunIds: string[];
  evidenceIds: string[];
  enteredAt: IsoDateTime | null;
  exitedAt: IsoDateTime | null;
}

export type Actor =
  | { kind: 'human'; personId: string }
  | { kind: 'agent'; agentId: AgentId; identityId: string | null }
  | { kind: 'system' };

export interface PdlcMove {
  id: string;
  from: PdlcStageId;
  to: PdlcStageId;
  direction: 'forward' | 'back';
  at: IsoDateTime;
  by: Actor;
  /** Required when moving back. */
  reason: string | null;
}

/** One deliverable's run through the five stages. Seeded in PortfolioData.pdlcRuns, evolved by store actions. */
export interface PdlcRun {
  id: string;
  deliverableId: string;
  currentStage: PdlcStageId;
  stages: Record<PdlcStageId, PdlcStageState>;
  moves: PdlcMove[];
  startedAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

// ---------------------------------------------------------------------------
// The complete snapshot
// ---------------------------------------------------------------------------

export interface SourceFreshness {
  system: SourceSystemId;
  lastSyncedAt: IsoDateTime;
  recordCount: number;
}

export interface PortfolioMeta {
  /** e.g. "synthetic" or "jira". */
  sourceId: string;
  sourceKind: 'synthetic' | 'stub' | 'jira';
  /** Seed of the synthetic generator; null for non-synthetic sources. */
  seed: number | null;
  generatedAt: IsoDateTime;
  /** The "as of" date of the snapshot (normally the demo clock's today). */
  asOf: IsoDate;
  freshness: SourceFreshness[];
  /** Ids the demo story is pinned to (see lib/config/story.ts). */
  heroDeliverableId: string;
  workflowDeliverableId: string;
}

/** Everything the app knows. Immutable inside the store: updates replace arrays/objects. */
export interface PortfolioData {
  meta: PortfolioMeta;
  investmentRequests: InvestmentRequest[];
  pmNodes: PmNode[];
  deliverables: TechDeliverable[];
  outcomes: Outcome[];
  criteria: AcceptanceCriterion[];
  workItems: WorkItem[];
  evidence: Evidence[];
  raid: RaidItem[];
  dependencies: Dependency[];
  milestones: Milestone[];
  hubs: Hub[];
  pods: Pod[];
  people: Person[];
  agentIdentities: AgentIdentity[];
  sprints: Sprint[];
  pdlcRuns: PdlcRun[];
}

// ---------------------------------------------------------------------------
// Engine results (computed by lib/engine, read by screens)
// ---------------------------------------------------------------------------

export type NotComputableReason = 'no-linked-work' | 'zero-weight' | 'no-outcomes' | 'no-points' | 'insufficient-data';

/** A measure that may be "not computable" rather than zero (design section 5). */
export type Computable<T> = { computable: true; value: T } | { computable: false; reason: NotComputableReason; detail: string };

/** Closed points / total points. */
export interface WorkCompletion {
  closedPoints: number;
  totalPoints: number;
  /** 0..1 */
  ratio: number;
  /** 0..100, rounded to an integer for display. */
  percent: number;
  itemCount: number;
  closedItemCount: number;
  /** Items without points are counted here and excluded from the ratio. */
  unestimatedItemCount: number;
  /** Epics that contributed (all Epics of the deliverable). */
  epicKeys: string[];
}

export interface OutcomeAcceptance {
  outcomeId: string;
  accepted: boolean;
  mandatoryCount: number;
  mandatoryAccepted: number;
  /** Ids of the business-acceptance evidence found, if any. */
  businessAcceptanceEvidenceIds: string[];
  /** Why it is not accepted (empty when accepted). */
  reasons: Reason[];
}

export interface AcceptedOutcomes {
  acceptedCount: number;
  totalCount: number;
  acceptedWeight: number;
  totalWeight: number;
  /** acceptedWeight / totalWeight, 0..1 */
  ratio: number;
  percent: number;
  outcomes: OutcomeAcceptance[];
}

export type ReadinessState = 'ready' | 'not-ready' | 'unknown';

export type EvidenceHeldState = 'passing' | 'failing' | 'pending' | 'stale' | 'missing';

export interface HeldEvidence {
  kind: EvidenceKind;
  state: EvidenceHeldState;
  /** Latest evidence record of that kind, if any. */
  evidenceId: string | null;
  observedAt: IsoDateTime | null;
  /** Set when stale: latest change to the covered work. */
  workChangedAt: IsoDateTime | null;
}

/** A machine-readable reason with a sentence and the records behind it. */
export interface Reason {
  code: string;
  message: string;
  refs: EntityRef[];
}

/** Delivery readiness: three states, never a percentage. */
export interface ReadinessAssessment {
  deliverableId: string;
  state: ReadinessState;
  riskTier: RiskTier;
  requiredEvidence: EvidenceKind[];
  held: HeldEvidence[];
  missing: EvidenceKind[];
  failing: EvidenceKind[];
  stale: EvidenceKind[];
  /** Open critical dependencies that force `not-ready`. */
  blockingDependencyIds: string[];
  reasons: Reason[];
}

export interface OutcomeMeasures {
  outcomeId: string;
  deliverableId: string;
  workCompletion: Computable<WorkCompletion>;
  acceptance: OutcomeAcceptance;
  /** Epics the outcome draws work from (may be several). */
  epicKeys: string[];
  workItemKeys: string[];
  reportedStatus: Outcome['reportedStatus'];
}

/** The three measures, computed independently, always shown together. */
export interface DeliverableMeasures {
  deliverableId: string;
  workCompletion: Computable<WorkCompletion>;
  acceptedOutcomes: Computable<AcceptedOutcomes>;
  readiness: ReadinessAssessment;
}

export interface EvidenceRag {
  entity: EntityRef;
  reported: RagStatus;
  evidence: EvidenceRagStatus;
  /** True when reported and evidence-based RAG differ (and evidence is not `unknown`). */
  disagrees: boolean;
  reasons: Reason[];
}

export type RuleId = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7' | 'R8' | 'R9' | 'R10' | 'R11' | 'R12' | 'R13' | 'R14';

export interface Finding {
  id: string;
  ruleId: RuleId;
  severity: Severity;
  /** The record the finding is about. */
  subject: EntityRef;
  /** Deliverable it rolls up to, when there is one. */
  deliverableId: string | null;
  message: string;
  /** Records that prove the finding. */
  evidence: EntityRef[];
  detectedAt: IsoDateTime;
  /** `computed` from the engine, `scripted-agent` when raised by an agent run. */
  provenance: Extract<Provenance, 'computed' | 'scripted-agent'>;
  /** Agent run that raised it, if any. */
  agentRunId: string | null;
}

export type PlanZoom = 'year' | 'quarter' | 'month' | 'sprint';

export type PlanRowLevel = 'investment-request' | 'pm-node' | 'deliverable' | 'epic';

/** One bar on the plan. */
export interface PlanSpan {
  entity: EntityRef;
  level: PlanRowLevel;
  /** Parent row's entity id, null for top rows. */
  parentId: string | null;
  label: string;
  plannedStart: IsoDate;
  plannedEnd: IsoDate;
  forecastEnd: IsoDate;
  /** forecastEnd - plannedEnd in days (positive = late). */
  slipDays: number;
  /** Dependencies into this row that are late or blocked. */
  lateDependencyIds: string[];
  milestoneIds: string[];
}

/** A visible window on the timeline for one zoom level. */
export interface PlanWindow {
  zoom: PlanZoom;
  start: IsoDate;
  end: IsoDate;
  ticks: PlanTick[];
}

export interface PlanTick {
  start: IsoDate;
  end: IsoDate;
  /** e.g. "Q1 2027", "Mar", "S05". */
  label: string;
  /** True when the demo clock's today falls in this tick. */
  current: boolean;
}

export interface PlanModel {
  spans: PlanSpan[];
  today: IsoDate;
  /** Extent of all spans. */
  start: IsoDate;
  end: IsoDate;
  lateDependencyIds: string[];
}

export interface RagCounts {
  red: number;
  amber: number;
  green: number;
  unknown: number;
}

export interface ProgrammeHealth {
  pmNodeId: string;
  deliverableIds: string[];
  reported: RagStatus;
  evidence: EvidenceRagStatus;
  /** Evidence-based RAG counts of its deliverables. */
  deliverableRag: RagCounts;
}

export interface WorkShare {
  human: number;
  agent: number;
  /** agent / (human + agent), 0..1; 0 when there is no work. */
  agentShare: number;
}

export interface PortfolioSummary {
  counts: {
    investmentRequests: number;
    initiatives: number;
    programmes: number;
    projects: number;
    deliverables: number;
    standaloneDeliverables: number;
    epics: number;
    outcomes: number;
    workItems: number;
  };
  reportedRag: RagCounts;
  evidenceRag: RagCounts;
  /** Deliverables where reported and evidence-based RAG disagree, worst first. */
  disagreementDeliverableIds: string[];
  programmeHealth: ProgrammeHealth[];
  stageDistribution: Record<PdlcStageId, number>;
  /** Human / agent split of work items per stage. */
  stageWorkShare: Record<PdlcStageId, WorkShare>;
  readiness: Record<ReadinessState, number>;
  /** Portfolio-wide figures for the three measures. */
  workCompletion: Computable<WorkCompletion>;
  acceptedOutcomes: Computable<AcceptedOutcomes>;
  findingsBySeverity: Record<Severity, number>;
  freshness: SourceFreshness[];
}

/** Everything `computeAll(data, clock)` returns. Records are keyed by entity id. */
export interface EngineResult {
  computedFor: IsoDate;
  deliverables: Record<string, DeliverableMeasures>;
  outcomes: Record<string, OutcomeMeasures>;
  /** Evidence-based RAG per deliverable id. */
  deliverableRag: Record<string, EvidenceRag>;
  /** Evidence-based RAG per PmNode id. */
  pmNodeRag: Record<string, EvidenceRag>;
  findings: Finding[];
  plan: PlanModel;
  portfolio: PortfolioSummary;
}

// ---------------------------------------------------------------------------
// Agents and governance
// ---------------------------------------------------------------------------

export type AgentMode = 'read-only' | 'propose-change' | 'draft';

/** What an agent may do for an item of a given risk tier. */
export type AutonomyCeiling = 'auto-apply' | 'propose-only' | 'advisory-only';

/** What an agent was pointed at. */
export type AgentScope =
  | { kind: 'portfolio' }
  | { kind: 'deliverable'; deliverableId: string }
  | { kind: 'pdlc-stage'; deliverableId: string; stageId: PdlcStageId };

export interface AgentRunInput {
  data: PortfolioData;
  results: EngineResult;
  clock: DemoClock;
  scope: AgentScope;
}

/** A step as the agent produces it (the store adds ids and timing). */
export interface AgentStepSpec {
  kind: AgentStepKind;
  label: string;
  detail: string;
  refs: EntityRef[];
  /** Suggested playback duration in the live view. */
  durationMs: number;
}

/** A proposal as the agent produces it (the store adds ids, status and timestamps). */
export type ProposedChangeSpec = Omit<ProposedChange, 'id' | 'runId' | 'status' | 'createdAt' | 'decision'>;

export interface AgentRunOutput {
  steps: AgentStepSpec[];
  findings: Omit<Finding, 'id' | 'detectedAt' | 'agentRunId'>[];
  proposals: ProposedChangeSpec[];
  draft: Omit<StatusDraft, 'id' | 'runId' | 'generatedAt'> | null;
  /** One-line result for the run list. */
  summary: string;
}

/** Catalogue entry. Implementations live in lib/agents (D5). `run` must be pure and deterministic. */
export interface AgentDefinition {
  id: AgentId;
  name: string;
  purpose: string;
  /** PDLC stages it assists; empty means cross-cutting. */
  stages: PdlcStageId[];
  mode: AgentMode;
  /** Human-readable description of the output. */
  output: string;
  /** Scopes it accepts. */
  scopes: AgentScope['kind'][];
  provenance: 'scripted-agent';
  run(input: AgentRunInput): AgentRunOutput;
}

export type AgentStepKind = 'read' | 'compute' | 'check' | 'propose' | 'draft' | 'note' | 'blocked';

export interface AgentStep extends AgentStepSpec {
  id: string;
  runId: string;
  index: number;
  status: 'pending' | 'running' | 'done' | 'skipped';
}

export type AgentRunStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface AgentRun {
  id: string;
  agentId: AgentId;
  scope: AgentScope;
  status: AgentRunStatus;
  /** Named human who started it. */
  startedById: string;
  startedAt: IsoDateTime;
  completedAt: IsoDateTime | null;
  steps: AgentStep[];
  findingIds: string[];
  proposalIds: string[];
  draftId: string | null;
  summary: string;
  /** ModelProvider that produced any text (the scripted provider in this build). */
  providerId: string;
  provenance: 'scripted-agent';
}

/**
 * Fields an approved proposal may change, per entity. Reported RAG and anything
 * the book of record owns are deliberately absent: no agent or approval can set them.
 */
export interface EditableFields {
  'work-item': Pick<WorkItem, 'outcomeId' | 'reviewerId' | 'due' | 'deliverableId' | 'assigneeType' | 'assigneeId'>;
  raid: Pick<RaidItem, 'ownerId' | 'mitigationDue' | 'status' | 'severity'>;
  dependency: Pick<Dependency, 'committed' | 'status' | 'critical' | 'raidKey'>;
  milestone: Pick<Milestone, 'outcomeIds' | 'workItemKeys'>;
}

export type EditableEntityKind = keyof EditableFields;

/** Field-level patch on one record. */
export type SetFieldPatch = {
  [K in EditableEntityKind]: {
    op: 'set-field';
    entity: K;
    /** Record id (work-item key for work items). */
    id: string;
    field: keyof EditableFields[K] & string;
    before: EditableFields[K][keyof EditableFields[K]];
    after: EditableFields[K][keyof EditableFields[K]];
  };
}[EditableEntityKind];

export type ChangePatch =
  | SetFieldPatch
  /** Close a duplicate RAID item into the one kept. */
  | { op: 'merge-raid'; keepId: string; duplicateId: string }
  /** Add a newly discovered dependency. */
  | { op: 'add-dependency'; dependency: Dependency }
  /** Add drafted story-level items (and their criteria) under an Epic. */
  | { op: 'add-work-items'; epicKey: string; items: WorkItem[]; criteria: AcceptanceCriterion[] };

export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'auto-applied' | 'advisory' | 'superseded';

export interface ProposedChange {
  id: string;
  runId: string;
  agentId: AgentId;
  deliverableId: string | null;
  /** Main record affected. */
  target: EntityRef;
  title: string;
  rationale: string;
  /** Records that justify the change. */
  evidence: EntityRef[];
  patch: ChangePatch;
  /** Human-readable before / after for the approval queue. */
  beforeText: string;
  afterText: string;
  riskTier: RiskTier;
  /** Ceiling applied when the proposal was created. */
  ceiling: AutonomyCeiling;
  status: ProposalStatus;
  /** Assignee of the target item: cannot approve it. */
  assigneeId: string | null;
  createdAt: IsoDateTime;
  /** Set once approved or rejected. */
  decision: Approval | null;
}

export interface Approval {
  id: string;
  proposalId: string;
  decision: 'approved' | 'rejected';
  /** Named human; never an agent, never the target's assignee. */
  approverId: string;
  decidedAt: IsoDateTime;
  note: string | null;
}

export type AuditAction =
  | 'agent-run.started'
  | 'agent-run.completed'
  | 'agent-run.failed'
  | 'finding.raised'
  | 'proposal.created'
  | 'proposal.auto-applied'
  | 'proposal.approved'
  | 'proposal.rejected'
  | 'draft.created'
  | 'pdlc.stage-agent-run'
  | 'pdlc.review-approved'
  | 'pdlc.review-returned'
  | 'pdlc.moved-forward'
  | 'pdlc.moved-back'
  | 'evidence.recorded'
  | 'evidence.simulated'
  | 'criterion.accepted'
  | 'criterion.rejected'
  | 'governance.blocked'
  | 'demo.reset';

export interface AuditEvent {
  id: string;
  /** Monotonic sequence within the session; resets with the demo. */
  seq: number;
  at: IsoDateTime;
  actor: Actor;
  action: AuditAction;
  subject: EntityRef;
  summary: string;
  refs: EntityRef[];
  details: Record<string, string | number | boolean | null>;
}

export type DraftKind = 'weekly-status' | 'executive-brief' | 'requirements' | 'readiness-checklist' | 'reconciliation-report';

export interface DraftSentence {
  id: string;
  text: string;
  /** At least one, each resolving to a record. */
  citations: EntityRef[];
}

export interface DraftSection {
  heading: string;
  sentences: DraftSentence[];
}

/** Drafted text where every sentence cites records. Used for status reports and other agent drafts. */
export interface StatusDraft {
  id: string;
  kind: DraftKind;
  /** Null for portfolio-wide drafts such as the executive brief. */
  deliverableId: string | null;
  title: string;
  agentId: AgentId;
  runId: string;
  generatedAt: IsoDateTime;
  sections: DraftSection[];
  provenance: 'scripted-agent';
}

// --- Model provider (interface ready for an approved model; only the scripted provider exists) ---

export interface ModelMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ModelRequest {
  agentId: AgentId;
  purpose: string;
  messages: ModelMessage[];
  /** Records the response may cite. */
  context: EntityRef[];
  maxOutputTokens?: number;
}

export interface ModelResponse {
  providerId: string;
  text: string;
  citations: EntityRef[];
  provenance: Extract<Provenance, 'scripted-agent' | 'computed'>;
}

export interface ModelProvider {
  id: string;
  label: string;
  kind: 'scripted' | 'model';
  /** False for the scripted provider: no external call is ever made. */
  live: boolean;
  generate(request: ModelRequest): Promise<ModelResponse>;
}

// ---------------------------------------------------------------------------
// Store and actions (implemented in lib/store)
// ---------------------------------------------------------------------------

/** Result of every store action: never throws for a governance refusal. */
export type ActionResult<T = undefined> = { ok: true; value: T } | { ok: false; reason: string };

/** The whole client-side state. Treat as immutable. */
export interface DemoState {
  /** Snapshot as loaded from the data source; never mutated, used by reset. */
  seed: PortfolioData;
  /** Current data after approvals and workflow actions. */
  data: PortfolioData;
  /** Engine output for `data` at `clock`. Recomputed whenever data changes. */
  results: EngineResult;
  clock: DemoClock;
  agentRuns: AgentRun[];
  proposals: ProposedChange[];
  approvals: Approval[];
  drafts: StatusDraft[];
  /** Append-only during a session. */
  audit: AuditEvent[];
  /** The sample human the presenter acts as (approver, reviewer). */
  actingAsPersonId: string;
  /** Increments on every change; handy as a React key. */
  revision: number;
}
