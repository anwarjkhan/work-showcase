/**
 * The hand-written catalogue the generator expands: investment requests,
 * programme structure and the 26 deliverables with their Epics and outcomes.
 * Everything here is fictional. Numbers in `flags` plant the data conditions the
 * engine rules (R1 to R14) are meant to find; the Core Four gaps (R15, R16) are set in core-team.ts.
 */
import { HERO_DELIVERABLE_ID, HERO_PROGRAMME_ID, WORKFLOW_DELIVERABLE_ID } from '@/lib/config/story';
import type { ActivityRisk, PdlcStageId, RagStatus, RiskTier, TemplateId } from '@/lib/types';
import type { ProgrammeKey } from './reference';

export type ThemeKey = ProgrammeKey;

export interface OutcomeSpec {
  title: string;
  description: string;
}

/** Data conditions planted on a deliverable so engine rules have natural hits. */
export interface DeliverableFlags {
  /** Latest test result is failing (R13). */
  failingTest?: boolean;
  /** Agent-assigned items with no named reviewer (R10): how many. */
  noReviewer?: number;
  /** Latest evidence of a kind is older than a change to the work it covers (R12): how many kinds. */
  staleEvidence?: number;
  /** One Epic is closed while children remain open (R2). */
  closedEpic?: boolean;
  /** One Epic disagrees with the book of record (R8). */
  epicMismatch?: 'dates' | 'owner';
  /** One Epic has no Deliverable ID or a dangling one (R14). */
  epicDeliverableId?: 'missing' | 'dangling';
  /** A regulatory-or-not milestone due within 14 days with little linked work closed (R1). */
  r1Milestone?: boolean;
  /** Story-level items with no Outcome ID (R9): how many. */
  unmapped?: number;
  /** The first unaccepted outcome is reported complete, with all its work closed but no acceptance (R11). */
  completeUnaccepted?: boolean;
  /** More open items are left overdue (R3). */
  overdueBias?: boolean;
  /** One milestone has been missed. */
  missedMilestone?: boolean;
}

export interface DeliverableSpec {
  id: string;
  /** Numeric part, used in refs and child ids. */
  n: number;
  title: string;
  summary: string;
  programme: ProgrammeKey;
  /** Owning PmNode id, or null for the standalone route. */
  pmNodeId: string | null;
  tier: RiskTier;
  stage: PdlcStageId;
  template: TemplateId;
  start: string;
  end: string;
  forecast?: string | null;
  /** Lead hub first. */
  hubs: string[];
  podId: string;
  rag: RagStatus;
  commentary: string;
  /** Target work completion by points (0..1). */
  progress: number;
  /** Number of leading outcomes (by due date) that are fully accepted. */
  accepted: number;
  epics: string[];
  outcomes: OutcomeSpec[];
  /** A few specific nouns for story summaries, mixed with the programme vocabulary. */
  objects: string[];
  flags?: DeliverableFlags;
  ownerId?: string;
  /** True when hand-written records are supplied by story.ts. */
  pinned?: boolean;
}

// ---------------------------------------------------------------------------
// Investment requests and the programme structure
// ---------------------------------------------------------------------------

export interface InvestmentRequestSpec {
  id: string;
  ref: string;
  title: string;
  objective: string;
  programme: ProgrammeKey;
  activityRisk: ActivityRisk;
  theme: string;
  status: 'proposed' | 'approved' | 'in-delivery' | 'closed';
  approvedOn: string;
}

export const INVESTMENT_REQUESTS: InvestmentRequestSpec[] = [
  { id: 'ir-ccr', ref: 'IR-2027-001', title: 'Counterparty credit risk modernisation', objective: 'Modernise counterparty exposure calculation, collateral handling and regulatory lineage so exposure is reconciled and explainable under stress.', programme: 'ccr', activityRisk: 'high', theme: 'Counterparty credit risk', status: 'in-delivery', approvedOn: '2026-11-02' },
  { id: 'ir-frtb', ref: 'IR-2027-002', title: 'Fundamental review of the trading book capital programme', objective: 'Deliver the standardised and default risk capital calculations with the evidence supervisors expect.', programme: 'frtb', activityRisk: 'high', theme: 'FRTB', status: 'in-delivery', approvedOn: '2026-11-16' },
  { id: 'ir-ledger', ref: 'IR-2027-003', title: 'Finance ledger consolidation', objective: 'Move to one chart of accounts and automate intercompany matching and close controls.', programme: 'ledger', activityRisk: 'moderate', theme: 'Finance ledger', status: 'in-delivery', approvedOn: '2026-12-07' },
  { id: 'ir-data', ref: 'IR-2027-004', title: 'Shared data platform for risk and finance', objective: 'Provide governed market, reference and position data to risk and finance consumers from one platform.', programme: 'data', activityRisk: 'moderate', theme: 'Shared data platform', status: 'in-delivery', approvedOn: '2026-12-14' },
  { id: 'ir-stress', ref: 'IR-2027-005', title: 'Stress testing tooling improvements', objective: 'Smaller improvements to scenario management and stress run tooling for analysts.', programme: 'stress', activityRisk: 'low', theme: 'Stress testing', status: 'in-delivery', approvedOn: '2027-01-11' },
  { id: 'ir-limits', ref: 'IR-2027-006', title: 'Price risk controls and limit monitoring improvements', objective: 'Make price exceptions and limit breaches faster to find, evidence and clear.', programme: 'limits', activityRisk: 'low', theme: 'Price risk controls', status: 'in-delivery', approvedOn: '2027-02-15' },
];

export interface PmNodeSpec {
  id: string;
  ref: string;
  title: string;
  level: 'initiative' | 'programme' | 'project';
  parentId: string | null;
  programme: ProgrammeKey;
  /** Explicit reported RAG; projects without one take the worst of their deliverables. */
  rag?: RagStatus;
}

