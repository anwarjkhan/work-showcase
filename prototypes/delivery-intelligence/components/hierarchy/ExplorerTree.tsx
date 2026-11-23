'use client';

import Link from 'next/link';
import { Boxes, Check, CircleDashed, FileText, Flag, FolderTree, Layers, ListChecks, Route, SquareSplitHorizontal, Target, ArrowUpRight, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { Fragment, useCallback, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { AddToSlides } from '@/components/slides/AddToSlides';
import { ExportPack } from '@/components/slides/ExportPack';
import { DemoNote, Avatar, Badge, Button, EmptyState, RagPair, ReadinessPill, Tabs, Tree, TreeRow, cx } from '@/components/ui';
import { PDLC_STAGES } from '@/lib/config/pdlc';
import { HERO_DELIVERABLE_ID } from '@/lib/config/story';
import { hrefs } from '@/lib/config/routes';
import { terms } from '@/lib/config/terminology';
import { useEngineResult, usePortfolioData, usePortfolioIndex } from '@/lib/store';
import type { ActivityRisk, InvestmentRequest, Outcome, PmNode, TechDeliverable, WorkItem } from '@/lib/types';
import { allUpperIds, ancestorsOfDeliverable, buildTreeModel, deliverableMatches, type ExplorerView, type GroupMode, type TreeModel } from './model';

const PORTFOLIO_SIDE = 'border-l-2 border-accent';
const JIRA_SIDE = 'border-l-2 border-chart-2 bg-surface-2';

/** Three bars: a count of the activity-risk level that is not a status colour. */
function RiskGlyph({ risk }: { risk: ActivityRisk }) {
  const n = risk === 'low' ? 1 : risk === 'moderate' ? 2 : 3;
  return (
    <span aria-hidden className="inline-flex items-end gap-[2px]">
      {[1, 2, 3].map((i) => (
        <span key={i} className={cx('w-[3px] rounded-[1px]', i <= n ? 'bg-accent' : 'bg-line-strong')} style={{ height: 4 + i * 2 }} />
      ))}
    </span>
  );
}

function RiskBadge({ risk }: { risk: ActivityRisk }) {
  return (
    <Badge size="sm" icon={<RiskGlyph risk={risk} />} title="Activity risk">
      {`Activity risk ${terms.activityRisk[risk]}`}
    </Badge>
  );
}

function RouteBadge({ standalone }: { standalone: boolean }) {
  return standalone ? (
    <Badge size="sm" tone="accent" dashed icon={<SquareSplitHorizontal />}>
      {terms.routes.standalone}
    </Badge>
  ) : (
    <Badge size="sm" tone="accent" icon={<Route />}>
      {terms.routes.formal}
    </Badge>
  );
}

function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('font-mono text-[12px] text-fg-muted', className)}>{children}</span>;
}

function StatusBadge({ item }: { item: WorkItem }) {
  if (item.statusCategory === 'done')
    return (
      <Badge size="sm" tone="green" icon={<Check />}>
        {item.status}
      </Badge>
    );
  if (item.statusCategory === 'in-progress')
    return (
      <Badge size="sm" tone="accent" icon={<CircleDashed />}>
        {item.status}
      </Badge>
    );
  return (
    <Badge size="sm" icon={<CircleDashed />}>
      {item.status}
    </Badge>
  );
}

/** The sticky key: which side of the book-of-record boundary each row colour belongs to. */
function BoundaryKey() {
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-line bg-surface px-3 py-2 text-xs" data-testid="boundary-key">
      <span className="inline-flex items-center gap-2 font-semibold text-title">
        <FolderTree aria-hidden className="size-3.5 text-fg-subtle" />
        {terms.bookOfRecordBoundary}
      </span>
      <span className="inline-flex items-center gap-2 text-fg">
        <span aria-hidden className="h-4 w-[3px] rounded-sm bg-accent" />
        <span className="font-medium">{terms.systems['portfolio-system']}</span>
        <span className="text-fg-muted">{terms.bookOfRecord.toLowerCase()}, read-only here</span>
      </span>
      <span className="inline-flex items-center gap-2 text-fg">
        <span aria-hidden className="h-4 w-[3px] rounded-sm bg-chart-2" />
        <span className="font-medium">{terms.systems['work-tracker']}</span>
        <span className="text-fg-muted">rows with this marker sit below the boundary</span>
      </span>
    </div>
  );
}

