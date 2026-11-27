/**
 * Delivery Intelligence engine (D3). Pure functions of (data, clock): no
 * `new Date()` for business logic, no globals, no randomness.
 *
 * `computeAll(data, clock)` is the contract the store calls on load and after
 * every data change. It indexes the snapshot once (buildContext), computes the
 * three independent measures, runs rules R1 to R16, derives evidence-based RAG
 * beside the reported RAG, rolls up the hierarchy and builds the plan model.
 *
 * Helpers for screens and agents are re-exported below: plan windows and bar
 * geometry, forecasts and dependency knock-on, PDLC transition checks,
 * hierarchy roll-ups and status disagreements.
 */
import type { DemoClock, EngineResult, EvidenceRag, Finding, PortfolioData } from '@/lib/types';
import { buildContext } from './context';
import { runRules } from './findings';
import { computeMeasures } from './measures';
import { buildPlan, deliverableForecasts, dependencyKnockOn } from './plan';
import { buildPortfolioSummary } from './portfolio';
import { deliverableEvidenceRag } from './rag';
import { pmNodeRags } from './rollups';

export function computeAll(data: PortfolioData, clock: DemoClock): EngineResult {
  const ctx = buildContext(data, clock);
  const measures = computeMeasures(ctx);
  const findings = runRules({ ctx, measures });

  const findingsByDeliverable = new Map<string, Finding[]>();
  for (const f of findings) {
    if (!f.deliverableId) continue;
    const list = findingsByDeliverable.get(f.deliverableId);
    if (list) list.push(f);
    else findingsByDeliverable.set(f.deliverableId, [f]);
  }

  const deliverableRag: Record<string, EvidenceRag> = {};
  for (const d of data.deliverables) deliverableRag[d.id] = deliverableEvidenceRag(ctx, d, findingsByDeliverable.get(d.id) ?? [], measures);
  const pmNodeRag = pmNodeRags(ctx, deliverableRag);

  return {
    computedFor: clock.today,
    deliverables: measures.deliverables,
    outcomes: measures.outcomes,
    deliverableRag,
    pmNodeRag,
    findings,
    plan: buildPlan(ctx, deliverableForecasts(ctx)),
    portfolio: buildPortfolioSummary(ctx, measures.deliverables, deliverableRag, pmNodeRag, findings),
  };
}

// --- Measures and evidence -------------------------------------------------
export { buildContext, type EngineContext } from './context';
export { isClosed, workCompletionOf, sumWorkCompletion } from './work';
export { outcomeAcceptance, acceptedOutcomesOf, isNamedHuman } from './acceptance';
export { deliverableReadiness } from './readiness';
export { currentEvidenceByKind, evidenceStaleness, type EvidenceStaleness } from './evidence';
export { dependencyLateDays, isDependencyLate, isDependencyOpen, isDependencyTroubled } from './dependencies';

// --- Findings and RAG --------------------------------------------------------
export { RULES, RULE_IDS, runRules, compareFindings } from './findings';
export { statusDisagreements, worstRag, rollupRag, missedMilestones } from './rag';
export { titleSimilarity } from './rules-raid';
export { missingRoleSeverity } from './rules-team';

// --- Core Four ----------------------------------------------------------------
export { coreTeamSeats, missingCoreRoles, sharedCoreSeats, rolesHeldBy, coreRoleHolder, workStartedAt, latestJoin, type CoreSeatView } from './core-team';

// --- Roll-ups ---------------------------------------------------------------
export { computeHierarchyRollups, rollupMeasures, type HierarchyRollup, type HierarchyRollups, type MeasureRollup } from './rollups';

// --- Plan -------------------------------------------------------------------
export { planWindow, planTimeline, stepWindow, barSpan, datePosition, windowDays, sprintFor, PLAN_ZOOMS, type BarGeometry } from './plan-windows';
export { forecastEnd, type Forecast, type ForecastMethod } from './forecast';
export { deliverableForecasts, dependencyKnockOn, type KnockOn } from './plan';

// --- PDLC workflow ----------------------------------------------------------
export { canMoveForward, canMoveBack, checkStageMove, outstandingReviews, moveBackSuggestion, type TransitionCheck, type TransitionCode } from './pdlc';

/** Convenience for screens: forecast per deliverable and dependency knock-on for a snapshot. */
export function computePlanExtras(data: PortfolioData, clock: DemoClock) {
  const ctx = buildContext(data, clock);
  return { forecasts: deliverableForecasts(ctx), knockOn: dependencyKnockOn(ctx) };
}
