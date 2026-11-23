'use client';

/**
 * Agent centre (D12, route /agents).
 *
 * Deep links (URL hash). Each preselects an agent and a scope, or a tab; nothing
 * is run until the presenter presses Run. The workspace scrolls into view.
 *   #run-<agent-id>          any agent with its default scope, e.g.
 *                            #run-raid-quality (RAID quality, the portfolio),
 *                            #run-status-reporting (Status reporting, HERO_DELIVERABLE_ID),
 *                            #run-outcome-mapping, #run-dependency-discovery,
 *                            #run-portfolio-reconciliation, #run-executive-briefing,
 *                            #run-control-evidence-check, #run-release-readiness,
 *                            #run-requirements-structuring (workflow deliverable)
 *   #status-hero             Status reporting on HERO_DELIVERABLE_ID
 *   #outcomes-portfolio      Outcome mapping across the portfolio (shows T1 auto-applied and T4 advisory)
 *   #brief-portfolio         Executive briefing across the portfolio
 *   #reconcile-portfolio     Portfolio reconciliation across the portfolio
 *   #readiness-hero          Release readiness on HERO_DELIVERABLE_ID
 *   #requirements-workflow   Requirements structuring on WORKFLOW_DELIVERABLE_ID
 *   #audit, #history         open the audit trail or the run history tab
 *
 * Test ids for scripted demos: run-button, skip-button, run-view[data-done],
 * run-summary, portfolio-findings-count, headline-findings, proposal-card
 * [data-proposal-id][data-status], approve-button, attempt-approve,
 * governance-refusal, persona-select, effect-strip, audit-event[data-action].
 *
 * Reset demo: local state is tagged with the first audit event it was created
 * under; when the store is reset that event disappears and the screen falls
 * back to its initial state (no stale run, effect or refusal).
 */
import { Bot, Scale, ScrollText, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ProvenanceBadge } from '@/components/shell';
import { DemoNote, Section, SectionHeading, StatTile, TabPanel, Tabs } from '@/components/ui';
import { playbackAt, playbackDuration, type AgentRunScope } from '@/lib/agents';
import { PRESENTER_PERSON_ID } from '@/lib/config/story';
import { useActingAs, useAgentRuns, useAuditTrail, useDemoActions, useDemoState, useDemoStore, useEngineResult, usePortfolioData, useProposals, useStatusDrafts } from '@/lib/store';
import type { AgentId, AuditEvent, PortfolioData } from '@/lib/types';
import { ApprovalQueue } from './ApprovalQueue';
import { AuditTrail, RunHistory } from './AuditTrail';
import { Catalogue, GovernanceSummary } from './Catalogue';
import type { ApprovalEffect } from './EffectStrip';
import { defaultScope, findingDiff, isAgentIdentity, isScopeValid, parseHash, personaOptions, presets as buildPresets, runCheck, snapshot, type Preset, type QueueFilter } from './model';
import { RefPanelProvider } from './RefPanel';
import { RunConsole } from './RunConsole';

interface Ui {
  /** First audit event when this state was written (see header). */
  marker: AuditEvent | undefined;
  /** Hash this state has taken into account. */
  appliedHash: string;
  agentId: AgentId;
  scope: AgentRunScope;
  activeRunId: string | null;
  /** Playback of a run just started from the console; null shows it complete. */
  play: { runId: string; startMs: number } | null;
  runError: string | null;
  refusals: Record<string, string>;
  effect: ApprovalEffect | null;
  filter: QueueFilter;
  tab: 'audit' | 'history';
}

const DEFAULT_AGENT: AgentId = 'raid-quality';

function initialUi(data: PortfolioData, hash: string, marker: AuditEvent | undefined): Ui {
  const target = parseHash(hash, data);
  const agentId = target?.agentId ?? DEFAULT_AGENT;
  return {
    marker,
    appliedHash: hash,
    agentId,
    scope: target?.scope ?? defaultScope(agentId, data),
    activeRunId: null,
    play: null,
    runError: null,
    refusals: {},
    effect: null,
    filter: 'open',
    tab: target?.tab ?? 'audit',
  };
}

// Location hash as an external store, so deep links work after hydration and on later hash changes.
const subscribeHash = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};
const readHash = () => window.location.hash;
const serverHash = () => '';

const selectFirstAudit = (s: { audit: AuditEvent[] }) => s.audit[0];

