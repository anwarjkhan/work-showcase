'use client';

import { useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { describeWorkflow } from '@/lib/agents/workflow';
import { WORKFLOW_DELIVERABLE_ID } from '@/lib/config/story';
import { terms } from '@/lib/config/terminology';
import { usePageMeta } from '@/components/shell';
import { EmptyState } from '@/components/ui';
import {
  useActingAs,
  useAuditTrail,
  useDemoActions,
  useDemoStore,
  useEngineResult,
  usePortfolioData,
  usePortfolioIndex,
  useProposals,
} from '@/lib/store';
import type { ActionResult } from '@/lib/types';
import { WorkflowContext, type Notice, type WorkflowContextValue } from './context';
import { HistorySection } from './HistorySection';
import { buildHistory, deriveNextStep } from './model';
import { NextStepStrip } from './NextStepStrip';
import { StageRail } from './StageRail';
import { StageWorkspace } from './StageWorkspace';
import { WorkflowHeader } from './WorkflowHeader';

/**
 * Changes whenever the demo is reset, so the screen remounts with no stale
 * local state (playback, open forms, notices).
 */
function useResetEpoch(): number {
  const store = useDemoStore();
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    let prev = store.getState();
    return store.subscribe(() => {
      const s = store.getState();
      if (s.audit.length < prev.audit.length || (s.data === s.seed && prev.data !== prev.seed)) setEpoch((e) => e + 1);
      prev = s;
    });
  }, [store]);
  return epoch;
}

/** PDLC workflow for one deliverable (`/lifecycle/[id]`). */
export function WorkflowScreen({ id }: { id: string }) {
  const epoch = useResetEpoch();
  return <WorkflowBody key={`${id}:${epoch}`} id={id} />;
}

function WorkflowBody({ id }: { id: string }) {
  const data = usePortfolioData();
  const results = useEngineResult();
  const idx = usePortfolioIndex();
  const actions = useDemoActions();
  const actingAs = useActingAs();
  const allProposals = useProposals();
  const audit = useAuditTrail();
  const reducedMotion = Boolean(useReducedMotion());

  const deliverable = idx.deliverables.get(id);
  const view = useMemo(() => describeWorkflow(data, results, id), [data, results, id]);
  const measures = results.deliverables[id];
  const proposals = useMemo(() => allProposals.filter((p) => p.deliverableId === id), [allProposals, id]);
  const outcomes = useMemo(() => idx.outcomesByDeliverable.get(id) ?? [], [idx, id]);
  const evidence = useMemo(() => idx.evidenceByDeliverable.get(id) ?? [], [idx, id]);

  const [notice, setNotice] = useState<Notice | null>(null);
  const [playing, setPlaying] = useState<{ runId: string; startedAt: number } | null>(null);

  usePageMeta({ subtitle: deliverable ? `${deliverable.ref} ${deliverable.title}` : undefined, provenance: ['computed', 'scripted-agent', 'simulated'] });

  const act = useCallback(<T,>(fn: () => ActionResult<T>): ActionResult<T> => {
    const r = fn();
    setNotice(r.ok ? null : { tone: 'refused', text: r.reason });
    return r;
  }, []);

  const person = useCallback((pid: string | null | undefined) => (pid ? idx.people.get(pid) : undefined), [idx]);
  const personName = useCallback((pid: string | null | undefined) => (pid ? (idx.people.get(pid)?.name ?? pid) : 'nobody'), [idx]);

  const walkthrough = id === WORKFLOW_DELIVERABLE_ID;
  const next = useMemo(
    () =>
      view && measures
        ? deriveNextStep({
            view,
            measures,
            proposals,
            outcomes,
            criteriaByOutcome: idx.criteriaByOutcome,
            evidence,
            actingAs,
            personName: (p) => personName(p),
            walkthrough,
            playing: playing !== null,
          })
        : null,
    [view, measures, proposals, outcomes, idx, evidence, actingAs, personName, walkthrough, playing],
  );

  // The orchestrated moment: all three measures complete, reached during this session.
  const complete =
    !!measures &&
    measures.readiness.state === 'ready' &&
    measures.workCompletion.computable &&
    measures.workCompletion.value.percent === 100 &&
    measures.acceptedOutcomes.computable &&
    measures.acceptedOutcomes.value.percent === 100;
  const wasComplete = useRef(complete);
  const [celebrate, setCelebrate] = useState(false);
  useEffect(() => {
    if (complete && !wasComplete.current) setCelebrate(true);
    wasComplete.current = complete;
  }, [complete]);

  const history = useMemo(() => buildHistory({ data, deliverableId: id, run: view?.run, audit, proposals: allProposals }), [data, id, view, audit, allProposals]);

  const ctx = useMemo<WorkflowContextValue | null>(
    () =>
      deliverable && view && measures
        ? {
            id,
            deliverable,
            view,
            measures,
            outcomes,
            evidence,
            actingAs,
            person,
            personName,
            next,
            actions,
            act,
            notice,
            clearNotice: () => setNotice(null),
            playing,
            startPlayback: (runId) => setPlaying({ runId, startedAt: performance.now() }),
            finishPlayback: () => setPlaying(null),
            reducedMotion,
          }
        : null,
    [deliverable, view, measures, id, outcomes, evidence, actingAs, person, personName, next, actions, act, notice, playing, reducedMotion],
  );

  if (!deliverable || !ctx) {
    return (
      <EmptyState
        variant="boxed"
        title={deliverable ? 'No PDLC workflow for this deliverable' : 'Deliverable not found'}
        description={`${terms.hierarchy.deliverableShort} ${id} has no workflow in the current data.`}
      />
    );
  }

  return (
    <WorkflowContext.Provider value={ctx}>
      <div className="flex flex-col gap-8" data-testid="workflow-screen" data-deliverable={id} data-stage={view?.run.currentStage}>
        <div className="flex flex-col gap-3">
          <WorkflowHeader celebrate={celebrate} complete={complete} />
          <StageRail />
          {walkthrough || next ? <NextStepStrip celebrate={celebrate} /> : null}
          <StageWorkspace />
        </div>
        <HistorySection items={history} />
      </div>
    </WorkflowContext.Provider>
  );
}
