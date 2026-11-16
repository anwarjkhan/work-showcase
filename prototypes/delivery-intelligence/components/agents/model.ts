/**
 * Pure helpers for the Agent centre (D12). No React, no store: everything here
 * takes the store's state (or parts of it) and returns plain values, so it can
 * be unit-tested and reused by the guided demo.
 */
import { AGENT_CATALOGUE, acceptsScope, checkApproval, checkRejection, getAgent, requirePerson, resolveRef, runScopeOf, scopeLabel, type AgentRunScope, type Check } from '@/lib/agents';
import { RISK_TIERS, RISK_TIER_POLICIES } from '@/lib/config/risk-tiers';
import { HERO_DELIVERABLE_ID, PRESENTER_PERSON_ID, WORKFLOW_DELIVERABLE_ID } from '@/lib/config/story';
import { terms } from '@/lib/config/terminology';
import type {
  AgentId,
  AgentMode,
  AgentRun,
  AuditAction,
  AuditEvent,
  Computable,
  DemoState,
  EngineResult,
  EntityRef,
  EvidenceRagStatus,
  AcceptedOutcomes,
  PortfolioData,
  ProposalStatus,
  ProposedChange,
  RagStatus,
  ReadinessState,
  RiskTier,
  WorkCompletion,
} from '@/lib/types';

// ---------------------------------------------------------------------------
// Scopes
// ---------------------------------------------------------------------------

/** Scope kinds offered in the console. `pdlc-stage` runs belong to the PDLC workflow screen. */
export type ConsoleScopeKind = 'portfolio' | 'programme' | 'deliverable';

/** Scope kinds the agent accepts, in its order of preference, as offered here. */
export function consoleScopeKinds(agentId: AgentId): ConsoleScopeKind[] {
  const out: ConsoleScopeKind[] = [];
  for (const k of AGENT_CATALOGUE[agentId].scopes) {
    const kind: ConsoleScopeKind = k === 'pdlc-stage' ? 'deliverable' : k;
    if (!out.includes(kind)) out.push(kind);
  }
  return out;
}

/** Where each agent gives a strong first result (all of these are checked against the agent's accepted scopes). */
const PREFERRED_SCOPE: Record<AgentId, AgentRunScope> = {
  'requirements-structuring': { kind: 'deliverable', deliverableId: WORKFLOW_DELIVERABLE_ID },
  'outcome-mapping': { kind: 'portfolio' },
  'control-evidence-check': { kind: 'deliverable', deliverableId: HERO_DELIVERABLE_ID },
  'release-readiness': { kind: 'deliverable', deliverableId: HERO_DELIVERABLE_ID },
  'raid-quality': { kind: 'portfolio' },
  'dependency-discovery': { kind: 'portfolio' },
  'portfolio-reconciliation': { kind: 'portfolio' },
  'status-reporting': { kind: 'deliverable', deliverableId: HERO_DELIVERABLE_ID },
  'executive-briefing': { kind: 'portfolio' },
};

export function defaultScope(agentId: AgentId, data: PortfolioData): AgentRunScope {
  const preferred = PREFERRED_SCOPE[agentId];
  if (isScopeValid(agentId, preferred, data)) return preferred;
  return scopeOfKind(agentId, consoleScopeKinds(agentId)[0] ?? 'portfolio', data);
}

/** A sensible scope of the given kind for the agent (hero records first). */
export function scopeOfKind(agentId: AgentId, kind: ConsoleScopeKind, data: PortfolioData): AgentRunScope {
  if (kind === 'portfolio') return { kind: 'portfolio' };
  if (kind === 'programme') {
    const hero = data.deliverables.find((d) => d.id === HERO_DELIVERABLE_ID);
    const programmes = programmeOptions(data);
    const heroProgramme = hero ? programmes.find((p) => isAncestor(data, p.id, hero.pmNodeId)) : undefined;
    return { kind: 'programme', pmNodeId: (heroProgramme ?? programmes[0])?.id ?? '' };
  }
  const preferred = PREFERRED_SCOPE[agentId];
  const id = preferred.kind === 'deliverable' ? preferred.deliverableId : HERO_DELIVERABLE_ID;
  return { kind: 'deliverable', deliverableId: data.deliverables.some((d) => d.id === id) ? id : (data.deliverables[0]?.id ?? id) };
}

export function isScopeValid(agentId: AgentId, scope: AgentRunScope, data: PortfolioData): boolean {
  const agent = getAgent(agentId);
  if (!agent || !acceptsScope(agent, scope)) return false;
  if (scope.kind === 'deliverable' || scope.kind === 'pdlc-stage') return data.deliverables.some((d) => d.id === scope.deliverableId);
  if (scope.kind === 'programme') return data.pmNodes.some((n) => n.id === scope.pmNodeId);
  return true;
}

