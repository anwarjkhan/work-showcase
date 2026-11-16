import type { AutonomyCeiling, EvidenceKind, RiskTier, SetFieldPatch } from '@/lib/types';

export interface RiskTierPolicy {
  tier: RiskTier;
  /** Evidence kinds that must be held and passing for `ready`. */
  requiredEvidence: EvidenceKind[];
  /** What agents may do for items at this tier. */
  autonomy: AutonomyCeiling;
  /**
   * For `auto-apply` only: the field changes that may be applied without a human.
   * Everything else is proposed. Empty for other tiers.
   */
  autoApplyAllowed: Array<Pick<SetFieldPatch, 'entity' | 'field'>>;
  description: string;
}

/**
 * Required evidence and autonomy ceiling per work-item risk tier. Illustrative,
 * set for the prototype; not the firm's official policy.
 */
export const RISK_TIER_POLICIES: Record<RiskTier, RiskTierPolicy> = {
  T1: {
    tier: 'T1',
    requiredEvidence: ['requirements-sign-off', 'test-result', 'business-acceptance', 'release-checklist'],
    autonomy: 'auto-apply',
    autoApplyAllowed: [
      { entity: 'work-item', field: 'outcomeId' },
      { entity: 'raid', field: 'mitigationDue' },
    ],
    description: 'Low risk. Agents may auto-apply specifically allowed housekeeping changes.',
  },
  T2: {
    tier: 'T2',
    requiredEvidence: ['requirements-sign-off', 'design-review', 'test-result', 'business-acceptance', 'release-checklist'],
    autonomy: 'propose-only',
    autoApplyAllowed: [],
    description: 'Moderate risk. Agents propose; a named human approves.',
  },
  T3: {
    tier: 'T3',
    requiredEvidence: [
      'requirements-sign-off',
      'design-review',
      'control-assessment',
      'test-result',
      'business-acceptance',
      'release-checklist',
    ],
    autonomy: 'propose-only',
    autoApplyAllowed: [],
    description: 'High risk. Full evidence set; agents propose; a named human approves.',
  },
  T4: {
    tier: 'T4',
    requiredEvidence: [
      'requirements-sign-off',
      'design-review',
      'control-assessment',
      'test-result',
      'business-acceptance',
      'release-checklist',
    ],
    autonomy: 'advisory-only',
    autoApplyAllowed: [],
    description: 'Critical or regulated. Agents are advisory only and raise no proposed changes.',
  },
};

export const RISK_TIERS: RiskTier[] = ['T1', 'T2', 'T3', 'T4'];

export function requiredEvidenceFor(tier: RiskTier): EvidenceKind[] {
  return RISK_TIER_POLICIES[tier].requiredEvidence;
}

export function autonomyFor(tier: RiskTier): AutonomyCeiling {
  return RISK_TIER_POLICIES[tier].autonomy;
}
