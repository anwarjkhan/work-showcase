/**
 * Roll-ups of the three measures and evidence-based RAG up the hierarchy
 * (project, programme, initiative, investment request) and for the portfolio.
 * Each measure is summed from its own deliverable figures; none is derived
 * from another. Accepted outcomes sum raw outcome weights across deliverables.
 */
import { PDLC_STAGE_IDS } from '@/lib/config/pdlc';
import type {
  AcceptedOutcomes,
  Computable,
  DeliverableMeasures,
  EngineResult,
  EvidenceRag,
  EvidenceRagStatus,
  PdlcStageId,
  PmNodeLevel,
  PortfolioData,
  RagCounts,
  ReadinessState,
  WorkCompletion,
} from '@/lib/types';
import { buildContext, type EngineContext } from './context';
import { rollupRag } from './rag';
import { computable, notComputable, toPercent } from './util';
import { sumWorkCompletion } from './work';

export function sumAcceptedOutcomes(parts: Computable<AcceptedOutcomes>[], emptyDetail: string): Computable<AcceptedOutcomes> {
  let acceptedCount = 0;
  let totalCount = 0;
  let acceptedWeight = 0;
  let totalWeight = 0;
  const outcomes: AcceptedOutcomes['outcomes'] = [];
  for (const p of parts) {
    if (!p.computable) continue;
    acceptedCount += p.value.acceptedCount;
    totalCount += p.value.totalCount;
    acceptedWeight += p.value.acceptedWeight;
    totalWeight += p.value.totalWeight;
    outcomes.push(...p.value.outcomes);
  }
  if (totalWeight === 0) return notComputable(totalCount === 0 ? 'no-outcomes' : 'zero-weight', emptyDetail);
  const ratio = acceptedWeight / totalWeight;
  return computable({ acceptedCount, totalCount, acceptedWeight, totalWeight, ratio, percent: toPercent(ratio), outcomes });
}

export function readinessCounts(measures: DeliverableMeasures[]): Record<ReadinessState, number> {
  const out: Record<ReadinessState, number> = { ready: 0, 'not-ready': 0, unknown: 0 };
  for (const m of measures) out[m.readiness.state]++;
  return out;
}

export function ragCounts(statuses: EvidenceRagStatus[]): RagCounts {
  const out: RagCounts = { red: 0, amber: 0, green: 0, unknown: 0 };
  for (const s of statuses) out[s]++;
  return out;
}

export interface MeasureRollup {
  deliverableIds: string[];
  workCompletion: Computable<WorkCompletion>;
  acceptedOutcomes: Computable<AcceptedOutcomes>;
  readiness: Record<ReadinessState, number>;
  evidenceRag: RagCounts;
}

export function rollupMeasures(result: Pick<EngineResult, 'deliverables' | 'deliverableRag'>, deliverableIds: string[]): MeasureRollup {
  const measures = deliverableIds.map((id) => result.deliverables[id]).filter((m): m is DeliverableMeasures => m !== undefined);
  return {
    deliverableIds,
    workCompletion: sumWorkCompletion(
      measures.map((m) => m.workCompletion),
      'No estimated story-level work is linked to these deliverables.',
    ),
    acceptedOutcomes: sumAcceptedOutcomes(
      measures.map((m) => m.acceptedOutcomes),
      'No weighted outcomes are recorded for these deliverables.',
    ),
    readiness: readinessCounts(measures),
    evidenceRag: ragCounts(deliverableIds.map((id) => result.deliverableRag[id]?.evidence ?? 'unknown')),
  };
}

export interface HierarchyRollup extends MeasureRollup {
  level: PmNodeLevel | 'investment-request';
  /** Evidence-based RAG beside the reported RAG (investment requests have no reported RAG: the worst reported RAG of their deliverables is used). */
  rag: EvidenceRag;
}

export interface HierarchyRollups {
  pmNodes: Record<string, HierarchyRollup>;
  investmentRequests: Record<string, HierarchyRollup>;
}

export function pmNodeRags(ctx: EngineContext, deliverableRag: Record<string, EvidenceRag>): Record<string, EvidenceRag> {
  const out: Record<string, EvidenceRag> = {};
  for (const n of ctx.data.pmNodes) {
    out[n.id] = rollupRag({ kind: 'pm-node', id: n.id }, n.reportedRag, ctx.deliverablesUnderPmNode.get(n.id) ?? [], deliverableRag, ctx.idx.deliverables);
  }
  return out;
}

const REPORTED_ORDER = ['red', 'amber', 'green'] as const;

/** Roll-ups for every PM node and investment request. Pure; screens can memoise it on (data, result). */
export function computeHierarchyRollups(data: PortfolioData, result: EngineResult): HierarchyRollups {
  // Only the hierarchy lookups are used here; the clock is the one the result was computed for.
  const ctx = buildContext(data, { today: result.computedFor, now: `${result.computedFor}T00:00:00.000Z`, timeZone: 'UTC' });
  const pmNodes: Record<string, HierarchyRollup> = {};
  for (const n of data.pmNodes) {
    const ids = ctx.deliverablesUnderPmNode.get(n.id) ?? [];
    pmNodes[n.id] = {
      ...rollupMeasures(result, ids),
      level: n.level,
      rag: result.pmNodeRag[n.id] ?? rollupRag({ kind: 'pm-node', id: n.id }, n.reportedRag, ids, result.deliverableRag, ctx.idx.deliverables),
    };
  }
  const investmentRequests: Record<string, HierarchyRollup> = {};
  for (const ir of data.investmentRequests) {
    const ids = ctx.deliverablesByRequest.get(ir.id) ?? [];
    const reported = REPORTED_ORDER.find((r) => ids.some((id) => ctx.idx.deliverables.get(id)?.reportedRag === r)) ?? 'green';
    investmentRequests[ir.id] = {
      ...rollupMeasures(result, ids),
      level: 'investment-request',
      rag: rollupRag({ kind: 'investment-request', id: ir.id }, reported, ids, result.deliverableRag, ctx.idx.deliverables),
    };
  }
  return { pmNodes, investmentRequests };
}

export function perStage<T>(make: (id: PdlcStageId) => T): Record<PdlcStageId, T> {
  return Object.fromEntries(PDLC_STAGE_IDS.map((id) => [id, make(id)])) as Record<PdlcStageId, T>;
}
