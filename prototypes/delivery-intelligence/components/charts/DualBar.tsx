'use client';

import { scaleLinear } from 'd3-scale';
import { ArrowDownRight, ArrowUpRight, Equal } from 'lucide-react';
import { cx } from '../ui/cx';
import { uiText } from '../ui/labels';
import { TONE } from '../ui/status';
import { fmt } from './format';
import { Legend } from './Legend';
import { useElementSize } from './useElementSize';

export interface DualBarRow {
  id?: string;
  label: string;
  baseline: number;
  assisted: number;
  /** Unit appended to the values, e.g. "h" or "days". */
  unit?: string;
}

export interface DualBarProps {
  rows: DualBarRow[];
  /** `row`: each row has its own scale (mixed units). `shared`: one scale for all rows. */
  scale?: 'row' | 'shared';
  /** Smaller is better (effort, defects): a drop is shown as an improvement. Default true. */
  lowerIsBetter?: boolean;
  baselineLabel?: string;
  assistedLabel?: string;
  /** Value formatter. */
  format?: (n: number) => string;
  className?: string;
}

const BAR = 8;
const GAP = 4;

/**
 * Baseline against assisted, bullet-style: two thin bars per row on one scale, values and the
 * change in text above. The change always has an arrow shape and a signed figure.
 *
 *   <DualBar rows={[{ label: 'Weekly status', baseline: 6, assisted: 2.5, unit: 'h' }]} />
 */
export function DualBar({ rows, scale = 'row', lowerIsBetter = true, baselineLabel = uiText.baseline, assistedLabel = uiText.assisted, format = (n) => fmt.number(n, 1), className }: DualBarProps) {
  const { ref, width } = useElementSize<HTMLDivElement>();
  const sharedMax = Math.max(1, ...rows.flatMap((r) => [r.baseline, r.assisted]));

  return (
    <div className={cx('flex w-full flex-col gap-4', className)}>
      <div ref={ref} className="flex w-full flex-col gap-4">
        {rows.map((row, i) => {
          const max = scale === 'shared' ? sharedMax : Math.max(1, row.baseline, row.assisted);
          const x = scaleLinear().domain([0, max]).range([0, width]);
          const change = row.baseline === 0 ? 0 : ((row.assisted - row.baseline) / row.baseline) * 100;
          const better = lowerIsBetter ? change < 0 : change > 0;
          const tone = change === 0 ? 'unknown' : better ? 'green' : 'red';
          const Icon = change === 0 ? Equal : change < 0 ? ArrowDownRight : ArrowUpRight;
          const unit = row.unit ? ` ${row.unit}` : '';
          return (
            <div key={row.id ?? `${row.label}-${i}`} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-[13px] font-medium text-fg">{row.label}</span>
                <span className="flex shrink-0 items-center gap-2 text-xs tabular-nums text-fg-muted">
                  <span>{`${format(row.baseline)}${unit}`}</span>
                  <span aria-hidden className="text-fg-subtle">→</span>
                  <span className="font-semibold text-fg">{`${format(row.assisted)}${unit}`}</span>
                  <span className={cx('inline-flex items-center gap-0.5 font-semibold', TONE[tone].text)}>
                    <Icon aria-hidden className={cx('size-3.5', TONE[tone].icon)} strokeWidth={2.4} />
                    {fmt.delta(change, { percent: true })}
                  </span>
                </span>
              </div>
              {width > 0 ? (
                <svg
                  width={width}
                  height={BAR * 2 + GAP}
                  role="img"
                  aria-label={`${row.label}: ${baselineLabel} ${format(row.baseline)}${unit}, ${assistedLabel} ${format(row.assisted)}${unit}`}
                  className="block"
                >
                  <rect x="0" y="0" width={width} height={BAR} rx={BAR / 2} fill="var(--di-inset)" />
                  <rect x="0" y={BAR + GAP} width={width} height={BAR} rx={BAR / 2} fill="var(--di-inset)" />
                  <rect x="0" y="0" width={Math.max(0, x(row.baseline))} height={BAR} rx={BAR / 2} fill="var(--di-chart-6)" />
                  <rect x="0" y={BAR + GAP} width={Math.max(0, x(row.assisted))} height={BAR} rx={BAR / 2} fill="var(--di-chart-1)" />
                </svg>
              ) : (
                <div style={{ height: BAR * 2 + GAP }} />
              )}
            </div>
          );
        })}
      </div>
      <Legend
        items={[
          { label: baselineLabel, color: 'var(--di-chart-6)' },
          { label: assistedLabel, color: 'var(--di-chart-1)' },
        ]}
      />
    </div>
  );
}
