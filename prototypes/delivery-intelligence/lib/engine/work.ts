/**
 * Measure 1, work completion: closed points / total points over story-level
 * items. For a deliverable, across all of its Epics; for an outcome, across the
 * items carrying its Outcome ID (which may sit under several Epics).
 * Independent of acceptance and readiness.
 */
import type { Computable, WorkCompletion, WorkItem } from '@/lib/types';
import type { EngineContext } from './context';
import { computable, notComputable, toPercent, unique } from './util';

export function isClosed(item: WorkItem): boolean {
  return item.statusCategory === 'done';
}

/** Work completion over a set of story-level items. `epicKeys` lists the Epics that contributed. */
export function workCompletionOf(items: readonly WorkItem[], epicKeys: string[]): Computable<WorkCompletion> {
  if (items.length === 0) return notComputable('no-linked-work', 'No story-level work is linked.');
  let closedPoints = 0;
  let totalPoints = 0;
  let closedItemCount = 0;
  let unestimatedItemCount = 0;
  for (const item of items) {
    const closed = isClosed(item);
    if (closed) closedItemCount++;
    if (item.points === null || item.points === undefined || !Number.isFinite(item.points)) {
      unestimatedItemCount++;
      continue;
    }
    const points = Math.max(0, item.points);
    totalPoints += points;
    if (closed) closedPoints += points;
  }
  if (totalPoints === 0) {
    return notComputable('no-points', `${items.length} linked item${items.length === 1 ? ' has' : 's have'} no story points.`);
  }
  const ratio = closedPoints / totalPoints;
  return computable({
    closedPoints,
    totalPoints,
    ratio,
    percent: toPercent(ratio),
    itemCount: items.length,
    closedItemCount,
    unestimatedItemCount,
    epicKeys,
  });
}

export function deliverableWorkCompletion(ctx: EngineContext, deliverableId: string): Computable<WorkCompletion> {
  return workCompletionOf(ctx.storiesByDeliverable.get(deliverableId) ?? [], ctx.epicsByDeliverable.get(deliverableId) ?? []);
}

/** Epics an outcome's items sit under (several when an outcome draws from more than one Epic). */
export function outcomeEpicKeys(items: readonly WorkItem[]): string[] {
  return unique(items.map((i) => i.epicKey ?? i.parentKey).filter((k): k is string => k !== null)).sort();
}

export function outcomeWorkCompletion(ctx: EngineContext, outcomeId: string): Computable<WorkCompletion> {
  const items = ctx.storiesByOutcome.get(outcomeId) ?? [];
  return workCompletionOf(items, outcomeEpicKeys(items));
}

/** Sums several work-completion figures (roll-ups). Not computable when none contributes points. */
export function sumWorkCompletion(parts: Computable<WorkCompletion>[], emptyDetail: string): Computable<WorkCompletion> {
  let closedPoints = 0;
  let totalPoints = 0;
  let itemCount = 0;
  let closedItemCount = 0;
  let unestimatedItemCount = 0;
  const epicKeys: string[] = [];
  for (const p of parts) {
    if (!p.computable) continue;
    closedPoints += p.value.closedPoints;
    totalPoints += p.value.totalPoints;
    itemCount += p.value.itemCount;
    closedItemCount += p.value.closedItemCount;
    unestimatedItemCount += p.value.unestimatedItemCount;
    epicKeys.push(...p.value.epicKeys);
  }
  if (totalPoints === 0) return notComputable(itemCount === 0 ? 'no-linked-work' : 'no-points', emptyDetail);
  const ratio = closedPoints / totalPoints;
  return computable({ closedPoints, totalPoints, ratio, percent: toPercent(ratio), itemCount, closedItemCount, unestimatedItemCount, epicKeys });
}
