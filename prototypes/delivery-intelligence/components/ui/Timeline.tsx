import { Check, Circle, LoaderCircle, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from './cx';
import { uiText } from './labels';

export type StepState = 'pending' | 'running' | 'done' | 'failed';

export interface TimelineStep {
  id: string;
  title: ReactNode;
  state: StepState;
  /** Secondary text under the title. */
  description?: ReactNode;
  /** Right-aligned small text: a time, a duration, an actor. */
  meta?: ReactNode;
  /** Extra content under the description (a before/after, a citation list). */
  content?: ReactNode;
}

const MARK: Record<StepState, { Icon: typeof Check; ring: string; label: string }> = {
  pending: { Icon: Circle, ring: 'border-line-strong bg-surface text-fg-subtle', label: uiText.step.pending },
  running: { Icon: LoaderCircle, ring: 'border-accent-line bg-accent-soft text-accent', label: uiText.step.running },
  done: { Icon: Check, ring: 'border-status-green-line bg-status-green-soft text-status-green', label: uiText.step.done },
  failed: { Icon: X, ring: 'border-status-red-line bg-status-red-soft text-status-red', label: uiText.step.failed },
};

export interface TimelineProps {
  steps: TimelineStep[];
  /** Print the state word beside each title (always readable by screen readers regardless). */
  showStateLabel?: boolean;
  className?: string;
}

/**
 * Vertical stepper for agent steps and audit trails. Each state has its own shape
 * (hollow dot, spinner, tick, cross) and a text label for screen readers.
 *
 *   <Timeline steps={[{ id: '1', title: 'Read Epics', state: 'done', meta: '0.4 s' }, { id: '2', title: 'Check evidence', state: 'running' }]} />
 */
export function Timeline({ steps, showStateLabel, className }: TimelineProps) {
  return (
    <ol className={cx('m-0 flex list-none flex-col p-0', className)}>
      {steps.map((step, i) => {
        const { Icon, ring, label } = MARK[step.state];
        const last = i === steps.length - 1;
        return (
          <li key={step.id} data-state={step.state} className="relative flex gap-3 pb-5 last:pb-0">
            {!last ? (
              <span aria-hidden className={cx('absolute top-6 bottom-0 left-[11px] w-px', step.state === 'done' ? 'bg-status-green-line' : 'bg-line')} />
            ) : null}
            <span className={cx('relative z-[1] mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border', ring)}>
              <Icon aria-hidden className={cx('size-3.5', step.state === 'running' && 'animate-spin', step.state === 'pending' && 'size-2')} strokeWidth={2.6} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <p className={cx('text-[13px] leading-6 font-medium', step.state === 'pending' ? 'text-fg-muted' : 'text-fg')}>
                  {step.title}
                  {showStateLabel ? (
                    <span className={cx('ml-2 text-[11px] font-semibold tracking-wide uppercase', step.state === 'failed' ? 'text-status-red-fg' : step.state === 'done' ? 'text-status-green-fg' : step.state === 'running' ? 'text-accent' : 'text-fg-subtle')}>
                      {label}
                    </span>
                  ) : (
                    <span className="sr-only">{` (${label})`}</span>
                  )}
                </p>
                {step.meta ? <span className="shrink-0 pt-0.5 text-xs text-fg-subtle tabular-nums">{step.meta}</span> : null}
              </div>
              {step.description ? <p className="text-[13px] text-fg-muted">{step.description}</p> : null}
              {step.content ? <div className="mt-2">{step.content}</div> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
