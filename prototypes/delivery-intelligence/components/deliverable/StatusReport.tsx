'use client';

/**
 * Drafted weekly status. The presenter runs the status-reporting agent for
 * this deliverable through the store action, watches its steps play (instant
 * under reduced motion), then reads a draft with a citation marker on every
 * sentence. A marker opens the cited record in the shared drawer.
 */
import { Check, ClipboardCopy, FileText, Play, RefreshCw } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ProvenanceBadge } from '@/components/shell';
import { AddToSlides } from '@/components/slides/AddToSlides';
import { DemoNote, Badge, Button, Card, Disclosure, SectionHeading, Timeline, cx, type TimelineStep } from '@/components/ui';
import { FOCUS_RING } from '@/components/ui/cx';
import { playbackAt, playbackDuration, resolveRef } from '@/lib/agents';
import { formatDate } from '@/lib/config/clock';
import { terms } from '@/lib/config/terminology';
import { useActingAs, useAgentRun, useDemoActions, useDemoState, useLatestDraft, usePortfolioIndex } from '@/lib/store';
import type { EntityRef, StatusDraft } from '@/lib/types';
import { kindLabel, RecordChip, useOpenRecord } from './records';

/** Longest the step playback runs, however many steps the agent has. */
const MAX_PLAYBACK_MS = 3600;
const INLINE_MARKERS = 3;

/** Numbers every distinct cited record in order of first appearance. */
export function numberCitations(draft: StatusDraft): { order: EntityRef[]; numberOf: (r: EntityRef) => number } {
  const map = new Map<string, number>();
  const order: EntityRef[] = [];
  for (const sec of draft.sections)
    for (const s of sec.sentences)
      for (const c of s.citations) {
        const k = `${c.kind}:${c.id}`;
        if (!map.has(k)) {
          map.set(k, order.length + 1);
          order.push(c);
        }
      }
  return { order, numberOf: (r) => map.get(`${r.kind}:${r.id}`) ?? 0 };
}

/** The draft as plain text with [n] markers and a source list, for pasting into an email. */
export function draftAsText(draft: StatusDraft, labelOf: (r: EntityRef) => string): string {
  const { order, numberOf } = numberCitations(draft);
  const lines: string[] = [draft.title, `DRAFT. Prepared by a scripted agent from the records cited; not reviewed or sent.`, ''];
  for (const sec of draft.sections) {
    lines.push(sec.heading.toUpperCase());
    for (const s of sec.sentences) lines.push(`- ${s.text} ${s.citations.map((c) => `[${numberOf(c)}]`).join('')}`);
    lines.push('');
  }
  lines.push('SOURCES');
  order.forEach((r, i) => lines.push(`[${i + 1}] ${kindLabel(r.kind)}: ${labelOf(r)}`));
  return lines.join('\n');
}

function CitationMarker({ r, n }: { r: EntityRef; n: number }) {
  const open = useOpenRecord();
  const state = useDemoState((s) => s);
  const label = resolveRef(state, r)?.label ?? r.id;
  return (
    <button
      type="button"
      onClick={() => open(r)}
      aria-label={`Citation ${n}: ${kindLabel(r.kind)} ${label}`}
      title={`${kindLabel(r.kind)}: ${label}`}
      data-citation={`${r.kind}:${r.id}`}
      className={cx(
        'mx-px inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-xs border border-accent-line bg-accent-soft px-1 align-baseline text-[10.5px] leading-none font-semibold text-accent tabular-nums transition-colors hover:bg-accent hover:text-on-accent',
        FOCUS_RING,
      )}
    >
      {n}
    </button>
  );
}

function Sentence({ text, citations, numberOf }: { text: string; citations: EntityRef[]; numberOf: (r: EntityRef) => number }) {
  const [more, setMore] = useState(false);
  const shown = more ? citations : citations.slice(0, INLINE_MARKERS);
  const hidden = citations.length - shown.length;
  return (
    <span data-sentence>
      {text}{' '}
      <span className="whitespace-normal">
        {shown.map((c) => (
          <CitationMarker key={`${c.kind}:${c.id}`} r={c} n={numberOf(c)} />
        ))}
        {hidden > 0 ? (
          <button
            type="button"
            onClick={() => setMore(true)}
            aria-label={`Show ${hidden} more citations`}
            className={cx('mx-px inline-flex h-[18px] items-center rounded-xs border border-line px-1 text-[10.5px] font-medium text-fg-muted hover:text-fg', FOCUS_RING)}
          >
            +{hidden}
          </button>
        ) : null}
      </span>
    </span>
  );
}

