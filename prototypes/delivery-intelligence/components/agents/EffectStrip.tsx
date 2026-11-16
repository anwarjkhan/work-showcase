'use client';

import { ArrowRight, ArrowUpRight, Sigma } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ProvenanceBadge } from '@/components/shell';
import { RagPill, ReadinessPill, SeverityBadge, cx } from '@/components/ui';
import { MOTION } from '@/components/ui/motion';
import { hrefs } from '@/lib/config/routes';
import { terms } from '@/lib/config/terminology';
import type { Finding, TechDeliverable } from '@/lib/types';
import { acceptedText, workText, type EffectSnapshot } from './model';

export interface ApprovalEffect {
  proposalId: string;
  title: string;
  approverName: string;
  at: string;
  before: EffectSnapshot;
  after: EffectSnapshot;
  cleared: Finding[];
  raised: Finding[];
}

function Cell({ label, before, after, changed, delta, testId, index }: { label: string; before: ReactNode; after: ReactNode; changed: boolean; delta?: string; testId?: string; index: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      data-testid={testId}
      data-changed={changed || undefined}
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: MOTION.slow, delay: reduce ? 0 : 0.08 * index, ease: MOTION.easeEmphasis }}
      className={cx('relative flex min-w-0 flex-col gap-1 overflow-hidden rounded-md border px-3 py-2', changed ? 'border-accent-line bg-accent-soft' : 'border-line bg-surface-2')}
    >
      <span className="truncate text-[11px] text-fg-muted">{label}</span>
      <span className="flex flex-wrap items-center gap-1.5 tabular-nums">
        <span className={cx('text-[13px]', changed ? 'text-fg-subtle line-through decoration-1' : 'text-fg-muted')}>{before}</span>
        <ArrowRight aria-hidden className="size-3.5 text-fg-subtle" />
        <span className={cx('font-display text-[15px] font-semibold', changed ? 'text-title' : 'text-fg')}>{after}</span>
      </span>
      <span className={cx('text-[11px]', changed ? 'font-semibold text-accent' : 'text-fg-subtle')}>{changed ? (delta ?? 'Changed') : 'Unchanged'}</span>
    </motion.div>
  );
}

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/** Before and after an approval, recomputed by the engine. Animates once when it appears. */
export function EffectStrip({ effect, deliverable }: { effect: ApprovalEffect; deliverable: TechDeliverable | undefined }) {
  const reduce = useReducedMotion();
  const { before: b, after: a } = effect;
  const pf = a.portfolioFindings - b.portfolioFindings;
  const df = (a.deliverableFindings ?? 0) - (b.deliverableFindings ?? 0);
  const anyMeasureChanged = workText(a.work) !== workText(b.work) || acceptedText(a.accepted) !== acceptedText(b.accepted) || a.readiness !== b.readiness || a.evidence !== b.evidence;
  return (
    <motion.section
      key={effect.proposalId}
      aria-labelledby="effect-h"
      data-testid="effect-strip"
      initial={reduce ? false : { opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: MOTION.slow, ease: MOTION.easeEmphasis }}
      className="flex flex-col gap-3 rounded-lg border border-accent-line bg-surface p-4 shadow-raised"
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="di-eyebrow mb-0.5 flex items-center gap-1.5">
            <Sigma aria-hidden className="size-3" /> What changed, recomputed
          </div>
          <h4 id="effect-h" className="text-[13.5px] leading-snug font-semibold text-title">
            {effect.approverName} approved: {effect.title}
          </h4>
        </div>
        <div className="flex items-center gap-2">
          <ProvenanceBadge kind="computed" size="sm" />
          {deliverable ? (
            <Link
              href={hrefs.deliverable(deliverable.id)}
              className="inline-flex items-center gap-1 rounded-sm text-[12.5px] font-medium text-accent hover:underline focus-visible:shadow-focus focus-visible:outline-none"
              data-testid="effect-deliverable-link"
            >
              Open {deliverable.ref} <ArrowUpRight aria-hidden className="size-3.5" />
            </Link>
          ) : null}
        </div>
      </header>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        <Cell index={0} testId="effect-portfolio-findings" label="Portfolio findings" before={b.portfolioFindings} after={a.portfolioFindings} changed={pf !== 0} delta={`${signed(pf)} finding${Math.abs(pf) === 1 ? '' : 's'}`} />
        {deliverable ? (
          <>
            <Cell index={1} label={`${deliverable.ref} findings`} before={b.deliverableFindings} after={a.deliverableFindings} changed={df !== 0} delta={`${signed(df)}`} />
            <Cell
              index={2}
              label={`${terms.ragKinds.evidence} RAG`}
              before={b.evidence ? <RagPill status={b.evidence} size="sm" /> : '—'}
              after={a.evidence ? <RagPill status={a.evidence} size="sm" /> : '—'}
              changed={a.evidence !== b.evidence}
            />
            <Cell index={3} label={terms.measures.workCompletion} before={workText(b.work)} after={workText(a.work)} changed={workText(a.work) !== workText(b.work)} />
            <Cell index={4} label={terms.measures.acceptedOutcomes} before={acceptedText(b.accepted)} after={acceptedText(a.accepted)} changed={acceptedText(a.accepted) !== acceptedText(b.accepted)} />
            <Cell
              index={5}
              label={terms.measures.readiness}
              before={b.readiness ? <ReadinessPill state={b.readiness} size="sm" /> : '—'}
              after={a.readiness ? <ReadinessPill state={a.readiness} size="sm" /> : '—'}
              changed={a.readiness !== b.readiness}
            />
          </>
        ) : null}
      </div>
      {effect.cleared.length > 0 || effect.raised.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[12.5px]">
          {effect.cleared.map((f) => (
            <li key={f.id} className="flex items-start gap-2">
              <span className="mt-0.5 rounded-xs border border-status-green-line bg-status-green-soft px-1 text-[10.5px] font-semibold text-status-green-fg">Cleared</span>
              <SeverityBadge severity={f.severity} size="sm" />
              <span className="text-fg-muted">
                <span className="font-mono text-[11px] text-fg-subtle">{f.ruleId}</span> {f.message}
              </span>
            </li>
          ))}
          {effect.raised.map((f) => (
            <li key={f.id} className="flex items-start gap-2">
              <span className="mt-0.5 rounded-xs border border-status-amber-line bg-status-amber-soft px-1 text-[10.5px] font-semibold text-status-amber-fg">Raised</span>
              <SeverityBadge severity={f.severity} size="sm" />
              <span className="text-fg-muted">
                <span className="font-mono text-[11px] text-fg-subtle">{f.ruleId}</span> {f.message}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {deliverable && !anyMeasureChanged ? (
        <p className="text-[11.5px] text-fg-subtle">
          The three measures and the evidence-based RAG did not move: this change fixes record quality, and only evidence moves the measures. {terms.ragKinds.reported} RAG in the{' '}
          {terms.systems['portfolio-system'].toLowerCase()} is never changed.
        </p>
      ) : deliverable ? (
        <p className="text-[11.5px] text-fg-subtle">
          {terms.ragKinds.reported} RAG in the {terms.systems['portfolio-system'].toLowerCase()} is unchanged; only the computed view moved.
        </p>
      ) : null}
    </motion.section>
  );
}
