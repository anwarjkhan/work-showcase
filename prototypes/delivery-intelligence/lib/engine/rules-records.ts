/**
 * Book-of-record rules.
 *   R8   Portfolio-system fields disagree with the Jira Epic: Deliverable ID, dates
 *        (Epic start before the deliverable's planned start, or target after its
 *        planned end, beyond the tolerance) or owner. Also an Epic the book of
 *        record lists that does not exist in the work tracker.
 *   R11  Outcome reported on track or complete with no acceptance recorded.
 */
import { terms } from '@/lib/config/terminology';
import type { Finding, Person, TechDeliverable } from '@/lib/types';
import { RULE_THRESHOLDS } from './constants';
import { isEpic } from './context';
import { date, evidenceKindLabel, itemLabel, listPhrases, portfolioSystem, quote, workTracker } from './messages';
import { finding, ref, type Rule } from './rule-kit';
import { dayDiff } from './util';

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

export const ruleR11: Rule = ({ ctx, measures }) => {
  const out: Finding[] = [];
  for (const o of ctx.data.outcomes) {
    if (o.reportedStatus !== 'on-track' && o.reportedStatus !== 'complete') continue;
    const a = measures.acceptance.get(o.id);
    if (!a || a.accepted) continue;
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
        `${terms.hierarchy.outcome} ${quote(o.title)}${deliverable ? ` (${deliverable.ref})` : ''} is reported ` +
          `${o.reportedStatus === 'complete' ? 'complete' : 'on track'} in ${portfolioSystem()}, but ${parts.join(' and ')}.`,
        [...a.reasons.flatMap((r) => r.refs), ...a.businessAcceptanceEvidenceIds.map(ref.evidence)],
      ),
    );
  }
  return out;
};
