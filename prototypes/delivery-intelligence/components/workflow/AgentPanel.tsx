'use client';

import { ArrowRight, Bot, Check, Clock3, CheckCircle2, Circle, LoaderCircle, Play, RotateCcw, TriangleAlert, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AGENT_CATALOGUE } from '@/lib/agents/catalogue';
import { playbackAt, runFindings } from '@/lib/agents';
import { terms } from '@/lib/config/terminology';
import { ProvenanceBadge } from '@/components/shell';
import { Avatar, Badge, Button, cx, Disclosure, ProgressBar, SeverityBadge } from '@/components/ui';
import { useAgentRun, usePortfolioData, useProposals, useStatusDrafts } from '@/lib/store';
import type { AgentRun, ProposedChange, StatusDraft } from '@/lib/types';
import { BeatHeader } from './bits';
import { useTarget, useWorkflow } from './context';
import { formatStamp } from './model';

const SPEED = 1.8;

export function AgentPanel() {
  const { view, id, actingAs, actions, act, playing, startPlayback, reducedMotion } = useWorkflow();
  const cur = view.stages.find((s) => s.current)!;
  const agentId = cur.agentId;
  const runId = cur.state.agentRunIds.at(-1) ?? null;
  const run = useAgentRun(runId);
  const runTarget = useTarget('run-agent');

  if (!agentId) {
    return (
      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto p-4">
        <BeatHeader index={1} icon={<Bot />} title="Agent assists" />
        <p className="text-[13px] text-fg-muted">No agent assists this stage.</p>
      </div>
    );
  }
  const agent = AGENT_CATALOGUE[agentId];
  const isPlaying = playing !== null && playing.runId === runId;

  const onRun = () => {
    const r = act(() => actions.runStageAgent(id, undefined, actingAs));
    if (r.ok && !reducedMotion) startPlayback(r.value.runId);
  };

  return (
    <div className="flex min-h-0 flex-col gap-3 overflow-y-auto p-4" data-testid="agent-panel">
      <BeatHeader index={1} icon={<Bot />} title="Agent assists" aside={<ProvenanceBadge kind="scripted-agent" size="sm" />} />
      <div className="flex items-start gap-2.5">
        <Avatar kind="agent" name={agent.name} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[13.5px] font-semibold text-fg">{agent.name}</span>
            <Badge size="sm" tone="neutral">{terms.agentModes[agent.mode]}</Badge>
          </div>
          <p className="text-[12px] leading-snug text-fg-muted">{agent.purpose}</p>
        </div>
        <Button
          size="sm"
          variant={run ? 'secondary' : 'primary'}
          icon={run ? <RotateCcw /> : <Play />}
          onClick={onRun}
          disabledReason={isPlaying ? 'The agent is still playing its steps.' : undefined}
          {...runTarget}
        >
          {run ? 'Run again' : 'Run agent'}
        </Button>
      </div>

      {run ? (
        <RunView key={run.id} run={run} playing={isPlaying} />
      ) : (
        <p className="rounded-md border border-dashed border-line-strong px-3 py-4 text-center text-[12.5px] text-fg-muted">
          Run the agent to see its steps and its {agent.mode === 'read-only' ? 'report' : agent.mode === 'draft' ? 'draft' : 'proposed changes'} for this deliverable. It computes over the records; it never approves, accepts or sets readiness.
        </p>
      )}
    </div>
  );
}

