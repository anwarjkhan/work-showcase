'use client';
/**
 * The slide basket: single slides collected from any screen, in order.
 *
 * A tiny external store (no provider needed, so the top bar and every screen
 * share it). Items hold only `{ kind, scope }`; slides are built live from the
 * current store state when previewed or exported, so they reflect approvals.
 * Persisted in sessionStorage (every access in try/catch) and cleared by Reset
 * demo, which is detected the way the guided demo does it (a click on the
 * shell's reset button).
 */
import { useSyncExternalStore } from 'react';
import { scopeKey } from '@/lib/slides';
import type { SlideKind, SlideScope } from '@/lib/slides';

export interface BasketItem {
  id: string;
  kind: SlideKind;
  scope: SlideScope;
}

export interface BasketState {
  items: readonly BasketItem[];
  name: string;
  /** Last announcement, for the polite live region and toast. `seq` changes on every announcement. */
  notice: { seq: number; text: string } | null;
}

const STORAGE_KEY = 'di.slides.basket.v1';
const EMPTY: BasketState = { items: [], name: '', notice: null };

let state: BasketState = EMPTY;
let loaded = false;
let seq = 0;
const listeners = new Set<() => void>();

export const itemId = (kind: SlideKind, scope: SlideScope): string => `${kind}|${scopeKey(scope)}`;

function load(): void {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const text = window.sessionStorage.getItem(STORAGE_KEY);
    if (!text) return;
    const parsed = JSON.parse(text) as { items?: BasketItem[]; name?: string };
    const items = (parsed.items ?? []).filter((i) => i && typeof i.kind === 'string' && i.scope && typeof i.scope.kind === 'string');
    state = { items, name: typeof parsed.name === 'string' ? parsed.name : '', notice: null };
  } catch {
    /* storage unavailable or corrupt: start empty */
  }
}

function save(): void {
  try {
    if (state.items.length === 0 && !state.name) window.sessionStorage.removeItem(STORAGE_KEY);
    else window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ items: state.items, name: state.name }));
  } catch {
    /* storage unavailable: the basket still works for this page view */
  }
}

function set(next: BasketState): void {
  state = next;
  save();
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getSnapshot = (): BasketState => {
  load();
  return state;
};
const getServerSnapshot = (): BasketState => EMPTY;

export function useBasket(): BasketState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Adds a slide unless it is already there; announces either way. Returns the new count. */
export function addToBasket(kind: SlideKind, scope: SlideScope): number {
  load();
  const id = itemId(kind, scope);
  const has = state.items.some((i) => i.id === id);
  const items = has ? state.items : [...state.items, { id, kind, scope }];
  seq += 1;
  set({ ...state, items, notice: { seq, text: has ? `Already in slides (${items.length})` : `Added to slides (${items.length})` } });
  return items.length;
}

export function removeFromBasket(id: string): void {
  load();
  seq += 1;
  const items = state.items.filter((i) => i.id !== id);
  set({ ...state, items, notice: { seq, text: `Removed from slides (${items.length})` } });
}

export function moveInBasket(id: string, delta: -1 | 1): void {
  load();
  const from = state.items.findIndex((i) => i.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= state.items.length) return;
  const items = [...state.items];
  const [item] = items.splice(from, 1);
  if (!item) return;
  items.splice(to, 0, item);
  seq += 1;
  set({ ...state, items, notice: { seq, text: `Moved to position ${to + 1} of ${items.length}` } });
}

export function setBasketName(name: string): void {
  load();
  set({ ...state, name });
}

export function clearBasket(): void {
  load();
  if (state.items.length === 0 && !state.name) return;
  set({ items: [], name: '', notice: null });
}
