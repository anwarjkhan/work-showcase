/**
 * Hub, region and dependency figures for the Global screen. Pure: everything
 * derives from the portfolio data and the engine result at the demo clock.
 */
import { HERO_DELIVERABLE_ID } from '@/lib/config/story';
import { dependencyLateDays, isDependencyOpen, isDependencyTroubled } from '@/lib/engine';
import type {
  Continent,
  DemoClock,
  Dependency,
  EngineResult,
  EvidenceRagStatus,
  Hub,
  PortfolioData,
  RagCounts,
} from '@/lib/types';

export type HubMetric = 'deliverables' | 'openWork' | 'people';

export const METRIC_LABEL: Record<HubMetric, string> = {
  deliverables: 'Deliverables',
  openWork: 'Open work',
  people: 'People',
};

/** Continents in follow-the-sun order (west to east by UTC offset). */
export const CONTINENT_ORDER: Continent[] = ['north-america', 'south-america', 'europe', 'africa', 'asia', 'oceania'];

export const CONTINENT_LABEL: Record<Continent, string> = {
  'north-america': 'North America',
  'south-america': 'South America',
  europe: 'Europe',
  africa: 'Africa',
  asia: 'Asia',
  oceania: 'Oceania',
};

/** How hub health is derived; shown in the legend so the rule is explicit. */
export const HEALTH_RULE = {
  short: 'Weighted evidence-based RAG',
  long: 'Average of the evidence-based RAG of every deliverable at the hub (Red 3, Amber 2, Green 1; the lead hub counts double; Unknown left out). 2.4 or more is Red, 1.7 or more is Amber, otherwise Green.',
  redFrom: 2.4,
  amberFrom: 1.7,
} as const;

const RAG_SCORE: Record<Exclude<EvidenceRagStatus, 'unknown'>, number> = { red: 3, amber: 2, green: 1 };

export function weightedHealth(items: Array<{ rag: EvidenceRagStatus; weight: number }>): { status: EvidenceRagStatus; score: number | null } {
  let sum = 0;
  let w = 0;
  for (const i of items) {
    if (i.rag === 'unknown') continue;
    sum += RAG_SCORE[i.rag] * i.weight;
    w += i.weight;
  }
  if (w === 0) return { status: 'unknown', score: null };
  const score = sum / w;
  return { status: score >= HEALTH_RULE.redFrom ? 'red' : score >= HEALTH_RULE.amberFrom ? 'amber' : 'green', score };
}

export type ArcTone = 'late' | 'at-risk' | 'on-track' | 'delivered';

export interface DependencyView {
  dep: Dependency;
  tone: ArcTone;
  /** Days past need-by (engine rule); 0 when not late. */
  lateDays: number;
  crossHub: boolean;
  crossContinent: boolean;
  involvesHero: boolean;
}

export interface HubView {
  hub: Hub;
  deliverableIds: string[];
  leadDeliverableIds: string[];
  openWork: number;
  totalWork: number;
  people: number;
  agents: number;
  podIds: string[];
  health: EvidenceRagStatus;
  healthScore: number | null;
  ragMix: RagCounts;
  /** Deliverables at the hub whose reported and evidence-based RAG disagree. */
  disagreementIds: string[];
  inbound: DependencyView[];
  outbound: DependencyView[];
  /** Open late or blocked dependencies touching the hub. */
  lateDependencyIds: string[];
  /** Status disagreement or a late dependency: the marker pulses. */
  attention: boolean;
  utcOffset: string | null;
  localTime: string | null;
}

export interface RegionView {
  continent: Continent;
  hubIds: string[];
  deliverableIds: string[];
  openWork: number;
  people: number;
  agents: number;
  ragMix: RagCounts;
  health: EvidenceRagStatus;
  lateDependencies: number;
  utcRange: string | null;
}

export interface GlobalModel {
  hubs: HubView[];
  hubById: Map<string, HubView>;
  regions: RegionView[];
  dependencies: DependencyView[];
  /** The late dependency into the hero deliverable, if any. */
  heroDependency: DependencyView | null;
  totals: {
    hubs: number;
    continents: number;
    crossHub: number;
    crossContinent: number;
    late: number;
    atRisk: number;
    attentionHubs: number;
  };
}

