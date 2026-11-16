'use client';

import { ProvenanceBadge } from '@/components/shell';
import { Badge, DataTable, EmptyState, SectionHeading, cx, type Column } from '@/components/ui';
import { formatDate } from '@/lib/config/clock';
import { terms } from '@/lib/config/terminology';
import { usePortfolioIndex } from '@/lib/store';
import { HeldBadge, PersonCell } from './bits';
import type { DeliverableModel, EvidenceRow } from './model';
import { RecordChip, useOpenRecord } from './records';

export function EvidenceTab({ model }: { model: DeliverableModel }) {
  const open = useOpenRecord();
  const idx = usePortfolioIndex();
  const tier = terms.riskTiers[model.deliverable.riskTier];
  const r = model.measures.readiness;

  const columns: Column<EvidenceRow>[] = [
    { id: 'kind', header: 'Kind', accessor: (x) => terms.evidenceKinds[x.evidence.kind], minWidth: 170 },
    {
      id: 'title',
      header: 'Record',
      accessor: (x) => x.evidence.title,
      cell: (x) => (
        <span className="flex flex-col gap-0.5">
          <RecordChip to={{ kind: 'evidence', id: x.evidence.id }} label={x.evidence.title} showKind={false} className="w-fit max-w-full text-left whitespace-normal" />
          {!x.current ? <span className="text-[11px] text-fg-subtle">Superseded by a later record</span> : null}
        </span>
      ),
      minWidth: 250,
    },
    {
      id: 'result',
      header: 'Result',
      accessor: (x) => x.evidence.result,
      cell: (x) => (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <Badge size="sm" tone={x.evidence.result === 'pass' ? 'green' : x.evidence.result === 'fail' ? 'red' : 'neutral'}>{terms.evidenceResults[x.evidence.result]}</Badge>
          {x.stale ? <HeldBadge state="stale" /> : null}
        </span>
      ),
      minWidth: 150,
    },
    {
      id: 'source',
      header: 'Source',
      accessor: (x) => terms.systems[x.evidence.source],
      cell: (x) => (
        <span className="flex flex-col leading-tight">
          <span>{terms.systemsShort[x.evidence.source]}</span>
          <span className="font-mono text-[11px] text-fg-subtle">{x.evidence.sourceRef}</span>
        </span>
      ),
      minWidth: 130,
    },
    { id: 'observed', header: 'Observed', accessor: (x) => x.evidence.observedAt, cell: (x) => formatDate(x.evidence.observedAt, { withYear: false }), minWidth: 100 },
    { id: 'by', header: 'Recorded by', accessor: (x) => (x.evidence.recordedById ? idx.people.get(x.evidence.recordedById)?.name : null), cell: (x) => <PersonCell id={x.evidence.recordedById} fallback="Automated source" />, minWidth: 160 },
    { id: 'covers', header: 'Covers', accessor: (x) => x.covers, minWidth: 140 },
    { id: 'prov', header: 'Provenance', accessor: (x) => x.evidence.provenance, cell: (x) => <ProvenanceBadge kind={x.evidence.provenance} size="sm" />, minWidth: 150 },
    {
      id: 'stale',
      header: 'Currency',
      accessor: (x) => Number(x.stale),
      cell: (x) => (x.stale ? <span className="text-status-amber-fg">{x.staleReason ?? 'Stale'}</span> : <span className="text-fg-muted">Current</span>),
      minWidth: 200,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <SectionHeading level={3} title={`Required versus held, ${tier}`} description="What the risk tier requires before release, and what is held, passing, failing, stale or missing today." />
        {model.matrix.length === 0 ? (
          <EmptyState variant="inline" title="No required evidence is set for this tier" />
        ) : (
          <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3" data-testid="evidence-matrix">
            {model.matrix.map((m) => (
              <li
                key={m.kind}
                className={cx('di-card flex min-w-0 flex-col gap-1.5 px-4 py-3', m.state === 'failing' && 'border-status-red-line', m.state === 'missing' && 'border-dashed border-line-strong')}
                data-kind={m.kind}
                data-state={m.state}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-fg">{terms.evidenceKinds[m.kind]}</span>
                  <HeldBadge state={m.state} />
                </div>
                <div className="text-xs text-fg-muted">
                  {m.evidenceId ? (
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      <RecordChip to={{ kind: 'evidence', id: m.evidenceId }} />
                      {m.observedAt ? `observed ${formatDate(m.observedAt, { withYear: false })}` : null}
                    </span>
                  ) : (
                    'No record held'
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-fg-subtle">
          {r.state === 'ready'
            ? 'Every required kind is held and passing, so readiness is Ready.'
            : r.state === 'not-ready'
              ? 'Readiness is Not ready because at least one required kind is failing or a critical dependency is open.'
              : 'Readiness is Unknown because required evidence is missing or stale. Unknown is never shown as ready.'}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <SectionHeading level={3} title="Evidence register" description={`${model.evidence.length} record${model.evidence.length === 1 ? '' : 's'}. Evidence is stale when the work it covers changed after it was observed.`} />
        <DataTable
          ariaLabel="Evidence register"
          rows={model.evidence}
          columns={columns}
          getRowId={(x) => x.evidence.id}
          onRowClick={(x) => open({ kind: 'evidence', id: x.evidence.id })}
          defaultSort={{ columnId: 'observed', direction: 'desc' }}
          dense
          maxHeight={460}
          empty={<EmptyState variant="inline" title="No evidence recorded yet" description="Evidence records arrive from the test harness, the control register and reviews. Until then readiness is Unknown." />}
        />
      </div>
    </div>
  );
}