function RunView({ run, playing }: { run: AgentRun; playing: boolean }) {
  const { playing: pb, finishPlayback, view, evidence } = useWorkflow();
  const at = run.completedAt ?? run.startedAt;
  const data = usePortfolioData();
  const allProposals = useProposals();
  const epics = view.run.deliverableId ? (data.deliverables.find((d) => d.id === view.run.deliverableId)?.epicKeys ?? []) : [];
  const changed =
    view.run.updatedAt > at ||
    evidence.some((e) => e.observedAt > at) ||
    data.workItems.some((w) => w.updated > at && (epics.includes(w.key) || (w.epicKey !== null && epics.includes(w.epicKey))));
  // A run with a decision still pending stays open: its proposal is the work in hand.
  const outdated = changed && !allProposals.some((p) => p.runId === run.id && p.status === 'pending');
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      setNow(performance.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  const elapsed = playing && pb ? now - pb.startedAt : Infinity;
  const pv = playbackAt(run, elapsed, SPEED);
  useEffect(() => {
    if (playing && pv.done) finishPlayback();
  }, [playing, pv.done, finishPlayback]);

  const steps = (
    <ol className="flex flex-col gap-1.5" aria-label="Agent steps">
      {pv.steps.map((s) => (
        <li key={s.id} className={cx('flex items-start gap-2 text-[12px] leading-snug', s.playState === 'pending' && 'opacity-45')}>
          <span className="mt-px inline-flex size-4 shrink-0 items-center justify-center">
            {s.playState === 'done' ? (
              <Check aria-hidden className="size-3.5 text-status-green" strokeWidth={3} />
            ) : s.playState === 'running' ? (
              <LoaderCircle aria-hidden className="size-3.5 animate-spin text-accent" />
            ) : (
              <Circle aria-hidden className="size-2 text-fg-subtle" />
            )}
          </span>
          <span className="min-w-0">
            <span className={cx('font-medium', s.kind === 'blocked' ? 'text-status-red-fg' : 'text-fg')}>{s.label}</span>
            {s.playState !== 'pending' && s.detail ? <span className="block text-fg-muted">{s.detail}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );

  if (!pv.done) {
    return (
      <div className="flex flex-col gap-2.5" data-testid="agent-playing">
        <ProgressBar value={Math.round(pv.progress * 100)} ariaLabel="Agent progress" size="sm" />
        {steps}
      </div>
    );
  }

  if (outdated) {
    const kind = run.draftId ? 'Report' : 'Output';
    return (
      <div className="flex flex-col gap-2" data-testid="agent-output" data-outdated="true">
        <p className="flex items-center gap-2 rounded-md border border-dashed border-line-strong px-3 py-2 text-[12px] text-fg-muted">
          <Clock3 aria-hidden className="size-3.5 shrink-0 text-fg-subtle" />
          {kind} as at {formatStamp(at)} is out of date: records have changed since. Run again for the current picture.
        </p>
        <Disclosure summary={<span className="text-[12px] text-fg-muted">Show the earlier {kind.toLowerCase()}</span>}>
          <div className="flex flex-col gap-3 opacity-80">
            <p className="text-[12.5px] text-fg">{run.summary}</p>
            {steps}
            <RunOutput run={run} />
          </div>
        </Disclosure>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-testid="agent-output">
      <div className="flex items-start gap-2 rounded-md bg-surface-2 px-3 py-2 text-[12.5px]">
        {run.status === 'failed' ? <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-status-red" /> : <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-status-green" />}
        <span className="min-w-0 text-fg">
          {run.summary}
          <span className="block text-[11px] text-fg-subtle">As at {formatStamp(at)}.</span>
        </span>
      </div>
      <Disclosure summary={<span className="text-[12px] text-fg-muted">{run.steps.length} steps the agent took</span>}>{steps}</Disclosure>
      <RunOutput run={run} />
    </div>
  );
}

function RunOutput({ run }: { run: AgentRun }) {
  const proposals = useProposals();
  const drafts = useStatusDrafts();
  const mine = useMemo(() => proposals.filter((p) => p.runId === run.id && p.status !== 'superseded'), [proposals, run.id]);
  const draft = run.draftId ? drafts.find((d) => d.id === run.draftId) : undefined;
  const findings = runFindings(run);
  return (
    <>
      {mine.map((p) => (
        <ProposalCard key={p.id} proposal={p} />
      ))}
      {draft ? <DraftView draft={draft} /> : null}
      {findings.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <div className="di-eyebrow">Findings raised</div>
          <ul className="flex flex-col gap-1.5">
            {findings.slice(0, 6).map((f) => (
              <li key={f.id} className="flex items-start gap-2 text-[12px]">
                <SeverityBadge severity={f.severity} size="sm" />
                <span className="text-fg">{f.message}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {mine.length === 0 && !draft && findings.length === 0 ? <p className="text-[12.5px] text-fg-muted">Nothing to report for this deliverable.</p> : null}
    </>
  );
}

function ProposalCard({ proposal: p }: { proposal: ProposedChange }) {
  const { actions, act, actingAs, personName } = useWorkflow();
  const approveTarget = useTarget(`approve-proposal:${p.id}`);
  const stories = p.patch.op === 'add-work-items' ? p.patch.items : [];
  return (
    <div className="flex flex-col gap-2 rounded-md border border-accent-line bg-surface p-3" data-testid="proposal">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] font-semibold text-fg">{p.title}</span>
        <ProposalStatus p={p} personName={personName} />
      </div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2 gap-y-1 text-[12px]">
        <span className="text-fg-subtle">Before</span>
        <span className="text-fg-muted line-through decoration-line-strong">{p.beforeText}</span>
        <span className="text-fg-subtle">After</span>
        <span className="text-fg">{p.afterText}</span>
      </div>
      {stories.length > 0 ? (
        <p className="text-[11.5px] text-fg-subtle">
          {stories.length} stories, {stories.reduce((n, w) => n + (w.points ?? 0), 0)} points. The draft below shows each story with its acceptance criteria.
        </p>
      ) : null}
      {p.status === 'pending' ? (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="primary" icon={<Check />} onClick={() => act(() => actions.approveProposal(p.id, actingAs))} {...approveTarget}>
            {stories.length > 0 ? 'Approve adding the stories' : 'Approve change'}
          </Button>
          <Button size="sm" variant="ghost" icon={<X />} onClick={() => act(() => actions.rejectProposal(p.id, actingAs))}>
            Reject
          </Button>
          <span className="text-[11px] text-fg-subtle">as {personName(actingAs)}</span>
        </div>
      ) : null}
    </div>
  );
}

function ProposalStatus({ p, personName }: { p: ProposedChange; personName: (id: string) => string }) {
  switch (p.status) {
    case 'pending':
      return <Badge size="sm" tone="amber">Awaiting approval</Badge>;
    case 'auto-applied':
      return <Badge size="sm" tone="accent" title={terms.autonomy['auto-apply']}>Auto-applied ({p.riskTier} ceiling)</Badge>;
    case 'advisory':
      return <Badge size="sm" tone="neutral">{terms.autonomy['advisory-only']}</Badge>;
    case 'approved':
      return <Badge size="sm" tone="green" icon={<Check />}>Approved by {personName(p.decision?.approverId ?? '')}</Badge>;
    case 'rejected':
      return <Badge size="sm" tone="neutral" icon={<X />}>Rejected by {personName(p.decision?.approverId ?? '')}</Badge>;
    default:
      return null;
  }
}

/** A readable rendering of a scripted draft: stories with criteria, or a checklist of done and exceptions. */
function DraftView({ draft }: { draft: StatusDraft }) {
  return (
    <article className="flex flex-col gap-2.5" aria-label={draft.title} data-testid="agent-draft">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-[12.5px] font-semibold text-title">{draft.title}</h4>
        <ProvenanceBadge kind="scripted-agent" size="sm" />
      </div>
      {draft.sections.map((sec) => {
        const acceptance = sec.sentences.filter((s) => s.text.startsWith('Acceptance: '));
        const body = sec.sentences.filter((s) => !s.text.startsWith('Acceptance: '));
        return (
          <section key={sec.heading} className="flex flex-col gap-1 rounded-md border border-line bg-surface-2 px-3 py-2">
            <h5 className="text-[12px] font-semibold text-fg">{sec.heading}</h5>
            {body.map((s) => {
              const done = s.text.startsWith('Done: ');
              const ex = s.text.startsWith('Exception: ');
              return (
                <p key={s.id} className="flex items-start gap-1.5 text-[12px] leading-snug text-fg-muted">
                  {done ? <CheckCircle2 aria-hidden className="mt-0.5 size-3.5 shrink-0 text-status-green" /> : ex ? <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0 text-status-amber" /> : null}
                  <span className={cx(ex && 'text-fg')}>{s.text}</span>
                </p>
              );
            })}
            {acceptance.length > 0 ? (
              <ul className="flex flex-col gap-0.5 pl-1">
                {acceptance.map((s) => (
                  <li key={s.id} className="flex items-start gap-1.5 text-[11.5px] leading-snug text-fg">
                    <ArrowRight aria-hidden className="mt-0.5 size-3 shrink-0 text-accent" />
                    {s.text.replace(/^Acceptance: /, '')}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        );
      })}
    </article>
  );
}
