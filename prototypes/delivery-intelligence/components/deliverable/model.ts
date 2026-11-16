/**
 * Pure view-model for the deliverable detail screen. Everything here is read
 * from the portfolio data and the engine result; nothing is hard-coded and no
 * wall clock is used (the demo clock is passed in).
 */
import { daysBetween } from '@/lib/config/clock';
import { terms } from '@/lib/config/terminology';
import { RULE_THRESHOLDS } from '@/lib/config/thresholds';
import { buildContext, dependencyKnockOn, dependencyLateDays, evidenceStaleness, isClosed, type EngineContext, type KnockOn } from '@/lib/engine';
import { currentEvidenceByKind, recordState } from '@/lib/engine/evidence';
import { indexPortfolio } from '@/lib/store/indexes';
import type {
  AcceptanceCriterion,
  AgentIdentity,
  DemoClock,
  Dependency,
  DeliverableMeasures,
  EngineResult,
  Evidence,
  EvidenceHeldState,
  EvidenceKind,
  EvidenceRag,
  Finding,
  Hub,
  Milestone,
  Outcome,
  OutcomeMeasures,
  Person,
  PmNode,
  Pod,
  PortfolioData,
  RaidItem,
  TechDeliverable,
  WorkItem,
} from '@/lib/types';

export interface EpicRow {
  key: string;
  summary: string;
  /** The Deliverable ID field on the Epic. */
  deliverableIdField: string | null;
  hubId: string | null;
  closedPoints: number;
  totalPoints: number;
  itemCount: number;
  closedItemCount: number;
  /** True when the Epic's Deliverable ID does not point at this deliverable. */
  mismatch: boolean;
}

export interface WorkRow {
  item: WorkItem;
  closed: boolean;
  outcomeRef: string | null;
  noOutcome: boolean;
  agentNoReviewer: boolean;
}

export interface CriterionRow {
  criterion: AcceptanceCriterion;
  acceptedBy: string | null;
}

export interface OutcomeRow {
  outcome: Outcome;
  measures: OutcomeMeasures | undefined;
  criteria: CriterionRow[];
  acceptanceEvidence: Evidence[];
  accepted: boolean;
  /** Reported on track or complete in the portfolio system, but not accepted. */
  gap: boolean;
  gapText: string | null;
  acceptanceOwner: string | null;
}

export interface EvidenceRow {
  evidence: Evidence;
  state: Exclude<EvidenceHeldState, 'missing'>;
  /** The latest record for its kind and scope (older ones are superseded). */
  current: boolean;
  stale: boolean;
  staleReason: string | null;
  covers: string;
}

export interface MatrixRow {
  kind: EvidenceKind;
  state: EvidenceHeldState;
  evidenceId: string | null;
  observedAt: string | null;
}

export interface RaidRow {
  item: RaidItem;
  ageDays: number;
  stale: boolean;
  noOwner: boolean;
  noMitigation: boolean;
  open: boolean;
}

export interface DependencyRow {
  dependency: Dependency;
  direction: 'in' | 'out';
  lateDays: number;
  open: boolean;
  knockOn: KnockOn | null;
}

export interface MilestoneRow {
  milestone: Milestone;
  daysAway: number;
  shiftedTo: string | null;
  shiftDays: number;
  drivenBy: string | null;
}

export interface WorkShareRow {
  human: number;
  agent: number;
  humanPoints: number;
  agentPoints: number;
  agentShare: number;
}

export interface MemberRow {
  person: Person;
  assigned: number;
  reviewing: number;
  isLead: boolean;
  isOwner: boolean;
}

export interface AgentRow {
  identity: AgentIdentity;
  assigned: number;
}

