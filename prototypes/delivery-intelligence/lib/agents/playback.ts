/**
 * Step playback for the live view. A run's results are computed up front; the
 * screen reveals its steps over time. These helpers are hook-free and
 * timer-free: the screen owns the clock (requestAnimationFrame or an interval)
 * and asks "what is visible after `elapsedMs`?".
 *
 *   const start = performance.now();
 *   // each frame:
 *   const view = playbackAt(run, performance.now() - start);
 *   // view.steps[i].playState is 'done' | 'running' | 'pending'; stop when view.done.
 *
 * With reduced motion, skip straight to the end: `playbackAt(run, Infinity)`.
 */
import type { AgentRun, AgentStep } from '@/lib/types';

export interface StepTiming {
  index: number;
  stepId: string;
  startMs: number;
  endMs: number;
}

export type PlayState = 'pending' | 'running' | 'done';

export interface PlaybackView {
  steps: (AgentStep & { playState: PlayState })[];
  /** Steps fully played. */
  doneCount: number;
  /** Index of the step currently playing, or null before start / after the end. */
  activeIndex: number | null;
  /** 0..1 */
  progress: number;
  done: boolean;
  totalMs: number;
}

/** Start and end of each step, `speed` times faster than the suggested durations. */
export function stepTimeline(run: Pick<AgentRun, 'steps'>, speed = 1): StepTiming[] {
  let t = 0;
  return run.steps.map((s, index) => {
    const d = Math.max(0, s.durationMs) / Math.max(0.01, speed);
    const timing = { index, stepId: s.id, startMs: t, endMs: t + d };
    t += d;
    return timing;
  });
}

export function playbackDuration(run: Pick<AgentRun, 'steps'>, speed = 1): number {
  const t = stepTimeline(run, speed);
  return t.length > 0 ? (t[t.length - 1] as StepTiming).endMs : 0;
}

/** What the live view shows `elapsedMs` after playback started. */
export function playbackAt(run: Pick<AgentRun, 'steps'>, elapsedMs: number, speed = 1): PlaybackView {
  const timeline = stepTimeline(run, speed);
  const totalMs = timeline.length > 0 ? (timeline[timeline.length - 1] as StepTiming).endMs : 0;
  let doneCount = 0;
  let activeIndex: number | null = null;
  const steps = run.steps.map((s, i) => {
    const t = timeline[i] as StepTiming;
    let playState: PlayState = 'pending';
    if (elapsedMs >= t.endMs) {
      playState = 'done';
      doneCount += 1;
    } else if (elapsedMs >= t.startMs) {
      playState = 'running';
      activeIndex = i;
    }
    return { ...s, playState };
  });
  const done = doneCount === run.steps.length;
  return { steps, doneCount, activeIndex, progress: totalMs === 0 ? 1 : Math.min(1, Math.max(0, elapsedMs / totalMs)), done, totalMs };
}
