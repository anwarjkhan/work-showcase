import type { ReactNode } from 'react';
import { cx } from '../ui/cx';

export interface LegendItem {
  id?: string;
  label: string;
  /** Swatch colour (CSS colour or `var(--di-chart-1)`). Ignored when `icon` is given. */
  color?: string;
  /** Status shape or other mark shown in place of the swatch. */
  icon?: ReactNode;
  /** Trailing value, shown tabular and bold, e.g. a count. */
  value?: ReactNode;
  /** Muted secondary text after the value, e.g. a percentage. */
  detail?: ReactNode;
  /** Rounded line marker (for series lines) instead of a square swatch. */
  shape?: 'square' | 'circle' | 'line';
}

export interface LegendProps {
  items: LegendItem[];
  /** `row` wraps horizontally; `column` stacks with values aligned right. */
  layout?: 'row' | 'column';
  className?: string;
}

/**
 * Chart legend. Items with an `icon` (status shapes) keep status readable without colour.
 *
 *   <Legend items={[{ label: 'Green', color: 'var(--di-status-green)', value: 12 }]} />
 */
export function Legend({ items, layout = 'row', className }: LegendProps) {
  return (
    <ul className={cx(layout === 'row' ? 'flex flex-wrap gap-x-4 gap-y-1.5' : 'flex flex-col gap-2', 'm-0 list-none p-0 text-xs text-fg-muted', className)}>
      {items.map((item, i) => (
        <li key={item.id ?? `${item.label}-${i}`} className={cx('flex items-center gap-2', layout === 'column' && 'justify-between gap-4')}>
          <span className="flex min-w-0 items-center gap-1.5">
            {item.icon ?? (
              <span
                aria-hidden
                className={cx('inline-block shrink-0', item.shape === 'circle' ? 'size-2.5 rounded-full' : item.shape === 'line' ? 'h-0.5 w-3.5 rounded-full' : 'size-2.5 rounded-xs')}
                style={{ background: item.color }}
              />
            )}
            <span className="truncate">{item.label}</span>
          </span>
          {item.value !== undefined || item.detail !== undefined ? (
            <span className="flex shrink-0 items-baseline gap-1.5 tabular-nums">
              {item.value !== undefined ? <span className="font-semibold text-fg">{item.value}</span> : null}
              {item.detail !== undefined ? <span className="text-fg-subtle">{item.detail}</span> : null}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
