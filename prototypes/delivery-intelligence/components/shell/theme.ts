'use client';

/**
 * Theme state: `data-theme` on <html>, remembered in localStorage.
 * The inline script in app/layout.tsx applies the stored (or system) choice
 * before first paint; `useTheme()` reads and changes it afterwards.
 */
import { useCallback, useSyncExternalStore } from 'react';
import { THEME_STORAGE_KEY } from './theme-script';

export type ThemeName = 'light' | 'dark';

function readTheme(): ThemeName {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function subscribe(onChange: () => void): () => void {
  // Observe the attribute so any change (this hook, another tab's code, devtools) is picked up.
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

export function applyTheme(theme: ThemeName): void {
  const root = document.documentElement;
  root.classList.add('di-theme-transition');
  root.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be unavailable (private mode); the theme still applies for this page.
  }
  window.setTimeout(() => root.classList.remove('di-theme-transition'), 420);
}

/** Current theme and a setter. Renders as `light` on the server, then corrects on hydration. */
export function useTheme(): [ThemeName, (theme: ThemeName) => void] {
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'light' as ThemeName);
  const set = useCallback((next: ThemeName) => applyTheme(next), []);
  return [theme, set];
}