export const PM_NODES: PmNodeSpec[] = [
  { id: HERO_PROGRAMME_ID, ref: 'PG-CCR', title: 'Counterparty Credit Risk Modernisation', level: 'programme', parentId: null, programme: 'ccr', rag: 'green' },
  { id: 'pm-ccr-exposure', ref: 'PJ-CCR-01', title: 'Exposure analytics and lineage', level: 'project', parentId: HERO_PROGRAMME_ID, programme: 'ccr' },
  { id: 'pm-ccr-collateral', ref: 'PJ-CCR-02', title: 'Collateral and limits', level: 'project', parentId: HERO_PROGRAMME_ID, programme: 'ccr' },
  { id: 'pm-frtb', ref: 'PG-FRTB', title: 'FRTB Capital Delivery', level: 'programme', parentId: null, programme: 'frtb', rag: 'amber' },
  { id: 'pm-frtb-sa', ref: 'PJ-FRTB-01', title: 'Standardised approach engine', level: 'project', parentId: 'pm-frtb', programme: 'frtb' },
  { id: 'pm-frtb-ima', ref: 'PJ-FRTB-02', title: 'Default risk and attribution testing', level: 'project', parentId: 'pm-frtb', programme: 'frtb' },
  { id: 'pm-ledger-init', ref: 'IN-FIN-01', title: 'Group finance simplification', level: 'initiative', parentId: null, programme: 'ledger', rag: 'amber' },
  { id: 'pm-ledger', ref: 'PG-LEDGER', title: 'Finance Ledger Consolidation', level: 'programme', parentId: 'pm-ledger-init', programme: 'ledger', rag: 'amber' },
  { id: 'pm-ledger-gl', ref: 'PJ-LED-01', title: 'General ledger migration', level: 'project', parentId: 'pm-ledger', programme: 'ledger' },
  { id: 'pm-ledger-rec', ref: 'PJ-LED-02', title: 'Reconciliation and close', level: 'project', parentId: 'pm-ledger', programme: 'ledger' },
  { id: 'pm-data-init', ref: 'IN-DAT-01', title: 'Enterprise data strategy', level: 'initiative', parentId: null, programme: 'data', rag: 'amber' },
  { id: 'pm-data', ref: 'PG-DATA', title: 'Shared Data Platform', level: 'programme', parentId: 'pm-data-init', programme: 'data', rag: 'amber' },
  { id: 'pm-data-ingest', ref: 'PJ-DAT-01', title: 'Ingestion and market data', level: 'project', parentId: 'pm-data', programme: 'data' },
  { id: 'pm-data-gov', ref: 'PJ-DAT-02', title: 'Quality, lineage and reference data', level: 'project', parentId: 'pm-data', programme: 'data' },
];

/** Jira project key per programme (Epic and RAID keys). */
export const PROJECT_KEYS: Record<ProgrammeKey, string> = {
  ccr: 'CCR',
  frtb: 'FRT',
  ledger: 'LED',
  data: 'DAT',
  stress: 'STR',
  limits: 'LIM',
};

/** First issue number the generator hands out per project (hand-written story keys sit below). */
export const KEY_START: Record<ProgrammeKey, number> = { ccr: 400, frtb: 100, ledger: 100, data: 100, stress: 100, limits: 100 };

// ---------------------------------------------------------------------------
// The 26 deliverables
// ---------------------------------------------------------------------------

const o = (title: string, description: string): OutcomeSpec => ({ title, description });

