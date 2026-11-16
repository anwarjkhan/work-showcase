/**
 * Pure layout helpers for the Plan screen. Every date calculation goes through
 * the engine's plan helpers (planWindow, stepWindow, planTimeline, barSpan,
 * datePosition, sprintFor); these functions only arrange the results into rows,
 * geometry and window summaries. No clock, no globals: unit-tested in layout.test.ts.
 */
import { addDays, daysBetween } from '@/lib/config/clock';
import { HERO_DELIVERABLE_ID } from '@/lib/config/story';
import {
  barSpan,
  datePosition,
  isDependencyTroubled,
  planTimeline,
  planWindow,
  sprintFor,
  stepWindow,
  windowDays,
  type Forecast,
  type HierarchyRollups,
  type KnockOn,
} from '@/lib/engine';
import { isStoryLevel } from '@/lib/engine/context';
import type {
  DemoClock,
  Dependency,
  EngineResult,
  IsoDate,
  Milestone,
  Outcome,
  PlanSpan,
  PlanTick,
  PlanWindow,
  PlanZoom,
  PortfolioData,
  Sprint,
  TechDeliverable,
  WorkItem,
} from '@/lib/types';

const later = (a: IsoDate, b: IsoDate) => (b > a ? b : a);
const inWindow = (date: IsoDate, w: Pick<PlanWindow, 'start' | 'end'>) => date >= w.start && date <= w.end;

// ---------------------------------------------------------------------------
// Plan index: everything the screen derives once per store revision
// ---------------------------------------------------------------------------

export interface DeliverableInfo {
  deliverable: TechDeliverable;
  span: PlanSpan;
  forecast: Forecast | undefined;
  /** Knock-on of late or blocked dependencies this deliverable receives. */
  knockOns: KnockOn[];
  /** Latest end once the engine forecast and dependency knock-on are both applied. */
  projectedEnd: IsoDate;
  /** projectedEnd minus planned end, in days (positive is late). */
  projectedSlipDays: number;
  /** Dependencies received (all) and provided (all), open or not. */
  incoming: Dependency[];
  outgoing: Dependency[];
  milestones: Milestone[];
  outcomes: Outcome[];
  /** Story-level work across all its Epics. */
  stories: WorkItem[];
  standalone: boolean;
  regulatory: boolean;
  /** Programme-level PM node ids above it (for the programme filter). */
  programmeIds: string[];
}

export interface PlanIndex {
  /** Rollup and deliverable spans by entity id (Epics are not rows on this screen). */
  spans: Map<string, PlanSpan>;
  /** Child spans by parent id (`null` for investment requests), in engine order. */
  children: Map<string | null, PlanSpan[]>;
  deliverables: Map<string, DeliverableInfo>;
  /** Projected end of rollup rows (max of their deliverables' projected ends and their own forecast). */
  rollupProjectedEnd: Map<string, IsoDate>;
  /** Deliverable ids under each rollup row. */
  descendants: Map<string, string[]>;
  troubled: Dependency[];
  /** Knock-on per dependency id. */
  knockOnByDependency: Map<string, KnockOn>;
  /** Milestone ids flagged by rule R1 (due soon with too little work closed). */
  r1MilestoneIds: Set<string>;
  /** Milestone id -> date it moves to under the dependency knock-on. */
  shiftedMilestones: Map<string, IsoDate>;
  programmes: { id: string; title: string }[];
}

export interface PlanIndexInput {
  data: PortfolioData;
  result: Pick<EngineResult, 'plan' | 'findings'>;
  forecasts: Map<string, Forecast>;
  knockOn: KnockOn[];
  clock: DemoClock;
}

