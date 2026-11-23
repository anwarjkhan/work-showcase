'use client';

import { CalendarCheck2, CalendarClock, ChevronLeft, ChevronRight, ChevronsDownUp, ChevronsUpDown, CircleDot, Landmark, Link2Off, TrendingUp, Diamond } from 'lucide-react';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ProvenanceBadge, ProvenanceBadges } from '@/components/shell';
import { AddToSlides } from '@/components/slides/AddToSlides';
import { Button, Chip, IconButton, StatTile, Tabs, cx } from '@/components/ui';
import { FOCUS_RING } from '@/components/ui/cx';

import { terms } from '@/lib/config/terminology';
import { PLAN_ZOOMS, planWindow, stepWindow } from '@/lib/engine';
import type { IsoDate, PlanZoom } from '@/lib/types';
import {
  ancestorsOf,
  buildRows,
  defaultExpanded,
  filterDeliverables,
  isFiltered,
  NO_FILTERS,
  WINDOW_NOUN,
  windowKnockOns,
  windowSummary,
  windowTitle,
  zoomAnchor,
  type PlanFilters,
} from './layout';
import { formatDateCached as formatDate } from './layout';
import { planText } from './PlanBits';
import { PlanDrawer } from './PlanDrawer';
import { PlanTimeline } from './PlanTimeline';
import { usePlanIndex } from './usePlanIndex';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const ZOOM_LABEL: Record<PlanZoom, string> = { year: 'Year', quarter: 'Quarter', month: 'Month', sprint: 'Sprint' };

