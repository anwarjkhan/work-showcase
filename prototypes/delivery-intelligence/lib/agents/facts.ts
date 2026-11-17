/**
 * Facts about a deliverable that several agents report on (status reporting,
 * executive briefing, release readiness): milestones with linked progress,
 * open RAID, troubled dependencies, items due, outstanding reviews and the
 * decisions the evidence calls for. Every fact carries the records behind it.
 */
import { stageDefinition } from '@/lib/config/pdlc';
import { terms } from '@/lib/config/terminology';
import { dependencyLateDays, isClosed, isDependencyOpen, isDependencyTroubled, outstandingReviews } from '@/lib/engine';
import type { Dependency, EntityRef, Milestone, RaidItem, TechDeliverable, WorkItem } from '@/lib/types';
import { bySeverity, compareKeys, date, days, type AgentKit, listPhrases, lowerFirst, plural, quote, ref } from './kit';

export interface MilestoneFact {
  milestone: Milestone;
  daysAway: number;
  linked: WorkItem[];
  closed: number;
}

export interface Decision {
  text: string;
  refs: EntityRef[];
  /** Lower is more urgent. */
  rank: number;
}

export function milestoneFacts(kit: AgentKit, d: TechDeliverable): MilestoneFact[] {
  const stories = kit.stories(d.id);
  return (kit.ctx.milestonesByDeliverable.get(d.id) ?? [])
    .map((m) => {
      let linked: WorkItem[];
      if (m.workItemKeys.length > 0) linked = m.workItemKeys.map((k) => kit.ctx.idx.workItems.get(k)).filter((w): w is WorkItem => !!w);
      else if (m.outcomeIds.length > 0) linked = stories.filter((s) => s.outcomeId !== null && m.outcomeIds.includes(kit.ctx.resolveOutcome(s.outcomeId)?.id ?? ''));
      else linked = stories;
      return { milestone: m, daysAway: kit.daysFromToday(m.date), linked, closed: linked.filter(isClosed).length };
    })
    .sort((a, b) => a.milestone.date.localeCompare(b.milestone.date));
}

export function milestoneSentence(kit: AgentKit, f: MilestoneFact, withRef = false): string {
  const m = f.milestone;
  const reg = m.regulatory ? ' (regulatory)' : '';
  const prefix = withRef ? `${kit.deliverable(m.deliverableId)?.ref ?? ''} ` : '';
  if (m.status === 'met') return `${prefix}${quote(m.title)}${reg} was met on ${date(m.date)}.`;
  if (m.status === 'missed' || f.daysAway < 0) {
    return `${prefix}${quote(m.title)}${reg} was due ${date(m.date)} and is missed; ${f.closed} of ${f.linked.length} linked items are closed.`;
  }
  return `${prefix}${quote(m.title)}${reg} is due ${date(m.date)}, ${kit.relative(m.date)}; ${f.closed} of ${plural(f.linked.length, 'linked item')} ${f.closed === 1 ? 'is' : 'are'} closed.`;
}

export function openRaid(kit: AgentKit, d: TechDeliverable): RaidItem[] {
  return (kit.ctx.raidByDeliverable.get(d.id) ?? []).filter((r) => r.status !== 'closed').sort((a, b) => bySeverity(a, b) || compareKeys(a.key, b.key));
}

export function raidProblems(kit: AgentKit, r: RaidItem): string[] {
  const problems: string[] = [];
  if (!r.ownerId || !kit.ctx.idx.people.has(r.ownerId)) problems.push('has no owner');
  if (!r.mitigationDue) problems.push('has no mitigation date');
  else if (kit.daysFromToday(r.mitigationDue) < 0) problems.push(`passed its mitigation date of ${date(r.mitigationDue)}`);
  const idle = -kit.daysFromToday(r.updated);
  if (idle >= 14) problems.push(`is stale, with no update for ${days(idle)}`);
  return problems;
}

export function raidSentence(kit: AgentKit, r: RaidItem): string {
  const owner = r.ownerId && kit.ctx.idx.people.has(r.ownerId) ? `owned by ${kit.person(r.ownerId)}` : 'with no owner';
  const due = r.mitigationDue ? `mitigation due ${date(r.mitigationDue)}` : 'no mitigation date';
  const idle = -kit.daysFromToday(r.updated);
  return `${terms.raidKinds[r.kind]} ${r.key} ${quote(r.title)} (${lowerFirst(terms.severity[r.severity])}) is ${owner}, ${due}, last updated ${idle === 0 ? 'today' : `${days(idle)} ago`}.`;
}

export function dependenciesInto(kit: AgentKit, d: TechDeliverable): Dependency[] {
  return (kit.ctx.dependenciesInto.get(d.id) ?? []).filter(isDependencyOpen);
}

