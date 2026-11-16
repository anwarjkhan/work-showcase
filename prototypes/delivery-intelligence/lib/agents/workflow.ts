/**
 * PDLC workflow helpers: immutable updates to a `PdlcRun`, and a read model
 * that gives the workflow screen everything per stage in one call.
 */
import { PDLC_STAGES, stageDefinition, type PdlcStageDefinition } from '@/lib/config/pdlc';
import { canMoveBack, canMoveForward, moveBackSuggestion, type TransitionCheck } from '@/lib/engine';
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
