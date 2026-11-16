'use client';

import { useMemo, useState } from 'react';
import { Badge, DataTable, EmptyState, ProgressBar, SectionHeading, Tabs, type Column } from '@/components/ui';
import { formatDate } from '@/lib/config/clock';
import { terms } from '@/lib/config/terminology';
import { usePortfolioIndex } from '@/lib/store';
import { AssigneeCell, Flag, PersonCell } from './bits';
import type { DeliverableModel, EpicRow, WorkRow } from './model';
import { RecordChip } from './records';
import { useOpenRecord } from './records';

type Grouping = 'outcome' | 'epic';

interface Group {
  id: string;
  title: React.ReactNode;
  flagged: boolean;
  rows: WorkRow[];
}

const pointsOf = (rows: WorkRow[], closedOnly: boolean) => rows.reduce((s, r) => s + (closedOnly && !r.closed ? 0 : (r.item.points ?? 0)), 0);

export function WorkTab({ model }: { model: DeliverableModel }) {
  const idx = usePortfolioIndex();
  const open = useOpenRecord();
  const [grouping, setGrouping] = useState<Grouping>('outcome');

  const epicColumns: Column<EpicRow>[] = [
    { id: 'key', header: 'Epic', accessor: (e) => e.key, cell: (e) => <RecordChip to={{ kind: 'work-item', id: e.key }} />, minWidth: 100 },
    { id: 'summary', header: 'Summary', accessor: (e) => e.summary, minWidth: 260 },
    {
      id: 'did',
      header: terms.hierarchy.deliverableIdField,
      accessor: (e) => e.deliverableIdField,
      cell: (e) => (e.deliverableIdField ? <span className="font-mono text-xs">{idx.deliverables.get(e.deliverableIdField)?.ref ?? e.deliverableIdField}</span> : <Flag>Missing</Flag>),
      minWidth: 130,
    },
    { id: 'hub', header: 'Hub', accessor: (e) => (e.hubId ? idx.hubs.get(e.hubId)?.city : null), minWidth: 110 },
    { id: 'items', header: 'Items', numeric: true, accessor: (e) => e.itemCount, cell: (e) => `${e.closedItemCount} of ${e.itemCount}`, minWidth: 90 },
    {
      id: 'points',
      header: 'Points closed',
      numeric: true,
      accessor: (e) => e.closedPoints,
      cell: (e) => (
        <span className="inline-flex items-center justify-end gap-2">
          <span className="w-16"><ProgressBar value={e.totalPoints === 0 ? null : Math.round((e.closedPoints / e.totalPoints) * 100)} size="sm" ariaLabel={`${e.key} points closed`} /></span>
          {e.closedPoints} of {e.totalPoints}
        </span>
      ),
      minWidth: 190,
    },
  ];

  const workColumns: Column<WorkRow>[] = [
    { id: 'key', header: 'Key', accessor: (r) => r.item.key, cell: (r) => <RecordChip to={{ kind: 'work-item', id: r.item.key }} showKind={false} />, minWidth: 96 },
    {
      id: 'summary',
      header: 'Summary',
      accessor: (r) => r.item.summary,
      cell: (r) => (
        <span className="flex flex-col gap-1">
          <span className="line-clamp-2 text-[13px]">{r.item.summary}</span>
          {r.noOutcome || r.agentNoReviewer ? (
            <span className="flex flex-wrap gap-1">
              {r.noOutcome ? <Flag title="Rule R9: story-level item with no Outcome ID">No {terms.hierarchy.outcomeIdField}</Flag> : null}
              {r.agentNoReviewer ? <Flag title="Rule R10: agent-assigned item with no named human reviewer">Agent-assigned, no reviewer</Flag> : null}
            </span>
          ) : null}
        </span>
      ),
      minWidth: 280,
    },
    { id: 'type', header: 'Type', accessor: (r) => terms.workItemTypes[r.item.type], minWidth: 90 },
    {
      id: 'status',
      header: 'Status',
      accessor: (r) => r.item.statusCategory,
      cell: (r) => (
        <Badge size="sm" tone={r.closed ? 'green' : r.item.statusCategory === 'in-progress' ? 'accent' : 'neutral'}>
          {r.item.status}
        </Badge>
      ),
      minWidth: 120,
    },
    { id: 'points', header: 'Points', numeric: true, accessor: (r) => r.item.points, cell: (r) => r.item.points ?? '–', minWidth: 70 },
    {
      id: 'assignee',
      header: 'Assignee',
      accessor: (r) => (r.item.assigneeType === 'agent' ? (idx.agentIdentities.get(r.item.assigneeId ?? '')?.handle ?? 'agent') : (idx.people.get(r.item.assigneeId ?? '')?.name ?? '')),
      cell: (r) => <AssigneeCell item={r.item} />,
      minWidth: 170,
    },
    {
      id: 'reviewer',
      header: 'Reviewer',
      accessor: (r) => (r.item.reviewerId ? idx.people.get(r.item.reviewerId)?.name : null),
      cell: (r) => <PersonCell id={r.item.reviewerId} fallback="None named" />,
      minWidth: 160,
    },
    { id: 'sprint', header: 'Sprint', accessor: (r) => (r.item.sprintId ? (idx.sprints.get(r.item.sprintId)?.index ?? 0) : null), cell: (r) => (r.item.sprintId ? (idx.sprints.get(r.item.sprintId)?.name ?? r.item.sprintId) : <span className="text-fg-subtle">None</span>), minWidth: 100 },
    { id: 'due', header: 'Due', accessor: (r) => r.item.due, cell: (r) => (r.item.due ? formatDate(r.item.due, { withYear: false }) : <span className="text-fg-subtle">None</span>), minWidth: 90 },
  ];

  const groups = useMemo<Group[]>(() => {
    if (grouping === 'outcome') {
      const out: Group[] = [];
      for (const o of model.outcomes) {
        out.push({
          id: o.outcome.id,
          flagged: false,
          title: (
            <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
              <RecordChip to={{ kind: 'outcome', id: o.outcome.id }} label={o.outcome.ref} showKind={false} />
              <span className="truncate">{o.outcome.title}</span>
            </span>
          ),
          rows: model.work.filter((w) => w.outcomeRef === o.outcome.id),
        });
      }
      const unmapped = model.work.filter((w) => w.noOutcome);
      const unknown = model.work.filter((w) => !w.noOutcome && !model.outcomes.some((o) => o.outcome.id === w.outcomeRef));
      if (unmapped.length > 0) out.unshift({ id: 'none', flagged: true, title: <span>No {terms.hierarchy.outcomeIdField}</span>, rows: unmapped });
      if (unknown.length > 0) out.push({ id: 'unknown', flagged: true, title: <span>Unknown {terms.hierarchy.outcomeIdField}</span>, rows: unknown });
      return out.filter((g) => g.rows.length > 0 || g.id !== 'none');
    }
    return model.epics.map((e) => ({
      id: e.key,
      flagged: false,
      title: (
        <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
          <RecordChip to={{ kind: 'work-item', id: e.key }} />
          <span className="truncate">{e.summary}</span>
        </span>
      ),
      rows: model.work.filter((w) => w.item.epicKey === e.key),
    }));
  }, [grouping, model.outcomes, model.work, model.epics]);

  if (model.work.length === 0 && model.epics.length === 0) {
    return <EmptyState title="No work linked yet" description="No Epics or story-level items carry this deliverable's ID, so work completion is not computable." />;
  }

  const flaggedCount = model.work.filter((w) => w.noOutcome || w.agentNoReviewer).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <SectionHeading level={3} title={`${terms.hierarchy.epic}s`} description={`${model.epics.length} ${model.epics.length === 1 ? 'Epic carries' : 'Epics carry'} this ${terms.hierarchy.deliverableIdField}. Work completion adds points across all of them.`} />
        <DataTable ariaLabel="Epics of this deliverable" rows={model.epics} columns={epicColumns} getRowId={(e) => e.key} onRowClick={(e) => open({ kind: 'work-item', id: e.key })} dense empty={<EmptyState variant="inline" title="No Epics are linked" />} />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionHeading
            level={3}
            title="Story-level work"
            description={`${model.work.length} items${flaggedCount > 0 ? `, ${flaggedCount} flagged` : ''}. Flags mark items with no ${terms.hierarchy.outcomeIdField} or an agent assignee with no named human reviewer.`}
          />
          <Tabs
            variant="segmented"
            ariaLabel="Group work by"
            value={grouping}
            onChange={(v) => setGrouping(v as Grouping)}
            items={[
              { id: 'outcome', label: 'By outcome' },
              { id: 'epic', label: 'By Epic' },
            ]}
          />
        </div>
        {model.work.length === 0 ? (
          <EmptyState title="No story-level items yet" description="The Epics have no stories under them. Requirements structuring can propose them in the workflow." />
        ) : (
          groups.map((g) => (
            <section key={g.id} aria-label={typeof g.title === 'string' ? g.title : g.id} className="flex flex-col gap-2" data-group={g.id}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                <div className="flex min-w-0 items-center gap-2 font-medium text-fg">{g.title}{g.flagged ? <Flag>Needs an {terms.hierarchy.outcomeIdField}</Flag> : null}</div>
                <span className="text-xs text-fg-muted tabular-nums">
                  {g.rows.filter((r) => r.closed).length} of {g.rows.length} items · {pointsOf(g.rows, true)} of {pointsOf(g.rows, false)} points closed
                </span>
              </div>
              <DataTable
                ariaLabel={`Work items, ${typeof g.title === 'string' ? g.title : g.id}`}
                rows={g.rows}
                columns={workColumns}
                getRowId={(r) => r.item.key}
                onRowClick={(r) => open({ kind: 'work-item', id: r.item.key })}
                defaultSort={{ columnId: 'key', direction: 'asc' }}
                dense
                maxHeight={420}
                empty={<EmptyState variant="inline" title="No items carry this outcome yet" />}
              />
            </section>
          ))
        )}
      </div>
    </div>
  );
}
