/**
 * Shared extraction context: what every extractor reads.
 *
 * `SlideContext` is what callers pass in (the store's data, engine result,
 * drafts and clock). `SlideEnv` adds lookups built once per snapshot: the
 * portfolio index, the engine's own context, hierarchy roll-ups, forecasts,
 * knock-on and the disagreement order. Everything here comes from engine
 * helpers; nothing recomputes a measure.
 */
import {
  buildContext,
  computeHierarchyRollups,
  computePlanExtras,
  statusDisagreements,
  type EngineContext,
  type Forecast,
  type HierarchyRollups,
  type KnockOn,
} from '@/lib/engine';
import { indexPortfolio, type PortfolioIndex } from '@/lib/store/indexes';
import type { DemoClock, EngineResult, PortfolioData, PortfolioMeta, StatusDraft } from '@/lib/types';

/** What the slide layer needs from the app. Pass the store's `data`, `results`, `drafts` and `clock`. */
export interface SlideContext {
  data: PortfolioData;
  result: EngineResult;
  /** Agent drafts from the store (`DemoState.drafts`), oldest first. Optional: without them no narrative is shown. */
  drafts?: readonly StatusDraft[];
  /** The demo clock. Defaults to the engine's `computedFor`. */
  clock?: DemoClock;
}

/** What lives in the store rather than the data: latest drafts, the clock and meta. */
export interface ExtractExtras {
  clock: DemoClock;
  meta: PortfolioMeta;
  /** Latest weekly-status draft per deliverable id. */
  statusDrafts: ReadonlyMap<string, StatusDraft>;
  /** Latest portfolio executive brief, if one was generated. */
  executiveBrief: StatusDraft | null;
}

export function extrasFrom(ctx: SlideContext): ExtractExtras {
  const statusDrafts = new Map<string, StatusDraft>();
  let executiveBrief: StatusDraft | null = null;
  // Later drafts replace earlier ones: the store appends, so the last wins (as useLatestDraft does).
  for (const d of ctx.drafts ?? []) {
    if (d.kind === 'weekly-status' && d.deliverableId) statusDrafts.set(d.deliverableId, d);
    if (d.kind === 'executive-brief' && d.deliverableId === null) executiveBrief = d;
  }
  const today = ctx.result.computedFor;
  const clock = ctx.clock ?? { today, now: `${today}T00:00:00.000Z`, timeZone: 'UTC' };
  return { clock, meta: ctx.data.meta, statusDrafts, executiveBrief };
}

/** Lookups shared by every extractor for one snapshot. */
export interface SlideEnv {
  data: PortfolioData;
  result: EngineResult;
  extras: ExtractExtras;
  idx: PortfolioIndex;
  /** The engine's own lookups (stories by outcome, deliverables under a node, ...). */
  eng: EngineContext;
  rollups: HierarchyRollups;
  forecasts: ReadonlyMap<string, Forecast>;
  knockOn: readonly KnockOn[];
  /** Deliverable ids whose reported and evidence-based status disagree, worst first. */
  disagreements: readonly string[];
  /** Today, from the engine result. */
  asOf: string;
  synthetic: boolean;
}

interface Heavy {
  eng: EngineContext;
  rollups: HierarchyRollups;
  forecasts: ReadonlyMap<string, Forecast>;
  knockOn: readonly KnockOn[];
  disagreements: readonly string[];
}

// Heavy lookups depend only on (data, result); cache them per snapshot pair.
const heavyCache = new WeakMap<EngineResult, WeakMap<PortfolioData, Heavy>>();

function heavyFor(data: PortfolioData, result: EngineResult, clock: DemoClock): Heavy {
  let perResult = heavyCache.get(result);
  if (!perResult) {
    perResult = new WeakMap();
    heavyCache.set(result, perResult);
  }
  const hit = perResult.get(data);
  if (hit) return hit;
  const extras = computePlanExtras(data, clock);
  const heavy: Heavy = {
    eng: buildContext(data, clock),
    rollups: computeHierarchyRollups(data, result),
    forecasts: extras.forecasts,
    knockOn: extras.knockOn,
    disagreements: statusDisagreements(result.deliverableRag),
  };
  perResult.set(data, heavy);
  return heavy;
}

export function slideEnv(ctx: SlideContext): SlideEnv {
  const extras = extrasFrom(ctx);
  return {
    data: ctx.data,
    result: ctx.result,
    extras,
    idx: indexPortfolio(ctx.data),
    ...heavyFor(ctx.data, ctx.result, extras.clock),
    asOf: ctx.result.computedFor,
    synthetic: ctx.data.meta.sourceKind === 'synthetic',
  };
}
