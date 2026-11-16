import { CircleSlash } from 'lucide-react';
import type { ReactNode } from 'react';
import { terms } from '@/lib/config/terminology';
import type { AcceptedOutcomes, Computable, ReadinessAssessment, WorkCompletion } from '@/lib/types';
import { cx } from './cx';
import { ProgressBar } from './ProgressBar';
import { ReadinessPill } from './StatusPills';
import { TONE } from './status';

export interface MeasureTripleProps {
  workCompletion: Computable<WorkCompletion>;
  acceptedOutcomes: Computable<AcceptedOutcomes>;
  readiness: ReadinessAssessment;
  /** Planned work completion today (0..100), drawn as a marker on the progress bar. */
  plannedPercent?: number;
  /** Smaller figures, for table rows and drawers. */
  compact?: boolean;
  /** Drops the outer outline (when already inside a Card). */
  bare?: boolean;
  className?: string;
}

function NotComputable({ detail }: { detail: string }) {
  return (
    <>
      <div className="flex items-center gap-2 text-fg-muted">
        <CircleSlash aria-hidden className="size-5 text-status-unknown" strokeWidth={1.9} />
        <span className="font-display text-lg font-semibold">{terms.measures.notComputable}</span>
      </div>
      <p className="text-xs text-fg-muted">{detail}</p>
    </>
  );
}

function Cell({ label, children, compact }: { label: string; children: ReactNode; compact?: boolean }) {
  return (
    <div className={cx('flex min-w-0 flex-col', compact ? 'gap-2 p-3.5' : 'gap-3 p-5')}>
      <div className="di-eyebrow">{label}</div>
      {children}
    </div>
  );
}

/**
 * The three measures side by side, always together and never derived from each other:
 * work completion %, accepted outcomes (count and %), delivery readiness (a state, never a percentage).
 * A `Computable` that cannot be computed shows the terminology label and the engine's explanation,
 * never zero.
 *
 *   <MeasureTriple workCompletion={m.workCompletion} acceptedOutcomes={m.acceptedOutcomes} readiness={m.readiness} />
 */
export function MeasureTriple({ workCompletion, acceptedOutcomes, readiness, plannedPercent, compact, bare, className }: MeasureTripleProps) {
  const figure = compact ? 'text-[26px]' : 'text-[38px]';
  const evidenceCounts: Array<{ key: string; label: string; n: number; tone: 'red' | 'amber' | 'unknown' }> = [
    { key: 'failing', label: terms.evidenceResults.fail, n: readiness.failing.length, tone: 'red' },
    { key: 'missing', label: terms.evidenceHeld.missing, n: readiness.missing.length, tone: 'unknown' },
    { key: 'stale', label: terms.evidenceHeld.stale, n: readiness.stale.length, tone: 'amber' },
  ];
  const held = readiness.held.filter((h) => h.state === 'passing').length;

  return (
    <div
      className={cx(
        'grid grid-cols-1 divide-y divide-line md:grid-cols-3 md:divide-x md:divide-y-0',
        !bare && 'di-card',
        className,
      )}
    >
      <Cell label={terms.measures.workCompletion} compact={compact}>
        {workCompletion.computable ? (
          <>
            <div className={cx('font-display leading-none font-semibold tracking-tight text-title tabular-nums', figure)}>
              {workCompletion.value.percent}
              <span className="ml-0.5 text-[0.5em] font-medium text-fg-muted">%</span>
            </div>
            <ProgressBar value={workCompletion.value.percent} target={plannedPercent} targetLabel="Planned" ariaLabel={terms.measures.workCompletion} />
            <p className="text-xs text-fg-muted tabular-nums">
              {workCompletion.value.closedPoints} of {workCompletion.value.totalPoints} points closed
            </p>
          </>
        ) : (
          <NotComputable detail={workCompletion.detail} />
        )}
      </Cell>

      <Cell label={terms.measures.acceptedOutcomes} compact={compact}>
        {acceptedOutcomes.computable ? (
          <>
            <div className={cx('font-display leading-none font-semibold tracking-tight text-title tabular-nums', figure)}>
              {acceptedOutcomes.value.acceptedCount}
              <span className="ml-1 text-[0.5em] font-medium text-fg-muted">of {acceptedOutcomes.value.totalCount}</span>
            </div>
            <ProgressBar value={acceptedOutcomes.value.percent} ariaLabel={terms.measures.acceptedOutcomes} />
            <p className="text-xs text-fg-muted tabular-nums">{acceptedOutcomes.value.percent}% of outcome weight accepted</p>
          </>
        ) : (
          <NotComputable detail={acceptedOutcomes.detail} />
        )}
      </Cell>

      <Cell label={terms.measures.readiness} compact={compact}>
        <div className="flex">
          <ReadinessPill state={readiness.state} size={compact ? 'md' : 'lg'} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted tabular-nums">
          {readiness.requiredEvidence.length > 0 ? (
            <span>
              {held} of {readiness.requiredEvidence.length} {terms.evidenceHeld.passing.toLowerCase()}
            </span>
          ) : null}
          {evidenceCounts
            .filter((c) => c.n > 0)
            .map((c) => (
              <span key={c.key} className={cx('font-medium', TONE[c.tone].text)}>
                {c.label} {c.n}
              </span>
            ))}
        </div>
      </Cell>
    </div>
  );
}
