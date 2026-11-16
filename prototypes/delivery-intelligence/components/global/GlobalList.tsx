'use client';

import { ArrowRight } from 'lucide-react';
import { DataTable, RagPill, StatusGlyph, type Column } from '@/components/ui';
import { terms } from '@/lib/config/terminology';
import { formatDate } from '@/lib/config/clock';
import { usePortfolioIndex } from '@/lib/store';
import { DependencyStatusBadge } from './HubPanel';
import { CONTINENT_LABEL, CONTINENT_ORDER, type DependencyView, type GlobalModel, type HubView } from './model';

const RAG_RANK = { red: 3, amber: 2, green: 1, unknown: 0 } as const;

/** The map's information as accessible tables: hubs, then cross-hub dependencies. */
export function GlobalList({ model, arcs, selectedHubId, onSelectHub }: { model: GlobalModel; arcs: DependencyView[]; selectedHubId: string | null; onSelectHub: (id: string) => void }) {
  const index = usePortfolioIndex();
  const hubName = (id: string) => model.hubById.get(id)?.hub.name ?? id;

  const hubColumns: Column<HubView>[] = [
    {
      id: 'hub',
      header: 'Hub',
      accessor: (h) => h.hub.name,
      cell: (h) => (
        <div className="flex flex-col whitespace-nowrap">
          <span className="font-semibold text-fg">{h.hub.name}</span>
          <span className="text-xs text-fg-subtle">
            {h.hub.country}
            {h.utcOffset ? ` · ${h.utcOffset}` : ''}
          </span>
        </div>
      ),
      minWidth: 170,
    },
    { id: 'continent', header: 'Continent', accessor: (h) => CONTINENT_ORDER.indexOf(h.hub.continent), cell: (h) => CONTINENT_LABEL[h.hub.continent] },
    { id: 'deliverables', header: 'Deliverables', numeric: true, accessor: (h) => h.deliverableIds.length, cell: (h) => <span>{h.deliverableIds.length}<span className="ml-1 text-xs text-fg-subtle">({h.leadDeliverableIds.length} lead)</span></span> },
    { id: 'open', header: 'Open work', numeric: true, accessor: (h) => h.openWork },
    { id: 'people', header: 'People', numeric: true, accessor: (h) => h.people },
    { id: 'agents', header: 'Agents', numeric: true, accessor: (h) => h.agents },
    { id: 'health', header: 'Health', accessor: (h) => RAG_RANK[h.health], cell: (h) => <RagPill status={h.health} size="sm" /> },
    {
      id: 'mix',
      header: 'RAG mix',
      accessor: (h) => h.ragMix.red,
      cell: (h) => (
        <span className="inline-flex items-center gap-2 text-xs whitespace-nowrap text-fg-muted tabular-nums">
          {(['red', 'amber', 'green', 'unknown'] as const).map((s) => (
            <span key={s} className="inline-flex items-center gap-0.5" title={terms.rag[s]}>
              <StatusGlyph status={s} className="size-3" />
              <span className="sr-only">{terms.rag[s]}</span>
              {h.ragMix[s]}
            </span>
          ))}
        </span>
      ),
    },
    { id: 'disagree', header: 'Disagreements', numeric: true, accessor: (h) => h.disagreementIds.length },
    { id: 'in', header: 'Inbound', numeric: true, accessor: (h) => h.inbound.filter((d) => d.crossHub).length },
    { id: 'out', header: 'Outbound', numeric: true, accessor: (h) => h.outbound.filter((d) => d.crossHub).length },
    { id: 'late', header: 'Late dep.', numeric: true, accessor: (h) => h.lateDependencyIds.length },
  ];

  const depColumns: Column<DependencyView>[] = [
    { id: 'title', header: 'Dependency', accessor: (d) => d.dep.title, cell: (d) => <span className="font-medium text-fg">{d.dep.title}</span>, minWidth: 240 },
    {
      id: 'route',
      header: 'Provider → receiver hub',
      accessor: (d) => hubName(d.dep.fromHubId),
      cell: (d) => (
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          {hubName(d.dep.fromHubId)} <ArrowRight aria-label="to" className="size-3 text-fg-subtle" /> {hubName(d.dep.toHubId)}
        </span>
      ),
    },
    {
      id: 'deliverables',
      header: 'Deliverables',
      accessor: (d) => d.dep.toDeliverableId,
      cell: (d) => (
        <span className="font-mono text-xs whitespace-nowrap text-fg-muted">
          {index.deliverables.get(d.dep.fromDeliverableId)?.ref ?? d.dep.fromDeliverableId} → {index.deliverables.get(d.dep.toDeliverableId)?.ref ?? d.dep.toDeliverableId}
        </span>
      ),
    },
    { id: 'status', header: 'Status', accessor: (d) => ({ late: 3, 'at-risk': 2, 'on-track': 1, delivered: 0 })[d.tone], cell: (d) => <DependencyStatusBadge view={d} /> },
    { id: 'needBy', header: 'Need by', accessor: (d) => d.dep.needBy, cell: (d) => <span className="whitespace-nowrap tabular-nums">{formatDate(d.dep.needBy)}</span> },
    { id: 'late', header: 'Days late', numeric: true, accessor: (d) => d.lateDays, cell: (d) => (d.lateDays > 0 ? d.lateDays : '—') },
  ];

  return (
    <div className="flex flex-col gap-6" data-testid="global-list">
      <DataTable
        ariaLabel="Delivery hubs"
        columns={hubColumns}
        rows={model.hubs}
        getRowId={(h) => h.hub.id}
        onRowClick={(h) => onSelectHub(h.hub.id)}
        selectedId={selectedHubId}
        defaultSort={{ columnId: 'continent', direction: 'asc' }}
        dense
      />
      <DataTable ariaLabel="Cross-hub dependencies" columns={depColumns} rows={arcs} getRowId={(d) => d.dep.id} defaultSort={{ columnId: 'status', direction: 'desc' }} dense />
    </div>
  );
}
