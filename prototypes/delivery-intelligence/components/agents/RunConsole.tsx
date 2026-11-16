'use client';

import { BookOpenCheck, CheckCheck, CircleSlash, FastForward, Play, Sparkles } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { ProvenanceBadge } from '@/components/shell';
import { Badge, Button, EmptyState, ProgressBar, SeverityBadge, Tabs, TabPanel, Timeline, cx, type TimelineStep } from '@/components/ui';
import { AGENT_CATALOGUE, AGENT_IDS, runFindings, runScopeOf, type AgentRunScope, type PlaybackView } from '@/lib/agents';
import { PDLC_STAGES } from '@/lib/config/pdlc';
import { terms } from '@/lib/config/terminology';
import type { AgentId, AgentRun, AgentStepKind, PortfolioData, ProposalStatus, ProposedChange, StatusDraft } from '@/lib/types';
import { ModeBadge } from './Catalogue';
import { DraftDocument } from './DraftDocument';
import { AgentGlyph } from './icons';
import { clockTime, consoleScopeKinds, describeScope, programmeOptions, scopeKey, scopeOfKind, type ConsoleScopeKind, type Preset } from './model';
import { RefChip, RefList } from './RefPanel';

const STEP_KIND: Record<AgentStepKind, string> = { read: 'Read', compute: 'Compute', check: 'Check', propose: 'Propose', draft: 'Draft', note: 'Note', blocked: 'Blocked' };
const STATUS_LABEL: Record<ProposalStatus, string> = {
  pending: 'Awaiting approval',
  advisory: 'Advisory only',
  'auto-applied': 'Auto-applied',
  approved: 'Approved',
  rejected: 'Rejected',
  superseded: 'Superseded',
};
const SCOPE_KIND_LABEL: Record<ConsoleScopeKind, string> = { portfolio: 'Portfolio', programme: terms.hierarchy.programme, deliverable: terms.hierarchy.deliverableShort };

const SELECT =
  'h-9 min-w-0 rounded-md border border-line-strong bg-surface px-2.5 text-[13px] text-fg shadow-card transition-colors hover:border-accent-line focus-visible:shadow-focus focus-visible:outline-none';

export interface RunConsoleProps {
  data: PortfolioData;
  agentId: AgentId;
  scope: AgentRunScope;
  onAgentChange: (id: AgentId) => void;
  onScopeChange: (scope: AgentRunScope) => void;
  presets: Preset[];
  onPreset: (p: Preset) => void;
  onRun: () => void;
  /** Sentence shown on a disabled Run button (e.g. acting as an agent identity). */
  runBlockedReason: string | null;
  /** Refusal returned by the last Run attempt. */
  runError: string | null;
  run: AgentRun | undefined;
  playback: PlaybackView | null;
  playing: boolean;
  onSkip: () => void;
  proposals: ProposedChange[];
  draft: StatusDraft | undefined;
  personName: (id: string) => string;
  portfolioFindings: number;
}

