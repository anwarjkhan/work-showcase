/**
 * Portfolio summary for the home screen: headline counts, reported against
 * evidence-based RAG, status disagreements, health by programme, PDLC stage
 * distribution and human/agent work share, readiness counts, portfolio-wide
 * figures for the three measures, findings by severity and data freshness.
 */
import type {
  DeliverableMeasures,
  EvidenceRag,
  Finding,
  PdlcStageId,
  PortfolioSummary,
  ProgrammeHealth,
  RagStatus,
  Severity,
  WorkShare,
} from '@/lib/types';
import type { EngineContext } from './context';
import { isEpic } from './context';
import { statusDisagreements } from './rag';
import { perStage, ragCounts, readinessCounts, sumAcceptedOutcomes } from './rollups';
import { sumWorkCompletion } from './work';

export function stageOf(ctx: EngineContext, deliverableId: string): PdlcStageId | null {
  return ctx.idx.pdlcRunsByDeliverable.get(deliverableId)?.currentStage ?? ctx.idx.deliverables.get(deliverableId)?.pdlcStage ?? null;
}

export function buildPortfolioSummary(
  ctx: EngineContext,
  deliverables: Record<string, DeliverableMeasures>,
  deliverableRag: Record<string, EvidenceRag>,
  pmNodeRag: Record<string, EvidenceRag>,
  findings: Finding[],
): PortfolioSummary {
  const { data } = ctx;
  const measures = data.deliverables.map((d) => deliverables[d.id]).filter((m): m is DeliverableMeasures => m !== undefined);

  const reportedRag = { red: 0, amber: 0, green: 0, unknown: 0 };
  for (const d of data.deliverables) reportedRag[d.reportedRag satisfies RagStatus]++;

  const stageDistribution = perStage(() => 0);
  const stageWorkShare = perStage<WorkShare>(() => ({ human: 0, agent: 0, agentShare: 0 }));
  for (const d of data.deliverables) {
    const stage = stageOf(ctx, d.id);
    if (!stage) continue;
    stageDistribution[stage]++;
    const share = stageWorkShare[stage];
    for (const item of ctx.belowEpicByDeliverable.get(d.id) ?? []) {
      if (item.assigneeType === 'agent') share.agent++;
      else share.human++;
    }
  }
  for (const share of Object.values(stageWorkShare)) {
    const total = share.human + share.agent;
    share.agentShare = total === 0 ? 0 : share.agent / total;
  }

  const programmeHealth: ProgrammeHealth[] = data.pmNodes
    .filter((n) => n.level === 'programme')
    .map((n) => {
      const ids = ctx.deliverablesUnderPmNode.get(n.id) ?? [];
      return {
        pmNodeId: n.id,
        deliverableIds: ids,
        reported: n.reportedRag,
        evidence: pmNodeRag[n.id]?.evidence ?? 'unknown',
        deliverableRag: ragCounts(ids.map((id) => deliverableRag[id]?.evidence ?? 'unknown')),
      };
    });

  const findingsBySeverity: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) findingsBySeverity[f.severity]++;

  return {
    counts: {
      investmentRequests: data.investmentRequests.length,
      initiatives: data.pmNodes.filter((n) => n.level === 'initiative').length,
      programmes: data.pmNodes.filter((n) => n.level === 'programme').length,
      projects: data.pmNodes.filter((n) => n.level === 'project').length,
      deliverables: data.deliverables.length,
      standaloneDeliverables: data.deliverables.filter((d) => d.pmNodeId === null).length,
      epics: data.workItems.filter(isEpic).length,
      outcomes: data.outcomes.length,
      workItems: data.workItems.length,
    },
    reportedRag,
    evidenceRag: ragCounts(data.deliverables.map((d) => deliverableRag[d.id]?.evidence ?? 'unknown')),
    disagreementDeliverableIds: statusDisagreements(deliverableRag),
    programmeHealth,
    stageDistribution,
    stageWorkShare,
    readiness: readinessCounts(measures),
    workCompletion: sumWorkCompletion(
      measures.map((m) => m.workCompletion),
      'No estimated story-level work is linked to any deliverable.',
    ),
    acceptedOutcomes: sumAcceptedOutcomes(
      measures.map((m) => m.acceptedOutcomes),
      'No weighted outcomes are recorded.',
    ),
    findingsBySeverity,
    freshness: data.meta.freshness,
  };
}
