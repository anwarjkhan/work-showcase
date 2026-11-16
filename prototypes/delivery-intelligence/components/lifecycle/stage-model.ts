/**
 * Pure derivation of what the Lifecycle screen shows: each deliverable placed in its
 * current PDLC stage, plus per-stage figures. Everything comes from the store's data
 * and engine result; nothing is hard-coded.
 */
import { PDLC_STAGES } from '@/lib/config/pdlc';
import type { PortfolioIndex } from '@/lib/store/indexes';
import type {
  EngineResult,
  PdlcRun,
  PdlcStageId,
  PortfolioData,
  PmNode,
  ReviewState,
  TechDeliverable,
  WorkShare,
} from '@/lib/types';

export type StageReviewSummary = 'pending' | 'approved' | 'returned' | 'not-requested';

export interface CardModel {
  deliverable: TechDeliverable;
  stage: PdlcStageId;
  standalone: boolean;
  /** Programme title, or null for standalone deliverables. */
  programme: string | null;
  programmeId: string | null;
  review: StageReviewSummary;
  /** Set when the deliverable's latest move was back into this stage. */
  movedBack: { reason: string; fromStage: PdlcStageId } | null;
}

export interface StageFigures {
  deliverables: number;
  share: WorkShare;
  reviewsPending: number;
  evidenceHeld: number;
  evidenceRequired: number;
}

export interface StageView {
  stageId: PdlcStageId;
  cards: CardModel[];
  figures: StageFigures;
}

export const STANDALONE_FILTER = '__standalone__';

function summariseReviews(run: PdlcRun | undefined, stage: PdlcStageId): StageReviewSummary {
  const reviews = run?.stages[stage]?.reviews ?? [];
  if (reviews.length === 0) return 'not-requested';
  const states: ReviewState[] = reviews.map((r) => r.state);
  if (states.includes('returned')) return 'returned';
  if (states.every((s) => s === 'approved')) return 'approved';
  if (states.includes('pending')) return 'pending';
  return 'not-requested';
}

function programmeOf(node: PmNode | undefined, nodes: Map<string, PmNode>): PmNode | null {
  let current = node;
  let top: PmNode | null = node ?? null;
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    if (current.level === 'programme') return current;
    top = current;
    current = current.parentId ? nodes.get(current.parentId) : undefined;
  }
  return top;
}

export function buildLifecycleView(data: PortfolioData, index: PortfolioIndex, results: EngineResult): StageView[] {
  const byStage = new Map<PdlcStageId, CardModel[]>(PDLC_STAGES.map((s) => [s.id, []]));

  for (const d of data.deliverables) {
    const run = index.pdlcRunsByDeliverable.get(d.id);
    const stage = run?.currentStage ?? d.pdlcStage;
    const node = d.pmNodeId ? programmeOf(index.pmNodes.get(d.pmNodeId), index.pmNodes) : null;
    const last = run && run.moves.length > 0 ? run.moves[run.moves.length - 1] : null;
    const movedBack =
      last && last.direction === 'back' && last.to === stage
        ? { reason: last.reason ?? 'No reason recorded', fromStage: last.from }
        : null;
    byStage.get(stage)?.push({
      deliverable: d,
      stage,
      standalone: d.pmNodeId === null,
      programme: node?.title ?? null,
      programmeId: node?.id ?? null,
      review: summariseReviews(run, stage),
      movedBack,
    });
  }

  return PDLC_STAGES.map((def) => {
    const cards = (byStage.get(def.id) ?? []).sort((a, b) => a.deliverable.ref.localeCompare(b.deliverable.ref));
    let evidenceHeld = 0;
    let evidenceRequired = 0;
    let reviewsPending = 0;
    for (const c of cards) {
      if (c.review === 'pending') reviewsPending++;
      const readiness = results.deliverables[c.deliverable.id]?.readiness;
      if (!readiness) continue;
      evidenceRequired += readiness.requiredEvidence.length;
      evidenceHeld += readiness.held.filter((h) => h.state === 'passing' && readiness.requiredEvidence.includes(h.kind)).length;
    }
    return {
      stageId: def.id,
      cards,
      figures: {
        deliverables: cards.length,
        share: results.portfolio.stageWorkShare[def.id] ?? { human: 0, agent: 0, agentShare: 0 },
        reviewsPending,
        evidenceHeld,
        evidenceRequired,
      },
    };
  });
}
