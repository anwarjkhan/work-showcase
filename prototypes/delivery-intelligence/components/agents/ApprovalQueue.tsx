'use client';

import { BadgeCheck, Check, Info, Lightbulb, ShieldAlert, ShieldCheck, Users, X, Zap } from 'lucide-react';
import { ProvenanceBadge } from '@/components/shell';
import { Avatar, Badge, Button, Chip, EmptyState, cx } from '@/components/ui';
import { AGENT_CATALOGUE } from '@/lib/agents';
import { RISK_TIER_POLICIES } from '@/lib/config/risk-tiers';
import { terms } from '@/lib/config/terminology';
import type { AgentRun, PortfolioData, ProposalStatus, ProposedChange, TechDeliverable } from '@/lib/types';
import { EffectStrip, type ApprovalEffect } from './EffectStrip';
import { AgentGlyph } from './icons';
import {
  approvalCheck,
  autoApplyFieldsText,
  beforeAfterRows,
  clockTime,
  eligibleForApproval,
  matchesFilter,
  PROPOSAL_ORDER,
  rejectionCheck,
  runTitle,
  type Persona,
  type QueueFilter,
} from './model';
import { RefChip, RefList } from './RefPanel';

const STATUS: Record<ProposalStatus, { label: string; tone: 'accent' | 'amber' | 'green' | 'red' | 'neutral' }> = {
  pending: { label: 'Awaiting approval', tone: 'accent' },
  advisory: { label: 'Advisory only', tone: 'amber' },
  'auto-applied': { label: 'Auto-applied', tone: 'green' },
  approved: { label: 'Approved', tone: 'green' },
  rejected: { label: 'Rejected', tone: 'neutral' },
  superseded: { label: 'Superseded', tone: 'neutral' },
};

const FILTERS: { id: QueueFilter; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'pending', label: 'Awaiting approval' },
  { id: 'advisory', label: 'Advisory' },
  { id: 'auto-applied', label: 'Auto-applied' },
  { id: 'decided', label: 'Decided' },
];

const SELECT =
  'h-8 min-w-0 rounded-md border border-line-strong bg-surface px-2 text-[13px] text-fg shadow-card transition-colors hover:border-accent-line focus-visible:shadow-focus focus-visible:outline-none';

export interface ApprovalQueueProps {
  data: PortfolioData;
  proposals: ProposedChange[];
  runs: AgentRun[];
  actingAs: string;
  personas: Persona[];
  onActAs: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onBulkApprove: (runId: string) => void;
  /** Refusal sentences returned by the actions, by proposal id. */
  refusals: Record<string, string>;
  effect: ApprovalEffect | null;
  filter: QueueFilter;
  onFilter: (f: QueueFilter) => void;
  personName: (id: string) => string;
  /** Proposals of a run still playing are held back until it finishes. */
  heldRunId: string | null;
}

