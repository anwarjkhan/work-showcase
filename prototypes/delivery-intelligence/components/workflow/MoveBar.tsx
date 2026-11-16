'use client';

import { ArrowLeft, ArrowRight, CircleAlert, Info } from 'lucide-react';
import { useState } from 'react';
import { stageDefinition } from '@/lib/config/pdlc';
import { Button, cx } from '@/components/ui';
import { FOCUS_RING } from '@/components/ui/cx';
import { useTarget, useWorkflow } from './context';
import { failingEvidence, failureReworked } from './model';

/** Move back (with a reason) and forward (disabled with the reason until the reviews are approved). */
export function MoveBar() {
  const { view, id, actions, act, actingAs, evidence, measures } = useWorkflow();
  const [backOpen, setBackOpen] = useState(false);
  const [reason, setReason] = useState('');
  const failing = failingEvidence(view, evidence, measures);
  const reworked = failureReworked(view.run, failing);
  const offer = view.backSuggestion.offer && view.backSuggestion.to && !reworked;
  const fwdT = useTarget('move-forward');
  const prev = view.back.to;
  const fwd = view.forward;

  return (
    <div className="flex flex-col border-t border-line bg-surface-2" data-testid="move-bar">
      {offer ? (
        <BackOffer key={view.backSuggestion.reason} />
      ) : view.backSuggestion.offer && reworked ? (
        <p className="flex items-center gap-2 border-b border-line px-4 py-1.5 text-[12px] text-fg-muted">
          <Info aria-hidden className="size-3.5 text-accent" />
          The failure was sent back for rework; a passing rerun clears it and lets the review proceed.
        </p>
      ) : null}

      <div className="flex min-w-0 flex-wrap items-center gap-3 px-4 py-2.5">
        {backOpen && prev ? (
          <form
            className="flex min-w-0 flex-1 items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (act(() => actions.moveStage(id, 'back', actingAs, reason)).ok) setBackOpen(false);
            }}
          >
            <label className="sr-only" htmlFor="back-reason">
              Reason for moving back
            </label>
            <input
              id="back-reason"
              autoFocus
              placeholder={`Why move back to ${stageDefinition(prev).name}? (required)`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={cx('h-8 min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-2 text-[12.5px] text-fg', FOCUS_RING)}
            />
            <Button size="sm" type="submit" variant="danger" disabledReason={reason.trim() ? undefined : view.back.reason}>
              Move back
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setBackOpen(false)}>
              Cancel
            </Button>
          </form>
        ) : (
          <Button size="sm" variant="secondary" icon={<ArrowLeft />} disabledReason={prev ? undefined : view.back.reason} onClick={() => setBackOpen(true)} data-testid="move-back">
            {prev ? `Move back to ${stageDefinition(prev).shortName}` : 'Move back'}
          </Button>
        )}
        {!backOpen ? (
          <p className={cx('ml-auto min-w-0 truncate text-right text-[12px]', fwd.allowed ? 'text-status-green-fg' : 'text-fg-muted')} data-testid="forward-reason" title={fwd.reason}>
            {fwd.reason}
          </p>
        ) : null}
        <Button size="md" variant="primary" iconRight={<ArrowRight />} disabledReason={fwd.allowed ? undefined : fwd.reason} onClick={() => act(() => actions.moveStage(id, 'forward', actingAs))} data-testid="move-forward" {...fwdT}>
          {fwd.to ? `Move forward to ${stageDefinition(fwd.to).shortName}` : 'Last stage'}
        </Button>
      </div>
    </div>
  );
}

function BackOffer() {
  const { view, id, actions, act, actingAs } = useWorkflow();
  const [offerReason, setOfferReason] = useState(view.backSuggestion.reason);
  const offerT = useTarget('move-back-offer');
  return (
        <form
      className="flex min-w-0 items-center gap-2 border-b border-status-red-line bg-status-red-soft px-4 py-2"
      data-testid="move-back-offer"
      onSubmit={(e) => {
        e.preventDefault();
        act(() => actions.moveStage(id, 'back', actingAs, offerReason));
      }}
    >
      <CircleAlert aria-hidden className="size-4 shrink-0 text-status-red" />
      <span className="shrink-0 text-[12.5px] font-semibold text-status-red-fg">Failing evidence: move back?</span>
      <label className="sr-only" htmlFor="offer-reason">
        Reason recorded with the move back
      </label>
      <input
        id="offer-reason"
        value={offerReason}
        onChange={(e) => setOfferReason(e.target.value)}
        className={cx('h-7 min-w-0 flex-1 rounded-md border border-status-red-line bg-surface px-2 text-[12px] text-fg', FOCUS_RING)}
      />
      <Button size="sm" type="submit" variant="danger" icon={<ArrowLeft />} disabledReason={offerReason.trim() ? undefined : `Moving back to ${stageDefinition(view.backSuggestion.to!).name} needs a reason to be recorded.`} {...offerT}>
        Move back to {stageDefinition(view.backSuggestion.to!).shortName}
      </Button>
    </form>
  );
}
