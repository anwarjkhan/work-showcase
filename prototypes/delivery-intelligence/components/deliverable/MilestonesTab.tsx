'use client';

import { Landmark } from 'lucide-react';
import { Badge, DataTable, EmptyState, type Column } from '@/components/ui';
import { formatDate } from '@/lib/config/clock';
import type { DeliverableModel, MilestoneRow } from './model';
import { RecordChip, useOpenRecord } from './records';

export function MilestonesTab({ model }: { model: DeliverableModel }) {
  const open = useOpenRecord();
  const columns: Column<MilestoneRow>[] = [
    { id: 'title', header: 'Milestone', accessor: (m) => m.milestone.title, cell: (m) => <RecordChip to={{ kind: 'milestone', id: m.milestone.id }} label={m.milestone.title} showKind={false} className="max-w-[28rem] text-left whitespace-normal" />, minWidth: 280 },
    {
      id: 'reg',
      header: 'Type',
      accessor: (m) => Number(m.milestone.regulatory),
      cell: (m) => (m.milestone.regulatory ? <Badge tone="accent" size="sm" icon={<Landmark />}>Regulatory</Badge> : <span className="text-fg-muted">Delivery</span>),
      minWidth: 120,
    },
    { id: 'date', header: 'Planned date', accessor: (m) => m.milestone.date, cell: (m) => formatDate(m.milestone.date), minWidth: 120 },
    {
      id: 'away',
      header: 'From today',
      numeric: true,
      accessor: (m) => m.daysAway,
      cell: (m) => (m.milestone.status !== 'planned' ? '' : m.daysAway === 0 ? 'Today' : m.daysAway > 0 ? `in ${m.daysAway} days` : `${-m.daysAway} days ago`),
      minWidth: 110,
    },
    {
      id: 'status',
      header: 'Status',
      accessor: (m) => m.milestone.status,
      cell: (m) => <Badge size="sm" tone={m.milestone.status === 'met' ? 'green' : m.milestone.status === 'missed' ? 'red' : 'neutral'}>{m.milestone.status === 'planned' ? 'Planned' : m.milestone.status === 'met' ? 'Met' : 'Missed'}</Badge>,
      minWidth: 100,
    },
    {
      id: 'move',
      header: 'Dependency-driven move',
      accessor: (m) => m.shiftDays,
      cell: (m) =>
        m.shiftedTo && m.drivenBy ? (
          <span className="inline-flex flex-wrap items-center gap-1.5 text-status-amber-fg">
            Moves to {formatDate(m.shiftedTo)} ({m.shiftDays} days) via <RecordChip to={{ kind: 'dependency', id: m.drivenBy }} />
          </span>
        ) : (
          <span className="text-fg-subtle">None</span>
        ),
      minWidth: 320,
    },
  ];
  return (
    <DataTable
      ariaLabel="Milestones"
      rows={model.milestones}
      columns={columns}
      getRowId={(m) => m.milestone.id}
      onRowClick={(m) => open({ kind: 'milestone', id: m.milestone.id })}
      defaultSort={{ columnId: 'date', direction: 'asc' }}
      dense
      empty={<EmptyState variant="inline" title="No milestones are planned" description="Milestones and regulatory dates appear here when they are recorded for this deliverable." />}
    />
  );
}
