'use client';

/**
 * Labels mode: `data-labels="on|off"` on <html>, remembered in localStorage.
 * "on" (default) shows provenance badges and demo notes; "off" hides them in
 * CSS (see app/globals.css). The inline script in app/layout.tsx applies the
 * stored value before first paint. "Reset demo" never touches this setting.
 */
import { useCallback, useSyncExternalStore } from 'react';
import { LABELS_STORAGE_KEY } from './theme-script';

export type LabelsMode = 'on' | 'off';

function readLabels(): LabelsMode {
  return document.documentElement.getAttribute('data-labels') === 'off' ? 'off' : 'on';
}

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-labels'] });
  return () => observer.disconnect();
}

export function applyLabels(mode: LabelsMode): void {
  document.documentElement.setAttribute('data-labels', mode);
  try {
    localStorage.setItem(LABELS_STORAGE_KEY, mode);
  } catch {
    // Storage can be unavailable (private mode); the mode still applies for this page.
  }
}

/** Current labels mode and a setter. Renders as `on` on the server, then corrects on hydration. */
export function useLabelsMode(): [LabelsMode, (mode: LabelsMode) => void] {
  const mode = useSyncExternalStore(subscribe, readLabels, () => 'on' as LabelsMode);
  const set = useCallback((next: LabelsMode) => applyLabels(next), []);
  return [mode, set];
}

/** True when the key press comes from a field the user is typing in. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== 'string') return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || el.isContentEditable === true;
}
