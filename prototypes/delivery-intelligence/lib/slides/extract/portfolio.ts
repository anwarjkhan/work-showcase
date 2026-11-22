/**
 * Facts for the whole portfolio: the engine's portfolio summary, the
 * disagreement list, programme health with roll-ups, findings per rule, this
 * quarter's commitments (from forecasts and knock-on) and work and health per
 * region. Counts group records; measures come from the engine.
 */
import { addDays } from '@/lib/config/clock';
import { RULE_DESCRIPTIONS } from '@/lib/config/thresholds';
import { compareFindings, dependencyLateDays, isDependencyTroubled, type HierarchyRollup } from '@/lib/engine';
import type { Continent, Dependency, EvidenceRagStatus, Finding, Milestone, PmNode, PortfolioSummary, RuleId, Severity, TechDeliverable } from '@/lib/types';
import type { MeasureView, ReadinessView } from '../types';
import type { SlideEnv } from './common';
import { deliverableLine, type NodeDeliverableLine } from './node';
import { acceptedView, readinessRollupView, workView } from './format';

export interface ProgrammeLine {
  node: PmNode;
  reported: PortfolioSummary['programmeHealth'][number]['reported'];
  evidence: EvidenceRagStatus;
  deliverableRag: Record<EvidenceRagStatus, number>;
  rollup: HierarchyRollup | undefined;
  views: { work: MeasureView; accepted: MeasureView; readiness: ReadinessView };
}

export interface RuleLine {
  ruleId: RuleId;
  description: string;
  severity: Severity;
  count: number;
  deliverableRefs: string[];
  /** The first finding (most severe, stable order) for an example. */
  first: Finding;
}

export interface QuarterFacts {
  label: string;
  start: string;
  end: string;
  /** Deliverables with a planned end inside the quarter. */
  due: NodeDeliverableLine[];
  /** Deliverables due by the end of the quarter whose forecast slips or is at risk. */
  slipping: NodeDeliverableLine[];
  /** Regulatory milestones in the quarter that are missed, past date, pushed by knock-on or on a Red deliverable. */
  regulatoryAtRisk: { milestone: Milestone; deliverable: TechDeliverable | undefined; why: string }[];
}

export interface RegionLine {
  continent: Continent;
  label: string;
  hubNames: string[];
  workItems: number;
  agentItems: number;
  /** Evidence-based status of deliverables led from the region. */
  deliverableRag: Record<EvidenceRagStatus, number>;
  lateCrossHubInbound: number;
}

export interface PortfolioFacts {
  summary: PortfolioSummary;
  views: { work: MeasureView; accepted: MeasureView; readiness: ReadinessView };
  disagreeing: NodeDeliverableLine[];
  programmes: ProgrammeLine[];
  rules: RuleLine[];
  quarter: QuarterFacts;
  regions: RegionLine[];
  lateCrossHub: { dependency: Dependency; lateDays: number }[];
}

/** Region words for the continents the estate uses (geography, not system terminology). */
export const CONTINENT_LABEL: Record<Continent, string> = {
  europe: 'Europe',
  'north-america': 'North America',
  'south-america': 'South America',
  asia: 'Asia',
  africa: 'Africa',
  oceania: 'Oceania',
};
const CONTINENTS = Object.keys(CONTINENT_LABEL) as Continent[];

const zeroRag = (): Record<EvidenceRagStatus, number> => ({ red: 0, amber: 0, green: 0, unknown: 0 });

/** The calendar quarter containing a date. */
export function quarterOf(today: string): { label: string; start: string; end: string } {
  const year = Number(today.slice(0, 4));
  const q = Math.floor((Number(today.slice(5, 7)) - 1) / 3);
  const startMonth = q * 3 + 1;
  const pad = (n: number) => String(n).padStart(2, '0');
  const next = q === 3 ? `${year + 1}-01-01` : `${year}-${pad(startMonth + 3)}-01`;
  return { label: `Q${q + 1} ${year}`, start: `${year}-${pad(startMonth)}-01`, end: addDays(next, -1) };
}