export function RunConsole(props: RunConsoleProps) {
  const { data, agentId, scope, onAgentChange, onScopeChange, presets, onPreset, onRun, runBlockedReason, runError, run, playback, playing, onSkip } = props;
  const kinds = consoleScopeKinds(agentId);
  const stageAgents = AGENT_IDS.filter((id) => AGENT_CATALOGUE[id].stages.length > 0);
  const cross = AGENT_IDS.filter((id) => AGENT_CATALOGUE[id].stages.length === 0);
  const programmes = programmeOptions(data);
  const presetActive = (p: Preset) => p.agentId === agentId && scopeKey(p.scope) === scopeKey(scope);

  return (
    <section aria-labelledby="run-console-h" className="di-card flex min-h-0 min-w-0 flex-col" data-testid="run-console">
      <header className="flex flex-col gap-3 border-b border-line px-5 pt-4 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 id="run-console-h" className="font-display text-[15px] font-semibold text-title">
              Run console
            </h3>
            <ProvenanceBadge kind="scripted-agent" size="sm" />
          </div>
          <span className="text-xs text-fg-subtle">Deterministic rules over the records shown; no model is called</span>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-0 flex-[1_1_210px] flex-col gap-1">
            <span className="text-[11px] font-medium text-fg-muted">Agent</span>
            <select className={SELECT} value={agentId} onChange={(e) => onAgentChange(e.target.value as AgentId)} data-testid="agent-select">
              <optgroup label="By PDLC stage">
                {stageAgents.map((id) => (
                  <option key={id} value={id}>
                    {AGENT_CATALOGUE[id].name} ({AGENT_CATALOGUE[id].stages.map((s) => PDLC_STAGES.find((x) => x.id === s)?.shortName).join(', ')})
                  </option>
                ))}
              </optgroup>
              <optgroup label="Cross-cutting">
                {cross.map((id) => (
                  <option key={id} value={id}>
                    {AGENT_CATALOGUE[id].name}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-[11px] font-medium text-fg-muted">Scope</legend>
            <div className="flex h-9 items-center gap-0.5 rounded-md border border-line-strong bg-surface-2 p-0.5">
              {(['portfolio', 'programme', 'deliverable'] as ConsoleScopeKind[]).map((k) => {
                const allowed = kinds.includes(k);
                const on = scope.kind === k || (k === 'deliverable' && scope.kind === 'pdlc-stage');
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={on}
                    disabled={!allowed}
                    title={allowed ? undefined : `${AGENT_CATALOGUE[agentId].name} does not run on a ${SCOPE_KIND_LABEL[k].toLowerCase()} scope.`}
                    onClick={() => onScopeChange(scopeOfKind(agentId, k, data))}
                    className={cx(
                      'h-7 rounded-sm px-2.5 text-xs font-medium transition-colors focus-visible:shadow-focus focus-visible:outline-none',
                      on ? 'bg-surface text-title shadow-card ring-1 ring-line' : 'text-fg-muted hover:text-fg',
                      !allowed && 'cursor-not-allowed line-through opacity-40 hover:text-fg-muted',
                    )}
                  >
                    {SCOPE_KIND_LABEL[k]}
                  </button>
                );
              })}
            </div>
          </fieldset>
          {scope.kind === 'programme' ? (
            <label className="flex min-w-0 flex-[1_1_200px] flex-col gap-1">
              <span className="text-[11px] font-medium text-fg-muted">{terms.hierarchy.programme}</span>
              <select className={SELECT} value={scope.pmNodeId} onChange={(e) => onScopeChange({ kind: 'programme', pmNodeId: e.target.value })}>
                {programmes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
          ) : scope.kind === 'deliverable' || scope.kind === 'pdlc-stage' ? (
            <label className="flex min-w-0 flex-[1_1_200px] flex-col gap-1">
              <span className="text-[11px] font-medium text-fg-muted">{terms.hierarchy.deliverableShort}</span>
              <select className={SELECT} value={scope.deliverableId} onChange={(e) => onScopeChange({ kind: 'deliverable', deliverableId: e.target.value })}>
                {data.deliverables.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.ref} {d.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <Button variant="primary" icon={<Play />} onClick={onRun} disabledReason={runBlockedReason ?? undefined} loading={playing} data-testid="run-button">
            {playing ? 'Running' : 'Run'}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Presets">
          <span className="mr-1 text-[11px] font-medium text-fg-subtle">Presets</span>
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPreset(p)}
              aria-pressed={presetActive(p)}
              data-testid={`preset-${p.id}`}
              className={cx(
                'inline-flex h-6 max-w-[320px] items-center gap-1 rounded-pill border px-2 text-[11.5px] font-medium transition-colors focus-visible:shadow-focus focus-visible:outline-none',
                presetActive(p) ? 'border-accent-line bg-accent-soft text-accent' : 'border-line bg-surface text-fg-muted hover:border-accent-line hover:text-fg',
              )}
            >
              <Sparkles aria-hidden className="size-3 shrink-0" />
              <span className="truncate">{p.label}</span>
            </button>
          ))}
        </div>
        {runError ? (
          <p role="alert" className="rounded-md border border-status-red-line bg-status-red-soft px-3 py-2 text-[13px] text-status-red-fg">
            {runError}
          </p>
        ) : null}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4" data-testid="run-body">
        {run && playback ? (
          <RunView {...props} run={run} playback={playback} onSkip={onSkip} />
        ) : (
          <EmptyState
            icon={<Play />}
            title="Choose an agent and a scope, then Run"
            description="Each step plays here with what it read, checked and found, with links to the records. Results are computed from the current data; nothing changes until a named person approves."
          />
        )}
      </div>
    </section>
  );
}

function RunView({ data, run, playback, playing, onSkip, proposals, draft, personName, portfolioFindings }: RunConsoleProps & { run: AgentRun; playback: PlaybackView }) {
  const agent = AGENT_CATALOGUE[run.agentId];
  const scope = runScopeOf(run);
  const done = playback.done;
  const steps: TimelineStep[] = playback.steps.map((s) => ({
    id: s.id,
    state: s.kind === 'blocked' && s.playState === 'done' ? 'failed' : s.playState === 'done' ? 'done' : s.playState === 'running' ? 'running' : 'pending',
    title: s.label,
    meta: <span className="font-mono text-[10.5px] tracking-wide uppercase">{STEP_KIND[s.kind]}</span>,
    description: s.playState === 'pending' ? undefined : s.detail,
    content: s.playState !== 'pending' && s.refs.length > 0 ? <RefList refs={s.refs} max={8} title={s.label} /> : undefined,
  }));
  return (
    <div className="flex flex-col gap-4" data-testid="run-view" data-run-id={run.id} data-done={done || undefined}>
      <div className="flex items-start gap-3">
        <AgentGlyph id={run.agentId} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-[14px] font-semibold text-title">{agent.name}</h4>
            <ModeBadge mode={agent.mode} />
            <span className="font-mono text-[11px] text-fg-subtle">{run.id}</span>
          </div>
          <p className="text-[12.5px] text-fg-muted">
            On {describeScope(data, scope)} · started by {personName(run.startedById)} at {clockTime(run.startedAt)}
          </p>
        </div>
        {!done ? (
          <Button size="sm" variant="secondary" icon={<FastForward />} onClick={onSkip} data-testid="skip-button">
            Skip to result
          </Button>
        ) : (
          <Badge tone="green" size="sm" icon={<CheckCheck />}>
            Completed
          </Badge>
        )}
      </div>
      <ProgressBar value={Math.round(playback.progress * 100)} ariaLabel="Run progress" size="sm" />
      <Timeline steps={steps} />
      {done ? <RunResult key={run.id} data={data} run={run} proposals={proposals} draft={draft} portfolioFindings={portfolioFindings} /> : playing ? <p className="text-xs text-fg-subtle">Playing the computed steps…</p> : null}
    </div>
  );
}

function Count({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-md border border-line bg-surface-2 px-3 py-2">
      <span className="text-[11px] text-fg-muted">{label}</span>
      <span className="font-display text-xl leading-tight font-semibold text-title tabular-nums">{value}</span>
      {hint ? <span className="truncate text-[11px] text-fg-subtle">{hint}</span> : null}
    </div>
  );
}

function RunResult({ data, run, proposals, draft, portfolioFindings }: { data: PortfolioData; run: AgentRun; proposals: ProposedChange[]; draft: StatusDraft | undefined; portfolioFindings: number }) {
  const findings = runFindings(run);
  const by = (s: ProposalStatus) => proposals.filter((p) => p.status === s).length;
  const defaultTab = by('pending') + by('advisory') + by('auto-applied') > 0 ? 'proposals' : draft ? 'draft' : 'findings';
  const [tab, setTab] = useState<string>(defaultTab);
  const items = [
    { id: 'findings', label: 'Findings', count: findings.length },
    ...(draft ? [{ id: 'draft', label: 'Draft' }] : []),
    { id: 'proposals', label: 'Proposed changes', count: proposals.length },
  ];
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-4" data-testid="run-result">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[15px] leading-snug font-semibold text-title" data-testid="run-summary">
          {run.summary}
        </p>
        <ProvenanceBadge kind="scripted-agent" size="sm" />
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Count label="Findings raised" value={findings.length} hint="by this run" />
        <Count label="Awaiting approval" value={by('pending')} hint={by('approved') + by('rejected') > 0 ? `${by('approved')} approved, ${by('rejected')} rejected` : 'in the approval queue'} />
        <Count label="Auto-applied / advisory" value={`${by('auto-applied')} / ${by('advisory')}`} hint="under the tier ceiling" />
        <Count label="Portfolio findings now" value={<span data-testid="portfolio-findings-count">{portfolioFindings}</span>} hint="engine, live" />
      </div>
      <Tabs items={items} value={items.some((i) => i.id === tab) ? tab : defaultTab} onChange={setTab} ariaLabel="Run result" variant="segmented">
        <TabPanel id="findings">
          {findings.length === 0 ? (
            <p className="text-[13px] text-fg-muted">This run raised no findings.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col divide-y divide-line p-0" data-testid="run-findings">
              {findings.map((f) => (
                <li key={f.id} className="flex flex-col gap-1 py-2.5 first:pt-0">
                  <div className="flex items-start gap-2">
                    <SeverityBadge severity={f.severity} size="sm" />
                    <span className="font-mono text-[11px] leading-5 text-fg-subtle">{f.ruleId}</span>
                    <span className="text-[13px] leading-snug text-fg">{f.message}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 pl-1">
                    <RefChip refValue={f.subject} />
                    <RefList refs={f.evidence} max={5} title={f.message} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabPanel>
        {draft ? (
          <TabPanel id="draft">
            <DraftDocument draft={draft} />
          </TabPanel>
        ) : null}
        <TabPanel id="proposals">
          {proposals.length === 0 ? (
            <p className="flex items-center gap-2 text-[13px] text-fg-muted">
              <CircleSlash aria-hidden className="size-4" />
              {AGENT_CATALOGUE[run.agentId].mode === 'read-only' ? 'Read-only agent: it reports and changes nothing.' : 'No changes proposed for this scope.'}
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {proposals.map((p) => (
                <li key={p.id} className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-[13px]">
                  <span className="min-w-0 flex-1 truncate text-fg">{p.title}</span>
                  <span className="font-mono text-[11px] text-fg-subtle">{p.riskTier}</span>
                  <Badge size="sm" tone={p.status === 'approved' || p.status === 'auto-applied' ? 'green' : p.status === 'advisory' ? 'amber' : p.status === 'pending' ? 'accent' : 'neutral'}>
                    {STATUS_LABEL[p.status]}
                  </Badge>
                </li>
              ))}
              <li className="flex items-center gap-1.5 pt-1 text-xs text-fg-muted">
                <BookOpenCheck aria-hidden className="size-3.5" /> Review each change, with its before and after, in the approval queue.
              </li>
            </ul>
          )}
        </TabPanel>
      </Tabs>
      <p className="text-[11px] text-fg-subtle">
        Provider: scripted, no external call · {data.meta.sourceKind === 'synthetic' ? terms.provenance.sample : terms.provenance.reported}
      </p>
    </div>
  );
}