export const DELIVERABLES: DeliverableSpec[] = [
  // ---- Counterparty credit risk ------------------------------------------
  {
    id: HERO_DELIVERABLE_ID, n: 1001, pinned: true,
    title: 'Counterparty exposure — stress scenario reconciliation',
    summary: 'Reconcile stressed counterparty exposures between the risk engine and the reporting layer, and explain every break to risk users.',
    programme: 'ccr', pmNodeId: HERO_PROGRAMME_ID, tier: 'T3', stage: 'build-test-validate', template: 'advanced',
    start: '2027-01-04', end: '2027-03-31', forecast: '2027-03-31', hubs: ['hub-ldn', 'hub-nyc'], podId: 'pod-risk-ldn',
    rag: 'green', commentary: 'On track for quarter-end.', progress: 0.82, accepted: 1, ownerId: 'p-owner-1',
    epics: ['Stress scenario ingestion and validation', 'Exposure reconciliation engine', 'Break reporting and sign-off'],
    outcomes: [], objects: [],
  },
  {
    id: 'td-1002', n: 1002,
    title: 'Exposure data lineage for regulatory reporting',
    summary: 'Trace every regulatory exposure figure back to trade capture so auditors and supervisors can follow the numbers.',
    programme: 'ccr', pmNodeId: 'pm-ccr-exposure', tier: 'T4', stage: 'design-specifications', template: 'advanced',
    start: '2027-02-01', end: '2027-06-30', forecast: '2027-07-15', hubs: ['hub-sgp', 'hub-blr'], podId: 'pod-data-sgp',
    rag: 'green', commentary: 'Lineage tooling onboarding under way; design authority review brought forward.', progress: 0.1, accepted: 0,
    epics: ['Lineage capture from trade capture to the exposure store', 'Lineage browser for regulatory reporting teams'],
    outcomes: [
      o('Exposure figures traceable to source trades', 'Every regulatory exposure figure can be traced to the trades and static data behind it.'),
      o('Reporting teams answer lineage questions without a service request', 'Reporting analysts can browse lineage themselves and export it for auditors.'),
      o('Lineage gaps reported to data owners each month', 'Missing or broken lineage is listed by owner and followed up monthly.'),
    ],
    objects: ['trade capture lineage hops', 'exposure store column mappings', 'regulatory report cell lineage'],
    flags: { unmapped: 3 },
  },
  {
    id: 'td-1003', n: 1003,
    title: 'Collateral margin-call dispute workflow',
    summary: 'Give operations and credit one workflow to log, age and resolve margin-call disputes with counterparties.',
    programme: 'ccr', pmNodeId: 'pm-ccr-collateral', tier: 'T3', stage: 'delivery-launch', template: 'advanced',
    start: '2027-01-11', end: '2027-03-26', forecast: '2027-03-26', hubs: ['hub-nyc', 'hub-tor', 'hub-chi'], podId: 'pod-xva-nyc',
    rag: 'green', commentary: 'All outcomes accepted; release checklist in progress.', progress: 1, accepted: 3,
    epics: ['Dispute capture and counterparty correspondence log', 'Dispute ageing and escalation rules', 'Dispute reporting for credit and operations'],
    outcomes: [
      o('Disputes logged against the originating margin call', 'Each dispute is linked to the call, the counterparty and the disputed amount.'),
      o('Aged disputes escalated within agreed limits', 'Disputes breaching ageing limits escalate automatically to the credit officer.'),
      o('Credit and operations share one dispute ageing view', 'One report replaces the separate spreadsheets kept by credit and operations.'),
    ],
    objects: ['margin call disputes', 'dispute ageing buckets', 'counterparty correspondence records'],
  },
  {
    id: 'td-1004', n: 1004,
    title: 'Wrong-way risk flags in counterparty limit checks',
    summary: 'Flag counterparties where exposure rises as credit quality falls, and apply the adjustment in limit checks.',
    programme: 'ccr', pmNodeId: 'pm-ccr-exposure', tier: 'T3', stage: 'delivery-launch', template: 'advanced',
    start: '2027-01-18', end: '2027-03-26', forecast: '2027-03-26', hubs: ['hub-ldn', 'hub-war'], podId: 'pod-risk-ldn',
    rag: 'green', commentary: 'All outcomes accepted; release checklist signed off.', progress: 1, accepted: 3,
    epics: ['Wrong-way risk indicator service', 'Limit check integration and override workflow'],
    outcomes: [
      o('Wrong-way indicators available for every rated counterparty', 'An indicator and its rationale is held for each rated counterparty.'),
      o('Limit checks apply wrong-way adjustments automatically', 'Limit utilisation includes the adjustment without manual overlays.'),
      o('Overrides require recorded approval from a credit officer', 'Every override is approved, reasoned and visible in the audit view.'),
    ],
    objects: ['wrong-way risk indicators', 'limit utilisation overlays', 'credit officer overrides'],
    flags: { epicMismatch: 'dates' },
  },
  {
    id: 'td-1005', n: 1005,
    title: 'CVA sensitivity feed for the XVA hedging desk',
    summary: 'Publish credit valuation adjustment sensitivities to the hedging desk daily, with an intraday refresh.',
    programme: 'ccr', pmNodeId: 'pm-ccr-collateral', tier: 'T2', stage: 'build-test-validate', template: 'rapid',
    start: '2027-01-04', end: '2027-04-30', forecast: '2027-04-30', hubs: ['hub-nyc', 'hub-ldn', 'hub-bog'], podId: 'pod-xva-nyc',
    rag: 'green', commentary: 'Delivery on plan; hedging desk user acceptance starts mid-March.', progress: 0.55, accepted: 1,
    epics: ['Sensitivity calculation and bucketing', 'Desk feed and intraday refresh'],
    outcomes: [
      o('CVA delta and vega sensitivities published daily', 'Sensitivities by counterparty and tenor bucket are available before the desk opens.'),
      o('Hedging desk receives intraday refreshes by 10:00', 'An intraday refresh lands before the desk hedges the morning moves.'),
      o('Sensitivity breaks reconciled to the valuation system', 'Differences to the valuation system are explained within a day.'),
    ],
    objects: ['CVA delta ladders', 'credit spread vega buckets', 'intraday refresh jobs'],
    flags: { noReviewer: 6, r1Milestone: true, staleEvidence: 1, epicDeliverableId: 'missing' },
  },
  {
    id: 'td-1006', n: 1006,
    title: 'Netting agreement data cleanse and golden source',
    summary: 'Hold each netting agreement once, with verified enforceability flags, in a governed golden source.',
    programme: 'ccr', pmNodeId: 'pm-ccr-collateral', tier: 'T2', stage: 'delivery-launch', template: 'rapid',
    start: '2027-01-04', end: '2027-03-05', forecast: '2027-03-05', hubs: ['hub-war', 'hub-ldn'], podId: 'pod-ctrl-war',
    rag: 'green', commentary: 'Delivered and accepted; release checklist signed off.', progress: 1, accepted: 2,
    epics: ['Netting agreement remediation and golden source load'],
    outcomes: [
      o('Netting agreements held once in a governed golden source', 'Duplicate and conflicting agreement records are removed and one record is authoritative.'),
      o('Close-out netting enforceability flags verified by legal', 'Enforceability flags are checked against legal opinions by jurisdiction.'),
    ],
    objects: ['netting agreement records', 'enforceability flags by jurisdiction', 'agreement amendment history'],
  },

  // ---- FRTB ----------------------------------------------------------------
  {
    id: 'td-1007', n: 1007,
    title: 'Sensitivities-based capital calculation for equity desks',
    summary: 'Calculate delta, vega and curvature capital charges for the equity desks under the standardised approach.',
    programme: 'frtb', pmNodeId: 'pm-frtb-sa', tier: 'T4', stage: 'build-test-validate', template: 'advanced',
    start: '2027-01-04', end: '2027-08-27', forecast: '2027-09-10', hubs: ['hub-fra', 'hub-mum'], podId: 'pod-frtb-fra',
    rag: 'amber', commentary: 'Curvature results differ from the reference cases; remediation under way.', progress: 0.35, accepted: 1,
    epics: ['Delta, vega and curvature charge engine', 'Equity risk factor bucketing and risk weights'],
    outcomes: [
      o('Delta charges calculated for all equity desks', 'Delta charges are produced per desk, bucket and correlation scenario.'),
      o('Vega and curvature charges match the regulatory reference cases', 'Results agree to the published reference cases within tolerance.'),
      o('Capital results reproducible in the reporting layer', 'The reporting layer reproduces the engine results for any past date.'),
    ],
    objects: ['equity delta sensitivities', 'curvature scenario shifts', 'bucket correlation matrices'],
    flags: { unmapped: 4, staleEvidence: 1, closedEpic: true, epicDeliverableId: 'missing' },
  },
  {
    id: 'td-1008', n: 1008,
    title: 'Default risk charge model implementation',
    summary: 'Implement the default risk charge for non-securitisation positions, from obligor exposure inputs to desk attribution.',
    programme: 'frtb', pmNodeId: 'pm-frtb-ima', tier: 'T4', stage: 'risk-control-compliance', template: 'advanced',
    start: '2027-02-01', end: '2027-10-29', forecast: '2027-10-29', hubs: ['hub-fra', 'hub-sgp'], podId: 'pod-frtb-fra',
    rag: 'green', commentary: 'Design complete; feed quality attestation expected end of March.', progress: 0.2, accepted: 0,
    epics: ['Jump-to-default exposure inputs', 'Default risk charge calculation and netting'],
    outcomes: [
      o('Jump-to-default exposures available per obligor', 'Gross and net jump-to-default amounts are held per obligor and seniority.'),
      o('Default risk charge computed with the agreed netting rules', 'Offsetting rules are applied and each step is explainable.'),
      o('Capital figures attributable to desks and legal entities', 'Charges can be split by desk and legal entity for reporting.'),
    ],
    objects: ['jump-to-default exposures', 'obligor seniority buckets', 'long and short offsetting rules'],
    flags: { epicMismatch: 'owner' },
  },
  {
    id: 'td-1009', n: 1009,
    title: 'Risk factor eligibility test automation',
    summary: 'Automate the monthly modellability assessment of risk factors from real price observations.',
    programme: 'frtb', pmNodeId: 'pm-frtb-sa', tier: 'T3', stage: 'build-test-validate', template: 'advanced',
    start: '2027-01-04', end: '2027-06-11', forecast: '2027-06-11', hubs: ['hub-blr', 'hub-fra'], podId: 'pod-qa-blr',
    rag: 'green', commentary: 'Runner operating in test; observation feed from the data platform is the open item.', progress: 0.5, accepted: 1,
    epics: ['Observation data collection and bucketing', 'Eligibility test runner and results store'],
    outcomes: [
      o('Real price observations collected per risk factor', 'Committed quotes and trades are collected and bucketed per risk factor.'),
      o('Eligibility tests run automatically each month-end', 'Tests run without manual intervention and results are retained.'),
      o('Results explained to desk heads with remediation actions', 'Desk heads receive a short explanation for each failed risk factor.'),
    ],
    objects: ['risk factor observation counts', 'modellability test results', 'committed quote observations'],
    flags: { staleEvidence: 2, closedEpic: true },
  },
  {
    id: 'td-1010', n: 1010,
    title: 'Desk-level capital reporting pack',
    summary: 'Produce a monthly capital pack for desk heads and finance with variances explained against the prior month.',
    programme: 'frtb', pmNodeId: 'pm-frtb-sa', tier: 'T3', stage: 'design-specifications', template: 'advanced',
    start: '2027-03-01', end: '2027-09-24', forecast: '2027-10-08', hubs: ['hub-war', 'hub-fra'], podId: 'pod-ctrl-war',
    rag: 'green', commentary: 'Scope agreed; lineage metadata commitment from the platform team confirmed.', progress: 0.05, accepted: 0,
    epics: ['Pack data model and desk attribution', 'Pack layout and distribution'],
    outcomes: [
      o('Capital attributed to trading desks consistently', 'Attribution rules are applied identically across all desks and months.'),
      o('Pack distributed to desk heads and finance on working day three', 'The pack is published to the agreed audience on the agreed day.'),
      o('Pack variances explained against the prior month', 'Variances above threshold carry a short commentary from the desk.'),
    ],
    objects: ['desk attribution rules', 'prior-month variance commentary', 'capital pack distribution lists'],
    
  },
  {
    id: 'td-1011', n: 1011,
    title: 'Trading desk P&L attribution test reporting',
    summary: 'Report attribution test statistics for each approved trading desk and flag desks that fail.',
    programme: 'frtb', pmNodeId: 'pm-frtb-ima', tier: 'T3', stage: 'ideation-requirements', template: 'advanced',
    start: '2027-04-05', end: '2027-11-12', forecast: null, hubs: ['hub-fra', 'hub-hkg'], podId: 'pod-frtb-fra',
    rag: 'green', commentary: 'Not started; requirements workshops booked for April.', progress: 0, accepted: 0,
    epics: ['Attribution statistics and exception reporting'],
    outcomes: [
      o('Attribution test statistics produced for every approved desk', 'Spearman correlation and unexplained P&L measures are produced per desk.'),
      o('Desks failing the test flagged to desk heads within a day', 'Failures are flagged with the supporting numbers the same or next working day.'),
      o('Test history retained for supervisory review', 'Statistics and the P&L inputs behind them are retained for the required period.'),
    ],
    objects: ['attribution test statistics', 'unexplained P&L ratios', 'desk approval status'],
  },

  // ---- Finance ledger ------------------------------------------------------
  {
    id: 'td-1012', n: 1012,
    title: 'General ledger chart-of-accounts migration',
    summary: 'Move legal entities from legacy charts of accounts to the group chart, with a parallel run and a rehearsed cut-over.',
    programme: 'ledger', pmNodeId: 'pm-ledger-gl', tier: 'T3', stage: 'build-test-validate', template: 'advanced',
    start: '2027-01-04', end: '2027-07-30', forecast: '2027-08-27', hubs: ['hub-dub', 'hub-jnb', 'hub-ldn'], podId: 'pod-ledger-dub',
    rag: 'red', commentary: 'Mapping defects found in the parallel run; recovery plan agreed with finance.', progress: 0.38, accepted: 1,
    epics: ['Account mapping and enrichment', 'Parallel-run reconciliation', 'Cut-over rehearsal and runbook'],
    outcomes: [
      o('Legacy accounts mapped to the group chart of accounts', 'Every active legacy account maps to one group account with an owner.'),
      o('Parallel-run balances agree to the legacy ledger', 'Balances agree by entity and period within the agreed tolerance.'),
      o('Cut-over rehearsed twice against a timed runbook', 'Two rehearsals complete inside the weekend window with no manual workarounds.'),
    ],
    objects: ['legacy account mappings', 'parallel-run balance differences', 'cut-over runbook steps'],
    flags: { failingTest: true, closedEpic: true, r1Milestone: true, overdueBias: true },
  },
  {
    id: 'td-1013', n: 1013,
    title: 'Intercompany reconciliation automation',
    summary: 'Match intercompany balances automatically at month-end and route unmatched items to the owning entity.',
    programme: 'ledger', pmNodeId: 'pm-ledger-rec', tier: 'T2', stage: 'delivery-launch', template: 'rapid',
    start: '2027-01-04', end: '2027-04-02', forecast: '2027-04-02', hubs: ['hub-dub', 'hub-mum'], podId: 'pod-ledger-dub',
    rag: 'green', commentary: 'All outcomes accepted; launch planned for the March close.', progress: 1, accepted: 3,
    epics: ['Matching rules and tolerance engine', 'Break workflow for entity accountants'],
    outcomes: [
      o('Intercompany balances matched automatically at month-end', 'The engine matches balances by entity pair and currency with configurable tolerances.'),
      o('Unmatched items routed to the owning entity', 'Each break reaches the accountable entity with the evidence needed to clear it.'),
      o('Close timetable shortened by one working day', 'The intercompany step completes a day earlier than the previous close.'),
    ],
    objects: ['intercompany balance pairs', 'matching tolerance rules', 'unmatched item queues'],
  },
  {
    id: 'td-1014', n: 1014,
    title: 'Month-end close accrual controls',
    summary: 'Standardise accrual review, exception sign-off and attestation across the month-end close.',
    programme: 'ledger', pmNodeId: 'pm-ledger-rec', tier: 'T3', stage: 'risk-control-compliance', template: 'advanced',
    start: '2027-02-08', end: '2027-08-06', forecast: '2027-08-06', hubs: ['hub-dub', 'hub-jnb'], podId: 'pod-ledger-dub',
    rag: 'green', commentary: 'First control review complete; attestation design in progress.', progress: 0.3, accepted: 0,
    epics: ['Accrual calculation controls', 'Attestation and exception sign-off'],
    outcomes: [
      o('Accrual schedules reviewed within the close calendar', 'Schedules are reviewed by the account owner before the close deadline.'),
      o('Exceptions above threshold signed off by the account owner', 'Exceptions carry a recorded approval and an explanation.'),
      o('Attestation evidence filed centrally each month', 'Attestations are filed in one place and retrievable for audit.'),
    ],
    objects: ['accrual schedules', 'exception sign-off records', 'account owner attestations'],
    flags: { r1Milestone: true, epicDeliverableId: 'dangling' },
  },
  {
    id: 'td-1015', n: 1015,
    title: 'Derivative subledger posting rules',
    summary: 'Post listed and over-the-counter derivative events to the ledger by rule, with exceptions cleared daily.',
    programme: 'ledger', pmNodeId: 'pm-ledger-gl', tier: 'T2', stage: 'delivery-launch', template: 'rapid',
    start: '2027-01-04', end: '2027-02-26', forecast: '2027-02-26', hubs: ['hub-dub'], podId: 'pod-ledger-dub',
    rag: 'green', commentary: 'Delivered and in production; closing out.', progress: 1, accepted: 2,
    epics: ['Posting rules for listed and OTC derivatives'],
    outcomes: [
      o('Derivative events post to the ledger by rule', 'Trade, valuation and settlement events generate balanced journals by rule.'),
      o('Posting exceptions cleared within one working day', 'Exceptions are visible by owner and cleared inside the day.'),
    ],
    objects: ['derivative posting rules', 'valuation event journals', 'posting exception queues'],
  },

  // ---- Shared data platform ------------------------------------------------
  {
    id: 'td-1016', n: 1016,
    title: 'Stressed market-data extract service',
    summary: 'Publish stressed curves and surfaces for the quarter-end scenario set to risk consumers on a schedule.',
    programme: 'data', pmNodeId: 'pm-data-ingest', tier: 'T3', stage: 'build-test-validate', template: 'advanced',
    start: '2027-01-04', end: '2027-02-26', forecast: '2027-03-19', hubs: ['hub-sgp', 'hub-hkg'], podId: 'pod-data-sgp',
    rag: 'red', commentary: 'Extract delivery slipped; first full publication committed for 19 March.', progress: 0.86, accepted: 1,
    epics: ['Stressed curve and surface publication', 'Extract scheduling and consumer entitlements'],
    outcomes: [
      o('Stressed curves and surfaces published for the quarter-end scenario set', 'Curves and volatility surfaces are published for every approved scenario.'),
      o('Consumers entitled and onboarded by desk', 'Consuming teams are entitled and have tested their first extract.'),
      o('Extract completeness checks reported daily', 'A daily check confirms every scenario and risk factor is present.'),
    ],
    objects: ['stressed yield curves', 'volatility surface extracts', 'consumer entitlement groups'],
    flags: { overdueBias: true, epicMismatch: 'dates', missedMilestone: true },
  },
  {
    id: 'td-1017', n: 1017,
    title: 'Reference data golden source for legal entities',
    summary: 'Consolidate legal entity records into one governed source and publish identifiers and hierarchies.',
    programme: 'data', pmNodeId: 'pm-data-gov', tier: 'T2', stage: 'delivery-launch', template: 'rapid',
    start: '2027-01-04', end: '2027-02-19', forecast: '2027-02-19', hubs: ['hub-jnb', 'hub-nbo'], podId: 'pod-ref-jnb',
    rag: 'green', commentary: 'Delivered; consumers migrated.', progress: 1, accepted: 3,
    epics: ['Legal entity record consolidation', 'Hierarchy and identifier publication'],
    outcomes: [
      o('Duplicate legal entity records consolidated', 'Duplicates are merged under documented survivorship rules.'),
      o('Entity hierarchy published to downstream consumers', 'Parent and ultimate parent links are published on a schedule.'),
      o('Identifier changes distributed within one working day', 'Identifier changes reach consumers in one working day.'),
    ],
    objects: ['legal entity identifiers', 'ultimate parent links', 'entity survivorship rules'],
  },
  {
    id: 'td-1018', n: 1018,
    title: 'Data quality rules engine for trade and position feeds',
    summary: 'Run versioned quality rules on every trade and position feed and alert the feed owner of breaches.',
    programme: 'data', pmNodeId: 'pm-data-gov', tier: 'T3', stage: 'delivery-launch', template: 'advanced',
    start: '2027-01-04', end: '2027-03-31', forecast: '2027-03-31', hubs: ['hub-mum', 'hub-blr'], podId: 'pod-plat-mum',
    rag: 'green', commentary: 'All outcomes accepted; release checklist in progress.', progress: 1, accepted: 3,
    epics: ['Rule definition and execution framework', 'Quality dashboards and feed owner alerts'],
    outcomes: [
      o('Quality rules defined and versioned with feed owners', 'Rules are agreed with feed owners and held under version control.'),
      o('Rule results published after every feed load', 'Results are available to consumers within minutes of each load.'),
      o('Feed owners alerted to breaches within 30 minutes', 'Breaches raise an alert to the accountable owner inside half an hour.'),
    ],
    objects: ['feed quality rules', 'position feed completeness checks', 'breach alert routes'],
  },
  {
    id: 'td-1019', n: 1019,
    title: 'Streaming ingestion for intraday position feeds',
    summary: 'Ingest intraday position changes as a stream and make end-of-day positions reproducible by replay.',
    programme: 'data', pmNodeId: 'pm-data-ingest', tier: 'T2', stage: 'design-specifications', template: 'advanced',
    start: '2027-02-15', end: '2027-10-08', forecast: '2027-10-22', hubs: ['hub-mum', 'hub-tyo'], podId: 'pod-plat-mum',
    rag: 'amber', commentary: 'Design options under review; schema registry decision pending.', progress: 0.12, accepted: 0,
    epics: ['Streaming ingestion service', 'Replay and reconciliation tooling'],
    outcomes: [
      o('Intraday position deltas ingested within 60 seconds', 'Position changes are visible to consumers within a minute of booking.'),
      o('Replays reproduce the end-of-day position', 'Replaying a day from the stream reproduces the end-of-day position exactly.'),
      o('Consumers migrated from the batch feed', 'Named consumers have moved to the stream and the batch feed is retired.'),
    ],
    objects: ['intraday position deltas', 'stream replay checkpoints', 'schema registry entries'],
    flags: { epicMismatch: 'owner', epicDeliverableId: 'dangling' },
  },
  {
    id: 'td-1020', n: 1020,
    title: 'Self-service data catalogue onboarding',
    summary: 'Let data owners register and attest to their assets in the catalogue without central help.',
    programme: 'data', pmNodeId: 'pm-data-gov', tier: 'T1', stage: 'ideation-requirements', template: 'rapid',
    start: '2027-05-03', end: '2027-11-26', forecast: null, hubs: ['hub-syd', 'hub-mum'], podId: 'pod-ux-syd',
    rag: 'green', commentary: 'Not started; discovery interviews planned for April.', progress: 0, accepted: 0,
    epics: ['Onboarding journey for data owners'],
    outcomes: [
      o('Data owners register assets without central help', 'An owner can register an asset in one sitting using only the guidance provided.'),
      o('Owners attest to asset descriptions each quarter', 'Attestations are requested and recorded each quarter.'),
      o('Registered assets searchable by business term', 'Assets can be found by the business terms users already use.'),
    ],
    objects: ['catalogue asset records', 'owner attestation requests', 'business glossary terms'],
  },

  // ---- Standalone (low activity risk) ---------------------------------------
  {
    id: WORKFLOW_DELIVERABLE_ID, n: 2001, pinned: true,
    title: 'Limit-monitoring dashboard filters',
    summary: 'Add desk and limit-type filters to the limit-monitoring dashboard so desk heads find breaches faster.',
    programme: 'limits', pmNodeId: null, tier: 'T1', stage: 'ideation-requirements', template: 'rapid',
    start: '2027-03-01', end: '2027-04-30', forecast: null, hubs: ['hub-nyc'], podId: 'pod-xva-nyc',
    rag: 'green', commentary: 'Starting requirements.', progress: 0, accepted: 0, ownerId: 'p-presenter',
    epics: ['Desk and limit-type filters'], outcomes: [], objects: [],
  },
  {
    id: 'td-2002', n: 2002,
    title: 'Price verification exception ageing report',
    summary: 'Show open price verification exceptions by age and escalate those older than five days.',
    programme: 'limits', pmNodeId: null, tier: 'T1', stage: 'delivery-launch', template: 'rapid',
    start: '2027-01-11', end: '2027-03-26', forecast: '2027-03-26', hubs: ['hub-hkg'], podId: 'pod-pricing-hkg',
    rag: 'green', commentary: 'Accepted by desk controllers; launch note drafted.', progress: 1, accepted: 2,
    epics: ['Exception ageing report and alerts'],
    outcomes: [
      o('Open price exceptions aged and visible to desk controllers', 'Controllers see every open exception with its age and owner.'),
      o('Exceptions older than five days escalated automatically', 'Escalation messages reach the desk head without manual chasing.'),
    ],
    objects: ['price verification exceptions', 'exception ageing buckets', 'desk controller escalations'],
  },
  {
    id: 'td-2003', n: 2003,
    title: 'Independent price verification evidence export',
    summary: 'Export the evidence behind each price test in one step for internal audit and supervisors.',
    programme: 'limits', pmNodeId: null, tier: 'T2', stage: 'delivery-launch', template: 'rapid',
    start: '2027-01-04', end: '2027-03-04', forecast: '2027-03-04', hubs: ['hub-hkg', 'hub-tyo'], podId: 'pod-pricing-hkg',
    rag: 'green', commentary: 'Accepted and released; closing out.', progress: 1, accepted: 2,
    epics: ['Evidence pack export for price testing'],
    outcomes: [
      o('Price testing evidence exported in one step', 'A single action produces the pack for a chosen desk and period.'),
      o('Exports accepted by internal audit without rework', 'Audit accepts the export format and content for its sample.'),
    ],
    objects: ['price test evidence packs', 'vendor quote snapshots', 'test sample selections'],
  },
  {
    id: 'td-2004', n: 2004,
    title: 'Scenario library search and tagging',
    summary: 'Make approved stress scenarios searchable by risk factor and tag, and spot duplicates before approval.',
    programme: 'stress', pmNodeId: null, tier: 'T1', stage: 'ideation-requirements', template: 'rapid',
    start: '2027-04-12', end: '2027-06-25', forecast: null, hubs: ['hub-tor', 'hub-sao'], podId: 'pod-stress-tor',
    rag: 'green', commentary: 'Not started; backlog being shaped.', progress: 0, accepted: 0,
    epics: ['Scenario tagging and search'],
    outcomes: [
      o('Scenarios searchable by risk factor and tag', 'Analysts find a scenario by the factors it shocks.'),
      o('Duplicate scenarios identified before approval', 'Near-duplicates are flagged to the approver with a comparison.'),
    ],
    objects: ['scenario tags', 'scenario shock summaries', 'duplicate scenario candidates'],
    flags: { unmapped: 2 },
  },
  {
    id: 'td-2005', n: 2005,
    title: 'Stress run scheduler self-service',
    summary: 'Let analysts schedule stress runs themselves and tell them why a run failed.',
    programme: 'stress', pmNodeId: null, tier: 'T2', stage: 'design-specifications', template: 'rapid',
    start: '2027-02-22', end: '2027-05-28', forecast: '2027-06-11', hubs: ['hub-tor', 'hub-nyc'], podId: 'pod-stress-tor',
    rag: 'green', commentary: 'Design review scheduled; integration questions with the platform team resolved.', progress: 0.1, accepted: 0,
    epics: ['Self-service scheduling of stress runs'],
    outcomes: [
      o('Analysts schedule stress runs without a service request', 'A run can be scheduled and cancelled by the analyst who owns it.'),
      o('Run failures notified to the requester with the cause', 'Failure notices state the cause and the next step.'),
    ],
    objects: ['stress run schedules', 'run failure notices', 'compute queue allocations'],
    flags: { unmapped: 2 },
  },
  {
    id: 'td-2006', n: 2006,
    title: 'Reverse stress test results export',
    summary: 'Export reverse stress test results to the reporting layer and retain them for supervisory review.',
    programme: 'stress', pmNodeId: null, tier: 'T1', stage: 'build-test-validate', template: 'rapid',
    start: '2027-01-18', end: '2027-04-16', forecast: '2027-04-16', hubs: ['hub-syd', 'hub-mel'], podId: 'pod-ux-syd',
    rag: 'green', commentary: 'Export built; both outcomes in test.', progress: 0.5, accepted: 0,
    epics: ['Export of reverse stress results'],
    outcomes: [
      o('Reverse stress results exportable to the reporting layer', 'Results flow to the reporting layer in the agreed format.'),
      o('Exports retained for supervisory review', 'Exports are retained and retrievable for the required period.'),
    ],
    objects: ['reverse stress targets', 'result export files', 'retention schedules'],
    flags: { noReviewer: 2 },
  },
];

