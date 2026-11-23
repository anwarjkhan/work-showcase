'use client';

import { ChevronLeft, ChevronRight, Presentation, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button, IconButton } from '@/components/ui';
import { DEMO_STEPS } from '@/lib/config/demo-script';
import { useLabelsMode } from '@/components/shell/labels';
import { useResetDemo } from '@/lib/store';
import { demoStore } from './demo-state';
import { useDemoController } from './useDemoController';

/**
 * Top-bar control: "Start guided demo" when idle; step indicator, previous,
 * next and exit while running. Starting offers to reset first.
 */
export function DemoControl() {
  const { state, start, prev, next, exit } = useDemoController();
  const reset = useResetDemo();
  const [labels, setLabels] = useLabelsMode();
  const [asking, setAsking] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close the question on Escape or a click elsewhere.
  useEffect(() => {
    if (!asking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAsking(false);
    };
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAsking(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [asking]);

  const total = DEMO_STEPS.length;

  if (state.running) {
    return (
      <div data-testid="demo-control" className="flex h-8 max-w-[320px] items-center gap-1 rounded-pill border border-accent-line bg-accent-soft pr-1 pl-3">
        <span data-testid="demo-step-indicator" className="text-xs font-semibold whitespace-nowrap text-accent" aria-live="polite">
          Step {state.step + 1} of {total}
        </span>
        <IconButton label="Previous step" icon={<ChevronLeft />} size="sm" disabled={state.step === 0} onClick={prev} className="size-6" />
        <IconButton label="Next step" icon={<ChevronRight />} size="sm" disabled={state.step >= total - 1} onClick={next} className="size-6" />
        <IconButton label="Exit guided demo" icon={<X />} size="sm" onClick={exit} className="size-6" />
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <Button
        variant="secondary"
        size="sm"
        icon={<Presentation />}
        aria-haspopup="dialog"
        aria-expanded={asking}
        data-testid="demo-start"
        onClick={() => setAsking((v) => !v)}
        className="h-8 rounded-pill"
      >
        Start guided demo
      </Button>
      {asking ? (
        <div
          role="dialog"
          aria-label="Start guided demo"
          data-testid="demo-start-dialog"
          className="absolute top-full right-0 z-50 mt-2 w-[300px] rounded-lg border border-line-strong bg-surface p-4 shadow-overlay"
        >
          <p className="text-sm font-semibold text-fg">Reset the demo first?</p>
          <p className="mt-1 text-xs text-fg-muted">
            Resetting restores the seeded data and clears agent runs, approvals and the audit trail, so every run starts from the same state.
          </p>
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-fg">
            <input
              type="checkbox"
              data-testid="demo-start-labels"
              checked={labels === 'on'}
              onChange={(e) => setLabels(e.target.checked ? 'on' : 'off')}
              className="size-3.5 accent-[var(--di-accent)]"
            />
            Labels on
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="sm"
              autoFocus
              data-testid="demo-start-reset"
              onClick={() => {
                reset();
                setAsking(false);
                start();
              }}
            >
              Reset and start
            </Button>
            <Button
              variant="secondary"
              size="sm"
              data-testid="demo-start-keep"
              onClick={() => {
                setAsking(false);
                start();
              }}
            >
              Start without reset
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Re-exported for tests of the store.
export { demoStore };
