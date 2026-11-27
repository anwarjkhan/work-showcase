/**
 * Content of the Template blueprint screen (design section 4 and 6, D11), as typed data.
 * Everything is written with generic names; system, template and issue-type labels
 * come from `terms`. Edit this file to change the screen, not the components.
 *
 * This is the proposed target template. It is planned, not built.
 */
import { CORE_ROLES, PDLC_STAGES } from './pdlc';
import { terms } from './terminology';
import type { RiskTier, TemplateId, WorkItemType } from '@/lib/types';

const portfolio = terms.systems['portfolio-system'];
const tracker = terms.systems['work-tracker'];

export type Support = 'yes' | 'partial' | 'no';

export interface TemplateProfile {
  id: TemplateId;
  /** What the template is for. */
  purpose: string;
  /** Hierarchy, top to bottom, as written on the card. */
  hierarchy: string[];
  /** Issue types carried by the template. */
  issueTypes: WorkItemType[];
  /** Extra work types (not in the shared type union) the template adds. */
  extraWorkTypes: string[];
  /** Workflow depth: a count and a one-line description. */
  workflowCount: number;
  workflowDepth: string;
  /** Typical status route, as a short description. */
  statusRoute: string;
}

export const TEMPLATE_PROFILES: TemplateProfile[] = [
  {
    id: 'rapid',
    purpose: 'Small, fast-moving teams that need a light board and little ceremony.',
    hierarchy: ['Epic', 'Story level', 'Sub-task'],
    issueTypes: ['epic', 'story', 'task', 'bug', 'sub-task'],
    extraWorkTypes: [],
    workflowCount: 1,
    workflowDepth: 'One shared workflow, 3 to 4 statuses',
    statusRoute: 'To do, In progress, Done',
  },
  {
    id: 'advanced',
    purpose: 'Programmes that plan across several levels and track risks and production issues.',
    hierarchy: ['Theme', 'Initiative', 'Epic', 'Story level', 'Sub-task'],
    issueTypes: ['theme', 'initiative', 'epic', 'story', 'new-feature', 'task', 'bug', 'improvement', 'raid', 'production-issue', 'spike', 'sub-task'],
    extraWorkTypes: [],
    workflowCount: 3,
    workflowDepth: 'A few workflows by issue type, 5 to 7 statuses',
    statusRoute: 'To do, In progress, In review, In test, Done',
  },
  {
    id: 'target',
    purpose: `Estate-wide model that joins ${tracker} to the ${portfolio} and produces evidence for governance.`,
    hierarchy: ['Theme', 'Initiative', 'Epic or Tech Deliverable', 'Story level', 'Sub-task'],
    issueTypes: ['theme', 'initiative', 'epic', 'tech-deliverable', 'story', 'new-feature', 'task', 'bug', 'improvement', 'raid', 'production-issue', 'spike', 'sub-task'],
    extraWorkTypes: ['Dependency', 'Decision', 'Control Exception', 'Governance Action', 'Enabler', 'Technical Debt'],
    workflowCount: 8,
    workflowDepth: 'Eight reusable workflows with evidence gates',
    statusRoute: 'Per workflow, see the workflow library below',
  },
];

export interface CapabilityRow {
  id: string;
  label: string;
  detail: string;
  support: Record<TemplateId, Support>;
}