// ---------------------------------------------------------------------------
// Vocabulary for generated work-item summaries
// ---------------------------------------------------------------------------

export const THEME_OBJECTS: Record<ThemeKey, string[]> = {
  ccr: [
    'potential future exposure profiles', 'netting set hierarchies', 'collateral thresholds and minimum transfer amounts', 'credit support annex terms',
    'wrong-way risk indicators', 'counterparty rating mappings', 'exposure at default for repo trades', 'margin period of risk assumptions',
    'legal entity roll-ups', 'trade-level exposure drill-down', 'limit utilisation by counterparty', 'credit valuation adjustment sensitivities',
    'close-out netting flags', 'default fund contribution estimates', 'stressed exposure deltas',
  ],
  frtb: [
    'risk factor modellability flags', 'non-modellable risk factor charges', 'expected shortfall scenarios', 'liquidity horizon mappings',
    'sensitivities-based delta charges', 'vega and curvature calculations', 'default risk charge inputs', 'residual risk add-on classification',
    'desk-level capital attribution', 'back-testing exceptions', 'trading book boundary assignments', 'standardised approach bucketing',
    'risk weight tables', 'regulatory capital reports',
  ],
  stress: [
    'scenario shock definitions', 'reverse stress test targets', 'macro-economic scenario paths', 'sector concentration shocks',
    'scenario library entries', 'stress run schedules', 'scenario version history', 'sensitivity ladders', 'stress result snapshots',
    'run failure notifications', 'scenario approval workflow', 'shock calibration inputs', 'portfolio cut definitions',
  ],
  limits: [
    'price verification exceptions', 'price challenge workflow', 'stale price alerts', 'valuation adjustment inputs', 'prudent valuation tiers',
    'market data tolerance bands', 'mark-to-market break ageing', 'desk limit breach views', 'vendor quote comparisons',
    'price testing evidence packs', 'fair value hierarchy tags', 'exception sign-off records', 'limit-type filters',
  ],
  ledger: [
    'chart-of-accounts mappings', 'journal posting rules', 'intercompany balance matching', 'accrual schedules', 'period-end close checklists',
    'subledger-to-ledger reconciliations', 'FX revaluation runs', 'trial balance snapshots', 'manual journal approvals', 'cost centre hierarchies',
    'balance sheet substantiation', 'account attribute standards', 'suspense account clearing', 'posting date cut-offs',
  ],
  data: [
    'market data snapshots', 'instrument reference records', 'legal entity identifiers', 'position feed schemas', 'data quality rule results',
    'lineage graph entries', 'data contract definitions', 'golden source survivorship rules', 'ingestion checkpoints', 'schema registry entries',
    'stale feed detection', 'data catalogue entries', 'entitlement groups', 'intraday position deltas', 'curve construction inputs',
  ],
};

