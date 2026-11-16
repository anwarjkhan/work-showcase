/**
 * Engine constants. Rule thresholds come from lib/config/thresholds.ts; the few
 * numbers the design leaves open and config does not hold are named here so
 * they are easy to find and tune.
 */
import type { WorkItemType } from '@/lib/types';

export { RAG_RULES, RULE_SEVERITY, RULE_THRESHOLDS } from '@/lib/config/thresholds';

/** Forecast: throughput is measured over the closed points of this many days before today (three sprints). */
export const FORECAST_LOOKBACK_DAYS = 42;

/** Upper bound on evidence references attached to one finding, to keep findings readable. */
export const MAX_FINDING_REFS = 25;

/** Jira types at Epic level. A "Tech Deliverable" issue type is the target option at the same level. */
export const EPIC_TYPES: ReadonlySet<WorkItemType> = new Set<WorkItemType>(['epic', 'tech-deliverable']);

/** Story-level types: the items that carry points and an Outcome ID. */
export const STORY_LEVEL_TYPES: ReadonlySet<WorkItemType> = new Set<WorkItemType>([
  'story',
  'new-feature',
  'task',
  'bug',
  'improvement',
  'raid',
  'production-issue',
  'spike',
]);

/** Story-level types that are not expected to carry an Outcome ID (rule R9): RAID items record risk, not outcome work. */
export const OUTCOME_ID_EXEMPT_TYPES: ReadonlySet<WorkItemType> = new Set<WorkItemType>(['raid']);

/** Words ignored when comparing RAID titles for duplicates (rule R7). */
export const DUPLICATE_STOP_WORDS: ReadonlySet<string> = new Set([
  'a',
  'an',
  'and',
  'at',
  'by',
  'for',
  'from',
  'in',
  'is',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
]);
