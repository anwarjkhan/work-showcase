'use client';

import { ArrowLeftRight, Check, CornerDownLeft, Undo2 } from 'lucide-react';
import { Fragment, useState } from 'react';
import type { StageView } from '@/lib/agents/workflow';
import { stageDefinition } from '@/lib/config/pdlc';
import { terms } from '@/lib/config/terminology';
import { Avatar, cx } from '@/components/ui';
import { FOCUS_RING, TRANSITION } from '@/components/ui/cx';
import { useWorkflow } from './context';
import { formatStamp } from './model';
import { StageDrawer } from './StageDrawer';

/** The five stages in order, two-way connectors, the current one marked; each opens a summary. */
export function StageRail() {
  const { view, personName } = useWorkflow();
  const [open, setOpen] = useState<StageView['definition']['id'] | null>(null);
  const moves = view.run.moves;
  const backs = moves.filter((m) => m.direction === 'back');
  const lastBack = backs.at(-1);

  return (
    <nav aria-label="PDLC stages" className="di-card px-3 py-2" data-testid="stage-rail">
      <ol className="flex items-stretch">
        {view.stages.map((s, i) => {
          const prev = view.stages[i - 1];
          const crossings = prev ? backs.filter((m) => m.from === s.definition.id && m.to === prev.definition.id) : [];
          return (
            <Fragment key={s.definition.id}>
              {prev ? (
                <li aria-hidden={crossings.length === 0 || undefined} className="flex w-9 shrink-0 flex-col items-center justify-center gap-0.5">
                  {crossings.length > 0 ? (
                    <span
                      className="inline-flex h-5 items-center gap-0.5 rounded-pill border border-status-amber-line bg-status-amber-soft px-1.5 text-[10px] font-semibold text-status-amber-fg"
                      title={crossings.map((m) => m.reason).join(' · ')}
                    >
                      <Undo2 aria-hidden className="size-3" />
                      {crossings.length}
                      <span className="sr-only"> move{crossings.length === 1 ? '' : 's'} back from {s.definition.name}</span>
                    </span>
                  ) : (
                    <ArrowLeftRight aria-hidden className="size-3.5 text-accent-line" />
                  )}
                </li>
              ) : null}
              <li className="min-w-0 flex-1">
                <RailStage stage={s} onOpen={() => setOpen(s.definition.id)} personName={personName} />
              </li>
            </Fragment>
          );
        })}
      </ol>
      {lastBack ? (
        <p className="mt-1.5 flex min-w-0 items-center gap-1.5 border-t border-line pt-1.5 text-[11.5px] text-status-amber-fg" data-testid="rail-move-back">
          <CornerDownLeft aria-hidden className="size-3.5 shrink-0" />
          <span className="shrink-0 font-semibold">
            Moved back from {stageDefinition(lastBack.from).shortName} to {stageDefinition(lastBack.to).shortName}
          </span>
          <span className="shrink-0 text-fg-subtle">
            {formatStamp(lastBack.at)}
            {lastBack.by.kind === 'human' ? ` · ${personName(lastBack.by.personId)}` : ''}
          </span>
          <span className="truncate text-fg-muted" title={lastBack.reason ?? undefined}>
            {lastBack.reason}
          </span>
          {backs.length > 1 ? <span className="shrink-0 text-fg-subtle">({backs.length} moves back in all; see history)</span> : null}
        </p>
      ) : null}
      {open ? <StageDrawer stageId={open} onClose={() => setOpen(null)} /> : null}
    </nav>
  );
}

function RailStage({ stage, onOpen, personName }: { stage: StageView; onOpen: () => void; personName: (id: string | null | undefined) => string }) {
  const { person } = useWorkflow();
  const { definition: def, state, current } = stage;
  const approved = state.status === 'approved';
  const returned = state.status === 'returned';
  const decided = state.reviews.flatMap((r) => r.decisions).filter((d) => d.decision === 'approved');
  const lastApproval = decided.at(-1);
  const held = stage.evidence.filter((e) => e.latest);
  const pendingReviews = stage.reviews.filter((r) => r.state !== 'approved').length;

  let line: string;
  if (current) {
    line = pendingReviews === 0 ? 'Current · reviews approved' : `Current · ${pendingReviews === stage.reviews.length && stage.reviews.every((r) => r.state === 'not-requested') ? 'review not requested' : `${pendingReviews} review${pendingReviews === 1 ? '' : 's'} open`}`;
  } else if (approved) {
    line = `${lastApproval ? `Approved by ${personName(lastApproval.reviewerId).split(' ')[0]}` : 'Approved'} · ${held.length} record${held.length === 1 ? '' : 's'}`;
  } else if (returned) {
    line = 'Returned for rework';
  } else {
    line = 'Not started';
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-current={current ? 'step' : undefined}
      data-testid={`rail-${def.id}`}
      data-current={current || undefined}
      className={cx(
        'flex w-full min-w-0 items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-hover',
        current && 'bg-accent-soft ring-1 ring-accent-line',
        TRANSITION,
        FOCUS_RING,
      )}
      title={`${def.name}: open the stage summary`}
    >
      <span
        className={cx(
          'inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold',
          current ? 'border-accent bg-accent text-on-accent' : approved ? 'border-status-green-line bg-status-green-soft text-status-green' : returned ? 'border-status-amber-line bg-status-amber-soft text-status-amber-fg' : 'border-line-strong bg-surface text-fg-subtle',
        )}
      >
        {approved && !current ? <Check aria-hidden className="size-3.5" strokeWidth={3} /> : returned && !current ? <Undo2 aria-hidden className="size-3.5" /> : def.order}
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className={cx('truncate text-[12.5px] font-semibold', current ? 'text-title' : 'text-fg')}>{def.shortName}</span>
        <span className="flex min-w-0 items-center gap-1 truncate text-[11px] text-fg-muted">
          {approved && !current && lastApproval ? <Avatar size="xs" initials={person(lastApproval.reviewerId)?.initials ?? '?'} name={personName(lastApproval.reviewerId)} className="!size-4 !text-[8px]" /> : null}
          <span className="truncate">{line}</span>
        </span>
      </span>
      <span className="sr-only">
        {current ? ' (current stage)' : ''}. Evidence: {stage.evidence.map((e) => `${terms.evidenceKinds[e.kind]} ${e.result}`).join(', ')}
      </span>
    </button>
  );
}
