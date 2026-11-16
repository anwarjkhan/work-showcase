'use client';

import { ArrowRight, CircleAlert, LoaderCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { terms } from '@/lib/config/terminology';
import { Button, cx } from '@/components/ui';
import { useWorkflow } from './context';

/** One prominent line that always says what to do next, derived from the workflow state. */
export function NextStepStrip({ celebrate }: { celebrate: boolean }) {
  const { next, deliverable, measures, finishPlayback, reducedMotion } = useWorkflow();

  if (!next) {
    return (
      <div className="flex h-12 items-center gap-3 rounded-lg border border-line bg-surface-2 px-4 text-[13px] text-fg-muted" data-testid="next-step" data-next-target="none">
        <span className="di-eyebrow">Next step</span>
        <span>Nothing to do in this stage right now.</span>
      </div>
    );
  }

  if (next.target === 'ready') {
    const wc = measures.workCompletion;
    const ao = measures.acceptedOutcomes;
    return (
      <div
        role="status"
        data-testid="next-step"
        data-next-target="ready"
        className="relative flex h-12 items-center gap-3 overflow-hidden rounded-lg border border-status-green-line bg-status-green-soft px-4 text-[13px] text-status-green-fg"
      >
        <Seal animate={celebrate && !reducedMotion} />
        <span className="font-semibold">
          {deliverable.ref} is {terms.readiness.ready.toLowerCase()}.
        </span>
        <span className="truncate">
          {terms.measures.workCompletion} {wc.computable ? `${wc.value.percent}%` : terms.measures.notComputable.toLowerCase()} · {terms.measures.acceptedOutcomes.toLowerCase()} {ao.computable ? `${ao.value.acceptedCount} of ${ao.value.totalCount}` : terms.measures.notComputable.toLowerCase()} · {terms.measures.readiness.toLowerCase()} {terms.readiness.ready.toLowerCase()}. Three measures, each from its own records.
        </span>
      </div>
    );
  }

  const wait = next.tone === 'wait';
  const warn = next.tone === 'warn';
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="next-step"
      data-next-target={next.target}
      className={cx(
        'flex h-12 min-w-0 items-center gap-3 rounded-lg border px-4',
        warn ? 'border-status-amber-line bg-status-amber-soft' : 'border-accent-line bg-accent-soft',
      )}
    >
      <span className={cx('di-eyebrow shrink-0', warn ? 'text-status-amber-fg' : 'text-accent')}>Next step</span>
      <span aria-hidden className={cx('inline-flex shrink-0 [&>svg]:size-4', warn ? 'text-status-amber-fg' : 'text-accent')}>
        {wait ? <LoaderCircle className={reducedMotion ? '' : 'animate-spin'} /> : warn ? <CircleAlert /> : <ArrowRight />}
      </span>
      <motion.span
        key={next.label}
        initial={reducedMotion ? false : { opacity: 0, x: 6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25 }}
        className="shrink-0 text-[14px] font-semibold text-title"
        data-testid="next-step-label"
      >
        {next.label}
      </motion.span>
      {next.detail ? <span className="min-w-0 truncate text-[12.5px] text-fg-muted" title={next.detail}>{next.detail}</span> : null}
      {wait ? (
        <Button size="sm" variant="secondary" className="ml-auto" onClick={finishPlayback} data-target="skip-playback">
          Skip to result
        </Button>
      ) : null}
    </div>
  );
}

function Seal({ animate }: { animate: boolean }) {
  return (
    <span className="relative inline-flex size-7 shrink-0 items-center justify-center" aria-hidden>
      <svg viewBox="0 0 28 28" className="size-7">
        <motion.circle
          cx="14"
          cy="14"
          r="12"
          fill="none"
          strokeWidth="2"
          className="stroke-status-green"
          initial={animate ? { pathLength: 0 } : false}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
        <motion.path
          d="M8.5 14.5l3.6 3.6 7.4-8"
          fill="none"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-status-green"
          initial={animate ? { pathLength: 0 } : false}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.45, delay: animate ? 0.6 : 0 }}
        />
      </svg>
      {animate ? (
        <motion.span
          className="absolute inset-0 rounded-full ring-2 ring-status-green-line"
          initial={{ scale: 0.8, opacity: 0.9 }}
          animate={{ scale: 1.9, opacity: 0 }}
          transition={{ duration: 1.1, delay: 0.9, ease: 'easeOut' }}
        />
      ) : null}
    </span>
  );
}