/** Which new-model capabilities each template can support. */
export const CAPABILITIES: CapabilityRow[] = [
  {
    id: 'deliverable-id',
    label: `${terms.hierarchy.deliverableIdField} on Epics`,
    detail: 'Joins each Epic to one deliverable in the book of record.',
    support: { rapid: 'no', advanced: 'partial', target: 'yes' },
  },
  {
    id: 'many-epics',
    label: 'Many Epics to one deliverable',
    detail: 'A deliverable can span several Epics and several hubs.',
    support: { rapid: 'no', advanced: 'partial', target: 'yes' },
  },
  {
    id: 'outcome-id',
    label: `${terms.hierarchy.outcomeIdField} at story level`,
    detail: 'Work is traced to the outcome it serves, across Epics.',
    support: { rapid: 'no', advanced: 'no', target: 'yes' },
  },
  {
    id: 'acceptance-evidence',
    label: 'Acceptance and evidence references',
    detail: 'Links to who accepted and what evidence is held.',
    support: { rapid: 'no', advanced: 'no', target: 'yes' },
  },
  {
    id: 'core-four',
    label: 'Core Four named on every deliverable',
    detail: `${terms.coreRoles['product-manager']}, ${terms.coreRoles['tech-lead']}, ${terms.coreRoles['risk-lead']} and ${terms.coreRoles['ux-lead']}, each a different person with a joined date.`,
    support: { rapid: 'no', advanced: 'partial', target: 'yes' },
  },
  {
    id: 'pod-assignee',
    label: 'Pod, assignee type and agent identifier',
    detail: 'Humans and agents are visible and attributable.',
    support: { rapid: 'no', advanced: 'partial', target: 'yes' },
  },
  {
    id: 'human-reviewer',
    label: 'Named human reviewer',
    detail: 'Every agent-assigned item has an accountable person.',
    support: { rapid: 'no', advanced: 'no', target: 'yes' },
  },
  {
    id: 'risk-tier',
    label: 'Work-item risk tier (T1 to T4)',
    detail: 'Sets the evidence required and the agent autonomy ceiling.',
    support: { rapid: 'no', advanced: 'no', target: 'yes' },
  },
  {
    id: 'governance-types',
    label: 'Governance work types',
    detail: 'Dependencies, decisions and exceptions as first-class items.',
    support: { rapid: 'no', advanced: 'partial', target: 'yes' },
  },
  {
    id: 'workflow-library',
    label: 'Reusable workflows with evidence gates',
    detail: 'Status routes that can require evidence before closing.',
    support: { rapid: 'no', advanced: 'partial', target: 'yes' },
  },
  {
    id: 'automation',
    label: 'Automation rules for data quality',
    detail: 'Validation and invalidation rules written once, applied everywhere.',
    support: { rapid: 'no', advanced: 'partial', target: 'yes' },
  },
];

/** The current Jira hierarchy as bands, top to bottom. */
export interface HierarchyBand {
  id: string;
  label: string;
  types: WorkItemType[];
  note?: string;
}

export const CURRENT_HIERARCHY: HierarchyBand[] = [
  { id: 'theme', label: 'Theme', types: ['theme'] },
  { id: 'initiative', label: 'Initiative', types: ['initiative'] },
  { id: 'epic', label: 'Epic', types: ['epic'] },
  {
    id: 'story',
    label: 'Story level',
    types: ['story', 'new-feature', 'task', 'bug', 'improvement', 'raid', 'production-issue', 'spike'],
  },
  { id: 'sub-task', label: 'Sub-task', types: ['sub-task'] },
];

export interface NewField {
  id: string;
  name: string;
  purpose: string;
  fieldType: string;
  carriedBy: string[];
  maintainedBy: string;
}

