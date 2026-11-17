'use client';

import { BookLock, Eye, FilePenLine, GitPullRequestArrow, ListChecks, ScrollText, ShieldCheck, UserCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { ProvenanceBadge } from '@/components/shell';
import { Disclosure, cx } from '@/components/ui';
import { AGENT_CATALOGUE, AGENT_IDS, GOVERNANCE_RULES } from '@/lib/agents';
import { PDLC_STAGES } from '@/lib/config/pdlc';
import { RISK_TIERS, RISK_TIER_POLICIES } from '@/lib/config/risk-tiers';
import { terms } from '@/lib/config/terminology';
import type { AgentId, AgentMode } from '@/lib/types';
import { AgentGlyph } from './icons';
import { autoApplyFieldsText, consoleScopeKinds, tierStrip, type TierCell } from './model';

const MODE_ICON: Record<AgentMode, typeof Eye> = { 'read-only': Eye, draft: FilePenLine, 'propose-change': GitPullRequestArrow };

export function ModeBadge({ mode }: { mode: AgentMode }) {
  const Icon = MODE_ICON[mode];
  return (
    <span
      className={cx(
        'inline-flex h-5 shrink-0 items-center gap-1 rounded-pill border px-1.5 text-[10.5px] font-medium whitespace-nowrap',
        mode === 'propose-change' ? 'border-accent-line bg-accent-soft text-accent' : 'border-line-strong bg-surface-2 text-fg-muted',
      )}
    >
      <Icon aria-hidden className="size-3" strokeWidth={2.2} />
      {terms.agentModes[mode]}
    </span>
  );
}

const TIER_TONE: Record<TierCell['tone'], string> = {
  green: 'border-status-green-line bg-status-green-soft text-status-green-fg',
  accent: 'border-accent-line bg-accent-soft text-accent',
  amber: 'border-status-amber-line bg-status-amber-soft text-status-amber-fg',
  neutral: 'border-line bg-surface-2 text-fg-muted',
};

/** Four cells, T1 to T4: what this agent may do for items at each tier. */
export function TierStrip({ mode, className }: { mode: AgentMode; className?: string }) {
  const cells = tierStrip(mode);
  return (
    <div className={cx('grid grid-cols-4 gap-1', className)} role="list" aria-label="Autonomy ceiling by risk tier">
      {cells.map((c) => (
        <div key={c.tier} role="listitem" title={c.long} className={cx('flex flex-col items-center rounded-sm border px-1 py-1 leading-tight', TIER_TONE[c.tone])}>
          <span className="font-mono text-[10px] font-semibold opacity-80">{c.tier}</span>
          <span className="text-[11px] font-medium">{c.short}</span>
          <span className="sr-only">{c.long}</span>
        </div>
      ))}
    </div>
  );
}

const SCOPE_LABEL = { portfolio: 'Portfolio', programme: terms.hierarchy.programme, deliverable: terms.hierarchy.deliverableShort } as const;

function AgentCard({ id, selected, onSelect, stageLabel }: { id: AgentId; selected: boolean; onSelect: (id: AgentId) => void; stageLabel: string }) {
  const a = AGENT_CATALOGUE[id];
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      aria-pressed={selected}
      data-testid={`agent-card-${id}`}
      className={cx(
        'di-card group flex h-full min-w-0 flex-col gap-2.5 p-3.5 text-left transition-[border-color,box-shadow] duration-(--di-duration-fast) hover:border-accent-line focus-visible:shadow-focus focus-visible:outline-none',
        selected && 'border-accent-line ring-1 ring-accent-line',
      )}
    >
      <div className="flex items-start gap-2.5">
        <AgentGlyph id={id} />
        <div className="min-w-0 flex-1">
          <div className="di-eyebrow truncate">{stageLabel}</div>
          <h4 className="text-[14px] leading-snug font-semibold text-title">{a.name}</h4>
        </div>
        <ModeBadge mode={a.mode} />
      </div>
      <p className="text-[12.5px] leading-snug text-fg">{a.purpose}</p>
      <p className="text-[12px] leading-snug text-fg-muted">
        <span className="font-medium text-fg-subtle">Outputs: </span>
        {a.output}
      </p>
      <div className="mt-auto flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-0.5 text-[10.5px] font-medium tracking-wide text-fg-subtle uppercase">Scopes</span>
          {consoleScopeKinds(id).map((k) => (
            <span key={k} className="rounded-xs border border-line px-1.5 text-[10.5px] leading-[18px] text-fg-muted">
              {SCOPE_LABEL[k]}
            </span>
          ))}
        </div>
        <TierStrip mode={a.mode} />
      </div>
    </button>
  );
}

