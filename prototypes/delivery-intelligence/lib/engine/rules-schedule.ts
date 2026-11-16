/**
 * Schedule rules.
 *   R1  Milestone due within the window with too little linked work closed.
 *   R3  Due date passed and item not closed.
 *   R5  Reported Green while a critical incoming dependency is blocked or late.
 *   R6  Dependency committed date falls after the receiver's need-by date.
 */
import { terms } from '@/lib/config/terminology';
import type { Finding, Milestone, WorkItem } from '@/lib/types';
import { RULE_THRESHOLDS } from './constants';
import { isEpic, isStoryLevel, type EngineContext } from './context';
import { dependencyLateDays, isDependencyOpen, isDependencyTroubled } from './dependencies';
import { date, days, itemLabel, lowerFirst, pct, plural, portfolioSystem, quote, relativeDays } from './messages';
import { finding, ref, type Rule } from './rule-kit';
import { dayDiff, unique } from './util';
import { isClosed } from './work';

/** Story-level work that counts towards a milestone. Empty links mean all work of the deliverable. */
export function milestoneLinkedWork(ctx: EngineContext, m: Milestone): WorkItem[] {
  if (m.workItemKeys.length === 0 && m.outcomeIds.length === 0) return ctx.storiesByDeliverable.get(m.deliverableId) ?? [];
  const out = new Map<string, WorkItem>();
  for (const key of m.workItemKeys) {
    const item = ctx.idx.workItems.get(key);
    if (!item) continue;
    if (isEpic(item)) {
      for (const c of ctx.childrenOf.get(key) ?? []) if (isStoryLevel(c)) out.set(c.key, c);
    } else {
      out.set(item.key, item);
    }
  }
  for (const id of m.outcomeIds) {
    const outcome = ctx.resolveOutcome(id);
    for (const item of outcome ? (ctx.storiesByOutcome.get(outcome.id) ?? []) : []) out.set(item.key, item);
  }
  return [...out.values()];
}

/** Share of linked work closed: by points when estimated, otherwise by item count. */
export function closedShare(items: WorkItem[]): { ratio: number; closed: number; total: number; unit: 'points' | 'items' } | null {
  if (items.length === 0) return null;
  let closed = 0;
  let total = 0;
  for (const i of items) {
    if (i.points === null || !(i.points > 0)) continue;
    total += i.points;
    if (isClosed(i)) closed += i.points;
  }
  if (total > 0) return { ratio: closed / total, closed, total, unit: 'points' };
  const closedItems = items.filter(isClosed).length;
  return { ratio: closedItems / items.length, closed: closedItems, total: items.length, unit: 'items' };
}

export const ruleR1: Rule = ({ ctx }) => {
  const out: Finding[] = [];
  for (const m of ctx.data.milestones) {
    if (m.status !== 'planned') continue;
    const dueIn = dayDiff(ctx.clock.today, m.date);
    if (dueIn < 0 || dueIn > RULE_THRESHOLDS.milestoneWindowDays) continue;
    const items = milestoneLinkedWork(ctx, m);
    const share = closedShare(items);
    if (!share || share.ratio >= RULE_THRESHOLDS.milestoneMinClosedRatio) continue;
    const open = items.filter((i) => !isClosed(i));
    out.push(
      finding(
        ctx,
        'R1',
        ref.milestone(m.id),
        m.deliverableId,
        `${m.regulatory ? 'Regulatory milestone' : 'Milestone'} ${quote(m.title)} is due ${relativeDays(dueIn)} (${date(m.date)}) ` +
          `with ${pct(share.ratio)} of linked work closed (${share.closed} of ${plural(share.total, share.unit === 'points' ? 'point' : 'item')}); ` +
          `${plural(open.length, 'item')} still open.`,
        [ref.deliverable(m.deliverableId), ...open.map((i) => ref.item(i.key))],
      ),
    );
  }
  return out;
};

export const ruleR3: Rule = ({ ctx }) => {
  const out: Finding[] = [];
  for (const item of ctx.data.workItems) {
    if (!item.due || isClosed(item)) continue;
    const overdue = dayDiff(item.due, ctx.clock.today);
    if (overdue <= 0) continue;
    out.push(
      finding(
        ctx,
        'R3',
        ref.item(item.key),
        ctx.deliverableOfItem.get(item.key) ?? null,
        `${itemLabel(item)} was due on ${date(item.due)} (${days(overdue)} ago) and is still ${lowerFirst(terms.statusCategories[item.statusCategory])}.`,
        [],
      ),
    );
  }
  return out;
};

export const ruleR5: Rule = ({ ctx }) => {
  const out: Finding[] = [];
  for (const d of ctx.data.deliverables) {
    if (d.reportedRag !== 'green') continue;
    for (const dep of ctx.dependenciesInto.get(d.id) ?? []) {
      if (!dep.critical || !isDependencyTroubled(dep, ctx.clock)) continue;
      const provider = ctx.idx.deliverables.get(dep.fromDeliverableId);
      const hub = ctx.idx.hubs.get(dep.fromHubId);
      const late = dependencyLateDays(dep, ctx.clock);
      const state = dep.status === 'blocked' ? lowerFirst(terms.dependencyStatus.blocked) : `${days(late)} late`;
      out.push(
        finding(
          ctx,
          'R5',
          ref.deliverable(d.id),
          d.id,
          `${d.ref} is reported ${terms.rag.green} in ${portfolioSystem()}, but critical dependency ${quote(dep.title)}` +
            `${provider ? ` from ${provider.ref}` : ''}${hub ? ` (${hub.name})` : ''} is ${state} ` +
            `(needed by ${date(dep.needBy)}${dep.committed ? `, committed for ${date(dep.committed)}` : ', no committed date'}).`,
          [ref.dependency(dep.id), ...(dep.workItemKey ? [ref.item(dep.workItemKey)] : [])],
          dep.id,
        ),
      );
    }
  }
  return out;
};

export const ruleR6: Rule = ({ ctx }) => {
  const out: Finding[] = [];
  for (const dep of ctx.data.dependencies) {
    if (!dep.committed || !isDependencyOpen(dep)) continue;
    const gap = dayDiff(dep.needBy, dep.committed);
    if (gap <= 0) continue;
    const receiver = ctx.idx.deliverables.get(dep.toDeliverableId);
    const provider = ctx.idx.deliverables.get(dep.fromDeliverableId);
    out.push(
      finding(
        ctx,
        'R6',
        ref.dependency(dep.id),
        dep.toDeliverableId,
        `${quote(dep.title)} is committed for ${date(dep.committed)}, ${days(gap)} after ` +
          `${receiver ? receiver.ref : 'the receiver'} needs it (${date(dep.needBy)})` +
          `${provider ? `; provider ${provider.ref}` : ''}.`,
        unique([dep.toDeliverableId, dep.fromDeliverableId]).map(ref.deliverable),
      ),
    );
  }
  return out;
};