export const STORY_VERBS = [
  'Build', 'Add', 'Expose', 'Automate', 'Migrate', 'Reconcile', 'Validate', 'Publish', 'Backfill', 'Configure',
  'Instrument', 'Harden', 'Enrich', 'Standardise', 'Parameterise', 'Version', 'Archive',
];

export const SUFFIXES = [
  ' for the overnight batch', ' across all legal entities', ' with an audit trail', ' for the rates desks', ' in the reporting layer',
  ' with user-level entitlements', ' for month-end', ' in the user acceptance environment', ' for the credit desks', ' with exception handling',
  ' for the Asia time zone', ' with configurable thresholds', ' for the equities desks',
];

export const BUG_DEFECTS = [
  'dropping rows when the set is empty', 'showing stale values after the overnight reload', 'failing on leap-day calendars', 'double-counting amendments',
  'rejecting valid identifiers', 'timing out on large portfolios', 'rounding differently from the source system', 'missing entries for new counterparties',
  'ignoring the holiday calendar', 'mis-sorting by effective date',
];

export const TASK_VERBS = [
  'Agree the data contract for', 'Provision test data for', 'Document the runbook for', 'Schedule the overnight job for', 'Review entitlements for',
  'Capture sign-off criteria for', 'Onboard desk users to', 'Set up monitoring for', 'Plan the migration of',
];