export function buildPlanIndex({ data, result, forecasts, knockOn, clock }: PlanIndexInput): PlanIndex {
  const spans = new Map<string, PlanSpan>();
  const children = new Map<string | null, PlanSpan[]>();
  for (const s of result.plan.spans) {
    if (s.level === 'epic') continue;
    spans.set(s.entity.id, s);
    const list = children.get(s.parentId);
    if (list) list.push(s);
    else children.set(s.parentId, [s]);
  }

  const pmById = new Map(data.pmNodes.map((n) => [n.id, n]));
  const programmeIdsOf = (pmNodeId: string | null): string[] => {
    const out: string[] = [];
    let cursor = pmNodeId ? pmById.get(pmNodeId) : undefined;
    let guard = 0;
    while (cursor && guard++ < 20) {
      if (cursor.level === 'programme') out.push(cursor.id);
      cursor = cursor.parentId ? pmById.get(cursor.parentId) : undefined;
    }
    return out;
  };

  const epicOwner = new Map<string, string>();
  for (const d of data.deliverables) for (const k of d.epicKeys) epicOwner.set(k, d.id);
  const storiesBy = new Map<string, WorkItem[]>();
  for (const w of data.workItems) {
    if (!isStoryLevel(w) || !w.epicKey) continue;
    const owner = epicOwner.get(w.epicKey);
    if (!owner) continue;
    const list = storiesBy.get(owner);
    if (list) list.push(w);
    else storiesBy.set(owner, [w]);
  }

  const group = <T,>(items: T[], key: (t: T) => string) => {
    const m = new Map<string, T[]>();
    for (const it of items) {
      const k = key(it);
      const list = m.get(k);
      if (list) list.push(it);
      else m.set(k, [it]);
    }
    return m;
  };
  const milestonesBy = group(data.milestones, (m) => m.deliverableId);
  const outcomesBy = group(data.outcomes, (o) => o.deliverableId);
  const incomingBy = group(data.dependencies, (d) => d.toDeliverableId);
  const outgoingBy = group(data.dependencies, (d) => d.fromDeliverableId);
  const knockOnBy = group(knockOn, (k) => k.receiverId);

  const shiftedMilestones = new Map<string, IsoDate>();
  for (const k of knockOn) for (const m of k.affectedMilestones) shiftedMilestones.set(m.milestoneId, later(shiftedMilestones.get(m.milestoneId) ?? m.shiftedTo, m.shiftedTo));

  const deliverables = new Map<string, DeliverableInfo>();
  for (const d of data.deliverables) {
    const span = spans.get(d.id);
    if (!span) continue;
    const forecast = forecasts.get(d.id);
    const ko = knockOnBy.get(d.id) ?? [];
    const projectedEnd = ko.reduce((acc, k) => later(acc, k.receiverEndWithDelay), later(d.plannedEnd, forecast?.forecastEnd ?? span.forecastEnd));
    const milestones = [...(milestonesBy.get(d.id) ?? [])].sort((a, b) => a.date.localeCompare(b.date));
    deliverables.set(d.id, {
      deliverable: d,
      span,
      forecast,
      knockOns: ko,
      projectedEnd,
      projectedSlipDays: daysBetween(d.plannedEnd, projectedEnd),
      incoming: incomingBy.get(d.id) ?? [],
      outgoing: outgoingBy.get(d.id) ?? [],
      milestones,
      outcomes: [...(outcomesBy.get(d.id) ?? [])].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.ref.localeCompare(b.ref)),
      stories: storiesBy.get(d.id) ?? [],
      standalone: d.pmNodeId === null || !pmById.has(d.pmNodeId),
      regulatory: milestones.some((m) => m.regulatory),
      programmeIds: programmeIdsOf(d.pmNodeId),
    });
  }

  const descendants = new Map<string, string[]>();
  const rollupProjectedEnd = new Map<string, IsoDate>();
  const walk = (s: PlanSpan): string[] => {
    if (s.level === 'deliverable') return [s.entity.id];
    const ids = (children.get(s.entity.id) ?? []).flatMap(walk);
    descendants.set(s.entity.id, ids);
    rollupProjectedEnd.set(
      s.entity.id,
      ids.reduce((acc, id) => later(acc, deliverables.get(id)?.projectedEnd ?? acc), later(s.plannedEnd, s.forecastEnd)),
    );
    return ids;
  };
  for (const top of children.get(null) ?? []) walk(top);

  const troubledIds = new Set(result.plan.lateDependencyIds);
  const troubled = data.dependencies.filter((d) => troubledIds.has(d.id) || isDependencyTroubled(d, clock));

  return {
    spans,
    children,
    deliverables,
    rollupProjectedEnd,
    descendants,
    troubled,
    knockOnByDependency: new Map(knockOn.map((k) => [k.dependencyId, k])),
    r1MilestoneIds: new Set(result.findings.filter((f) => f.ruleId === 'R1' && f.subject.kind === 'milestone').map((f) => f.subject.id)),
    shiftedMilestones,
    programmes: data.pmNodes.filter((n) => n.level === 'programme').map((n) => ({ id: n.id, title: n.title })),
  };
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export interface PlanFilters {
  programmeId: string | null;
  disagreementOnly: boolean;
  regulatoryOnly: boolean;
}

