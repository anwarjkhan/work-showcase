'use client';

import { ArrowUpRight, Columns3, GitBranch, Layers, ShieldHalf, Users } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PDLC_STAGES } from '@/lib/config/pdlc';
import { hrefs } from '@/lib/config/routes';
import { terms } from '@/lib/config/terminology';
import { Badge, cx, MeasureTriple, RagPair } from '@/components/ui';
import { FOCUS_RING } from '@/components/ui/cx';
import { useDeliverableRag, usePortfolioData, usePortfolioIndex } from '@/lib/store';
import type { DeliverableMeasures } from '@/lib/types';
import { useWorkflow } from './context';

export function WorkflowHeader({ celebrate, complete }: { celebrate: boolean; complete: boolean }) {
  const { deliverable: d, measures } = useWorkflow();
  const idx = usePortfolioIndex();
  const rag = useDeliverableRag(d.id);
  const ir = idx.investmentRequests.get(d.investmentRequestId);
  const pod = idx.pods.get(d.podId);
  const route = ir?.route ?? (d.pmNodeId ? 'formal' : 'standalone');

  return (
    <section aria-labelledby="wf-title" className="grid items-stretch gap-3 min-[1600px]:grid-cols-[minmax(0,1fr)_minmax(0,780px)]">
      <div className="flex min-w-0 flex-col justify-between gap-2.5">
        <div className="min-w-0">
          <div className="di-eyebrow flex items-center gap-2">
            <span className="font-mono normal-case tracking-normal">{d.ref}</span>
            <span aria-hidden>·</span>
            <span>{terms.app.lifecycleShort} workflow</span>
          </div>
          <h2 id="wf-title" className="mt-0.5 truncate font-display text-[22px] leading-tight font-semibold text-title" title={d.title}>
            {d.title}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge size="sm" tone={route === 'standalone' ? 'accent' : 'neutral'} icon={<GitBranch />}>
            {terms.routes[route]}
          </Badge>
          <Badge size="sm" icon={<ShieldHalf />}>{terms.riskTiers[d.riskTier]}</Badge>
          {pod ? (
            <Badge size="sm" icon={<Users />} title={pod.focus}>
              {pod.name}
            </Badge>
          ) : null}
          {rag ? (
            <span className="ml-1 inline-flex items-center gap-1.5 text-[11px] text-fg-subtle">
              <span>
                {terms.ragKinds.reported} / {terms.ragKinds.evidence.toLowerCase()}
              </span>
              <RagPair reported={rag.reported} evidence={rag.evidence} disagrees={rag.disagrees} size="sm" />
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DeliverableSwitcher />
          <Link href="/lifecycle/" className={cx('inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-accent hover:bg-hover', FOCUS_RING)}>
            <Columns3 aria-hidden className="size-3.5" /> Lifecycle board
          </Link>
          <Link href={hrefs.deliverable(d.id)} className={cx('inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-accent hover:bg-hover', FOCUS_RING)}>
            <Layers aria-hidden className="size-3.5" /> Deliverable detail <ArrowUpRight aria-hidden className="size-3" />
          </Link>
        </div>
      </div>
      <LiveMeasures measures={measures} celebrate={celebrate} complete={complete} />
    </section>
  );
}

function DeliverableSwitcher() {
  const { deliverable } = useWorkflow();
  const data = usePortfolioData();
  const router = useRouter();
  const groups = useMemo(
    () =>
      PDLC_STAGES.map((s) => ({
        stage: s,
        items: data.deliverables.filter((d) => d.pdlcStage === s.id).sort((a, b) => a.ref.localeCompare(b.ref, 'en', { numeric: true })),
      })).filter((g) => g.items.length > 0),
    [data.deliverables],
  );
  return (
    <label className="inline-flex items-center gap-2 text-xs text-fg-muted">
      <span className="sr-only">Open another deliverable&apos;s workflow</span>
      <select
        data-testid="deliverable-switcher"
        value={deliverable.id}
        onChange={(e) => router.push(hrefs.workflow(e.target.value))}
        className={cx('h-7 max-w-[300px] rounded-md border border-line-strong bg-surface px-2 text-xs text-fg', FOCUS_RING)}
      >
        {groups.map((g) => (
          <optgroup key={g.stage.id} label={`${g.stage.order}. ${g.stage.name}`}>
            {g.items.map((d) => (
              <option key={d.id} value={d.id}>
                {d.ref} {d.title}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

/** The shared three-measure block, with a brief highlight on whichever measure just changed. */
function LiveMeasures({ measures, celebrate, complete }: { measures: DeliverableMeasures; celebrate: boolean; complete: boolean }) {
  const { reducedMotion } = useWorkflow();
  const wc = measures.workCompletion;
  const ao = measures.acceptedOutcomes;
  const keys = [wc.computable ? `${wc.value.closedPoints}/${wc.value.totalPoints}` : 'n/c', ao.computable ? `${ao.value.acceptedCount}/${ao.value.totalCount}` : 'n/c', `${measures.readiness.state}|${measures.readiness.failing.join()}|${measures.readiness.missing.join()}`];
  const prev = useRef(keys);
  const [flash, setFlash] = useState([0, 0, 0]);
  const joined = keys.join('#');
  useEffect(() => {
    const changed = keys.map((k, i) => k !== prev.current[i]);
    prev.current = keys;
    if (changed.some(Boolean)) setFlash((f) => f.map((n, i) => (changed[i] ? n + 1 : n)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined]);

  return (
    <div className={cx('relative overflow-hidden rounded-lg', complete && 'ring-1 ring-status-green-line')} data-testid="workflow-measures">
      <MeasureTriple workCompletion={wc} acceptedOutcomes={ao} readiness={measures.readiness} compact />
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden grid-cols-3 md:grid">
        {flash.map((n, i) =>
          n > 0 ? (
            <motion.div
              key={`${i}-${n}`}
              className="m-px rounded-md bg-accent-soft ring-1 ring-accent-line"
              initial={{ opacity: reducedMotion ? 0.7 : 0.95 }}
              animate={{ opacity: 0 }}
              transition={reducedMotion ? { duration: 0, delay: 1.4 } : { duration: 1.6, ease: [0.2, 0.7, 0.2, 1] }}
            />
          ) : (
            <div key={`${i}-0`} />
          ),
        )}
      </div>
      {celebrate && !reducedMotion ? (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-status-green-soft to-transparent"
          initial={{ left: '-35%' }}
          animate={{ left: '105%' }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        />
      ) : null}
    </div>
  );
}
