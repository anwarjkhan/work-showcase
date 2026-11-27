/**
 * PDLC workflow helpers: immutable updates to a `PdlcRun`, and a read model
 * that gives the workflow screen everything per stage in one call, including
 * the deliverable's Core Four and, per review, who decides it, what they
 * confirm and whether the current actor may decide it now.
 */
import { GATE_ROLE, PDLC_STAGE_IDS, PDLC_STAGES, reviewConfirmation, stageDefinition, type PdlcStageDefinition } from '@/lib/config/pdlc';
import { terms } from '@/lib/config/terminology';
import { buildContext, canMoveBack, canMoveForward, isClosed, moveBackSuggestion, type TransitionCheck } from '@/lib/engine';
import { coreRoleHolder, coreTeamSeats, missingCoreRoles, sharedCoreSeats, type CoreSeatView } from '@/lib/engine/core-team';
import type {
  AgentId,
  CoreRole,
  EngineResult,
  Evidence,
  EvidenceKind,
  PdlcRun,
  PdlcStageId,
  PdlcStageState,
  PdlcReviewState,
  PortfolioData,
} from '@/lib/types';
import { checkReviewDecision, roleUnfilledReason } from './governance';
import { stageAgentId } from './registry';

/** Work product an agent's draft fills in, per stage. */
export const AGENT_WORK_PRODUCT: Partial<Record<PdlcStageId, Partial<Record<AgentId, string>>>> = {
  'ideation-requirements': { 'requirements-structuring': 'stories' },
  'design-specifications': { 'outcome-mapping': 'outcome-map' },
  'risk-control-compliance': { 'control-evidence-check': 'control-mapping' },
  'build-test-validate': { 'release-readiness': 'validation-report' },
  'delivery-launch': { 'release-readiness': 'launch-note' },
};

/** Work product a passing evidence record completes. */
export const EVIDENCE_WORK_PRODUCT: Partial<Record<EvidenceKind, string>> = {
  'test-result': 'test-results',
  'business-acceptance': 'acceptance',
  'release-checklist': 'release-checklist',
  'control-assessment': 'risk-assessment',
  'design-review': 'solution-design',
  'requirements-sign-off': 'problem-statement',
};

/** Stage that produces an evidence kind (first stage whose `evidenceLeft` lists it). */
export function producingStage(kind: EvidenceKind): PdlcStageId | null {
  return PDLC_STAGES.find((s) => s.evidenceLeft.includes(kind))?.id ?? null;
}

export function updateStage(run: PdlcRun, stageId: PdlcStageId, fn: (s: PdlcStageState) => PdlcStageState): PdlcRun {
  return { ...run, stages: { ...run.stages, [stageId]: fn(run.stages[stageId]) } };
}

export function setWorkProduct(stage: PdlcStageState, id: string, state: 'drafted' | 'complete', ref: PdlcStageState['workProducts'][number]['ref']): PdlcStageState {
  return {
    ...stage,
    workProducts: stage.workProducts.map((wp) => (wp.id === id && !(wp.state === 'complete' && state === 'drafted') ? { ...wp, state, ref } : wp)),
  };
}

/** Latest evidence of a kind for a deliverable (by observed time, then id). */
export function latestEvidence(data: PortfolioData, deliverableId: string, kind: EvidenceKind): Evidence | null {
  let best: Evidence | null = null;
  for (const e of data.evidence) {
    if (e.deliverableId !== deliverableId || e.kind !== kind) continue;
    if (!best || e.observedAt > best.observedAt || (e.observedAt === best.observedAt && e.id > best.id)) best = e;
  }
  return best;
}

/** One review of a stage, as the screen shows it. */
export interface ReviewView extends PdlcReviewState {
  /** The first review of the stage not yet approved (decided next, in order). */
  next: boolean;
  /** Same as `roleId`: the core role that decides it. */
  role: CoreRole;
  /** e.g. "In-Business Risk Lead". */
  roleLabel: string;
  /** e.g. "Risk". */
  roleShort: string;
  /** True for the Product Manager's gate decision (always last). */
  gate: boolean;
  /** Who holds the role on the deliverable now (from `coreTeam`); null when the seat is empty. */
  personId: string | null;
  personName: string | null;
  /** Verb phrase after "to": "confirm risk and controls". */
  confirms: string;
  /** Short outcome phrase: "Risk and controls confirmed for the second line". */
  confirmed: string;
  /** Evidence the review looks at (from config), if any. */
  evidenceBefore: EvidenceKind | null;
  /** Whether the current actor may decide it now (current stage, not yet approved, governance G2/G6). */
  canDecide: boolean;
  /** Why not (or why it can be decided), for a tooltip. */
  decideReason: string;
  /**
   * Set when even the role holder could not decide it now on Core Four grounds (an empty seat,
   * or the holder holds two core roles): switching persona will not help. Null otherwise.
   */
  holderBlocked: string | null;
  /** Button text: "Confirm as In-Business Risk Lead (Jordan Ellis)" or "Approve the gate as Product Manager (Anwar Khan)". */
  actionLabel: string;
}

