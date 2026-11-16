/**
 * Plan time windows and bar geometry for the four zoom levels.
 *   year     one calendar year, ticks are quarters ("Q1 2027")
 *   quarter  one calendar quarter, ticks are months ("Mar")
 *   month    one calendar month, ticks are the two-week sprints overlapping it ("S05"), clipped
 *   sprint   one two-week sprint, ticks are days ("Mon 8")
 * Sprints come from the data; without them, two-week blocks are aligned to the
 * Monday of ISO week 1. Positions are fractions of the window (0..1), whole days.
 */
import type { DemoClock, IsoDate, PlanTick, PlanWindow, PlanZoom, Sprint } from '@/lib/types';
import { addDaysTo, dayDiff, msToDate, toMs } from './util';

export const PLAN_ZOOMS: PlanZoom[] = ['year', 'quarter', 'month', 'sprint'];
const SPRINT_DAYS = 14;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function ymd(date: IsoDate): { y: number; m: number; d: number } {
  return { y: Number(date.slice(0, 4)), m: Number(date.slice(5, 7)) - 1, d: Number(date.slice(8, 10)) };
}

function utc(y: number, m: number, d: number): IsoDate {
  return msToDate(Date.UTC(y, m, d));
}

const inRange = (date: IsoDate, start: IsoDate, end: IsoDate) => date >= start && date <= end;

/** Monday of ISO week 1 of `year` (the week containing 4 January). */
function isoWeekOneMonday(year: number): IsoDate {
  const jan4 = Date.UTC(year, 0, 4);
  const dow = (new Date(jan4).getUTCDay() + 6) % 7; // Monday = 0
  return msToDate(jan4 - dow * 86_400_000);
}

/** The sprint containing `date`, or a synthetic two-week block when the data has none. */
export function sprintFor(date: IsoDate, sprints: readonly Sprint[]): { start: IsoDate; end: IsoDate; label: string } {
  const hit = sprints.find((s) => inRange(date, s.start, s.end));
  if (hit) return { start: hit.start, end: hit.end, label: `S${String(hit.index).padStart(2, '0')}` };
  const reference = sprints[0]?.start ?? isoWeekOneMonday(ymd(date).y);
  const offset = Math.floor(dayDiff(reference, date) / SPRINT_DAYS) * SPRINT_DAYS;
  const start = addDaysTo(reference, offset);
  return { start, end: addDaysTo(start, SPRINT_DAYS - 1), label: `w/c ${Number(start.slice(8, 10))} ${MONTHS[ymd(start).m]}` };
}

function windowBounds(zoom: PlanZoom, anchor: IsoDate, sprints: readonly Sprint[]): { start: IsoDate; end: IsoDate } {
  const { y, m } = ymd(anchor);
  switch (zoom) {
    case 'year':
      return { start: utc(y, 0, 1), end: utc(y, 11, 31) };
    case 'quarter': {
      const q = Math.floor(m / 3) * 3;
      return { start: utc(y, q, 1), end: utc(y, q + 3, 0) };
    }
    case 'month':
      return { start: utc(y, m, 1), end: utc(y, m + 1, 0) };
    case 'sprint': {
      const s = sprintFor(anchor, sprints);
      return { start: s.start, end: s.end };
    }
  }
}

function ticksFor(zoom: PlanZoom, start: IsoDate, end: IsoDate, today: IsoDate, sprints: readonly Sprint[]): PlanTick[] {
  const ticks: PlanTick[] = [];
  const add = (s: IsoDate, e: IsoDate, label: string) => {
    const cs = s < start ? start : s;
    const ce = e > end ? end : e;
    if (cs <= ce) ticks.push({ start: cs, end: ce, label, current: inRange(today, cs, ce) });
  };
  let cursor = start;
  let guard = 0;
  while (cursor <= end && guard++ < 1000) {
    const { y, m, d } = ymd(cursor);
    let tickEnd: IsoDate;
    let label: string;
    if (zoom === 'year') {
      const q = Math.floor(m / 3);
      tickEnd = utc(y, q * 3 + 3, 0);
      label = `Q${q + 1} ${y}`;
    } else if (zoom === 'quarter') {
      tickEnd = utc(y, m + 1, 0);
      label = MONTHS[m] ?? '';
    } else if (zoom === 'month') {
      const s = sprintFor(cursor, sprints);
      tickEnd = s.end;
      label = s.label;
    } else {
      tickEnd = cursor;
      label = `${WEEKDAYS[new Date(toMs(cursor)).getUTCDay()]} ${d}`;
    }
    add(cursor, tickEnd, label);
    cursor = addDaysTo(tickEnd, 1);
  }
  return ticks;
}