function arcTone(dep: Dependency, lateDays: number, clock: DemoClock): ArcTone {
  if (!isDependencyOpen(dep)) return 'delivered';
  if (isDependencyTroubled(dep, clock)) return 'late';
  if (dep.status === 'at-risk' || lateDays > 0 || dep.committed === null) return 'at-risk';
  return 'on-track';
}

/** "UTC+8", "UTC−5", "UTC+5:30" at the demo clock's instant. */
export function utcOffsetLabel(timeZone: string, at: string): string | null {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone, timeZoneName: 'shortOffset' }).formatToParts(new Date(at));
    const raw = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
    const m = /GMT([+-−]?)(\d{1,2})(?::(\d{2}))?/.exec(raw);
    if (!m) return raw === 'GMT' ? 'UTC' : null;
    const sign = m[1] === '-' || m[1] === '−' ? '−' : '+';
    return `UTC${sign}${Number(m[2])}${m[3] ? `:${m[3]}` : ''}`;
  } catch {
    return null;
  }
}

/** Offset in minutes, for ordering ("UTC−5" → -300). */
export function offsetMinutes(label: string | null): number {
  if (!label || label === 'UTC') return 0;
  const m = /UTC([+−])(\d+)(?::(\d+))?/.exec(label);
  if (!m) return 0;
  const v = Number(m[2]) * 60 + Number(m[3] ?? 0);
  return m[1] === '−' ? -v : v;
}

export function localTimeLabel(timeZone: string, at: string): string | null {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(at));
  } catch {
    return null;
  }
}

const emptyMix = (): RagCounts => ({ red: 0, amber: 0, green: 0, unknown: 0 });