function isAncestor(data: PortfolioData, ancestorId: string, nodeId: string | null): boolean {
  let id = nodeId;
  for (let guard = 0; id && guard < 10; guard += 1) {
    if (id === ancestorId) return true;
    id = data.pmNodes.find((n) => n.id === id)?.parentId ?? null;
  }
  return false;
}

/** Programmes (the PmNodes at programme level), in data order. */
export function programmeOptions(data: PortfolioData) {
  return data.pmNodes.filter((n) => n.level === 'programme');
}

/** Stable string for a scope (select values, React keys, deep links). */
export function scopeKey(scope: AgentRunScope): string {
  switch (scope.kind) {
    case 'portfolio':
      return 'portfolio';
    case 'programme':
      return `programme:${scope.pmNodeId}`;
    case 'deliverable':
      return `deliverable:${scope.deliverableId}`;
    case 'pdlc-stage':
      return `stage:${scope.deliverableId}:${scope.stageId}`;
  }
}

/** Human label for a scope, e.g. "the portfolio", "programme PRG-01 “…”", "TD-1001 “…”". */
export function describeScope(data: PortfolioData, scope: AgentRunScope): string {
  if (scope.kind === 'deliverable' || scope.kind === 'pdlc-stage') {
    const d = data.deliverables.find((x) => x.id === scope.deliverableId);
    return d ? `${d.ref} “${d.title}”` : scope.deliverableId;
  }
  return scopeLabel(data, scope);
}

// ---------------------------------------------------------------------------
// Presets and deep links
// ---------------------------------------------------------------------------

export interface Preset {
  /** Also the deep-link hash (without '#'). */
  id: string;
  label: string;
  agentId: AgentId;
  scope: AgentRunScope;
}

/** One-click presets; labels are built from the data so titles stay true. */
export function presets(data: PortfolioData): Preset[] {
  const hero = data.deliverables.find((d) => d.id === HERO_DELIVERABLE_ID);
  const wf = data.deliverables.find((d) => d.id === WORKFLOW_DELIVERABLE_ID);
  const list: Preset[] = [
    { id: 'run-raid-quality', label: 'RAID quality across the portfolio', agentId: 'raid-quality', scope: { kind: 'portfolio' } },
    { id: 'status-hero', label: hero ? `Status report for “${hero.title}”` : 'Status report for the hero deliverable', agentId: 'status-reporting', scope: { kind: 'deliverable', deliverableId: HERO_DELIVERABLE_ID } },
    { id: 'outcomes-portfolio', label: 'Outcome mapping across the portfolio', agentId: 'outcome-mapping', scope: { kind: 'portfolio' } },
    { id: 'brief-portfolio', label: 'Executive brief for the portfolio', agentId: 'executive-briefing', scope: { kind: 'portfolio' } },
    { id: 'reconcile-portfolio', label: `${terms.bookOfRecord} against ${terms.systems['work-tracker']}`, agentId: 'portfolio-reconciliation', scope: { kind: 'portfolio' } },
    { id: 'readiness-hero', label: hero ? `Readiness checklist for ${hero.ref}` : 'Readiness checklist', agentId: 'release-readiness', scope: { kind: 'deliverable', deliverableId: HERO_DELIVERABLE_ID } },
    { id: 'requirements-workflow', label: wf ? `Requirements for ${wf.ref}` : 'Requirements structuring', agentId: 'requirements-structuring', scope: { kind: 'deliverable', deliverableId: WORKFLOW_DELIVERABLE_ID } },
  ];
  return list.filter((p) => isScopeValid(p.agentId, p.scope, data));
}

export type HashTarget = { agentId: AgentId; scope: AgentRunScope; tab?: undefined } | { tab: 'audit' | 'history'; agentId?: undefined; scope?: undefined };

/**
 * Reads a deep-link hash. Supported:
 *   #run-<agent-id>          that agent with its default scope (e.g. #run-raid-quality, #run-status-reporting)
 *   #<preset-id>             a preset (#status-hero, #outcomes-portfolio, #brief-portfolio, #reconcile-portfolio, #readiness-hero, #requirements-workflow)
 *   #audit, #history         open the audit trail or run history tab
 * Unknown hashes return null. Nothing is run.
 */
