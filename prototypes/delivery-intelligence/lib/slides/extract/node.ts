/**
 * Facts for a PM node (initiative, programme or project): its path, children,
 * the roll-up from `computeHierarchyRollups`, every deliverable beneath it
 * with its measures and status pair, RAID, dependencies, milestones,
 * knock-on, findings and disagreements across those deliverables.
 */
import { stageDefinition } from '@/lib/config/pdlc';
import { dependencyLateDays, isDependencyTroubled, type Forecast, type HierarchyRollup, type KnockOn } from '@/lib/engine';
import type { DeliverableMeasures, Dependency, EvidenceRag, Finding, InvestmentRequest, Milestone, PmNode, RaidItem, TechDeliverable } from '@/lib/types';
import type { MeasureView, ReadinessView } from '../types';
import type { SlideEnv } from './common';
import { acceptedView, readinessRollupView, readinessView, workView } from './format';
import { nodeChain } from './scope';

export interface NodeDeliverableLine {
  deliverable: TechDeliverable;
  /** The PM node directly above it. */
  parent: PmNode | undefined;
  measures: DeliverableMeasures | undefined;
  rag: EvidenceRag | undefined;
  views: { work: MeasureView; accepted: MeasureView; readiness: ReadinessView | null };
  stageName: string;
  forecast: Forecast | undefined;
}

export interface ChildNodeLine {
  node: PmNode;
  rollup: HierarchyRollup | undefined;
  views: { work: MeasureView; accepted: MeasureView; readiness: ReadinessView };
}

export interface NodeFacts {
  node: PmNode;
  request: InvestmentRequest | undefined;
  chain: PmNode[];
  children: ChildNodeLine[];
  rollup: HierarchyRollup;
  views: { work: MeasureView; accepted: MeasureView; readiness: ReadinessView };
  deliverables: NodeDeliverableLine[];
  /** Deliverables beneath it whose status pair disagrees, worst first. */
  disagreeing: NodeDeliverableLine[];
  raid: RaidItem[];
  /** Open late or blocked dependencies into or out of its deliverables. */
  troubledDependencies: { dependency: Dependency; lateDays: number }[];
  milestones: Milestone[];
  knockOn: KnockOn[];
  findings: Finding[];
  outcomeCount: number;
  epicCount: number;
}

export function deliverableLine(env: SlideEnv, d: TechDeliverable): NodeDeliverableLine {
  const measures = env.result.deliverables[d.id];
  return {
    deliverable: d,
    parent: d.pmNodeId ? env.idx.pmNodes.get(d.pmNodeId) : undefined,
    measures,
    rag: env.result.deliverableRag[d.id],
    views: { work: workView(measures?.workCompletion), accepted: acceptedView(measures?.acceptedOutcomes), readiness: measures ? readinessView(measures.readiness) : null },
    stageName: stageDefinition(env.idx.pdlcRunsByDeliverable.get(d.id)?.currentStage ?? d.pdlcStage).name,
    forecast: env.forecasts.get(d.id),
  };
}

export function nodeFacts(env: SlideEnv, nodeId: string): NodeFacts {
  const { idx, eng, result, data } = env;
  const node = idx.pmNodes.get(nodeId);
  const rollup = env.rollups.pmNodes[nodeId];
  if (!node || !rollup) throw new Error('No programme, project or initiative matches this slide scope.');
  const ids = new Set(rollup.deliverableIds);
  const lines = rollup.deliverableIds
    .map((id) => idx.deliverables.get(id))
    .filter((d): d is TechDeliverable => d !== undefined)
    .map((d) => deliverableLine(env, d));
  const byId = new Map(lines.map((l) => [l.deliverable.id, l]));
  const clock = env.extras.clock;
  return {
    node,
    request: idx.investmentRequests.get(node.investmentRequestId),
    chain: nodeChain(env, node.id),
    children: (eng.pmChildren.get(node.id) ?? []).map((child) => {
      const r = env.rollups.pmNodes[child.id];
      return {
        node: child,
        rollup: r,
        views: {
          work: workView(r?.workCompletion),
          accepted: acceptedView(r?.acceptedOutcomes),
          readiness: readinessRollupView(r?.readiness ?? { ready: 0, 'not-ready': 0, unknown: 0 }),
        },
      };
    }),
    rollup,
    views: { work: workView(rollup.workCompletion), accepted: acceptedView(rollup.acceptedOutcomes), readiness: readinessRollupView(rollup.readiness) },
    deliverables: lines,
    disagreeing: env.disagreements.filter((id) => ids.has(id)).map((id) => byId.get(id)).filter((l): l is NodeDeliverableLine => l !== undefined),
    raid: data.raid.filter((r) => ids.has(r.deliverableId)),
    troubledDependencies: data.dependencies
      .filter((dep) => (ids.has(dep.toDeliverableId) || ids.has(dep.fromDeliverableId)) && isDependencyTroubled(dep, clock))
      .map((dep) => ({ dependency: dep, lateDays: dependencyLateDays(dep, clock) })),
    milestones: data.milestones.filter((m) => ids.has(m.deliverableId)).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
    knockOn: env.knockOn.filter((k) => ids.has(k.receiverId)),
    findings: result.findings.filter((f) => f.deliverableId !== null && ids.has(f.deliverableId)),
    outcomeCount: data.outcomes.filter((o) => ids.has(o.deliverableId)).length,
    epicCount: rollup.deliverableIds.reduce((n, id) => n + (eng.epicsByDeliverable.get(id)?.length ?? 0), 0),
  };
}
