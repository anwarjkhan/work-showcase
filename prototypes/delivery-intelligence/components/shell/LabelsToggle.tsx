'use client';

import { Tags } from 'lucide-react';
import { useEffect } from 'react';
import { Tooltip } from '@/components/ui/Tooltip';
import { isTypingTarget, useLabelsMode } from './labels';

/**
 * Small quiet toggle for provenance labels and demo notes. The tooltip and the
 * accessible name both state the current mode ("Labels on" or "Labels off").
 * Shift+L toggles it from anywhere except a text field.
 */
export function LabelsToggle() {
  const [mode, setMode] = useLabelsMode();
  const on = mode === 'on';
  const text = on ? 'Labels on' : 'Labels off';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'L' || !e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      setMode(document.documentElement.getAttribute('data-labels') === 'off' ? 'on' : 'off');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setMode]);

  return (
    <Tooltip content={text} side="bottom" delay={200}>
      <button
        type="button"
        data-testid="labels-toggle"
        aria-pressed={on}
        aria-label={text}
        onClick={() => setMode(on ? 'off' : 'on')}
        className={`grid size-7 place-items-center rounded-pill transition-colors duration-150 hover:text-fg focus-visible:shadow-focus focus-visible:outline-none ${
          on ? 'text-fg-muted' : 'text-fg-subtle'
        }`}
      >
        <Tags aria-hidden className={`size-4 ${on ? '' : 'opacity-50'}`} strokeWidth={1.9} />
      </button>
    </Tooltip>
  );
}