export function parseHash(hash: string, data: PortfolioData): HashTarget | null {
  const h = decodeURIComponent(hash.replace(/^#/, '')).trim();
  if (!h) return null;
  if (h === 'audit' || h === 'history') return { tab: h };
  const preset = presets(data).find((p) => p.id === h);
  if (preset) return { agentId: preset.agentId, scope: preset.scope };
  if (h.startsWith('run-')) {
    const id = h.slice(4) as AgentId;
    if (id in AGENT_CATALOGUE) return { agentId: id, scope: defaultScope(id, data) };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Autonomy by tier
// ---------------------------------------------------------------------------

export interface TierCell {
  tier: RiskTier;
  /** Short label for a narrow strip. */
  short: string;
  /** Full sentence for a tooltip and screen readers. */
  long: string;
  tone: 'green' | 'accent' | 'amber' | 'neutral';
}

const fieldLabel = (entity: string, field: string): string => {
  if (field === 'outcomeId') return `${terms.hierarchy.outcomeIdField} on work items`;
  if (field === 'mitigationDue') return 'mitigation date on RAID items';
  return `${field} on ${entity}`;
};

/** Fields T1 may auto-apply, in words. */
export function autoApplyFieldsText(): string {
  return RISK_TIER_POLICIES.T1.autoApplyAllowed.map((a) => fieldLabel(a.entity, a.field)).join(' and ');
}

/** What an agent of this mode may do for items at each risk tier (from the tier policies). */
export function tierStrip(mode: AgentMode): TierCell[] {
  return RISK_TIERS.map((tier) => {
    const ceiling = RISK_TIER_POLICIES[tier].autonomy;
    if (mode === 'read-only') {
      return { tier, short: 'Report', long: `${terms.riskTiers[tier]}: reports only; this agent changes no records at any tier.`, tone: 'neutral' as const };
    }
    if (ceiling === 'advisory-only') {
      return { tier, short: 'Advise', long: `${terms.riskTiers[tier]}: ${terms.autonomy[ceiling]}. Nothing it raises can be approved or applied.`, tone: 'amber' as const };
    }
    if (ceiling === 'auto-apply') {
      return { tier, short: 'Auto*', long: `${terms.riskTiers[tier]}: ${terms.autonomy[ceiling]} (${autoApplyFieldsText()}); anything else is proposed for a named person to approve.`, tone: 'green' as const };
    }
    return { tier, short: 'Propose', long: `${terms.riskTiers[tier]}: ${terms.autonomy[ceiling]}; a named person approves every change.`, tone: 'accent' as const };
  });
}

// ---------------------------------------------------------------------------
// Proposals and governance
// ---------------------------------------------------------------------------

export const PROPOSAL_ORDER: Record<ProposalStatus, number> = { pending: 0, advisory: 1, 'auto-applied': 2, approved: 3, rejected: 4, superseded: 5 };

export type QueueFilter = 'open' | 'pending' | 'advisory' | 'auto-applied' | 'decided';

export function matchesFilter(p: ProposedChange, f: QueueFilter): boolean {
  switch (f) {
    case 'open':
      return p.status === 'pending' || p.status === 'advisory' || p.status === 'auto-applied';
    case 'decided':
      return p.status === 'approved' || p.status === 'rejected' || p.status === 'superseded';
    default:
      return p.status === f;
  }
}

/** Approval check for the presenter's persona, without logging (the action logs a real attempt). */
export function approvalCheck(data: PortfolioData, p: ProposedChange, actingAs: string): Check {
  return checkApproval(data, p, actingAs);
}

export function rejectionCheck(data: PortfolioData, p: ProposedChange, actingAs: string): Check {
  return checkRejection(data, p, actingAs);
}

export function runCheck(data: PortfolioData, actingAs: string): Check {
  return requirePerson(data, actingAs, 'start an agent run');
}

/** Proposals the persona may approve now. */
export function eligibleForApproval(data: PortfolioData, proposals: ProposedChange[], actingAs: string): ProposedChange[] {
  return proposals.filter((p) => p.status === 'pending' && approvalCheck(data, p, actingAs).ok);
}

/** Splits "Owner: none" / "Owner: Jane" into one field row when both sides share a label. */
export function beforeAfterRows(beforeText: string, afterText: string): { field: string | null; before: string; after: string }[] {
  const split = (t: string) => {
    const m = /^([^:]{1,40}):\s(.*)$/.exec(t);
    return m ? { field: m[1] as string, value: m[2] as string } : null;
  };
  const b = split(beforeText);
  const a = split(afterText);
  if (b && a && b.field === a.field) return [{ field: b.field, before: b.value, after: a.value }];
  return [{ field: null, before: beforeText, after: afterText }];
}

// ---------------------------------------------------------------------------
// Personas
// ---------------------------------------------------------------------------

export interface Persona {
  id: string;
  name: string;
  detail: string;
  kind: 'person' | 'agent';
  initials: string;
}

/**
 * People the presenter can act as: the presenter, then the assignees of open
 * proposals (so the assignee rule can be shown live), then the agent identity
 * of the selected agent (so "agents never approve" can be shown live).
 */
export function personaOptions(data: PortfolioData, proposals: ProposedChange[], actingAs: string, agentId: AgentId | null): Persona[] {
  const people = new Map(data.people.map((p) => [p.id, p]));
  const out: Persona[] = [];
  const add = (id: string, detail: string) => {
    if (out.some((x) => x.id === id)) return;
    const p = people.get(id);
    if (p) out.push({ id, name: p.name, detail, kind: 'person', initials: p.initials });
  };
  add(PRESENTER_PERSON_ID, 'Sample approver');
  const assignees = new Map<string, string[]>();
  for (const p of proposals) {
    if (p.status !== 'pending' || !p.assigneeId || !people.has(p.assigneeId)) continue;
    assignees.set(p.assigneeId, [...(assignees.get(p.assigneeId) ?? []), p.target.id]);
  }
  for (const [id, targets] of [...assignees.entries()].slice(0, 3)) {
    add(id, `${people.get(id)?.title ?? 'Person'}; assignee of ${targets.length} pending item${targets.length === 1 ? '' : 's'}`);
  }
  const identity = agentId ? data.agentIdentities.find((a) => a.agentId === agentId) : undefined;
  if (identity) out.push({ id: identity.id, name: identity.handle, detail: `Agent identity for ${AGENT_CATALOGUE[identity.agentId].name}`, kind: 'agent', initials: '' });
  // Whoever the store says we are acting as is always listed.
  if (!out.some((x) => x.id === actingAs)) {
    const other = data.agentIdentities.find((a) => a.id === actingAs);
    if (other) out.push({ id: other.id, name: other.handle, detail: 'Agent identity', kind: 'agent', initials: '' });
    else add(actingAs, people.get(actingAs)?.title ?? 'Person');
  }
  return out;
}

export function isAgentIdentity(data: PortfolioData, id: string): boolean {
  return data.agentIdentities.some((a) => a.id === id);
}

// ---------------------------------------------------------------------------
// Effect of an approval (computed, not asserted)
// ---------------------------------------------------------------------------

export interface EffectSnapshot {
  portfolioFindings: number;
  findingIds: string[];
  deliverableId: string | null;
  deliverableFindings: number | null;
  reported: RagStatus | null;
  evidence: EvidenceRagStatus | null;
  work: Computable<WorkCompletion> | null;
  accepted: Computable<AcceptedOutcomes> | null;
  readiness: ReadinessState | null;
}

export function snapshot(results: EngineResult, deliverableId: string | null): EffectSnapshot {
  const m = deliverableId ? results.deliverables[deliverableId] : undefined;
  const rag = deliverableId ? results.deliverableRag[deliverableId] : undefined;
  return {
    portfolioFindings: results.findings.length,
    findingIds: results.findings.map((f) => f.id),
    deliverableId,
    deliverableFindings: deliverableId ? results.findings.filter((f) => f.deliverableId === deliverableId).length : null,
    reported: rag?.reported ?? null,
    evidence: rag?.evidence ?? null,
    work: m?.workCompletion ?? null,
    accepted: m?.acceptedOutcomes ?? null,
    readiness: m?.readiness.state ?? null,
  };
}

export const workText = (w: Computable<WorkCompletion> | null): string => (w === null ? '—' : w.computable ? `${w.value.percent}%` : terms.measures.notComputable);
export const acceptedText = (a: Computable<AcceptedOutcomes> | null): string => (a === null ? '—' : a.computable ? `${a.value.acceptedCount} of ${a.value.totalCount}` : terms.measures.notComputable);

/** Findings cleared and raised between two snapshots, by id. */
export function findingDiff(before: EffectSnapshot, after: EffectSnapshot): { cleared: string[]; raised: string[] } {
  const a = new Set(after.findingIds);
  const b = new Set(before.findingIds);
  return { cleared: before.findingIds.filter((id) => !a.has(id)), raised: after.findingIds.filter((id) => !b.has(id)) };
}

// ---------------------------------------------------------------------------
// Audit trail
// ---------------------------------------------------------------------------

export type AuditCategory = 'runs' | 'proposals' | 'decisions' | 'governance' | 'workflow' | 'other';

export const AUDIT_CATEGORY_LABEL: Record<AuditCategory, string> = {
  runs: 'Runs and steps',
  proposals: 'Proposals',
  decisions: 'Approvals and rejections',
  governance: 'Governance refusals',
  workflow: 'PDLC workflow',
  other: 'Other',
};

export function auditCategory(action: AuditAction): AuditCategory {
  if (action.startsWith('agent-run.') || action === 'finding.raised' || action === 'draft.created') return 'runs';
  if (action === 'proposal.created' || action === 'proposal.auto-applied') return 'proposals';
  if (action === 'proposal.approved' || action === 'proposal.rejected') return 'decisions';
  if (action === 'governance.blocked') return 'governance';
  if (action.startsWith('pdlc.') || action.startsWith('evidence.') || action.startsWith('criterion.')) return 'workflow';
  return 'other';
}

export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  'agent-run.started': 'Run started',
  'agent-run.completed': 'Run completed',
  'agent-run.failed': 'Run failed',
  'finding.raised': 'Findings raised',
  'proposal.created': 'Proposal created',
  'proposal.auto-applied': 'Auto-applied',
  'proposal.approved': 'Approved',
  'proposal.rejected': 'Rejected',
  'draft.created': 'Draft created',
  'pdlc.stage-agent-run': 'Stage agent run',
  'pdlc.review-approved': 'Review approved',
  'pdlc.review-returned': 'Review returned',
  'pdlc.moved-forward': 'Moved forward',
  'pdlc.moved-back': 'Moved back',
  'evidence.recorded': 'Evidence recorded',
  'evidence.simulated': 'Evidence simulated',
  'criterion.accepted': 'Criterion accepted',
  'criterion.rejected': 'Criterion rejected',
  'governance.blocked': 'Governance refusal',
  'demo.reset': 'Demo reset',
};

/** "09:04" in the demo clock's zone (UTC). */
export function clockTime(at: string): string {
  return at.length >= 16 ? at.slice(11, 16) : at;
}

/** Steps of a run, with their run, flattened for the audit trail ("every step"). */
export function auditWithSteps(audit: AuditEvent[], runs: AgentRun[]): Array<{ kind: 'event'; event: AuditEvent } | { kind: 'step'; run: AgentRun; index: number; at: string }> {
  const out: Array<{ kind: 'event'; event: AuditEvent } | { kind: 'step'; run: AgentRun; index: number; at: string }> = [];
  for (const e of audit) {
    out.push({ kind: 'event', event: e });
    if (e.action === 'agent-run.started' && e.subject.kind === 'agent-run') {
      const run = runs.find((r) => r.id === e.subject.id);
      if (run) run.steps.forEach((_, index) => out.push({ kind: 'step', run, index, at: e.at }));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// References
// ---------------------------------------------------------------------------

type StateLike = Pick<DemoState, 'data' | 'results' | 'agentRuns' | 'proposals' | 'approvals' | 'drafts' | 'audit'>;

/** The deliverable a referenced record belongs to, for the "open deliverable" link. */
export function deliverableIdForRef(state: StateLike, ref: EntityRef): string | null {
  const r = resolveRef(state, ref);
  if (!r) return null;
  const rec = r.record as Record<string, unknown>;
  const data = state.data;
  switch (ref.kind) {
    case 'deliverable':
      return ref.id;
    case 'work-item': {
      const key = (rec.epicKey as string | null) ?? null;
      const own = (rec.deliverableId as string | null) ?? null;
      if (own && data.deliverables.some((d) => d.id === own)) return own;
      const epic = key ? data.workItems.find((w) => w.key === key) : undefined;
      const viaEpic = epic?.deliverableId ?? data.deliverables.find((d) => key && d.epicKeys.includes(key))?.id ?? null;
      return viaEpic && data.deliverables.some((d) => d.id === viaEpic) ? viaEpic : null;
    }
    case 'outcome':
    case 'evidence':
    case 'raid':
    case 'milestone':
      return (rec.deliverableId as string) ?? null;
    case 'dependency':
      return (rec.toDeliverableId as string) ?? null;
    case 'criterion': {
      const oc = data.outcomes.find((o) => o.id === rec.outcomeId);
      return oc?.deliverableId ?? null;
    }
    case 'finding':
    case 'proposal':
      return (rec.deliverableId as string | null) ?? null;
    case 'status-draft':
      return (rec.deliverableId as string | null) ?? null;
    case 'pdlc-run':
      return (rec.deliverableId as string) ?? null;
    default:
      return null;
  }
}

/** Label for a run in lists: "RAID quality · the portfolio". */
export function runTitle(data: PortfolioData, run: AgentRun): string {
  return `${AGENT_CATALOGUE[run.agentId].name} · ${describeScope(data, runScopeOf(run))}`;
}
