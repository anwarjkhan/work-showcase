'use client';

import { MotionConfig } from 'motion/react';
import { useMemo } from 'react';
import { useEngineResult, usePortfolioData } from '@/lib/store';
import { buildPortfolioView } from './model';
import { PortfolioView } from './PortfolioView';

/** Route `/`. Reads the live store, so approvals and "Reset demo" update every figure. */
export function PortfolioScreen() {
  const data = usePortfolioData();
  const result = useEngineResult();
  const view = useMemo(() => buildPortfolioView(data, result), [data, result]);
  return (
    <MotionConfig reducedMotion="user">
      <PortfolioView view={view} />
    </MotionConfig>
  );
}
