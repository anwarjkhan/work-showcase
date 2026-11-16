/**
 * Every label for a system, template, tool, level or status. Components never
 * hard-code these words: import `terms` (or a helper below) instead.
 *
 * The values are deliberately generic. Inside the firm, create the git-ignored
 * `lib/config/terminology.local.ts` (copy `terminology.local.fallback.ts`) and
 * override any subset. The build resolves the alias `@local/terminology` to that
 * file when it exists and to the empty fallback when it does not.
 */
import localOverride from '@local/terminology';
import type {
  ActivityRisk,
  AgentMode,
  AutonomyCeiling,
  CriterionState,
  DeliveryRoute,
  DependencyStatus,
  EvidenceHeldState,
  EvidenceKind,
  EvidenceRagStatus,
  EvidenceResult,
  PmNodeLevel,
  Provenance,
  RaidKind,
  ReadinessState,
  ReviewRoleId,
  RiskTier,
  Severity,
  SourceSystemId,
  StatusCategory,
  TemplateId,
  WorkItemType,
} from '@/lib/types';

export const baseTerminology = {
  app: {
    name: 'Delivery Intelligence',
    tagline: 'Evidence-based delivery insight across the portfolio',
    /** Short line under the product name in the navigation. */
    navSubtitle: 'Evidence-based delivery',
    /** Name for the simplified project-management hierarchy model. */
    hierarchyModel: 'Simplified delivery hierarchy',
    lifecycleModel: 'AI-first product delivery lifecycle',
    lifecycleShort: 'PDLC',
    demoNotice: 'Synthetic data for demonstration only',
  },
  systems: {
    'portfolio-system': 'Portfolio system',
    'work-tracker': 'Jira',
    'test-harness': 'Test automation',
    'document-store': 'Document store',
    'control-register': 'Control register',
    'release-tool': 'Release tooling',
    'in-app': 'This prototype',
  } satisfies Record<SourceSystemId, string>,
  /** Short forms for tight spaces (badges, table headers). */
  systemsShort: {
    'portfolio-system': 'Portfolio',
    'work-tracker': 'Jira',
    'test-harness': 'Tests',
    'document-store': 'Docs',
    'control-register': 'Controls',
    'release-tool': 'Release',
    'in-app': 'App',
  } satisfies Record<SourceSystemId, string>,
  bookOfRecord: 'Book of record',
  bookOfRecordBoundary: 'Book-of-record boundary',
  modelPlatform: 'Approved model platform',
  templates: {
    rapid: 'Rapid template',
    advanced: 'Advanced template',
    target: 'Target template',
  } satisfies Record<TemplateId, string>,
  hierarchy: {
    investmentRequest: 'Investment request',
    initiative: 'Initiative',
    programme: 'Programme',
    project: 'Project',
    deliverable: 'Technology deliverable',
    deliverableShort: 'Deliverable',
    outcome: 'Outcome',
    criterion: 'Acceptance criterion',
    epic: 'Epic',
    story: 'Story',
    subTask: 'Sub-task',
    deliverableIdField: 'Deliverable ID',
    outcomeIdField: 'Outcome ID',
  },
  pmNodeLevels: {
    initiative: 'Initiative',
    programme: 'Programme',
    project: 'Project',
  } satisfies Record<PmNodeLevel, string>,
  routes: {
    formal: 'Formal route',
    standalone: 'Standalone deliverable',
  } satisfies Record<DeliveryRoute, string>,
  activityRisk: {
    low: 'Low',
    moderate: 'Moderate',
    high: 'High',
  } satisfies Record<ActivityRisk, string>,
  riskTiers: {
    T1: 'T1 Low',
    T2: 'T2 Moderate',
    T3: 'T3 High',
    T4: 'T4 Critical / Regulated',
  } satisfies Record<RiskTier, string>,
  workItemTypes: {
    theme: 'Theme',
    initiative: 'Initiative',
    epic: 'Epic',
    'tech-deliverable': 'Tech Deliverable',
    story: 'Story',
    'new-feature': 'New Feature',
    task: 'Task',
    bug: 'Bug',
    improvement: 'Improvement',
    raid: 'RAID',
    'production-issue': 'Production Issue',
    spike: 'Spike',
    'sub-task': 'Sub-task',
  } satisfies Record<WorkItemType, string>,
  statusCategories: {
    'to-do': 'To do',
    'in-progress': 'In progress',
    done: 'Done',
  } satisfies Record<StatusCategory, string>,
  measures: {
    workCompletion: 'Work completion',
    acceptedOutcomes: 'Accepted outcomes',
    readiness: 'Delivery readiness',
    notComputable: 'Not computable',
  },
  readiness: {
    ready: 'Ready',
    'not-ready': 'Not ready',
    unknown: 'Unknown',
  } satisfies Record<ReadinessState, string>,
  rag: {
    red: 'Red',
    amber: 'Amber',
    green: 'Green',
    unknown: 'Unknown',
  } satisfies Record<EvidenceRagStatus, string>,
  ragKinds: {
    reported: 'Reported',
    evidence: 'Evidence-based',
  },
  severity: {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  } satisfies Record<Severity, string>,
  evidenceKinds: {
    'requirements-sign-off': 'Requirements sign-off',
    'design-review': 'Design review',
    'control-assessment': 'Control assessment',
    'test-result': 'Test result',
    'business-acceptance': 'Business acceptance',
    'release-checklist': 'Release checklist',
  } satisfies Record<EvidenceKind, string>,
  evidenceResults: {
    pass: 'Pass',
    fail: 'Fail',
    pending: 'Pending',
  } satisfies Record<EvidenceResult, string>,
  evidenceHeld: {
    passing: 'Held, passing',
    failing: 'Held, failing',
    pending: 'Pending',
    stale: 'Stale',
    missing: 'Missing',
  } satisfies Record<EvidenceHeldState, string>,
  criterionStates: {
    open: 'Open',
    accepted: 'Accepted',
    rejected: 'Rejected',
  } satisfies Record<CriterionState, string>,
  raidKinds: {
    risk: 'Risk',
    assumption: 'Assumption',
    issue: 'Issue',
    dependency: 'Dependency',
  } satisfies Record<RaidKind, string>,
  dependencyStatus: {
    'on-track': 'On track',
    'at-risk': 'At risk',
    late: 'Late',
    blocked: 'Blocked',
    delivered: 'Delivered',
  } satisfies Record<DependencyStatus, string>,
  reviewRoles: {
    'requirements-owner': 'Requirements owner',
    'design-reviewer': 'Design reviewer',
    'control-owner': 'Control owner',
    'independent-validator': 'Independent validator',
    'business-owner': 'Business owner',
    'release-owner': 'Release owner',
  } satisfies Record<ReviewRoleId, string>,
  agentModes: {
    'read-only': 'Read only',
    'propose-change': 'Propose change',
    draft: 'Draft',
  } satisfies Record<AgentMode, string>,
  autonomy: {
    'auto-apply': 'May auto-apply allowed changes',
    'propose-only': 'Propose only',
    'advisory-only': 'Advisory only',
  } satisfies Record<AutonomyCeiling, string>,
  /** Provenance badge labels (design section 4, plus simulated evidence). */
  provenance: {
    sample: 'Sample data',
    computed: 'Computed from data',
    'scripted-agent': 'Scripted agent',
    reported: 'Portfolio system (reported)',
    planned: 'Planned',
    simulated: 'Simulated evidence',
  } satisfies Record<Provenance, string>,
  provenanceHelp: {
    sample: 'Synthetic records generated for this demonstration.',
    computed: 'Calculated in the browser from the records shown, by deterministic rules.',
    'scripted-agent': 'Produced by a deterministic scripted agent, not a language model.',
    reported: 'As recorded in the portfolio system, the book of record.',
    planned: 'Not built or measured yet; shown to describe the intended pilot.',
    simulated: 'Created by a demo control to stand in for evidence arriving. Nothing was executed.',
  } satisfies Record<Provenance, string>,
  shell: {
    navLabel: 'Main navigation',
    resetDemo: 'Reset demo',
    resetDone: 'Demo reset',
    resetConfirm: 'Restore the seeded data and clear agent runs, approvals and the audit trail?',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeSwitch: 'Switch theme',
    demoClock: 'Demo clock',
    dataSource: 'Data source',
    comingSoon: 'Coming in this build',
  },
};