export interface DeliverableModel {
  deliverable: TechDeliverable;
  ctx: EngineContext;
  measures: DeliverableMeasures;
  rag: EvidenceRag | undefined;
  programmePath: PmNode[];
  programme: PmNode | null;
  hubs: Hub[];
  pod: Pod | undefined;
  owner: Person | undefined;
  outcomes: OutcomeRow[];
  epics: EpicRow[];
  work: WorkRow[];
  evidence: EvidenceRow[];
  matrix: MatrixRow[];
  raid: RaidRow[];
  dependencies: DependencyRow[];
  milestones: MilestoneRow[];
  findings: Finding[];
  members: MemberRow[];
  agents: AgentRow[];
  share: WorkShareRow;
  verdict: Verdict;
  /** Deliverables in the same programme (or the standalone set), in ref order, for previous / next. */
  siblings: TechDeliverable[];
  /** Planned work completion today (0..100) from the planned window, for the progress marker. */
  plannedPercent: number | null;
}

export interface Verdict {
  /** True when reported and evidence-based status differ and evidence is known. */
  disagrees: boolean;
  /** The one-sentence verdict in plain words. */
  sentence: string;
  /** The individual clauses the sentence is built from (each from the engine's reasons). */
  clauses: string[];
}

const listWords = (items: string[]): string => (items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Root of the programme path for grouping (the programme-level node, or the topmost node). */
export function programmePathOf(data: PortfolioData, d: TechDeliverable): PmNode[] {
  const idx = indexPortfolio(data);
  const path: PmNode[] = [];
  let node = d.pmNodeId ? idx.pmNodes.get(d.pmNodeId) : undefined;
  const seen = new Set<string>();
  while (node && !seen.has(node.id)) {
    seen.add(node.id);
    path.unshift(node);
    node = node.parentId ? idx.pmNodes.get(node.parentId) : undefined;
  }
  return path;
}

/** The deliverables that share this deliverable's programme (or the standalone ones), in ref order. */
export function siblingsOf(data: PortfolioData, d: TechDeliverable): TechDeliverable[] {
  const root = programmePathOf(data, d)[0]?.id ?? null;
  return data.deliverables
    .filter((x) => (programmePathOf(data, x)[0]?.id ?? null) === root)
    .sort((a, b) => a.ref.localeCompare(b.ref, 'en', { numeric: true }));
}

function buildVerdict(
  data: PortfolioData,
  ctx: EngineContext,
  d: TechDeliverable,
  rag: EvidenceRag | undefined,
  measures: DeliverableMeasures,
  findings: Finding[],
  clock: DemoClock,
): Verdict {
  const idx = ctx.idx;
  const reported = d.reportedRag;
  const evidence = rag?.evidence ?? 'unknown';
  const disagrees = Boolean(rag?.disagrees) && evidence !== 'unknown';
  const r = measures.readiness;
  const clauses: string[] = [];

  for (const kind of r.failing) {
    const rec = (currentEvidenceByKind(ctx, d.id).get(kind) ?? []).find((e) => e.result === 'fail');
    clauses.push(`the required ${terms.evidenceKinds[kind].toLowerCase()}${rec ? ` (${rec.title})` : ''} is failing`);
  }
  if (r.missing.length > 0) clauses.push(`${listWords(r.missing.map((k) => terms.evidenceKinds[k].toLowerCase()))} ${r.missing.length === 1 ? 'evidence is' : 'evidence are'} missing`);
  if (r.stale.length > 0) clauses.push(`${listWords(r.stale.map((k) => terms.evidenceKinds[k].toLowerCase()))} evidence is stale`);

  const depIds = new Set<string>(r.blockingDependencyIds);
  for (const f of findings) if (f.ruleId === 'R5') for (const e of f.evidence) if (e.kind === 'dependency') depIds.add(e.id);
  for (const id of depIds) {
    const dep = idx.dependencies.get(id);
    if (!dep) continue;
    const provider = idx.deliverables.get(dep.fromDeliverableId);
    const hub = idx.hubs.get(dep.fromHubId);
    const late = dependencyLateDays(dep, clock);
    clauses.push(
      `a dependency from ${hub ? `${hub.city}` : (provider?.ref ?? 'another deliverable')} is ${dep.status === 'blocked' ? 'blocked' : late > 0 ? `${plural(late, 'day')} late` : 'at risk'}`,
    );
  }

  const staleRaid = findings.filter((f) => f.ruleId === 'R4').flatMap((f) => f.evidence.filter((e) => e.kind === 'raid'));
  const seenRaid = new Set<string>();
  for (const e of staleRaid) {
    if (seenRaid.has(e.id)) continue;
    seenRaid.add(e.id);
    const item = idx.raid.get(e.id);
    if (!item) continue;
    const age = daysBetween(item.updated, clock.today);
    if (age > RULE_THRESHOLDS.raidStaleDays) clauses.push(`the linked ${terms.raidKinds[item.kind].toLowerCase()} ${item.key} has not been updated for ${plural(age, 'day')}`);
  }

  const shown = clauses.slice(0, 4);
  const more = clauses.length - shown.length;
  const tail = shown.length > 0 ? `${listWords(shown)}${more > 0 ? `, and ${more} more` : ''}` : '';
  let sentence: string;
  if (disagrees) {
    sentence = `Reported ${terms.rag[reported]} in the ${terms.systems['portfolio-system'].toLowerCase()}, but the evidence says ${terms.rag[evidence]}${tail ? `: ${tail}` : (rag?.reasons[0] ? `: ${rag.reasons[0].message}` : '')}.`;
  } else if (evidence === 'unknown') {
    sentence = `Reported ${terms.rag[reported]}. There is too little data to compute an evidence-based status${rag?.reasons[0] ? `: ${rag.reasons[0].message}` : ''}`.replace(/\.?$/, '.');
  } else if (clauses.length > 0) {
    sentence = `Reported and evidence-based status agree at ${terms.rag[evidence]}, with ${plural(clauses.length, 'open point')} to watch: ${tail}.`;
  } else {
    sentence = `Reported and evidence-based status agree at ${terms.rag[evidence]}: no critical or high findings, and the required evidence is in order.`;
  }
  return { disagrees, sentence, clauses };
}

export function buildDeliverableModel(data: PortfolioData, result: EngineResult, clock: DemoClock, id: string): DeliverableModel | null {
  const idx = indexPortfolio(data);
  const d = idx.deliverables.get(id);
  const measures = result.deliverables[id];
  if (!d || !measures) return null;
  const ctx = buildContext(data, clock);
  const today = clock.today;
  const rag = result.deliverableRag[id];
  const findings = result.findings.filter((f) => f.deliverableId === id); // already ordered most severe first

  // --- Work --------------------------------------------------------------
  const stories = ctx.storiesByDeliverable.get(id) ?? [];
  const work: WorkRow[] = stories.map((item) => {
    const outcome = item.outcomeId ? ctx.resolveOutcome(item.outcomeId) : undefined;
    return {
      item,
      closed: isClosed(item),
      outcomeRef: outcome?.id ?? null,
      noOutcome: !item.outcomeId,
      agentNoReviewer: item.assigneeType === 'agent' && !item.reviewerId,
    };
  });
  const epicKeys = ctx.epicsByDeliverable.get(id) ?? d.epicKeys;
  const epics: EpicRow[] = epicKeys.map((key) => {
    const epic = idx.workItems.get(key);
    const children = stories.filter((s) => s.epicKey === key);
    const closed = children.filter(isClosed);
    return {
      key,
      summary: epic?.summary ?? key,
      deliverableIdField: epic?.deliverableId ?? null,
      hubId: epic?.hubId ?? null,
      closedPoints: closed.reduce((s, w) => s + (w.points ?? 0), 0),
      totalPoints: children.reduce((s, w) => s + (w.points ?? 0), 0),
      itemCount: children.length,
      closedItemCount: closed.length,
      mismatch: !epic || (epic.deliverableId !== null && epic.deliverableId !== id),
    };
  });

  // --- Outcomes ----------------------------------------------------------
  const outcomes: OutcomeRow[] = (idx.outcomesByDeliverable.get(id) ?? [])
    .slice()
    .sort((a, b) => a.ref.localeCompare(b.ref, 'en', { numeric: true }))
    .map((outcome) => {
      const m = result.outcomes[outcome.id];
      const accepted = m?.acceptance.accepted ?? false;
      const reportedGood = outcome.reportedStatus === 'on-track' || outcome.reportedStatus === 'complete';
      const gap = !accepted && reportedGood;
      const acc = m?.acceptance;
      return {
        outcome,
        measures: m,
        criteria: (idx.criteriaByOutcome.get(outcome.id) ?? []).map((criterion) => ({
          criterion,
          acceptedBy: criterion.acceptedById ? (idx.people.get(criterion.acceptedById)?.name ?? null) : null,
        })),
        acceptanceEvidence: (idx.evidenceByDeliverable.get(id) ?? []).filter((e) => e.kind === 'business-acceptance' && e.outcomeId === outcome.id),
        accepted,
        gap,
        gapText: gap
          ? `${outcome.reportedStatus === 'complete' ? 'Reported complete' : 'Reported on track'} in the ${terms.systems['portfolio-system'].toLowerCase()}, but not accepted: ${acc ? `${acc.mandatoryAccepted} of ${acc.mandatoryCount} mandatory criteria accepted` : 'no acceptance recorded'}${acc && acc.businessAcceptanceEvidenceIds.length === 0 ? ', no business acceptance record' : ''}.`
          : null,
        acceptanceOwner: idx.people.get(outcome.acceptanceOwnerId)?.name ?? null,
      };
    });

  // --- Evidence ----------------------------------------------------------
  const currentIds = new Set<string>();
  for (const list of currentEvidenceByKind(ctx, id).values()) for (const e of list) currentIds.add(e.id);
  const evidence: EvidenceRow[] = (idx.evidenceByDeliverable.get(id) ?? []).map((e) => {
    const st = evidenceStaleness(ctx, e);
    const covers = e.workItemKey
      ? `Work item ${e.workItemKey}`
      : e.outcomeId
        ? `Outcome ${idx.outcomes.get(e.outcomeId)?.ref ?? e.outcomeId}`
        : 'Whole deliverable';
    return {
      evidence: e,
      state: recordState(e, st),
      current: currentIds.has(e.id),
      stale: st.stale,
      staleReason: st.stale && st.changedItemKey ? `${st.changedItemKey} changed after this was observed` : null,
      covers,
    };
  });
  const matrix: MatrixRow[] = measures.readiness.requiredEvidence.map((kind) => {
    const h = measures.readiness.held.find((x) => x.kind === kind);
    return { kind, state: h?.state ?? 'missing', evidenceId: h?.evidenceId ?? null, observedAt: h?.observedAt ?? null };
  });

  // --- RAID, dependencies, milestones -----------------------------------
  const severityRank = { critical: 0, high: 1, medium: 2, low: 3 } as const;
  const raid: RaidRow[] = (ctx.raidByDeliverable.get(id) ?? [])
    .map((item) => {
      const open = item.status !== 'closed';
      const ageDays = daysBetween(item.updated, today);
      return { item, ageDays, open, stale: open && ageDays > RULE_THRESHOLDS.raidStaleDays, noOwner: open && !item.ownerId, noMitigation: open && !item.mitigationDue };
    })
    .sort((a, b) => Number(b.open) - Number(a.open) || severityRank[a.item.severity] - severityRank[b.item.severity] || b.ageDays - a.ageDays);

  const knockOns = dependencyKnockOn(ctx);
  const dependencies: DependencyRow[] = [
    ...(ctx.dependenciesInto.get(id) ?? []).map((dep) => ({ dep, direction: 'in' as const })),
    ...(ctx.dependenciesFrom.get(id) ?? []).map((dep) => ({ dep, direction: 'out' as const })),
  ].map(({ dep, direction }) => ({
    dependency: dep,
    direction,
    lateDays: dependencyLateDays(dep, clock),
    open: dep.status !== 'delivered' && dep.deliveredOn === null,
    knockOn: knockOns.find((k) => k.dependencyId === dep.id) ?? null,
  }));

  const intoKnock = knockOns.filter((k) => k.receiverId === id);
  const milestones: MilestoneRow[] = (ctx.milestonesByDeliverable.get(id) ?? [])
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((milestone) => {
      let shiftedTo: string | null = null;
      let drivenBy: string | null = null;
      for (const k of intoKnock) {
        const hit = k.affectedMilestones.find((m) => m.milestoneId === milestone.id);
        if (hit && (!shiftedTo || hit.shiftedTo > shiftedTo)) {
          shiftedTo = hit.shiftedTo;
          drivenBy = k.dependencyId;
        }
      }
      return { milestone, daysAway: daysBetween(today, milestone.date), shiftedTo, shiftDays: shiftedTo ? daysBetween(milestone.date, shiftedTo) : 0, drivenBy };
    });

  // --- Pod ---------------------------------------------------------------
  const pod = idx.pods.get(d.podId);
  const humanItems = stories.filter((s) => s.assigneeType === 'human');
  const agentItems = stories.filter((s) => s.assigneeType === 'agent');
  const pts = (list: WorkItem[]) => list.reduce((s, w) => s + (w.points ?? 0), 0);
  const share: WorkShareRow = {
    human: humanItems.length,
    agent: agentItems.length,
    humanPoints: pts(humanItems),
    agentPoints: pts(agentItems),
    agentShare: stories.length === 0 ? 0 : agentItems.length / stories.length,
  };
  const memberIds = new Set<string>([...(pod?.memberIds ?? []), d.ownerId]);
  const members: MemberRow[] = [...memberIds]
    .map((pid) => idx.people.get(pid))
    .filter((p): p is Person => Boolean(p))
    .map((person) => ({
      person,
      assigned: stories.filter((s) => s.assigneeType === 'human' && s.assigneeId === person.id).length,
      reviewing: stories.filter((s) => s.reviewerId === person.id).length,
      isLead: pod?.leadId === person.id,
      isOwner: d.ownerId === person.id,
    }));
  const agents: AgentRow[] = (pod?.agentIdentityIds ?? [])
    .map((aid) => idx.agentIdentities.get(aid))
    .filter((a): a is AgentIdentity => Boolean(a))
    .map((identity) => ({ identity, assigned: stories.filter((s) => s.assigneeType === 'agent' && s.assigneeId === identity.id).length }));

  const programmePath = programmePathOf(data, d);
  const planned = plannedPercentOf(d, today);

  return {
    deliverable: d,
    ctx,
    measures,
    rag,
    programmePath,
    programme: programmePath.find((n) => n.level === 'programme') ?? programmePath[0] ?? null,
    hubs: d.hubIds.map((h) => idx.hubs.get(h)).filter((h): h is Hub => Boolean(h)),
    pod,
    owner: idx.people.get(d.ownerId),
    outcomes,
    epics,
    work,
    evidence,
    matrix,
    raid,
    dependencies,
    milestones,
    findings,
    members,
    agents,
    share,
    verdict: buildVerdict(data, ctx, d, rag, measures, findings, clock),
    siblings: siblingsOf(data, d),
    plannedPercent: planned,
  };
}

/** Straight-line share of the planned window that has elapsed by today (null when the window is invalid). */
export function plannedPercentOf(d: Pick<TechDeliverable, 'plannedStart' | 'plannedEnd'>, today: string): number | null {
  const total = daysBetween(d.plannedStart, d.plannedEnd);
  if (total <= 0) return null;
  const elapsed = daysBetween(d.plannedStart, today);
  return Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
}

/** Per-kind sentence for the required-versus-held matrix. */
export function heldSentence(state: EvidenceHeldState): string {
  return terms.evidenceHeld[state];
}
