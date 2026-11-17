/**
 * PDLC workflow helpers: immutable updates to a `PdlcRun`, and a read model
 * that gives the workflow screen everything per stage in one call.
 */
import { PDLC_STAGE_IDS, PDLC_STAGES, stageDefinition, type PdlcStageDefinition } from '@/lib/config/pdlc';
import { buildContext, canMoveBack, canMoveForward, isClosed, moveBackSuggestion, type TransitionCheck } from '@/lib/engine';
import type {
  AgentId,
  EngineResult,
  Evidence,
  EvidenceKind,
  PdlcRun,
  PdlcStageId,
  PdlcStageState,
  PortfolioData,
} from '@/lib/types';
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

export interface StageView {
  definition: PdlcStageDefinition;
  state: PdlcStageState;
  current: boolean;
  /** Agent that assists the stage (run it with `runStageAgent`). */
  agentId: AgentId | null;
  reviews: (PdlcStageState['reviews'][number] & { next: boolean })[];
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
  stages: StageView[];
  forward: TransitionCheck;
  /** Back with a placeholder reason: `allowed` says whether there is a previous stage. */
  back: TransitionCheck;
  /** Offered when required evidence is failing (a failed test). */
  backSuggestion: { offer: boolean; to: PdlcStageId | null; reason: string };
}

/** Everything the workflow screen needs for one deliverable, or null when it has no run. */
export function describeWorkflow(data: PortfolioData, results: EngineResult, deliverableId: string): WorkflowView | null {
  const run = data.pdlcRuns.find((r) => r.deliverableId === deliverableId);
  const measures = results.deliverables[deliverableId];
  if (!run) return null;
  const simulate = checkSimulateWorkClosed(data, deliverableId);
  const stages = PDLC_STAGES.map((def) => {
    const state = run.stages[def.id];
    const firstOpen = state.reviews.findIndex((r) => r.state !== 'approved');
    return {
      definition: def,
      state,
      current: run.currentStage === def.id,
      agentId: stageAgentId(def.id),
      reviews: state.reviews.map((r, i) => ({ ...r, next: i === firstOpen })),
      evidence: def.evidenceLeft.map((kind) => {
        const latest = latestEvidence(data, deliverableId, kind);
        return { kind, latest, result: latest ? latest.result : ('missing' as const) };
      }),
      simulatedSteps: def.id === SIMULATE_WORK_FROM ? [simulate] : [],
    };
  });
  return {
    run,
    stages,
    forward: canMoveForward(run),
    back: canMoveBack(run, 'reason'),
    backSuggestion: measures ? moveBackSuggestion(run, measures.readiness) : { offer: false, to: null, reason: '' },
  };
}

export { stageDefinition };
