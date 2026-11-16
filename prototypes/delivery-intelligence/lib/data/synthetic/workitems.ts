/**
 * Work items (Jira side) for the generated deliverables: Epics, story-level
 * items and sub-tasks, with a status mix that follows each deliverable's
 * target progress, dates and flags. The hero and workflow story are in story.ts.
 */
import type { AgentIdentity, AssigneeType, Person, StatusCategory, WorkItem, WorkItemType } from '@/lib/types';
import {
  BUG_DEFECTS,
  STORY_VERBS,
  SUBTASK_TEMPLATES,
  SUFFIXES,
  TASK_VERBS,
  THEME_OBJECTS,
} from './catalogue';
import { addDays, clampDate, dateAtFraction, maxDate, minDate, sprintEnd, sprintIdFor, sprintIndexFor, sprintIdForIndex, stampOn, TODAY } from './dates';
import type { Hierarchy } from './hierarchy';
import type { OutcomePlan } from './outcomes';
import type { Rng } from './random';
import type { Reference } from './reference';

const DAY_BEFORE_TODAY = addDays(TODAY, -1);

interface Draft {
  epicIndex: number;
  /** Position within the deliverable's window, 0..1. */
  u: number;
  type: WorkItemType;
  points: number | null;
  summary: string;
  objectText: string;
  outcomeId: string | null;
  category: StatusCategory;
  status: string;
  forcedDone: boolean;
}

const IN_FLIGHT_STATUSES: ReadonlyArray<readonly [string, number]> = [['In Progress', 5], ['In Review', 3.5], ['Blocked', 1.2]];

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function pickPoints(dr: Rng, type: WorkItemType): number | null {
  if (type === 'sub-task') return null;
  if (type === 'spike') return dr.pick([3, 5]);
  if (type === 'task') return dr.pick([1, 2, 2, 3]);
  if (type === 'bug') return dr.pick([1, 2, 3, 5]);
  return dr.weighted([[1, 10], [2, 22], [3, 28], [5, 22], [8, 12], [13, 6]]);
}

function pickType(dr: Rng, allowProductionIssue: boolean): WorkItemType {
  return dr.weighted<WorkItemType>([
    ['story', 50], ['new-feature', 8], ['task', 16], ['bug', 12], ['improvement', 6], ['spike', 5], ['production-issue', allowProductionIssue ? 3 : 0],
  ]);
}

function makeSummary(dr: Rng, type: WorkItemType, pool: string[], specific: string[], used: Set<string>): { summary: string; objectText: string } {
  for (let attempt = 0; attempt < 14; attempt += 1) {
    const objectText = dr.chance(0.45) && specific.length > 0 ? dr.pick(specific) : dr.pick(pool);
    let summary: string;
    switch (type) {
      case 'bug':
        summary = `Fix ${objectText} ${dr.pick(BUG_DEFECTS)}`;
        break;
      case 'task':
        summary = `${dr.pick(TASK_VERBS)} ${objectText}`;
        break;
      case 'improvement':
        summary = `${dr.pick(['Improve performance of', 'Simplify configuration of', 'Reduce manual steps in', 'Make errors clearer in'])} ${objectText}`;
        break;
      case 'spike':
        summary = `${dr.pick(['Investigate options for', 'Prototype', 'Assess data volumes for'])} ${objectText}`;
        break;
      case 'production-issue':
        summary = `Production: ${objectText} ${dr.pick(BUG_DEFECTS)}`;
        break;
      default:
        summary = `${dr.pick(STORY_VERBS)} ${objectText}${dr.chance(0.55) ? dr.pick(SUFFIXES) : ''}`;
    }
    summary = capitalise(summary);
    if (!used.has(summary)) {
      used.add(summary);
      return { summary, objectText };
    }
  }
  const objectText = dr.pick(pool);
  const summary = capitalise(`${dr.pick(STORY_VERBS)} ${objectText}${dr.pick(SUFFIXES)} (phase ${used.size % 3 + 2})`);
  used.add(summary);
  return { summary, objectText };
}

export interface WorkItemPlan {
  items: WorkItem[];
}

