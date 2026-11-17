'use client';

/**
 * Guided-demo state: a tiny external store shared by the top-bar control and
 * the overlay. It is kept in sessionStorage (every access wrapped in try/catch)
 * so it survives navigation and a page reload, and is cleared on Reset demo.
 */
import { useSyncExternalStore } from 'react';
import { DEMO_STEPS } from '@/lib/config/demo-script';

export interface DemoState {
  running: boolean;
  /** 0-based index into DEMO_STEPS. */
  step: number;
  collapsed: boolean;
  /** Milliseconds since epoch when the current step began (for the elapsed timer). */
  stepStartedAt: number;
  /** Milliseconds since epoch when the run began. */
  runStartedAt: number;
}

export const DEMO_STORAGE_KEY = 'di-guided-demo';

const IDLE: DemoState = { running: false, step: 0, collapsed: false, stepStartedAt: 0, runStartedAt: 0 };

let state: DemoState = IDLE;
let loaded = false;
const listeners = new Set<() => void>();

function sanitise(raw: unknown): DemoState {
  if (!raw || typeof raw !== 'object') return IDLE;
  const r = raw as Partial<DemoState>;
  if (r.running !== true) return IDLE;
  const step = typeof r.step === 'number' && r.step >= 0 && r.step < DEMO_STEPS.length ? Math.floor(r.step) : 0;
  return {
    running: true,
    step,
    collapsed: r.collapsed === true,
    stepStartedAt: typeof r.stepStartedAt === 'number' ? r.stepStartedAt : Date.now(),
    runStartedAt: typeof r.runStartedAt === 'number' ? r.runStartedAt : Date.now(),
  };
}

function load(): void {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const text = window.sessionStorage.getItem(DEMO_STORAGE_KEY);
    if (text) state = sanitise(JSON.parse(text));
  } catch {
    state = IDLE;
  }
}

function persist(): void {
  try {
    if (state.running) window.sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
    else window.sessionStorage.removeItem(DEMO_STORAGE_KEY);
  } catch {
    // Storage can be blocked; the demo then lasts until the next reload.
  }
}

function set(next: DemoState): void {
  state = next;
  persist();
  listeners.forEach((l) => l());
}

export const demoStore = {
  get(): DemoState {
    load();
    return state;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  start(): void {
    const now = Date.now();
    set({ running: true, step: 0, collapsed: false, stepStartedAt: now, runStartedAt: now });
  },
  goto(index: number): void {
    load();
    const step = Math.min(DEMO_STEPS.length - 1, Math.max(0, index));
    if (!state.running || step === state.step) return;
    set({ ...state, step, stepStartedAt: Date.now() });
  },
  setCollapsed(collapsed: boolean): void {
    load();
    if (!state.running || state.collapsed === collapsed) return;
    set({ ...state, collapsed });
  },
  exit(): void {
    load();
    if (!state.running) return;
    set(IDLE);
  },
};

const serverSnapshot = (): DemoState => IDLE;

export function useDemoState(): DemoState {
  return useSyncExternalStore(demoStore.subscribe, demoStore.get, serverSnapshot);
}
