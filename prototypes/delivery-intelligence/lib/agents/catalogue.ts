/**
 * Agent catalogue: metadata only, no logic (design section 5, "Agents").
 *
 * Safe to import from any screen. Implementations (the `run` functions) live in
 * `lib/agents/definitions/*` and are joined to this metadata in `lib/agents/index.ts`.
 * Stages agree with `PDLC_STAGES[].agentAssist` and `CROSS_CUTTING_AGENTS` in
 * `lib/config/pdlc.ts` (a test keeps them in step).
 */
import type { AgentId, AgentMode, PdlcStageId } from '@/lib/types';
import type { AgentScopeKind } from './types';
import { CROSS_CUTTING_AGENTS } from '@/lib/config/pdlc';

/** Lucide icon component names used by the catalogue (import from `lucide-react`). */
export type AgentIconName =
  | 'ListTree'
  | 'Target'
  | 'ShieldCheck'
  | 'Rocket'
  | 'TriangleAlert'
  | 'Waypoints'
  | 'GitCompare'
  | 'FileText'
  | 'Presentation';

export interface AgentCatalogueEntry {
  id: AgentId;
  name: string;
  /** One-line purpose. */
  purpose: string;
  /** PDLC stages it assists; empty means cross-cutting. */
  stages: PdlcStageId[];
  mode: AgentMode;
  /** What it produces. */
  output: string;
  /** Scopes it accepts, in order of preference (first is the default). `programme` is local to lib/agents (see types.ts). */
  scopes: AgentScopeKind[];
  /** Lucide icon component name, e.g. `import { ListTree } from 'lucide-react'`. */
  icon: AgentIconName;
}

export const AGENT_CATALOGUE: Record<AgentId, AgentCatalogueEntry> = {
  'requirements-structuring': {
    id: 'requirements-structuring',
    name: 'Requirements structuring',
    purpose: 'Turns a thin Epic into stories with testable acceptance criteria.',
    stages: ['ideation-requirements'],
    mode: 'draft',
    output: 'Proposed stories with acceptance criteria for a thin Epic',
    scopes: ['pdlc-stage', 'deliverable'],
    icon: 'ListTree',
  },
  'outcome-mapping': {
    id: 'outcome-mapping',
    name: 'Outcome mapping',
    purpose: 'Suggests the Outcome ID for story-level items that carry none.',
    stages: ['design-specifications'],
    mode: 'propose-change',
    output: 'Outcome ID suggestions for unmapped items',
    scopes: ['deliverable', 'pdlc-stage', 'programme', 'portfolio'],
    icon: 'Target',
  },
  'control-evidence-check': {
    id: 'control-evidence-check',
    name: 'Control evidence check',
    purpose: 'Checks the evidence and fields the risk tier requires, and reports gaps.',
    stages: ['risk-control-compliance'],
    mode: 'read-only',
    output: "Missing fields and evidence for the item's risk tier",
    scopes: ['deliverable', 'pdlc-stage', 'programme', 'portfolio'],
    icon: 'ShieldCheck',
  },
  'release-readiness': {
    id: 'release-readiness',
    name: 'Release readiness',
    purpose: 'Builds the readiness checklist from held evidence and lists exceptions.',
    stages: ['build-test-validate', 'delivery-launch'],
    mode: 'read-only',
    output: 'Readiness checklist with exceptions',
    scopes: ['deliverable', 'pdlc-stage', 'programme', 'portfolio'],
    icon: 'Rocket',
  },
  'raid-quality': {
    id: 'raid-quality',
    name: 'RAID quality',
    purpose: 'Finds RAID items with no owner, no mitigation date or a likely duplicate.',
    stages: [],
    mode: 'propose-change',
    output: 'Owner, date and duplicate fixes',
    scopes: ['portfolio', 'programme', 'deliverable'],
    icon: 'TriangleAlert',
  },
  'dependency-discovery': {
    id: 'dependency-discovery',
    name: 'Dependency discovery',
    purpose: 'Finds cross-deliverable dependencies the plan does not record.',
    stages: [],
    mode: 'propose-change',
    output: 'Candidate dependencies with evidence',
    scopes: ['portfolio', 'programme', 'deliverable'],
    icon: 'Waypoints',
  },
  'portfolio-reconciliation': {
    id: 'portfolio-reconciliation',
    name: 'Portfolio reconciliation',
    purpose: 'Compares the book of record with the Epics in the work tracker.',
    stages: [],
    mode: 'read-only',
    output: 'Book-of-record against work-tracker discrepancy report',
    scopes: ['portfolio', 'programme', 'deliverable'],
    icon: 'GitCompare',
  },
  'status-reporting': {
    id: 'status-reporting',
    name: 'Status reporting',
    purpose: 'Drafts the weekly status from the records, citing each sentence.',
    stages: [],
    mode: 'draft',
    output: 'Weekly status with a citation per sentence',
    scopes: ['deliverable', 'programme', 'portfolio'],
    icon: 'FileText',
  },
  'executive-briefing': {
    id: 'executive-briefing',
    name: 'Executive briefing',
    purpose: 'Drafts a decision-focused brief across the portfolio.',
    stages: [],
    mode: 'draft',
    output: 'Decision-focused portfolio brief',
    scopes: ['portfolio', 'programme'],
    icon: 'Presentation',
  },
};

/** Catalogue order (design section 5 table order). */
export const AGENT_IDS: AgentId[] = [
  'requirements-structuring',
  'outcome-mapping',
  'control-evidence-check',
  'release-readiness',
  'raid-quality',
  'dependency-discovery',
  'portfolio-reconciliation',
  'status-reporting',
  'executive-briefing',
];

/** Agents that assist a PDLC stage, in catalogue order. */
export function agentsForStage(stageId: PdlcStageId): AgentCatalogueEntry[] {
  return AGENT_IDS.map((id) => AGENT_CATALOGUE[id]).filter((a) => a.stages.includes(stageId));
}

/** Agents not tied to a stage, in the order of `CROSS_CUTTING_AGENTS`. */
export function crossCuttingAgents(): AgentCatalogueEntry[] {
  return CROSS_CUTTING_AGENTS.map((id) => AGENT_CATALOGUE[id]);
}
