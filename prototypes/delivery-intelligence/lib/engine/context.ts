/**
 * Engine context: every lookup the engine needs, built once per snapshot.
 * Resolves which deliverable owns each Epic and item, which items carry each
 * Outcome ID, and the latest change under every item (for evidence staleness).
 */
import { indexPortfolio, type PortfolioIndex } from '@/lib/store/indexes';
import type {
  DemoClock,
  Dependency,
  Evidence,
  Milestone,
  Outcome,
  PmNode,
  PortfolioData,
  RaidItem,
  TechDeliverable,
  WorkItem,
} from '@/lib/types';
import { EPIC_TYPES, STORY_LEVEL_TYPES } from './constants';
import { toMs } from './util';

export interface EngineContext {
  data: PortfolioData;
  clock: DemoClock;
  idx: PortfolioIndex;
  /** Deliverable by id or by ref ("TD-1001"). */
  resolveDeliverable(idOrRef: string | null): TechDeliverable | undefined;
  /** Outcome by id or by ref ("OC-1001-2"). */
  resolveOutcome(idOrRef: string | null): Outcome | undefined;
  /** Epic key -> owning deliverable id (Deliverable ID field first, then the book-of-record list). */
  epicOwner: Map<string, string>;
  /** Deliverable id -> its Epic keys (book-of-record order first). */
  epicsByDeliverable: Map<string, string[]>;
  /** Work-item key -> deliverable id it rolls up to. */
  deliverableOfItem: Map<string, string>;
  /** Deliverable id -> story-level items under its Epics. */
  storiesByDeliverable: Map<string, WorkItem[]>;
  /** Deliverable id -> every item below Epic level (story level and sub-tasks). */
  belowEpicByDeliverable: Map<string, WorkItem[]>;
  /** Outcome id -> story-level items carrying that Outcome ID. */
  storiesByOutcome: Map<string, WorkItem[]>;
  /** Item key -> direct children (by parent, and story-level items by Epic). */
  childrenOf: Map<string, WorkItem[]>;
  /** Latest change (ms) of an item and everything under it, and which item changed. */
  latestChangeUnder(key: string): { ms: number; key: string } | null;
  dependenciesInto: Map<string, Dependency[]>;
  dependenciesFrom: Map<string, Dependency[]>;
  milestonesByDeliverable: Map<string, Milestone[]>;
  raidByDeliverable: Map<string, RaidItem[]>;
  evidenceByDeliverable: Map<string, Evidence[]>;
  /** PmNode id -> deliverable ids in its subtree (itself and descendants). */
  deliverablesUnderPmNode: Map<string, string[]>;
  /** Investment request id -> deliverable ids. */
  deliverablesByRequest: Map<string, string[]>;
  pmChildren: Map<string | null, PmNode[]>;
  todayMs: number;
}

export function isEpic(item: WorkItem): boolean {
  return EPIC_TYPES.has(item.type);
}

