import { PDLC_STAGES } from '@/lib/config/pdlc';
import { terms } from '@/lib/config/terminology';
import { RULE_DESCRIPTIONS } from '@/lib/config/thresholds';
import { computeHierarchyRollups, rollupMeasures, type MeasureRollup } from '@/lib/engine';
import type {
  DeliverableMeasures,
  EngineResult,
  EvidenceRagStatus,
  PdlcStageId,
  PortfolioData,
  RagCounts,
  RagStatus,
  RuleId,
  Severity,
  SourceFreshness,
} from '@/lib/types';

/** Pure view-model for the Portfolio screen. Every figure is read from the engine result; nothing is recomputed. */

const REPORTED_RANK: Record<RagStatus, number> = { red: 2, amber: 1, green: 0 };
const EVIDENCE_RANK: Record<EvidenceRagStatus, number> = { red: 2, amber: 1, green: 0, unknown: -1 };

export interface DisagreementRow {
  id: string;
  ref: string;
  title: string;
  programme: string;
  reported: RagStatus;
  evidence: EvidenceRagStatus;
  /** `optimistic`: reported better than the evidence supports. */
  direction: 'optimistic' | 'cautious';
  reason: string;
  measures: DeliverableMeasures | undefined;
}

export interface ProgrammeRow {
  id: string;
  ref: string;
  title: string;
  reported: RagStatus | null;
  evidence: EvidenceRagStatus | null;
  ragCounts: RagCounts;
  rollup: MeasureRollup;
}

export interface RuleRow {
  ruleId: RuleId;
  description: string;
  count: number;
  topSeverity: Severity;
}

export interface PortfolioView {
  total: number;
  disagreementCount: number;
  optimisticCount: number;
  cautiousCount: number;
  headline: string;
  summary: EngineResult['portfolio'];
  disagreements: DisagreementRow[];
  programmes: ProgrammeRow[];
  stages: Array<{ id: PdlcStageId; name: string; count: number; agentShare: number }>;
  rules: RuleRow[];
  findingsTotal: number;
  freshness: SourceFreshness[];
  today: string;
  sourceKind: PortfolioData['meta']['sourceKind'];
}

const SEV_RANK: Record<Severity, number> = { critical: 3, high: 2, medium: 1, low: 0 };

function joinColours(list: string[]): string {
  return list.length <= 1 ? (list[0] ?? '') : `${list.slice(0, -1).join(', ')} or ${list[list.length - 1]}`;
}

export function buildPortfolioView(data: PortfolioData, result: EngineResult): PortfolioView {
  const summary = result.portfolio;
  const total = summary.counts.deliverables;
  const nodes = new Map(data.pmNodes.map((n) => [n.id, n]));
  const programmeOf = (pmNodeId: string | null): string => {
    if (!pmNodeId) return terms.routes.standalone;
    let n = nodes.get(pmNodeId);
    for (let i = 0; n && n.level !== 'programme' && n.parentId && i < 6; i++) n = nodes.get(n.parentId) ?? n;
    return n?.title ?? terms.routes.standalone;
  };
  const deliverables = new Map(data.deliverables.map((d) => [d.id, d]));

  const disagreements: DisagreementRow[] = [];
  for (const id of summary.disagreementDeliverableIds) {
    const d = deliverables.get(id);
    const rag = result.deliverableRag[id];
    if (!d || !rag) continue;
    disagreements.push({
      id,
      ref: d.ref,
      title: d.title,
      programme: programmeOf(d.pmNodeId),
      reported: rag.reported,
      evidence: rag.evidence,
      direction: EVIDENCE_RANK[rag.evidence] > REPORTED_RANK[rag.reported] ? 'optimistic' : 'cautious',
      reason: rag.reasons[0]?.message ?? '',
      measures: result.deliverables[id],
    });
  }
  const optimistic = disagreements.filter((r) => r.direction === 'optimistic');
  const n = disagreements.length;
  const o = optimistic.length;
  const c = n - o;
  let headline: string;
  if (n === 0) headline = `Reported and evidence-based status agree on all ${total} deliverables.`;
  else if (c === 0) {
    const colours = (['green', 'amber', 'red'] as const).filter((s) => optimistic.some((r) => r.reported === s)).map((s) => terms.rag[s]);
    headline = `${n} of ${total} deliverables are reported ${joinColours(colours)} where the evidence says otherwise.`;
  } else if (o === 0) headline = `${n} of ${total} deliverables are reported worse than the evidence shows.`;
  else headline = `${n} of ${total} deliverables are reported differently from the evidence: ${o} better than it supports, ${c} worse.`;

  const rollups = computeHierarchyRollups(data, result);
  const programmes: ProgrammeRow[] = summary.programmeHealth.map((p) => {
    const node = nodes.get(p.pmNodeId);
    return {
      id: p.pmNodeId,
      ref: node?.ref ?? p.pmNodeId,
      title: node?.title ?? p.pmNodeId,
      reported: p.reported,
      evidence: p.evidence,
      ragCounts: p.deliverableRag,
      rollup: rollups.pmNodes[p.pmNodeId] ?? rollupMeasures(result, p.deliverableIds),
    };
  });
  programmes.sort((a, b) => EVIDENCE_RANK[b.evidence ?? 'unknown'] - EVIDENCE_RANK[a.evidence ?? 'unknown'] || a.title.localeCompare(b.title));
  const standaloneIds = data.deliverables.filter((d) => d.pmNodeId === null).map((d) => d.id);
  if (standaloneIds.length > 0) {
    const rollup = rollupMeasures(result, standaloneIds);
    programmes.push({ id: 'standalone', ref: '', title: terms.routes.standalone, reported: null, evidence: null, ragCounts: rollup.evidenceRag, rollup });
  }

  const byRule = new Map<RuleId, RuleRow>();
  for (const f of result.findings) {
    const row = byRule.get(f.ruleId);
    if (row) {
      row.count++;
      if (SEV_RANK[f.severity] > SEV_RANK[row.topSeverity]) row.topSeverity = f.severity;
    } else byRule.set(f.ruleId, { ruleId: f.ruleId, description: RULE_DESCRIPTIONS[f.ruleId], count: 1, topSeverity: f.severity });
  }
  const rules = [...byRule.values()].sort((a, b) => SEV_RANK[b.topSeverity] - SEV_RANK[a.topSeverity] || b.count - a.count);

  return {
    total,
    disagreementCount: n,
    optimisticCount: o,
    cautiousCount: c,
    headline,
    summary,
    disagreements,
    programmes,
    stages: PDLC_STAGES.map((s) => ({ id: s.id, name: s.shortName, count: summary.stageDistribution[s.id], agentShare: summary.stageWorkShare[s.id].agentShare })),
    rules,
    findingsTotal: result.findings.length,
    freshness: summary.freshness,
    today: result.computedFor,
    sourceKind: data.meta.sourceKind,
  };
}
