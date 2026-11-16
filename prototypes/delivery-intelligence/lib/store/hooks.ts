'use client';

/**
 * Selector hooks for screens. All read from the single demo store and
 * re-render only when the selected value changes.
 *
 *   const measures = useDeliverableMeasures(id);   // engine result for one deliverable
 *   const { approveProposal } = useDemoActions();   // dispatch
 *
 * Custom selection: `useDemoState(s => s.results.portfolio.counts)`. A selector
 * that builds a new object/array on every call should pass `shallowEqual` (or
 * wrap the derivation in useMemo over a stable slice).
 */
import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import type {
  AgentRun,
  DeliverableMeasures,
  DemoClock,
  DemoState,
  EngineResult,
  EvidenceRag,
  Finding,
  OutcomeMeasures,
  PdlcRun,
  PortfolioData,
  ProposalStatus,
  ProposedChange,
  RuleId,
  Severity,
  StatusDraft,
  TechDeliverable,
} from '@/lib/types';
import type { DemoActions } from './actions';
import { indexPortfolio, type PortfolioIndex } from './indexes';
import { useStoreContext } from './provider';
import type { DemoStoreApi } from './store';

/** Shallow equality for arrays and plain objects (one level). */
export function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a) as Array<keyof T>;
  const kb = Object.keys(b) as Array<keyof T>;
  return ka.length === kb.length && ka.every((k) => Object.is(a[k], b[k]));
}

/** The raw store API (for actions and advanced use). Prefer the hooks below in screens. */
export function useDemoStore(): DemoStoreApi {
  return useStoreContext().store;
}

/** Subscribe to a slice of state. */
export function useDemoState<T>(selector: (state: DemoState) => T, isEqual: (a: T, b: T) => boolean = Object.is): T {
  const store = useDemoStore();
  // Remembers the last selection so equal results keep their identity across store changes.
  const last = useRef<{ state: DemoState; selector: (s: DemoState) => T; value: T } | null>(null);
  const getSnapshot = useCallback(() => {
    const state = store.getState();
    const prev = last.current;
    if (prev && prev.state === state && prev.selector === selector) return prev.value;
    const selected = selector(state);
    const value = prev && isEqual(prev.value, selected) ? prev.value : selected;
    last.current = { state, selector, value };
    return value;
  }, [store, selector, isEqual]);
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

// --- Whole slices -------------------------------------------------------------

export const usePortfolioData = (): PortfolioData => useDemoState((s) => s.data);
export const useEngineResult = (): EngineResult => useDemoState((s) => s.results);
export const useClock = (): DemoClock => useDemoState((s) => s.clock);
/** Id lookups (Maps) over the current data; recomputed only when data changes. */
export const usePortfolioIndex = (): PortfolioIndex => indexPortfolio(usePortfolioData());
export const useAgentRuns = (): AgentRun[] => useDemoState((s) => s.agentRuns);
export const useProposals = (): ProposedChange[] => useDemoState((s) => s.proposals);
export const useApprovals = () => useDemoState((s) => s.approvals);
export const useStatusDrafts = (): StatusDraft[] => useDemoState((s) => s.drafts);
/** The audit trail, oldest first. */
export const useAuditTrail = () => useDemoState((s) => s.audit);
/** Person id the presenter is acting as. */
export const useActingAs = (): string => useDemoState((s) => s.actingAsPersonId);
/** Changes on every store update; useful as a key to replay animations. */
export const useRevision = (): number => useDemoState((s) => s.revision);

// --- By id ----------------------------------------------------------------------

export function useDeliverable(id: string): TechDeliverable | undefined {
  return usePortfolioIndex().deliverables.get(id);
}

/** The three measures for one deliverable. */
export function useDeliverableMeasures(id: string): DeliverableMeasures | undefined {
  const results = useEngineResult();
  return results.deliverables[id];
}

/** Reported and evidence-based RAG, with reasons, for one deliverable. */
export function useDeliverableRag(id: string): EvidenceRag | undefined {
  return useEngineResult().deliverableRag[id];
}

export function useOutcomeMeasures(id: string): OutcomeMeasures | undefined {
  return useEngineResult().outcomes[id];
}

/** The deliverable's PDLC workflow state. */
export function usePdlcRun(deliverableId: string): PdlcRun | undefined {
  return usePortfolioIndex().pdlcRunsByDeliverable.get(deliverableId);
}

export function useAgentRun(runId: string | null | undefined): AgentRun | undefined {
  const runs = useAgentRuns();
  return useMemo(() => (runId ? runs.find((r) => r.id === runId) : undefined), [runs, runId]);
}

export interface FindingFilter {
  deliverableId?: string;
  ruleId?: RuleId;
  severity?: Severity;
}

/** Engine findings plus findings raised by agent runs, optionally filtered. */
export function useFindings(filter: FindingFilter = {}): Finding[] {
  const findings = useEngineResult().findings;
  const { deliverableId, ruleId, severity } = filter;
  return useMemo(
    () =>
      findings.filter(
        (f) =>
          (deliverableId === undefined || f.deliverableId === deliverableId) &&
          (ruleId === undefined || f.ruleId === ruleId) &&
          (severity === undefined || f.severity === severity),
      ),
    [findings, deliverableId, ruleId, severity],
  );
}

export function useProposalsByStatus(status: ProposalStatus): ProposedChange[] {
  const proposals = useProposals();
  return useMemo(() => proposals.filter((p) => p.status === status), [proposals, status]);
}

/** Latest draft of a kind for a deliverable (or portfolio-wide with null). */
export function useLatestDraft(deliverableId: string | null, kind: StatusDraft['kind'] = 'weekly-status'): StatusDraft | undefined {
  const drafts = useStatusDrafts();
  return useMemo(() => drafts.findLast((d) => d.deliverableId === deliverableId && d.kind === kind), [drafts, deliverableId, kind]);
}

// --- Dispatch -----------------------------------------------------------------------

/** All store actions (see lib/store/actions.ts). Stable for the session. */
export function useDemoActions(): DemoActions {
  return useStoreContext().actions;
}

/** Restores the seeded state. Stable for the session. */
export function useResetDemo(): () => void {
  const store = useDemoStore();
  return store.reset;
}
