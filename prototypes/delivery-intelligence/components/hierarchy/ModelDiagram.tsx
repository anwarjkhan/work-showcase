'use client';

import type { KeyboardEvent, ReactNode } from 'react';
import { terms } from '@/lib/config/terminology';
import { cx } from '@/components/ui';
import type { ExplorerView, TreeModel } from './model';

/** Gets keyboard and pointer activation for a clickable SVG group. */
function actionProps(label: string, onClick?: () => void) {
  if (!onClick) return {};
  return {
    role: 'button' as const,
    tabIndex: 0,
    'aria-label': label,
    onClick,
    onKeyDown: (e: KeyboardEvent<SVGGElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    },
    className: 'cursor-pointer outline-none focus-visible:[&_rect]:stroke-accent focus-visible:[&_rect]:stroke-[3]',
  };
}

interface NodeProps {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  count?: number;
  sub?: ReactNode;
  tone?: 'portfolio' | 'jira';
  active?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
  children?: ReactNode;
}

function Node({ x, y, w, h, title, count, sub, tone = 'portfolio', active, onClick, ariaLabel, children }: NodeProps) {
  return (
    <g {...actionProps(ariaLabel ?? title, onClick)}>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={9}
        className={cx('fill-surface', active ? 'stroke-accent' : tone === 'jira' ? 'stroke-chart-2' : 'stroke-line-strong')}
        strokeWidth={active ? 2 : 1.25}
      />
      <rect x={x} y={y + 10} width={3} height={h - 20} rx={1.5} className={tone === 'jira' ? 'fill-chart-2' : 'fill-accent'} />
      <text x={x + 16} y={y + 24} className="fill-fg" fontSize={13} fontWeight={600}>
        {title}
      </text>
      {count !== undefined ? (
        <text x={x + 16} y={y + 62} className="fill-title font-display" fontSize={30} fontWeight={600}>
          {count}
        </text>
      ) : null}
      {sub ? (
        <text x={x + 16} y={y + h - 12} className="fill-fg-muted" fontSize={11}>
          {sub}
        </text>
      ) : null}
      {children}
    </g>
  );
}

function FieldChip({ x, y, label }: { x: number; y: number; label: string }) {
  const w = label.length * 7.4 + 22;
  return (
    <g>
      <rect x={x - w / 2} y={y - 12} width={w} height={24} rx={12} className="fill-surface-2" />
      <rect x={x - w / 2} y={y - 12} width={w} height={24} rx={12} className="fill-accent-soft stroke-accent-line" strokeWidth={1} />
      <text x={x} y={y + 4} textAnchor="middle" className="fill-accent font-mono" fontSize={12} fontWeight={600}>
        {label}
      </text>
    </g>
  );
}

/**
 * The hierarchy model as one picture: portfolio system above the book-of-record boundary,
 * Jira below it, the formal and standalone routes as different paths, and the two joining fields
 * on the connectors. Every count comes from the data; nodes are clickable filters for the explorer.
 */
