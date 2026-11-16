import type { DemoClock, IsoDate, IsoDateTime } from '@/lib/types';

/**
 * The demo clock is fixed so every screen shows the same thing on every run.
 * Never call `new Date()` for business logic: take a `DemoClock` parameter, or
 * read it from the store with `useClock()`.
 */
export const DEMO_TODAY: IsoDate = '2027-03-08';

export const DEMO_CLOCK: DemoClock = Object.freeze({
  today: DEMO_TODAY,
  now: '2027-03-08T09:00:00.000Z',
  timeZone: 'UTC',
});

const DAY_MS = 86_400_000;

/** Whole days from `a` to `b` (positive when b is later). Accepts dates or timestamps. */
export function daysBetween(a: IsoDate | IsoDateTime, b: IsoDate | IsoDateTime): number {
  return Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / DAY_MS);
}

/** `date` plus `days` (may be negative), as an ISO date. */
export function addDays(date: IsoDate, days: number): IsoDate {
  return new Date(Date.parse(date.slice(0, 10)) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Three-letter month names. Fixed here so every runtime prints "Sep", never "Sept". */
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Formats an ISO date for display, e.g. "8 Mar 2027" (UTC).
 * Built by hand rather than through the locale API so the server render and
 * every browser produce identical text.
 */
export function formatDate(date: IsoDate | IsoDateTime, opts: { withYear?: boolean } = {}): string {
  const d = new Date(date.length === 10 ? `${date}T00:00:00Z` : date);
  const dayAndMonth = `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
  return opts.withYear === false ? dayAndMonth : `${dayAndMonth} ${d.getUTCFullYear()}`;
}
