/**
 * Plan model: one span per row, following the hierarchy (investment request,
 * PM nodes, deliverables, Epics), with planned and forecast ends, late incoming
 * dependencies and milestones. Also the knock-on of late dependencies on the
 * receiving deliverables.
 */
import type { Dependency, IsoDate, Milestone, PlanModel, PlanSpan, PmNode, WorkItem } from '@/lib/types';
import { isStoryLevel, type EngineContext } from './context';
import { dependencyLateDays, isDependencyOpen, isDependencyTroubled } from './dependencies';
import { forecastEnd, type Forecast } from './forecast';
import { date, days, quote } from './messages';
import { addDaysTo, dayDiff, unique } from './util';

const maxDate = (dates: IsoDate[], fallback: IsoDate) => dates.reduce((a, b) => (b > a ? b : a), dates[0] ?? fallback);
const minDate = (dates: IsoDate[], fallback: IsoDate) => dates.reduce((a, b) => (b < a ? b : a), dates[0] ?? fallback);

/** Forecast per deliverable id (story-level work across all its Epics). */
export function deliverableForecasts(ctx: EngineContext): Map<string, Forecast> {
  const out = new Map<string, Forecast>();
  for (const d of ctx.data.deliverables) out.set(d.id, forecastEnd(ctx.storiesByDeliverable.get(d.id) ?? [], d.plannedEnd, ctx.clock, d.plannedStart));
  return out;
}

export interface KnockOn {
  dependencyId: string;
  providerId: string;
  receiverId: string;
  /** Days past need-by (expected arrival is the later of the committed date and today). */
  lateDays: number;
  blocked: boolean;
  /** Receiver's planned end and the end it would have if the delay passes straight through. */
  receiverPlannedEnd: IsoDate;
  receiverEndWithDelay: IsoDate;
  /** Receiver milestones on or after need-by that the delay pushes, with the date they move to. */
  affectedMilestones: { milestoneId: string; date: IsoDate; shiftedTo: IsoDate; regulatory: boolean }[];
  /** Open dependencies the receiver provides to others: where the delay may travel next. */
  downstreamDependencyIds: string[];
  explanation: string;
}

/**
 * Knock-on of each open late or blocked dependency on its receiver. Transparent
 * rule: the receiver's remaining dated commitments after need-by move by the
 * number of days the input is late. One level deep; downstream dependencies
 * are listed, not chained.
 */
export function dependencyKnockOn(ctx: EngineContext): KnockOn[] {
  const out: KnockOn[] = [];
  for (const dep of ctx.data.dependencies) {
    if (!isDependencyTroubled(dep, ctx.clock)) continue;
    const receiver = ctx.idx.deliverables.get(dep.toDeliverableId);
    if (!receiver) continue;
    const late = dependencyLateDays(dep, ctx.clock);
    const affected = (ctx.milestonesByDeliverable.get(receiver.id) ?? [])
      .filter((m: Milestone) => m.status === 'planned' && m.date >= dep.needBy)
      .map((m) => ({ milestoneId: m.id, date: m.date, shiftedTo: addDaysTo(m.date, late), regulatory: m.regulatory }));
    const downstream = (ctx.dependenciesFrom.get(receiver.id) ?? []).filter(isDependencyOpen).map((x) => x.id);
    const endWithDelay = addDaysTo(receiver.plannedEnd, late);
    out.push({
      dependencyId: dep.id,
      providerId: dep.fromDeliverableId,
      receiverId: receiver.id,
      lateDays: late,
      blocked: dep.status === 'blocked',
      receiverPlannedEnd: receiver.plannedEnd,
      receiverEndWithDelay: endWithDelay,
      affectedMilestones: affected,
      downstreamDependencyIds: downstream,
      explanation:
        `${quote(dep.title)} is ${dep.status === 'blocked' ? 'blocked' : `${days(late)} late`} for ${receiver.ref}; ` +
        (late > 0
          ? `passing the delay through moves its planned end from ${date(receiver.plannedEnd)} to ${date(endWithDelay)}` +
            (affected.length > 0 ? ` and ${affected.length} milestone${affected.length === 1 ? '' : 's'} with it.` : '.')
          : 'no committed date yet, so the knock-on cannot be sized.'),
    });
  }
  return out;
}

function lateInto(ctx: EngineContext, deliverableId: string): Dependency[] {
  return (ctx.dependenciesInto.get(deliverableId) ?? []).filter((d) => isDependencyTroubled(d, ctx.clock));
}

