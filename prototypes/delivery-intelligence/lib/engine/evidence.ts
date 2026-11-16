/**
 * Evidence currency and staleness.
 *
 * - Current records: per deliverable and kind, the latest record for each scope
 *   (work item, else outcome, else the whole deliverable) supersedes earlier ones,
 *   so a passing rerun clears an earlier failure. A later deliverable-wide record
 *   supersedes every earlier record of its kind.
 * - Staleness: a record is stale when the work it covers changed after it was
 *   observed. A record linked to a work item covers that item and everything under
 *   it; one linked only to an outcome covers the items carrying that Outcome ID.
 *   A deliverable-wide record has no linked work and cannot go stale.
 */
import type { Evidence, EvidenceHeldState, EvidenceKind, IsoDateTime } from '@/lib/types';
import type { EngineContext } from './context';
import { compareIds, toMs } from './util';

export interface EvidenceStaleness {
  stale: boolean;
  /** Latest change to the covered work, when there is linked work. */
  workChangedAt: IsoDateTime | null;
  /** Item whose change made it stale (or the latest-changed covered item). */
  changedItemKey: string | null;
}

function scopeKey(ctx: EngineContext, e: Evidence): string {
  if (e.workItemKey) return `wi:${e.workItemKey}`;
  const outcome = ctx.resolveOutcome(e.outcomeId);
  if (outcome) return `oc:${outcome.id}`;
  return 'deliverable';
}

const currentCache = new WeakMap<EngineContext, Map<string, Map<EvidenceKind, Evidence[]>>>();
const stalenessCache = new WeakMap<EngineContext, Map<string, EvidenceStaleness>>();

/** Latest records per kind for a deliverable (see header for the supersede rule). Memoised per context. */
export function currentEvidenceByKind(ctx: EngineContext, deliverableId: string): Map<EvidenceKind, Evidence[]> {
  let perCtx = currentCache.get(ctx);
  if (!perCtx) {
    perCtx = new Map();
    currentCache.set(ctx, perCtx);
  }
  const hit = perCtx.get(deliverableId);
  if (hit) return hit;
  const result = computeCurrent(ctx, deliverableId);
  perCtx.set(deliverableId, result);
  return result;
}

function computeCurrent(ctx: EngineContext, deliverableId: string): Map<EvidenceKind, Evidence[]> {
  const records = [...(ctx.evidenceByDeliverable.get(deliverableId) ?? [])].sort(
    (a, b) => toMs(a.observedAt) - toMs(b.observedAt) || compareIds(a.id, b.id),
  );
  const byKind = new Map<EvidenceKind, Map<string, Evidence>>();
  for (const e of records) {
    let scopes = byKind.get(e.kind);
    if (!scopes) {
      scopes = new Map();
      byKind.set(e.kind, scopes);
    }
    const key = scopeKey(ctx, e);
    if (key === 'deliverable') scopes.clear();
    scopes.set(key, e);
  }
  const out = new Map<EvidenceKind, Evidence[]>();
  for (const [kind, scopes] of byKind) out.set(kind, [...scopes.values()]);
  return out;
}

/** Staleness of one record against the work it covers. Memoised per context and record id. */
export function evidenceStaleness(ctx: EngineContext, e: Evidence): EvidenceStaleness {
  let perCtx = stalenessCache.get(ctx);
  if (!perCtx) {
    perCtx = new Map();
    stalenessCache.set(ctx, perCtx);
  }
  const hit = perCtx.get(e.id);
  if (hit) return hit;
  const result = computeStaleness(ctx, e);
  perCtx.set(e.id, result);
  return result;
}

function computeStaleness(ctx: EngineContext, e: Evidence): EvidenceStaleness {
  let latest: { ms: number; key: string } | null = null;
  if (e.workItemKey) {
    latest = ctx.latestChangeUnder(e.workItemKey);
  } else {
    const outcome = ctx.resolveOutcome(e.outcomeId);
    if (outcome) {
      for (const item of ctx.storiesByOutcome.get(outcome.id) ?? []) {
        const c = ctx.latestChangeUnder(item.key);
        if (c && (!latest || c.ms > latest.ms)) latest = c;
      }
    }
  }
  if (!latest) return { stale: false, workChangedAt: null, changedItemKey: null };
  return {
    stale: latest.ms > toMs(e.observedAt),
    workChangedAt: new Date(latest.ms).toISOString(),
    changedItemKey: latest.key,
  };
}

const HELD_RANK: Record<Exclude<EvidenceHeldState, 'missing'>, number> = { failing: 3, stale: 2, pending: 1, passing: 0 };

/** State of one record: failing beats stale (a stale failure is still a failure). */
export function recordState(e: Evidence, staleness: EvidenceStaleness): Exclude<EvidenceHeldState, 'missing'> {
  if (e.result === 'fail') return 'failing';
  if (staleness.stale) return 'stale';
  if (e.result === 'pending') return 'pending';
  return 'passing';
}

export function worseHeldState(
  a: Exclude<EvidenceHeldState, 'missing'>,
  b: Exclude<EvidenceHeldState, 'missing'>,
): Exclude<EvidenceHeldState, 'missing'> {
  return HELD_RANK[a] >= HELD_RANK[b] ? a : b;
}