export const NEW_FIELDS: NewField[] = [
  {
    id: 'deliverable-id',
    name: terms.hierarchy.deliverableIdField,
    purpose: `Joins an Epic to one deliverable in the ${portfolio}.`,
    fieldType: 'Text, validated',
    carriedBy: ['Epic', 'Tech Deliverable'],
    maintainedBy: `Entered at Epic creation, validated against the ${portfolio}`,
  },
  {
    id: 'outcome-id',
    name: terms.hierarchy.outcomeIdField,
    purpose: 'Traces work to the outcome it serves, even across Epics.',
    fieldType: 'Text, validated',
    carriedBy: ['Story level'],
    maintainedBy: 'Delivery team; an agent may propose, a person approves',
  },
  {
    id: 'acceptance-ref',
    name: 'Acceptance reference',
    purpose: 'Points to the accepted criterion and who accepted it.',
    fieldType: 'Link',
    carriedBy: ['Story level'],
    maintainedBy: 'Acceptance owner (a named person)',
  },
  {
    id: 'evidence-ref',
    name: 'Evidence reference',
    purpose: 'Points to the test result, review or checklist held as evidence.',
    fieldType: 'Link',
    carriedBy: ['Story level', 'Epic'],
    maintainedBy: 'Written by integrations; never typed by an agent',
  },
  {
    id: 'pod',
    name: 'Pod',
    purpose: 'Names the team of people and agents that own the work.',
    fieldType: 'Select',
    carriedBy: ['Epic', 'Story level'],
    maintainedBy: terms.coreRoles['tech-lead'],
  },
  {
    id: 'assignee-type',
    name: 'Assignee type',
    purpose: 'Shows whether a person or an agent is doing the work.',
    fieldType: 'Select: human or agent',
    carriedBy: ['Story level', 'Sub-task'],
    maintainedBy: 'Set by assignment; read-only afterwards',
  },
  {
    id: 'agent-id',
    name: 'Agent identifier',
    purpose: 'Names the agent so every action is attributable.',
    fieldType: 'Text, validated',
    carriedBy: ['Story level', 'Sub-task'],
    maintainedBy: 'Set from the agent register',
  },
  {
    id: 'human-reviewer',
    name: 'Human reviewer',
    purpose: 'The named person accountable for an agent-assigned item.',
    fieldType: 'User',
    carriedBy: ['Story level', 'Sub-task'],
    maintainedBy: `${terms.coreRoles['tech-lead']}; required when assignee type is agent`,
  },
  {
    id: 'risk-tier',
    name: 'Work-item risk tier',
    purpose: 'T1 to T4. Sets required evidence and the agent autonomy ceiling.',
    fieldType: 'Select: T1 to T4',
    carriedBy: ['Epic', 'Story level'],
    maintainedBy: 'Inherited from the deliverable; changed by a risk owner',
  },
  ...CORE_ROLES.map((roleId): NewField => ({
    id: `core-${roleId}`,
    name: terms.coreRoles[roleId],
    purpose:
      roleId === 'product-manager'
        ? 'Owns the process and decides the go / no-go at every stage gate, always last.'
        : roleId === 'tech-lead'
          ? 'Confirms the architecture, the technical validation and the release checklist.'
          : roleId === 'risk-lead'
            ? 'Names the obligations and confirms risk and controls for the second line.'
            : 'Confirms the user context and reviews the prototype.',
    fieldType: 'User picker, with the date they joined',
    carriedBy: ['Epic', 'Tech Deliverable'],
    maintainedBy: `${terms.coreRoles['product-manager']}; a different person in each seat`,
  })),
  {
    id: 'governance-mode',
    name: 'Governance mode',
    purpose: 'How closely the deliverable is governed, so the reviews and evidence it needs follow from it.',
    fieldType: 'Select (single choice)',
    carriedBy: ['Epic', 'Tech Deliverable'],
    maintainedBy: `Set by the ${terms.coreRoles['product-manager']}, advised by the ${terms.coreRoles['risk-lead']}`,
  },
  {
    id: 'requirements-validation',
    name: 'Requirements validation result',
    purpose: 'The outcome of validating the requirements before design starts.',
    fieldType: 'Select: Pass, Conditional pass or Fail',
    carriedBy: ['Epic', 'Tech Deliverable'],
    maintainedBy: `Recorded at the first stage gate; the ${terms.coreRoles['product-manager']} decides after the confirmations`,
  },
  {
    id: 'risk-sign-off',
    name: 'Risk sign-off reference',
    purpose: 'Who confirmed risk and controls for the second line, and when.',
    fieldType: 'Link, with the name and date of the person',
    carriedBy: ['Epic', 'Tech Deliverable'],
    maintainedBy: `${terms.coreRoles['risk-lead']} (a named person); never typed by an agent`,
  },
];

export interface GovernanceType {
  id: string;
  name: string;
  purpose: string;
}

/** Further work types a target template would add for governance. */
export const GOVERNANCE_TYPES: GovernanceType[] = [
  { id: 'dependency', name: 'Dependency', purpose: 'A need between teams or hubs, with a committed date.' },
  { id: 'decision', name: 'Decision', purpose: 'A choice with an owner, options and a recorded outcome.' },
  { id: 'control-exception', name: 'Control Exception', purpose: 'A time-boxed, approved departure from a control.' },
  { id: 'governance-action', name: 'Governance Action', purpose: 'An action raised by a review or forum, tracked to closure.' },
  { id: 'enabler', name: 'Enabler', purpose: 'Foundation work that unlocks later outcomes.' },
  { id: 'technical-debt', name: 'Technical Debt', purpose: 'Known shortcuts tracked and paid down on purpose.' },
];

export interface WorkflowSummary {
  id: string;
  name: string;
  appliesTo: string;
  route: string[];
  /** A step that needs recorded evidence or a named person before moving on. */
  gate?: string;
}

