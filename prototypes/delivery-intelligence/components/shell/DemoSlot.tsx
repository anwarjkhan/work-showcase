'use client';

/**
 * Mount points for the guided demo (deliverable D14 owns components/demo/*).
 *
 * - <DemoControlSlot/> sits in the top bar, before the theme switch. Keep it
 *   compact (about 36px high, up to ~320px wide).
 * - <DemoOverlaySlot/> is rendered once at the end of the shell, above page
 *   content; use it for step prompts / spotlight (position: fixed).
 *
 * Both render whatever `components/demo/index.tsx` exports as `DemoControl` and
 * `DemoOverlay`. The committed stub exports components that render nothing.
 */
import { DemoControl, DemoOverlay } from '@/components/demo';

export function DemoControlSlot() {
  return <DemoControl />;
}

export function DemoOverlaySlot() {
  return <DemoOverlay />;
}
