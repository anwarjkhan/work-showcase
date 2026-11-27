/**
 * Governance rules, enforced in code (design section 5):
 *   G1  Autonomy ceiling by risk tier (lib/config/risk-tiers.ts): T1 may auto-apply
 *       the specifically allowed field changes; T2 and T3 propose only; T4 is
 *       advisory only and raises no approvable proposals.
 *   G2  An agent can never approve, accept a criterion, approve a review, record
 *       evidence or set readiness: every such action needs a named person.
 *   G3  Approval needs a named person who is not the assignee of the item changed.
 *   G4  Reported RAG in the portfolio system can never be changed (see patches.ts).
 *   G5  Every run, proposal, approval, rejection, review decision, evidence record,
 *       acceptance and stage move appends an audit event (lib/store/actions.ts).
 *   G6  Core Four: a PDLC review is decided only by the person holding that core
 *       role on the deliverable; a stage's reviews are decided in order, the
 *       Product Manager's gate decision last; a person holding two core roles on
 *       the same deliverable may not decide its reviews (checkReviewDecision).
 * Every check returns a refusal sentence for the UI instead of throwing.
 */
import { GATE_ROLE, reviewConfirmation, stageDefinition } from '@/lib/config/pdlc';
import { RISK_TIER_POLICIES, autonomyFor } from '@/lib/config/risk-tiers';
import { terms } from '@/lib/config/terminology';
import { coreRoleHolder, rolesHeldBy } from '@/lib/engine/core-team';
import { indexPortfolio } from '@/lib/store/indexes';
import { resolveRef } from './refs';
import type { AutonomyCeiling, CoreRole, PdlcStageId, PortfolioData, ProposalStatus, ProposedChange, ProposedChangeSpec, RiskTier } from '@/lib/types';

export type Check = { ok: true } | { ok: false; reason: string; code: GovernanceCode };

export type GovernanceCode =
  | 'not-a-person'
  | 'agent-actor'
  | 'assignee-cannot-approve'
  | 'advisory-only'
  | 'not-pending'
  | 'not-role-holder'
  | 'role-unfilled'
  | 'two-core-roles'
  | 'review-out-of-order'
  | 'not-acceptance-owner';

/** The rules as sentences, for the Agent centre and About screens. */
export const GOVERNANCE_RULES: { id: string; text: string }[] = [
  { id: 'G1', text: `Autonomy ceiling by risk tier: ${terms.riskTiers.T1} may auto-apply specifically allowed changes; ${terms.riskTiers.T2} and ${terms.riskTiers.T3} propose only; ${terms.riskTiers.T4} is advisory only, with no proposed changes.` },
  { id: 'G2', text: 'An agent can never approve a change, approve a review, accept an acceptance criterion, record evidence or set readiness.' },
  { id: 'G3', text: 'Approval needs a named person who is not the assignee of the item being changed.' },
  { id: 'G4', text: `Reported RAG in the ${terms.systems['portfolio-system'].toLowerCase()} can never be changed by an agent or an approval.` },
  { id: 'G5', text: 'Every run, proposal, approval, rejection, review decision, evidence record, acceptance and stage move is written to the audit trail.' },
  {
    id: 'G6',
    text: `Every pod has its ${terms.coreTeam.name}: ${terms.coreRoles['product-manager']}, ${terms.coreRoles['tech-lead']}, ${terms.coreRoles['risk-lead']} and ${terms.coreRoles['ux-lead']}. Only the person holding a role decides that role's reviews, in order; the ${terms.coreRoles['product-manager']} takes the gate decision last at every stage; one person may not hold two core roles on a deliverable.`,
  },
];

export function ceilingFor(tier: RiskTier): AutonomyCeiling {
  return autonomyFor(tier);
}

/** True when the T1 policy lists this exact change as auto-applicable. */
export function isAutoApplicable(spec: Pick<ProposedChangeSpec, 'patch' | 'riskTier'>): boolean {
  const policy = RISK_TIER_POLICIES[spec.riskTier];
  if (policy.autonomy !== 'auto-apply' || spec.patch.op !== 'set-field') return false;
  const { entity, field } = spec.patch;
  return policy.autoApplyAllowed.some((a) => a.entity === entity && a.field === field);
}

/** Status a new proposal gets under the autonomy ceiling of its risk tier. */
export function initialStatus(spec: Pick<ProposedChangeSpec, 'patch' | 'riskTier'>): Extract<ProposalStatus, 'pending' | 'auto-applied' | 'advisory'> {
  const ceiling = ceilingFor(spec.riskTier);
  if (ceiling === 'advisory-only') return 'advisory';
  if (isAutoApplicable(spec)) return 'auto-applied';
  return 'pending';
}

export function isAgentId(data: PortfolioData, id: string): boolean {
  const idx = indexPortfolio(data);
  return idx.agentIdentities.has(id) || data.agentIdentities.some((a) => a.agentId === id || a.handle === id);
}

/** G2: the actor must be a named person, never an agent. `what` completes "Only a named person can …". */
export function requirePerson(data: PortfolioData, personId: string | null | undefined, what: string): Check {
  if (personId && isAgentId(data, personId)) {
    return { ok: false, code: 'agent-actor', reason: `Agents cannot ${what}; only a named person can.` };
  }
  if (!personId || !indexPortfolio(data).people.has(personId)) {
    return { ok: false, code: 'not-a-person', reason: `Only a named person can ${what}.` };
  }
  return { ok: true };
}

