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
 * Every check returns a refusal sentence for the UI instead of throwing.
 */
import { RISK_TIER_POLICIES, autonomyFor } from '@/lib/config/risk-tiers';
import { terms } from '@/lib/config/terminology';
import { indexPortfolio } from '@/lib/store/indexes';
import { resolveRef } from './refs';
import type { AutonomyCeiling, PortfolioData, ProposalStatus, ProposedChange, ProposedChangeSpec, RiskTier } from '@/lib/types';

export type Check = { ok: true } | { ok: false; reason: string; code: GovernanceCode };

export type GovernanceCode =
  | 'not-a-person'
  | 'agent-actor'
  | 'assignee-cannot-approve'
  | 'advisory-only'
  | 'not-pending'
  | 'not-named-reviewer'
  | 'not-acceptance-owner';

/** The rules as sentences, for the Agent centre and About screens. */
export const GOVERNANCE_RULES: { id: string; text: string }[] = [
  { id: 'G1', text: `Autonomy ceiling by risk tier: ${terms.riskTiers.T1} may auto-apply specifically allowed changes; ${terms.riskTiers.T2} and ${terms.riskTiers.T3} propose only; ${terms.riskTiers.T4} is advisory only, with no proposed changes.` },
  { id: 'G2', text: 'An agent can never approve a change, approve a review, accept an acceptance criterion, record evidence or set readiness.' },
  { id: 'G3', text: 'Approval needs a named person who is not the assignee of the item being changed.' },
  { id: 'G4', text: `Reported RAG in the ${terms.systems['portfolio-system'].toLowerCase()} can never be changed by an agent or an approval.` },
  { id: 'G5', text: 'Every run, proposal, approval, rejection, review decision, evidence record, acceptance and stage move is written to the audit trail.' },
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
