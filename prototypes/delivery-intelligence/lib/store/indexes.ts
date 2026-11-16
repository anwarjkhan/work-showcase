/**
 * Id lookups over a PortfolioData snapshot, cached per snapshot object.
 * Pure; usable from the engine and agents as well as from hooks.
 */
import type {
  AcceptanceCriterion,
  AgentIdentity,
  Dependency,
  Evidence,
  Hub,
  InvestmentRequest,
  Milestone,
  Outcome,
  PdlcRun,
  Person,
  PmNode,
  Pod,
  PortfolioData,
  RaidItem,
  Sprint,
  TechDeliverable,
  WorkItem,
} from '@/lib/types';

export interface PortfolioIndex {
  investmentRequests: Map<string, InvestmentRequest>;
  pmNodes: Map<string, PmNode>;
  deliverables: Map<string, TechDeliverable>;
  outcomes: Map<string, Outcome>;
  criteria: Map<string, AcceptanceCriterion>;
  /** Keyed by work-item key. */
  workItems: Map<string, WorkItem>;
  evidence: Map<string, Evidence>;
  raid: Map<string, RaidItem>;
  dependencies: Map<string, Dependency>;
  milestones: Map<string, Milestone>;
  hubs: Map<string, Hub>;
  pods: Map<string, Pod>;
  people: Map<string, Person>;
  agentIdentities: Map<string, AgentIdentity>;
  sprints: Map<string, Sprint>;
  /** Keyed by deliverable id. */
  pdlcRunsByDeliverable: Map<string, PdlcRun>;
  outcomesByDeliverable: Map<string, Outcome[]>;
  criteriaByOutcome: Map<string, AcceptanceCriterion[]>;
  /** Story-level items and sub-tasks by Epic key. */
  workItemsByEpic: Map<string, WorkItem[]>;
  evidenceByDeliverable: Map<string, Evidence[]>;
}

const byId = <T extends { id: string }>(items: T[]) => new Map(items.map((i) => [i.id, i]));

function groupBy<T>(items: T[], key: (item: T) => string | null): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (k === null) continue;
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

const cache = new WeakMap<PortfolioData, PortfolioIndex>();

export function indexPortfolio(data: PortfolioData): PortfolioIndex {
  const hit = cache.get(data);
  if (hit) return hit;
  const index: PortfolioIndex = {
    investmentRequests: byId(data.investmentRequests),
    pmNodes: byId(data.pmNodes),
    deliverables: byId(data.deliverables),
    outcomes: byId(data.outcomes),
    criteria: byId(data.criteria),
    workItems: new Map(data.workItems.map((w) => [w.key, w])),
    evidence: byId(data.evidence),
    raid: byId(data.raid),
    dependencies: byId(data.dependencies),
    milestones: byId(data.milestones),
    hubs: byId(data.hubs),
    pods: byId(data.pods),
    people: byId(data.people),
    agentIdentities: byId(data.agentIdentities),
    sprints: byId(data.sprints),
    pdlcRunsByDeliverable: new Map(data.pdlcRuns.map((r) => [r.deliverableId, r])),
    outcomesByDeliverable: groupBy(data.outcomes, (o) => o.deliverableId),
    criteriaByOutcome: groupBy(data.criteria, (c) => c.outcomeId),
    workItemsByEpic: groupBy(data.workItems, (w) => w.epicKey),
    evidenceByDeliverable: groupBy(data.evidence, (e) => e.deliverableId),
  };
  cache.set(data, index);
  return index;
}
