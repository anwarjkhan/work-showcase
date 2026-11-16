'use client';

/**
 * Lets a page refine what the top bar shows. Without it the top bar uses the
 * route's title and provenance from lib/config/routes.ts.
 *
 *   usePageMeta({ title: deliverable.title, subtitle: deliverable.ref, provenance: ['computed', 'reported'] });
 *   // or declaratively:
 *   <PageMeta subtitle="Quarter view" />
 *
 * Values reset when the page unmounts.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Provenance } from '@/lib/types';

export interface PageMetaValue {
  title?: string;
  subtitle?: string;
  provenance?: Provenance[];
}

interface PageMetaContextValue {
  meta: PageMetaValue;
  setMeta: (meta: PageMetaValue) => void;
}

const PageMetaContext = createContext<PageMetaContextValue | null>(null);

export function PageMetaProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<PageMetaValue>({});
  const value = useMemo(() => ({ meta, setMeta }), [meta]);
  return <PageMetaContext.Provider value={value}>{children}</PageMetaContext.Provider>;
}

/** Read by the top bar. */
export function useCurrentPageMeta(): PageMetaValue {
  return useContext(PageMetaContext)?.meta ?? {};
}

export function usePageMeta({ title, subtitle, provenance }: PageMetaValue): void {
  const setMeta = useContext(PageMetaContext)?.setMeta;
  const provenanceKey = provenance?.join('|');
  useEffect(() => {
    if (!setMeta) return;
    setMeta({ title, subtitle, provenance: provenanceKey ? (provenanceKey.split('|') as Provenance[]) : undefined });
    return () => setMeta({});
  }, [setMeta, title, subtitle, provenanceKey]);
}

/** Declarative form of usePageMeta. Renders nothing. */
export function PageMeta(props: PageMetaValue) {
  usePageMeta(props);
  return null;
}
