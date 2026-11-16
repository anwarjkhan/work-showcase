'use client';

import { ArrowDownToLine, ArrowRight, ArrowUpFromLine, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ProvenanceBadge } from '@/components/shell';
import { Badge, Drawer, KeyValue, MeasureTriple, RagPair, cx } from '@/components/ui';
import { FOCUS_RING } from '@/components/ui/cx';
import { formatDate } from '@/lib/config/clock';
import { hrefs } from '@/lib/config/routes';
import { terms } from '@/lib/config/terminology';
import type { Dependency, DependencyStatus } from '@/lib/types';
import { milestoneRisk, slipText } from './layout';
import { MilestoneMark, planText } from './PlanBits';
import type { PlanState } from './usePlanIndex';

const DEP_TONE: Record<DependencyStatus, 'red' | 'amber' | 'green' | 'neutral'> = {
  blocked: 'red',
  late: 'red',
  'at-risk': 'amber',
  'on-track': 'neutral',
  delivered: 'green',
};

function Block({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="di-eyebrow">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function PlanDrawer({ state, deliverableId, onClose, onSelect }: { state: PlanState; deliverableId: string | null; onClose: () => void; onSelect: (id: string) => void }) {
  const info = deliverableId ? state.index.deliverables.get(deliverableId) : undefined;
  return (
    <Drawer
      open={Boolean(info)}
      onClose={onClose}
      width="lg"
      eyebrow={info ? `${terms.hierarchy.deliverable} · ${info.deliverable.ref}${info.standalone ? ` · ${planText.standalone}` : ''}` : ''}
      title={info?.deliverable.title ?? ''}
      footer={
        info ? (
          <Link
            href={hrefs.deliverable(info.deliverable.id)}
            className={cx('inline-flex h-9 items-center gap-2 rounded-md border border-transparent bg-accent px-3.5 text-[13px] font-medium text-on-accent shadow-card hover:bg-accent-strong', FOCUS_RING)}
          >
            Open deliverable detail
            <ExternalLink aria-hidden className="size-4" />
          </Link>
        ) : null
      }
    >
      {info ? <DrawerBody state={state} id={info.deliverable.id} onSelect={onSelect} /> : null}
    </Drawer>
  );
}

function DrawerBody({ state, id, onSelect }: { state: PlanState; id: string; onSelect: (id: string) => void }) {
  const { index, result, clock, data } = state;
  const info = index.deliverables.get(id);
  if (!info) return null;
  const d = info.deliverable;
  const measures = result.deliverables[id];
  const rag = result.deliverableRag[id];
  const f = info.forecast;
  const worstKnock = info.knockOns.reduce<(typeof info.knockOns)[number] | null>((a, k) => (!a || k.lateDays > a.lateDays ? k : a), null);
  const refOf = (did: string) => data.deliverables.find((x) => x.id === did);

  const dates = [
    { label: 'Planned start', value: formatDate(d.plannedStart) },
    { label: 'Planned end', value: formatDate(d.plannedEnd), hint: <ProvenanceBadge kind="reported" size="sm" /> },
    {
      label: 'Forecast end',
      value: f ? (
        <span>
          {formatDate(f.forecastEnd)} <span className={cx('text-xs font-semibold', f.slipDays > 0 ? 'text-status-red-fg' : 'text-fg-muted')}>{slipText(f.slipDays)}</span>
        </span>
      ) : (
        '—'
      ),
      hint: <ProvenanceBadge kind="computed" size="sm" />,
    },
    {
      label: 'With dependency delay',
      value: worstKnock ? (
        <span>
          {formatDate(worstKnock.receiverEndWithDelay)} <span className="text-xs font-semibold text-status-amber-fg">{slipText(worstKnock.lateDays)}</span>
        </span>
      ) : (
        'No late inputs'
      ),
      hint: <ProvenanceBadge kind="computed" size="sm" />,
    },
    { label: 'Reported forecast', value: d.reportedForecastEnd ? formatDate(d.reportedForecastEnd) : 'Not recorded', hint: <ProvenanceBadge kind="reported" size="sm" /> },
    {
      label: 'Projected end',
      value: (
        <span>
          {formatDate(info.projectedEnd)} <span className={cx('text-xs font-semibold', info.projectedSlipDays > 0 ? 'text-status-red-fg' : 'text-fg-muted')}>{slipText(info.projectedSlipDays)}</span>
        </span>
      ),
      hint: 'Later of forecast and knock-on',
    },
  ];

  const depRow = (dep: Dependency, direction: 'in' | 'out') => {
    const other = refOf(direction === 'in' ? dep.fromDeliverableId : dep.toDeliverableId);
    const k = index.knockOnByDependency.get(dep.id);
    const fromHub = data.hubs.find((h) => h.id === dep.fromHubId);
    const toHub = data.hubs.find((h) => h.id === dep.toHubId);
    return (
      <li key={dep.id} className={cx('flex flex-col gap-1.5 rounded-md border p-3', k ? 'border-status-red-line bg-status-red-soft/40' : 'border-line bg-surface-2')}>
        <div className="flex items-start justify-between gap-3">
          <span className="text-[13px] font-medium text-fg">{dep.title}</span>
          <Badge tone={DEP_TONE[dep.status]} size="sm">
            {terms.dependencyStatus[dep.status]}
            {dep.critical ? ' · critical' : ''}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
          {direction === 'in' ? <ArrowDownToLine aria-hidden className="size-3.5" /> : <ArrowUpFromLine aria-hidden className="size-3.5" />}
          {other ? (
            <button type="button" onClick={() => onSelect(other.id)} className={cx('font-mono text-accent hover:underline', FOCUS_RING)}>
              {direction === 'in' ? 'from' : 'to'} {other.ref}
            </button>
          ) : null}
          {fromHub && toHub && fromHub.id !== toHub.id ? (
            <span>
              {fromHub.name} → {toHub.name}
            </span>
          ) : null}
          <span>Need by {formatDate(dep.needBy)}</span>
          <span>Committed {dep.committed ? formatDate(dep.committed) : 'not yet'}</span>
        </div>
        {k ? (
          <p className="text-xs leading-relaxed text-status-red-fg">
            <span className="font-semibold">{k.lateDays} days late.</span> {k.explanation}
          </p>
        ) : null}
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        {rag ? <RagPair reported={rag.reported} evidence={rag.evidence} disagrees={rag.disagrees} size="sm" /> : null}
        <ProvenanceBadge kind="computed" size="sm" />
      </div>
      {measures ? <MeasureTriple compact workCompletion={measures.workCompletion} acceptedOutcomes={measures.acceptedOutcomes} readiness={measures.readiness} /> : null}

      <Block title="Key dates">
        <KeyValue columns={3} items={dates} />
      </Block>

      <Block title="Why the dates moved">
        <ul className="flex flex-col gap-2 text-[13px] leading-relaxed text-fg">
          {f ? <li>{f.explanation}</li> : null}
          {info.knockOns.map((k) => (
            <li key={k.dependencyId} className="text-status-amber-fg">
              {k.explanation}
            </li>
          ))}
          {!f && info.knockOns.length === 0 ? <li className="text-fg-muted">No forecast could be computed.</li> : null}
        </ul>
      </Block>

      <Block title={`${planText.milestones} (${info.milestones.length})`}>
        {info.milestones.length === 0 ? (
          <p className="text-sm text-fg-muted">No milestones recorded.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
            {info.milestones.map((m) => {
              const risk = milestoneRisk(index, m, clock);
              const shifted = index.shiftedMilestones.get(m.id);
              return (
                <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="w-12 shrink-0 pl-2.5">
                    <MilestoneMark milestone={m} risk={risk} size="sm" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-fg">{m.title}</span>
                    <span className="text-xs text-fg-muted">
                      {m.regulatory ? `${planText.regulatory} · ` : ''}
                      {m.status === 'met' ? 'Met' : risk ? planText.risk[risk] : 'Planned'}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs tabular-nums">
                    <span className={cx(shifted ? 'text-fg-subtle line-through' : 'text-fg')}>{formatDate(m.date)}</span>
                    {shifted ? (
                      <span className="flex items-center justify-end gap-1 font-semibold text-status-amber-fg">
                        <ArrowRight aria-hidden className="size-3" />
                        {formatDate(shifted)}
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Block>

      <Block title={`Incoming dependencies (${info.incoming.length})`}>
        {info.incoming.length === 0 ? <p className="text-sm text-fg-muted">None recorded.</p> : <ul className="flex flex-col gap-2">{info.incoming.map((x) => depRow(x, 'in'))}</ul>}
      </Block>
      <Block title={`Outgoing dependencies (${info.outgoing.length})`}>
        {info.outgoing.length === 0 ? <p className="text-sm text-fg-muted">None recorded.</p> : <ul className="flex flex-col gap-2">{info.outgoing.map((x) => depRow(x, 'out'))}</ul>}
      </Block>
    </div>
  );
}
