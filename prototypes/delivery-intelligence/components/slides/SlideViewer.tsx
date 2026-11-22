'use client';
/**
 * Full-size slide viewer: one slide at a time, as large as the window allows,
 * with previous and next buttons, Left/Right (and Home/End) keys, and a
 * "n of m" counter. Opened from any thumbnail (builder, basket, pack dialog).
 *
 *   const [at, setAt] = useState<number | null>(null);
 *   <DeckPreviewGrid deck={deck} onOpen={setAt} />
 *   <SlideViewer deck={deck} index={at} onIndex={setAt} />
 */
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { Button } from '@/components/ui';
import type { DeckSpec } from '@/lib/slides';
import { SlidePreview } from '@/lib/slides/render/html';
import { Dialog } from './Dialog';

export interface SlideViewerProps {
  /** The slides to page through; only `slides` and `footer` are used. */
  deck: Pick<DeckSpec, 'slides' | 'footer'>;
  /** 0-based slide shown; null closes the viewer. */
  index: number | null;
  onIndex: (index: number | null) => void;
  /** Slide number of the first slide, when the deck is part of a longer file. */
  firstNumber?: number;
}

export function SlideViewer({ deck, index, onIndex, firstNumber = 1 }: SlideViewerProps) {
  const count = deck.slides.length;
  const at = index === null ? null : Math.min(Math.max(index, 0), Math.max(count - 1, 0));
  const spec = at === null ? undefined : deck.slides[at];
  if (at === null || !spec) return null;

  const go = (next: number) => {
    const to = Math.min(Math.max(next, 0), count - 1);
    // A focused button that becomes disabled swallows keys (no arrows, no Escape). Before that
    // happens, hand focus to the dialog itself, which owns the key handling.
    const active = document.activeElement;
    if (active instanceof HTMLElement && ((to === count - 1 && active.dataset.testid === 'viewer-next') || (to === 0 && active.dataset.testid === 'viewer-prev'))) {
      active.closest<HTMLElement>('[role="dialog"]')?.focus();
    }
    onIndex(to);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    // Leave arrow keys alone in form fields; there are none in the viewer, but be safe.
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const to = e.key === 'ArrowLeft' ? at - 1 : e.key === 'ArrowRight' ? at + 1 : e.key === 'Home' ? 0 : e.key === 'End' ? count - 1 : null;
    if (to === null) return;
    e.preventDefault();
    go(to);
  };

  const number = firstNumber + at;
  return (
    <Dialog
      open
      size="xl"
      onClose={() => onIndex(null)}
      onKey={onKey}
      title={
        <span data-testid="viewer-title">
          <span className="mr-2 font-normal text-fg-muted tabular-nums">{`${at + 1} of ${count}`}</span>
          {spec.title}
        </span>
      }
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <p className="text-xs text-fg-muted">Use the arrow keys to move between slides.</p>
          <div className="flex items-center gap-2">
            <Button variant="secondary" icon={<ChevronLeft />} disabled={at === 0} onClick={() => go(at - 1)} data-testid="viewer-prev" data-autofocus={at === count - 1 && at > 0 ? true : undefined}>
              Previous
            </Button>
            <Button variant="secondary" disabled={at === count - 1} onClick={() => go(at + 1)} data-testid="viewer-next" data-autofocus={at < count - 1 ? true : undefined}>
              Next
              <ChevronRight aria-hidden className="size-4" />
            </Button>
          </div>
        </div>
      }
    >
      <div data-testid="slide-viewer" className="mx-auto" style={{ width: 'min(100%, calc((92vh - 150px) * 16 / 9))' }}>
        <SlidePreview spec={spec} footer={deck.footer} number={number} className="overflow-hidden rounded-md border border-line shadow-card" />
      </div>
    </Dialog>
  );
}