export function StatusReport({ deliverableId }: { deliverableId: string }) {
  const actions = useDemoActions();
  const actingAs = useActingAs();
  const idx = usePortfolioIndex();
  const reduce = useReducedMotion();
  const state = useDemoState((s) => s);
  const draft = useLatestDraft(deliverableId, 'weekly-status');
  const draftRun = useAgentRun(draft?.runId);

  const [playingId, setPlayingId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'idle' | 'done' | 'manual'>('idle');
  const [manualText, setManualText] = useState('');
  const playingRun = useAgentRun(playingId);
  const frame = useRef<number>(0);

  const run = useCallback(() => {
    setError(null);
    setCopied('idle');
    const r = actions.startAgentRun('status-reporting', { kind: 'deliverable', deliverableId }, actingAs);
    if (!r.ok) {
      setError(r.reason);
      return;
    }
    setElapsed(0);
    // Under reduced motion there is nothing to play: the draft appears at once.
    if (!reduce) setPlayingId(r.value.runId);
  }, [actions, actingAs, deliverableId, reduce]);

  // Plays the steps with a timer owned by this screen; instant under reduced motion.
  useEffect(() => {
    if (!playingRun) return;
    const total = playbackDuration(playingRun);
    const speed = Math.max(1, total / MAX_PLAYBACK_MS);
    const start = performance.now();
    const tick = () => {
      const ms = performance.now() - start;
      setElapsed(ms);
      if (playbackAt(playingRun, ms, speed).done) {
        setPlayingId(null);
        return;
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [playingRun]);

  const playing = Boolean(playingRun);
  const view = useMemo(() => {
    if (!playingRun) return null;
    const speed = Math.max(1, playbackDuration(playingRun) / MAX_PLAYBACK_MS);
    return playbackAt(playingRun, elapsed, speed);
  }, [playingRun, elapsed]);

  const steps: TimelineStep[] = (view?.steps ?? draftRun?.steps.map((s) => ({ ...s, playState: 'done' as const })) ?? []).map((s) => ({
    id: s.id,
    title: s.label,
    state: s.playState === 'done' ? 'done' : s.playState === 'running' ? 'running' : 'pending',
    description: s.playState === 'pending' ? undefined : s.detail,
  }));

  const labelOf = useCallback((r: EntityRef) => resolveRef(state, r)?.label ?? r.id, [state]);
  const numbering = useMemo(() => (draft ? numberCitations(draft) : null), [draft]);
  const deliverable = idx.deliverables.get(deliverableId);

  const copy = async () => {
    if (!draft) return;
    const text = draftAsText(draft, labelOf);
    try {
      await navigator.clipboard.writeText(text);
      setCopied('done');
      return;
    } catch {
      // Fall through to the legacy path, then to a selectable text box.
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) {
        setCopied('done');
        return;
      }
    } catch {
      // Use the manual fallback below.
    }
    setManualText(text);
    setCopied('manual');
  };

  const author = idx.people.get(actingAs);

  return (
    <section id="status" tabIndex={-1} aria-labelledby="status-heading" className="flex min-w-0 scroll-mt-20 flex-col gap-4 outline-none" data-testid="status-section">
      <SectionHeading
        id="status-heading"
        title="Drafted weekly status"
        description="A scripted agent reads the records, drafts the update, and cites a record for every sentence. It does not send anything or change any status."
        actions={
          <>
            <ProvenanceBadge kind="scripted-agent" />
            <AddToSlides kind="td-status" scope={{ kind: 'deliverable', deliverableId }} label="the weekly status slide" />
            <Button
              variant="primary"
              icon={draft ? <RefreshCw className="size-4" /> : <Play className="size-4" />}
              loading={playing}
              onClick={run}
              data-testid="draft-status"
            >
              {draft ? 'Redraft weekly status' : 'Draft weekly status'}
            </Button>
          </>
        }
      />

      {error ? (
        <p role="alert" className="rounded-md border border-status-red-line bg-status-red-soft px-3 py-2 text-[13px] text-status-red-fg">
          {error}
        </p>
      ) : null}

      {playing && view ? (
        <Card level={4} padding="sm" title="Status-reporting agent" eyebrow="Scripted agent · running" data-testid="agent-steps">
          <Timeline steps={steps} showStateLabel />
        </Card>
      ) : null}

      {!playing && !draft ? (
        <div className="rounded-lg border border-dashed border-line-strong bg-surface-2 px-6 py-8 text-center">
          <FileText aria-hidden className="mx-auto mb-2 size-6 text-fg-subtle" />
          <p className="font-display text-sm font-semibold text-title">No weekly status drafted for {deliverable?.ref ?? 'this deliverable'} yet</p>
          <p className="mx-auto mt-1 max-w-lg text-[13px] text-fg-muted">
            Draft it to see the update a programme manager would send, with every sentence traced to a record.
          </p>
        </div>
      ) : null}

      {!playing && draft && numbering ? (
        <article className="di-card flex min-w-0 flex-col" aria-label="Drafted weekly status" data-testid="status-draft">
          <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-6 py-4">
            <div className="min-w-0">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <Badge tone="amber" size="sm" dashed>
                  Draft
                </Badge>
                <ProvenanceBadge kind="scripted-agent" size="sm" />
                <span className="text-xs text-fg-subtle">Generated {formatDate(draft.generatedAt)}, for review by {author?.name ?? 'the presenter'}</span>
              </div>
              <h3 className="font-display text-[17px] leading-snug font-semibold text-title">{draft.title}</h3>
            </div>
            <div className="flex items-center gap-2">
              {copied === 'done' ? (
                <span role="status" className="inline-flex items-center gap-1.5 text-xs font-medium text-status-green-fg">
                  <Check aria-hidden className="size-3.5" /> Copied
                </span>
              ) : null}
              <Button variant="secondary" size="sm" icon={<ClipboardCopy className="size-4" />} onClick={copy} data-testid="copy-status">
                Copy as text
              </Button>
            </div>
          </header>

          {copied === 'manual' ? (
            <div className="border-b border-line bg-surface-2 px-6 py-3">
              <label htmlFor="manual-copy" className="mb-1 block text-xs text-fg-muted">
                Your browser blocked clipboard access. Select the text below and copy it.
              </label>
              <textarea
                id="manual-copy"
                readOnly
                value={manualText}
                rows={8}
                onFocus={(e) => e.currentTarget.select()}
                className={cx('w-full rounded-md border border-line-strong bg-surface p-2 font-mono text-xs text-fg', FOCUS_RING)}
              />
            </div>
          ) : null}

          <div className="flex flex-col gap-5 px-6 py-5">
            {draft.sections.map((sec, i) => (
              <section key={sec.heading} aria-label={sec.heading} className="flex flex-col gap-1.5">
                <h4 className="di-eyebrow">{sec.heading}</h4>
                {i === 0 ? (
                  <p className="text-[14.5px] leading-relaxed text-fg">
                    {sec.sentences.map((s) => (
                      <span key={s.id}>
                        <Sentence text={s.text} citations={s.citations} numberOf={numbering.numberOf} />{' '}
                      </span>
                    ))}
                  </p>
                ) : (
                  <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-[13.5px] leading-relaxed text-fg marker:text-fg-subtle">
                    {sec.sentences.map((s) => (
                      <li key={s.id}>
                        <Sentence text={s.text} citations={s.citations} numberOf={numbering.numberOf} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          <footer className="flex flex-col gap-3 rounded-b-lg border-t border-line bg-surface-2 px-6 py-4">
            <Disclosure summary={`Sources (${numbering.order.length} records cited)`} defaultOpen={false}>
              <ol className="m-0 grid list-none grid-cols-1 gap-x-6 gap-y-1.5 p-0 text-xs md:grid-cols-2">
                {numbering.order.map((r, i) => (
                  <li key={`${r.kind}:${r.id}`} className="flex items-center gap-2">
                    <span className="w-6 shrink-0 text-right font-semibold text-accent tabular-nums">{i + 1}</span>
                    <span className="w-24 shrink-0 text-fg-subtle">{kindLabel(r.kind)}</span>
                    <RecordChip to={r} showKind={false} />
                  </li>
                ))}
              </ol>
            </Disclosure>
            {draftRun ? (
              <Disclosure summary={`How it was drafted (${draftRun.steps.length} steps)`} defaultOpen={false}>
                <Timeline steps={steps} />
              </Disclosure>
            ) : null}
            <DemoNote as="p" className="text-[11px] text-fg-subtle">
              {terms.provenance['scripted-agent']}: produced by deterministic rules over the records, not a language model. A named human reviews before anything is sent.
            </DemoNote>
          </footer>
        </article>
      ) : null}
    </section>
  );
}
