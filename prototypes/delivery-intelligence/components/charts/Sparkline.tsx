'use client';

import { area, curveMonotoneX, line } from 'd3-shape';
import { scaleLinear } from 'd3-scale';
import { useId } from 'react';
import { cx } from '../ui/cx';
import { useElementSize } from './useElementSize';

export interface SparklineProps {
  values: number[];
  /** Pixel height. Width follows the container. */
  height?: number;
  /** Line colour: a CSS colour or token, default chart-1. */
  color?: string;
  /** Soft area fill under the line. */
  fill?: boolean;
  /** Emphasised end point. */
  endPoint?: boolean;
  /** Accessible description, e.g. "Work completion, last 12 weeks, rising". */
  ariaLabel?: string;
  className?: string;
}

/**
 * Tiny trend line with area fill and an emphasised last point. Fills its container's width.
 *
 *   <div className="w-28"><Sparkline values={[12, 18, 15, 22, 30]} ariaLabel="Trend" /></div>
 */
export function Sparkline({ values, height = 32, color = 'var(--di-chart-1)', fill = true, endPoint = true, ariaLabel, className }: SparklineProps) {
  const { ref, width } = useElementSize<HTMLDivElement>();
  const gid = `spark-${useId().replace(/:/g, '')}`;
  const pad = 4; // room for the end point and stroke, so nothing leaves the bounds
  const innerW = Math.max(0, width - pad * 2);

  let body = null;
  if (width > 0 && values.length > 0) {
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const x = scaleLinear().domain([0, Math.max(1, values.length - 1)]).range([pad, pad + innerW]);
    const y = scaleLinear()
      .domain(lo === hi ? [lo - 1, hi + 1] : [lo, hi])
      .range([height - pad, pad]);
    const pts: Array<[number, number]> = values.map((v, i) => [values.length === 1 ? pad + innerW / 2 : x(i), y(v)]);
    const linePath = line<[number, number]>().curve(curveMonotoneX)(pts) ?? '';
    const areaPath =
      area<[number, number]>()
        .x((d) => d[0])
        .y0(height - pad / 2)
        .y1((d) => d[1])
        .curve(curveMonotoneX)(pts) ?? '';
    const last = pts[pts.length - 1];
    body = (
      <>
        {fill ? (
          <>
            <defs>
              <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.22" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={areaPath} fill={`url(#${gid})`} />
          </>
        ) : null}
        <path d={linePath} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        {endPoint && last ? (
          <>
            <circle cx={last[0]} cy={last[1]} r="3.5" fill={color} opacity="0.2" />
            <circle cx={last[0]} cy={last[1]} r="2.25" fill={color} stroke="var(--di-surface)" strokeWidth="1" />
          </>
        ) : null}
      </>
    );
  }

  return (
    <div ref={ref} className={cx('w-full', className)} style={{ height }}>
      {width > 0 ? (
        <svg width={width} height={height} role="img" aria-label={ariaLabel ?? 'Trend'} className="block overflow-hidden">
          {body}
        </svg>
      ) : null}
    </div>
  );
}
