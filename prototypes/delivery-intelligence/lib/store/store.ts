/**
 * Framework-free core of the client-side demo store. React bindings are in
 * provider.tsx and hooks.ts; actions (D5) operate on the `DemoStoreApi` below.
 *
 * State is immutable: every change produces a new `DemoState`. When `data`
 * changes reference, the engine re-runs (`computeAll(data, clock)`).
 * Ids and timestamps are deterministic (counters), so a demo replays the same
 * way every time and `reset()` restores the seeded state exactly.
 */
import { DEMO_CLOCK } from '@/lib/config/clock';
import { PRESENTER_PERSON_ID } from '@/lib/config/story';
import { getDataSource, type DataSource } from '@/lib/data/source';
import { computeAll } from '@/lib/engine';
import type { AuditEvent, DemoClock, DemoState, IsoDateTime, PortfolioData } from '@/lib/types';

export type AuditInput = Omit<AuditEvent, 'id' | 'seq' | 'at'> & { at?: IsoDateTime };

export interface DemoStoreApi {
  getState(): DemoState;
  subscribe(listener: () => void): () => void;
  /**
   * Replaces the state with `recipe(state)`. Return the same object to do nothing.
   * If the returned `data` is a new reference, the engine re-runs automatically.
   */
  setState(recipe: (state: DemoState) => DemoState): void;
  /** Shorthand for changing only `data` (engine re-runs). */
  updateData(recipe: (data: PortfolioData) => PortfolioData): void;
  /** Appends an audit event with the next sequence number and timestamp; returns it. */
  appendAudit(input: AuditInput): AuditEvent;
  /** Deterministic id: `${prefix}-${n}` with a per-session counter. */
  nextId(prefix: string): string;
  /** Deterministic "now": the demo clock's start plus one minute per call. */
  now(): IsoDateTime;
  /** Restores the seeded state exactly (data, results, runs, proposals, audit, counters). */
  reset(): void;
}

function initialState(seed: PortfolioData, clock: DemoClock): DemoState {
  return {
    seed,
    data: seed,
    results: computeAll(seed, clock),
    clock,
    agentRuns: [],
    proposals: [],
    approvals: [],
    drafts: [],
    audit: [],
    actingAsPersonId: PRESENTER_PERSON_ID,
    revision: 0,
  };
}

export function createDemoStore(source: DataSource = getDataSource(), clock: DemoClock = DEMO_CLOCK): DemoStoreApi {
  const seed = source.load();
  const pristine = initialState(seed, clock);
  let state = pristine;
  let idCounter = 0;
  let minuteCounter = 0;
  let auditSeq = 0;
  const listeners = new Set<() => void>();

  const emit = () => listeners.forEach((l) => l());

  const api: DemoStoreApi = {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setState(recipe) {
      const next = recipe(state);
      if (next === state) return;
      const results = next.data !== state.data || next.clock !== state.clock ? computeAll(next.data, next.clock) : next.results;
      state = { ...next, results, revision: state.revision + 1 };
      emit();
    },
    updateData(recipe) {
      api.setState((s) => {
        const data = recipe(s.data);
        return data === s.data ? s : { ...s, data };
      });
    },
    appendAudit(input) {
      auditSeq += 1;
      const event: AuditEvent = { ...input, id: `audit-${auditSeq}`, seq: auditSeq, at: input.at ?? api.now() };
      api.setState((s) => ({ ...s, audit: [...s.audit, event] }));
      return event;
    },
    nextId(prefix) {
      idCounter += 1;
      return `${prefix}-${idCounter}`;
    },
    now() {
      minuteCounter += 1;
      return new Date(Date.parse(state.clock.now) + minuteCounter * 60_000).toISOString();
    },
    reset() {
      idCounter = 0;
      minuteCounter = 0;
      auditSeq = 0;
      // Same seeded objects, fresh revision so every subscriber re-renders.
      state = { ...pristine, revision: state.revision + 1 };
      emit();
    },
  };
  return api;
}
