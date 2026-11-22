'use client';

import { Sun } from 'lucide-react';
import { ragSegments, StackedBar } from '@/components/charts';
import { AddToSlides } from '@/components/slides/AddToSlides';
import { RagPill, cx } from '@/components/ui';
import { CONTINENT_LABEL, type GlobalModel } from './model';

/**
 * Follow-the-sun band: one cell per continent, west to east by UTC offset,
 * with deliverables, open work, people and health, so the geography is quantified.
 */
export function RegionStrip({ model, selectedHubId, onSelectHub }: { model: GlobalModel; selectedHubId: string | null; onSelectHub: (id: string) => void }) {
  return (
    <div className="di-card overflow-hidden" data-testid="region-strip">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <Sun aria-hidden className="size-3.5 text-fg-subtle" />
        <h3 className="di-eyebrow">Follow the sun · west to east by UTC offset</h3>
        <span className="ml-auto"><AddToSlides kind="portfolio-hubs" scope={{ kind: 'portfolio' }} /></span>
      </div>
      <ol className="grid grid-cols-2 divide-line md:grid-cols-3 xl:grid-cols-6 xl:divide-x">
        {model.regions.map((r) => (
          <li key={r.continent} className="flex min-w-0 flex-col gap-2.5 px-4 py-3.5">
            <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
              <div className="min-w-0">
                <div className="font-display text-[13.5px] font-semibold whitespace-nowrap text-title">{CONTINENT_LABEL[r.continent]}</div>
                <div className="text-[11px] text-fg-subtle tabular-nums">{r.utcRange ?? '—'}</div>
              </div>
              <RagPill status={r.health} size="sm" />
            </div>
            <dl className="grid grid-cols-3 gap-1 tabular-nums">
              <div>
                <dt className="text-[10.5px] text-fg-subtle">Deliv.</dt>
                <dd className="font-display text-base leading-tight font-semibold text-fg">{r.deliverableIds.length}</dd>
              </div>
              <div>
                <dt className="text-[10.5px] text-fg-subtle">Open</dt>
                <dd className="font-display text-base leading-tight font-semibold text-fg">{r.openWork}</dd>
              </div>
              <div>
                <dt className="text-[10.5px] text-fg-subtle">People</dt>
                <dd className="font-display text-base leading-tight font-semibold text-fg">
                  {r.people}
                </dd>
                <dd className="text-[10.5px] text-fg-subtle">+{r.agents} agents</dd>
              </div>
            </dl>
            <StackedBar size="sm" legend={false} segments={ragSegments(r.ragMix)} ariaLabel={`${CONTINENT_LABEL[r.continent]} deliverables by evidence-based RAG`} />
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
              {r.hubIds.map((id) => {
                const h = model.hubById.get(id);
                if (!h) return null;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onSelectHub(id)}
                    aria-pressed={selectedHubId === id}
                    className={cx(
                      'rounded-xs hover:text-accent hover:underline focus-visible:shadow-focus focus-visible:outline-none',
                      selectedHubId === id ? 'font-semibold text-accent' : 'text-fg-muted',
                    )}
                  >
                    {h.hub.name}
                  </button>
                );
              })}
            </div>
            {r.lateDependencies > 0 ? (
              <div className="text-[11px] font-medium text-status-red-fg">
                {r.lateDependencies} late {r.lateDependencies === 1 ? 'dependency' : 'dependencies'}
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
