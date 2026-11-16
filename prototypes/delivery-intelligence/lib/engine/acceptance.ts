/**
 * Measure 2, accepted outcomes. An outcome is accepted only when every
 * mandatory acceptance criterion is accepted by a named human AND a passing
 * business-acceptance evidence record exists for it. Work completion and
 * readiness play no part. The deliverable figure is accepted weight / total weight.
 */
import { terms } from '@/lib/config/terminology';
import type { AcceptedOutcomes, Computable, Outcome, OutcomeAcceptance, Reason } from '@/lib/types';
import type { EngineContext } from './context';
import { evidenceKindLabel, lowerFirst, plural, quote } from './messages';
import { computable, notComputable, toPercent } from './util';

/** True when `personId` names a known human (agents are never people). */
export function isNamedHuman(ctx: EngineContext, personId: string | null): personId is string {
  return personId !== null && ctx.idx.people.has(personId) && !ctx.idx.agentIdentities.has(personId);
}

export function outcomeAcceptance(ctx: EngineContext, outcome: Outcome): OutcomeAcceptance {
  const criteria = ctx.idx.criteriaByOutcome.get(outcome.id) ?? [];
  const mandatory = criteria.filter((c) => c.mandatory);
  const acceptedByHuman = mandatory.filter((c) => c.state === 'accepted' && isNamedHuman(ctx, c.acceptedById));
  const businessEvidence = (ctx.evidenceByDeliverable.get(outcome.deliverableId) ?? []).filter(
    (e) => e.kind === 'business-acceptance' && e.result === 'pass' && ctx.resolveOutcome(e.outcomeId)?.id === outcome.id,
  );

  const reasons: Reason[] = [];
  const outcomeRef = { kind: 'outcome', id: outcome.id } as const;
  if (mandatory.length === 0) {
    reasons.push({
      code: 'no-mandatory-criteria',
      message: `${terms.hierarchy.outcome} ${quote(outcome.title)} has no mandatory acceptance criteria, so acceptance cannot be shown.`,
      refs: [outcomeRef],
    });
  } else if (acceptedByHuman.length < mandatory.length) {
    const outstanding = mandatory.filter((c) => !acceptedByHuman.includes(c));
    const unnamed = outstanding.filter((c) => c.state === 'accepted');
    reasons.push({
      code: 'criteria-not-accepted',
      message:
        (mandatory.length === 1
          ? 'The mandatory criterion is not accepted by a named person'
          : `${acceptedByHuman.length} of ${mandatory.length} mandatory criteria are accepted by a named person`) +
        (unnamed.length > 0 ? `; ${unnamed.length} marked accepted without a named person` : '') +
        '.',
      refs: outstanding.map((c) => ({ kind: 'criterion', id: c.id })),
    });
  }
  if (businessEvidence.length === 0) {
    reasons.push({
      code: 'no-business-acceptance',
      message: `No passing ${evidenceKindLabel('business-acceptance')} record is held for ${quote(outcome.title)}.`,
      refs: [outcomeRef],
    });
  }

  return {
    outcomeId: outcome.id,
    accepted: reasons.length === 0,
    mandatoryCount: mandatory.length,
    mandatoryAccepted: acceptedByHuman.length,
    businessAcceptanceEvidenceIds: businessEvidence.map((e) => e.id),
    reasons,
  };
}

/** Accepted weight / total weight over a set of outcomes. */
export function acceptedOutcomesOf(
  outcomes: readonly Outcome[],
  acceptance: ReadonlyMap<string, OutcomeAcceptance>,
): Computable<AcceptedOutcomes> {
  if (outcomes.length === 0) return notComputable('no-outcomes', `No ${lowerFirst(terms.hierarchy.outcome)}s are recorded.`);
  let acceptedCount = 0;
  let acceptedWeight = 0;
  let totalWeight = 0;
  const list: OutcomeAcceptance[] = [];
  for (const o of outcomes) {
    const a = acceptance.get(o.id);
    if (!a) continue;
    list.push(a);
    const weight = Number.isFinite(o.weight) ? Math.max(0, o.weight) : 0;
    totalWeight += weight;
    if (a.accepted) {
      acceptedCount++;
      acceptedWeight += weight;
    }
  }
  if (totalWeight === 0) {
    return notComputable('zero-weight', `All ${plural(outcomes.length, 'outcome')} have zero weight.`);
  }
  const ratio = acceptedWeight / totalWeight;
  return computable({ acceptedCount, totalCount: list.length, acceptedWeight, totalWeight, ratio, percent: toPercent(ratio), outcomes: list });
}