export function ApprovalQueue(props: ApprovalQueueProps) {
  const { data, proposals, runs, actingAs, personas, onActAs, filter, onFilter, effect, heldRunId } = props;
  const visible = proposals.filter((p) => p.runId !== heldRunId);
  const counts = Object.fromEntries(FILTERS.map((f) => [f.id, visible.filter((p) => matchesFilter(p, f.id)).length])) as Record<QueueFilter, number>;
  const shown = visible.filter((p) => matchesFilter(p, filter));
  // Newest run first; inside a run, pending first.
  const groups = runs
    .slice()
    .reverse()
    .map((run) => ({ run, items: shown.filter((p) => p.runId === run.id).sort((a, b) => PROPOSAL_ORDER[a.status] - PROPOSAL_ORDER[b.status]) }))
    .filter((g) => g.items.length > 0);
  const persona = personas.find((p) => p.id === actingAs);
  const deliverables = new Map(data.deliverables.map((d) => [d.id, d]));

  return (
    <section aria-labelledby="queue-h" className="di-card flex min-h-0 min-w-0 flex-col" data-testid="approval-queue">
      <header className="flex flex-col gap-3 border-b border-line px-5 pt-4 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 id="queue-h" className="font-display text-[15px] font-semibold text-title">
              Approval queue
            </h3>
            <Badge size="sm" tone={counts.pending > 0 ? 'accent' : 'neutral'}>
              <span data-testid="pending-count">{counts.pending}</span>&nbsp;awaiting
            </Badge>
          </div>
          <label className="flex items-center gap-2" data-testid="persona-switch">
            <span className="text-[11.5px] font-medium text-fg-muted">Acting as</span>
            {persona ? persona.kind === 'agent' ? <Avatar kind="agent" name={persona.name} size="sm" /> : <Avatar initials={persona.initials} name={persona.name} size="sm" /> : null}
            <select className={SELECT} value={actingAs} onChange={(e) => onActAs(e.target.value)} aria-label="Acting as" data-testid="persona-select">
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.detail}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="flex items-start gap-1.5 text-[11.5px] text-fg-subtle">
          <Users aria-hidden className="mt-px size-3.5 shrink-0" />
          The presenter acts as a named sample approver. Switch to an item&apos;s assignee, or to an agent identity, to see governance refuse the approval.
        </p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter proposals">
          {FILTERS.map((f) => (
            <Chip key={f.id} selected={filter === f.id} onClick={() => onFilter(f.id)} data-testid={`queue-filter-${f.id}`}>
              {f.label}
              <span className="ml-0.5 tabular-nums opacity-70">{counts[f.id]}</span>
            </Chip>
          ))}
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4" data-testid="queue-body">
        {effect ? <EffectStrip effect={effect} deliverable={effect.after.deliverableId ? deliverables.get(effect.after.deliverableId) : undefined} /> : null}
        {groups.length === 0 ? (
          <EmptyState
            icon={<BadgeCheck />}
            title={visible.length === 0 ? 'No proposed changes yet' : 'Nothing in this filter'}
            description={
              visible.length === 0
                ? 'Run an agent that proposes changes (RAID quality, Outcome mapping, Dependency discovery). Each change waits here for a named person.'
                : 'Choose another filter to see the rest of the proposals.'
            }
          />
        ) : (
          groups.map(({ run, items }) => <RunGroup key={run.id} {...props} run={run} items={items} deliverables={deliverables} />)
        )}
      </div>
    </section>
  );
}