/** G1 to G3 for approving a proposal. */
export function checkApproval(data: PortfolioData, proposal: ProposedChange, approverId: string): Check {
  if (proposal.status === 'advisory') {
    return { ok: false, code: 'advisory-only', reason: `${terms.riskTiers[proposal.riskTier]} items are advisory only; there is nothing to approve.` };
  }
  if (proposal.status !== 'pending') {
    return { ok: false, code: 'not-pending', reason: `This proposal is already ${proposal.status.replace('-', ' ')}.` };
  }
  const person = requirePerson(data, approverId, 'approve a change');
  if (!person.ok) return person;
  if (proposal.assigneeId && proposal.assigneeId === approverId) {
    const name = indexPortfolio(data).people.get(approverId)?.name ?? 'This person';
    return { ok: false, code: 'assignee-cannot-approve', reason: `${name} is the assignee of ${resolveRef(data, proposal.target)?.label ?? 'the item'} and cannot approve a change to their own item.` };
  }
  return { ok: true };
}

/** Rejecting needs a named person (an assignee may reject a change to their own item). */
export function checkRejection(data: PortfolioData, proposal: ProposedChange, approverId: string): Check {
  if (proposal.status === 'advisory') {
    return { ok: false, code: 'advisory-only', reason: `${terms.riskTiers[proposal.riskTier]} items are advisory only; there is nothing to reject.` };
  }
  if (proposal.status !== 'pending') {
    return { ok: false, code: 'not-pending', reason: `This proposal is already ${proposal.status.replace('-', ' ')}.` };
  }
  return requirePerson(data, approverId, 'reject a change');
}

// ---------------------------------------------------------------------------
// G6: PDLC review decisions by the Core Four
// ---------------------------------------------------------------------------

/** "the In-Business Risk Lead (Jordan Ellis)", or "(not named)" for an empty seat. */
export function roleWithHolder(data: PortfolioData, deliverableId: string, roleId: CoreRole): string {
  const d = indexPortfolio(data).deliverables.get(deliverableId);
  const holder = d ? coreRoleHolder(d, roleId) : null;
  const name = holder ? (indexPortfolio(data).people.get(holder)?.name ?? holder) : 'not named';
  return `the ${terms.coreRoles[roleId]} (${name})`;
}

/** Verb for deciding a review: the Product Manager approves the gate; the others confirm. */
export function reviewVerb(roleId: CoreRole, decision: 'approve' | 'return' = 'approve'): string {
  if (decision === 'return') return 'return';
  return roleId === GATE_ROLE ? 'approve the gate' : 'confirm';
}

/**
 * "Waiting on the In-Business Risk Lead (Jordan Ellis) to name the obligations that apply."
 * for the reviews of `stageId` before `roleId` that are not yet approved, or null when none is.
 */
export function waitingOnSentence(data: PortfolioData, deliverableId: string, stageId: PdlcStageId, roleId: CoreRole): string | null {
  const run = data.pdlcRuns.find((r) => r.deliverableId === deliverableId);
  if (!run) return null;
  const order = stageDefinition(stageId).reviews;
  const earlier = order.slice(0, Math.max(0, order.indexOf(roleId))).filter((r) => run.stages[stageId]?.reviews.find((x) => x.roleId === r)?.state !== 'approved');
  if (earlier.length === 0) return null;
  const parts = earlier.map((r) => `${roleWithHolder(data, deliverableId, r)} to ${reviewConfirmation(stageId, r).confirms}`);
  const joined = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return `Waiting on ${joined}.`;
}

/** Refusal for a review whose core role has no named person. */
export function roleUnfilledReason(deliverableRef: string, roleId: CoreRole): string {
  return `${deliverableRef} has no ${terms.coreRoles[roleId]} named, so this review cannot be decided until one joins the ${terms.coreTeam.name}.`;
}

/**
 * G2 and G6 for deciding one PDLC review: a named person (never an agent), holding
 * that core role on the deliverable, not holding a second core role there, with the
 * stage's earlier reviews approved. Stage and state checks stay with the store action.
 */
export function checkReviewDecision(data: PortfolioData, deliverableId: string, stageId: PdlcStageId, roleId: CoreRole, personId: string | null | undefined, decision: 'approve' | 'return' = 'approve'): Check {
  const verb = decision === 'approve' ? (roleId === GATE_ROLE ? 'approve a stage gate' : 'confirm a PDLC review') : 'return a PDLC review';
  const who = requirePerson(data, personId, verb);
  if (!who.ok) return who;
  const idx = indexPortfolio(data);
  const d = idx.deliverables.get(deliverableId);
  if (!d) return { ok: false, code: 'not-role-holder', reason: 'That deliverable does not exist.' };
  const role = terms.coreRoles[roleId];
  const name = (id: string) => idx.people.get(id)?.name ?? id;
  const holder = coreRoleHolder(d, roleId);
  if (!holder) return { ok: false, code: 'role-unfilled', reason: roleUnfilledReason(d.ref, roleId) };
  if (holder !== personId) {
    return { ok: false, code: 'not-role-holder', reason: `Only the ${role} of ${d.ref}, ${name(holder)}, can ${reviewVerb(roleId, decision)} this review; ${name(personId as string)} cannot.` };
  }
  const held = rolesHeldBy(d, personId);
  if (held.length > 1) {
    const roles = held.map((r) => terms.coreRoles[r]);
    return {
      ok: false,
      code: 'two-core-roles',
      reason: `${name(personId)} holds both the ${roles.slice(0, -1).join(', ')} and ${roles[roles.length - 1]} roles on ${d.ref}; one person may not hold two core roles, so they cannot decide its reviews until one seat is given to someone else.`,
    };
  }
  const waiting = waitingOnSentence(data, deliverableId, stageId, roleId);
  if (waiting) return { ok: false, code: 'review-out-of-order', reason: waiting };
  return { ok: true };
}
