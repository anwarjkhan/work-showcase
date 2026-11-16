/**
 * Wording helpers for findings and reasons. Messages are written for a senior
 * reader: plain, specific, with the numbers. System, level and status names
 * come from terminology, never typed here.
 */
import { formatDate } from '@/lib/config/clock';
import { terms } from '@/lib/config/terminology';
import type { EvidenceKind, IsoDate, IsoDateTime, WorkItem } from '@/lib/types';

export const portfolioSystem = (): string => terms.systems['portfolio-system'];
export const workTracker = (): string => terms.systems['work-tracker'];

/** Lower-cases the first letter of a generic label for use mid-sentence. */
export function lowerFirst(label: string): string {
  return label.length > 0 ? label.charAt(0).toLowerCase() + label.slice(1) : label;
}

export function quote(text: string): string {
  return `“${text}”`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function days(n: number): string {
  return plural(Math.abs(n), 'day');
}

export function pct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export function date(d: IsoDate | IsoDateTime): string {
  return formatDate(d);
}

export function evidenceKindLabel(kind: EvidenceKind, midSentence = true): string {
  const label = terms.evidenceKinds[kind];
  return midSentence ? lowerFirst(label) : label;
}

/** "CCR-301 “Stressed market-data extract”". */
export function itemLabel(item: Pick<WorkItem, 'key' | 'summary'>): string {
  return item.summary ? `${item.key} ${quote(item.summary)}` : item.key;
}

/** Joins phrases as "a, b and c". */
export function listPhrases(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** "in 9 days", "today", "9 days ago". */
export function relativeDays(n: number): string {
  if (n === 0) return 'today';
  return n > 0 ? `in ${days(n)}` : `${days(n)} ago`;
}