export function PlanScreen() {
  const state = usePlanIndex();
  const { index, clock, data, result } = state;
  const sprints = data.sprints;

  const [zoom, setZoom] = useState<PlanZoom>('quarter');
  const [anchor, setAnchor] = useState<IsoDate>(clock.today);
  const [filters, setFilters] = useState<PlanFilters>(NO_FILTERS);
  const [expanded, setExpanded] = useState<Set<string>>(() => defaultExpanded(index));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const window = useMemo(() => planWindow(zoom, clock, sprints, anchor), [zoom, clock, sprints, anchor]);
  const title = windowTitle(window, clock, sprints);
  const noun = WINDOW_NOUN[zoom];
  const sprint = zoom === 'sprint' ? (sprints.find((s) => s.start === window.start) ?? null) : null;

  const disagrees = useCallback((id: string) => result.deliverableRag[id]?.disagrees ?? false, [result]);
  const visible = useMemo(() => filterDeliverables(index, filters, disagrees), [index, filters, disagrees]);
  const rows = useMemo(() => buildRows(index, { expanded, visibleDeliverables: visible, zoom, sprintId: sprint?.id ?? null }), [index, expanded, visible, zoom, sprint]);
  const summary = useMemo(() => windowSummary(index, window, visible, clock), [index, window, visible, clock]);
  const knockOns = useMemo(() => windowKnockOns(index, summary, window), [index, summary, window]);

  const changeZoom = (z: string) => {
    setAnchor(zoomAnchor(window, clock.today));
    setZoom(z as PlanZoom);
  };
  const step = (n: number) => setAnchor(stepWindow(window, n, sprints));
  const toToday = () => setAnchor(clock.today);

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const expandAll = () => setExpanded(new Set([...index.descendants.keys(), ...index.deliverables.keys()]));
  const collapseAll = () => setExpanded(new Set(index.children.get(null)?.map((s) => s.entity.id) ?? []));

  const reveal = useCallback(
    (id: string) => {
      setExpanded((prev) => new Set([...prev, ...ancestorsOf(index, id)]));
      setSelectedId(id);
      // Scroll the row into view once it has rendered.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => document.querySelector(`[data-row-key="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })),
      );
    },
    [index],
  );

  const insight = buildInsight(summary, knockOns.length, noun, title);

  return (
    <div className="flex flex-col gap-6">
      {/* Insight first */}
      <section aria-labelledby="plan-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex max-w-[980px] flex-col gap-1.5">
            <span className="di-eyebrow">
              {title} · {formatDate(window.start, { withYear: false })} – {formatDate(window.end)}
            </span>
            <h2 id="plan-heading" className="font-display text-[22px] leading-tight font-semibold text-title">
              {insight.headline}
            </h2>
            <p className="text-[13.5px] leading-relaxed text-fg-muted">{insight.detail}</p>
          </div>
          <div className="flex items-center gap-2">
            <AddToSlides kind="portfolio-quarter" scope={{ kind: 'portfolio' }} />
            <ProvenanceBadges kinds={['computed', 'reported', 'sample']} size="sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4" data-testid="plan-summary">
          <StatTile
            label={`Due this ${noun}`}
            value={summary.commitments}
            icon={<CalendarCheck2 />}
            caption={`${plural(summary.deliverablesDue.length, 'deliverable end')} · ${plural(summary.milestonesDue.length, 'milestone')}`}
          />
          <StatTile
            label="Forecast to slip"
            value={summary.slippingDeliverables.length + summary.slippingMilestones.length}
            icon={<TrendingUp />}
            caption={
              summary.slippingDeliverables.length + summary.slippingMilestones.length === 0
                ? 'Every commitment is projected on plan'
                : `${plural(summary.slippingDeliverables.length, 'deliverable')}, ${plural(summary.slippingMilestones.length, 'milestone')} · ${summary.leavingWindow.length} leave${summary.leavingWindow.length === 1 ? 's' : ''} the ${noun}`
            }
          />
          <StatTile
            label="Regulatory milestones at risk"
            value={summary.regulatoryAtRisk.length}
            icon={<Landmark />}
            caption={summary.regulatoryAtRisk.length ? regulatoryCaption(state, summary.regulatoryAtRisk) : `None due this ${noun} is at risk`}
          />
          <StatTile
            label="Late dependencies"
            value={summary.lateDependencies.length}
            icon={<Link2Off />}
            caption={summary.lateDependencies.length ? `Worst ${summary.worstLateDays} days past need-by` : `None affecting this ${noun}`}
          />
        </div>

        {knockOns.length > 0 ? (
          <div className="di-card flex flex-col gap-0 overflow-hidden p-0" data-testid="plan-knock-ons">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
              <h3 className="text-[13px] font-semibold text-title">Knock-on effect on this {noun}&rsquo;s commitments</h3>
              <span className="text-xs text-fg-subtle">Delay passed straight through to the receiver; one level deep</span>
            </div>
            <ul className="divide-y divide-line">
              {knockOns.slice(0, 3).map((k) => {
                const provider = index.deliverables.get(k.providerId)?.deliverable;
                const receiver = index.deliverables.get(k.receiverId)?.deliverable;
                const dep = data.dependencies.find((x) => x.id === k.dependencyId);
                const hubs = dep ? [data.hubs.find((h) => h.id === dep.fromHubId), data.hubs.find((h) => h.id === dep.toHubId)] : [];
                const reg = k.affectedMilestones.filter((m) => m.regulatory).length;
                return (
                  <li key={k.dependencyId}>
                    <button
                      type="button"
                      onClick={() => reveal(k.receiverId)}
                      className={cx('grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-2.5 text-left hover:bg-hover', FOCUS_RING)}
                    >
                      <span className="inline-flex h-6 items-center gap-1 rounded-pill border border-status-red-line bg-status-red-soft px-2 text-[11.5px] font-semibold whitespace-nowrap text-status-red-fg">
                        <CircleDot aria-hidden className="size-3" />
                        {k.blocked ? terms.dependencyStatus.blocked : `${k.lateDays} days late`}
                      </span>
                      <span className="min-w-0 text-[13px] text-fg">
                        <span className="font-mono text-[12px] text-fg-muted">{provider?.ref}</span>
                        <span className="mx-1.5 text-fg-subtle">→</span>
                        <span className="font-mono text-[12px] font-semibold">{receiver?.ref}</span>
                        <span className="ml-2 font-medium">{receiver?.title}</span>
                        {hubs[0] && hubs[1] && hubs[0].id !== hubs[1].id ? (
                          <span className="ml-2 text-xs text-fg-muted">
                            {hubs[0].name} → {hubs[1].name}
                          </span>
                        ) : null}
                      </span>
                      <span className="flex items-center gap-3 text-xs whitespace-nowrap text-fg-muted">
                        <span>
                          End {formatDate(k.receiverPlannedEnd, { withYear: false })} <span className="text-fg-subtle">→</span>{' '}
                          <span className="font-semibold text-status-red-fg">{formatDate(k.receiverEndWithDelay, { withYear: false })}</span>
                        </span>
                        {k.affectedMilestones.length ? (
                          <span className={cx('font-medium', reg ? 'text-heading' : '')}>
                            {k.affectedMilestones.length} milestone{k.affectedMilestones.length === 1 ? '' : 's'} move{reg ? ` · ${reg} ${planText.regulatory.toLowerCase()}` : ''}
                          </span>
                        ) : null}
                        <ChevronRight aria-hidden className="size-4 text-fg-subtle" />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </section>

      {/* Timeline */}
      <section aria-label="Plan timeline" className="di-card flex flex-col overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <Tabs variant="segmented" ariaLabel="Zoom" value={zoom} onChange={changeZoom} items={PLAN_ZOOMS.map((z) => ({ id: z, label: ZOOM_LABEL[z] }))} />
            <div className="flex items-center gap-1">
              <IconButton label={`Previous ${noun}`} icon={<ChevronLeft />} size="sm" variant="secondary" onClick={() => step(-1)} data-testid="plan-prev" />
              <Button size="sm" variant="secondary" onClick={toToday} icon={<CalendarClock />}>
                {planText.today}
              </Button>
              <IconButton label={`Next ${noun}`} icon={<ChevronRight />} size="sm" variant="secondary" onClick={() => step(1)} data-testid="plan-next" />
            </div>
            <span aria-live="polite" className="min-w-[150px] font-display text-[15px] font-semibold text-title" data-testid="plan-window-title">
              {title}
              <span className="ml-2 font-sans text-xs font-normal text-fg-muted">
                {formatDate(window.start, { withYear: false })} – {formatDate(window.end, { withYear: false })}
              </span>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-fg-muted">
              <span className="sr-only">{terms.hierarchy.programme}</span>
              <select
                value={filters.programmeId ?? ''}
                onChange={(e) => setFilters((f) => ({ ...f, programmeId: e.target.value || null }))}
                className={cx('h-7 rounded-pill border border-line-strong bg-surface px-2.5 text-xs text-fg', FOCUS_RING)}
              >
                <option value="">All programmes</option>
                {index.programmes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <Chip selected={filters.disagreementOnly} onClick={() => setFilters((f) => ({ ...f, disagreementOnly: !f.disagreementOnly }))}>
              Status disagreements only
            </Chip>
            <Chip selected={filters.regulatoryOnly} icon={<Landmark />} onClick={() => setFilters((f) => ({ ...f, regulatoryOnly: !f.regulatoryOnly }))}>
              Regulatory only
            </Chip>
            {isFiltered(filters) ? (
              <Button size="sm" variant="ghost" onClick={() => setFilters(NO_FILTERS)}>
                Clear
              </Button>
            ) : null}
            <span aria-hidden className="mx-1 h-5 w-px bg-line" />
            <IconButton label="Expand all" icon={<ChevronsUpDown />} size="sm" onClick={expandAll} />
            <IconButton label="Collapse all" icon={<ChevronsDownUp />} size="sm" onClick={collapseAll} />
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-fg-muted">No deliverables match these filters.</div>
        ) : (
          <PlanTimeline
            state={state}
            window={window}
            rows={rows}
            sprint={sprint}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onToggle={toggle}
            focusIds={visible}
            ariaLabel={`Plan timeline, ${title}. Use the arrow keys on a row name to move and expand; Tab to reach the bars.`}
          />
        )}
        <Legend />
      </section>

      <PlanDrawer state={state} deliverableId={selectedId} onClose={() => setSelectedId(null)} onSelect={reveal} />
    </div>
  );
}

function regulatoryCaption(state: ReturnType<typeof usePlanIndex>, ids: string[]): string {
  const first = state.data.milestones.find((m) => m.id === ids[0]);
  const d = first ? state.index.deliverables.get(first.deliverableId)?.deliverable : undefined;
  if (!first || !d) return '';
  return `${d.ref} “${first.title}”${ids.length > 1 ? ` and ${ids.length - 1} more` : ''}`;
}

function buildInsight(s: ReturnType<typeof windowSummary>, knockOnCount: number, noun: string, title: string) {
  const slipping = s.slippingDeliverables.length + s.slippingMilestones.length;
  if (s.commitments === 0) {
    return { headline: `No commitments fall due in ${title}`, detail: `Step to another ${noun} or zoom out to see what is planned.` };
  }
  const headline =
    slipping === 0
      ? `All ${s.commitments} commitments due in ${title} are projected on plan`
      : `${slipping} of ${s.commitments} commitments due in ${title} are forecast to slip`;
  const parts: string[] = [];
  if (s.leavingWindow.length) parts.push(`${s.leavingWindow.length} deliverable${s.leavingWindow.length === 1 ? '' : 's'} would finish after the ${noun} ends`);
  if (s.regulatoryAtRisk.length) parts.push(`${s.regulatoryAtRisk.length} regulatory milestone${s.regulatoryAtRisk.length === 1 ? ' is' : 's are'} at risk`);
  if (knockOnCount) parts.push(`${knockOnCount} late or blocked dependenc${knockOnCount === 1 ? 'y carries' : 'ies carry'} the delay into this ${noun}`);
  const detail = parts.length
    ? `${parts.join('; ')}. Forecasts project recent throughput; knock-on passes each dependency delay straight through to its receiver.`
    : 'Forecasts project recent throughput against the planned end.';
  return { headline, detail: detail.charAt(0).toUpperCase() + detail.slice(1) };
}

function Legend() {
  const item = (swatch: ReactNode, label: string) => (
    <span className="inline-flex items-center gap-1.5">
      {swatch}
      {label}
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line bg-surface-2 px-4 py-2.5 text-[11.5px] text-fg-muted" aria-label="Legend">
      {item(
        <span className="relative inline-block h-2.5 w-8 overflow-hidden rounded-xs border border-accent-line bg-accent-soft">
          <span className="absolute inset-y-0 left-0 w-1/2 bg-accent" />
        </span>,
        `${planText.planned}, filled to ${terms.measures.workCompletion.toLowerCase()}`,
      )}
      {item(<span className="inline-block h-2.5 w-8 rounded-xs border border-dashed border-accent bg-accent-soft" />, planText.standalone)}
      {item(<span className="inline-block h-2.5 w-6 rounded-r-xs border border-status-red" style={{ backgroundImage: 'repeating-linear-gradient(135deg, var(--di-status-red) 0 2px, transparent 2px 6px)' }} />, planText.forecastSlip)}
      {item(<span className="inline-block h-2.5 w-8 rounded-xs border-[1.5px] border-dashed border-status-amber" />, `${planText.knockOn} (shifted)`)}
      {item(<Diamond aria-hidden className="size-3 fill-current text-fg-muted" />, 'Milestone')}
      {item(
        <span className="inline-flex items-center gap-0.5">
          <Landmark aria-hidden className="size-3 text-heading" />
          <span className="rounded-xs border border-accent-line bg-accent-soft px-0.5 text-[8.5px] leading-[11px] font-bold text-heading">{planText.regulatoryShort}</span>
        </span>,
        `${planText.regulatory} milestone`,
      )}
      {item(<span className="inline-block h-0 w-6 border-t-[1.75px] border-dashed border-status-red" />, 'Late dependency')}
      {item(<span className="inline-block h-3.5 w-0.5 rounded-pill bg-title" />, 'Forecast end (on or before plan)')}
      {item(<span className="inline-block h-3 w-0.5 bg-accent" />, planText.today)}
      <span className="di-demo-label ml-auto inline-flex items-center gap-1.5">
        <ProvenanceBadge kind="computed" size="sm" />
      </span>
    </div>
  );
}
