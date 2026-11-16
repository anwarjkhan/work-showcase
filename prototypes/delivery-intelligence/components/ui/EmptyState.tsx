import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from './cx';

export interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  /** A lucide icon element. Defaults to an inbox. */
  icon?: ReactNode;
  /** Usually a Button. */
  action?: ReactNode;
  /** `inline` has no dashed outline (inside tables and cards). */
  variant?: 'boxed' | 'inline';
  className?: string;
}

/**
 * "Nothing here" message that says why and what to do.
 *
 *   <EmptyState title="No findings" description="Every rule passed for this deliverable." />
 */
export function EmptyState({ title, description, icon, action, variant = 'boxed', className }: EmptyStateProps) {
  return (
    <div
      className={cx(
        'flex flex-col items-center justify-center gap-3 px-6 py-10 text-center',
        variant === 'boxed' && 'rounded-lg border border-dashed border-line-strong bg-surface-2',
        className,
      )}
    >
      <span aria-hidden className="inline-flex size-10 items-center justify-center rounded-full border border-line bg-surface text-fg-subtle [&>svg]:size-5">
        {icon ?? <Inbox />}
      </span>
      <div className="max-w-sm">
        <p className="font-display text-sm font-semibold text-title">{title}</p>
        {description ? <p className="mt-1 text-[13px] text-fg-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
