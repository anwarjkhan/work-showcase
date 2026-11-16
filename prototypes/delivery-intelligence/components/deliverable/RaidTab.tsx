'use client';

import Link from 'next/link';
import { Badge, DataTable, EmptyState, SectionHeading, SeverityBadge, type Column } from '@/components/ui';
import { formatDate } from '@/lib/config/clock';
import { hrefs } from '@/lib/config/routes';
import { terms } from '@/lib/config/terminology';
import { usePortfolioIndex } from '@/lib/store';
import { Flag, PersonCell, pluralise } from './bits';
import type { DependencyRow, DeliverableModel, RaidRow } from './model';
import { RecordChip, useOpenRecord } from './records';

export function RaidTab({ model }: { model: DeliverableModel }) {
  const open = useOpenRecord();
  const idx = usePortfolioIndex();

  const raidColumns: Column<RaidRow>[] = [
    { id: 'key', header: 'Key', accessor: (r) => r.item.key, cell: (r) => <RecordChip to={{ kind: 'raid', id: r.item.id }} label={r.item.key} showKind={false} />, minWidth: 96 },
    {
      id: 'title',
      header: 'Item',
      accessor: (r) => r.item.title,
      cell: (r) => (
        <span className="flex flex-col gap-1">
          <span className="text-[13px]">{r.item.title}</span>
          {r.stale || r.noOwner || r.noMitigation ? (
            <span className="flex flex-wrap gap-1">
              {r.stale ? <Flag title="Rule R4: no update within the threshold">No update for {pluralise(r.ageDays, 'day')}</Flag> : null}
              {r.noOwner ? <Flag title="Rule R4: no owner">No owner</Flag> : null}
              {r.noMitigation ? <Flag title="Rule R4: no mitigation date">No mitigation date</Flag> : null}
            </span>
          ) : null}
        </span>
      ),
      minWidth: 300,
    },
    { id: 'kind', header: 'Kind', accessor: (r) => terms.raidKinds[r.item.kind], minWidth: 100 },
    { id: 'severity', header: 'Severity', accessor: (r) => ({ critical: 0, high: 1, medium: 2, low: 3 })[r.item.severity], cell: (r) => <SeverityBadge severity={r.item.severity} size="sm" />, minWidth: 110 },
    { id: 'status', header: 'Status', accessor: (r) => r.item.status, cell: (r) => <Badge size="sm" tone={r.open ? 'neutral' : 'green'}>{r.item.status}</Badge>, minWidth: 100 },
    { id: 'owner', header: 'Owner', accessor: (r) => (r.item.ownerId ? idx.people.get(r.item.ownerId)?.name : null), cell: (r) => <PersonCell id={r.item.ownerId} fallback="No owner" />, minWidth: 160 },
    { id: 'age', header: 'Last update', numeric: true, accessor: (r) => r.ageDays, cell: (r) => (r.ageDays === 0 ? 'Today' : `${r.ageDays} days ago`), minWidth: 110 },
    { id: 'mit', header: 'Mitigation due', accessor: (r) => r.item.mitigationDue, cell: (r) => (r.item.mitigationDue ? formatDate(r.item.mitigationDue, { withYear: false }) : <span className="text-fg-subtle">None</span>), minWidth: 120 },
  ];

  const depColumns = (direction: 'in' | 'out'): Column<DependencyRow>[] => [
    {
      id: 'title',
      header: 'Dependency',
      accessor: (r) => r.dependency.title,
      cell: (r) => <RecordChip to={{ kind: 'dependency', id: r.dependency.id }} label={r.dependency.title} showKind={false} className="max-w-[26rem] text-left whitespace-normal" />,
      minWidth: 280,
    },
    {
      id: 'other',
      header: direction === 'in' ? 'Provider' : 'Receiver',
      accessor: (r) => (direction === 'in' ? r.dependency.fromDeliverableId : r.dependency.toDeliverableId),
      cell: (r) => {
        const otherId = direction === 'in' ? r.dependency.fromDeliverableId : r.dependency.toDeliverableId;
        const hubId = direction === 'in' ? r.dependency.fromHubId : r.dependency.toHubId;
        const other = idx.deliverables.get(otherId);
        return (
          <span className="flex flex-col leading-tight">
            {other ? (
              <Link href={hrefs.deliverable(other.id)} className="font-mono text-xs font-medium text-accent hover:underline">
                {other.ref}
              </Link>
            ) : (
              otherId
            )}
            <span className="text-[11px] text-fg-subtle">{idx.hubs.get(hubId)?.city}</span>
          </span>
        );
      },
      minWidth: 130,
    },
    {
      id: 'hubs',
      header: 'Hubs',
      accessor: (r) => `${r.dependency.fromHubId}${r.dependency.toHubId}`,
      cell: (r) => `${idx.hubs.get(r.dependency.fromHubId)?.city ?? ''} to ${idx.hubs.get(r.dependency.toHubId)?.city ?? ''}`,
      minWidth: 170,
    },
    { id: 'need', header: 'Need by', accessor: (r) => r.dependency.needBy, cell: (r) => formatDate(r.dependency.needBy, { withYear: false }), minWidth: 90 },
    { id: 'committed', header: 'Committed', accessor: (r) => r.dependency.committed, cell: (r) => (r.dependency.committed ? formatDate(r.dependency.committed, { withYear: false }) : <span className="text-fg-subtle">None</span>), minWidth: 100 },
    {
      id: 'late',
      header: 'Days late',
      numeric: true,
      accessor: (r) => r.lateDays,
      cell: (r) => (r.lateDays > 0 ? <span className="font-semibold text-status-red-fg">{r.lateDays}</span> : '0'),
      minWidth: 90,
    },
    {
      id: 'status',
      header: 'Status',
      accessor: (r) => r.dependency.status,
      cell: (r) => (
        <Badge size="sm" tone={r.dependency.status === 'blocked' || r.dependency.status === 'late' ? 'red' : r.dependency.status === 'at-risk' ? 'amber' : r.dependency.status === 'delivered' ? 'green' : 'neutral'}>
          {terms.dependencyStatus[r.dependency.status]}
          {r.dependency.critical ? ', critical' : ''}
        </Badge>
      ),
      minWidth: 140,
    },
    {
      id: 'knock',
      header: 'Knock-on',
      sortable: false,
      cell: (r) => (r.knockOn ? <span className="text-xs text-fg-muted">{r.knockOn.explanation}</span> : <span className="text-fg-subtle">None</span>),
      minWidth: 320,
    },
  ];

  const inbound = model.dependencies.filter((d) => d.direction === 'in');
  const outbound = model.dependencies.filter((d) => d.direction === 'out');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <SectionHeading level={3} title="Risks and issues" description={`${model.raid.filter((r) => r.open).length} open of ${model.raid.length}. Flagged when there is no owner, no mitigation date, or no update inside the threshold.`} />
        <DataTable ariaLabel="RAID items" rows={model.raid} columns={raidColumns} getRowId={(r) => r.item.id} onRowClick={(r) => open({ kind: 'raid', id: r.item.id })} dense maxHeight={380} empty={<EmptyState variant="inline" title="No RAID items are linked" />} />
      </div>
      <div className="flex flex-col gap-3">
        <SectionHeading level={3} title="Needs from others" description="Inbound dependencies: the provider supplies, this deliverable receives and needs it by the date shown." />
        <DataTable ariaLabel="Inbound dependencies" rows={inbound} columns={depColumns('in')} getRowId={(r) => r.dependency.id} onRowClick={(r) => open({ kind: 'dependency', id: r.dependency.id })} dense empty={<EmptyState variant="inline" title="No inbound dependencies" />} />
      </div>
      <div className="flex flex-col gap-3">
        <SectionHeading level={3} title="Provides to others" description="Outbound dependencies: this deliverable supplies, the receiver is waiting." />
        <DataTable ariaLabel="Outbound dependencies" rows={outbound} columns={depColumns('out')} getRowId={(r) => r.dependency.id} onRowClick={(r) => open({ kind: 'dependency', id: r.dependency.id })} dense empty={<EmptyState variant="inline" title="No outbound dependencies" />} />
      </div>
    </div>
  );
}