export function isStoryLevel(item: WorkItem): boolean {
  return STORY_LEVEL_TYPES.has(item.type);
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

export function buildContext(data: PortfolioData, clock: DemoClock): EngineContext {
  const idx = indexPortfolio(data);

  const deliverableByRef = new Map(data.deliverables.map((d) => [d.ref, d]));
  const resolveDeliverable = (v: string | null) => (v === null ? undefined : (idx.deliverables.get(v) ?? deliverableByRef.get(v)));
  const outcomeByRef = new Map(data.outcomes.map((o) => [o.ref, o]));
  const resolveOutcome = (v: string | null) => (v === null ? undefined : (idx.outcomes.get(v) ?? outcomeByRef.get(v)));

  // --- Epic ownership: the Jira Deliverable ID wins; otherwise the deliverable that lists it.
  const listedBy = new Map<string, string>();
  for (const d of data.deliverables) for (const key of d.epicKeys) if (!listedBy.has(key)) listedBy.set(key, d.id);
  const epicOwner = new Map<string, string>();
  for (const item of data.workItems) {
    if (!isEpic(item)) continue;
    const owner = resolveDeliverable(item.deliverableId)?.id ?? listedBy.get(item.key);
    if (owner) epicOwner.set(item.key, owner);
  }
  for (const [key, owner] of listedBy) if (!epicOwner.has(key)) epicOwner.set(key, owner);

  const epicsByDeliverable = new Map<string, string[]>();
  for (const d of data.deliverables) epicsByDeliverable.set(d.id, d.epicKeys.filter((k) => epicOwner.get(k) === d.id));
  for (const [key, owner] of epicOwner) {
    const list = epicsByDeliverable.get(owner);
    if (list && !list.includes(key)) list.push(key);
  }

  // --- Item -> Epic -> deliverable.
  const epicKeyOf = (item: WorkItem): string | null => {
    if (item.epicKey) return item.epicKey;
    if (!item.parentKey) return null;
    const parent = idx.workItems.get(item.parentKey);
    if (!parent) return null;
    if (isEpic(parent)) return parent.key;
    return parent.epicKey;
  };

  const deliverableOfItem = new Map<string, string>();
  const storiesByDeliverable = new Map<string, WorkItem[]>();
  const belowEpicByDeliverable = new Map<string, WorkItem[]>();
  const storiesByOutcome = new Map<string, WorkItem[]>();
  const childrenOf = new Map<string, WorkItem[]>();
  for (const d of data.deliverables) {
    storiesByDeliverable.set(d.id, []);
    belowEpicByDeliverable.set(d.id, []);
  }

  for (const item of data.workItems) {
    if (isEpic(item)) {
      const owner = epicOwner.get(item.key);
      if (owner) deliverableOfItem.set(item.key, owner);
    } else {
      const epic = epicKeyOf(item);
      const owner = epic ? epicOwner.get(epic) : undefined;
      if (owner) {
        deliverableOfItem.set(item.key, owner);
        if (item.type !== 'theme' && item.type !== 'initiative') belowEpicByDeliverable.get(owner)?.push(item);
        if (isStoryLevel(item)) storiesByDeliverable.get(owner)?.push(item);
      }
    }
    if (isStoryLevel(item) && item.outcomeId) {
      const outcome = resolveOutcome(item.outcomeId);
      if (outcome) push(storiesByOutcome, outcome.id, item);
    }
    // Children: by direct parent; story-level items also by Epic when the parent is not that Epic.
    if (item.parentKey) push(childrenOf, item.parentKey, item);
    if (item.epicKey && item.epicKey !== item.parentKey && isStoryLevel(item)) push(childrenOf, item.epicKey, item);
  }

  // --- Latest change under each item (memoised depth-first walk; guards against cycles).
  const latestMemo = new Map<string, { ms: number; key: string } | null>();
  const latestChangeUnder = (key: string): { ms: number; key: string } | null => {
    if (latestMemo.has(key)) return latestMemo.get(key) ?? null;
    latestMemo.set(key, null); // cycle guard
    const item = idx.workItems.get(key);
    let best: { ms: number; key: string } | null = null;
    if (item) {
      const own = Math.max(toMs(item.updated), item.resolved ? toMs(item.resolved) : -Infinity);
      best = { ms: own, key: item.key };
    }
    for (const child of childrenOf.get(key) ?? []) {
      const c = latestChangeUnder(child.key);
      if (c && (!best || c.ms > best.ms)) best = c;
    }
    latestMemo.set(key, best);
    return best;
  };

  const dependenciesInto = new Map<string, Dependency[]>();
  const dependenciesFrom = new Map<string, Dependency[]>();
  for (const dep of data.dependencies) {
    push(dependenciesInto, dep.toDeliverableId, dep);
    push(dependenciesFrom, dep.fromDeliverableId, dep);
  }
  const milestonesByDeliverable = new Map<string, Milestone[]>();
  for (const m of data.milestones) push(milestonesByDeliverable, m.deliverableId, m);
  const raidByDeliverable = new Map<string, RaidItem[]>();
  for (const r of data.raid) push(raidByDeliverable, r.deliverableId, r);

  // --- Hierarchy subtrees.
  const pmChildren = new Map<string | null, PmNode[]>();
  for (const n of data.pmNodes) push(pmChildren, n.parentId && idx.pmNodes.has(n.parentId) ? n.parentId : null, n);
  const directDeliverables = new Map<string, string[]>();
  const deliverablesByRequest = new Map<string, string[]>();
  for (const d of data.deliverables) {
    if (d.pmNodeId) push(directDeliverables, d.pmNodeId, d.id);
    push(deliverablesByRequest, d.investmentRequestId, d.id);
  }
  const deliverablesUnderPmNode = new Map<string, string[]>();
  const collect = (node: PmNode, seen: Set<string>): string[] => {
    const cached = deliverablesUnderPmNode.get(node.id);
    if (cached) return cached;
    if (seen.has(node.id)) return [];
    seen.add(node.id);
    const ids = [...(directDeliverables.get(node.id) ?? [])];
    for (const child of pmChildren.get(node.id) ?? []) ids.push(...collect(child, seen));
    deliverablesUnderPmNode.set(node.id, ids);
    return ids;
  };
  for (const n of data.pmNodes) collect(n, new Set());

  return {
    data,
    clock,
    idx,
    resolveDeliverable,
    resolveOutcome,
    epicOwner,
    epicsByDeliverable,
    deliverableOfItem,
    storiesByDeliverable,
    belowEpicByDeliverable,
    storiesByOutcome,
    childrenOf,
    latestChangeUnder,
    dependenciesInto,
    dependenciesFrom,
    milestonesByDeliverable,
    raidByDeliverable,
    evidenceByDeliverable: idx.evidenceByDeliverable,
    deliverablesUnderPmNode,
    deliverablesByRequest,
    pmChildren,
    todayMs: toMs(clock.today),
  };
}
