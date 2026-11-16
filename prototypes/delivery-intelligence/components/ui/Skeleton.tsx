import { cx } from './cx';

/**
 * Loading placeholder block with a restrained shimmer (stopped under reduced motion).
 *
 *   <Skeleton className="h-4 w-32" />
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx('di-skeleton', className)} />;
}

/** Several skeleton lines, the last one shorter. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className={cx('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cx('h-3.5', i === lines - 1 && lines > 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}