export const SUBTASK_TEMPLATES = [
  'Write unit tests for', 'Update the data dictionary for', 'Peer review changes to', 'Add monitoring and alerts for', 'Update the runbook for',
  'Prepare test data for', 'Draft release notes for', 'Capture screenshots for the user guide on',
];

export const CRITERIA_TEMPLATES = [
  'Product Manager confirms the outcome in the user acceptance environment',
  'Reconciled figures agree to the source within the agreed tolerance',
  'Runbook and support handover accepted by operations',
  'Controls evidence filed in the control register',
  'No open critical defects against the outcome',
  'Users trained and entitlements granted',
  'Results reproducible across two consecutive runs',
  'Exceptions are visible to the accountable owner',
  'Audit trail records who changed what and when',
  'Performance meets the agreed service level on production-sized data',
  'Data owner confirms the definitions used',
  'Documentation published where users can find it',
];

/** Release checklist stays pending on these final-stage deliverables, as a realistic exception. */
export const PENDING_RELEASE = new Set(['td-1018']);

/**
 * Deliverables whose first unaccepted outcome is reported on track although its
 * due date has passed, so the engine flags it (R11). They are meant to disagree
 * with their reported status.
 */
export const REPORTED_ON_TRACK = new Set(['td-1005', 'td-1008', 'td-1009', 'td-1014', 'td-2006']);

/**
 * Target forecast slip in days (positive is late) for in-flight deliverables
 * whose recent throughput would otherwise project an implausibly early finish.
 * The generator re-opens the most recently closed work until the engine's
 * throughput forecast (remaining points over points closed in the last 42 days)
 * lands near planned end plus this slip.
 */
export const FORECAST_TARGET_SLIP: Record<string, number> = {
  'td-1008': 8,
  'td-1014': 10,
  'td-1009': -6,
  'td-1012': 12,
};
