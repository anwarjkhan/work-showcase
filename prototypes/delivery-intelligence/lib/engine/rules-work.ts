/**
 * Work-tracker hygiene rules.
 *   R2   Epic closed while children remain open.
 *   R9   Story-level item with no Outcome ID (or one that does not exist).
 *   R10  Agent-assigned item with no named human reviewer.
 *   R14  Epic with no Deliverable ID, or a Deliverable ID that does not exist.
 */
import { terms } from '@/lib/config/terminology';
import type { Finding } from '@/lib/types';
import { isNamedHuman } from './acceptance';
import { OUTCOME_ID_EXEMPT_TYPES } from './constants';
import { isEpic, isStoryLevel } from './context';
import { itemLabel, plural, portfolioSystem, quote, workTracker } from './messages';
import { finding, ref, type Rule } from './rule-kit';
import { isClosed } from './work';

export const ruleR2: Rule = ({ ctx }) => {
  const out: Finding[] = [];
  for (const epic of ctx.data.workItems) {
    if (!isEpic(epic) || !isClosed(epic)) continue;
    const open = (ctx.childrenOf.get(epic.key) ?? []).filter((c) => !isClosed(c));
    if (open.length === 0) continue;
    out.push(
      finding(
        ctx,
        'R2',
        ref.item(epic.key),
        ctx.deliverableOfItem.get(epic.key) ?? null,
        `${terms.hierarchy.epic} ${itemLabel(epic)} is closed in ${workTracker()} while ${plural(open.length, 'child item')} ` +
          `${open.length === 1 ? 'is' : 'are'} still open.`,
        open.map((c) => ref.item(c.key)),
      ),
    );
  }
  return out;
};

export const ruleR9: Rule = ({ ctx }) => {
  const out: Finding[] = [];
  const field = terms.hierarchy.outcomeIdField;
  for (const item of ctx.data.workItems) {
    if (!isStoryLevel(item) || OUTCOME_ID_EXEMPT_TYPES.has(item.type)) continue;
    const deliverableId = ctx.deliverableOfItem.get(item.key) ?? null;
    if (item.outcomeId === null || item.outcomeId === '') {
      out.push(
        finding(ctx, 'R9', ref.item(item.key), deliverableId, `${terms.workItemTypes[item.type]} ${itemLabel(item)} has no ${field}, so it counts towards no outcome.`, []),
      );
    } else if (!ctx.resolveOutcome(item.outcomeId)) {
      out.push(
        finding(
          ctx,
          'R9',
          ref.item(item.key),
          deliverableId,
          `${terms.workItemTypes[item.type]} ${itemLabel(item)} carries ${field} ${quote(item.outcomeId)}, which matches no outcome in ${portfolioSystem()}.`,
          [],
        ),
      );
    }
  }
  return out;
};

export const ruleR10: Rule = ({ ctx }) => {
  const out: Finding[] = [];
  for (const item of ctx.data.workItems) {
    if (item.assigneeType !== 'agent' || isNamedHuman(ctx, item.reviewerId)) continue;
    const agent = item.assigneeId ? ctx.idx.agentIdentities.get(item.assigneeId) : undefined;
    out.push(
      finding(
        ctx,
        'R10',
        ref.item(item.key),
        ctx.deliverableOfItem.get(item.key) ?? null,
        `${itemLabel(item)} is assigned to agent ${agent ? agent.handle : (item.assigneeId ?? 'unknown')} with no named human reviewer.`,
        agent ? [{ kind: 'agent-identity', id: agent.id }] : [],
      ),
    );
  }
  return out;
};

export const ruleR14: Rule = ({ ctx }) => {
  const out: Finding[] = [];
  const field = terms.hierarchy.deliverableIdField;
  for (const epic of ctx.data.workItems) {
    if (!isEpic(epic)) continue;
    const listedBy = ctx.data.deliverables.find((d) => d.epicKeys.includes(epic.key));
    if (epic.deliverableId === null || epic.deliverableId === '') {
      out.push(
        finding(
          ctx,
          'R14',
          ref.item(epic.key),
          listedBy?.id ?? null,
          `${terms.hierarchy.epic} ${itemLabel(epic)} has no ${field} in ${workTracker()}` +
            (listedBy ? `; ${portfolioSystem()} lists it under ${listedBy.ref}.` : ', so its work rolls up to no deliverable.'),
          listedBy ? [ref.deliverable(listedBy.id)] : [],
        ),
      );
    } else if (!ctx.resolveDeliverable(epic.deliverableId)) {
      out.push(
        finding(
          ctx,
          'R14',
          ref.item(epic.key),
          listedBy?.id ?? null,
          `${terms.hierarchy.epic} ${itemLabel(epic)} carries ${field} ${quote(epic.deliverableId)}, which does not exist in ${portfolioSystem()}.`,
          listedBy ? [ref.deliverable(listedBy.id)] : [],
        ),
      );
    }
  }
  return out;
};