/** The visible window for a zoom level around `anchor` (default: the demo clock's today). */
export function planWindow(zoom: PlanZoom, clock: DemoClock, sprints: readonly Sprint[] = [], anchor: IsoDate = clock.today): PlanWindow {
  const { start, end } = windowBounds(zoom, anchor, sprints);
  return { zoom, start, end, ticks: ticksFor(zoom, start, end, clock.today, sprints) };
}

/** Anchor of the window `steps` windows away (negative for earlier). */
export function stepWindow(window: PlanWindow, steps: number, sprints: readonly Sprint[] = []): IsoDate {
  const { y, m } = ymd(window.start);
  switch (window.zoom) {
    case 'year':
      return utc(y + steps, 0, 1);
    case 'quarter':
      return utc(y, m + steps * 3, 1);
    case 'month':
      return utc(y, m + steps, 1);
    case 'sprint': {
      let anchor = window.start;
      for (let i = 0; i < Math.abs(steps); i++) {
        anchor = steps > 0 ? addDaysTo(sprintFor(anchor, sprints).end, 1) : addDaysTo(sprintFor(anchor, sprints).start, -1);
      }
      return sprintFor(anchor, sprints).start;
    }
  }
}

/**
 * A continuous timeline at a zoom level covering `start`..`end`, made of whole
 * windows, for a horizontally scrolling plan.
 */
export function planTimeline(zoom: PlanZoom, start: IsoDate, end: IsoDate, clock: DemoClock, sprints: readonly Sprint[] = []): PlanWindow {
  const first = windowBounds(zoom, start, sprints);
  const last = windowBounds(zoom, end > start ? end : start, sprints);
  return { zoom, start: first.start, end: last.end, ticks: ticksFor(zoom, first.start, last.end, clock.today, sprints) };
}

export function windowDays(window: Pick<PlanWindow, 'start' | 'end'>): number {
  return dayDiff(window.start, window.end) + 1;
}

/** Fractional position (0 = window start, 1 = day after window end) of the start of `date`. */
export function datePosition(window: Pick<PlanWindow, 'start' | 'end'>, date: IsoDate): number {
  return dayDiff(window.start, date) / windowDays(window);
}

export interface BarGeometry {
  /** False when the bar lies wholly outside the window. */
  visible: boolean;
  /** Fraction of the window from its start to the bar's start (0..1). */
  left: number;
  /** Fraction of the window the bar covers (0..1). Inclusive of both end days. */
  width: number;
  /** The bar continues before or after the window (draw an open edge). */
  clippedStart: boolean;
  clippedEnd: boolean;
}

/** Geometry of a bar from `start` to `end` (inclusive) inside a window. */
export function barSpan(window: Pick<PlanWindow, 'start' | 'end'>, start: IsoDate, end: IsoDate): BarGeometry {
  const from = start <= end ? start : end;
  const to = start <= end ? end : start;
  if (to < window.start || from > window.end) return { visible: false, left: 0, width: 0, clippedStart: false, clippedEnd: false };
  const cs = from < window.start ? window.start : from;
  const ce = to > window.end ? window.end : to;
  const n = windowDays(window);
  return {
    visible: true,
    left: dayDiff(window.start, cs) / n,
    width: (dayDiff(cs, ce) + 1) / n,
    clippedStart: from < window.start,
    clippedEnd: to > window.end,
  };
}
