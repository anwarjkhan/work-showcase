'use client';
/**
 * Export state shared by the basket, the pack dialog and the builder:
 * idle, busy (while the deck is built and the library loads), done (file name
 * and slide count) or failed (the reason).
 */
import { useCallback, useState } from 'react';
import { downloadPptx } from '@/lib/slides/render/pptx';
import type { DeckSpec } from '@/lib/slides';

export type ExportState =
  | { phase: 'idle' }
  | { phase: 'busy' }
  | { phase: 'done'; fileName: string; slideCount: number; warnings: string[] }
  | { phase: 'failed'; reason: string };

export function useExport(): { state: ExportState; run: (make: () => DeckSpec) => Promise<void>; reset: () => void } {
  const [state, setState] = useState<ExportState>({ phase: 'idle' });
  const run = useCallback(async (make: () => DeckSpec) => {
    setState({ phase: 'busy' });
    try {
      const deck = make();
      if (deck.slides.length === 0) throw new Error('There are no slides to export.');
      // Let the busy state paint before the synchronous build starts.
      await new Promise((r) => window.setTimeout(r, 30));
      const out = await downloadPptx(deck);
      setState({ phase: 'done', ...out });
    } catch (e) {
      setState({ phase: 'failed', reason: e instanceof Error ? e.message : 'The file could not be created.' });
    }
  }, []);
  const reset = useCallback(() => setState({ phase: 'idle' }), []);
  return { state, run, reset };
}