export function ModelDiagram({ model, view, onView }: { model: TreeModel; view: ExplorerView; onView: (v: ExplorerView) => void }) {
  const c = model.counts;
  const h = terms.hierarchy;
  const avgEpics = c.deliverables > 0 ? (c.epics / c.deliverables).toFixed(1) : '0';
  const jiraTypes = [terms.workItemTypes.story, terms.workItemTypes['new-feature'], terms.workItemTypes.task, terms.workItemTypes.bug, terms.workItemTypes.improvement, terms.workItemTypes.raid, terms.workItemTypes['production-issue'], terms.workItemTypes.spike];
  const formalActive = view === 'formal';
  const standaloneActive = view === 'standalone';

  return (
    <svg viewBox="0 0 1240 428" className="block h-auto w-full" aria-labelledby="hier-diagram-title">
      <title id="hier-diagram-title">{`${terms.app.hierarchyModel}: ${h.investmentRequest}, formal route or standalone route, ${h.deliverable}, ${h.outcome}, then ${terms.systems['work-tracker']} ${h.epic}s, story-level items and sub-tasks`}</title>
      <defs>
        <marker id="hd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 1 L10 5 L0 9 z" className="fill-accent" />
        </marker>
        <marker id="hd-arrow-alt" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 1 L10 5 L0 9 z" className="fill-chart-3" />
        </marker>
        <marker id="hd-arrow-jira" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 1 L10 5 L0 9 z" className="fill-chart-2" />
        </marker>
      </defs>

      {/* Zones */}
      <rect x={1} y={1} width={1238} height={242} rx={12} className="fill-surface-2 stroke-line" />
      <rect x={1} y={268} width={1238} height={159} rx={12} className="fill-inset stroke-line" />
      <text x={18} y={24} className="fill-accent" fontSize={11} fontWeight={700} letterSpacing="0.08em">
        {`${terms.systems['portfolio-system']} · ${terms.bookOfRecord}`.toUpperCase()}
      </text>
      <text x={18} y={294} className="fill-chart-2" fontSize={11} fontWeight={700} letterSpacing="0.08em">
        {terms.systems['work-tracker'].toUpperCase()}
      </text>

      {/* Boundary */}
      <line x1={0} y1={256} x2={1240} y2={256} className="stroke-fg-subtle" strokeWidth={1.5} strokeDasharray="7 5" />
      <rect x={196} y={243} width={300} height={26} rx={13} className="fill-surface stroke-line-strong" />
      <text x={346} y={260} textAnchor="middle" className="fill-fg" fontSize={12} fontWeight={600}>
        {terms.bookOfRecordBoundary}
      </text>

      {/* Connectors, portfolio zone */}
      <line x1={186} y1={96} x2={248} y2={96} className="stroke-accent" strokeWidth={1.75} markerEnd="url(#hd-arrow)" />
      <line x1={472} y1={96} x2={554} y2={96} className="stroke-accent" strokeWidth={1.75} markerEnd="url(#hd-arrow)" />
      <line x1={746} y1={108} x2={834} y2={108} className="stroke-fg-subtle" strokeWidth={1.75} markerEnd="url(#hd-arrow)" />
      <text x={252} y={46} className="fill-accent" fontSize={11} fontWeight={700} letterSpacing="0.06em">
        FORMAL ROUTE
      </text>
      <text x={252} y={60} className="fill-fg-muted" fontSize={10.5}>
        moderate and high activity risk
      </text>

      {/* Standalone route: its own dashed path from request to deliverable */}
      <g {...actionProps(`${terms.routes.standalone}: show standalone route`, () => onView(standaloneActive ? 'all' : 'standalone'))}>
        <path
          d="M101 160 V212 H520 V136 H554"
          fill="none"
          className="stroke-chart-3"
          strokeWidth={standaloneActive ? 3 : 2}
          strokeDasharray="8 6"
          markerEnd="url(#hd-arrow-alt)"
        />
        <rect x={116} y={178} width={330} height={26} rx={13} className={cx('fill-surface', standaloneActive ? 'stroke-chart-3' : 'stroke-line-strong')} strokeDasharray="4 3" />
        <text x={130} y={195} className="fill-chart-3" fontSize={11} fontWeight={700} letterSpacing="0.04em">
          {`STANDALONE ROUTE`}
          <tspan className="fill-fg-muted" fontWeight={500} letterSpacing="0">{`  low activity risk · ${c.standalone} ${c.standalone === 1 ? 'deliverable' : 'deliverables'}`}</tspan>
        </text>
      </g>

      <Node
        x={16}
        y={60}
        w={170}
        h={100}
        title={h.investmentRequest}
        count={c.requests}
        sub={`${c.byRisk.high} ${terms.activityRisk.high} · ${c.byRisk.moderate} ${terms.activityRisk.moderate} · ${c.byRisk.low} ${terms.activityRisk.low}`}
        onClick={() => onView('all')}
        ariaLabel={`${h.investmentRequest}: show all`}
      />

      <Node x={250} y={68} w={222} h={56} title="" active={formalActive} onClick={() => onView(formalActive ? 'all' : 'formal')} ariaLabel={`${terms.routes.formal}: show formal route`}>
        {[
          { label: terms.pmNodeLevels.initiative, n: c.initiatives },
          { label: terms.pmNodeLevels.programme, n: c.programmes },
          { label: terms.pmNodeLevels.project, n: c.projects },
        ].map((l, i) => (
          <g key={l.label}>
            <text x={266 + i * 70} y={96} className="fill-title font-display" fontSize={20} fontWeight={600}>
              {l.n}
            </text>
            <text x={266 + i * 70} y={113} className="fill-fg-muted" fontSize={10.5}>
              {l.label}
            </text>
          </g>
        ))}
      </Node>

      <Node
        x={556}
        y={56}
        w={190}
        h={104}
        title={h.deliverable}
        count={c.deliverables}
        sub={`${c.formal} formal · ${c.standalone} standalone`}
      />
      <Node x={836} y={56} w={170} h={104} title={h.outcome} count={c.outcomes} sub="accepted on evidence" />

      {/* Joins across the boundary */}
      <line x1={651} y1={160} x2={651} y2={298} className="stroke-chart-2" strokeWidth={1.75} markerEnd="url(#hd-arrow-jira)" />
      <line x1={921} y1={160} x2={921} y2={298} className="stroke-chart-2" strokeWidth={1.75} markerEnd="url(#hd-arrow-jira)" />
      <FieldChip x={651} y={206} label={h.deliverableIdField} />
      <FieldChip x={921} y={206} label={h.outcomeIdField} />
      <text x={665} y={226} className="fill-fg-muted" fontSize={10.5}>
        {`one deliverable, 1..n ${h.epic}s`}
      </text>
      <text x={935} y={226} className="fill-fg-muted" fontSize={10.5}>
        {`draws work from several ${h.epic}s`}
      </text>

      {/* Jira zone */}
      <Node x={556} y={304} w={190} h={104} tone="jira" title={h.epic} count={c.epics} sub={`${avgEpics} per deliverable on average`} />
      <Node x={836} y={304} w={170} h={104} tone="jira" title="Story-level item" count={c.stories} sub="carries an Outcome ID" />
      <Node x={1066} y={304} w={150} h={104} tone="jira" title={h.subTask} count={c.subTasks} />
      <line x1={746} y1={356} x2={834} y2={356} className="stroke-chart-2" strokeWidth={1.75} markerEnd="url(#hd-arrow-jira)" />
      <line x1={1006} y1={356} x2={1064} y2={356} className="stroke-chart-2" strokeWidth={1.75} markerEnd="url(#hd-arrow-jira)" />

      <text x={18} y={322} className="fill-fg-muted" fontSize={12}>
        {`${terms.workItemTypes.theme} › ${terms.workItemTypes.initiative} › ${h.epic} › story level › ${h.subTask}`}
      </text>
      <text x={18} y={346} className="fill-fg-subtle" fontSize={11}>
        {`Story-level types: ${jiraTypes.slice(0, 4).join(', ')},`}
      </text>
      <text x={18} y={362} className="fill-fg-subtle" fontSize={11}>
        {jiraTypes.slice(4).join(', ')}
      </text>
      <text x={18} y={392} className="fill-fg-muted" fontSize={12}>
        {`Each ${h.epic} carries one ${h.deliverableIdField}.`}
      </text>
    </svg>
  );
}