function RunGroup({ run, items, data, actingAs, onBulkApprove, personName, deliverables, ...rest }: ApprovalQueueProps & { run: AgentRun; items: ProposedChange[]; deliverables: Map<string, TechDeliverable> }) {
  const pending = items.filter((p) => p.status === 'pending');
  const eligible = eligibleForApproval(data, pending, actingAs);
  return (
    <section className="flex flex-col gap-2" aria-label={runTitle(data, run)} data-testid="queue-group" data-run-id={run.id}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <AgentGlyph id={run.agentId} size="sm" />
          <span className="truncate text-[12.5px] font-semibold text-fg">{runTitle(data, run)}</span>
          <span className="font-mono text-[11px] text-fg-subtle">
            {run.id} · {clockTime(run.startedAt)}
          </span>
        </div>
        {pending.length > 1 ? (
          <Button
            size="sm"
            variant="secondary"
            icon={<Check />}
            onClick={() => onBulkApprove(run.id)}
            disabledReason={eligible.length === 0 ? `None of these ${pending.length} can be approved by ${personName(actingAs)}.` : undefined}
            data-testid="bulk-approve"
          >
            Approve all eligible ({eligible.length} of {pending.length})
          </Button>
        ) : null}
      </div>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {items.map((p) => (
          <li key={p.id}>
            <ProposalCard p={p} data={data} actingAs={actingAs} personName={personName} deliverable={p.deliverableId ? deliverables.get(p.deliverableId) : undefined} {...rest} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProposalCard({
  p,
  data,
  actingAs,
  onApprove,
  onReject,
  refusals,
  personName,
  deliverable,
}: Pick<ApprovalQueueProps, 'data' | 'actingAs' | 'onApprove' | 'onReject' | 'refusals' | 'personName'> & { p: ProposedChange; deliverable: TechDeliverable | undefined }) {
  const status = STATUS[p.status];
  const rows = beforeAfterRows(p.beforeText, p.afterText);
  const approve = approvalCheck(data, p, actingAs);
  const reject = rejectionCheck(data, p, actingAs);
  const refusal = refusals[p.id];
  const policy = RISK_TIER_POLICIES[p.riskTier];
  const applied = p.status === 'approved' || p.status === 'auto-applied';
  return (
    <article
      className={cx('flex flex-col gap-2.5 rounded-md border p-3.5', p.status === 'pending' ? 'border-line-strong bg-surface' : 'border-line bg-surface-2')}
      data-testid="proposal-card"
      data-proposal-id={p.id}
      data-status={p.status}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-fg-subtle">
            <span>{AGENT_CATALOGUE[p.agentId].name}</span>
            <span aria-hidden>·</span>
            <RefChip refValue={p.target} />
            {deliverable && !(p.target.kind === 'deliverable' && p.target.id === deliverable.id) ? (
              <>
                <span>in</span>
                <RefChip refValue={{ kind: 'deliverable', id: deliverable.id }} />
              </>
            ) : null}
          </div>
          <h4 className="text-[13.5px] leading-snug font-semibold text-title">{p.title}</h4>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge size="sm" tone={status.tone}>
            {status.label}
          </Badge>
          <span className="font-mono text-[10.5px] text-fg-subtle" title={policy.description}>
            {terms.riskTiers[p.riskTier]}
          </span>
        </div>
      </header>

      <div className="overflow-hidden rounded-sm border border-line" role="table" aria-label="Before and after">
        <div role="row" className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)_minmax(0,1fr)] bg-surface-2 text-[10.5px] font-semibold tracking-wide text-fg-subtle uppercase">
          <span role="columnheader" className="px-2.5 py-1">
            Field
          </span>
          <span role="columnheader" className="px-2.5 py-1">
            Before
          </span>
          <span role="columnheader" className="px-2.5 py-1">
            {applied ? 'After (applied)' : 'After'}
          </span>
        </div>
        {rows.map((r, i) => (
          <div key={i} role="row" className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)_minmax(0,1fr)] border-t border-line text-[12.5px]">
            <span role="cell" className="px-2.5 py-1.5 font-medium text-fg-muted">
              {r.field ?? 'Change'}
            </span>
            <span role="cell" className="px-2.5 py-1.5 text-fg-muted" data-testid="before-value">
              {r.before}
            </span>
            <span role="cell" className={cx('px-2.5 py-1.5 font-medium', applied ? 'text-status-green-fg' : 'text-fg')} data-testid="after-value">
              {r.after}
            </span>
          </div>
        ))}
      </div>

      <p className="text-[12.5px] leading-snug text-fg-muted">
        <span className="font-medium text-fg">Why: </span>
        {p.rationale}
      </p>
      {p.evidence.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-fg-subtle">
          <span>Rests on</span>
          <RefList refs={p.evidence} max={5} title={`Evidence for: ${p.title}`} />
        </div>
      ) : null}

      <PolicyLine p={p} personName={personName} />

      {refusal ? (
        <p role="alert" data-testid="governance-refusal" className="flex items-start gap-2 rounded-md border border-status-red-line bg-status-red-soft px-3 py-2 text-[12.5px] text-status-red-fg">
          <ShieldAlert aria-hidden className="mt-px size-4 shrink-0" />
          <span>
            <span className="font-semibold">Refused by governance: </span>
            {refusal} <span className="opacity-80">Logged to the audit trail.</span>
          </span>
        </p>
      ) : null}

      {p.status === 'pending' ? (
        <footer className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="primary"
            icon={<Check />}
            onClick={() => onApprove(p.id)}
            disabledReason={approve.ok ? undefined : approve.reason}
            data-testid="approve-button"
          >
            Approve
          </Button>
          <Button size="sm" variant="secondary" icon={<X />} onClick={() => onReject(p.id)} disabledReason={reject.ok ? undefined : reject.reason} data-testid="reject-button">
            Reject
          </Button>
          {!approve.ok ? (
            <>
              <span className="flex min-w-0 flex-1 items-start gap-1.5 text-[12px] text-status-amber-fg" data-testid="approve-blocked-reason">
                <ShieldAlert aria-hidden className="mt-px size-3.5 shrink-0" />
                {approve.reason}
              </span>
              {!refusal ? (
                <Button size="sm" variant="ghost" onClick={() => onApprove(p.id)} data-testid="attempt-approve">
                  Attempt anyway
                </Button>
              ) : null}
            </>
          ) : (
            <span className="text-[11.5px] text-fg-subtle">as {personName(actingAs)}</span>
          )}
        </footer>
      ) : p.decision ? (
        <p className="text-[12px] text-fg-muted">
          {p.decision.decision === 'approved' ? 'Approved' : 'Rejected'} by <span className="font-medium text-fg">{personName(p.decision.approverId)}</span> at {clockTime(p.decision.decidedAt)}
          {p.decision.note ? `: ${p.decision.note}` : '.'}
        </p>
      ) : p.status === 'superseded' ? (
        <p className="text-[12px] text-fg-muted">A later run of the same agent proposed this change again; decide it there.</p>
      ) : null}
    </article>
  );
}

