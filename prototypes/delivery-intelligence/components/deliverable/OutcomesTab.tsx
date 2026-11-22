'use client';

import { CircleCheck, CircleDot, CircleX, TriangleAlert } from 'lucide-react';
import { ProvenanceBadge } from '@/components/shell';
import { AddToSlides } from '@/components/slides/AddToSlides';
import { ExportPack } from '@/components/slides/ExportPack';
import { Badge, Card, EmptyState, ProgressBar, cx, type BadgeTone } from '@/components/ui';
import { formatDate } from '@/lib/config/clock';
import { terms } from '@/lib/config/terminology';
import type { Outcome } from '@/lib/types';
import { Flag } from './bits';
import type { DeliverableModel, OutcomeRow } from './model';
import { RecordChip } from './records';

const REPORTED: Record<Outcome['reportedStatus'], { label: string; tone: BadgeTone }> = {
  'on-track': { label: 'On track', tone: 'green' },
  complete: { label: 'Complete', tone: 'green' },
  'at-risk': { label: 'At risk', tone: 'amber' },
  'off-track': { label: 'Off track', tone: 'red' },
};

function OutcomeCard({ row, today }: { row: OutcomeRow; today: string }) {
  const { outcome, measures, criteria, acceptanceEvidence, accepted, gap } = row;
  const rep = REPORTED[outcome.reportedStatus];
  const wc = measures?.workCompletion;
  const overdue = outcome.dueDate < today && !accepted;
  return (
    <Card
      padding="sm"
      level={4}
      className={cx(gap && 'border-status-amber-line')}
      data-testid={`outcome-${outcome.id}`}
      eyebrow={
        <span className="inline-flex items-center gap-2">
          <RecordChip to={{ kind: 'outcome', id: outcome.id }} label={outcome.ref} showKind={false} />
          <span className="normal-case tracking-normal">Weight {outcome.weight}</span>
          <span className={cx('normal-case tracking-normal', overdue && 'font-semibold text-status-amber-fg')}>
            Due {formatDate(outcome.dueDate)}
            {overdue ? ' (past due)' : ''}
          </span>
        </span>
      }
      title={outcome.title}
      actions={
        <>
          <AddToSlides kind="outcome-summary" scope={{ kind: 'outcome', outcomeId: outcome.id }} label={`the outcome slide for ${outcome.ref}`} />
          <ExportPack scope={{ kind: 'outcome', outcomeId: outcome.id }} label={`${outcome.ref} pack`} />
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,15rem)_minmax(0,15rem)_1fr]">
        <div className="flex flex-col gap-1.5">
          <span className="di-eyebrow">Reported in the {terms.systems['portfolio-system'].toLowerCase()}</span>
          <div className="flex items-center gap-2">
            <Badge tone={rep.tone} icon={rep.tone === 'red' ? <CircleX /> : rep.tone === 'amber' ? <TriangleAlert /> : <CircleCheck />}>
              {rep.label}
            </Badge>
            <ProvenanceBadge kind="reported" size="sm" label="Reported" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="di-eyebrow">Acceptance (evidence-based)</span>
          <div className="flex items-center gap-2">
            {accepted ? (
              <Badge tone="green" icon={<CircleCheck />}>Accepted</Badge>
            ) : (
              <Badge tone={gap ? 'amber' : 'unknown'} icon={gap ? <TriangleAlert /> : <CircleDot />}>Not accepted</Badge>
            )}
            <span className="text-xs text-fg-muted tabular-nums">
              {measures?.acceptance.mandatoryAccepted ?? 0} of {measures?.acceptance.mandatoryCount ?? 0} mandatory criteria
            </span>
          </div>
          <span className="text-xs text-fg-subtle">Acceptance owner: {row.acceptanceOwner ?? 'Not named'}</span>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="di-eyebrow">{terms.measures.workCompletion} (items carrying this {terms.hierarchy.outcomeIdField})</span>
          {wc?.computable ? (
            <>
              <ProgressBar value={wc.value.percent} ariaLabel={`${outcome.ref} work completion`} />
              <span className="text-xs text-fg-muted tabular-nums">
                {wc.value.percent}% · {wc.value.closedPoints} of {wc.value.totalPoints} points closed
                {wc.value.epicKeys.length > 1 ? ` across ${wc.value.epicKeys.length} Epics` : ''}
              </span>
            </>
          ) : (
            <span className="text-xs text-fg-muted">
              {terms.measures.notComputable}: {wc && !wc.computable ? wc.detail : 'no linked work'}
            </span>
          )}
        </div>
      </div>

      {gap && row.gapText ? (
        <p role="note" className="mt-3 flex items-start gap-2 rounded-md border border-status-amber-line bg-status-amber-soft px-3 py-2 text-[13px] font-medium text-status-amber-fg" data-testid="outcome-gap">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {row.gapText}
        </p>
      ) : null}

      <div className="mt-3 overflow-hidden rounded-md border border-line">
        <table className="w-full border-collapse text-[13px]" aria-label={`Acceptance criteria for ${outcome.ref}`}>
          <thead>
            <tr className="bg-surface-2 text-left text-[11px] tracking-[0.06em] text-fg-muted uppercase">
              <th scope="col" className="px-3 py-1.5 font-semibold">Acceptance criterion</th>
              <th scope="col" className="px-3 py-1.5 font-semibold">Required</th>
              <th scope="col" className="px-3 py-1.5 font-semibold">State</th>
              <th scope="col" className="px-3 py-1.5 font-semibold">Accepted by</th>
            </tr>
          </thead>
          <tbody>
            {criteria.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-3 text-fg-muted">No acceptance criteria are defined for this outcome.</td>
              </tr>
            ) : null}
            {criteria.map(({ criterion: c, acceptedBy }) => (
              <tr key={c.id} className="border-t border-line align-top">
                <td className="px-3 py-2 text-fg">
                  <RecordChip to={{ kind: 'criterion', id: c.id }} label={c.text} showKind={false} className="max-w-[44rem] text-left whitespace-normal" />
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-fg-muted">{c.mandatory ? 'Mandatory' : 'Optional'}</td>
                <td className="px-3 py-2">
                  <Badge size="sm" tone={c.state === 'accepted' ? 'green' : c.state === 'rejected' ? 'red' : 'unknown'} icon={c.state === 'accepted' ? <CircleCheck /> : c.state === 'rejected' ? <CircleX /> : <CircleDot />}>
                    {terms.criterionStates[c.state]}
                  </Badge>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-fg-muted">
                  {c.state === 'accepted' ? `${acceptedBy ?? 'Named person'}${c.acceptedAt ? `, ${formatDate(c.acceptedAt)}` : ''}` : c.state === 'rejected' ? (c.rejectionReason ?? 'Rejected') : 'Waiting for the acceptance owner'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
        <span className="font-semibold text-fg">{terms.evidenceKinds['business-acceptance']} record</span>
        {acceptanceEvidence.length === 0 ? (
          <Flag>None held</Flag>
        ) : (
          acceptanceEvidence.map((e) => (
            <span key={e.id} className="inline-flex items-center gap-1.5">
              <RecordChip to={{ kind: 'evidence', id: e.id }} />
              <span>{terms.evidenceResults[e.result]}, {formatDate(e.observedAt)}</span>
            </span>
          ))
        )}
      </div>
    </Card>
  );
}

export function OutcomesTab({ model }: { model: DeliverableModel }) {
  const today = model.ctx.clock.today;
  if (model.outcomes.length === 0) {
    return <EmptyState title="No outcomes defined yet" description="Outcomes and their acceptance criteria appear here once they are recorded in the portfolio system. Accepted outcomes are not computable until then." />;
  }
  const gaps = model.outcomes.filter((o) => o.gap).length;
  return (
    <div className="flex flex-col gap-3">
      {gaps > 0 ? (
        <p className="text-[13px] text-fg-muted">
          <strong className="font-semibold text-status-amber-fg">{gaps} of {model.outcomes.length} outcomes</strong> are flagged by rule R11: reported complete, or on track while past due or with all linked work closed, yet not accepted. Reported status is the portfolio system&apos;s; acceptance is recorded only by a named human against the criteria.
        </p>
      ) : null}
      {model.outcomes.map((row) => (
        <OutcomeCard key={row.outcome.id} row={row} today={today} />
      ))}
    </div>
  );
}
