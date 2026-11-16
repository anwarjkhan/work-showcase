'use client';

import { List, Map as MapIcon, Route } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ProvenanceBadge } from '@/components/shell';
import { Button, Card, Chip, SectionHeading, StatusGlyph, Tabs, cx } from '@/components/ui';
import { terms } from '@/lib/config/terminology';
import { useClock, useEngineResult, usePortfolioData } from '@/lib/store';
import type { EvidenceRagStatus } from '@/lib/types';
import { GlobalList } from './GlobalList';
import { DeliverableRow, GlobalOverview, HeroCallout, HubDetail } from './HubPanel';
import { RegionStrip } from './RegionStrip';
import { ARC_STYLE, WorldMap } from './WorldMap';
import { buildGlobalModel, HEALTH_RULE, METRIC_LABEL, visibleArcs, type ArcFilter, type ArcTone, type HubMetric } from './model';

const HERO_HASH = '#hero';

const FILTERS: Array<{ id: ArcFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'late', label: 'Late only' },
  { id: 'hub', label: 'Selected hub' },
  { id: 'hero', label: 'Hero deliverable' },
];

function setHash(on: boolean) {
  if (typeof window === 'undefined') return;
  const base = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(window.history.state, '', on ? `${base}${HERO_HASH}` : base);
}