function PolicyLine({ p, personName }: { p: ProposedChange; personName: (id: string) => string }) {
  if (p.status === 'advisory') {
    return (
      <p className="flex items-start gap-2 rounded-md border border-status-amber-line bg-status-amber-soft px-3 py-2 text-[12px] text-status-amber-fg" data-testid="advisory-note">
        <Lightbulb aria-hidden className="mt-px size-3.5 shrink-0" />
        <span>
          <span className="font-semibold">Advice only.</span> {terms.riskTiers[p.riskTier]} items are {terms.autonomy['advisory-only'].toLowerCase()}: there is no approve control, and nothing will be applied. The
          owner can act on it in the record&apos;s own system.
        </span>
      </p>
    );
  }
  if (p.status === 'auto-applied') {
    return (
      <p className="flex items-start gap-2 rounded-md border border-status-green-line bg-status-green-soft px-3 py-2 text-[12px] text-status-green-fg" data-testid="auto-applied-note">
        <Zap aria-hidden className="mt-px size-3.5 shrink-0" />
        <span>
          <span className="font-semibold">Applied automatically under the {terms.riskTiers[p.riskTier]} policy</span> ({terms.autonomy['auto-apply'].toLowerCase()}: {autoApplyFieldsText()}). Logged; no
          approval was needed.
        </span>
      </p>
    );
  }
  return (
    <p className="flex items-center gap-1.5 text-[11.5px] text-fg-subtle">
      {p.status === 'pending' ? <ShieldCheck aria-hidden className="size-3.5" /> : <Info aria-hidden className="size-3.5" />}
      Ceiling for {terms.riskTiers[p.riskTier]}: {terms.autonomy[p.ceiling]}
      {p.ceiling === 'propose-only' ? '; a named person who is not the assignee must approve.' : '.'}
      {p.assigneeId ? (
        <span className="ml-1">
          Assignee: <span className="font-medium text-fg-muted">{personName(p.assigneeId)}</span>
        </span>
      ) : null}
      <ProvenanceBadge kind="scripted-agent" size="sm" className="ml-auto" />
    </p>
  );
}
