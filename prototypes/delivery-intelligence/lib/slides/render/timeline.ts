/**
 * Timeline geometry shared by both renderers: positions as fractions (0..1) of
 * the window, month ticks, and per-row bar spans. Pure date arithmetic on ISO
 * strings via the clock helpers; no wall clock involved.
 */
import type { IsoDate } from '@/lib/types';
import type { Block, TimelineRow } from '@/lib/slides/types';
import { daysBetween } from '@/lib/config/clock';
import { MONTHS_SHORT } from './theme';

type TimelineBlock = Extract<Block, { type: 'timeline' }>;

export interface MonthTick {
  date: IsoDate;
  at: number;
  label: string;
}

export interface RowGeometry {
  row: TimelineRow;
  start: number;
  end: number;
  /** Fraction where the projected end sits, when it is later than the planned end. */
  projectedEnd?: number;
  /** Fraction where a projected end earlier than plan sits (drawn as a marker only). */
  earlyEnd?: number;
  completion: number;
  milestones: { at: number; label: string; regulatory: boolean; tone?: TimelineRow['tone'] }[];
}

export interface TimelineGeometry {
  ticks: MonthTick[];
  /** Fraction of today, or null when today is outside the window. */
  today: number | null;
  rows: RowGeometry[];
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function timelineGeometry(block: TimelineBlock): TimelineGeometry {
  const { start, end } = block.window;
  const span = Math.max(1, daysBetween(start, end));
  const raw = (d: IsoDate) => daysBetween(start, d) / span;
  const at = (d: IsoDate) => clamp01(raw(d));

  const ticks: MonthTick[] = [];
  let y = Number(start.slice(0, 4));
  let m = Number(start.slice(5, 7)) - 1;
  if (Number(start.slice(8, 10)) > 1) m += 1;
  for (let guard = 0; guard < 120; guard++) {
    if (m > 11) {
      m = 0;
      y += 1;
    }
    const date = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    if (date > end) break;
    ticks.push({ date, at: at(date), label: `${MONTHS_SHORT[m]} ${String(y).slice(2)}` });
    m += 1;
  }

  const t = raw(block.today);
  const rows = block.rows.map((row): RowGeometry => {
    const s = at(row.plannedStart);
    const e = Math.max(s, at(row.plannedEnd));
    const p = row.projectedEnd ? at(row.projectedEnd) : undefined;
    return {
      row,
      start: s,
      end: e,
      projectedEnd: p !== undefined && p > e ? p : undefined,
      earlyEnd: p !== undefined && p < e ? p : undefined,
      completion: clamp01(row.completion ?? 0),
      milestones: (row.milestones ?? []).map((ms) => ({ at: at(ms.date), label: ms.label, regulatory: ms.regulatory, tone: ms.tone })),
    };
  });

  return { ticks, today: t >= 0 && t <= 1 ? t : null, rows };
}

/** Width of the label column at the left of a timeline, inches. */
export const TIMELINE_LABEL_W = 2.3;
/** Height of the month axis band at the top of a timeline, inches. */
export const TIMELINE_AXIS_H = 0.36;
/** Row height bounds, inches. */
export const TIMELINE_ROW_MAX_H = 0.78;
export const TIMELINE_ROW_MIN_H = 0.45;

export interface RowLabel {
  /** Where the label would like to start (inches, same origin as minX/maxX). */
  anchor: number;
  text: string;
  /** Placed before the others (e.g. a knock-on note), so it is never the one left out. */
  priority?: boolean;
}

/** Height of one label line at 11 pt, inches. */
export const TIMELINE_LABEL_LINE_H = 0.19;

export interface LabelSpot {
  x: number;
  w: number;
  /** 0 for the first line under the bar, 1 for the second. */
  line: number;
}

/**
 * Places a row's labels on up to `lines` lines without overlapping. Priority
 * labels go first, then the rest from left to right; each takes the first free
 * spot at or after its anchor (or pulled left to stay inside `maxX`). A label
 * that fits on no line is left out (null) rather than drawn over another; the
 * caller warns. Widths are estimated for 11 pt Arial.
 */
export function placeRowLabels(labels: readonly RowLabel[], minX: number, maxX: number, lines = 1): (LabelSpot | null)[] {
  const order = labels
    .map((l, i) => ({ ...l, i }))
    .sort((a, b) => Number(Boolean(b.priority)) - Number(Boolean(a.priority)) || a.anchor - b.anchor);
  const out: (LabelSpot | null)[] = new Array(labels.length).fill(null);
  const taken: { x: number; end: number }[][] = Array.from({ length: Math.max(1, lines) }, () => []);
  const GAP = 0.12;
  const free = (line: number, x: number, w: number) => taken[line]!.every((t) => x + w + GAP <= t.x || x >= t.end + GAP);
  for (const l of order) {
    const w = (l.text.length * 0.54 * 11) / 72 + 0.08;
    for (let line = 0; line < taken.length && out[l.i] === null; line++) {
      const starts = [l.anchor, ...taken[line]!.map((t) => t.end + GAP).filter((x) => x >= l.anchor), maxX - w];
      for (const x of starts.map((v) => Math.max(minX, Math.min(v, maxX - w))).sort((a, b) => Math.abs(a - l.anchor) - Math.abs(b - l.anchor))) {
        if (x + w <= maxX + 0.01 && free(line, x, w)) {
          out[l.i] = { x, w, line };
          taken[line]!.push({ x, end: x + w });
          break;
        }
      }
    }
  }
  return out;
}