export function portfolioFacts(env: SlideEnv): PortfolioFacts {
  const { data, result, idx, extras } = env;
  const summary = result.portfolio;
  const line = (d: TechDeliverable) => deliverableLine(env, d);
  const lineById = (id: string) => {
    const d = idx.deliverables.get(id);
    return d ? line(d) : undefined;
  };
  const isLine = (l: NodeDeliverableLine | undefined): l is NodeDeliverableLine => l !== undefined;

  const programmes: ProgrammeLine[] = summary.programmeHealth
    .map((p) => {
      const node = idx.pmNodes.get(p.pmNodeId);
      if (!node) return null;
      const rollup = env.rollups.pmNodes[node.id];
      return {
        node,
        reported: p.reported,
        evidence: p.evidence,
        deliverableRag: p.deliverableRag,
        rollup,
        views: {
          work: workView(rollup?.workCompletion),
          accepted: acceptedView(rollup?.acceptedOutcomes),
          readiness: readinessRollupView(rollup?.readiness ?? { ready: 0, 'not-ready': 0, unknown: 0 }),
        },
      };
    })
    .filter((p): p is ProgrammeLine => p !== null);

  // Findings per rule, most severe first, then by count.
  const byRule = new Map<RuleId, Finding[]>();
  for (const f of result.findings) {
    const list = byRule.get(f.ruleId);
    if (list) list.push(f);
    else byRule.set(f.ruleId, [f]);
  }
  const rank: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  const rules: RuleLine[] = [...byRule.entries()]
    .map(([ruleId, list]) => {
      const sorted = list.slice().sort(compareFindings);
      const first = sorted[0] as Finding;
      const refs = [...new Set(list.map((f) => (f.deliverableId ? idx.deliverables.get(f.deliverableId)?.ref : undefined)).filter((r): r is string => !!r))];
      return { ruleId, description: RULE_DESCRIPTIONS[ruleId], severity: first.severity, count: list.length, deliverableRefs: refs.sort((a, b) => a.localeCompare(b, 'en', { numeric: true })), first };
    })
    .sort((a, b) => rank[b.severity] - rank[a.severity] || b.count - a.count || Number(a.ruleId.slice(1)) - Number(b.ruleId.slice(1)));

  // This quarter.
  const q = quarterOf(extras.clock.today);
  const due = data.deliverables.filter((d) => d.plannedEnd >= q.start && d.plannedEnd <= q.end).map(line);
  const slipping = data.deliverables
    .filter((d) => d.plannedEnd <= q.end)
    .map(line)
    .filter((l) => l.forecast !== undefined && (l.forecast.slipDays > 0 || l.forecast.atRisk) && l.forecast.method !== 'complete');
  const pushed = new Map<string, string>();
  for (const k of env.knockOn) {
    const provider = idx.deliverables.get(k.providerId)?.ref ?? 'a provider';
    for (const m of k.affectedMilestones) if (!pushed.has(m.milestoneId)) pushed.set(m.milestoneId, `Knock-on of ${k.lateDays} days from ${provider}`);
  }
  const regulatoryAtRisk = data.milestones
    .filter((m) => m.regulatory && m.date >= q.start && m.date <= q.end && m.status !== 'met')
    .map((m) => {
      const why =
        m.status === 'missed'
          ? 'Missed'
          : m.date < extras.clock.today
            ? 'Date passed, not met'
            : (pushed.get(m.id) ?? (result.deliverableRag[m.deliverableId]?.evidence === 'red' ? 'Deliverable is Red on evidence' : null));
      return why ? { milestone: m, deliverable: idx.deliverables.get(m.deliverableId), why } : null;
    })
    .filter((x): x is QuarterFacts['regulatoryAtRisk'][number] => x !== null)
    .sort((a, b) => a.milestone.date.localeCompare(b.milestone.date) || a.milestone.id.localeCompare(b.milestone.id));

  // Regions (continents of hubs).
  const continentOfHub = (hubId: string | null) => (hubId ? idx.hubs.get(hubId)?.continent : undefined);
  const lateCrossHub = data.dependencies
    .filter((dep) => dep.fromHubId !== dep.toHubId && isDependencyTroubled(dep, extras.clock))
    .map((dep) => ({ dependency: dep, lateDays: dependencyLateDays(dep, extras.clock) }));
  const regions: RegionLine[] = CONTINENTS.map((c) => {
    const items = data.workItems.filter((w) => continentOfHub(w.hubId) === c);
    const rag = zeroRag();
    for (const d of data.deliverables) if (continentOfHub(d.hubIds[0] ?? null) === c) rag[result.deliverableRag[d.id]?.evidence ?? 'unknown']++;
    return {
      continent: c,
      label: CONTINENT_LABEL[c],
      hubNames: data.hubs.filter((h) => h.continent === c).map((h) => h.name),
      workItems: items.length,
      agentItems: items.filter((w) => w.assigneeType === 'agent').length,
      deliverableRag: rag,
      lateCrossHubInbound: lateCrossHub.filter((x) => continentOfHub(x.dependency.toHubId) === c).length,
    };
  }).filter((r) => r.hubNames.length > 0);

  return {
    summary,
    views: {
      work: workView(summary.workCompletion),
      accepted: acceptedView(summary.acceptedOutcomes),
      readiness: readinessRollupView(summary.readiness),
    },
    disagreeing: summary.disagreementDeliverableIds.map(lineById).filter(isLine),
    programmes,
    rules,
    quarter: { ...q, due, slipping, regulatoryAtRisk },
    regions,
    lateCrossHub,
  };
}