export function buildPlan(ctx: EngineContext, forecasts: Map<string, Forecast>): PlanModel {
  const spans: PlanSpan[] = [];
  const { data, idx } = ctx;

  const deliverableSpan = (id: string, parentId: string): PlanSpan | null => {
    const d = idx.deliverables.get(id);
    if (!d) return null;
    const f = forecasts.get(id);
    const fEnd = f?.forecastEnd ?? d.plannedEnd;
    return {
      entity: { kind: 'deliverable', id: d.id },
      level: 'deliverable',
      parentId,
      label: `${d.ref} ${d.title}`,
      plannedStart: d.plannedStart,
      plannedEnd: d.plannedEnd,
      forecastEnd: fEnd,
      slipDays: dayDiff(d.plannedEnd, fEnd),
      lateDependencyIds: lateInto(ctx, d.id).map((x) => x.id),
      milestoneIds: (ctx.milestonesByDeliverable.get(d.id) ?? []).map((m) => m.id),
    };
  };

  const epicSpans = (deliverableId: string): PlanSpan[] => {
    const d = idx.deliverables.get(deliverableId);
    if (!d) return [];
    return (ctx.epicsByDeliverable.get(deliverableId) ?? []).map((key) => {
      const epic = idx.workItems.get(key);
      const start = epic?.startDate ?? d.plannedStart;
      const end = epic?.targetDate ?? d.plannedEnd;
      const stories = (ctx.childrenOf.get(key) ?? []).filter((w: WorkItem) => isStoryLevel(w));
      const f = forecastEnd(stories, end, ctx.clock, start);
      return {
        entity: { kind: 'work-item', id: key },
        level: 'epic',
        parentId: deliverableId,
        label: epic ? `${key} ${epic.summary}` : key,
        plannedStart: start,
        plannedEnd: end,
        forecastEnd: f.forecastEnd,
        slipDays: f.slipDays,
        lateDependencyIds: [],
        milestoneIds: [],
      };
    });
  };

  /** Adds a deliverable row and its Epics; returns the deliverable span. */
  const addDeliverable = (id: string, parentId: string): PlanSpan | null => {
    const span = deliverableSpan(id, parentId);
    if (!span) return null;
    spans.push(span);
    spans.push(...epicSpans(id));
    return span;
  };

  const directDeliverables = (nodeId: string) => data.deliverables.filter((d) => d.pmNodeId === nodeId).map((d) => d.id);

  /** Adds a PM node, its children and deliverables; returns the node span. */
  const addNode = (node: PmNode, parentId: string, seen: Set<string>): PlanSpan | null => {
    if (seen.has(node.id)) return null;
    seen.add(node.id);
    const at = spans.length;
    const childSpans: PlanSpan[] = [];
    for (const child of ctx.pmChildren.get(node.id) ?? []) {
      const s = addNode(child, node.id, seen);
      if (s) childSpans.push(s);
    }
    for (const id of directDeliverables(node.id)) {
      const s = addDeliverable(id, node.id);
      if (s) childSpans.push(s);
    }
    const fEnd = maxDate([node.plannedEnd, ...childSpans.map((s) => s.forecastEnd)], node.plannedEnd);
    const span: PlanSpan = {
      entity: { kind: 'pm-node', id: node.id },
      level: 'pm-node',
      parentId,
      label: node.title,
      plannedStart: node.plannedStart,
      plannedEnd: node.plannedEnd,
      forecastEnd: fEnd,
      slipDays: dayDiff(node.plannedEnd, fEnd),
      lateDependencyIds: unique(childSpans.flatMap((s) => s.lateDependencyIds)),
      milestoneIds: [],
    };
    spans.splice(at, 0, span);
    return span;
  };

  const seen = new Set<string>();
  for (const ir of data.investmentRequests) {
    const at = spans.length;
    const childSpans: PlanSpan[] = [];
    const topNodes = (ctx.pmChildren.get(null) ?? []).filter((n) => n.investmentRequestId === ir.id);
    for (const n of topNodes) {
      const s = addNode(n, ir.id, seen);
      if (s) childSpans.push(s);
    }
    for (const d of data.deliverables) {
      if (d.investmentRequestId !== ir.id) continue;
      if (d.pmNodeId && idx.pmNodes.has(d.pmNodeId)) continue;
      const s = addDeliverable(d.id, ir.id);
      if (s) childSpans.push(s);
    }
    if (childSpans.length === 0) continue;
    const plannedStart = minDate(childSpans.map((s) => s.plannedStart), ctx.clock.today);
    const plannedEnd = maxDate(childSpans.map((s) => s.plannedEnd), ctx.clock.today);
    const fEnd = maxDate(childSpans.map((s) => s.forecastEnd), plannedEnd);
    spans.splice(at, 0, {
      entity: { kind: 'investment-request', id: ir.id },
      level: 'investment-request',
      parentId: null,
      label: `${ir.ref} ${ir.title}`,
      plannedStart,
      plannedEnd,
      forecastEnd: fEnd,
      slipDays: dayDiff(plannedEnd, fEnd),
      lateDependencyIds: unique(childSpans.flatMap((s) => s.lateDependencyIds)),
      milestoneIds: [],
    });
  }

  const starts = spans.map((s) => s.plannedStart);
  const ends = spans.flatMap((s) => [s.plannedEnd, s.forecastEnd]);
  return {
    spans,
    today: ctx.clock.today,
    start: minDate(starts, ctx.clock.today),
    end: maxDate(ends, ctx.clock.today),
    lateDependencyIds: data.dependencies.filter((d) => isDependencyTroubled(d, ctx.clock)).map((d) => d.id),
  };
}
