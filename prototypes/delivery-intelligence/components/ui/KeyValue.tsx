import type { ReactNode } from 'react';
import { cx } from './cx';

export interface KeyValueItem {
  label: ReactNode;
  value: ReactNode;
  /** Small helper line under the value. */
  hint?: ReactNode;
  /** Monospace value (ids, keys). */
  mono?: boolean;
}

export interface KeyValueProps {
  items: KeyValueItem[];
  /** `stacked`: label above value, in a grid of `columns`. `inline`: label left, value right, rules between. */
  layout?: 'stacked' | 'inline';
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}

const COLS = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' } as const;

/**
 * Definition list for record details.
 *
 *   <KeyValue columns={3} items={[{ label: 'Risk tier', value: 'T2 Moderate' }, { label: 'Epic', value: 'CCR-101', mono: true }]} />
 *   <KeyValue layout="inline" items={...} />
 */
export function KeyValue({ items, layout = 'stacked', columns = 2, className }: KeyValueProps) {
  if (layout === 'inline') {
    return (
      <dl className={cx('m-0 flex flex-col text-[13px]', className)}>
        {items.map((it, i) => (
          <div key={i} className="flex items-baseline justify-between gap-6 border-b border-line py-2 first:pt-0 last:border-b-0 last:pb-0">
            <dt className="shrink-0 text-fg-muted">{it.label}</dt>
            <dd className={cx('m-0 min-w-0 text-right text-fg tabular-nums', it.mono && 'font-mono text-xs')}>
              {it.value}
              {it.hint ? <span className="block text-xs text-fg-subtle">{it.hint}</span> : null}
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <dl className={cx('m-0 grid gap-x-6 gap-y-4', COLS[columns], className)}>
      {items.map((it, i) => (
        <div key={i} className="min-w-0">
          <dt className="di-eyebrow mb-1">{it.label}</dt>
          <dd className={cx('m-0 text-[13px] text-fg tabular-nums', it.mono && 'font-mono text-xs')}>
            {it.value}
            {it.hint ? <span className="block text-xs text-fg-subtle">{it.hint}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
