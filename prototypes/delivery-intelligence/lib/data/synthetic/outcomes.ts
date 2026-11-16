/**
 * Outcomes and acceptance criteria for the generated deliverables. The hero
 * and workflow-story outcomes are hand-written in story.ts.
 */
import type { AcceptanceCriterion, Outcome, WorkItem } from '@/lib/types';
import { CRITERIA_TEMPLATES, REPORTED_ON_TRACK } from './catalogue';
import { addDays, clampDate, dateAtFraction, dateOf, minDate, stamp, stampOn, TODAY } from './dates';
import type { Hierarchy } from './hierarchy';
import type { Rng } from './random';

export interface OutcomePlan {
  outcomes: Outcome[];
  criteria: AcceptanceCriterion[];
  /** Outcomes that must be fully accepted (all work closed, acceptance recorded). */
  acceptedIds: Set<string>;
  /** Outcomes reported complete with all work closed but no acceptance (R11). */
  completeUnacceptedIds: Set<string>;
}

/** Criteria per outcome; cycles so the portfolio averages three. */
const CRITERIA_COUNTS = [3, 3, 2, 4, 3, 3, 4, 2, 3];

export function buildOutcomes(root: Rng, hierarchy: Hierarchy): OutcomePlan {
  const rng = root.fork('outcomes');
  const outcomes: Outcome[] = [];
  const criteria: AcceptanceCriterion[] = [];
  const acceptedIds = new Set<string>();
  const completeUnacceptedIds = new Set<string>();
  let counter = 0;

  for (const deliverable of hierarchy.deliverables) {
    const spec = hierarchy.specs.get(deliverable.id);
    if (!spec || spec.pinned) continue;
    const dr = rng.fork(spec.id);
    const m = spec.outcomes.length;
    const owner = deliverable.reviewers['business-owner'] ?? deliverable.ownerId;

    spec.outcomes.forEach((os, index) => {
      const i = index + 1;
      const id = `oc-${spec.n}-${i}`;
      const isAccepted = i <= spec.accepted;
      const isCompleteUnaccepted = Boolean(spec.flags?.completeUnaccepted) && i === spec.accepted + 1;

      let reportedStatus: Outcome['reportedStatus'] = 'on-track';
      if (isAccepted || isCompleteUnaccepted) reportedStatus = 'complete';
      else if (spec.rag === 'green' && !REPORTED_ON_TRACK.has(spec.id)) reportedStatus = 'at-risk';
      else if (i === m && spec.rag === 'amber') reportedStatus = 'at-risk';
      else if (i === m && spec.rag === 'red') reportedStatus = 'off-track';
      else if (i === m - 1 && spec.rag === 'red') reportedStatus = 'at-risk';

      outcomes.push({
        id,
        ref: `OC-${spec.n}-${i}`,
        deliverableId: spec.id,
        title: os.title,
        description: os.description,
        weight: dr.pick([1, 2, 2, 3]),
        dueDate: dateAtFraction(spec.start, spec.end, i / m),
        reportedStatus,
        acceptanceOwnerId: owner,
      });
      if (isAccepted) acceptedIds.add(id);
      if (isCompleteUnaccepted) completeUnacceptedIds.add(id);

      const count = CRITERIA_COUNTS[counter % CRITERIA_COUNTS.length] as number;
      counter += 1;
      const templates = dr.shuffle(CRITERIA_TEMPLATES.slice(1, 11));
      for (let k = 1; k <= count; k += 1) {
        const optional = count === 4 && k === 4;
        const text = k === 1 ? `Business owner confirms: ${os.title.charAt(0).toLowerCase()}${os.title.slice(1)}` : optional ? 'Documentation published where users can find it' : (templates[k - 2] as string);
        const rejected = Boolean(spec.flags?.failingTest) && i === spec.accepted + 1 && k === 1;
        criteria.push({
          id: `ac-${id}-${k}`,
          outcomeId: id,
          text,
          mandatory: !optional,
          state: isAccepted && !optional ? 'accepted' : rejected ? 'rejected' : 'open',
          acceptedById: isAccepted && !optional ? owner : null,
          acceptedAt: null,
          rejectedById: rejected ? owner : null,
          rejectionReason: rejected ? 'Sample batch totals differ from the source system by more than the agreed tolerance.' : null,
        });
      }
    });
  }
  return { outcomes, criteria, acceptedIds, completeUnacceptedIds };
}

export interface AcceptanceDates {
  /** Latest `acceptedAt` per accepted outcome. */
  byOutcome: Map<string, string>;
}

/**
 * Sets `acceptedAt` once work items exist, so acceptance always follows the
 * last closed item of the outcome. Also records a first-criterion acceptance
 * for outcomes whose work is fully closed and which are waiting for sign-off.
 */
export function finalizeAcceptance(root: Rng, plan: OutcomePlan, hierarchy: Hierarchy, workItems: WorkItem[]): AcceptanceDates {
  const rng = root.fork('acceptance');
  const byOutcome = new Map<string, string>();
  const itemsByOutcome = new Map<string, WorkItem[]>();
  for (const item of workItems) {
    if (item.outcomeId) itemsByOutcome.set(item.outcomeId, [...(itemsByOutcome.get(item.outcomeId) ?? []), item]);
  }

  for (const outcome of plan.outcomes) {
    const items = itemsByOutcome.get(outcome.id) ?? [];
    const allDone = items.length > 0 && items.every((i) => i.statusCategory === 'done');
    const lastResolved = items.reduce((latest, i) => (i.resolved && dateOf(i.resolved) > latest ? dateOf(i.resolved) : latest), '2027-01-04');
    const spec = hierarchy.specs.get(outcome.deliverableId);
    const mine = plan.criteria.filter((c) => c.outcomeId === outcome.id);

    if (plan.acceptedIds.has(outcome.id)) {
      let when = clampDate(addDays(lastResolved, rng.int(1, 4)), '2027-01-05', addDays(TODAY, -1));
      for (const c of mine) {
        if (c.state !== 'accepted') continue;
        c.acceptedAt = stamp(when, 18, rng.int(0, 59));
        when = minDate(addDays(when, rng.int(0, 1)), addDays(TODAY, -1));
        const prior = byOutcome.get(outcome.id);
        if (!prior || c.acceptedAt > prior) byOutcome.set(outcome.id, c.acceptedAt);
      }
    } else if (allDone && !plan.completeUnacceptedIds.has(outcome.id) && !spec?.flags?.completeUnaccepted) {
      const first = mine[0];
      if (first && first.state === 'open' && first.mandatory) {
        first.state = 'accepted';
        first.acceptedById = outcome.acceptanceOwnerId;
        first.acceptedAt = stampOn(clampDate(addDays(lastResolved, 2), '2027-01-05', addDays(TODAY, -1)), rng);
      }
    }
  }
  return { byOutcome };
}
