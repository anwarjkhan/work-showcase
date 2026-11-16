'use client';

import { Check, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { terms } from '@/lib/config/terminology';
import { useResetDemo } from '@/lib/store';

/** Restores the seeded data and clears runs, proposals, approvals and the audit trail. */
export function ResetDemoButton() {
  const reset = useResetDemo();
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => setDone(false), 2200);
    return () => window.clearTimeout(t);
  }, [done]);

  return (
    <button
      type="button"
      data-testid="reset-demo"
      title={terms.shell.resetConfirm}
      onClick={() => {
        reset();
        setDone(true);
      }}
      className="inline-flex h-8 items-center gap-1.5 rounded-pill border border-line-strong bg-surface px-3 text-xs font-medium text-fg-muted transition-colors duration-150 hover:border-accent-line hover:text-accent"
    >
      {done ? <Check aria-hidden className="size-3.5 text-status-green" /> : <RotateCcw aria-hidden className="size-3.5" />}
      <span aria-live="polite">{done ? terms.shell.resetDone : terms.shell.resetDemo}</span>
    </button>
  );
}
