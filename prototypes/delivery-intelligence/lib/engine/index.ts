/**
 * STUB — replaced by deliverable D3 (Engine).
 *
 * Contract D3 must keep: `computeAll(data, clock): EngineResult`, pure, with the
 * demo clock as a parameter. The store calls it on load and after every data
 * change. D3 may add any other modules in lib/engine/ and export helpers from
 * here (plan spans for a zoom level, PDLC transition checks, etc.).
 *
 * This stub returns an empty-but-valid result: every deliverable and outcome
 * has an entry marked "not computable" / `unknown`, there are no findings, and
 * counts are simple tallies, so screens can render before D3 lands.
 */
import { PDLC_STAGE_IDS } from '@/lib/config/pdlc';
import { requiredEvidenceFor } from '@/lib/config/risk-tiers';
import type {
  DemoClock,
  DeliverableMeasures,
  EngineResult,
  EvidenceRag,
  OutcomeMeasures,
  PdlcStageId,
  PortfolioData,
  ReadinessState,
  WorkShare,
} from '@/lib/types';

const NOT_COMPUTED = { computable: false, reason: 'insufficient-data', detail: 'Engine not built yet (stub).' } as const;

function perStage<T>(make: () => T): Record<PdlcStageId, T> {
  return Object.fromEntries(PDLC_STAGE_IDS.map((id) => [id, make()])) as Record<PdlcStageId, T>;
}

export function computeAll(data: PortfolioData, clock: DemoClock): EngineResult {
  const deliverables: Record<string, DeliverableMeasures> = {};
  const deliverableRag: Record<string, EvidenceRag> = {};
  for (const d of data.deliverables) {
    const required = requiredEvidenceFor(d.riskTier);
    deliverables[d.id] = {
      deliverableId: d.id,
      workCompletion: NOT_COMPUTED,
      acceptedOutcomes: NOT_COMPUTED,
      readiness: {
        deliverableId: d.id,
        state: 'unknown',
        riskTier: d.riskTier,
        requiredEvidence: required,
        held: required.map((kind) => ({ kind, state: 'missing', evidenceId: null, observedAt: null, workChangedAt: null })),
        missing: required,
        failing: [],
        stale: [],
        blockingDependencyIds: [],
        reasons: [{ code: 'stub', message: 'Engine not built yet (stub).', refs: [] }],
      },
    };
    deliverableRag[d.id] = {
      entity: { kind: 'deliverable', id: d.id },
      reported: d.reportedRag,
      evidence: 'unknown',
      disagrees: false,
      reasons: [],
    };
  }

  const outcomes: Record<string, OutcomeMeasures> = {};
  for (const o of data.outcomes) {
    outcomes[o.id] = {
      outcomeId: o.id,
      deliverableId: o.deliverableId,
      workCompletion: NOT_COMPUTED,
      acceptance: { outcomeId: o.id, accepted: false, mandatoryCount: 0, mandatoryAccepted: 0, businessAcceptanceEvidenceIds: [], reasons: [] },
      epicKeys: [],
      workItemKeys: [],
      reportedStatus: o.reportedStatus,
    };
  }

  const pmNodeRag: Record<string, EvidenceRag> = {};
  for (const n of data.pmNodes) {
    pmNodeRag[n.id] = { entity: { kind: 'pm-node', id: n.id }, reported: n.reportedRag, evidence: 'unknown', disagrees: false, reasons: [] };
  }

  const countReported = (rag: 'red' | 'amber' | 'green') => data.deliverables.filter((d) => d.reportedRag === rag).length;
  const readiness: Record<ReadinessState, number> = { ready: 0, 'not-ready': 0, unknown: data.deliverables.length };

  return {
    computedFor: clock.today,
    deliverables,
    outcomes,
    deliverableRag,
    pmNodeRag,
    findings: [],
    plan: { spans: [], today: clock.today, start: clock.today, end: clock.today, lateDependencyIds: [] },
    portfolio: {
      counts: {
        investmentRequests: data.investmentRequests.length,
        initiatives: data.pmNodes.filter((n) => n.level === 'initiative').length,
        programmes: data.pmNodes.filter((n) => n.level === 'programme').length,
        projects: data.pmNodes.filter((n) => n.level === 'project').length,
        deliverables: data.deliverables.length,
        standaloneDeliverables: data.deliverables.filter((d) => d.pmNodeId === null).length,
        epics: data.workItems.filter((w) => w.type === 'epic' || w.type === 'tech-deliverable').length,
        outcomes: data.outcomes.length,
        workItems: data.workItems.length,
      },
      reportedRag: { red: countReported('red'), amber: countReported('amber'), green: countReported('green'), unknown: 0 },
      evidenceRag: { red: 0, amber: 0, green: 0, unknown: data.deliverables.length },
      disagreementDeliverableIds: [],
      programmeHealth: [],
      stageDistribution: perStage(() => 0),
      stageWorkShare: perStage<WorkShare>(() => ({ human: 0, agent: 0, agentShare: 0 })),
      readiness,
      workCompletion: NOT_COMPUTED,
      acceptedOutcomes: NOT_COMPUTED,
      findingsBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
      freshness: data.meta.freshness,
    },
  };
}
