'use client';

import { useMemo } from 'react';
import { computeHierarchyRollups, computePlanExtras } from '@/lib/engine';
import { useClock, useEngineResult, usePortfolioData } from '@/lib/store';
import { buildPlanIndex } from './layout';

/**
 * Engine plan data for the screen, derived once per store revision: the data,
 * result and clock objects only change identity when the store changes, so the
 * memo keys are effectively the revision.
 */
export function usePlanIndex() {
  const data = usePortfolioData();
  const result = useEngineResult();
  const clock = useClock();
  return useMemo(() => {
    const { forecasts, knockOn } = computePlanExtras(data, clock);
    const index = buildPlanIndex({ data, result, forecasts, knockOn, clock });
    const rollups = computeHierarchyRollups(data, result);
    return { data, result, clock, index, rollups, knockOn };
  }, [data, result, clock]);
}

export type PlanState = ReturnType<typeof usePlanIndex>;
