import type { EngineResult, InvestmentRequest, PmNode, PortfolioData, TechDeliverable, WorkItem } from '@/lib/types';

export type ExplorerView = 'all' | 'formal' | 'standalone' | 'disagree';
export type GroupMode = 'epic' | 'outcome';

/** Work-item types that are story level (carry an Outcome ID). */
const NOT_STORY_LEVEL = new Set(['theme', 'initiative', 'epic', 'tech-deliverable', 'sub-task']);
export const isStoryLevel = (w: WorkItem) => !NOT_STORY_LEVEL.has(w.type);
export const isEpicLevel = (w: WorkItem) => w.type === 'epic' || w.type === 'tech-deliverable';

/** Lookups for the tree, built once per data snapshot. Children are only turned into rows on expand. */
export interface TreeModel {
  requests: InvestmentRequest[];
  pmRootsByRequest: Map<string, PmNode[]>;
  pmChildren: Map<string, PmNode[]>;
  /** Deliverables directly under a PmNode. */
  deliverablesByPm: Map<string, TechDeliverable[]>;
  /** Deliverables with no PmNode, by investment request (standalone route). */
  standaloneByRequest: Map<string, TechDeliverable[]>;
  storiesByEpic: Map<string, WorkItem[]>;
  subTasksByParent: Map<string, WorkItem[]>;
  counts: {
    requests: number;
    byRisk: { low: number; moderate: number; high: number };
    initiatives: number;
    programmes: number;
    projects: number;
    deliverables: number;
    standalone: number;
    formal: number;
    outcomes: number;
    epics: number;
    stories: number;
    subTasks: number;
  };
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

export function buildTreeModel(data: PortfolioData): TreeModel {
  const pmIds = new Set(data.pmNodes.map((p) => p.id));
  const pmRootsByRequest = new Map<string, PmNode[]>();
  const pmChildren = new Map<string, PmNode[]>();
  for (const p of data.pmNodes) {
    if (p.parentId && pmIds.has(p.parentId)) push(pmChildren, p.parentId, p);
    else push(pmRootsByRequest, p.investmentRequestId, p);
  }
  const deliverablesByPm = new Map<string, TechDeliverable[]>();
  const standaloneByRequest = new Map<string, TechDeliverable[]>();
  for (const d of data.deliverables) {
    if (d.pmNodeId && pmIds.has(d.pmNodeId)) push(deliverablesByPm, d.pmNodeId, d);
    else push(standaloneByRequest, d.investmentRequestId, d);
  }
  const storiesByEpic = new Map<string, WorkItem[]>();
  const subTasksByParent = new Map<string, WorkItem[]>();
  let stories = 0;
  let subTasks = 0;
  let epics = 0;
  for (const w of data.workItems) {
    if (isEpicLevel(w)) epics++;
    else if (w.type === 'sub-task') {
      subTasks++;
      if (w.parentKey) push(subTasksByParent, w.parentKey, w);
    } else if (isStoryLevel(w)) {
      stories++;
      if (w.epicKey) push(storiesByEpic, w.epicKey, w);
    }
  }
  const byRisk = { low: 0, moderate: 0, high: 0 };
  for (const r of data.investmentRequests) byRisk[r.activityRisk]++;
  const level = (l: PmNode['level']) => data.pmNodes.filter((p) => p.level === l).length;
  const standalone = data.deliverables.filter((d) => !d.pmNodeId).length;
  return {
    requests: data.investmentRequests,
    pmRootsByRequest,
    pmChildren,
    deliverablesByPm,
    standaloneByRequest,
    storiesByEpic,
    subTasksByParent,
    counts: {
      requests: data.investmentRequests.length,
      byRisk,
      initiatives: level('initiative'),
      programmes: level('programme'),
      projects: level('project'),
      deliverables: data.deliverables.length,
      standalone,
      formal: data.deliverables.length - standalone,
      outcomes: data.outcomes.length,
      epics,
      stories,
      subTasks,
    },
  };
}

export function deliverableMatches(view: ExplorerView, d: TechDeliverable, results: EngineResult): boolean {
  switch (view) {
    case 'all':
      return true;
    case 'formal':
      return Boolean(d.pmNodeId);
    case 'standalone':
      return !d.pmNodeId;
    case 'disagree':
      return results.deliverableRag[d.id]?.disagrees === true;
  }
}

/** Ids of every row that must be open to reveal the path to a deliverable (request and PmNode ancestors). */
export function ancestorsOfDeliverable(model: TreeModel, data: PortfolioData, deliverableId: string): string[] {
  const d = data.deliverables.find((x) => x.id === deliverableId);
  if (!d) return [];
  const ids = [`ir:${d.investmentRequestId}`];
  const byId = new Map(data.pmNodes.map((p) => [p.id, p]));
  let cur = d.pmNodeId ? byId.get(d.pmNodeId) : undefined;
  const guard = new Set<string>();
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id);
    ids.push(`pm:${cur.id}`);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return ids;
}

/** Every request and PmNode row id: expanding all of these reveals the deliverable level. */
export function allUpperIds(data: PortfolioData): string[] {
  return [...data.investmentRequests.map((r) => `ir:${r.id}`), ...data.pmNodes.map((p) => `pm:${p.id}`)];
}