export function buildWorkItems(root: Rng, hierarchy: Hierarchy, ref: Reference, outcomePlan: OutcomePlan): WorkItemPlan {
  const rng = root.fork('workitems');
  const items: WorkItem[] = [];

  const peopleByHub = new Map<string, Person[]>();
  for (const person of ref.people) {
    if (!person.podId) continue;
    peopleByHub.set(person.hubId, [...(peopleByHub.get(person.hubId) ?? []), person]);
  }
  const personById = new Map(ref.people.map((p) => [p.id, p]));
  const podById = new Map(ref.pods.map((p) => [p.id, p]));
  const currentSprint = sprintIndexFor(TODAY);

  for (const deliverable of hierarchy.deliverables) {
    const spec = hierarchy.specs.get(deliverable.id);
    if (!spec || spec.pinned) continue;
    const dr = rng.fork(spec.id);
    const flags = spec.flags ?? {};
    const standalone = spec.pmNodeId === null;
    const outcomes = outcomePlan.outcomes.filter((oc) => oc.deliverableId === spec.id);
    const m = outcomes.length;
    const k = deliverable.epicKeys.length;
    const used = new Set<string>();
    const pool = THEME_OBJECTS[spec.programme];
    const started = spec.start <= TODAY;
    const p = spec.progress;

    const staffHubs = spec.hubs;
    const identities: AgentIdentity[] = ref.agentIdentities.filter((a) => a.hubId !== null && staffHubs.includes(a.hubId));
    const pickHuman = (preferredHub: string | null): Person => {
      const hub = preferredHub && dr.chance(0.7) ? preferredHub : dr.weighted(staffHubs.map((h, i) => [h, i === 0 ? 3 : 1] as const));
      const candidates = peopleByHub.get(hub) ?? peopleByHub.get(staffHubs[0] as string) ?? [];
      return dr.pick(candidates);
    };
    const agentRate = spec.tier === 'T4' ? 0.03 : 0.14;

    // ---- Drafts ---------------------------------------------------------
    const drafts: Draft[] = [];
    for (let e = 0; e < k; e += 1) {
      const count = standalone ? dr.int(8, 12) : dr.int(13, 21);
      for (let i = 0; i < count; i += 1) {
        const u = ((i + dr.next() * 0.8) / count) * 0.78 + (e / k) * 0.22;
        const type = pickType(dr, p > 0.6);
        const { summary, objectText } = makeSummary(dr, type, pool, spec.objects, used);
        let outcomeIndex = Math.min(m - 1, Math.floor(u * m));
        if (dr.chance(0.18)) outcomeIndex = Math.max(0, Math.min(m - 1, outcomeIndex + dr.pick([-1, 1])));
        drafts.push({ epicIndex: e, u, type, points: pickPoints(dr, type), summary, objectText, outcomeId: outcomes[outcomeIndex]?.id ?? null, category: 'to-do', status: 'To Do', forcedDone: false });
      }
    }
    drafts.sort((a, b) => a.u - b.u);

    // Every outcome draws work from at least two items.
    for (const oc of outcomes) {
      const have = drafts.filter((d) => d.outcomeId === oc.id);
      for (let need = have.length; need < 2; need += 1) {
        const donor = drafts.filter((d) => d.outcomeId !== oc.id && drafts.filter((x) => x.outcomeId === d.outcomeId).length > 3);
        const taken = donor.length > 0 ? dr.pick(donor) : (drafts[0] as Draft);
        taken.outcomeId = oc.id;
      }
    }

    // ---- Statuses ---------------------------------------------------------
    for (const d of drafts) {
      const forced = d.outcomeId !== null && (outcomePlan.acceptedIds.has(d.outcomeId) || outcomePlan.completeUnacceptedIds.has(d.outcomeId));
      d.forcedDone = forced;
      let done = false;
      if (forced || p >= 1) done = true;
      else if (p > 0) done = d.u < p + (dr.next() - 0.5) * 0.08;
      if (done) {
        d.category = 'done';
        d.status = 'Done';
      } else if (p > 0 && d.u < p + 0.14 && dr.chance(0.6)) {
        d.category = 'in-progress';
        d.status = dr.weighted(IN_FLIGHT_STATUSES);
      }
    }
    if (flags.closedEpic) {
      const first = drafts.filter((d) => d.epicIndex === 0);
      const open = first.filter((d) => d.category !== 'done');
      if (open.length < 2) {
        for (const d of first.filter((x) => !x.forcedDone).slice(-2)) {
          d.category = 'in-progress';
          d.status = 'In Progress';
        }
      }
    }

    // ---- Epics --------------------------------------------------------------
    const epicStatusDone: boolean[] = [];
    deliverable.epicKeys.forEach((epicKey, e) => {
      const children = drafts.filter((d) => d.epicIndex === e);
      const allDone = children.length > 0 && children.every((d) => d.category === 'done');
      const anyActive = children.some((d) => d.category !== 'to-do');
      const forceClosed = Boolean(flags.closedEpic) && e === 0;
      const done = allDone || forceClosed;
      epicStatusDone.push(done);
      const hubId = spec.hubs[e % spec.hubs.length] as string;
      const podId = ref.pods.find((pod) => pod.hubId === hubId)?.id ?? spec.podId;
      const createdDate = clampDate(addDays(spec.start, -dr.int(5, 20)), addDays(TODAY, -60), DAY_BEFORE_TODAY);
      let updatedDate = addDays(TODAY, -dr.int(1, 9));
      let resolved: string | null = null;
      if (done) {
        const lastChild = children.length > 0 ? Math.max(...children.map((d) => d.u)) : 0;
        const resolvedDate = forceClosed && !allDone ? addDays(TODAY, -dr.int(2, 6)) : clampDate(addDays(dateAtFraction(spec.start, spec.end, lastChild), dr.int(0, 3)), addDays(spec.start, 1), DAY_BEFORE_TODAY);
        resolved = stampOn(resolvedDate, dr);
        updatedDate = resolvedDate;
      } else if (!anyActive) {
        updatedDate = maxDate(createdDate, addDays(TODAY, -dr.int(3, 14)));
      }
      updatedDate = maxDate(updatedDate, createdDate);

      let deliverableId: string | null = deliverable.id;
      if (flags.epicDeliverableId && e === Math.min(1, k - 1)) deliverableId = flags.epicDeliverableId === 'missing' ? null : `td-${spec.n + 900}`;
      let targetDate = spec.end;
      let ownerId: string | null = deliverable.ownerId;
      if (flags.epicMismatch && e === k - 1) {
        if (flags.epicMismatch === 'dates') targetDate = addDays(spec.end, 21);
        else ownerId = (podById.get(spec.podId)?.memberIds ?? []).find((id) => id !== deliverable.ownerId) ?? ownerId;
      }

      items.push({
        key: epicKey,
        type: 'epic',
        summary: spec.epics[e] as string,
        status: done ? 'Done' : anyActive ? 'In Progress' : 'To Do',
        statusCategory: done ? 'done' : anyActive ? 'in-progress' : 'to-do',
        deliverableId,
        epicKey: null,
        outcomeId: null,
        parentKey: null,
        assigneeType: 'human',
        assigneeId: deliverable.ownerId,
        reviewerId: null,
        podId,
        hubId,
        sprintId: null,
        points: null,
        riskTier: null,
        created: stampOn(createdDate, dr),
        updated: stampOn(updatedDate, dr),
        due: spec.end,
        resolved,
        startDate: spec.start,
        targetDate,
        ownerId,
        labels: [spec.programme, ...(spec.tier === 'T3' || spec.tier === 'T4' ? ['regulatory'] : [])],
      });
    });

    // ---- Story-level items and sub-tasks ------------------------------------
    const noReviewerBudget = { left: flags.noReviewer ?? 0 };
    const overdueCandidates: WorkItem[] = [];
    const storyItems: WorkItem[] = [];

    for (const d of drafts) {
      const epicKey = deliverable.epicKeys[d.epicIndex] as string;
      const hubForEpic = spec.hubs[d.epicIndex % spec.hubs.length] as string;
      const key = hierarchy.keys.next(spec.programme);
      const planned = dateAtFraction(spec.start, spec.end, d.u);

      // Assignee
      let assigneeType: AssigneeType = 'human';
      let assigneeId: string;
      let hubId: string;
      let podId: string | null;
      let reviewerId: string | null = null;
      const eligibleForAgent = d.type !== 'production-issue' && d.type !== 'bug';
      const forceNoReviewer = noReviewerBudget.left > 0 && d.category !== 'done' && eligibleForAgent && identities.length > 0 && dr.chance(0.45);
      if (identities.length > 0 && eligibleForAgent && (forceNoReviewer || dr.chance(agentRate))) {
        const identity = dr.pick(identities);
        assigneeType = 'agent';
        assigneeId = identity.id;
        hubId = identity.hubId ?? spec.hubs[0] as string;
        podId = identity.podId;
        if (forceNoReviewer) noReviewerBudget.left -= 1;
        else {
          const pod = podId ? podById.get(podId) : undefined;
          reviewerId = pod && dr.chance(0.6) ? pod.leadId : dr.pick(pod?.memberIds ?? [deliverable.ownerId]);
        }
      } else {
        const person = pickHuman(hubForEpic);
        assigneeId = person.id;
        hubId = person.hubId;
        podId = person.podId;
        const peers = ((podId ? podById.get(podId)?.memberIds : undefined) ?? []).filter((id) => id !== person.id);
        if (peers.length > 0 && dr.chance(0.18)) reviewerId = dr.pick(peers);
      }

      // Dates and sprint, by status
      let created: string;
      let updated: string;
      let resolved: string | null = null;
      let due: string | null = null;
      let sprintId: string | null;
      const createdFloor = addDays(spec.start, -28);
      if (d.category === 'done') {
        const base = addDays(planned, dr.int(-7, 2));
        const resolvedDate = clampDate(base, addDays(minDate(spec.start, DAY_BEFORE_TODAY), 1), DAY_BEFORE_TODAY);
        created = stampOn(clampDate(addDays(resolvedDate, -dr.int(4, 35)), createdFloor, addDays(resolvedDate, -1)), dr);
        resolved = stampOn(resolvedDate, dr);
        updated = resolved;
        const sprintIndex = Math.max(0, sprintIndexFor(resolvedDate) - (dr.chance(0.1) ? 1 : 0));
        sprintId = sprintIdForIndex(sprintIndex);
        due = dr.chance(0.7) ? sprintEnd(sprintIndex) : null;
      } else if (d.category === 'in-progress') {
        const createdDate = clampDate(addDays(minDate(planned, TODAY), -dr.int(6, 35)), createdFloor, addDays(TODAY, -3));
        created = stampOn(createdDate, dr);
        updated = stampOn(maxDate(addDays(TODAY, -dr.int(0, 8)), addDays(createdDate, 1)), dr);
        const sprintIndex = dr.chance(0.7) ? currentSprint : currentSprint - 1;
        sprintId = sprintIdForIndex(sprintIndex);
        due = planned < addDays(TODAY, -10) ? planned : dr.chance(0.75) ? sprintEnd(sprintIndex) : null;
      } else {
        const createdDate = started
          ? clampDate(addDays(minDate(planned, TODAY), -dr.int(8, 40)), createdFloor, addDays(TODAY, -3))
          : addDays(TODAY, -dr.int(3, 40));
        created = stampOn(createdDate, dr);
        updated = stampOn(minDate(addDays(createdDate, dr.int(0, 10)), DAY_BEFORE_TODAY), dr);
        if (planned < TODAY) {
          const target = currentSprint + dr.int(0, 1);
          sprintId = sprintIdForIndex(target);
          due = dr.chance(0.2) ? planned : dr.chance(0.5) ? sprintEnd(target) : null;
        } else {
          const plannedIndex = sprintIndexFor(planned);
          sprintId = plannedIndex > currentSprint + 3 && dr.chance(0.4) ? null : sprintIdFor(planned);
          due = sprintId && dr.chance(0.5) ? sprintEnd(plannedIndex) : null;
        }
      }
      if (updated < created) updated = created;

      const item: WorkItem = {
        key,
        type: d.type,
        summary: d.summary,
        status: d.status,
        statusCategory: d.category,
        deliverableId: null,
        epicKey,
        outcomeId: d.outcomeId,
        parentKey: epicKey,
        assigneeType,
        assigneeId,
        reviewerId,
        podId,
        hubId,
        sprintId,
        points: d.points,
        riskTier: null,
        created,
        updated,
        due,
        resolved,
        startDate: null,
        targetDate: null,
        ownerId: null,
        labels: dr.chance(0.12) ? ['cross-hub'] : [],
      };
      items.push(item);
      storyItems.push(item);
      if (d.category !== 'done') overdueCandidates.push(item);

      // Sub-tasks
      if ((d.type === 'story' || d.type === 'new-feature' || d.type === 'improvement') && (d.points ?? 0) >= 3 && dr.chance(0.3)) {
        const count = dr.int(1, 2);
        for (let s = 0; s < count; s += 1) {
          const subKey = hierarchy.keys.next(spec.programme);
          let subCategory: StatusCategory = item.statusCategory;
          let subStatus = item.status;
          if (item.statusCategory === 'in-progress' && s === 0) {
            subCategory = 'done';
            subStatus = 'Done';
          }
          const subAgent = identities.length > 0 && dr.chance(agentRate * 1.2);
          const subPerson = pickHuman(hubForEpic);
          const subIdentity = subAgent ? dr.pick(identities) : null;
          const subPod = subIdentity ? podById.get(subIdentity.podId ?? '') : undefined;
          let subResolved: string | null = null;
          let subUpdated = item.updated;
          if (subCategory === 'done') {
            const parentDay = item.resolved ?? item.updated;
            const day = clampDate(addDays(parentDay.slice(0, 10), -dr.int(0, 3)), addDays(item.created.slice(0, 10), 1), DAY_BEFORE_TODAY);
            subResolved = stampOn(day, dr);
            subUpdated = subResolved;
          }
          items.push({
            key: subKey,
            type: 'sub-task',
            summary: `${dr.pick(SUBTASK_TEMPLATES)} ${d.objectText}`,
            status: subStatus,
            statusCategory: subCategory,
            deliverableId: null,
            epicKey,
            outcomeId: item.outcomeId,
            parentKey: key,
            assigneeType: subIdentity ? 'agent' : 'human',
            assigneeId: subIdentity ? subIdentity.id : subPerson.id,
            reviewerId: subIdentity ? (subPod?.leadId ?? deliverable.ownerId) : null,
            podId: subIdentity ? subIdentity.podId : subPerson.podId,
            hubId: subIdentity ? (subIdentity.hubId ?? item.hubId) : subPerson.hubId,
            sprintId: item.sprintId,
            points: null,
            riskTier: null,
            created: item.created,
            updated: subUpdated < item.created ? item.created : subUpdated,
            due: null,
            resolved: subResolved,
            startDate: null,
            targetDate: null,
            ownerId: null,
            labels: [],
          });
        }
      }
    }

    // ---- Planted conditions -----------------------------------------------
    if (flags.unmapped) {
      const protectedOutcomes = new Set([...outcomePlan.acceptedIds, ...outcomePlan.completeUnacceptedIds]);
      const pickable = storyItems.filter((it) => it.outcomeId && !protectedOutcomes.has(it.outcomeId) && it.statusCategory !== 'done');
      for (const it of dr.shuffle(pickable).slice(0, flags.unmapped)) {
        it.outcomeId = null;
        for (const sub of items.filter((x) => x.parentKey === it.key)) sub.outcomeId = null;
      }
    }
    if (flags.overdueBias) {
      const early = [...overdueCandidates].sort((a, b) => (a.created < b.created ? -1 : 1)).slice(0, 7);
      for (const it of early) {
        const dueDate = addDays(TODAY, -dr.int(2, 25));
        it.due = dueDate;
        it.sprintId = sprintIdFor(dueDate);
      }
    }
  }

  return { items };
}

/** Helpers shared with evidence generation. */
export function isStoryLevel(item: WorkItem): boolean {
  return item.type !== 'epic' && item.type !== 'sub-task' && item.type !== 'theme' && item.type !== 'initiative' && item.type !== 'tech-deliverable' && item.type !== 'raid';
}
