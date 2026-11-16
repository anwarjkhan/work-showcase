/**
 * Measure 3, delivery readiness: three states, never a percentage.
 * Required evidence kinds come from the deliverable's risk tier in config.
 *   not-ready  any required kind is failing, or a critical dependency is still open
 *   unknown    otherwise, any required kind is missing, stale or pending
 *   ready      every required kind is held, current and passing
 * Work completion and accepted outcomes play no part.
 */
import { requiredEvidenceFor } from '@/lib/config/risk-tiers';
import { terms } from '@/lib/config/terminology';
import type { Evidence, EvidenceHeldState, EvidenceKind, HeldEvidence, ReadinessAssessment, Reason, TechDeliverable } from '@/lib/types';
import type { EngineContext } from './context';
import { dependencyLateDays, isDependencyOpen } from './dependencies';
import { currentEvidenceByKind, evidenceStaleness, recordState, worseHeldState } from './evidence';
import { date, days, evidenceKindLabel, listPhrases, lowerFirst, quote } from './messages';
import { toMs } from './util';

export function deliverableReadiness(ctx: EngineContext, d: TechDeliverable): ReadinessAssessment {
  const required = requiredEvidenceFor(d.riskTier);
  const current = currentEvidenceByKind(ctx, d.id);

  const held: HeldEvidence[] = [];
  const missing: EvidenceKind[] = [];
  const failing: EvidenceKind[] = [];
  const stale: EvidenceKind[] = [];
  const pending: EvidenceKind[] = [];
  const recordsFor: Record<string, Evidence[]> = {};

  for (const kind of required) {
    const records = current.get(kind) ?? [];
    if (records.length === 0) {
      held.push({ kind, state: 'missing', evidenceId: null, observedAt: null, workChangedAt: null });
      missing.push(kind);
      continue;
    }
    const assessed = records.map((e) => {
      const s = evidenceStaleness(ctx, e);
      return { e, state: recordState(e, s), changedAt: s.stale ? s.workChangedAt : null };
    });
    let worst: (typeof assessed)[number] | null = null;
    for (const a of assessed) {
      const worse = worst === null || worseHeldState(a.state, worst.state) !== worst.state;
      const sameButLater = worst !== null && a.state === worst.state && toMs(a.e.observedAt) > toMs(worst.e.observedAt);
      if (worse || sameButLater) worst = a;
    }
    if (!worst) continue;
    const worstState = worst.state;
    recordsFor[kind] = assessed.filter((a) => a.state === worstState).map((a) => a.e);
    held.push({ kind, state: worst.state, evidenceId: worst.e.id, observedAt: worst.e.observedAt, workChangedAt: worst.changedAt });
    if (worst.state === 'failing') failing.push(kind);
    else if (worst.state === 'stale') stale.push(kind);
    else if (worst.state === 'pending') pending.push(kind);
  }

  const blocking = (ctx.dependenciesInto.get(d.id) ?? []).filter((dep) => dep.critical && isDependencyOpen(dep));

  const reasons: Reason[] = [];
  const evRefs = (kinds: EvidenceKind[]) =>
    kinds.flatMap((k) => (recordsFor[k] ?? []).map((e) => ({ kind: 'evidence' as const, id: e.id })));
  const kindList = (kinds: EvidenceKind[]) => listPhrases(kinds.map((k) => evidenceKindLabel(k)));

  if (failing.length > 0) {
    reasons.push({
      code: 'evidence-failing',
      message: `Required evidence is failing: ${kindList(failing)}.`,
      refs: evRefs(failing),
    });
  }
  for (const dep of blocking) {
    const provider = ctx.idx.deliverables.get(dep.fromDeliverableId);
    const late = dependencyLateDays(dep, ctx.clock);
    reasons.push({
      code: 'critical-dependency-open',
      message:
        `Critical dependency ${quote(dep.title)}${provider ? ` from ${provider.ref}` : ''} is not yet delivered ` +
        `(${lowerFirst(terms.dependencyStatus[dep.status])},needed by ${date(dep.needBy)}${late > 0 ? `, ${days(late)} late` : ''}).`,
      refs: [{ kind: 'dependency', id: dep.id }],
    });
  }
  if (missing.length > 0) {
    reasons.push({
      code: 'evidence-missing',
      message: `Required evidence for ${terms.riskTiers[d.riskTier]} is missing: ${kindList(missing)}.`,
      refs: [{ kind: 'deliverable', id: d.id }],
    });
  }
  if (stale.length > 0) {
    reasons.push({
      code: 'evidence-stale',
      message: `Evidence is older than the latest change to the work it covers: ${kindList(stale)}.`,
      refs: evRefs(stale),
    });
  }
  if (pending.length > 0) {
    reasons.push({
      code: 'evidence-pending',
      message: `Evidence has no result yet: ${kindList(pending)}.`,
      refs: evRefs(pending),
    });
  }

  const state: ReadinessAssessment['state'] =
    failing.length > 0 || blocking.length > 0 ? 'not-ready' : missing.length + stale.length + pending.length > 0 ? 'unknown' : 'ready';

  if (state === 'ready') {
    reasons.push({
      code: 'all-evidence-passing',
      message: `All ${required.length} required evidence kinds are held, current and passing, and no critical dependency is open.`,
      refs: required.flatMap((k) => (current.get(k) ?? []).map((e) => ({ kind: 'evidence' as const, id: e.id }))),
    });
  }

  return {
    deliverableId: d.id,
    state,
    riskTier: d.riskTier,
    requiredEvidence: [...required],
    held,
    missing,
    failing,
    stale,
    blockingDependencyIds: blocking.map((dep) => dep.id),
    reasons,
  };
}
