'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { createDemoActions, type DemoActions } from './actions';
import { createDemoStore, type DemoStoreApi } from './store';

interface StoreContextValue {
  store: DemoStoreApi;
  actions: DemoActions;
}

const StoreContext = createContext<StoreContextValue | null>(null);

/**
 * Creates the one store for the session. Mounted once in app/layout.tsx, so
 * every page shares state across client-side navigation. A full page reload
 * returns to the seeded state (nothing is persisted, design section 7).
 */
export function DemoStoreProvider({ children, store: injected }: { children: ReactNode; store?: DemoStoreApi }) {
  const [value] = useState<StoreContextValue>(() => {
    const store = injected ?? createDemoStore();
    return { store, actions: createDemoActions(store) };
  });
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStoreContext(): StoreContextValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('Demo store hooks must be used inside <DemoStoreProvider> (mounted in app/layout.tsx).');
  return value;
}