/** In-tree divider shown where a portfolio row hands over to Jira rows. Not a treeitem. */
function BoundaryBand({ level }: { level: number }) {
  return (
    <div role="none" data-testid="boundary-band" className="flex items-center gap-2 py-1 pr-2 text-[11px] font-semibold tracking-wide text-fg-muted uppercase" style={{ paddingLeft: 8 + (level - 1) * 20 }}>
      <span aria-hidden className="h-px flex-1 border-t border-dashed border-fg-subtle" />
      <span>{terms.bookOfRecordBoundary}</span>
      <span aria-hidden className="text-fg-subtle">·</span>
      <span className="text-accent">{terms.systems['portfolio-system']} above</span>
      <span aria-hidden className="text-fg-subtle">/</span>
      <span className="text-chart-2">{terms.systems['work-tracker']} below</span>
      <span aria-hidden className="h-px w-6 border-t border-dashed border-fg-subtle" />
    </div>
  );
}

export function ExplorerTree({ view, onViewChange }: { view: ExplorerView; onViewChange: (v: ExplorerView) => void }) {
  const data = usePortfolioData();
  const index = usePortfolioIndex();
  const results = useEngineResult();
  const model = useMemo(() => buildTreeModel(data), [data]);

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(ancestorsOfDeliverable(buildTreeModel(data), data, HERO_DELIVERABLE_ID)));
  const [groupMode, setGroupMode] = useState<GroupMode>('epic');
  const [overrides, setOverrides] = useState<Record<string, GroupMode>>({});

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const visibleByRequest = useMemo(() => {
    const m = new Map<string, TechDeliverable[]>();
    for (const d of data.deliverables) {
      if (!deliverableMatches(view, d, results)) continue;
      const list = m.get(d.investmentRequestId);
      if (list) list.push(d);
      else m.set(d.investmentRequestId, [d]);
    }
    return m;
  }, [data.deliverables, view, results]);
  const visibleIds = useMemo(() => new Set([...visibleByRequest.values()].flat().map((d) => d.id)), [visibleByRequest]);

  /** Visible deliverables at any depth below each PmNode (rolled-up count). */
  const pmCount = useMemo(() => {
    const memo = new Map<string, number>();
    const visit = (p: PmNode): number => {
      const hit = memo.get(p.id);
      if (hit !== undefined) return hit;
      memo.set(p.id, 0); // cycle guard
      const own = (model.deliverablesByPm.get(p.id) ?? []).filter((d) => visibleIds.has(d.id)).length;
      const n = own + (model.pmChildren.get(p.id) ?? []).reduce((sum, k) => sum + visit(k), 0);
      memo.set(p.id, n);
      return n;
    };
    data.pmNodes.forEach(visit);
    return memo;
  }, [data.pmNodes, model, visibleIds]);
  const pmVisible = useMemo(() => new Map([...pmCount].map(([id, n]) => [id, n > 0])), [pmCount]);

  const requests = model.requests.filter((r) => view === 'all' || (visibleByRequest.get(r.id)?.length ?? 0) > 0);

  const modeFor = (id: string): GroupMode => overrides[id] ?? groupMode;

  // Keyboard shortcut on a focused deliverable row: "d" opens its detail page.
  const onKeyDownCapture = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'd' || e.metaKey || e.ctrlKey || e.altKey) return;
    const el = e.target as HTMLElement;
    if (el.getAttribute('role') !== 'treeitem') return;
    const link = el.querySelector<HTMLAnchorElement>('a[data-detail-link]');
    if (link) {
      e.preventDefault();
      link.click();
    }
  };

  /* ---- Rows ---- */

  const assignee = (item: WorkItem) => {
    if (item.assigneeType === 'agent') {
      const ag = item.assigneeId ? index.agentIdentities.get(item.assigneeId) : undefined;
      return <Avatar kind="agent" name={ag?.handle ?? 'agent'} size="xs" />;
    }
    const p = item.assigneeId ? index.people.get(item.assigneeId) : undefined;
    return p ? <Avatar initials={p.initials} name={p.name} size="xs" /> : <span className="text-[11px] text-fg-subtle">Unassigned</span>;
  };

  const renderStory = (w: WorkItem, level: number, parentPath: string, showOutcomeId: boolean) => {
    const id = `st:${parentPath}/${w.key}`;
    const subs = model.subTasksByParent.get(w.key) ?? [];
    const open = expanded.has(id);
    const outcome = w.outcomeId ? index.outcomes.get(w.outcomeId) : undefined;
    return (
      <Fragment key={id}>
        <TreeRow
          level={level}
          className={JIRA_SIDE}
          expandable={subs.length > 0}
          expanded={open}
          onToggle={() => toggle(id)}
          icon={<ListChecks className="text-chart-2" />}
          label={
            <span className="inline-flex items-center gap-2">
              <Mono>{w.key}</Mono>
              <span className="text-fg-subtle">{terms.workItemTypes[w.type]}</span>
              <span>{w.summary}</span>
            </span>
          }
          trailing={
            <>
              {showOutcomeId ? (
                outcome ? (
                  <Badge size="sm" tone="accent" className="font-mono" title={terms.hierarchy.outcomeIdField}>
                    {outcome.ref}
                  </Badge>
                ) : (
                  <Badge size="sm" tone="amber" title={terms.hierarchy.outcomeIdField}>{`No ${terms.hierarchy.outcomeIdField}`}</Badge>
                )
              ) : null}
              <StatusBadge item={w} />
              {assignee(w)}
            </>
          }
        />
        {open
          ? subs.map((s) => (
              <TreeRow
                key={`${id}/${s.key}`}
                level={level + 1}
                className={JIRA_SIDE}
                icon={<Layers className="text-fg-subtle" />}
                label={
                  <span className="inline-flex items-center gap-2">
                    <Mono>{s.key}</Mono>
                    <span className="text-fg-subtle">{terms.hierarchy.subTask}</span>
                    <span>{s.summary}</span>
                  </span>
                }
                trailing={
                  <>
                    <StatusBadge item={s} />
                    {assignee(s)}
                  </>
                }
              />
            ))
          : null}
      </Fragment>
    );
  };

  const renderEpic = (key: string, d: TechDeliverable, level: number, parentPath: string) => {
    const epic = index.workItems.get(key);
    const id = `ep:${parentPath}/${key}`;
    if (!epic) return null;
    const stories = model.storiesByEpic.get(key) ?? [];
    const open = expanded.has(id);
    const linked = epic.deliverableId ? index.deliverables.get(epic.deliverableId) : undefined;
    return (
      <Fragment key={id}>
        <TreeRow
          level={level}
          className={JIRA_SIDE}
          expandable={stories.length > 0}
          expanded={open}
          onToggle={() => toggle(id)}
          icon={<Boxes className="text-chart-2" />}
          label={
            <span className="inline-flex items-center gap-2">
              <Mono>{epic.key}</Mono>
              <span className="text-fg-subtle">{terms.hierarchy.epic}</span>
              <span className="font-medium">{epic.summary}</span>
            </span>
          }
          trailing={
            <>
              <Badge size="sm" tone={linked ? 'accent' : 'amber'} className="font-mono" title={terms.hierarchy.deliverableIdField}>
                {linked ? linked.ref : epic.deliverableId ? `${epic.deliverableId} (not found)` : `No ${terms.hierarchy.deliverableIdField}`}
              </Badge>
              <StatusBadge item={epic} />
              <span className="text-[11px] text-fg-muted tabular-nums">{stories.length} items</span>
            </>
          }
        />
        {open ? stories.map((w) => renderStory(w, level + 1, id, true)) : null}
      </Fragment>
    );
  };

  const renderOutcome = (o: Outcome, level: number, d: TechDeliverable, parentPath: string) => {
    const id = `oc:${parentPath}/${o.id}`;
    const om = results.outcomes[o.id];
    const open = expanded.has(id);
    const stories = d.epicKeys.flatMap((k) => model.storiesByEpic.get(k) ?? []).filter((w) => w.outcomeId === o.id);
    return (
      <Fragment key={id}>
        <TreeRow
          level={level}
          className={PORTFOLIO_SIDE}
          expandable={stories.length > 0}
          expanded={open}
          onToggle={() => toggle(id)}
          icon={<Target className="text-accent" />}
          label={
            <span className="inline-flex items-center gap-2">
              <Mono>{o.ref}</Mono>
              <span className="text-fg-subtle">{terms.hierarchy.outcome}</span>
              <span className="font-medium">{o.title}</span>
            </span>
          }
          trailing={
            <>
              <span className="text-[11px] text-fg-muted tabular-nums">weight {o.weight}</span>
              <span className="text-[11px] text-fg-muted tabular-nums">
                {om ? (om.workCompletion.computable ? `${om.workCompletion.value.percent}% work` : terms.measures.notComputable) : ''}
              </span>
              {om?.acceptance.accepted ? (
                <Badge size="sm" tone="green" icon={<Check />}>
                  {terms.criterionStates.accepted}
                </Badge>
              ) : (
                <Badge size="sm" icon={<CircleDashed />}>
                  {`Not accepted${om ? ` · ${om.acceptance.mandatoryAccepted}/${om.acceptance.mandatoryCount} criteria` : ''}`}
                </Badge>
              )}
            </>
          }
        />
        {open && stories.length > 0 ? (
          <>
            <BoundaryBand level={level + 1} />
            {stories.map((w) => renderStory(w, level + 1, id, true))}
          </>
        ) : null}
      </Fragment>
    );
  };

  const renderDeliverable = (d: TechDeliverable, level: number) => {
    const id = `td:${d.id}`;
    const open = expanded.has(id);
    const standalone = !d.pmNodeId;
    const m = results.deliverables[d.id];
    const rag = results.deliverableRag[d.id];
    const stage = PDLC_STAGES.find((s) => s.id === d.pdlcStage);
    const mode = modeFor(d.id);
    const outcomes = index.outcomesByDeliverable.get(d.id) ?? [];
    return (
      <Fragment key={id}>
        <TreeRow
          level={level}
          expandable
          expanded={open}
          onToggle={() => toggle(id)}
          className={cx(PORTFOLIO_SIDE, 'py-1.5', standalone && 'bg-accent-soft')}
          icon={standalone ? <SquareSplitHorizontal className="text-chart-3" /> : <Flag className="text-accent" />}
          label={
            <span className="flex flex-col gap-1.5">
              <span className="inline-flex items-center gap-2">
                <Mono>{d.ref}</Mono>
                <span className="font-medium text-title">{d.title}</span>
              </span>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {rag ? <RagPair reported={rag.reported} evidence={rag.evidence} disagrees={rag.disagrees} size="sm" /> : null}
                {m ? (
                  <>
                    <span className="text-[11px] text-fg-muted tabular-nums">
                      {terms.measures.workCompletion}{' '}
                      <strong className="font-semibold text-fg">{m.workCompletion.computable ? `${m.workCompletion.value.percent}%` : terms.measures.notComputable}</strong>
                    </span>
                    <span className="text-[11px] text-fg-muted tabular-nums">
                      {terms.measures.acceptedOutcomes}{' '}
                      <strong className="font-semibold text-fg">{m.acceptedOutcomes.computable ? `${m.acceptedOutcomes.value.acceptedCount} of ${m.acceptedOutcomes.value.totalCount}` : terms.measures.notComputable}</strong>
                    </span>
                    <ReadinessPill state={m.readiness.state} size="sm" />
                  </>
                ) : null}
                {stage ? <Badge size="sm">{stage.shortName}</Badge> : null}
                <Badge size="sm">{terms.riskTiers[d.riskTier]}</Badge>
                {standalone ? (
                  <Badge size="sm" tone="accent" dashed icon={<SquareSplitHorizontal />}>
                    {terms.routes.standalone}
                  </Badge>
                ) : null}
              </span>
            </span>
          }
          trailing={
            <>
              <span className="text-[11px] text-fg-muted tabular-nums">
                {d.epicKeys.length} {terms.hierarchy.epic}
                {d.epicKeys.length === 1 ? '' : 's'}
              </span>
              <AddToSlides kind="td-verdict" scope={{ kind: 'deliverable', deliverableId: d.id }} label={`the verdict slide for ${d.ref}`} />
              <Link
                href={hrefs.deliverable(d.id)}
                data-detail-link
                tabIndex={-1}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 rounded-md border border-line-strong px-2 py-1 text-[11px] font-medium text-accent hover:border-accent-line focus-visible:shadow-focus focus-visible:outline-none"
                aria-label={`Open ${d.ref} detail`}
              >
                Detail
                <ArrowUpRight aria-hidden className="size-3" />
              </Link>
            </>
          }
        />
        {open ? (
          <>
            <div role="none" className="flex items-center gap-2 py-1" style={{ paddingLeft: 8 + level * 20 + 24 }}>
              <span className="text-[11px] text-fg-muted">Children</span>
              <Tabs
                variant="segmented"
                ariaLabel={`Group ${d.ref} children`}
                value={mode}
                onChange={(v) => setOverrides((prev) => ({ ...prev, [d.id]: v as GroupMode }))}
                items={[
                  { id: 'epic', label: `By ${terms.hierarchy.epic}`, count: d.epicKeys.length },
                  { id: 'outcome', label: `By ${terms.hierarchy.outcome.toLowerCase()}`, count: outcomes.length },
                ]}
              />
            </div>
            {mode === 'epic' ? (
              <>
                <BoundaryBand level={level + 1} />
                {d.epicKeys.map((k) => renderEpic(k, d, level + 1, id))}
              </>
            ) : (
              <>
                {outcomes.map((o) => renderOutcome(o, level + 1, d, id))}
                {(() => {
                  const unmapped = d.epicKeys.flatMap((k) => model.storiesByEpic.get(k) ?? []).filter((w) => !w.outcomeId || !index.outcomes.has(w.outcomeId));
                  if (unmapped.length === 0) return null;
                  const uid = `oc:${id}/none`;
                  return (
                    <Fragment>
                      <TreeRow
                        level={level + 1}
                        className={JIRA_SIDE}
                        expandable
                        expanded={expanded.has(uid)}
                        onToggle={() => toggle(uid)}
                        icon={<CircleDashed className="text-status-amber" />}
                        label={<span className="font-medium">{`Items with no ${terms.hierarchy.outcomeIdField}`}</span>}
                        trailing={<span className="text-[11px] text-fg-muted tabular-nums">{unmapped.length} items</span>}
                      />
                      {expanded.has(uid) ? unmapped.map((w) => renderStory(w, level + 2, uid, true)) : null}
                    </Fragment>
                  );
                })()}
              </>
            )}
          </>
        ) : null}
      </Fragment>
    );
  };

  const renderPm = (p: PmNode, level: number): ReactNode => {
    if (!pmVisible.get(p.id)) return null;
    const id = `pm:${p.id}`;
    const open = expanded.has(id);
    const rag = results.pmNodeRag[p.id];
    const kids = model.pmChildren.get(p.id) ?? [];
    const dels = (model.deliverablesByPm.get(p.id) ?? []).filter((d) => visibleIds.has(d.id));
    return (
      <Fragment key={id}>
        <TreeRow
          level={level}
          expandable={kids.length + dels.length > 0}
          expanded={open}
          onToggle={() => toggle(id)}
          className={PORTFOLIO_SIDE}
          icon={<FolderTree className="text-accent" />}
          label={
            <span className="inline-flex items-center gap-2">
              <Mono>{p.ref}</Mono>
              <span className="text-fg-subtle">{terms.pmNodeLevels[p.level]}</span>
              <span className="font-medium text-title">{p.title}</span>
            </span>
          }
          trailing={
            <>
              <span className="text-[11px] text-fg-muted tabular-nums">{pmCount.get(p.id) ?? 0} {pmCount.get(p.id) === 1 ? 'deliverable' : 'deliverables'}</span>
              {rag ? <RagPair reported={rag.reported} evidence={rag.evidence} disagrees={rag.disagrees} size="sm" /> : null}
              <AddToSlides kind="node-overview" scope={{ kind: 'pm-node', pmNodeId: p.id }} label={`the overview slide for ${p.ref}`} />
              <ExportPack scope={{ kind: 'pm-node', pmNodeId: p.id }} label={`${p.ref} pack`} />
            </>
          }
        />
        {open ? (
          <>
            {kids.map((k) => renderPm(k, level + 1))}
            {dels.map((d) => renderDeliverable(d, level + 1))}
          </>
        ) : null}
      </Fragment>
    );
  };

  const renderRequest = (r: InvestmentRequest) => {
    const id = `ir:${r.id}`;
    const open = expanded.has(id);
    const standalone = r.route === 'standalone';
    const roots = (model.pmRootsByRequest.get(r.id) ?? []).filter((p) => pmVisible.get(p.id));
    const direct = (model.standaloneByRequest.get(r.id) ?? []).filter((d) => visibleIds.has(d.id));
    const total = visibleByRequest.get(r.id)?.length ?? 0;
    return (
      <Fragment key={id}>
        <TreeRow
          level={1}
          expandable={roots.length + direct.length > 0}
          expanded={open}
          onToggle={() => toggle(id)}
          className={cx(PORTFOLIO_SIDE, 'min-h-10', standalone && 'bg-accent-soft')}
          icon={<FileText className="text-accent" />}
          label={
            <span className="inline-flex items-center gap-2">
              <Mono>{r.ref}</Mono>
              <span className="font-semibold text-title">{r.title}</span>
            </span>
          }
          trailing={
            <>
              <RiskBadge risk={r.activityRisk} />
              <RouteBadge standalone={standalone} />
              <span className="w-24 text-right text-[11px] text-fg-muted tabular-nums">
                {total} {total === 1 ? 'deliverable' : 'deliverables'}
              </span>
            </>
          }
        />
        {open ? (
          <>
            {roots.map((p) => renderPm(p, 2))}
            {direct.map((d) => renderDeliverable(d, 2))}
          </>
        ) : null}
      </Fragment>
    );
  };

  const tabItems = [
    { id: 'all', label: 'All', count: data.deliverables.length },
    { id: 'formal', label: terms.routes.formal, count: model.counts.formal },
    { id: 'standalone', label: terms.routes.standalone, count: model.counts.standalone },
    { id: 'disagree', label: 'Status disagreements', count: results.portfolio.disagreementDeliverableIds.length },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs variant="segmented" ariaLabel="Quick views" items={tabItems} value={view} onChange={(v) => onViewChange(v as ExplorerView)} />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-fg-muted">Deliverable children</span>
          <Tabs
            variant="segmented"
            ariaLabel="Group deliverable children"
            value={groupMode}
            onChange={(v) => {
              setGroupMode(v as GroupMode);
              setOverrides({});
            }}
            items={[
              { id: 'epic', label: `By ${terms.hierarchy.epic}` },
              { id: 'outcome', label: `By ${terms.hierarchy.outcome.toLowerCase()}` },
            ]}
          />
          <Button size="sm" variant="secondary" icon={<ChevronsUpDown />} onClick={() => setExpanded((prev) => new Set([...prev, ...allUpperIds(data)]))}>
            Expand to deliverables
          </Button>
          <Button size="sm" variant="secondary" icon={<ChevronsDownUp />} onClick={() => setExpanded(new Set())}>
            Collapse all
          </Button>
        </div>
      </div>

      <div className="di-card overflow-hidden">
        <div className="max-h-[72vh] overflow-auto" data-testid="explorer-scroll">
          <BoundaryKey />
          <div className="p-2" onKeyDownCapture={onKeyDownCapture}>
            {requests.length === 0 ? (
              <EmptyState variant="inline" title="Nothing matches this view" description="Switch the quick view to see the full portfolio." />
            ) : (
              <Tree ariaLabel={`${terms.app.hierarchyModel} explorer`}>{requests.map(renderRequest)}</Tree>
            )}
          </div>
        </div>
        <DemoNote as="div" className="border-t border-line px-3 py-2 text-[11px] text-fg-muted">
          Arrow keys move, Right and Left open and close, Home and End jump, Enter toggles, <kbd className="rounded-xs border border-line-strong px-1 font-mono">D</kbd> opens the deliverable detail. Rows load only when opened.
        </DemoNote>
      </div>
    </div>
  );
}

export type { TreeModel };
