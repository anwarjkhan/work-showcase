'use client';

import { motion, useReducedMotion } from 'motion/react';
import { Bot, ChevronLeft, ChevronRight, CircleDashed, CircleDot, CircleCheckBig, Flag, Target, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { cx, Tooltip } from '@/components/ui';
import { FOCUS_RING } from '@/components/ui/cx';
import { MOTION } from '@/components/ui/motion';
import { addDays, daysBetween, formatDate } from '@/lib/config/clock';
import { terms } from '@/lib/config/terminology';
import type { Dependency, IsoDate, PlanTick, PlanWindow, Sprint } from '@/lib/types';
import {
  canvasWidth,
  dayCentre,
  headerTiers,
  isWeekend,
  milestoneRisk,
  rowOffsets,
  slipShort,
  spanGeometry,
  storySpan,
  type PlanRow,
  type SpanGeometry,
} from './layout';
import { MilestoneMark, MiniRag, planText, ProgressFigure } from './PlanBits';
import type { PlanState } from './usePlanIndex';

const MOVE = 'transition-[left,width,opacity] duration-(--di-duration-slow) ease-emphasis';
const HEADER_H = 52;
const pct = (f: number) => `${f * 100}%`;
const geoStyle = (g: Pick<SpanGeometry, 'left' | 'width'>): CSSProperties => ({ left: pct(g.left), width: pct(g.width) });
const later = (a: IsoDate, b: IsoDate) => (b > a ? b : a);
/** Short date; adds the year when it differs from the window's. */
const shortDate = (date: IsoDate, w: Pick<PlanWindow, 'start' | 'end'>) =>
  formatDate(date, { withYear: date.slice(0, 4) !== w.start.slice(0, 4) || date.slice(0, 4) !== w.end.slice(0, 4) });

/** Expected arrival of an open dependency: the later of its committed date and today. */
export function dependencyArrival(dep: Dependency, today: IsoDate): IsoDate {
  return later(dep.committed ?? today, today);
}

export interface PlanTimelineProps {
  state: PlanState;
  window: PlanWindow;
  rows: PlanRow[];
  sprint: Sprint | null;
  selectedId: string | null;
  onSelect: (deliverableId: string) => void;
  onToggle: (id: string) => void;
  /** Deliverables whose rows pass the filters (connector ends must be among them). */
  focusIds: ReadonlySet<string>;
  ariaLabel: string;
}

export function PlanTimeline({ state, window, rows, sprint, selectedId, onSelect, onToggle, focusIds, ariaLabel }: PlanTimelineProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [outer, setOuter] = useState(0);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const update = () => setOuter(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const left = outer > 0 && outer < 1180 ? 296 : 360;
  const canvas = canvasWidth(window.zoom, (outer || 1400) - left);
  const tiers = useMemo(() => headerTiers(window, state.clock, state.data.sprints), [window, state.clock, state.data.sprints]);
  const { top: offsets, total } = useMemo(() => rowOffsets(rows), [rows]);
  const todayX = dayCentre(window, state.clock.today);
  const todayVisible = todayX >= 0 && todayX <= 1;

  // Arrow keys move between row toggles; Right expands, Left collapses.
  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (!target.dataset.rowNav) return;
      const all = Array.from(scroller.current?.querySelectorAll<HTMLElement>('[data-row-nav]') ?? []);
      const i = all.indexOf(target);
      const id = target.dataset.rowId ?? '';
      const expanded = target.getAttribute('aria-expanded') === 'true';
      let next: HTMLElement | undefined;
      if (e.key === 'ArrowDown') next = all[i + 1];
      else if (e.key === 'ArrowUp') next = all[i - 1];
      else if (e.key === 'Home') next = all[0];
      else if (e.key === 'End') next = all[all.length - 1];
      else if (e.key === 'ArrowRight' && !expanded) {
        e.preventDefault();
        onToggle(id);
        return;
      } else if (e.key === 'ArrowLeft' && expanded) {
        e.preventDefault();
        onToggle(id);
        return;
      } else return;
      e.preventDefault();
      next?.focus();
      next?.scrollIntoView({ block: 'nearest' });
    },
    [onToggle],
  );

  return (
    <div
      ref={scroller}
      role="region"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      data-testid="plan-scroller"
      className="relative max-h-[max(560px,calc(100vh-var(--di-topbar-height)-150px))] overflow-auto overscroll-contain rounded-b-lg"
    >
      <div className="relative" style={{ width: left + canvas }}>
        <Header tiers={tiers} window={window} left={left} canvas={canvas} todayX={todayVisible ? todayX : null} today={state.clock.today} />
        <div className="relative" style={{ height: total }}>
          <GridLayer tiers={tiers} window={window} left={left} canvas={canvas} todayX={todayVisible ? todayX : null} />
          <ConnectorLayer state={state} window={window} rows={rows} offsets={offsets} total={total} left={left} canvas={canvas} focusIds={focusIds} />
          {rows.map((row) => (
            <Row
              key={row.key}
              row={row}
              top={offsets.get(row.key) ?? 0}
              state={state}
              window={window}
              left={left}
              canvas={canvas}
              sprint={sprint}
              selected={'id' in row && row.id === selectedId}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header and grid
// ---------------------------------------------------------------------------

function tickKey(t: PlanTick) {
  return `${t.start}:${t.end}`;
}

function Header({ tiers, window, left, canvas, todayX, today }: { tiers: ReturnType<typeof headerTiers>; window: PlanWindow; left: number; canvas: number; todayX: number | null; today: IsoDate }) {
  const dayLabels = tiers.bottomKind === 'day';
  const showDayNames = window.zoom === 'sprint';
  return (
    <div className="sticky top-0 z-30 flex border-b border-line-strong bg-surface" style={{ height: HEADER_H }}>
      <div className="sticky left-0 z-40 flex shrink-0 items-end justify-between border-r border-line bg-surface px-4 pb-2" style={{ width: left }}>
        <span className="di-eyebrow">{terms.hierarchy.investmentRequest} → {terms.hierarchy.outcome}</span>
        <span className="flex items-center gap-3 text-[10.5px] font-medium tracking-wide text-fg-subtle uppercase">
          <span>RAG</span>
          <span className="w-9 text-right">Done</span>
        </span>
      </div>
      <div className="relative shrink-0 overflow-hidden" style={{ width: canvas }}>
        {/* Top tier: labelled bands */}
        <div className="absolute inset-x-0 top-0 h-7" key={`top-${window.zoom}`}>
          {tiers.top.map((t) => {
            const g = spanGeometry(window, t.start, t.end);
            return (
              <div key={tickKey(t)} className={cx('absolute top-0 flex h-full items-center border-l border-line px-2', MOVE)} style={geoStyle(g)}>
                <span className={cx('sticky left-0 truncate text-[12px] font-semibold', t.current ? 'text-heading' : 'text-fg')}>{t.label}</span>
                {t.current && (window.zoom === 'month' || window.zoom === 'sprint') ? (
                  <span className="ml-1.5 shrink-0 rounded-pill bg-accent-soft px-1.5 text-[9.5px] leading-4 font-semibold tracking-wide text-accent uppercase">Current sprint</span>
                ) : null}
              </div>
            );
          })}
        </div>
        {/* Bottom tier: fine ticks */}
        <div className="absolute inset-x-0 bottom-0 h-6 border-t border-line" key={`bottom-${window.zoom}`}>
          {tiers.bottom.map((t) => {
            const g = spanGeometry(window, t.start, t.end);
            const [dayName, dayNum] = t.label.split(' ');
            return (
              <div
                key={tickKey(t)}
                className={cx('absolute top-0 flex h-full items-center border-l border-line/70', dayLabels ? 'justify-center' : 'px-1.5', MOVE, t.current && 'bg-accent-soft')}
                style={geoStyle(g)}
              >
                {dayLabels ? (
                  <span className={cx('text-[10.5px] tabular-nums', t.current ? 'font-semibold text-accent' : isWeekend(t) ? 'text-fg-subtle' : 'text-fg-muted')}>
                    {showDayNames ? `${dayName} ${dayNum}` : dayNum}
                  </span>
                ) : (
                  <span className={cx('truncate text-[10.5px]', t.current ? 'font-semibold text-accent' : 'text-fg-muted')}>
                    {t.label}
                    {tiers.bottomKind === 'sprint' && g.width * canvas > 110 ? <span className="ml-1 text-fg-subtle">{formatDate(t.start, { withYear: false })}</span> : null}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {todayX !== null ? (
          <div className={cx('pointer-events-none absolute top-0.5 z-10 -translate-x-1/2', MOVE)} style={{ left: pct(todayX) }}>
            <span className="inline-flex h-[18px] items-center rounded-pill bg-accent px-1.5 text-[10px] font-semibold whitespace-nowrap text-on-accent shadow-card">
              {planText.today} · {formatDate(today, { withYear: false })}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function GridLayer({ tiers, window, left, canvas, todayX }: { tiers: ReturnType<typeof headerTiers>; window: PlanWindow; left: number; canvas: number; todayX: number | null }) {
  const currentBand = window.zoom === 'month' || window.zoom === 'quarter' ? tiers[window.zoom === 'month' ? 'top' : 'bottom'].find((t) => t.current) : null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-y-0 overflow-hidden" style={{ left, width: canvas }}>
      {currentBand ? <div className={cx('absolute inset-y-0 bg-accent-soft opacity-60', MOVE)} style={geoStyle(spanGeometry(window, currentBand.start, currentBand.end))} /> : null}
      {tiers.bottomKind === 'day'
        ? tiers.bottom.filter(isWeekend).map((t) => <div key={`we-${t.start}`} className={cx('absolute inset-y-0 bg-inset opacity-70', MOVE)} style={geoStyle(spanGeometry(window, t.start, t.end))} />)
        : null}
      {tiers.bottom.map((t) => (
        <div key={`g-${tickKey(t)}`} className={cx('absolute inset-y-0 w-px bg-chart-grid', MOVE)} style={{ left: pct(spanGeometry(window, t.start, t.end).left) }} />
      ))}
      {tiers.top.map((t) => (
        <div key={`G-${tickKey(t)}`} className={cx('absolute inset-y-0 w-px bg-line-strong', MOVE)} style={{ left: pct(spanGeometry(window, t.start, t.end).left) }} />
      ))}
      {todayX !== null ? <div data-testid="plan-today" className={cx('absolute inset-y-0 z-[6] w-0.5 -translate-x-1/2 bg-accent', MOVE)} style={{ left: pct(todayX) }} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dependency connectors
// ---------------------------------------------------------------------------

function ConnectorLayer({ state, window, rows, offsets, total, left, canvas, focusIds }: { state: PlanState; window: PlanWindow; rows: PlanRow[]; offsets: Map<string, number>; total: number; left: number; canvas: number; focusIds: ReadonlySet<string> }) {
  const reduce = useReducedMotion();
  const deliverableRows = new Set(rows.filter((r) => r.kind === 'deliverable').map((r) => r.key));
  const paths = state.index.troubled
    .filter((d) => deliverableRows.has(d.fromDeliverableId) && deliverableRows.has(d.toDeliverableId) && focusIds.has(d.toDeliverableId))
    .map((dep) => {
      const fromY = (offsets.get(dep.fromDeliverableId) ?? 0) + 22;
      const toY = (offsets.get(dep.toDeliverableId) ?? 0) + 22;
      const x1 = dayCentre(window, dependencyArrival(dep, state.clock.today)) * canvas;
      const x2 = dayCentre(window, dep.needBy) * canvas;
      const late = state.index.knockOnByDependency.get(dep.id)?.lateDays ?? 0;
      const bend = Math.max(40, Math.min(160, Math.abs(toY - fromY) / 2));
      const dir = toY > fromY ? 1 : -1;
      const d = `M ${x1} ${fromY + dir * 10} C ${x1} ${fromY + dir * bend}, ${x2} ${toY - dir * bend}, ${x2} ${toY - dir * 12}`;
      return { dep, d, x1, x2, fromY, toY, late, dir };
    });
  if (paths.length === 0) return null;
  return (
    <svg aria-hidden className="pointer-events-none absolute top-0 z-[7] overflow-visible" style={{ left, width: canvas, height: total }} width={canvas} height={total}>
      <defs>
        <marker id="plan-dep-arrow" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L8,4 L0,8 z" fill="var(--di-status-red)" />
        </marker>
      </defs>
      <clipPath id="plan-dep-clip">
        <rect x="0" y="0" width={canvas} height={total} />
      </clipPath>
      <g clipPath="url(#plan-dep-clip)">
        {paths.map((p) => (
          <g key={p.dep.id} data-testid={`plan-connector-${p.dep.id}`}>
            <motion.path
              d={p.d}
              fill="none"
              stroke="var(--di-status-red)"
              strokeWidth={1.75}
              strokeDasharray="5 4"
              markerEnd="url(#plan-dep-arrow)"
              initial={{ pathLength: reduce ? 1 : 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.95, d: p.d }}
              transition={{ duration: reduce ? 0 : MOTION.slow * 1.6, ease: MOTION.easeEmphasis }}
            />
            <circle cx={p.x1} cy={p.fromY + p.dir * 10} r={3} fill="var(--di-status-red)" />
          </g>
        ))}
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

interface RowProps {
  row: PlanRow;
  top: number;
  state: PlanState;
  window: PlanWindow;
  left: number;
  canvas: number;
  sprint: Sprint | null;
  selected: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
}

const Row = memo(function Row({ row, state, window, left, canvas, sprint, selected, onSelect, onToggle }: RowProps) {
  const reduce = useReducedMotion();
  const tone =
    row.kind === 'rollup' && row.level === 'investment-request'
      ? 'bg-surface-2'
      : row.kind === 'deliverable' && selected
        ? 'bg-selected'
        : row.kind === 'outcome' || row.kind === 'milestones' || row.kind === 'story' || row.kind === 'story-group'
          ? 'bg-canvas/40'
          : '';
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: MOTION.base, ease: MOTION.easeStandard }}
      data-row={row.kind}
      data-row-key={row.key}
      className={cx('group relative flex border-b border-line/70', tone, row.kind === 'deliverable' && 'hover:bg-hover')}
      style={{ height: row.height }}
    >
      <div
        className={cx('sticky left-0 z-20 flex shrink-0 items-center gap-2 border-r border-line pr-3', row.kind === 'rollup' && row.level === 'investment-request' ? 'bg-surface-2' : 'bg-surface', selected && 'bg-selected')}
        style={{ width: left, paddingLeft: 10 + row.depth * 16 }}
      >
        <NameCell row={row} state={state} onToggle={onToggle} />
      </div>
      <div className="relative shrink-0 overflow-hidden" style={{ width: canvas }}>
        <Track row={row} state={state} window={window} sprint={sprint} selected={selected} onSelect={onSelect} />
      </div>
    </motion.div>
  );
});

function Toggle({ id, expanded, label, onToggle, children }: { id: string; expanded: boolean; label: string; onToggle: (id: string) => void; children: ReactNode }) {
  return (
    <button
      type="button"
      data-row-nav
      data-row-id={id}
      aria-expanded={expanded}
      aria-label={`${expanded ? 'Collapse' : 'Expand'} ${label}`}
      onClick={() => onToggle(id)}
      className={cx('flex min-w-0 flex-1 items-center gap-1.5 rounded-sm py-1 text-left', FOCUS_RING)}
    >
      <ChevronRight aria-hidden className={cx('size-3.5 shrink-0 text-fg-subtle transition-transform duration-(--di-duration-base) ease-standard', expanded && 'rotate-90')} />
      {children}
    </button>
  );
}

function NameCell({ row, state, onToggle }: { row: PlanRow; state: PlanState; onToggle: (id: string) => void }) {
  const { data, result, rollups, index } = state;
  switch (row.kind) {
    case 'rollup': {
      const isIr = row.level === 'investment-request';
      const ir = isIr ? data.investmentRequests.find((x) => x.id === row.id) : undefined;
      const node = isIr ? undefined : data.pmNodes.find((x) => x.id === row.id);
      const roll = isIr ? rollups.investmentRequests[row.id] : rollups.pmNodes[row.id];
      const title = ir?.title ?? node?.title ?? row.id;
      const eyebrow = ir ? ir.ref : node ? terms.pmNodeLevels[node.level] : '';
      return (
        <>
          <Toggle id={row.id} expanded={row.expanded} label={title} onToggle={onToggle}>
            <span className="min-w-0">
              <span className={cx('block truncate text-[10px] font-semibold tracking-wider uppercase', isIr ? 'font-mono text-fg-subtle' : 'text-fg-subtle')}>
                {eyebrow}
                {ir ? <span className="ml-1.5 font-sans normal-case tracking-normal">{ir.route === 'standalone' ? `· ${planText.standalone}` : `· ${terms.activityRisk[ir.activityRisk]} risk`}</span> : null}
              </span>
              <span className={cx('block truncate leading-tight', isIr ? 'text-[13px] font-semibold text-title' : 'text-[12.5px] font-semibold text-fg')}>{title}</span>
            </span>
          </Toggle>
          {roll ? <MiniRag reported={roll.rag.reported} evidence={roll.rag.evidence} disagrees={roll.rag.disagrees} /> : null}
          <ProgressFigure value={roll?.workCompletion} />
        </>
      );
    }
    case 'deliverable': {
      const info = index.deliverables.get(row.id);
      if (!info) return null;
      const d = info.deliverable;
      const rag = result.deliverableRag[row.id];
      return (
        <>
          <Toggle id={row.id} expanded={row.expanded} label={`${d.ref} ${d.title}`} onToggle={onToggle}>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5">
                <span className="font-mono text-[10.5px] text-fg-subtle">{d.ref}</span>
                {info.standalone ? (
                  <span className="rounded-pill border border-dashed border-line-strong px-1.5 text-[9.5px] leading-[14px] font-semibold text-fg-muted">{planText.standaloneShort}</span>
                ) : null}
              </span>
              <span className="block truncate text-[12.5px] leading-tight font-medium text-fg">{d.title}</span>
            </span>
          </Toggle>
          {rag ? <MiniRag reported={rag.reported} evidence={rag.evidence} disagrees={rag.disagrees} /> : null}
          <ProgressFigure value={result.deliverables[row.id]?.workCompletion} />
        </>
      );
    }
    case 'outcome': {
      const o = data.outcomes.find((x) => x.id === row.id);
      const m = result.outcomes[row.id];
      if (!o) return null;
      const accepted = m?.acceptance.accepted ?? false;
      return (
        <>
          <Target aria-hidden className="size-3.5 shrink-0 text-fg-subtle" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] text-fg">
              <span className="mr-1.5 font-mono text-[10.5px] text-fg-subtle">{o.ref}</span>
              {o.title}
            </span>
          </span>
          <span
            className={cx('shrink-0 text-[10.5px] font-medium', accepted ? 'text-status-green-fg' : 'text-fg-subtle')}
            title={accepted ? 'Accepted outcome' : `Not accepted; reported ${o.reportedStatus.replace('-', ' ')}`}
          >
            {accepted ? (
              <span className="inline-flex items-center gap-0.5">
                <CircleCheckBig aria-hidden className="size-3" /> Accepted
              </span>
            ) : (
              'Not accepted'
            )}
          </span>
          <ProgressFigure value={m?.workCompletion} />
        </>
      );
    }
    case 'milestones': {
      const info = index.deliverables.get(row.deliverableId);
      return (
        <span className="flex min-w-0 flex-1 items-center gap-2 text-[12px] text-fg-muted">
          <Flag aria-hidden className="size-3.5 shrink-0 text-fg-subtle" />
          {planText.milestones}
          <span className="text-fg-subtle tabular-nums">{info?.milestones.length ?? 0}</span>
          {info && info.milestones.some((m) => m.regulatory) ? <span className="ml-auto text-[10.5px] font-semibold text-heading">{info.milestones.filter((m) => m.regulatory).length} {planText.regulatory.toLowerCase()}</span> : null}
        </span>
      );
    }
    case 'story-group':
      return (
        <span className="flex min-w-0 flex-1 items-center gap-2 text-[11.5px] text-status-amber-fg" title="Story-level work in this sprint without an Outcome ID (rule R9)">
          <CircleDashed aria-hidden className="size-3.5 shrink-0" />
          {planText.noOutcome}
          <span className="tabular-nums">{row.storyCount}</span>
        </span>
      );
    case 'story': {
      const w = index.deliverables.get(row.deliverableId)?.stories.find((s) => s.key === row.id);
      if (!w) return null;
      const Icon = w.statusCategory === 'done' ? CircleCheckBig : w.statusCategory === 'in-progress' ? CircleDot : CircleDashed;
      return (
        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[11.5px]">
          <Icon aria-hidden className={cx('size-3 shrink-0', w.statusCategory === 'done' ? 'text-accent' : 'text-fg-subtle')} />
          <span className="shrink-0 font-mono text-[10.5px] text-fg-subtle">{w.key}</span>
          <span className="min-w-0 flex-1 truncate text-fg-muted">{w.summary}</span>
          {w.assigneeType === 'agent' ? <Bot aria-label="Agent-assigned" className="size-3 shrink-0 text-prov-scripted" /> : null}
          <span className="shrink-0 text-[10px] text-fg-subtle">{terms.statusCategories[w.statusCategory]}</span>
        </span>
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Tracks
// ---------------------------------------------------------------------------

function Track({ row, state, window, sprint, selected, onSelect }: { row: PlanRow; state: PlanState; window: PlanWindow; sprint: Sprint | null; selected: boolean; onSelect: (id: string) => void }) {
  switch (row.kind) {
    case 'rollup':
      return <RollupTrack id={row.id} state={state} window={window} level={row.level} />;
    case 'deliverable':
      return <DeliverableTrack id={row.id} state={state} window={window} selected={selected} onSelect={onSelect} />;
    case 'outcome':
      return <OutcomeTrack id={row.id} deliverableId={row.deliverableId} state={state} window={window} />;
    case 'milestones':
      return <MilestoneTrack deliverableId={row.deliverableId} state={state} window={window} />;
    case 'story':
      return sprint ? <StoryTrack id={row.id} deliverableId={row.deliverableId} state={state} window={window} sprint={sprint} /> : null;
    case 'story-group':
      return null;
  }
}

/** Arrow cue at the track edge for a bar that continues beyond the window. */
function ClipCue({ side, text, tone = 'neutral' }: { side: 'start' | 'end'; text: string; tone?: 'neutral' | 'red' }) {
  const Icon = side === 'start' ? ChevronLeft : ChevronRight;
  return (
    <span
      className={cx(
        'pointer-events-none absolute top-1/2 z-[10] inline-flex -translate-y-1/2 items-center gap-0.5 rounded-pill border bg-surface px-1.5 text-[10px] font-semibold whitespace-nowrap shadow-card',
        side === 'start' ? 'left-1' : 'right-1 flex-row-reverse',
        tone === 'red' ? 'border-status-red-line text-status-red-fg' : 'border-line-strong text-fg-muted',
      )}
    >
      <Icon aria-hidden className="size-3" strokeWidth={2.6} />
      {text}
    </span>
  );
}

/** Label placed after a position, or before it near the right edge. */
function EdgeLabel({ at, children, className }: { at: number; children: ReactNode; className?: string }) {
  if (at < 0 || at > 1) return null;
  const flip = at > 0.86;
  return (
    <span className={cx('pointer-events-none absolute z-[8] inline-flex items-center gap-1 whitespace-nowrap', MOVE, className)} style={{ left: pct(at), transform: flip ? 'translateX(calc(-100% - 6px))' : 'translateX(6px)' }}>
      {children}
    </span>
  );
}

const HATCH: CSSProperties = {
  backgroundImage: 'repeating-linear-gradient(135deg, var(--di-status-red) 0 2px, transparent 2px 6px)',
};

function RollupTrack({ id, state, window, level }: { id: string; state: PlanState; window: PlanWindow; level: 'investment-request' | 'pm-node' }) {
  const span = state.index.spans.get(id);
  if (!span) return null;
  const roll = level === 'investment-request' ? state.rollups.investmentRequests[id] : state.rollups.pmNodes[id];
  const projected = state.index.rollupProjectedEnd.get(id) ?? span.plannedEnd;
  const g = spanGeometry(window, span.plannedStart, span.plannedEnd);
  const slip = projected > span.plannedEnd ? spanGeometry(window, addDays(span.plannedEnd, 1), projected) : null;
  const done = roll?.workCompletion.computable ? roll.workCompletion.value.ratio : 0;
  const slipDays = daysBetween(span.plannedEnd, projected);
  const y = level === 'investment-request' ? 'top-[19px] h-2' : 'top-[16px] h-2';
  return (
    <>
      {slip ? <div className={cx('absolute rounded-r-xs border border-l-0 border-status-red-line opacity-80', y, MOVE)} style={{ ...geoStyle(slip), ...HATCH }} /> : null}
      <div className={cx('absolute overflow-hidden rounded-xs border border-line-strong bg-inset', y, MOVE)} style={geoStyle(g)}>
        <div className="h-full bg-fg-subtle" style={{ width: pct(done) }} />
      </div>
      {/* Summary brackets */}
      <div className={cx('absolute h-4', level === 'investment-request' ? 'top-[15px]' : 'top-[12px]', MOVE)} style={geoStyle(g)}>
        <span className="absolute top-0 left-0 h-full w-[3px] rounded-l-xs bg-fg-muted" />
        <span className="absolute top-0 right-0 h-full w-[3px] rounded-r-xs bg-fg-muted" />
      </div>
      {slip && slip.visible && !slip.clippedEnd ? (
        <EdgeLabel at={slip.left + slip.width} className="top-[12px] text-[10.5px] font-semibold text-status-red-fg">
          {slipShort(slipDays)}
        </EdgeLabel>
      ) : null}
      {g.clippedStart ? <ClipCue side="start" text={shortDate(span.plannedStart, window)} /> : null}
      {g.clippedEnd || slip?.clippedEnd || (slip && !slip.visible && g.visible) ? (
        <ClipCue side="end" text={slip ? `${shortDate(projected, window)} · ${slipShort(slipDays)}` : shortDate(span.plannedEnd, window)} tone={slip ? 'red' : 'neutral'} />
      ) : null}
    </>
  );
}

function DeliverableTrack({ id, state, window, selected, onSelect }: { id: string; state: PlanState; window: PlanWindow; selected: boolean; onSelect: (id: string) => void }) {
  const { index, result, clock } = state;
  const info = index.deliverables.get(id);
  if (!info) return null;
  const d = info.deliverable;
  const wc = result.deliverables[id]?.workCompletion;
  const done = wc?.computable ? wc.value.ratio : 0;
  const g = spanGeometry(window, d.plannedStart, d.plannedEnd);
  const fEnd = info.forecast?.forecastEnd ?? info.span.forecastEnd;
  const fSlip = info.forecast ? info.forecast.slipDays : info.span.slipDays;
  const slipG = fSlip > 0 ? spanGeometry(window, addDays(d.plannedEnd, 1), fEnd) : null;
  const worstKnock = info.knockOns.reduce<(typeof info.knockOns)[number] | null>((a, k) => (!a || k.lateDays > a.lateDays ? k : a), null);
  const ghost = worstKnock && worstKnock.lateDays > 0 ? spanGeometry(window, addDays(d.plannedStart, worstKnock.lateDays), worstKnock.receiverEndWithDelay) : null;
  const furthest = info.projectedEnd;
  const furthestX = spanGeometry(window, furthest, furthest);
  const endX = furthestX.left + furthestX.width;
  const anyClippedEnd = (ghost?.clippedEnd ?? false) || (slipG?.clippedEnd ?? false) || g.clippedEnd;

  const inbound = index.troubled.filter((x) => x.toDeliverableId === id);
  const outbound = index.troubled.filter((x) => x.fromDeliverableId === id);

  const tooltip = (
    <span className="flex flex-col gap-1">
      <span className="font-semibold text-title">
        {d.ref} {d.title}
      </span>
      <span className="text-fg-muted">
        Planned {formatDate(d.plannedStart, { withYear: false })} – {formatDate(d.plannedEnd)} · {terms.measures.workCompletion} {wc?.computable ? `${wc.value.percent}%` : terms.measures.notComputable}
      </span>
      {info.forecast ? <span>{info.forecast.explanation}</span> : null}
      {info.knockOns.map((k) => (
        <span key={k.dependencyId} className="text-status-amber-fg">
          {k.explanation}
        </span>
      ))}
    </span>
  );

  const label = `${d.ref} ${d.title}. Planned ${formatDate(d.plannedStart)} to ${formatDate(d.plannedEnd)}. ${
    info.projectedSlipDays > 0 ? `Projected end ${formatDate(info.projectedEnd)}, ${slipShort(info.projectedSlipDays)} late.` : 'Projected on or before plan.'
  } Open details.`;

  return (
    <>
      {ghost ? (
        <div
          data-testid={`plan-ghost-${id}`}
          className={cx('absolute top-[22px] h-4 rounded-sm border-[1.5px] border-dashed border-status-amber', MOVE)}
          style={{ ...geoStyle(ghost), background: 'color-mix(in srgb, var(--di-status-amber) 22%, transparent)' }}
          title={worstKnock?.explanation}
        />
      ) : null}
      {slipG ? (
        <div
          data-testid={`plan-slip-${id}`}
          className={cx('absolute top-[12px] h-[18px] rounded-r-sm border border-l-0 border-status-red', MOVE)}
          style={{ ...geoStyle(slipG), ...HATCH }}
        />
      ) : null}
      <div className={cx('absolute top-[12px] h-[18px]', MOVE)} style={geoStyle(g)}>
        <Tooltip content={tooltip} className="block size-full" delay={180}>
          <button
            type="button"
            data-plan-bar={id}
            aria-label={label}
            aria-pressed={selected}
            onClick={() => onSelect(id)}
            className={cx(
              'relative block size-full overflow-hidden rounded-sm border bg-accent-soft text-left transition-shadow duration-(--di-duration-fast) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
              info.standalone ? 'border-dashed border-accent' : 'border-accent-line',
              selected ? 'shadow-focus ring-1 ring-accent' : 'hover:shadow-raised',
            )}
          >
            <span className="absolute inset-y-0 left-0 bg-accent opacity-90" style={{ width: pct(done) }} />
          </button>
        </Tooltip>
      </div>
      {/* Engine forecast end when it lands inside the plan */}
      {fSlip <= 0 && fEnd >= d.plannedStart ? (
        <span
          className={cx('pointer-events-none absolute top-[9px] h-6 w-0.5 -translate-x-1/2 rounded-pill bg-title', MOVE)}
          style={{ left: pct(spanGeometry(window, fEnd, fEnd).left + spanGeometry(window, fEnd, fEnd).width) }}
          title={`Forecast end ${formatDate(fEnd)}`}
        />
      ) : null}
      {info.milestones.map((m) => {
        const x = dayCentre(window, m.date);
        if (x < 0 || x > 1) return null;
        return (
          <span key={m.id} className={cx('absolute top-[11px] z-[9]', MOVE)} style={{ left: pct(x) }}>
            <MilestoneMark milestone={m} risk={milestoneRisk(index, m, clock)} size="sm" />
          </span>
        );
      })}
      {inbound.map((dep) => {
        const x = dayCentre(window, dep.needBy);
        const late = index.knockOnByDependency.get(dep.id)?.lateDays ?? 0;
        return x >= 0 && x <= 1 ? (
          <span
            key={dep.id}
            data-testid={`plan-in-${dep.id}`}
            className={cx('absolute top-[31px] z-[9] inline-flex -translate-x-1/2 items-center gap-0.5 rounded-pill border border-status-red-line bg-status-red-soft px-1 text-[9.5px] leading-[13px] font-semibold text-status-red-fg', MOVE)}
            style={{ left: pct(x) }}
            title={`${planText.inbound}: ${dep.title}, needed ${formatDate(dep.needBy)}, ${terms.dependencyStatus[dep.status]}${late ? `, ${late} days late` : ''}`}
          >
            <ArrowDownToLine aria-hidden className="size-2.5" strokeWidth={2.6} />
            {late ? `${late}d` : terms.dependencyStatus[dep.status]}
          </span>
        ) : null;
      })}
      {outbound.map((dep) => {
        const x = dayCentre(window, dependencyArrival(dep, clock.today));
        return x >= 0 && x <= 1 ? (
          <span
            key={dep.id}
            data-testid={`plan-out-${dep.id}`}
            className={cx('absolute top-[1px] z-[9] inline-flex -translate-x-1/2 items-center gap-0.5 rounded-pill border border-status-red-line bg-surface px-1 text-[9.5px] leading-[11px] font-semibold text-status-red-fg', MOVE)}
            style={{ left: pct(x) }}
            title={`${planText.outbound}: ${dep.title}, ${terms.dependencyStatus[dep.status]}`}
          >
            <ArrowUpFromLine aria-hidden className="size-2.5" strokeWidth={2.6} />
            out
          </span>
        ) : null;
      })}
      {info.projectedSlipDays > 0 && !anyClippedEnd ? (
        <EdgeLabel at={endX} className="top-[12px]">
          <span className="rounded-pill border border-status-red-line bg-status-red-soft px-1.5 text-[10.5px] leading-[16px] font-semibold text-status-red-fg">
            {slipShort(info.projectedSlipDays)}
            <span className="ml-1 font-normal">{fSlip >= info.projectedSlipDays ? 'forecast' : 'knock-on'}</span>
          </span>
        </EdgeLabel>
      ) : null}
      {g.clippedStart ? <ClipCue side="start" text={shortDate(d.plannedStart, window)} /> : null}
      {anyClippedEnd && g.visible ? (
        <ClipCue side="end" text={info.projectedSlipDays > 0 ? `${shortDate(furthest, window)} · ${slipShort(info.projectedSlipDays)}` : shortDate(d.plannedEnd, window)} tone={info.projectedSlipDays > 0 ? 'red' : 'neutral'} />
      ) : null}
      {anyClippedEnd && !g.visible && (ghost?.visible || slipG?.visible) ? (
        <ClipCue side="end" text={`${shortDate(furthest, window)} · ${slipShort(info.projectedSlipDays)}`} tone="red" />
      ) : null}
      {!g.visible && !ghost?.visible && !slipG?.visible ? (
        <span className="pointer-events-none absolute inset-y-0 flex items-center text-[10.5px] text-fg-subtle" style={g.left >= 1 ? { right: 8 } : { left: 8 }}>
          {g.left >= 1 ? `Starts ${formatDate(d.plannedStart)} ›` : `‹ Ended ${formatDate(furthest)}`}
        </span>
      ) : null}
    </>
  );
}

function OutcomeTrack({ id, deliverableId, state, window }: { id: string; deliverableId: string; state: PlanState; window: PlanWindow }) {
  const info = state.index.deliverables.get(deliverableId);
  const o = info?.outcomes.find((x) => x.id === id);
  if (!info || !o) return null;
  const m = state.result.outcomes[id];
  const done = m?.workCompletion.computable ? m.workCompletion.value.ratio : 0;
  const accepted = m?.acceptance.accepted ?? false;
  const g = spanGeometry(window, info.deliverable.plannedStart, o.dueDate);
  const due = dayCentre(window, o.dueDate);
  return (
    <>
      <div className={cx('absolute top-[13px] h-1.5 overflow-hidden rounded-pill bg-line', MOVE)} style={geoStyle(g)}>
        <div className="h-full bg-chart-4" style={{ width: pct(done) }} />
      </div>
      {due >= 0 && due <= 1 ? (
        <span className={cx('absolute top-[8px] -translate-x-1/2', MOVE)} style={{ left: pct(due) }} title={`Due ${formatDate(o.dueDate)}${accepted ? ', accepted' : ', not accepted'}`}>
          {accepted ? <CircleCheckBig aria-hidden className="size-4 rounded-pill bg-surface text-status-green" /> : <span className="block size-3 translate-y-0.5 rounded-pill border-2 border-chart-4 bg-surface" />}
        </span>
      ) : null}
      {g.clippedStart ? <ClipCue side="start" text={shortDate(info.deliverable.plannedStart, window)} /> : null}
      {g.clippedEnd && g.visible ? <ClipCue side="end" text={`Due ${shortDate(o.dueDate, window)}`} /> : null}
    </>
  );
}

function MilestoneTrack({ deliverableId, state, window }: { deliverableId: string; state: PlanState; window: PlanWindow }) {
  const info = state.index.deliverables.get(deliverableId);
  if (!info) return null;
  // Latest shifted date that leaves the window, shown as one edge cue.
  const outOfWindow = info.milestones
    .map((m) => state.index.shiftedMilestones.get(m.id))
    .filter((d): d is IsoDate => d !== undefined && d > window.end)
    .sort()
    .pop();
  return (
    <>
      {info.milestones.map((m) => {
        const x = dayCentre(window, m.date);
        const shifted = state.index.shiftedMilestones.get(m.id);
        const sx = shifted ? dayCentre(window, shifted) : null;
        return (
          <span key={m.id}>
            {sx !== null && shifted ? (
              <>
                <span className={cx('absolute top-[16px] h-px border-t border-dashed border-status-amber', MOVE)} style={{ left: pct(Math.min(x, sx)), width: pct(Math.abs(sx - x)) }} />
                {sx >= 0 && sx <= 1 ? (
                  <span data-testid={`plan-ms-shift-${m.id}`} className={cx('absolute top-[8px] z-[8]', MOVE)} style={{ left: pct(sx) }}>
                    <MilestoneMark milestone={{ ...m, date: shifted }} risk="shifted" ghost showTitle flip={sx > 0.8} />
                  </span>
                ) : null}
              </>
            ) : null}
            {x >= 0 && x <= 1 ? (
              <span className={cx('absolute top-[8px] z-[9]', MOVE)} style={{ left: pct(x) }}>
                <MilestoneMark milestone={m} risk={milestoneRisk(state.index, m, state.clock)} showTitle={!shifted} flip={x > 0.8} />
              </span>
            ) : null}
          </span>
        );
      })}
      {outOfWindow ? <ClipCue side="end" text={`moves to ${shortDate(outOfWindow, window)}`} tone="red" /> : null}
    </>
  );
}

function StoryTrack({ id, deliverableId, state, window, sprint }: { id: string; deliverableId: string; state: PlanState; window: PlanWindow; sprint: Sprint }) {
  const w = state.index.deliverables.get(deliverableId)?.stories.find((s) => s.key === id);
  if (!w) return null;
  const s = storySpan(w, sprint);
  const g = spanGeometry(window, s.start, s.end);
  return (
    <div
      className={cx(
        'absolute top-[8px] flex h-3 items-center overflow-hidden rounded-xs border',
        MOVE,
        w.statusCategory === 'done' ? 'border-accent bg-accent' : w.statusCategory === 'in-progress' ? 'border-accent-line bg-accent-soft' : 'border-dashed border-line-strong bg-transparent',
      )}
      style={geoStyle(g)}
      title={`${w.key} ${w.summary} · ${terms.statusCategories[w.statusCategory]}${w.points !== null ? ` · ${w.points} pts` : ''}`}
    >
      {w.statusCategory === 'in-progress' ? <span className="h-full w-1/2 bg-accent/60" /> : null}
    </div>
  );
}