export function GlobalScreen() {
  const data = usePortfolioData();
  const results = useEngineResult();
  const clock = useClock();
  const model = useMemo(() => buildGlobalModel(data, results, clock), [data, results, clock]);

  const [view, setView] = useState<'map' | 'list'>('map');
  const [metric, setMetric] = useState<HubMetric>('deliverables');
  const [filter, setFilter] = useState<ArcFilter>('all');
  const [selectedHubId, setSelectedHubId] = useState<string | null>(null);
  const [hero, setHero] = useState(false);

  const heroDep = model.heroDependency;
  const heroOn = hero && heroDep !== null;

  // The guided demo can land on the hero view with /global#hero.
  useEffect(() => {
    const sync = () => {
      if (window.location.hash === HERO_HASH) {
        setHero(true);
        setFilter('hero');
        setSelectedHubId(null);
        setView('map');
      }
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  const showHero = useCallback(() => {
    setHero(true);
    setFilter('hero');
    setSelectedHubId(null);
    setView('map');
    setHash(true);
  }, []);
  const exitHero = useCallback(() => {
    setHero(false);
    setFilter('all');
    setHash(false);
  }, []);

  const selectHub = useCallback(
    (id: string | null) => {
      setSelectedHubId(id);
      if (id && heroOn) {
        setHero(false);
        setHash(false);
        setFilter('hub');
      }
      if (!id && filter === 'hub') setFilter('all');
    },
    [heroOn, filter],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (document.querySelector('[role="dialog"]')) return;
      setSelectedHubId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const arcs = useMemo(() => visibleArcs(model, filter, selectedHubId), [model, filter, selectedHubId]);
  const allCross = useMemo(() => visibleArcs(model, 'all', null), [model]);
  const focusHubIds = useMemo(() => (heroOn && heroDep ? new Set([heroDep.dep.fromHubId, heroDep.dep.toHubId]) : null), [heroOn, heroDep]);
  const selectedHub = selectedHubId ? model.hubById.get(selectedHubId) : undefined;

  const from = heroDep ? model.hubById.get(heroDep.dep.fromHubId)?.hub : undefined;
  const to = heroDep ? model.hubById.get(heroDep.dep.toHubId)?.hub : undefined;
  const headline =
    heroDep && from && to && heroDep.lateDays > 0
      ? `The hero deliverable is waiting ${heroDep.lateDays} days on ${from.name}`
      : `${model.totals.late} cross-hub ${model.totals.late === 1 ? 'dependency is' : 'dependencies are'} late`;
  const subline = heroDep && from && to
    ? `${heroDep.dep.title}: provided from ${from.name} and needed in ${to.name}, across continents. ${model.totals.late} of ${model.totals.crossHub} cross-hub dependencies are late${model.totals.atRisk > 0 ? ` and ${model.totals.atRisk} at risk` : ''}; ${model.totals.attentionHubs} of ${model.totals.hubs} hubs carry a status disagreement or a late dependency.`
    : `${model.totals.crossHub} cross-hub dependencies across ${model.totals.hubs} hubs on ${model.totals.continents} continents.`;

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        eyebrow={`${model.totals.hubs} hubs · ${model.totals.continents} continents · ${model.totals.crossHub} cross-hub dependencies (${model.totals.crossContinent} cross-continent)`}
        title={headline}
        description={subline}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs
            variant="segmented"
            ariaLabel="View"
            value={view}
            onChange={(v) => setView(v as 'map' | 'list')}
            items={[
              { id: 'map', label: 'Map', icon: <MapIcon /> },
              { id: 'list', label: 'List', icon: <List /> },
            ]}
          />
          {view === 'map' ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-fg-subtle">Size by</span>
              <Tabs
                variant="segmented"
                ariaLabel="Marker size"
                value={metric}
                onChange={(v) => setMetric(v as HubMetric)}
                items={(Object.keys(METRIC_LABEL) as HubMetric[]).map((m) => ({ id: m, label: METRIC_LABEL[m] }))}
              />
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Dependency filter">
            <span className="mr-0.5 text-xs text-fg-subtle">Arcs</span>
            {FILTERS.map((f) => (
              <Chip
                key={f.id}
                selected={filter === f.id}
                aria-pressed={filter === f.id}
                disabled={f.id === 'hub' && !selectedHubId}
                title={f.id === 'hub' && !selectedHubId ? 'Select a hub first' : undefined}
                onClick={() => {
                  if (f.id === 'hero') return showHero();
                  if (heroOn) {
                    setHero(false);
                    setHash(false);
                  }
                  setFilter(f.id);
                }}
              >
                {f.label}
              </Chip>
            ))}
          </div>
        </div>
        {heroDep ? (
          <Button variant={heroOn ? 'secondary' : 'primary'} size="sm" icon={<Route />} onClick={heroOn ? exitHero : showHero} aria-pressed={heroOn}>
            {heroOn ? 'Show all hubs' : 'Show hero dependency'}
          </Button>
        ) : null}
      </div>

      {view === 'map' ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
          <Card padding="none" footer={<MapLegend metric={metric} withinHub={model.dependencies.filter((d) => !d.crossHub).length} />} data-testid="global-map">
            <WorldMap
              model={model}
              arcs={arcs}
              metric={metric}
              selectedHubId={selectedHubId}
              onSelectHub={selectHub}
              focusDependencyId={heroOn && heroDep ? heroDep.dep.id : null}
              focusHubIds={focusHubIds}
            />
          </Card>
          <aside className="relative min-h-[420px]" aria-label="Hub details">
            <div className="di-card flex flex-col gap-4 overflow-y-auto overscroll-contain p-4 xl:absolute xl:inset-0">
              {heroOn && heroDep ? (
                <>
                  <HeroCallout view={heroDep} onExit={exitHero} />
                  {!selectedHub ? (
                    <section className="flex flex-col">
                      <h4 className="di-eyebrow">Deliverables involved</h4>
                      <ul>
                        <DeliverableRow id={heroDep.dep.toDeliverableId} lead={false} />
                        <DeliverableRow id={heroDep.dep.fromDeliverableId} lead={false} />
                      </ul>
                    </section>
                  ) : null}
                </>
              ) : null}
              {selectedHub ? (
                <HubDetail hub={selectedHub} onClose={() => selectHub(null)} />
              ) : heroOn ? null : (
                <GlobalOverview model={model} onSelectHub={selectHub} onShowHero={showHero} />
              )}
            </div>
          </aside>
        </div>
      ) : (
        <div className={cx('grid grid-cols-1 gap-4', selectedHub && '2xl:grid-cols-[minmax(0,1fr)_400px]')}>
          <GlobalList model={model} arcs={filter === 'all' ? allCross : arcs} selectedHubId={selectedHubId} onSelectHub={selectHub} />
          {selectedHub ? (
            <aside className="di-card order-first self-start p-4 2xl:order-none" aria-label="Hub details">
              <HubDetail hub={selectedHub} onClose={() => selectHub(null)} />
            </aside>
          ) : null}
        </div>
      )}

      <RegionStrip model={model} selectedHubId={selectedHubId} onSelectHub={selectHub} />
    </div>
  );
}

function LineSample({ tone }: { tone: ArcTone }) {
  const st = ARC_STYLE[tone];
  return (
    <svg aria-hidden width="26" height="8" className="shrink-0">
      <line x1="1" y1="4" x2="21" y2="4" stroke={st.stroke} strokeOpacity={Math.max(0.7, st.opacity)} strokeWidth={st.width} strokeDasharray={st.dash} strokeLinecap="round" />
      <path d="M20,1 L25,4 L20,7 Z" fill={st.stroke} />
    </svg>
  );
}

function MapLegend({ metric, withinHub }: { metric: HubMetric; withinHub: number }) {
  const statuses: EvidenceRagStatus[] = ['red', 'amber', 'green', 'unknown'];
  return (
    <div className="flex w-full flex-wrap items-start gap-x-6 gap-y-2 py-0.5 text-[11.5px] text-fg-muted">
      <div className="flex items-center gap-2">
        <svg aria-hidden width="34" height="16">
          <circle cx="6" cy="10" r="3.5" fill="none" stroke="var(--di-fg-subtle)" />
          <circle cx="23" cy="8" r="7.5" fill="none" stroke="var(--di-fg-subtle)" />
        </svg>
        <span>Size: {METRIC_LABEL[metric].toLowerCase()}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1" title={HEALTH_RULE.long}>
        <span>{HEALTH_RULE.short}:</span>
        {statuses.map((s) => (
          <span key={s} className="inline-flex items-center gap-1">
            <StatusGlyph status={s} className="size-3" /> {terms.rag[s]}
          </span>
        ))}
      </div>
      <span>Ring: RAG mix of its deliverables</span>
      <span className="inline-flex items-center gap-1.5">
        <svg aria-hidden width="14" height="14">
          <circle cx="7" cy="7" r="5.5" fill="none" stroke="var(--di-status-red)" strokeDasharray="2 2.5" />
        </svg>
        Pulse: status disagreement or late dependency
      </span>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {(['late', 'at-risk', 'on-track', 'delivered'] as ArcTone[]).map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5">
            <LineSample tone={t} /> {ARC_STYLE[t].label}
          </span>
        ))}
        <span className="text-fg-subtle">Arrow points provider → receiver{withinHub > 0 ? `; ${withinHub} within-hub dependencies not drawn` : ''}</span>
      </div>
      <ProvenanceBadge kind="computed" size="sm" />
    </div>
  );
}
