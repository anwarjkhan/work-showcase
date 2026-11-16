/**
 * Evidence rules, applied to current records only (superseded records are history).
 *   R12  Evidence older than the latest change to the work it covers.
 *   R13  A required test result is failing.
 */
import { requiredEvidenceFor } from '@/lib/config/risk-tiers';
import { terms } from '@/lib/config/terminology';
import type { Evidence, Finding } from '@/lib/types';
import type { EngineContext } from './context';
import { currentEvidenceByKind, evidenceStaleness } from './evidence';
import { date, days, evidenceKindLabel, quote } from './messages';
import { finding, ref, type Rule } from './rule-kit';
import { dayDiff } from './util';

function currentRecords(ctx: EngineContext, deliverableId: string): Evidence[] {
  return [...currentEvidenceByKind(ctx, deliverableId).values()].flat();
}

export const ruleR12: Rule = ({ ctx }) => {
  const out: Finding[] = [];
  for (const d of ctx.data.deliverables) {
    for (const e of currentRecords(ctx, d.id)) {
      const s = evidenceStaleness(ctx, e);
      if (!s.stale || !s.workChangedAt || !s.changedItemKey) continue;
      const item = ctx.idx.workItems.get(s.changedItemKey);
      const outcome = ctx.resolveOutcome(e.outcomeId);
      const gap = dayDiff(e.observedAt, s.workChangedAt);
      out.push(
        finding(
          ctx,
          'R12',
          ref.evidence(e.id),
          d.id,
          `${evidenceKindLabel(e.kind, false)} ${quote(e.title)} was observed on ${date(e.observedAt)}, but ` +
            `${item ? item.key : s.changedItemKey} changed on ${date(s.workChangedAt)}` +
            `${gap > 0 ? ` (${days(gap)} later)` : ' (later the same day)'}, so it no longer covers the current work.`,
          [ref.item(s.changedItemKey), ...(e.workItemKey ? [ref.item(e.workItemKey)] : []), ...(outcome ? [ref.outcome(outcome.id)] : [])],
        ),
      );
    }
  }
  return out;
};

export const ruleR13: Rule = ({ ctx }) => {
  const out: Finding[] = [];
  for (const d of ctx.data.deliverables) {
    if (!requiredEvidenceFor(d.riskTier).includes('test-result')) continue;
    for (const e of currentEvidenceByKind(ctx, d.id).get('test-result') ?? []) {
      if (e.result !== 'fail') continue;
      out.push(
        finding(
          ctx,
          'R13',
          ref.evidence(e.id),
          d.id,
          `Required ${evidenceKindLabel('test-result')} ${quote(e.title)} for ${d.ref} is failing ` +
            `(${terms.systems[e.source]} ${e.sourceRef}, ${date(e.observedAt)}); ${terms.riskTiers[d.riskTier]} needs it passing before release.`,
          [ref.deliverable(d.id), ...(e.workItemKey ? [ref.item(e.workItemKey)] : [])],
        ),
      );
    }
  }
  return out;
};
