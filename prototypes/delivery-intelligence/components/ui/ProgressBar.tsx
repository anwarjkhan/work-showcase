import { cx } from './cx';
import { TONE, type StatusTone } from './status';

export interface ProgressBarProps {
  /** 0..100. `null` renders an empty track (use for not-computable values). */
  value: number | null;
  /** Marker position 0..100, e.g. the planned percentage today. */
  target?: number;
  /** Text for the marker, shown as its tooltip and in the accessible description. */
  targetLabel?: string;
  /** Bar colour. Defaults to the accent; use a status tone only when it carries meaning. */
  tone?: 'accent' | StatusTone;
  size?: 'sm' | 'md';
  /** Accessible name, e.g. "Work completion". */
  ariaLabel: string;
  className?: string;
}

/**
 * Thin progress track with an optional target marker.
 *
 *   <ProgressBar value={82} target={90} targetLabel="Planned today" ariaLabel="Work completion" />
 */
export function ProgressBar({ value, target, targetLabel, tone = 'accent', size = 'md', ariaLabel, className }: ProgressBarProps) {
  const pct = value === null ? 0 : Math.min(100, Math.max(0, value));
  const h = size === 'sm' ? 'h-1.5' : 'h-2';
  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value === null ? undefined : Math.round(pct)}
      aria-valuetext={
        value === null ? undefined : `${Math.round(pct)}%${target !== undefined ? `, ${targetLabel ?? 'target'} ${Math.round(target)}%` : ''}`
      }
      className={cx('relative w-full rounded-pill bg-inset', h, className)}
    >
      <div
        className={cx('h-full rounded-pill transition-[width] duration-(--di-duration-slow) ease-emphasis', tone === 'accent' ? 'bg-accent' : TONE[tone].fill)}
        style={{ width: `${pct}%` }}
      />
      {target !== undefined ? (
        <span
          title={targetLabel ? `${targetLabel}: ${Math.round(target)}%` : undefined}
          aria-hidden
          className="absolute top-1/2 h-[calc(100%+6px)] w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-pill bg-title"
          style={{ left: `${Math.min(100, Math.max(0, target))}%` }}
        />
      ) : null}
    </div>
  );
}