/** Nine agents: the PDLC stage agents in stage columns, then the cross-cutting ones. */
export function Catalogue({ selectedId, onSelect }: { selectedId: AgentId; onSelect: (id: AgentId) => void }) {
  const stageAgents = AGENT_IDS.filter((id) => AGENT_CATALOGUE[id].stages.length > 0);
  const cross = AGENT_IDS.filter((id) => AGENT_CATALOGUE[id].stages.length === 0);
  const stageName = (id: AgentId) =>
    AGENT_CATALOGUE[id].stages.map((s) => PDLC_STAGES.find((x) => x.id === s)?.shortName ?? s).join(' and ');
  return (
    <div className="flex flex-col gap-3" data-testid="agent-catalogue">
      <div className="flex flex-col gap-2">
        <h3 className="di-eyebrow">By PDLC stage</h3>
        {/* Stage header aligned with the cards at the widest layout. */}
        <div aria-hidden className="hidden grid-cols-5 gap-3 2xl:grid">
          {PDLC_STAGES.map((s) => (
            <div key={s.id} className="flex items-center gap-2 border-t-2 border-accent-line pt-1.5 text-[11.5px] font-medium text-fg-muted">
              <span className="font-mono text-[10.5px] text-accent">{s.order}</span>
              {s.name}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-5">
          {stageAgents.map((id) => {
            const stages = AGENT_CATALOGUE[id].stages;
            const first = PDLC_STAGES.findIndex((s) => s.id === stages[0]) + 1;
            return (
              <div key={id} className={cx('min-w-0', stages.length > 1 && '2xl:col-span-2')} data-first-stage={first}>
                <AgentCard id={id} selected={selectedId === id} onSelect={onSelect} stageLabel={stageName(id)} />
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="di-eyebrow">Cross-cutting</h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-5">
          {cross.map((id) => (
            <AgentCard key={id} id={id} selected={selectedId === id} onSelect={onSelect} stageLabel="Cross-cutting" />
          ))}
        </div>
      </div>
    </div>
  );
}

function Rule({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span aria-hidden className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2 text-accent [&>svg]:size-3.5">
        {icon}
      </span>
      <span className="text-[13px] leading-snug text-fg">{children}</span>
    </li>
  );
}

/** The rules in plain words, and the autonomy ceiling by risk tier as a matrix. */
export function GovernanceSummary() {
  return (
    <div className="di-card grid grid-cols-1 gap-0 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" data-testid="governance-summary">
      <div className="flex flex-col gap-3 border-b border-line p-5 xl:border-r xl:border-b-0">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-[15px] font-semibold text-title">How agents are governed</h3>
          <ProvenanceBadge kind="scripted-agent" size="sm" />
        </div>
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          <Rule icon={<ShieldCheck />}>
            Agents <strong className="font-semibold">never</strong> approve a change, accept an outcome, set readiness or change the reported status in the{' '}
            {terms.systems['portfolio-system'].toLowerCase()}.
          </Rule>
          <Rule icon={<UserCheck />}>Every change needs a named person to approve it, and that person cannot be the item&apos;s assignee.</Rule>
          <Rule icon={<BookLock />}>What an agent may do depends on the item&apos;s risk tier (right). Critical and regulated items get advice only.</Rule>
          <Rule icon={<ScrollText />}>Every run, step, proposal, approval, rejection and refusal is written to the audit trail below.</Rule>
          <Rule icon={<ListChecks />}>All nine agents are deterministic scripts computing over the records shown. No language model is called.</Rule>
        </ul>
        <Disclosure summary={<span className="text-xs font-medium text-fg-muted">The rules as enforced in code ({GOVERNANCE_RULES.length})</span>}>
          <ol className="mt-2 flex list-none flex-col gap-1.5 p-0 text-xs text-fg-muted">
            {GOVERNANCE_RULES.map((r) => (
              <li key={r.id} className="flex gap-2">
                <span className="font-mono text-fg-subtle">{r.id}</span>
                <span>{r.text}</span>
              </li>
            ))}
          </ol>
        </Disclosure>
      </div>
      <div className="flex min-w-0 flex-col gap-3 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-display text-[15px] font-semibold text-title">Autonomy ceiling by risk tier</h3>
          <span className="text-xs text-fg-subtle">Set in the risk-tier policy; illustrative for the prototype</span>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4" role="list" aria-label="Autonomy ceiling by risk tier">
          {RISK_TIERS.map((tier) => {
            const p = RISK_TIER_POLICIES[tier];
            const tone = p.autonomy === 'auto-apply' ? 'green' : p.autonomy === 'advisory-only' ? 'amber' : 'accent';
            return (
              <div key={tier} role="listitem" className="flex min-w-0 flex-col gap-1.5 rounded-md border border-line bg-surface-2 p-3">
                <div className="text-[12.5px] font-semibold text-fg">{terms.riskTiers[tier]}</div>
                <span className={cx('w-fit rounded-pill border px-2 text-[11px] leading-5 font-semibold', TIER_TONE[tone])}>{terms.autonomy[p.autonomy]}</span>
                <p className="text-[11.5px] leading-snug text-fg-muted">
                  {p.autonomy === 'auto-apply'
                    ? `Auto-applies only ${autoApplyFieldsText()}; everything else is proposed.`
                    : p.autonomy === 'advisory-only'
                      ? 'Raises advice with no approve control; nothing is applied.'
                      : 'Proposes; a named person approves or rejects each change.'}
                </p>
                <p className="mt-auto text-[11px] text-fg-subtle tabular-nums">{p.requiredEvidence.length} evidence kinds required for readiness</p>
              </div>
            );
          })}
        </div>
        <p className="text-[11.5px] text-fg-subtle">
          Cards below show each agent&apos;s ceiling as a strip: <span className="font-medium">Auto*</span> auto-applies the allowed fields only,{' '}
          <span className="font-medium">Propose</span> waits for approval, <span className="font-medium">Advise</span> cannot be approved,{' '}
          <span className="font-medium">Report</span> changes nothing.
        </p>
      </div>
    </div>
  );
}
