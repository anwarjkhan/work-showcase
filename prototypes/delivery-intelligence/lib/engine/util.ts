/**
 * Small pure helpers shared by the engine: timestamp maths, severity and RAG
 * ordering, and computable wrappers. No clock, no globals.
 */
import type { Computable, EvidenceRagStatus, IsoDate, IsoDateTime, NotComputableReason, Severity } from '@/lib/types';

const DAY_MS = 86_400_000;

/** Milliseconds for an ISO date or timestamp (dates are read as UTC midnight). */
export function toMs(value: IsoDate | IsoDateTime): number {
  return Date.parse(value.length === 10 ? `${value}T00:00:00Z` : value);
}

/** The ISO date part of a date or timestamp. */
export function toDate(value: IsoDate | IsoDateTime): IsoDate {
  return value.slice(0, 10);
}

/** ISO date for a millisecond value. */
export function msToDate(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Whole calendar days from `a` to `b` (positive when `b` is later). */
export function dayDiff(a: IsoDate | IsoDateTime, b: IsoDate | IsoDateTime): number {
  return Math.round((toMs(toDate(b)) - toMs(toDate(a))) / DAY_MS);
}

export function addDaysTo(date: IsoDate, days: number): IsoDate {
  return msToDate(toMs(toDate(date)) + days * DAY_MS);
}

/** Later of two timestamps (null-safe). */
export function laterOf<T extends string | null>(a: T, b: T): T {
  if (a === null) return b;
  if (b === null) return a;
  return toMs(a) >= toMs(b) ? a : b;
}

export const SEVERITY_RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };
export const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low'];

/** Higher is worse. Unknown sits between Amber and Green: never Green without data. */
export const RAG_RANK: Record<EvidenceRagStatus, number> = { red: 3, amber: 2, unknown: 1, green: 0 };

export function computable<T>(value: T): Computable<T> {
  return { computable: true, value };
}

export function notComputable<T>(reason: NotComputableReason, detail: string): Computable<T> {
  return { computable: false, reason, detail };
}

/** Rounds a 0..1 ratio to an integer percentage. */
export function toPercent(ratio: number): number {
  return Math.round(ratio * 100);
}

/** Stable unique list, first occurrence wins. */
export function unique<T>(items: Iterable<T>): T[] {
  return [...new Set(items)];
}

/** Natural compare for ids such as "CCR-9" and "CCR-10". */
export function compareIds(a: string, b: string): number {
  return a.localeCompare(b, 'en', { numeric: true });
}
