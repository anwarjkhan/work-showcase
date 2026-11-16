'use client';

/**
 * Temporary content for a route until its screen deliverable lands. Each
 * screen deliverable replaces its page.tsx and stops importing this.
 */
import { Sparkles } from 'lucide-react';
import { routeById, type RouteId } from '@/lib/config/routes';
import { terms } from '@/lib/config/terminology';
import { useDeliverable } from '@/lib/store';
import { PageMeta } from './page-meta';
import { ProvenanceBadges } from './ProvenanceBadge';

export interface RoutePlaceholderProps {
  routeId: RouteId;
  /** For dynamic routes: the deliverable id from the URL. */
  entityId?: string;
}

export function RoutePlaceholder({ routeId, entityId }: RoutePlaceholderProps) {
  const route = routeById(routeId);
  const deliverable = useDeliverable(entityId ?? '');
  const isDeliverableRoute = routeId === 'deliverable' || routeId === 'workflow';

  return (
    <div className="flex flex-col gap-6" data-testid={`placeholder-${routeId}`}>
      {deliverable && <PageMeta subtitle={`${deliverable.ref} · ${deliverable.title}`} />}

      <section className="di-card relative overflow-hidden px-8 py-7">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-accent-soft blur-3xl" />
        <div className="relative flex items-start justify-between gap-8">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-pill border border-accent-line bg-accent-soft px-2.5 py-1 text-[11.5px] font-semibold text-accent">
              <Sparkles aria-hidden className="size-3.5" />
              {terms.shell.comingSoon}
            </div>
            <h2 className="font-display text-[26px] leading-tight font-semibold text-heading">
              {isDeliverableRoute && deliverable ? deliverable.title : route.title}
            </h2>
            <p className="mt-2 text-[15px] text-fg-muted">{route.description}</p>
            {isDeliverableRoute && deliverable && (
              <p className="mt-3 font-mono text-xs text-fg-subtle">
                {terms.hierarchy.deliverableIdField} {deliverable.ref} · {deliverable.epicKeys.length} {terms.hierarchy.epic}
                {deliverable.epicKeys.length === 1 ? '' : 's'} · {terms.riskTiers[deliverable.riskTier]}
              </p>
            )}
          </div>
          <ProvenanceBadges kinds={route.provenance} className="justify-end" />
        </div>
      </section>

      <div aria-hidden className="grid grid-cols-4 gap-4">
        {(isDeliverableRoute
          ? [terms.measures.workCompletion, terms.measures.acceptedOutcomes, terms.measures.readiness, terms.ragKinds.evidence]
          : ['', '', '', '']
        ).map((label, i) => (
          <div key={i} className="di-card flex flex-col gap-3 p-5">
            {label ? <span className="di-eyebrow">{label}</span> : <span className="di-skeleton h-3 w-24" />}
            <span className="di-skeleton h-8 w-20" />
            <span className="di-skeleton h-2 w-full" />
          </div>
        ))}
      </div>

      <div aria-hidden className="grid grid-cols-3 gap-4">
        <div className="di-card col-span-2 flex h-80 flex-col gap-4 p-6">
          <span className="di-skeleton h-3.5 w-40" />
          <div className="flex flex-1 items-end gap-3">
            {[46, 70, 58, 82, 64, 90, 52, 76, 60, 86, 68, 74].map((h, i) => (
              <span key={i} className="di-skeleton flex-1" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
        <div className="di-card flex h-80 flex-col gap-4 p-6">
          <span className="di-skeleton h-3.5 w-32" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="di-skeleton size-8 rounded-pill" />
              <span className="flex flex-1 flex-col gap-1.5">
                <span className="di-skeleton h-2.5 w-3/4" />
                <span className="di-skeleton h-2 w-1/2" />
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
