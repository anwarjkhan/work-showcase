'use client';
/** The slide layer's input, taken live from the store so slides follow approvals, drafts and Reset demo. */
import { useMemo } from 'react';
import { useClock, useEngineResult, usePortfolioData, useStatusDrafts } from '@/lib/store';
import type { SlideContext } from '@/lib/slides';

export function useSlideContext(): SlideContext {
  const data = usePortfolioData();
  const result = useEngineResult();
  const drafts = useStatusDrafts();
  const clock = useClock();
  return useMemo(() => ({ data, result, drafts, clock }), [data, result, drafts, clock]);
}
