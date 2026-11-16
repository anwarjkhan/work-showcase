import { ArrowLeftRight } from 'lucide-react';

/** Two-way link between neighbouring stages: work can move forward or back. */
export function Connector({ from, to }: { from: string; to: string }) {
  return (
    <div
      role="img"
      aria-label={`Two-way movement between ${from} and ${to}`}
      className="hidden items-start justify-center pt-24 xl:flex"
    >
      <div className="flex flex-col items-center gap-1 text-accent">
        <span className="h-10 w-px bg-accent-line" aria-hidden />
        <span className="flex size-7 items-center justify-center rounded-pill border border-accent-line bg-accent-soft">
          <ArrowLeftRight aria-hidden className="size-3.5" strokeWidth={2.2} />
        </span>
        <span className="h-10 w-px bg-accent-line" aria-hidden />
      </div>
    </div>
  );
}
