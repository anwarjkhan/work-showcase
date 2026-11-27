import type { CoreRole, RiskTier, RuleId, Severity } from '@/lib/types';

/**
 * Rule thresholds for the engine checks (design section 5). The engine (D3)
 * reads every number from here so they can be tuned without code changes.
 */
export const RULE_THRESHOLDS = {
  /** R1: milestone due within this many days... */
  milestoneWindowDays: 14,
  /** ...and less than this share (0..1) of its linked work closed. */
  milestoneMinClosedRatio: 0.6,
  /** R4: RAID item with no update for this many days. */
  raidStaleDays: 14,
  /** R5: a dependency counts as late when its committed date is this many days past need-by (or blocked). */
  dependencyLateDays: 0,
  /** R7: title similarity (0..1, token Jaccard) at or above which two RAID items look like duplicates. */
  raidDuplicateSimilarity: 0.6,
  /** R8: tolerated difference in days between book-of-record and Epic dates. */
  reconciliationDateToleranceDays: 0,
  /** Data older than this many days counts as stale for evidence-based RAG (Amber). */
  staleDataDays: 14,
  /** R16: a join this many days or less after work started is tolerated (0 = any later join counts). */
  coreTeamLateJoinToleranceDays: 0,
} as const;

/**
 * R15 severity by gap. The rule's base severity (RULE_SEVERITY.R15) applies to any
 * missing core role and to one person holding two; a missing role listed here is
 * raised to the given severity on the listed risk tiers.
 */
export const CORE_TEAM_SEVERITY: { role: CoreRole; tiers: RiskTier[]; severity: Severity }[] = [
  { role: 'risk-lead', tiers: ['T3', 'T4'], severity: 'high' },
];

/** Severity each rule raises. Critical findings make evidence-based RAG Red; High makes it Amber. */
export const RULE_SEVERITY: Record<RuleId, Severity> = {
  R1: 'high',
  R2: 'medium',
  R3: 'medium',
  R4: 'medium',
  R5: 'critical',
  R6: 'high',
  R7: 'low',
  R8: 'medium',
  R9: 'low',
  R10: 'high',
  R11: 'high',
  R12: 'high',
  R13: 'critical',
  R14: 'high',
  /** Base severity; raised by CORE_TEAM_SEVERITY (a missing In-Business Risk Lead on T3/T4 is high). */
  R15: 'medium',
  R16: 'medium',
};

/** One-line description of each rule, for tooltips and the About page. */
export const RULE_DESCRIPTIONS: Record<RuleId, string> = {
  R1: 'Milestone due within 14 days and under 60% of linked work closed',
  R2: 'Epic closed while children remain open',
  R3: 'Due date passed and item not closed',
  R4: 'RAID item with no owner, no mitigation date, or no update in 14 days',
  R5: 'Reported Green while a critical dependency is blocked or late',
  R6: 'Dependency committed date falls after the receiver’s need-by date',
  R7: 'Likely duplicate RAID items',
  R8: 'Portfolio-system fields disagree with the Jira Epic (dates, owner, deliverable ID)',
  R9: 'Story-level item with no Outcome ID',
  R10: 'Agent-assigned item with no named human reviewer',
  R11: 'Outcome reported on track or complete with no acceptance recorded',
  R12: 'Evidence older than the latest change to the work it covers',
  R13: 'A required test result is failing',
  R14: 'Epic with no Deliverable ID, or a Deliverable ID that does not exist',
  R15: 'Core Four incomplete: a core role has no named person, or one person holds two core roles',
  R16: 'Work started before the Core Four was complete',
};

/** Evidence-based RAG rules (design section 5). */
export const RAG_RULES = {
  /** Red if any finding at this severity, or a missed committed date. */
  redSeverity: 'critical' as Severity,
  /** Amber if any finding at this severity, or stale data. */
  amberSeverity: 'high' as Severity,
  /** Unknown when a deliverable has fewer work items than this, or no evidence at all. */
  minWorkItemsForRag: 1,
} as const;
