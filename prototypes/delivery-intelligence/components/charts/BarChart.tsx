'use client';

import { scaleBand, scaleLinear } from 'd3-scale';
import { cx } from '../ui/cx';
import { estimateTextWidth, fitLabel, fmt } from './format';
import { CHART_AXIS, CHART_FONT, CHART_GRID, CHART_TEXT, chartColor } from './palette';
import { useElementSize } from './useElementSize';

export interface BarDatum {
  id?: string;
  label: string;
  value: number;
  /** Per-bar colour; defaults to the chart colour. */
  color?: string;
}

export interface BarChartProps {
  data: BarDatum[];
  height?: number;
  /** Default colour for bars without their own. */
  color?: string;
  /** Fix the top of the value axis (e.g. 100 for percentages). Otherwise "nice" from the data. */
  max?: number;
  /** Number of horizontal grid lines (approximate). */
  ticks?: number;
  /** Axis and value-label formatter. */
  format?: (n: number) => string;
  /** Print each bar's value above it. Default true. */
  valueLabels?: boolean;
  ariaLabel?: string;
  className?: string;
}

const FONT = 11;

/**
 * Vertical bar chart with faint grid and axis labels. Values are non-negative.
 * Bars, ticks and labels share one band scale and one linear scale, and stay inside the plot area.
 *
 *   <BarChart data={[{ label: 'Q1', value: 8 }, { label: 'Q2', value: 12 }]} ariaLabel="Deliverables per quarter" />
 */
export function BarChart({ data, height = 220, color = chartColor(0), max, ticks = 4, format = (n) => fmt.number(n), valueLabels = true, ariaLabel, className }: BarChartProps) {
  const { ref, width } = useElementSize<HTMLDivElement>();
  const top = valueLabels ? 20 : 10;
  const bottom = 26;
  const right = 8;

  let body = null;
  if (width > 0 && data.length > 0) {
    const dataMax = Math.max(0, ...data.map((d) => d.value));
    const y = scaleLinear()
      .domain([0, max ?? Math.max(1, dataMax)])
      .range([height - bottom, top]);
    if (max === undefined) y.nice(ticks);
    const tickValues = y.ticks(ticks);
    const tickLabels = tickValues.map((t) => format(t));
    const left = Math.max(...tickLabels.map((t) => estimateTextWidth(t, FONT))) + 12;
    const x = scaleBand<number>()
      .domain(data.map((_, i) => i))
      .range([left, Math.max(left + 1, width - right)])
      .paddingInner(0.3)
      .paddingOuter(0.15);
    const bw = x.bandwidth();
    const step = x.step();
    const labelEvery = Math.max(1, Math.ceil(estimateTextWidth('MMMM', FONT) / Math.max(1, step)));
    const base = y(0);

    body = (
      <>
        {tickValues.map((t, i) => (
          <g key={t}>
            <line x1={left} x2={width - right} y1={y(t)} y2={y(t)} stroke={CHART_GRID} strokeWidth="1" strokeDasharray={t === 0 ? undefined : '2 3'} />
            <text x={left - 8} y={y(t)} textAnchor="end" dominantBaseline="central" fill={CHART_AXIS} style={{ fontFamily: CHART_FONT, fontSize: FONT, fontVariantNumeric: 'tabular-nums' }}>
              {tickLabels[i]}
            </text>
          </g>
        ))}
        <line x1={left} x2={width - right} y1={base} y2={base} stroke={CHART_AXIS} strokeOpacity="0.55" strokeWidth="1" />
        {data.map((d, i) => {
          const bx = x(i) ?? left;
          const by = y(Math.min(d.value, y.domain()[1] ?? d.value));
          const bh = Math.max(0, base - by);
          const r = Math.min(4, bw / 2, bh);
          const path = `M${bx},${base} V${by + r} Q${bx},${by} ${bx + r},${by} H${bx + bw - r} Q${bx + bw},${by} ${bx + bw},${by + r} V${base} Z`;
          return (
            <g key={d.id ?? `${d.label}-${i}`}>
              {bh > 0 ? (
                <path d={path} fill={d.color ?? color}>
                  <title>{`${d.label}: ${format(d.value)}`}</title>
                </path>
              ) : null}
              {valueLabels && bw >= 18 ? (
                <text x={bx + bw / 2} y={Math.max(by, top) - 5} textAnchor="middle" fill={CHART_TEXT} style={{ fontFamily: CHART_FONT, fontSize: FONT, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {format(d.value)}
                </text>
              ) : null}
              {i % labelEvery === 0 ? (
                <text x={bx + bw / 2} y={base + 16} textAnchor="middle" fill={CHART_AXIS} style={{ fontFamily: CHART_FONT, fontSize: FONT }}>
                  {fitLabel(d.label, step * labelEvery - 4, FONT)}
                </text>
              ) : null}
            </g>
          );
        })}
      </>
    );
  }

  return (
    <div ref={ref} className={cx('w-full', className)} style={{ height }}>
      {width > 0 ? (
        <svg width={width} height={height} role="img" aria-label={ariaLabel ?? data.map((d) => `${d.label}: ${d.value}`).join(', ')} className="block overflow-hidden">
          {body}
        </svg>
      ) : null}
    </div>
  );
}
