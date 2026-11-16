import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ProvenanceBadge } from '@/components/shell/ProvenanceBadge';
import type { Provenance } from '@/lib/types';
import { Sparkline } from '../charts/Sparkline';
import { cx, FOCUS_RING } from './cx';
import { TONE } from './status';

export interface StatDelta {
  /** Already formatted, e.g. "+4" or "−2.5 pts". */
  value: string;
  direction: 'up' | 'down' | 'flat';
  /** Whether this direction is good news. Colour follows this, the arrow shows direction. */
  sentiment?: 'good' | 'bad' | 'neutral';
  /** What it is relative to, e.g. "vs last week". */
  context?: string;
}

export interface StatTileProps {
  label: string;
  /** The large figure. Use tabular numbers (done for you); pass text like "1 of 4" if needed. */
  value: ReactNode;
  /** Small unit after the value, e.g. "%" or "days". */
  unit?: string;
  delta?: StatDelta;
  /** One line under the figure. */
  caption?: ReactNode;
  /** Trend values for a sparkline in the corner. */
  spark?: number[];
  sparkLabel?: string;
  /** Marks where the figure comes from. Required for anything scripted, simulated or planned. */
  provenance?: Provenance;
  /** Optional leading icon element. */
  icon?: ReactNode;
  /** Makes the tile a link. */
  href?: string;
  /** Makes the tile a button. */
  onClick?: () => void;
  className?: string;
}

const DELTA_ICON = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus } as const;

/**
 * Headline figure with label, change, caption, optional sparkline and provenance.
 *
 *   <StatTile label="Deliverables" value={26} delta={{ value: '+2', direction: 'up', sentiment: 'neutral', context: 'this quarter' }} spark={[18, 20, 22, 26]} provenance="computed" />
 */
export function StatTile({ label, value, unit, delta, caption, spark, sparkLabel, provenance, icon, href, onClick, className }: StatTileProps) {
  const interactive = Boolean(href || onClick);
  const DeltaIcon = delta ? DELTA_ICON[delta.direction] : null;
  const deltaTone = delta?.sentiment === 'good' ? TONE.green : delta?.sentiment === 'bad' ? TONE.red : null;

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-[12.5px] font-medium text-fg-muted">
          {icon ? <span aria-hidden className="inline-flex shrink-0 text-fg-subtle [&>svg]:size-4">{icon}</span> : null}
          <span className="truncate">{label}</span>
        </div>
        {provenance ? <ProvenanceBadge kind={provenance} size="sm" /> : null}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-[32px] leading-none font-semibold tracking-tight text-title tabular-nums max-[1535px]:text-[28px]">{value}</span>
            {unit ? <span className="text-sm font-medium text-fg-muted">{unit}</span> : null}
          </div>
          {delta || caption ? (
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
              {delta && DeltaIcon ? (
                <span className={cx('inline-flex items-center gap-0.5 font-semibold tabular-nums', deltaTone ? deltaTone.text : 'text-fg-muted')}>
                  <DeltaIcon aria-hidden className={cx('size-3.5', deltaTone ? deltaTone.icon : 'text-fg-subtle')} strokeWidth={2.4} />
                  {delta.value}
                  {delta.context ? <span className="ml-1 font-normal text-fg-subtle">{delta.context}</span> : null}
                </span>
              ) : null}
              {caption ? <span className="text-fg-muted">{caption}</span> : null}
            </div>
          ) : null}
        </div>
        {spark && spark.length > 1 ? (
          <div className="w-24 shrink-0 self-end">
            <Sparkline values={spark} height={36} ariaLabel={sparkLabel ?? `${label} trend`} />
          </div>
        ) : null}
      </div>
    </>
  );

  const classes = cx(
    'di-card flex min-w-0 flex-col justify-between gap-4 p-4 text-left',
    interactive && cx('cursor-pointer transition-[border-color,box-shadow] duration-(--di-duration-fast) ease-standard hover:border-accent-line hover:shadow-raised', FOCUS_RING),
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {content}
      </button>
    );
  }
  return <div className={classes}>{content}</div>;
}