export type Terminology = typeof baseTerminology;

/** Recursive partial used by the local override. */
export type TerminologyOverride = DeepPartial<Terminology>;

type DeepPartial<T> = { [K in keyof T]?: T[K] extends string ? string : T[K] extends object ? DeepPartial<T[K]> : T[K] };

/** Deep-merges `override` onto `base`. Only string leaves are replaced; unknown keys are ignored. */
export function mergeTerminology<T extends object>(base: T, override: DeepPartial<T> | undefined | null): T {
  if (!override) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
    if (!(key in out) || value === undefined || value === null) continue;
    const current = out[key];
    if (typeof current === 'string' && typeof value === 'string') {
      out[key] = value;
    } else if (current && typeof current === 'object' && typeof value === 'object') {
      out[key] = mergeTerminology(current as object, value as DeepPartial<object>);
    }
  }
  return out as T;
}

/** The labels to use everywhere: base terminology with the optional local override applied. */
export const terms: Terminology = mergeTerminology(baseTerminology, localOverride);

/** Convenience: label for a system id. */
export function systemLabel(id: SourceSystemId, short = false): string {
  return short ? terms.systemsShort[id] : terms.systems[id];
}

/** Convenience: provenance badge label. */
export function provenanceLabel(p: Provenance): string {
  return terms.provenance[p];
}