export const NO_FILTERS: PlanFilters = { programmeId: null, disagreementOnly: false, regulatoryOnly: false };

export function isFiltered(f: PlanFilters): boolean {
  return f.programmeId !== null || f.disagreementOnly || f.regulatoryOnly;
}

/** Deliverable ids that pass the filters. */
export function filterDeliverables(index: PlanIndex, filters: PlanFilters, disagrees: (deliverableId: string) => boolean): Set<string> {
  const out = new Set<string>();
  for (const [id, info] of index.deliverables) {
    if (filters.programmeId && !info.programmeIds.includes(filters.programmeId)) continue;
    if (filters.disagreementOnly && !disagrees(id)) continue;
    if (filters.regulatoryOnly && !info.regulatory) continue;
    out.add(id);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export type PlanRow =
  | { kind: 'rollup'; key: string; id: string; level: 'investment-request' | 'pm-node'; depth: number; expanded: boolean; height: number }
  | { kind: 'deliverable'; key: string; id: string; depth: number; expanded: boolean; height: number }
  | { kind: 'outcome'; key: string; id: string; deliverableId: string; depth: number; storyCount: number; height: number }
  | { kind: 'milestones'; key: string; deliverableId: string; depth: number; height: number }
  | { kind: 'story-group'; key: string; deliverableId: string; label: 'unmapped'; depth: number; storyCount: number; height: number }
  | { kind: 'story'; key: string; id: string; deliverableId: string; depth: number; height: number };

export const ROW_HEIGHT = {
  'investment-request': 46,
  'pm-node': 40,
  deliverable: 46,
  outcome: 32,
  milestones: 34,
  'story-group': 28,
  story: 28,
} as const;

export interface RowOptions {
  expanded: ReadonlySet<string>;
  visibleDeliverables: ReadonlySet<string>;
  zoom: PlanZoom;
  /** Data sprint id shown at sprint zoom (stories scheduled in it are listed). */
  sprintId: string | null;
}

/** Flattened visible rows, following the hierarchy and the expanded set. */
export function buildRows(index: PlanIndex, opts: RowOptions): PlanRow[] {
  const rows: PlanRow[] = [];
  const visit = (span: PlanSpan, depth: number) => {
    const id = span.entity.id;
    if (span.level === 'deliverable') {
      if (!opts.visibleDeliverables.has(id)) return;
      const expanded = opts.expanded.has(id);
      rows.push({ kind: 'deliverable', key: id, id, depth, expanded, height: ROW_HEIGHT.deliverable });
      if (expanded) rows.push(...deliverableChildRows(index, id, depth + 1, opts));
      return;
    }
    const ids = index.descendants.get(id) ?? [];
    if (!ids.some((d) => opts.visibleDeliverables.has(d))) return;
    const level = span.level === 'investment-request' ? 'investment-request' : 'pm-node';
    const expanded = opts.expanded.has(id);
    rows.push({ kind: 'rollup', key: id, id, level, depth, expanded, height: ROW_HEIGHT[level] });
    if (expanded) for (const child of index.children.get(id) ?? []) visit(child, depth + 1);
  };
  for (const top of index.children.get(null) ?? []) visit(top, 0);
  return rows;
}

function deliverableChildRows(index: PlanIndex, deliverableId: string, depth: number, opts: RowOptions): PlanRow[] {
  const info = index.deliverables.get(deliverableId);
  if (!info) return [];
  const rows: PlanRow[] = [];
  const sprintStories = opts.zoom === 'sprint' && opts.sprintId ? info.stories.filter((s) => s.sprintId === opts.sprintId) : [];
  const byOutcome = new Map<string | null, WorkItem[]>();
  for (const s of sprintStories) {
    const k = s.outcomeId && info.outcomes.some((o) => o.id === s.outcomeId) ? s.outcomeId : null;
    const list = byOutcome.get(k);
    if (list) list.push(s);
    else byOutcome.set(k, [s]);
  }
  const storyRows = (items: WorkItem[], d: number): PlanRow[] =>
    [...items]
      .sort((a, b) => STATUS_ORDER[a.statusCategory] - STATUS_ORDER[b.statusCategory] || a.key.localeCompare(b.key, undefined, { numeric: true }))
      .map((s) => ({ kind: 'story', key: `${deliverableId}/st/${s.key}`, id: s.key, deliverableId, depth: d, height: ROW_HEIGHT.story }));

  for (const o of info.outcomes) {
    const items = byOutcome.get(o.id) ?? [];
    rows.push({ kind: 'outcome', key: `${deliverableId}/oc/${o.id}`, id: o.id, deliverableId, depth, storyCount: items.length, height: ROW_HEIGHT.outcome });
    rows.push(...storyRows(items, depth + 1));
  }
  const unmapped = byOutcome.get(null) ?? [];
  if (unmapped.length > 0) {
    rows.push({ kind: 'story-group', key: `${deliverableId}/unmapped`, deliverableId, label: 'unmapped', depth, storyCount: unmapped.length, height: ROW_HEIGHT['story-group'] });
    rows.push(...storyRows(unmapped, depth + 1));
  }
  if (info.milestones.length > 0) rows.push({ kind: 'milestones', key: `${deliverableId}/ms`, deliverableId, depth, height: ROW_HEIGHT.milestones });
  return rows;
}

const STATUS_ORDER = { 'in-progress': 0, 'to-do': 1, done: 2 } as const;

/** Top offset of each row and the total height. */
export function rowOffsets(rows: readonly { key: string; height: number }[]): { top: Map<string, number>; total: number } {
  const top = new Map<string, number>();
  let y = 0;
  for (const r of rows) {
    top.set(r.key, y);
    y += r.height;
  }
  return { top, total: y };
}

/** Default expansion: every rollup row open, the hero deliverable open. */
export function defaultExpanded(index: PlanIndex): Set<string> {
  const out = new Set<string>(index.descendants.keys());
  if (index.deliverables.has(HERO_DELIVERABLE_ID)) out.add(HERO_DELIVERABLE_ID);
  return out;
}

/** Rollup ancestors of a row id (to reveal a row). */
export function ancestorsOf(index: PlanIndex, id: string): string[] {
  const out: string[] = [];
  let cursor = index.spans.get(id)?.parentId ?? null;
  let guard = 0;
  while (cursor && guard++ < 20) {
    out.push(cursor);
    cursor = index.spans.get(cursor)?.parentId ?? null;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

export interface SpanGeometry {
  /** Unclipped fractions of the window; may fall outside 0..1 (clipped by the track). */
  left: number;
  width: number;
  visible: boolean;
  clippedStart: boolean;
  clippedEnd: boolean;
}

/**
 * Geometry of an inclusive span. Unclipped positions let bars glide in and out
 * when the window changes; `visible` and the clip flags come from `barSpan`.
 */
export function spanGeometry(window: Pick<PlanWindow, 'start' | 'end'>, start: IsoDate, end: IsoDate): SpanGeometry {
  const from = start <= end ? start : end;
  const to = start <= end ? end : start;
  const g = barSpan(window, from, to);
  const left = datePosition(window, from);
  const right = datePosition(window, addDays(to, 1));
  return { left, width: Math.max(right - left, 0), visible: g.visible, clippedStart: g.clippedStart, clippedEnd: g.clippedEnd };
}

/** Centre of a day as a fraction of the window. */
export function dayCentre(window: Pick<PlanWindow, 'start' | 'end'>, date: IsoDate): number {
  return datePosition(window, date) + 0.5 / windowDays(window);
}

/** Minimum canvas width per zoom so labels stay legible; narrower containers scroll horizontally. */
export const MIN_CANVAS: Record<PlanZoom, number> = { year: 1080, quarter: 1040, month: 1180, sprint: 1120 };

export function canvasWidth(zoom: PlanZoom, available: number): number {
  return Math.max(MIN_CANVAS[zoom], Math.floor(available));
}

// ---------------------------------------------------------------------------
// Header ticks
// ---------------------------------------------------------------------------

/** Contiguous sprints covering start..end (from the data, or two-week blocks without it). */
export function sprintBand(start: IsoDate, end: IsoDate, sprints: readonly Sprint[], today: IsoDate): PlanTick[] {
  const out: PlanTick[] = [];
  let cursor = start;
  let guard = 0;
  while (cursor <= end && guard++ < 200) {
    const s = sprintFor(cursor, sprints);
    out.push({ start: s.start, end: s.end, label: s.label, current: today >= s.start && today <= s.end });
    cursor = addDays(s.end, 1);
  }
  return out;
}

export interface HeaderTiers {
  /** Coarse ticks (labelled bands). */
  top: PlanTick[];
  /** Fine ticks (grid lines). */
  bottom: PlanTick[];
  bottomKind: 'month' | 'sprint' | 'day';
}

/**
 * Header ticks for a window plus one window either side, so stepping slides
 * them rather than swapping them. year: quarters / months; quarter: months /
 * sprints; month: sprints / days; sprint: the sprint / days.
 */
export function headerTiers(window: PlanWindow, clock: DemoClock, sprints: readonly Sprint[]): HeaderTiers {
  const prev = planWindow(window.zoom, clock, sprints, stepWindow(window, -1, sprints));
  const next = planWindow(window.zoom, clock, sprints, stepWindow(window, 1, sprints));
  const s = prev.start;
  const e = next.end;
  switch (window.zoom) {
    case 'year':
      return { top: planTimeline('year', s, e, clock, sprints).ticks, bottom: planTimeline('quarter', s, e, clock, sprints).ticks, bottomKind: 'month' };
    case 'quarter':
      return { top: planTimeline('quarter', s, e, clock, sprints).ticks, bottom: sprintBand(s, e, sprints, clock.today), bottomKind: 'sprint' };
    case 'month':
      return { top: sprintBand(s, e, sprints, clock.today), bottom: planTimeline('sprint', s, e, clock, sprints).ticks, bottomKind: 'day' };
    case 'sprint':
      return { top: sprintBand(s, e, sprints, clock.today), bottom: planTimeline('sprint', s, e, clock, sprints).ticks, bottomKind: 'day' };
  }
}

export function isWeekend(tick: PlanTick): boolean {
  return tick.label.startsWith('Sat') || tick.label.startsWith('Sun');
}

// ---------------------------------------------------------------------------
// Window summary
// ---------------------------------------------------------------------------

export interface WindowSummary {
  /** Deliverables whose planned end falls in the window. */
  deliverablesDue: string[];
  /** Milestones not yet met dated in the window. */
  milestonesDue: string[];
  commitments: number;
  /** Deliverables due in the window whose projected end is later than planned. */
  slippingDeliverables: string[];
  /** Milestones due in the window that are missed or pushed by a dependency delay. */
  slippingMilestones: string[];
  /** Of the slipping deliverables, those whose projected end leaves the window. */
  leavingWindow: string[];
  regulatoryAtRisk: string[];
  /** Late or blocked dependencies needed by the window end for work still active in it. */
  lateDependencies: string[];
  worstLateDays: number;
}

export function windowSummary(index: PlanIndex, window: Pick<PlanWindow, 'start' | 'end'>, visibleDeliverables: ReadonlySet<string>, clock: DemoClock): WindowSummary {
  const deliverablesDue: string[] = [];
  const slippingDeliverables: string[] = [];
  const leavingWindow: string[] = [];
  const milestonesDue: string[] = [];
  const slippingMilestones: string[] = [];
  const regulatoryAtRisk: string[] = [];
  for (const id of visibleDeliverables) {
    const info = index.deliverables.get(id);
    if (!info) continue;
    if (inWindow(info.deliverable.plannedEnd, window)) {
      deliverablesDue.push(id);
      if (info.projectedSlipDays > 0) {
        slippingDeliverables.push(id);
        if (info.projectedEnd > window.end) leavingWindow.push(id);
      }
    }
    for (const m of info.milestones) {
      if (m.status === 'met' || !inWindow(m.date, window)) continue;
      milestonesDue.push(m.id);
      const atRisk = milestoneRisk(index, m, clock) !== null;
      if (m.status === 'missed' || index.shiftedMilestones.has(m.id)) slippingMilestones.push(m.id);
      if (m.regulatory && atRisk) regulatoryAtRisk.push(m.id);
    }
  }
  const lateDependencies: string[] = [];
  let worstLateDays = 0;
  for (const dep of index.troubled) {
    if (!visibleDeliverables.has(dep.toDeliverableId) && !visibleDeliverables.has(dep.fromDeliverableId)) continue;
    const receiver = index.deliverables.get(dep.toDeliverableId);
    if (!receiver) continue;
    if (dep.needBy > window.end || receiver.deliverable.plannedEnd < window.start) continue;
    lateDependencies.push(dep.id);
    worstLateDays = Math.max(worstLateDays, index.knockOnByDependency.get(dep.id)?.lateDays ?? 0);
  }
  return {
    deliverablesDue,
    milestonesDue,
    commitments: deliverablesDue.length + milestonesDue.length,
    slippingDeliverables,
    slippingMilestones,
    leavingWindow,
    regulatoryAtRisk,
    lateDependencies,
    worstLateDays,
  };
}

export type MilestoneRisk = 'missed' | 'shifted' | 'r1' | 'overdue';

/** Why a milestone is flagged, or null. Missed and knock-on shifts first, then rule R1. */
export function milestoneRisk(index: PlanIndex, m: Milestone, clock: DemoClock): MilestoneRisk | null {
  if (m.status === 'missed') return 'missed';
  if (m.status === 'met') return null;
  if (m.date < clock.today) return 'overdue';
  if (index.shiftedMilestones.has(m.id)) return 'shifted';
  if (index.r1MilestoneIds.has(m.id)) return 'r1';
  return null;
}

/** Story bar span inside a sprint: from when it entered the sprint to when it closed or is due. */
export function storySpan(item: WorkItem, sprint: { start: IsoDate; end: IsoDate }): { start: IsoDate; end: IsoDate } {
  const created = item.created.slice(0, 10);
  const start = later(sprint.start, created);
  const endCandidate = item.resolved ? item.resolved.slice(0, 10) : item.due && item.due <= sprint.end ? item.due : sprint.end;
  const end = endCandidate < start ? start : endCandidate;
  return { start: start > sprint.end ? sprint.end : start, end: end > sprint.end ? sprint.end : end };
}

/** "+9 days", "−3 days", "On plan". */
export function slipText(days: number): string {
  if (days === 0) return 'On plan';
  const abs = Math.abs(days).toLocaleString('en-GB');
  return `${days > 0 ? '+' : '−'}${abs} ${Math.abs(days) === 1 ? 'day' : 'days'}`;
}

/** Compact "+9d". */
export function slipShort(days: number): string {
  return `${days > 0 ? '+' : '−'}${Math.abs(days).toLocaleString('en-GB')}d`;
}
