'use client';

import { createContext, useContext } from 'react';
import type { WorkflowView } from '@/lib/agents/workflow';
import type { DemoActions } from '@/lib/store';
import type { ActionResult, DeliverableMeasures, Evidence, Outcome, Person, TechDeliverable } from '@/lib/types';
import { cx } from '@/components/ui';
import type { NextStep } from './model';

export interface Notice {
  tone: 'refused' | 'info';
  text: string;
}

export interface WorkflowContextValue {
  id: string;
  deliverable: TechDeliverable;
  view: WorkflowView;
  measures: DeliverableMeasures;
  outcomes: Outcome[];
  evidence: Evidence[];
  actingAs: string;
  person: (id: string | null | undefined) => Person | undefined;
  personName: (id: string | null | undefined) => string;
  next: NextStep | null;
  actions: DemoActions;
  /** Runs an action; shows its refusal sentence when it is refused. */
  act: <T>(fn: () => ActionResult<T>) => ActionResult<T>;
  notice: Notice | null;
  clearNotice: () => void;
  /** Run currently playing its steps, if any. */
  playing: { runId: string; startedAt: number } | null;
  startPlayback: (runId: string) => void;
  finishPlayback: () => void;
  reducedMotion: boolean;
}

export const WorkflowContext = createContext<WorkflowContextValue | null>(null);

export function useWorkflow(): WorkflowContextValue {
  const v = useContext(WorkflowContext);
  if (!v) throw new Error('useWorkflow outside WorkflowContext');
  return v;
}

/** Highlight ring for the control the next-step strip points at. */
export const NEXT_RING = 'ring-2 ring-accent ring-offset-2 ring-offset-surface';

/**
 * Props that tie a control to the guided next step: `data-target` always, and
 * `data-next` plus the highlight ring when it is the step to take now.
 */
export function useTarget(target: string, className?: string): { 'data-target': string; 'data-next'?: 'true'; className: string } {
  const { next } = useWorkflow();
  const on = next?.target === target;
  return { 'data-target': target, ...(on ? { 'data-next': 'true' as const } : {}), className: cx(className, on && NEXT_RING) };
}
