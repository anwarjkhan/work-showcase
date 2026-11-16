'use client';

import { scaleLinear } from 'd3-scale';
import { useId } from 'react';
import { cx } from '../ui/cx';
import { fmt } from './format';
import { Legend } from './Legend';
import type { Segment } from './palette';
import { useElementSize } from './useElementSize';

const HEIGHT = { sm: 8, md: 12, lg: 18 } as const;
const GAP = 2;

export interface StackedBarProps {
  segments: Segment[];
  size?: keyof typeof HEIGHT;
  /** Legend with counts and shares under the bar. Default true. */
  legend?: boolean;
  /** Show the percentage share beside each legend count. Default true. */
  showShare?: boolean;
  /** Accessible summary; defaults to a list of "label: value". */
  ariaLabel?: string;
  className?: string;
}

/**
 * Horizontal part-to-whole bar for RAG, stage or readiness distributions.
 * Segment lengths share one linear scale; the legend lists exact counts.
 *
 *   <StackedBar segments={ragSegments(counts)} />
 *   <StackedBar size="sm" legend={false} segments={[{ id: 'a', label: 'Design', value: 4, color: chartColor(0) }]} />
 */
export function StackedBar({ segments, size = 'md', legend = true, showShare = true, ariaLabel, className }: StackedBarProps) {
  const { ref, width } = useElementSize<HTMLDivElement>();
  const clipId = `sb-${useId().replace(/:/g, '')}`;
  const h = HEIGHT[size];
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  const x = scaleLinear().domain([0, total || 1]).range([0, width]);

  const visible = segments.filter((s) => s.value > 0);
  const marks = visible.map((s, i) => {
    const before = visible.slice(0, i).reduce((sum, v) => sum + v.value, 0);
    return { s, x0: x(before), x1: x(before + s.value) };
  });

  const summary = ariaLabel ?? segments.map((s) => `${s.label}: ${s.value}`).join(', ');

  return (
    <div className={cx('flex w-full flex-col gap-2.5', className)}>
      <div ref={ref} className="w-full" style={{ height: h }}>
        {width > 0 ? (
          <svg width={width} height={h} role="img" aria-label={summary} className="block">
            <defs>
              <clipPath id={clipId}>
                <rect x="0" y="0" width={width} height={h} rx={h / 2} />
              </clipPath>
            </defs>
            <g clipPath={`url(#${clipId})`}>
              <rect x="0" y="0" width={width} height={h} fill="var(--di-inset)" />
              {marks.map(({ s, x0, x1 }, i) => (
                <rect
                  key={s.id}
                  x={x0}
                  y={0}
                  width={Math.max(0, x1 - x0 - (i < marks.length - 1 ? GAP : 0))}
                  height={h}
                  fill={s.color}
                  style={{ transition: 'x var(--di-duration-slow) var(--di-ease-standard), width var(--di-duration-slow) var(--di-ease-standard)' }}
                >
                  <title>{`${s.label}: ${s.value}`}</title>
                </rect>
              ))}
            </g>
          </svg>
        ) : null}
      </div>
      {legend ? (
        <Legend
          items={segments.map((s) => ({
            id: s.id,
            label: s.label,
            color: s.color,
            icon: s.icon,
            value: fmt.number(s.value),
            detail: showShare && total > 0 ? fmt.percent((s.value / total) * 100) : undefined,
          }))}
        />
      ) : null}
    </div>
  );
}