export function buildGlobalModel(data: PortfolioData, results: EngineResult, clock: DemoClock): GlobalModel {
  const hubById = new Map(data.hubs.map((h) => [h.id, h]));
  const ragOf = (deliverableId: string): EvidenceRagStatus => results.deliverableRag[deliverableId]?.evidence ?? 'unknown';
  const disagrees = (deliverableId: string) => results.deliverableRag[deliverableId]?.disagrees ?? false;

  const dependencies: DependencyView[] = data.dependencies
    .filter((d) => hubById.has(d.fromHubId) && hubById.has(d.toHubId))
    .map((dep) => {
      const lateDays = dependencyLateDays(dep, clock);
      const from = hubById.get(dep.fromHubId)!;
      const to = hubById.get(dep.toHubId)!;
      return {
        dep,
        lateDays,
        tone: arcTone(dep, lateDays, clock),
        crossHub: dep.fromHubId !== dep.toHubId,
        crossContinent: from.continent !== to.continent,
        involvesHero: dep.toDeliverableId === HERO_DELIVERABLE_ID || dep.fromDeliverableId === HERO_DELIVERABLE_ID,
      };
    });

  const hubs: HubView[] = data.hubs.map((hub) => {
    const delivs = data.deliverables.filter((d) => d.hubIds.includes(hub.id));
    const lead = delivs.filter((d) => d.hubIds[0] === hub.id);
    const ragMix = emptyMix();
    for (const d of delivs) ragMix[ragOf(d.id)] += 1;
    const health = weightedHealth(delivs.map((d) => ({ rag: ragOf(d.id), weight: d.hubIds[0] === hub.id ? 2 : 1 })));
    const work = data.workItems.filter((w) => w.hubId === hub.id && (w.type !== 'epic' && w.type !== 'theme' && w.type !== 'initiative' && w.type !== 'tech-deliverable'));
    const openWork = work.filter((w) => w.statusCategory !== 'done').length;
    const inbound = dependencies.filter((d) => d.dep.toHubId === hub.id);
    const outbound = dependencies.filter((d) => d.dep.fromHubId === hub.id);
    const lateDependencyIds = [...new Set([...inbound, ...outbound].filter((d) => d.tone === 'late').map((d) => d.dep.id))];
    const disagreementIds = delivs.filter((d) => disagrees(d.id)).map((d) => d.id);
    const utcOffset = utcOffsetLabel(hub.timeZone, clock.now);
    return {
      hub,
      deliverableIds: delivs.map((d) => d.id),
      leadDeliverableIds: lead.map((d) => d.id),
      openWork,
      totalWork: work.length,
      people: data.people.filter((p) => p.hubId === hub.id).length,
      agents: data.agentIdentities.filter((a) => a.hubId === hub.id).length,
      podIds: data.pods.filter((p) => p.hubId === hub.id).map((p) => p.id),
      health: health.status,
      healthScore: health.score,
      ragMix,
      disagreementIds,
      inbound,
      outbound,
      lateDependencyIds,
      attention: disagreementIds.length > 0 || lateDependencyIds.length > 0,
      utcOffset,
      localTime: localTimeLabel(hub.timeZone, clock.now),
    };
  });

  const regions: RegionView[] = CONTINENT_ORDER.map((continent) => {
    const rh = hubs.filter((h) => h.hub.continent === continent);
    const deliverableIds = [...new Set(rh.flatMap((h) => h.deliverableIds))];
    const ragMix = emptyMix();
    for (const id of deliverableIds) ragMix[ragOf(id)] += 1;
    const leadWeights = data.deliverables
      .filter((d) => deliverableIds.includes(d.id))
      .map((d) => ({ rag: ragOf(d.id), weight: rh.some((h) => h.hub.id === d.hubIds[0]) ? 2 : 1 }));
    const offsets = [...new Set(rh.map((h) => h.utcOffset).filter((o): o is string => o !== null))].sort((a, b) => offsetMinutes(a) - offsetMinutes(b));
    const lateIds = new Set(rh.flatMap((h) => h.lateDependencyIds));
    return {
      continent,
      hubIds: rh.map((h) => h.hub.id),
      deliverableIds,
      openWork: rh.reduce((s, h) => s + h.openWork, 0),
      people: rh.reduce((s, h) => s + h.people, 0),
      agents: rh.reduce((s, h) => s + h.agents, 0),
      ragMix,
      health: weightedHealth(leadWeights).status,
      lateDependencies: lateIds.size,
      utcRange: offsets.length === 0 ? null : offsets.length === 1 ? offsets[0]! : `${offsets[0]} to ${offsets[offsets.length - 1]!.replace('UTC', '')}`,
    };
  }).filter((r) => r.hubIds.length > 0);

  const heroCandidates = dependencies
    .filter((d) => d.dep.toDeliverableId === HERO_DELIVERABLE_ID && d.tone !== 'delivered')
    .sort((a, b) => (a.tone === 'late' ? 0 : 1) - (b.tone === 'late' ? 0 : 1) || b.lateDays - a.lateDays || Number(b.crossContinent) - Number(a.crossContinent));
  const cross = dependencies.filter((d) => d.crossHub);

  return {
    hubs,
    hubById: new Map(hubs.map((h) => [h.hub.id, h])),
    regions,
    dependencies,
    heroDependency: heroCandidates[0] ?? null,
    totals: {
      hubs: hubs.length,
      continents: new Set(hubs.map((h) => h.hub.continent)).size,
      crossHub: cross.length,
      crossContinent: cross.filter((d) => d.crossContinent).length,
      late: cross.filter((d) => d.tone === 'late').length,
      atRisk: cross.filter((d) => d.tone === 'at-risk').length,
      attentionHubs: hubs.filter((h) => h.attention).length,
    },
  };
}

export type ArcFilter = 'all' | 'late' | 'hub' | 'hero';

/** Dependencies shown as arcs for a filter. Within-hub dependencies have no arc. */
export function visibleArcs(model: GlobalModel, filter: ArcFilter, selectedHubId: string | null): DependencyView[] {
  const cross = model.dependencies.filter((d) => d.crossHub);
  switch (filter) {
    case 'late':
      return cross.filter((d) => d.tone === 'late');
    case 'hub':
      return selectedHubId ? cross.filter((d) => d.dep.fromHubId === selectedHubId || d.dep.toHubId === selectedHubId) : cross;
    case 'hero':
      return cross.filter((d) => d.involvesHero);
    default:
      return cross;
  }
}
