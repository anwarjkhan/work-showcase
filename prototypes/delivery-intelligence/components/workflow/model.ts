/**
 * Pure derivations for the PDLC workflow screen: the guided "next step", the
 * deliverable's workflow history, and small helpers. Everything is computed
 * from the store's data, engine result and audit trail; nothing is keyed to
 * step numbers, so the guidance follows whatever state the deliverable is in.
 */
import { AGENT_CATALOGUE } from '@/lib/agents/catalogue';
import type { WorkflowView } from '@/lib/agents/workflow';
import { formatDate } from '@/lib/config/clock';
import { PDLC_STAGES, stageDefinition } from '@/lib/config/pdlc';
import { terms } from '@/lib/config/terminology';
import type {
  AcceptanceCriterion,
  Actor,
  AgentId,
  AuditEvent,
  DeliverableMeasures,
  Evidence,
  EvidenceHeldState,
  EvidenceKind,
  Outcome,
  PdlcRun,
  PortfolioData,
  ProposedChange,
  Provenance,
  ReviewRoleId,
} from '@/lib/types';

// ---------------------------------------------------------------------------
// Next step
// ---------------------------------------------------------------------------

/** Targets the strip can point at. Controls carry the same string in `data-target`. */
export type NextTarget =
  | 'skip-playback'
  | 'run-agent'
  | `approve-proposal:${string}`
  | `act-as:${string}`
  | `approve-review:${string}`
  | `record:${string}`
  | `simulate:${string}:${'pass' | 'fail'}`
  | 'simulate-work:half'
  | 'simulate-work:rest'
  | 'move-back-offer'
  | 'move-forward'
  | `accept-criterion:${string}`
  | `record-acceptance:${string}`
  | 'ready';

export interface NextStep {
  target: NextTarget;
  /** One line, imperative. */
  label: string;
  /** Why, in a few words (optional). */
  detail?: string;
  tone: 'action' | 'warn' | 'done' | 'wait';
}

/** Evidence a review needs held and passing before it is decided (the reviewer reviews it). */
export const EVIDENCE_BEFORE_REVIEW: Partial<Record<ReviewRoleId, EvidenceKind>> = {
  'independent-validator': 'test-result',
  'business-owner': 'business-acceptance',
  'release-owner': 'release-checklist',
};

/** Evidence kinds that arrive from a system (simulated in the demo) rather than being recorded by a person. */
export const SYSTEM_FED_KINDS: EvidenceKind[] = ['test-result'];