export function AgentsScreen() {
  const store = useDemoStore();
  const actions = useDemoActions();
  const data = usePortfolioData();
  const results = useEngineResult();
  const runs = useAgentRuns();
  const proposals = useProposals();
  const drafts = useStatusDrafts();
  const audit = useAuditTrail();
  const actingAs = useActingAs();
  const firstAudit = useDemoState(selectFirstAudit);
  const hash = useSyncExternalStore(subscribeHash, readHash, serverHash);
  const reduce = useReducedMotion() ?? false;

  const [raw, setRaw] = useState<Ui>(() => initialUi(data, '', undefined));
  // A reset (or the first render) invalidates local state; derive the effective state.
  let ui = raw.marker === firstAudit ? raw : initialUi(data, hash, firstAudit);
  if (ui.appliedHash !== hash) {
    const target = parseHash(hash, data);
    ui = { ...ui, appliedHash: hash, ...(target?.agentId ? { agentId: target.agentId, scope: target.scope } : {}), ...(target?.tab ? { tab: target.tab } : {}) };
  }
  if (ui !== raw) setRaw(ui);

  /** Writes local state, keeping it valid across store changes made by the same handler. */
  const write = useCallback(
    (before: AuditEvent | undefined, patch: (u: Ui) => Partial<Ui>) => {
      const after = store.getState().audit[0];
      setRaw((prev) => {
        const base = prev.marker === before ? prev : { ...initialUi(store.getState().data, prev.appliedHash, before), appliedHash: prev.appliedHash };
        return { ...base, ...patch(base), marker: after };
      });
    },
    [store],
  );
  const markerNow = () => store.getState().audit[0];

  // Scroll a deep-linked target into view (no state change).
  useEffect(() => {
    const target = parseHash(hash, data);
    if (!target) return;
    const el = document.getElementById(target.tab ? 'agent-audit' : 'agent-workspace');
    el?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    // Only when the hash changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash]);

  // If the presenter leaves while acting as an agent identity, hand the persona back.
  const actingRef = useRef(actingAs);
  useEffect(() => {
    actingRef.current = actingAs;
  }, [actingAs]);
  useEffect(
    () => () => {
      if (isAgentIdentity(store.getState().data, actingRef.current)) actions.setActingAs(PRESENTER_PERSON_ID);
    },
    [actions, store],
  );

  // --- Playback clock -----------------------------------------------------------
  const activeRun = ui.activeRunId ? runs.find((r) => r.id === ui.activeRunId) : undefined;
  const [now, setNow] = useState(0);
  const play = ui.play && activeRun && ui.play.runId === activeRun.id && !reduce ? ui.play : null;
  const total = activeRun ? playbackDuration(activeRun) : 0;
  useEffect(() => {
    if (!play) return;
    const id = window.setInterval(() => {
      const t = performance.now();
      setNow(t);
      if (t - play.startMs > total + 100) window.clearInterval(id);
    }, 50);
    return () => window.clearInterval(id);
  }, [play, total]);
  const elapsed = play ? Math.max(0, now - play.startMs) : Number.POSITIVE_INFINITY;
  const playback = activeRun ? playbackAt(activeRun, elapsed) : null;
  const playing = Boolean(play && playback && !playback.done);

  // --- Derived --------------------------------------------------------------------
  const people = useMemo(() => new Map(data.people.map((p) => [p.id, p.name])), [data.people]);
  const personName = useCallback((id: string) => people.get(id) ?? data.agentIdentities.find((a) => a.id === id)?.handle ?? id, [people, data.agentIdentities]);
  const presetList = useMemo(() => buildPresets(data), [data]);
  const personas = useMemo(() => personaOptions(data, proposals, actingAs, ui.agentId), [data, proposals, actingAs, ui.agentId]);
  const runProposals = activeRun ? proposals.filter((p) => p.runId === activeRun.id) : [];
  const runDraft = activeRun?.draftId ? drafts.find((d) => d.id === activeRun.draftId) : undefined;
  const runGate = runCheck(data, actingAs);
  const pendingCount = proposals.filter((p) => p.status === 'pending' && p.runId !== (playing ? activeRun?.id : null)).length;
  const decidedCount = proposals.filter((p) => p.status === 'approved' || p.status === 'rejected').length;
  const refusedCount = audit.filter((e) => e.action === 'governance.blocked').length;
  const autoCount = proposals.filter((p) => p.status === 'auto-applied').length;

  // --- Handlers ------------------------------------------------------------------
  const selectAgent = (id: AgentId) => {
    const m = markerNow();
    write(m, (u) => ({ agentId: id, scope: isScopeValid(id, u.scope, data) && u.agentId === id ? u.scope : defaultScope(id, data), runError: null }));
  };
  const selectAgentFromCatalogue = (id: AgentId) => {
    selectAgent(id);
    document.getElementById('agent-workspace')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };
  const selectScope = (scope: AgentRunScope) => write(markerNow(), () => ({ scope, runError: null }));
  const applyPreset = (p: Preset) => write(markerNow(), () => ({ agentId: p.agentId, scope: p.scope, runError: null }));

  const onRun = () => {
    const m0 = markerNow();
    const r = actions.startAgentRun(ui.agentId, ui.scope, actingAs);
    if (!r.ok) {
      write(m0, () => ({ runError: r.reason }));
      return;
    }
    const startMs = performance.now();
    write(m0, () => ({ activeRunId: r.value.runId, play: { runId: r.value.runId, startMs }, runError: null, effect: null }));
  };

  const approve = (id: string) => {
    const s0 = store.getState();
    const p = s0.proposals.find((x) => x.id === id);
    if (!p) return;
    const m0 = s0.audit[0];
    const before = snapshot(s0.results, p.deliverableId);
    const r = actions.approveProposal(id, store.getState().actingAsPersonId);
    if (!r.ok) {
      write(m0, (u) => ({ refusals: { ...u.refusals, [id]: r.reason } }));
      return;
    }
    const s1 = store.getState();
    const after = snapshot(s1.results, p.deliverableId);
    const diff = findingDiff(before, after);
    const effect: ApprovalEffect = {
      proposalId: id,
      title: p.title,
      approverName: personName(s1.actingAsPersonId),
      at: s1.audit[s1.audit.length - 1]?.at ?? '',
      before,
      after,
      cleared: s0.results.findings.filter((f) => diff.cleared.includes(f.id)),
      raised: s1.results.findings.filter((f) => diff.raised.includes(f.id)),
    };
    write(m0, (u) => {
      const refusals = { ...u.refusals };
      delete refusals[id];
      return { effect, refusals };
    });
  };

  const reject = (id: string) => {
    const m0 = markerNow();
    const r = actions.rejectProposal(id, store.getState().actingAsPersonId);
    write(m0, (u) => (r.ok ? {} : { refusals: { ...u.refusals, [id]: r.reason } }));
  };

  const bulkApprove = (runId: string) => {
    const s0 = store.getState();
    const m0 = s0.audit[0];
    const me = s0.actingAsPersonId;
    const targets = s0.proposals.filter((p) => p.runId === runId && p.status === 'pending');
    const deliverables = [...new Set(targets.map((p) => p.deliverableId))];
    const dId = deliverables.length === 1 ? (deliverables[0] ?? null) : null;
    const before = snapshot(s0.results, dId);
    const refusals: Record<string, string> = {};
    let approved = 0;
    for (const p of targets) {
      const r = actions.approveProposal(p.id, me);
      if (r.ok) approved += 1;
      else refusals[p.id] = r.reason;
    }
    const s1 = store.getState();
    const after = snapshot(s1.results, dId);
    const diff = findingDiff(before, after);
    write(m0, (u) => ({
      refusals: { ...u.refusals, ...refusals },
      effect:
        approved > 0
          ? {
              proposalId: `bulk-${runId}-${s1.audit.length}`,
              title: `${approved} change${approved === 1 ? '' : 's'} from ${runId}`,
              approverName: personName(me),
              at: s1.audit[s1.audit.length - 1]?.at ?? '',
              before,
              after,
              cleared: s0.results.findings.filter((f) => diff.cleared.includes(f.id)),
              raised: s1.results.findings.filter((f) => diff.raised.includes(f.id)),
            }
          : u.effect,
    }));
  };

  const actAs = (id: string) => {
    const m0 = markerNow();
    actions.setActingAs(id);
    write(m0, () => ({ refusals: {} }));
  };

  const reopen = (runId: string) => {
    write(markerNow(), () => ({ activeRunId: runId, play: null, runError: null }));
    document.getElementById('agent-workspace')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <RefPanelProvider>
      <div className="flex flex-col gap-8" data-testid="agents-screen">
        <section aria-label="Agent centre headline" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <h2 className="sr-only">What the agents have found and done</h2>
          <StatTile
            label="Open findings across the portfolio"
            value={<span data-testid="headline-findings">{results.findings.length}</span>}
            caption="Engine rules R1 to R14, recomputed after every approval"
            icon={<Scale />}
            provenance="computed"
          />
          <StatTile label="Awaiting a named approver" value={<span data-testid="headline-pending">{pendingCount}</span>} caption={`${autoCount} auto-applied under the T1 policy`} icon={<ShieldCheck />} />
          <StatTile label="Decided by people" value={<span data-testid="headline-decided">{decidedCount}</span>} caption="Approvals and rejections, each logged" icon={<ScrollText />} />
          <StatTile label="Refused by governance" value={<span data-testid="headline-refused">{refusedCount}</span>} caption="Assignee, agent or advisory-only attempts" icon={<ShieldAlert />} />
        </section>

        <Section
          id="agents-frame-h"
          title="Nine scripted agents, one set of rules"
          description="Each agent is a deterministic script computing over the delivery records. It reads, checks and drafts; it can only propose changes, within the ceiling of each item's risk tier, and a named person decides."
          actions={<ProvenanceBadge kind="scripted-agent" />}
        >
          <GovernanceSummary />
          <Catalogue selectedId={ui.agentId} onSelect={selectAgentFromCatalogue} />
        </Section>

        <section id="agent-workspace" aria-labelledby="workspace-h" className="flex scroll-mt-[calc(var(--di-topbar-height)+12px)] flex-col gap-4">
          <SectionHeading
            id="workspace-h"
            title="Run, review and approve"
            description="Run an agent, watch each step and the records it used, then decide its proposed changes. Approving writes to the in-app data only, standing in for a work-tracker update."
            actions={
              <DemoNote className="inline-flex items-center gap-2 text-xs text-fg-muted">
                <Bot aria-hidden className="size-4 text-prov-scripted" />
                Scripted agent, no live model
                <ProvenanceBadge kind="scripted-agent" size="sm" />
              </DemoNote>
            }
          />
          <div className="grid grid-cols-1 gap-4 2xl:h-[calc(100vh-var(--di-topbar-height)-40px)] 2xl:min-h-[720px] 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="flex min-h-0 flex-col max-2xl:max-h-[880px]">
              <RunConsole
                data={data}
                agentId={ui.agentId}
                scope={ui.scope}
                onAgentChange={selectAgent}
                onScopeChange={selectScope}
                presets={presetList}
                onPreset={applyPreset}
                onRun={onRun}
                runBlockedReason={runGate.ok ? null : runGate.reason}
                runError={ui.runError}
                run={activeRun}
                playback={playback}
                playing={playing}
                onSkip={() => write(markerNow(), () => ({ play: null }))}
                proposals={runProposals}
                draft={runDraft}
                personName={personName}
                portfolioFindings={results.findings.length}
              />
            </div>
            <div className="flex min-h-0 flex-col max-2xl:max-h-[880px]">
              <ApprovalQueue
                data={data}
                proposals={proposals}
                runs={runs}
                actingAs={actingAs}
                personas={personas}
                onActAs={actAs}
                onApprove={approve}
                onReject={reject}
                onBulkApprove={bulkApprove}
                refusals={ui.refusals}
                effect={ui.effect}
                filter={ui.filter}
                onFilter={(f) => write(markerNow(), () => ({ filter: f }))}
                personName={personName}
                heldRunId={playing ? (activeRun?.id ?? null) : null}
              />
            </div>
          </div>
        </section>

        <section id="agent-audit" aria-labelledby="audit-h" className="flex scroll-mt-[calc(var(--di-topbar-height)+12px)] flex-col gap-4">
          <SectionHeading
            id="audit-h"
            title="Audit trail"
            description="Every run, step, proposal, approval, rejection, automatic application and governance refusal, with who did it and when on the demo clock."
            actions={<ProvenanceBadge kind="computed" size="sm" />}
          />
          <Tabs
            items={[
              { id: 'audit', label: 'Events', count: audit.length },
              { id: 'history', label: 'Run history', count: runs.length },
            ]}
            value={ui.tab}
            onChange={(t) => write(markerNow(), () => ({ tab: t as Ui['tab'] }))}
            ariaLabel="Audit trail and run history"
          >
            <TabPanel id="audit">
              <AuditTrail audit={audit} runs={runs} data={data} />
            </TabPanel>
            <TabPanel id="history">
              <RunHistory runs={runs} proposals={proposals} data={data} activeRunId={ui.activeRunId} onReopen={reopen} personName={personName} />
            </TabPanel>
          </Tabs>
        </section>
      </div>
    </RefPanelProvider>
  );
}