export function dependencySentence(kit: AgentKit, dep: Dependency, perspective: 'receiver' | 'provider'): string {
  const provider = kit.deliverable(dep.fromDeliverableId);
  const receiver = kit.deliverable(dep.toDeliverableId);
  const late = dependencyLateDays(dep, kit.input.clock);
  const crit = dep.critical ? 'Critical dependency' : 'Dependency';
  const committed = dep.committed ? `committed ${date(dep.committed)}` : 'with no committed date';
  const status = lowerFirst(terms.dependencyStatus[dep.status]);
  const lateText = late > 0 ? `, ${days(late)} late` : '';
  if (perspective === 'receiver') {
    return `${crit} ${quote(dep.title)} from ${provider?.ref ?? 'an unknown deliverable'} (${kit.hubName(dep.fromHubId)}) is ${status}: needed by ${date(dep.needBy)}, ${committed}${lateText}.`;
  }
  return `${crit} ${quote(dep.title)} to ${receiver?.ref ?? 'an unknown deliverable'} (${kit.hubName(dep.toHubId)}) is ${status}: needed by ${date(dep.needBy)}, ${committed}${lateText}.`;
}

export function itemsDueSoon(kit: AgentKit, d: TechDeliverable, windowDays = 14): WorkItem[] {
  const limit = kit.plusDays(windowDays);
  return kit
    .stories(d.id)
    .filter((w) => !isClosed(w) && w.due !== null && w.due <= limit)
    .sort((a, b) => (a.due ?? '').localeCompare(b.due ?? '') || compareKeys(a.key, b.key));
}

export function outstandingStageReviews(kit: AgentKit, d: TechDeliverable) {
  const run = kit.ctx.idx.pdlcRunsByDeliverable.get(d.id);
  if (!run) return { run: null, reviews: [] as ReturnType<typeof outstandingReviews> };
  return { run, reviews: outstandingReviews(run, run.currentStage) };
}

/** Decisions the evidence calls for on one deliverable, most urgent first. */
export function decisionsFor(kit: AgentKit, d: TechDeliverable): Decision[] {
  const out: Decision[] = [];
  const rag = kit.results.deliverableRag[d.id];
  const readiness = kit.results.deliverables[d.id]?.readiness;
  const ms = milestoneFacts(kit, d).filter((f) => f.milestone.status === 'planned' && f.daysAway >= 0);
  const nextMs = ms[0];

  for (const dep of dependenciesInto(kit, d)) {
    if (!dep.critical || !isDependencyTroubled(dep, kit.input.clock)) continue;
    const provider = kit.deliverable(dep.fromDeliverableId);
    out.push({
      text: `Agree a recovery date for ${quote(dep.title)} with ${provider ? `${provider.ref} owner ${kit.person(provider.ownerId)}` : 'the provider'}, or re-plan ${d.ref} around it.`,
      refs: [ref.dependency(dep.id), ...(provider ? [ref.deliverable(provider.id)] : [])],
      rank: 1,
    });
  }
  if (readiness && readiness.failing.length > 0) {
    const evRefs = readiness.held.filter((h) => h.state === 'failing' && h.evidenceId).map((h) => ref.evidence(h.evidenceId as string));
    const kinds = listPhrases(readiness.failing.map((k) => lowerFirst(terms.evidenceKinds[k])));
    out.push({
      text: nextMs
        ? `Decide whether the failing ${kinds} can be fixed and rerun before ${quote(nextMs.milestone.title)} on ${date(nextMs.milestone.date)}, or move that date.`
        : `Decide how and when the failing ${kinds} will be fixed and rerun.`,
      refs: [...evRefs, ...(nextMs ? [ref.milestone(nextMs.milestone.id)] : [])],
      rank: 2,
    });
  }
  if (rag && rag.disagrees) {
    out.push({
      text: `Confirm at the next update whether the reported ${terms.rag[rag.reported]} in ${terms.systems['portfolio-system']} still stands; the evidence says ${terms.rag[rag.evidence]}. This report does not change it.`,
      refs: [ref.deliverable(d.id), ...rag.reasons.flatMap((r) => r.refs).slice(0, 4)],
      rank: 3,
    });
  }
  const unaccepted = (kit.ctx.idx.outcomesByDeliverable.get(d.id) ?? []).filter(
    (o) => (o.reportedStatus === 'on-track' || o.reportedStatus === 'complete') && kit.results.outcomes[o.id]?.acceptance.accepted === false,
  );
  if (unaccepted.length > 0) {
    out.push({
      text: `Ask the acceptance owners to record acceptance for ${plural(unaccepted.length, 'outcome')} reported on track, or report ${unaccepted.length === 1 ? 'it' : 'them'} at risk: ${listPhrases(unaccepted.map((o) => o.ref))}.`,
      refs: unaccepted.map((o) => ref.outcome(o.id)),
      rank: 4,
    });
  }
  const unowned = openRaid(kit, d).filter((r) => (r.severity === 'critical' || r.severity === 'high') && (!r.ownerId || !kit.ctx.idx.people.has(r.ownerId)));
  if (unowned.length > 0) {
    out.push({
      text: `Name an owner for ${listPhrases(unowned.map((r) => `${r.key} (${lowerFirst(terms.severity[r.severity])})`))}.`,
      refs: unowned.map((r) => ref.raid(r.id)),
      rank: 5,
    });
  }
  return out.sort((a, b) => a.rank - b.rank);
}

export function stageName(d: TechDeliverable): string {
  return stageDefinition(d.pdlcStage).name;
}