export interface NextStepInput {
  view: WorkflowView;
  measures: DeliverableMeasures;
  /** Proposals of this deliverable. */
  proposals: ProposedChange[];
  outcomes: Outcome[];
  criteriaByOutcome: Map<string, AcceptanceCriterion[]>;
  evidence: Evidence[];
  actingAs: string;
  personName: (id: string) => string;
  /** True for the workflow-story deliverable: the walk-through includes a deliberate failed test. */
  walkthrough: boolean;
  /** An agent run is playing on screen. */
  playing: boolean;
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export function heldState(measures: DeliverableMeasures, kind: EvidenceKind): EvidenceHeldState {
  return measures.readiness.held.find((h) => h.kind === kind)?.state ?? 'missing';
}

/** Latest evidence of a kind (by observed time, then id). */
export function latestOf(evidence: Evidence[], kind: EvidenceKind): Evidence | null {
  let best: Evidence | null = null;
  for (const e of evidence) {
    if (e.kind !== kind) continue;
    if (!best || e.observedAt > best.observedAt || (e.observedAt === best.observedAt && e.id > best.id)) best = e;
  }
  return best;
}

/** True when the deliverable was already moved back after this failing record (the rework happened; a rerun is due). */
export function failureReworked(run: PdlcRun, failing: Evidence | null): boolean {
  if (!failing) return false;
  return run.moves.some((m) => m.direction === 'back' && m.at >= failing.observedAt);
}

/** Failing evidence that drives the move-back offer, if any. */
export function failingEvidence(view: WorkflowView, evidence: Evidence[], measures: DeliverableMeasures): Evidence | null {
  for (const kind of measures.readiness.failing) {
    const e = latestOf(evidence, kind);
    if (e && e.result === 'fail') return e;
  }
  void view;
  return null;
}

export function agentName(id: AgentId | null): string {
  return id ? AGENT_CATALOGUE[id].name : '';
}

export function deriveNextStep(input: NextStepInput): NextStep | null {
  const { view, measures, actingAs, personName } = input;
  if (input.playing) return { target: 'skip-playback', label: 'The agent is working: watch its steps, or skip to the result', tone: 'wait' };
  const cur = view.stages.find((s) => s.current);
  if (!cur) return null;
  const stage = cur.definition;
  const required = measures.readiness.requiredEvidence;
  const lastStage = stage.order === PDLC_STAGES.length;

  // 1. The stage's agent assists first.
  if (cur.agentId && cur.state.agentRunIds.length === 0) {
    return { target: 'run-agent', label: `Run the ${lower(agentName(cur.agentId))} agent`, detail: `${terms.agentModes[AGENT_CATALOGUE[cur.agentId].mode]}: ${lower(AGENT_CATALOGUE[cur.agentId].output)}.`, tone: 'action' };
  }

  // 2. Anything it proposed needs a named person's decision.
  const pending = input.proposals.find((p) => p.status === 'pending' && cur.state.agentRunIds.includes(p.runId));
  if (pending) {
    const stories = pending.patch.op === 'add-work-items';
    return {
      target: `approve-proposal:${pending.id}`,
      label: stories ? 'Approve the proposed stories' : `Approve the proposed change: ${lower(pending.title)}`,
      detail: stories ? 'A human approval: nothing is added until a named person approves.' : pending.rationale,
      tone: 'action',
    };
  }

  // 3. Failing evidence: offer the move back, unless the rework has already happened.
  const failing = failingEvidence(view, input.evidence, measures);
  if (view.backSuggestion.offer && view.backSuggestion.to && !failureReworked(view.run, failing)) {
    return { target: 'move-back-offer', label: `Move back to ${stageDefinition(view.backSuggestion.to).name}`, detail: view.backSuggestion.reason, tone: 'warn' };
  }

  // 4. Build, Test & Validate: close the work (simulated) before any test evidence arrives.
  const sim = cur.simulatedSteps.find((s) => s.enabled);
  if (sim && heldState(measures, 'test-result') === 'missing' && !latestOf(input.evidence, 'test-result')) {
    const closed = measures.workCompletion.computable ? measures.workCompletion.value.closedPoints : 0;
    return closed === 0
      ? { target: 'simulate-work:half', label: 'Simulate work closed: the first half of the open items', detail: 'Labelled simulated. Work completion moves; acceptance and readiness do not.', tone: 'action' }
      : { target: 'simulate-work:rest', label: 'Simulate the rest of the work closed', detail: 'Labelled simulated. Work completion reaches its end; the other two measures still have not moved.', tone: 'action' };
  }

  // 5. The next review, with the evidence it reviews in place first.
  const next = cur.reviews.find((r) => r.next);
  if (next) {
    const before = EVIDENCE_BEFORE_REVIEW[next.roleId];
    if (before && stage.evidenceLeft.includes(before) && required.includes(before) && heldState(measures, before) !== 'passing') {
      const step = evidenceStep(before, input, failing);
      if (step) return step;
    }
    const reviewer = next.reviewerId;
    const roleLabel = lower(terms.reviewRoles[next.roleId]);
    if (reviewer && reviewer !== actingAs) {
      return { target: `act-as:${reviewer}`, label: `Act as ${personName(reviewer)}, the named ${roleLabel}`, detail: `Only the named ${roleLabel} can decide this review.`, tone: 'action' };
    }
    return {
      target: `approve-review:${next.roleId}`,
      label: `Approve the ${lower(stage.shortName)} review as ${roleLabel}`,
      detail: stage.reviews.length > 1 ? `Review ${stage.reviews.indexOf(next.roleId) + 1} of ${stage.reviews.length} in this stage.` : undefined,
      tone: 'action',
    };
  }

  // 6. Evidence the approved stage should leave behind.
  for (const kind of stage.evidenceLeft) {
    if (Object.values(EVIDENCE_BEFORE_REVIEW).includes(kind)) continue;
    if (!required.includes(kind) || heldState(measures, kind) === 'passing') continue;
    return { target: `record:${kind}`, label: `Record the ${lower(terms.evidenceKinds[kind])}`, detail: `Evidence this stage leaves behind; ${terms.riskTiers[measures.readiness.riskTier]} requires it for readiness.`, tone: 'action' };
  }

  // 7. Forward.
  if (view.forward.allowed && view.forward.to) {
    return { target: 'move-forward', label: `Move forward to ${stageDefinition(view.forward.to).name}`, detail: view.forward.reason, tone: 'action' };
  }

  // 8. The end.
  if (lastStage && measures.readiness.state === 'ready') {
    return { target: 'ready', label: 'Ready: every review approved, every required record held and passing', tone: 'done' };
  }
  return null;
}

function evidenceStep(kind: EvidenceKind, input: NextStepInput, failing: Evidence | null): NextStep | null {
  const { measures, actingAs, personName } = input;
  const state = heldState(measures, kind);
  if (kind === 'test-result') {
    if (state === 'failing') {
      return failureReworked(input.view.run, failing)
        ? { target: 'simulate:test-result:pass', label: 'Simulate the rerun: pass', detail: 'A passing rerun clears the failure; readiness no longer reads Not ready.', tone: 'action' }
        : null;
    }
    if (state === 'missing' && input.walkthrough && !latestOf(input.evidence, 'test-result')) {
      return { target: 'simulate:test-result:fail', label: 'Simulate the test result: fail', detail: 'A deliberate failure: watch readiness turn Not ready and the move back being offered.', tone: 'warn' };
    }
    return { target: 'simulate:test-result:pass', label: state === 'missing' ? 'Simulate the test result: pass' : 'Simulate a fresh test result: pass', detail: `The held test result is ${lower(terms.evidenceHeld[state])}.`, tone: 'action' };
  }
  if (kind === 'business-acceptance') {
    const acc = measures.acceptedOutcomes.computable ? measures.acceptedOutcomes.value.outcomes : [];
    for (const o of input.outcomes) {
      if (acc.find((a) => a.outcomeId === o.id)?.accepted) continue;
      const open = (input.criteriaByOutcome.get(o.id) ?? []).filter((c) => c.mandatory && c.state !== 'accepted');
      if (o.acceptanceOwnerId !== actingAs) {
        return { target: `act-as:${o.acceptanceOwnerId}`, label: `Act as ${personName(o.acceptanceOwnerId)}, acceptance owner of ${o.ref}`, detail: 'Only the named acceptance owner can accept criteria and record business acceptance.', tone: 'action' };
      }
      if (open.length > 0) {
        const all = (input.criteriaByOutcome.get(o.id) ?? []).filter((c) => c.mandatory);
        return {
          target: `accept-criterion:${open[0]!.id}`,
          label: `Accept the outcome's criteria`,
          detail: `${o.ref}: ${all.length - open.length} of ${all.length} mandatory criteria accepted. Accepting them alone does not accept the outcome.`,
          tone: 'action',
        };
      }
      return { target: `record-acceptance:${o.id}`, label: 'Record business acceptance', detail: `${o.ref} is accepted only with a business acceptance record from its owner.`, tone: 'action' };
    }
    const first = input.outcomes[0];
    return first ? { target: `record-acceptance:${first.id}`, label: 'Record business acceptance', tone: 'action' } : null;
  }
  if (kind === 'release-checklist') return { target: 'record:release-checklist', label: 'Record the release checklist', detail: 'The last record readiness needs.', tone: 'action' };
  return { target: `record:${kind}`, label: `Record the ${lower(terms.evidenceKinds[kind])}`, tone: 'action' };
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export type HistoryActor = { kind: 'person'; id: string; name: string; initials: string } | { kind: 'agent'; name: string } | { kind: 'system'; name: string };

export type HistoryKind = 'move-forward' | 'move-back' | 'review-approved' | 'review-returned' | 'evidence' | 'criterion' | 'agent' | 'proposal' | 'blocked' | 'work';

export interface HistoryItem {
  id: string;
  at: string;
  kind: HistoryKind;
  actor: HistoryActor;
  title: string;
  detail?: string;
  tone: 'neutral' | 'green' | 'red' | 'amber' | 'accent';
  provenance?: Provenance;
}

interface HistoryContext {
  data: PortfolioData;
  deliverableId: string;
  run: PdlcRun | undefined;
  audit: AuditEvent[];
  proposals: ProposedChange[];
}

export function buildHistory({ data, deliverableId, run, audit, proposals }: HistoryContext): HistoryItem[] {
  const people = new Map(data.people.map((p) => [p.id, p]));
  const person = (id: string | null | undefined): HistoryActor => {
    const p = id ? people.get(id) : undefined;
    return p ? { kind: 'person', id: p.id, name: p.name, initials: p.initials } : { kind: 'system', name: id ?? 'System' };
  };
  const actorOf = (a: Actor): HistoryActor =>
    a.kind === 'human' ? person(a.personId) : a.kind === 'agent' ? { kind: 'agent', name: AGENT_CATALOGUE[a.agentId]?.name ?? a.agentId } : { kind: 'system', name: 'System' };
  const items: HistoryItem[] = [];

  if (run) {
    for (const m of run.moves) {
      items.push({
        id: m.id,
        at: m.at,
        kind: m.direction === 'back' ? 'move-back' : 'move-forward',
        actor: actorOf(m.by),
        title: `Moved ${m.direction} to ${stageDefinition(m.to).name}`,
        detail: m.reason ?? undefined,
        tone: m.direction === 'back' ? 'amber' : 'accent',
      });
    }
    for (const def of PDLC_STAGES) {
      for (const r of run.stages[def.id].reviews) {
        for (const d of r.decisions) {
          items.push({
            id: d.id,
            at: d.decidedAt,
            kind: d.decision === 'approved' ? 'review-approved' : 'review-returned',
            actor: person(d.reviewerId),
            title: `${d.decision === 'approved' ? 'Approved' : 'Returned'} the ${lower(terms.reviewRoles[d.roleId])} review (${def.shortName})`,
            detail: d.reason ?? undefined,
            tone: d.decision === 'approved' ? 'green' : 'red',
          });
        }
      }
    }
  }

  for (const e of data.evidence) {
    if (e.deliverableId !== deliverableId) continue;
    items.push({
      id: e.id,
      at: e.observedAt,
      kind: 'evidence',
      actor: e.recordedById ? person(e.recordedById) : { kind: 'system', name: terms.systems[e.source] },
      title: `${terms.evidenceKinds[e.kind]}: ${terms.evidenceResults[e.result].toLowerCase()}`,
      detail: `${e.title} · ${terms.systems[e.source]} ${e.sourceRef}`,
      tone: e.result === 'pass' ? 'green' : e.result === 'fail' ? 'red' : 'neutral',
      provenance: e.provenance,
    });
  }

  const outcomeIds = new Set(data.outcomes.filter((o) => o.deliverableId === deliverableId).map((o) => o.id));
  const outcomeRef = new Map(data.outcomes.map((o) => [o.id, o.ref]));
  for (const c of data.criteria) {
    if (!outcomeIds.has(c.outcomeId) || c.state !== 'accepted' || !c.acceptedAt) continue;
    items.push({ id: `crit-${c.id}`, at: c.acceptedAt, kind: 'criterion', actor: person(c.acceptedById), title: `Accepted a criterion of ${outcomeRef.get(c.outcomeId)}`, detail: c.text, tone: 'green' });
  }

  // Session-only events that leave no record of their own in the data.
  const proposalIds = new Set(proposals.filter((p) => p.deliverableId === deliverableId).map((p) => p.id));
  const criterionIds = new Set(data.criteria.filter((c) => outcomeIds.has(c.outcomeId)).map((c) => c.id));
  const relevant = (e: AuditEvent) =>
    [e.subject, ...e.refs].some(
      (r) =>
        (r.kind === 'deliverable' && r.id === deliverableId) ||
        (r.kind === 'pdlc-run' && run && r.id === run.id) ||
        (r.kind === 'proposal' && proposalIds.has(r.id)) ||
        (r.kind === 'criterion' && criterionIds.has(r.id)) ||
        (r.kind === 'outcome' && outcomeIds.has(r.id)),
    );
  for (const e of audit) {
    if (!relevant(e)) continue;
    switch (e.action) {
      case 'pdlc.stage-agent-run': {
        const agentId = e.details.agentId as AgentId | undefined;
        items.push({ id: e.id, at: e.at, kind: 'agent', actor: { kind: 'agent', name: agentId ? AGENT_CATALOGUE[agentId].name : 'Agent' }, title: e.summary, detail: e.actor.kind === 'human' ? `Started by ${person(e.actor.personId).name}` : undefined, tone: 'neutral', provenance: 'scripted-agent' });
        break;
      }
      case 'proposal.approved':
      case 'proposal.rejected':
        items.push({ id: e.id, at: e.at, kind: 'proposal', actor: actorOf(e.actor), title: e.summary, tone: e.action === 'proposal.approved' ? 'green' : 'neutral' });
        break;
      case 'proposal.auto-applied':
        items.push({ id: e.id, at: e.at, kind: 'proposal', actor: actorOf(e.actor), title: e.summary, tone: 'accent', provenance: 'scripted-agent' });
        break;
      case 'criterion.rejected':
        items.push({ id: e.id, at: e.at, kind: 'criterion', actor: actorOf(e.actor), title: e.summary, tone: 'red' });
        break;
      case 'governance.blocked':
        items.push({ id: e.id, at: e.at, kind: 'blocked', actor: actorOf(e.actor), title: 'Refused by governance', detail: e.summary, tone: 'red' });
        break;
      case 'evidence.simulated':
        if (e.details.simulation === 'work-closed') items.push({ id: e.id, at: e.at, kind: 'work', actor: actorOf(e.actor), title: e.summary, tone: 'accent', provenance: 'simulated' });
        break;
      default:
        break;
    }
  }

  return items.sort((a, b) => (a.at === b.at ? b.id.localeCompare(a.id, 'en', { numeric: true }) : a.at < b.at ? 1 : -1));
}

/** "8 Mar 2027, 09:14" for timestamps on the store clock; dates only for plain dates. */
export function formatStamp(at: string): string {
  if (at.length <= 10) return formatDate(at);
  return `${formatDate(at)}, ${at.slice(11, 16)}`;
}
