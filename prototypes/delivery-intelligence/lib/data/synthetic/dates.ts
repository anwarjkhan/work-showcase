import { addDays, daysBetween, DEMO_TODAY } from '@/lib/config/clock';
import type { IsoDate, IsoDateTime } from '@/lib/types';
import type { Rng } from './random';

/** The demo clock's date. Everything is generated relative to it. */
export const TODAY: IsoDate = DEMO_TODAY;

/** First sprint of 2027 starts on a Monday. Sprints are two weeks, 26 of them. */
export const SPRINT_START: IsoDate = '2027-01-04';
export const SPRINT_COUNT = 26;

const pad = (n: number): string => String(n).padStart(2, '0');

export function stamp(date: IsoDate, hour: number, minute = 0): IsoDateTime {
  return `${date}T${pad(hour)}:${pad(minute)}:00.000Z`;
}

/** A working-hours timestamp on `date`, with the time of day drawn from the stream. */
export function stampOn(date: IsoDate, rng: Rng): IsoDateTime {
  return stamp(date, rng.int(8, 17), rng.int(0, 59));
}

export function minDate(a: IsoDate, b: IsoDate): IsoDate {
  return a <= b ? a : b;
}

export function maxDate(a: IsoDate, b: IsoDate): IsoDate {
  return a >= b ? a : b;
}

export function clampDate(date: IsoDate, lo: IsoDate, hi: IsoDate): IsoDate {
  return maxDate(lo, minDate(date, hi));
}

/** Date part of a timestamp. */
export function dateOf(value: IsoDate | IsoDateTime): IsoDate {
  return value.slice(0, 10);
}

export function sprintIndexFor(date: IsoDate): number {
  const index = Math.floor(daysBetween(SPRINT_START, date) / 14);
  return Math.max(0, Math.min(SPRINT_COUNT - 1, index));
}

export function sprintIdForIndex(index: number): string {
  return `spr-2027-${pad(index + 1)}`;
}

export function sprintIdFor(date: IsoDate): string {
  return sprintIdForIndex(sprintIndexFor(date));
}

export function sprintEnd(index: number): IsoDate {
  return addDays(SPRINT_START, index * 14 + 13);
}

export function sprintStart(index: number): IsoDate {
  return addDays(SPRINT_START, index * 14);
}

/** Date at fraction `u` (0..1) of the window `[start, end]`. */
export function dateAtFraction(start: IsoDate, end: IsoDate, u: number): IsoDate {
  return addDays(start, Math.round(daysBetween(start, end) * u));
}

export { addDays, daysBetween };