/** One seat of the Core Four, as the screen shows it. */
export interface CoreSeat extends CoreSeatView {
  roleLabel: string;
  roleShort: string;
  personName: string | null;
}

/**
 * The next review to decide on the current stage, phrased as one click: who must act,
 * as which role, and whether the screen must first switch the acting persona.
 */
export interface NextReviewStep {
  kind: 'confirm' | 'approve-gate';
  stageId: PdlcStageId;
  roleId: CoreRole;
  roleLabel: string;
  /** Person to act as; null when the seat is empty. */
  personId: string | null;
  personName: string | null;
  /** "Confirm as In-Business Risk Lead (Jordan Ellis)" / "Approve the gate as Product Manager (Anwar Khan)". */
  label: string;
  /** What they confirm, or why nobody can decide it yet. */
  detail: string;
  /** True when the acting persona must switch to `personId` first (`actions.setActingAs(personId)`). */
  needsActAs: boolean;
  /** Set when no one can decide it until the Core Four is fixed (empty seat, or a person in two seats). */
  blocked: string | null;
}

export interface StageView {
  definition: PdlcStageDefinition;
  state: PdlcStageState;
  current: boolean;
  /** Agent that assists the stage (run it with `runStageAgent`). */
  agentId: AgentId | null;
  reviews: ReviewView[];
  /** Evidence the stage should leave, with the latest record of each kind. */
  evidence: { kind: EvidenceKind; latest: Evidence | null; result: Evidence['result'] | 'missing' }[];
  /** Simulated demo steps offered in this stage (Build, Test & Validate: "simulate work closed"). Label them as simulated. */
  simulatedSteps: SimulatedStep[];
}

export interface SimulatedStep {
  id: 'simulate-work-closed';
  label: string;
  /** Call `actions.simulateWorkClosed(deliverableId, actorId, { share })` when enabled. */
  enabled: boolean;
  /** Why it is enabled or disabled, for the UI. */
  reason: string;
  /** Open story-level items it would close (sub-tasks under them close too). */
  openItems: string[];
}

/** First stage from which work may be closed by the simulation. */
export const SIMULATE_WORK_FROM: PdlcStageId = 'build-test-validate';

/** Whether "simulate work closed" is allowed now for a deliverable, and which items it would close. */
export function checkSimulateWorkClosed(data: PortfolioData, deliverableId: string): SimulatedStep {
  const run = data.pdlcRuns.find((r) => r.deliverableId === deliverableId);
  const d = data.deliverables.find((x) => x.id === deliverableId);
  const base = { id: 'simulate-work-closed' as const, label: 'Simulate work closed' };
  if (!run || !d) return { ...base, enabled: false, reason: 'That deliverable has no PDLC workflow.', openItems: [] };
  const clock = { today: data.meta.asOf, now: `${data.meta.asOf}T00:00:00.000Z`, timeZone: 'UTC' };
  const open = (buildContext(data, clock).storiesByDeliverable.get(d.id) ?? [])
    .filter((w) => !isClosed(w))
    .map((w) => w.key)
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  if (PDLC_STAGE_IDS.indexOf(run.currentStage) < PDLC_STAGE_IDS.indexOf(SIMULATE_WORK_FROM)) {
    return { ...base, enabled: false, reason: `Work can be closed only from ${stageDefinition(SIMULATE_WORK_FROM).name} onwards; ${d.ref} is in ${stageDefinition(run.currentStage).name}.`, openItems: open };
  }
  if (open.length === 0) return { ...base, enabled: false, reason: `All story-level work of ${d.ref} is already closed.`, openItems: [] };
  return { ...base, enabled: true, reason: `Closes ${open.length} open story-level item${open.length === 1 ? '' : 's'} of ${d.ref} as a simulated step.`, openItems: open };
}

export interface WorkflowView {
  run: PdlcRun;
  /** The deliverable's Core Four in role order, gaps included. */
  coreTeam: CoreSeat[];
  /** Core roles with no named person, and people holding two roles (rule R15). */
  coreTeamGaps: { missing: CoreRole[]; shared: { personId: string; roles: CoreRole[] }[] };
  /** The person the review checks were made for (`canDecide`, `needsActAs`), or null. */
  actingAs: string | null;
  /** The next review on the current stage as a one-click step, or null when all are approved. */
  nextReview: NextReviewStep | null;
  stages: StageView[];
  forward: TransitionCheck;
  /** Back with a placeholder reason: `allowed` says whether there is a previous stage. */
  back: TransitionCheck;
  /** Offered when required evidence is failing (a failed test). */
  backSuggestion: { offer: boolean; to: PdlcStageId | null; reason: string };
}

/** "Confirm as In-Business Risk Lead (Jordan Ellis)" / "Approve the gate as Product Manager (Anwar Khan)". */
function actionLabelFor(roleId: CoreRole, personName: string | null): string {
  const who = `${terms.coreRoles[roleId]}${personName ? ` (${personName})` : ''}`;
  return roleId === GATE_ROLE ? `Approve the gate as ${who}` : `Confirm as ${who}`;
}