/** Eight reusable workflows and their status routes. */
export const WORKFLOWS: WorkflowSummary[] = [
  { id: 'outcome', name: 'Outcome', appliesTo: 'Outcome-level items', route: ['Defined', 'In delivery', 'Awaiting acceptance', 'Accepted'], gate: 'Accepted needs a named person' },
  { id: 'delivery', name: 'Delivery', appliesTo: 'Story, New Feature, Improvement', route: ['To do', 'In progress', 'In review', 'In test', 'Done'], gate: 'Done needs linked evidence at higher tiers' },
  { id: 'task', name: 'Task', appliesTo: 'Task, Spike, Enabler, Technical Debt', route: ['To do', 'In progress', 'Done'] },
  { id: 'defect', name: 'Defect', appliesTo: 'Bug, Production Issue', route: ['Raised', 'Triaged', 'Fixing', 'Verified', 'Closed'], gate: 'Closed needs a verifying test' },
  { id: 'risk', name: 'Risk', appliesTo: 'RAID', route: ['Identified', 'Assessed', 'Mitigating', 'Accepted or closed'], gate: 'Needs owner and review date' },
  { id: 'dependency', name: 'Dependency', appliesTo: 'Dependency', route: ['Requested', 'Committed', 'In progress', 'Delivered'], gate: 'Committed needs a date' },
  { id: 'decision', name: 'Decision', appliesTo: 'Decision', route: ['Proposed', 'Under review', 'Decided', 'Superseded'], gate: 'Decided needs a named decider' },
  { id: 'exception', name: 'Exception', appliesTo: 'Control Exception, Governance Action', route: ['Requested', 'Under review', 'Approved', 'Expired or closed'], gate: 'Approved needs the control owner and an expiry date' },
];

export interface AutomationRule {
  id: string;
  when: string;
  then: string;
}

/** Automation rules, written generically. */
export const AUTOMATION_RULES: AutomationRule[] = [
  { id: 'validate-deliverable', when: 'An Epic is created', then: `Validate the ${terms.hierarchy.deliverableIdField} against the ${portfolio}. Never overwrite the ${portfolio} record from ${tracker}.` },
  { id: 'no-done-from-agent', when: 'An agent run finishes', then: 'Never mark an item done from an agent run alone. A named person closes it.' },
  { id: 'invalidate-evidence', when: 'Code or scope changes after evidence was recorded', then: 'Mark the readiness evidence as stale until it is refreshed.' },
  { id: 'reviewer-required', when: 'Assignee type is set to agent', then: 'Require a named human reviewer and an agent identifier.' },
  { id: 'outcome-required', when: 'A story-level item moves to In progress', then: `Require an ${terms.hierarchy.outcomeIdField}, or raise a data-quality flag.` },
  { id: 'core-four-gate', when: `A deliverable is moved past ${PDLC_STAGES[0]!.name}`, then: `Block the move until all four ${terms.coreTeam.name} seats are filled, each by a different person.` },
  { id: 'tier-ceiling', when: 'An item has a risk tier', then: 'Apply the agent autonomy ceiling for that tier; at T4 agents may advise only.' },
];

/** Rows of the mapping diagram, portfolio side on the left and Jira side on the right. */
export interface MappingRow {
  id: string;
  portfolioLabel: string;
  portfolioNote: string;
  join?: string;
  trackerLabel: string[];
  trackerNote: string;
}

export const MAPPING_ROWS: MappingRow[] = [
  {
    id: 'request',
    portfolioLabel: terms.hierarchy.investmentRequest,
    portfolioNote: 'Objective, owner, activity risk',
    trackerLabel: ['Not required'],
    trackerNote: 'No counterpart needed in the tracker',
  },
  {
    id: 'node',
    portfolioLabel: `${terms.hierarchy.initiative} / ${terms.hierarchy.programme} / ${terms.hierarchy.project}`,
    portfolioNote: 'Moderate and high activity risk only',
    trackerLabel: ['Theme', 'Initiative'],
    trackerNote: 'Optional grouping; not authoritative',
  },
  {
    id: 'deliverable',
    portfolioLabel: terms.hierarchy.deliverable,
    portfolioNote: 'Reported RAG lives here',
    join: terms.hierarchy.deliverableIdField,
    trackerLabel: ['Epic', 'Tech Deliverable'],
    trackerNote: 'One or more Epics per deliverable; an Epic belongs to exactly one',
  },
  {
    id: 'outcome',
    portfolioLabel: terms.hierarchy.outcome,
    portfolioNote: 'Acceptance criteria and acceptance',
    join: terms.hierarchy.outcomeIdField,
    trackerLabel: ['Story', 'Task', 'Bug', 'and other story-level types'],
    trackerNote: 'An outcome can draw work from several Epics of its deliverable',
  },
  {
    id: 'subtask',
    portfolioLabel: 'No counterpart',
    portfolioNote: 'Below the level the book of record tracks',
    trackerLabel: ['Sub-task'],
    trackerNote: 'Team-level working detail',
  },
];

/** Placeholder labels for the rollout view. These numbers are round and synthetic. */
export const ROLLOUT_PLACEHOLDER_NOTE =
  'Round, synthetic placeholder numbers. Replace with the real project counts in lib/config/estate.ts.';

export const TIER_ORDER: RiskTier[] = ['T1', 'T2', 'T3', 'T4'];
