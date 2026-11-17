'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { DEMO_STEPS, demoHref } from '@/lib/config/demo-script';
import { demoStore, useDemoState } from './demo-state';

/** State plus the actions the control and overlay share. Navigation uses the Next router. */
export function useDemoController() {
  const router = useRouter();
  const state = useDemoState();

  const goto = useCallback(
    (index: number) => {
      const i = Math.min(DEMO_STEPS.length - 1, Math.max(0, index));
      demoStore.goto(i);
      const step = DEMO_STEPS[i];
      if (step) router.push(demoHref(step.route));
    },
    [router],
  );

  const start = useCallback(() => {
    demoStore.start();
    router.push(demoHref(DEMO_STEPS[0]?.route ?? '/'));
  }, [router]);

  return useMemo(
    () => ({
      state,
      start,
      goto,
      next: () => goto(demoStore.get().step + 1),
      prev: () => goto(demoStore.get().step - 1),
      exit: () => demoStore.exit(),
      setCollapsed: (c: boolean) => demoStore.setCollapsed(c),
    }),
    [state, start, goto],
  );
}
