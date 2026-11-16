/**
 * Book-of-record rules.
 *   R8   Portfolio-system fields disagree with the Jira Epic: Deliverable ID, dates
 *        (Epic start before the deliverable's planned start, or target after its
 *        planned end, beyond the tolerance) or owner. Also an Epic the book of
 *        record lists that does not exist in the work tracker.
 *   R11  Outcome not accepted (by the acceptance measure) while reported complete, or
 *        reported on track and either past its due date or with all linked
 *        story-level work closed (at least one item). On track, not yet due and
 *        with open work is normal and raises nothing. Overdue is reported before
 *        all-work-closed when both apply.
 */
import { terms } from '@/lib/config/terminology';
import type { Finding, Outcome, Person, TechDeliverable } from '@/lib/types';
import { RULE_THRESHOLDS } from './constants';
import { isEpic, type EngineContext } from './context';
import { date, days, evidenceKindLabel, itemLabel, listPhrases, plural, portfolioSystem, quote, workTracker } from './messages';
import { finding, ref, type Rule } from './rule-kit';
import { dayDiff } from './util';
import { isClosed } from './work';

export const ruleR8: Rule = ({ ctx }) => {
  const out: Finding[] = [];
  const pm = portfolioSystem();
  const jira = workTracker();
  const epicWord = terms.hierarchy.epic;
  const field = terms.hierarchy.deliverableIdField;
  const tol = RULE_THRESHOLDS.reconciliationDateToleranceDays;
  const listedBy = new Map<string, TechDeliverable>();
  for (const d of ctx.data.deliverables) for (const k of d.epicKeys) if (!listedBy.has(k)) listedBy.set(k, d);
  const personName = (id: string): string => (ctx.idx.people.get(id) as Person | undefined)?.name ?? id;

  for (const epic of ctx.data.workItems) {
    if (!isEpic(epic)) continue;
    const listed = listedBy.get(epic.key);
    const claimed = ctx.resolveDeliverable(epic.deliverableId);
    const record = listed ?? claimed;
    if (!record) continue;
    const diffs: string[] = [];
    if (claimed && listed && claimed.id !== listed.id) {
      diffs.push(`${field} is ${claimed.ref} in ${jira} but ${pm} lists the ${epicWord} under ${listed.ref}`);
    } else if (claimed && !listed) {
      diffs.push(`${jira} gives ${field} ${claimed.ref} but ${pm} does not list the ${epicWord} under it`);
    }
    if (epic.startDate && dayDiff(epic.startDate, record.plannedStart) > tol) {
      diffs.push(`start ${date(epic.startDate)} in ${jira} is before the planned start ${date(record.plannedStart)} in ${pm}`);
    }
    if (epic.targetDate && dayDiff(record.plannedEnd, epic.targetDate) > tol) {
      diffs.push(`target ${date(epic.targetDate)} in ${jira} is after the planned end ${date(record.plannedEnd)} in ${pm}`);
    }
    if (epic.ownerId && epic.ownerId !== record.ownerId) {
      diffs.push(`owner is ${personName(epic.ownerId)} in ${jira} but ${personName(record.ownerId)} in ${pm}`);
    }
    if (diffs.length === 0) continue;
    const text = listPhrases(diffs);
    out.push(
      finding(
        ctx,
        'R8',
        ref.item(epic.key),
        record.id,
        `${pm} and ${jira} disagree on ${epicWord} ${itemLabel(epic)}: ${text}.`,
        [ref.deliverable(record.id), ...(claimed && claimed.id !== record.id ? [ref.deliverable(claimed.id)] : [])],
      ),
    );
  }

  // Epics the book of record lists that the work tracker does not have.
  for (const d of ctx.data.deliverables) {
    for (const key of d.epicKeys) {
      const item = ctx.idx.workItems.get(key);
      if (item && isEpic(item)) continue;
      out.push(
        finding(
          ctx,
          'R8',
          ref.deliverable(d.id),
          d.id,
          `${pm} lists ${epicWord} ${key} under ${d.ref}, but ${jira} has no ${epicWord} with that key.`,
          [],
          key,
        ),
      );
    }
  }
  return out;
};

/**
 * Why an unaccepted outcome is flagged, or null when its reported status is still
 * credible (on track, not yet due, work still open).
 */
function r11Condition(ctx: EngineContext, o: Outcome): string | null {
  const pm = portfolioSystem();
  if (o.reportedStatus === 'complete') return `reported complete in ${pm} with no acceptance recorded`;
  if (o.reportedStatus !== 'on-track') return null;
  const overdue = dayDiff(o.dueDate, ctx.clock.today);
  if (overdue > 0) return `reported on track in ${pm}, due ${days(overdue)} ago, with no acceptance recorded`;
  const items = ctx.storiesByOutcome.get(o.id) ?? [];
  if (items.length > 0 && items.every(isClosed)) {
    return `reported on track in ${pm} with all linked work closed (${plural(items.length, 'item')}) and no acceptance recorded`;
  }
  return null;
}

export const ruleR11: Rule = ({ ctx, measures }) => {
  const out: Finding[] = [];
  for (const o of ctx.data.outcomes) {
    const a = measures.acceptance.get(o.id);
    if (!a || a.accepted) continue;
    const condition = r11Condition(ctx, o);
    if (!condition) continue;
    const held = a.businessAcceptanceEvidenceIds.length > 0;
    const parts = [
      a.mandatoryCount === 0
        ? 'no mandatory acceptance criteria are defined'
        : a.mandatoryCount === 1
          ? 'its mandatory criterion is not accepted'
          : `${a.mandatoryAccepted} of ${a.mandatoryCount} mandatory criteria are accepted`,
      held ? `a ${evidenceKindLabel('business-acceptance')} record is held` : `no ${evidenceKindLabel('business-acceptance')} record is held`,
    ];
    const deliverable = ctx.idx.deliverables.get(o.deliverableId);
    out.push(
      finding(
        ctx,
        'R11',
        ref.outcome(o.id),
        o.deliverableId,
        `${terms.hierarchy.outcome} ${quote(o.title)}${deliverable ? ` (${deliverable.ref})` : ''} is ${condition}: ${parts.join(' and ')}.`,
        [...a.reasons.flatMap((r) => r.refs), ...a.businessAcceptanceEvidenceIds.map(ref.evidence), ...(ctx.storiesByOutcome.get(o.id) ?? []).map((i) => ref.item(i.key))],
      ),
    );
  }
  return out;
};
