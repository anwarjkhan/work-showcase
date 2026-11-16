'use client';

import { arc, pie } from 'd3-shape';
import { cx } from '../ui/cx';
import { fmt } from './format';
import { Legend } from './Legend';
import { CHART_FONT, CHART_TEXT, CHART_TEXT_STRONG, type Segment } from './palette';

export interface DonutProps {
  segments: Segment[];
  /** Diameter in px at full size; scales down inside narrow containers. */
  size?: number;
  /** Ring thickness in px. */
  thickness?: number;
  /** Large centre figure, e.g. the total. */
  centerValue?: string | number;
  /** Small centre caption, e.g. "deliverables". */
  centerLabel?: string;
  /** Where the legend goes. Default `right`, which wraps below when narrow. */
  legend?: 'right' | 'bottom' | 'none';
  ariaLabel?: string;
  className?: string;
}

/**
 * Ring chart with a centre label and a legend.
 *
 *   <Donut segments={ragSegments(counts)} centerValue={26} centerLabel="deliverables" />
 */
export function Donut({ segments, size = 168, thickness = 20, centerValue, centerLabel, legend = 'right', ariaLabel, className }: DonutProps) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  const outer = size / 2 - 1;
  const inner = Math.max(0, outer - thickness);
  const active = segments.filter((s) => s.value > 0).length;
  const slices = pie<Segment>()
    .sort(null)
    .value((s) => Math.max(0, s.value))
    .padAngle(active > 1 ? 0.02 : 0)(segments);
  const arcGen = arc<(typeof slices)[number]>().innerRadius(inner).outerRadius(outer).cornerRadius(2);
  const c = size / 2;
  const valueSize = Math.round(size * 0.2);

  return (
    <div className={cx('flex flex-wrap items-center gap-x-6 gap-y-4', legend === 'bottom' && 'flex-col items-stretch', className)}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={ariaLabel ?? segments.map((s) => `${s.label}: ${s.value}`).join(', ')}
        className="mx-auto block shrink-0"
        style={{ width: size, maxWidth: '100%', height: 'auto' }}
      >
        <circle cx={c} cy={c} r={(outer + inner) / 2} fill="none" stroke="var(--di-inset)" strokeWidth={outer - inner} />
        <g transform={`translate(${c} ${c})`}>
          {total > 0
            ? slices.map((s) =>
                s.data.value > 0 ? (
                  <path key={s.data.id} d={arcGen(s) ?? ''} fill={s.data.color}>
                    <title>{`${s.data.label}: ${s.data.value}`}</title>
                  </path>
                ) : null,
              )
            : null}
        </g>
        {centerValue !== undefined ? (
          <text
            x={c}
            y={centerLabel ? c - 1 : c}
            textAnchor="middle"
            dominantBaseline={centerLabel ? 'auto' : 'central'}
            fill={CHART_TEXT_STRONG}
            style={{ fontFamily: 'var(--di-font-display)', fontSize: valueSize, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
          >
            {centerValue}
          </text>
        ) : null}
        {centerLabel ? (
          <text x={c} y={c + 15} textAnchor="middle" fill={CHART_TEXT} style={{ fontFamily: CHART_FONT, fontSize: 11 }}>
            {centerLabel}
          </text>
        ) : null}
      </svg>
      {legend !== 'none' ? (
        <Legend
          layout="column"
          className="min-w-[140px] flex-1"
          items={segments.map((s) => ({
            id: s.id,
            label: s.label,
            color: s.color,
            icon: s.icon,
            value: fmt.number(s.value),
            detail: total > 0 ? fmt.percent((s.value / total) * 100) : undefined,
          }))}
        />
      ) : null}
    </div>
  );
}