/** The next review to decide on the current stage as a one-click step (see `NextReviewStep`). */
export function nextReviewStep(view: Pick<WorkflowView, 'stages' | 'actingAs'>): NextReviewStep | null {
  const cur = view.stages.find((s) => s.current);
  const next = cur?.reviews.find((r) => r.next);
  if (!cur || !next) return null;
  const blocked = next.holderBlocked;
  return {
    kind: next.gate ? 'approve-gate' : 'confirm',
    stageId: cur.definition.id,
    roleId: next.roleId,
    roleLabel: next.roleLabel,
    personId: next.personId,
    personName: next.personName,
    label: next.actionLabel,
    detail: blocked ?? `${next.gate ? 'Go / no-go' : `${next.roleLabel} confirms`}: ${next.confirmed.charAt(0).toLowerCase()}${next.confirmed.slice(1)}.`,
    needsActAs: next.personId !== null && next.personId !== view.actingAs,
    blocked,
  };
}

/**
 * Everything the workflow screen needs for one deliverable, or null when it has no run.
 * `actingAs` (the presenter's persona) decides `canDecide` per review and whether the
 * next step must switch persona first; without it, `canDecide` is checked for each review's holder.
 */
export function describeWorkflow(data: PortfolioData, results: EngineResult, deliverableId: string, actingAs?: string | null): WorkflowView | null {
  const run = data.pdlcRuns.find((r) => r.deliverableId === deliverableId);
  const measures = results.deliverables[deliverableId];
  const deliverable = data.deliverables.find((x) => x.id === deliverableId);
  if (!run || !deliverable) return null;
  const people = new Map(data.people.map((p) => [p.id, p.name]));
  const nameOf = (id: string | null) => (id ? (people.get(id) ?? id) : null);
  const simulate = checkSimulateWorkClosed(data, deliverableId);
  const stages = PDLC_STAGES.map((def) => {
    const state = run.stages[def.id];
    const firstOpen = state.reviews.findIndex((r) => r.state !== 'approved');
    const current = run.currentStage === def.id;
    const reviews: ReviewView[] = state.reviews.map((r, i) => {
      const personId = coreRoleHolder(deliverable, r.roleId);
      const personName = nameOf(personId);
      const confirmation = reviewConfirmation(def.id, r.roleId);
      const actor = actingAs ?? personId;
      let canDecide = false;
      let decideReason: string;
      let holderBlocked: string | null = null;
      if (!current) decideReason = `${def.name} is not the current stage.`;
      else if (r.state === 'approved') decideReason = 'Already approved.';
      else {
        const check = checkReviewDecision(data, deliverableId, def.id, r.roleId, actor);
        canDecide = check.ok;
        decideReason = check.ok ? `${personName ?? 'The holder'} can decide this now.` : check.reason;
        if (!personId) holderBlocked = roleUnfilledReason(deliverable.ref, r.roleId);
        else {
          const forHolder = actor === personId ? check : checkReviewDecision(data, deliverableId, def.id, r.roleId, personId);
          if (!forHolder.ok && forHolder.code === 'two-core-roles') holderBlocked = forHolder.reason;
        }
      }
      return {
        ...r,
        next: i === firstOpen,
        role: r.roleId,
        roleLabel: terms.coreRoles[r.roleId],
        roleShort: terms.coreRolesShort[r.roleId],
        gate: r.roleId === GATE_ROLE,
        personId,
        personName,
        confirms: confirmation.confirms,
        confirmed: confirmation.confirmed,
        evidenceBefore: def.evidenceBefore[r.roleId] ?? null,
        canDecide,
        decideReason,
        holderBlocked,
        actionLabel: actionLabelFor(r.roleId, personName),
      };
    });
    return {
      definition: def,
      state,
      current,
      agentId: stageAgentId(def.id),
      reviews,
      evidence: def.evidenceLeft.map((kind) => {
        const latest = latestEvidence(data, deliverableId, kind);
        return { kind, latest, result: latest ? latest.result : ('missing' as const) };
      }),
      simulatedSteps: def.id === SIMULATE_WORK_FROM ? [simulate] : [],
    };
  });
  const coreTeam: CoreSeat[] = coreTeamSeats(deliverable).map((s) => ({ ...s, roleLabel: terms.coreRoles[s.roleId], roleShort: terms.coreRolesShort[s.roleId], personName: nameOf(s.personId) }));
  const base = { stages, actingAs: actingAs ?? null };
  return {
    run,
    coreTeam,
    coreTeamGaps: { missing: missingCoreRoles(deliverable), shared: sharedCoreSeats(deliverable) },
    actingAs: actingAs ?? null,
    nextReview: nextReviewStep(base),
    stages,
    forward: canMoveForward(run),
    back: canMoveBack(run, 'reason'),
    backSuggestion: measures ? moveBackSuggestion(run, measures.readiness) : { offer: false, to: null, reason: '' },
  };
}

export { stageDefinition };
