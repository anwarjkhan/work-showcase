'use client';

import { History, RotateCcw, ScrollText, ShieldAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ProvenanceBadge } from '@/components/shell';
import { Avatar, Badge, Button, Chip, EmptyState, cx } from '@/components/ui';
import { AGENT_CATALOGUE, runFindings, runScopeOf } from '@/lib/agents';
import { formatDate } from '@/lib/config/clock';
import type { AgentRun, AuditEvent, PortfolioData, ProposedChange } from '@/lib/types';
import { AgentGlyph } from './icons';
import { AUDIT_ACTION_LABEL, AUDIT_CATEGORY_LABEL, auditCategory, clockTime, describeScope, type AuditCategory } from './model';
import { RefChip } from './RefPanel';

type ActorFilter = 'all' | 'human' | 'agent';

const CATEGORIES: AuditCategory[] = ['runs', 'proposals', 'decisions', 'governance', 'workflow'];

function ActorAvatar({ event, data }: { event: AuditEvent; data: PortfolioData }) {
  const a = event.actor;
  if (a.kind === 'agent') return <Avatar kind="agent" name={data.agentIdentities.find((x) => x.id === a.identityId)?.handle ?? AGENT_CATALOGUE[a.agentId].name} size="sm" />;
  if (a.kind === 'human') {
    const p = data.people.find((x) => x.id === a.personId);
    return <Avatar initials={p?.initials ?? '?'} name={p?.name ?? a.personId} size="sm" />;
  }
  return (
    <span aria-label="System" className="inline-flex size-6 items-center justify-center rounded-md border border-line bg-surface-2 text-[9px] font-semibold text-fg-subtle">
      SYS
    </span>
  );
}

function actorName(event: AuditEvent, data: PortfolioData): string {
  const a = event.actor;
  if (a.kind === 'agent') return data.agentIdentities.find((x) => x.id === a.identityId)?.handle ?? `${AGENT_CATALOGUE[a.agentId].name} (agent)`;
  if (a.kind === 'human') return data.people.find((x) => x.id === a.personId)?.name ?? data.agentIdentities.find((x) => x.id === a.personId)?.handle ?? a.personId;
  return 'System';
}

export function AuditTrail({ audit, runs, data }: { audit: AuditEvent[]; runs: AgentRun[]; data: PortfolioData }) {
  const [cats, setCats] = useState<AuditCategory[]>([]);
  const [actor, setActor] = useState<ActorFilter>('all');
  const counts = useMemo(() => {
    const c: Record<AuditCategory, number> = { runs: 0, proposals: 0, decisions: 0, governance: 0, workflow: 0, other: 0 };
    for (const e of audit) c[auditCategory(e.action)] += 1;
    return c;
  }, [audit]);
  const events = audit
    .filter((e) => (cats.length === 0 || cats.includes(auditCategory(e.action))) && (actor === 'all' || e.actor.kind === actor))
    .slice()
    .reverse();
  const toggle = (c: AuditCategory) => setCats((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  return (
    <div className="flex flex-col gap-3" data-testid="audit-trail">
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip selected={cats.length === 0} onClick={() => setCats([])}>
          All <span className="tabular-nums opacity-70">{audit.length}</span>
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c} selected={cats.includes(c)} onClick={() => toggle(c)} data-testid={`audit-filter-${c}`} icon={c === 'governance' ? <ShieldAlert /> : undefined}>
            {AUDIT_CATEGORY_LABEL[c]} <span className="tabular-nums opacity-70">{counts[c]}</span>
          </Chip>
        ))}
        <span className="mx-1 h-5 w-px bg-line" aria-hidden />
        {(['all', 'human', 'agent'] as ActorFilter[]).map((a) => (
          <Chip key={a} selected={actor === a} onClick={() => setActor(a)}>
            {a === 'all' ? 'Any actor' : a === 'human' ? 'People' : 'Agents'}
          </Chip>
        ))}
      </div>
      {events.length === 0 ? (
        <EmptyState
          icon={<ScrollText />}
          variant="inline"
          title={audit.length === 0 ? 'Nothing logged yet' : 'No events match these filters'}
          description={audit.length === 0 ? 'Runs, steps, proposals, approvals, rejections and governance refusals appear here as they happen.' : undefined}
        />
      ) : (
        <ol className="m-0 flex list-none flex-col divide-y divide-line rounded-md border border-line p-0" data-testid="audit-list">
          {events.map((e) => {
            const run = e.action === 'agent-run.started' && e.subject.kind === 'agent-run' ? runs.find((r) => r.id === e.subject.id) : undefined;
            const blocked = e.action === 'governance.blocked';
            return (
              <li key={e.id} className={cx('grid grid-cols-[3.25rem_1.75rem_minmax(0,1fr)] gap-x-3 px-3 py-2.5', blocked && 'bg-status-red-soft')} data-testid="audit-event" data-action={e.action}>
                <span className="pt-0.5 font-mono text-[11.5px] text-fg-subtle tabular-nums" title={formatDate(e.at)}>
                  {clockTime(e.at)}
                </span>
                <ActorAvatar event={e} data={data} />
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Badge size="sm" tone={blocked ? 'red' : e.action === 'proposal.approved' || e.action === 'proposal.auto-applied' ? 'green' : e.action === 'proposal.rejected' ? 'amber' : 'neutral'} icon={blocked ? <ShieldAlert /> : undefined}>
                      {AUDIT_ACTION_LABEL[e.action]}
                    </Badge>
                    <span className="text-[12px] font-medium text-fg-muted">{actorName(e, data)}</span>
                    <span className="font-mono text-[10.5px] text-fg-subtle">#{e.seq}</span>
                  </div>
                  <p className={cx('text-[13px] leading-snug', blocked ? 'text-status-red-fg' : 'text-fg')}>{e.summary}</p>
                  <div className="flex flex-wrap items-center gap-1">
                    {e.refs
                      .filter((r) => r.kind !== 'approval')
                      .map((r, i) => (
                        <RefChip key={`${r.kind}:${r.id}:${i}`} refValue={r} />
                      ))}
                  </div>
                  {run && run.steps.length > 0 ? (
                    <ol className="m-0 mt-1 flex list-none flex-col gap-0.5 border-l border-line p-0 pl-3 text-[12px] text-fg-muted">
                      {run.steps.map((s) => (
                        <li key={s.id} className="flex gap-2">
                          <span className="w-14 shrink-0 font-mono text-[10.5px] text-fg-subtle uppercase">Step {s.index + 1}</span>
                          <span className="min-w-0">{s.label}</span>
                        </li>
                      ))}
                    </ol>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export function RunHistory({ runs, proposals, data, activeRunId, onReopen, personName }: { runs: AgentRun[]; proposals: ProposedChange[]; data: PortfolioData; activeRunId: string | null; onReopen: (id: string) => void; personName: (id: string) => string }) {
  if (runs.length === 0) {
    return <EmptyState icon={<History />} variant="inline" title="No runs yet" description="Every run is kept here for the session; reopen one to see its steps and result again." />;
  }
  return (
    <div className="overflow-x-auto rounded-md border border-line" data-testid="run-history">
      <table className="w-full border-collapse text-left text-[13px]">
        <thead className="bg-surface-2 text-[11px] tracking-wide text-fg-subtle uppercase">
          <tr>
            <th className="px-3 py-2 font-semibold">Time</th>
            <th className="px-3 py-2 font-semibold">Agent and scope</th>
            <th className="px-3 py-2 font-semibold">Started by</th>
            <th className="px-3 py-2 font-semibold">Status</th>
            <th className="px-3 py-2 font-semibold">Result</th>
            <th className="px-3 py-2 text-right font-semibold">Findings</th>
            <th className="px-3 py-2 text-right font-semibold">Proposals</th>
            <th className="px-3 py-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {runs
            .slice()
            .reverse()
            .map((r) => {
              const own = proposals.filter((p) => p.runId === r.id);
              const open = own.filter((p) => p.status === 'pending').length;
              return (
                <tr key={r.id} className={cx('border-t border-line align-top', r.id === activeRunId && 'bg-selected')}>
                  <td className="px-3 py-2 font-mono text-[11.5px] text-fg-subtle tabular-nums">{clockTime(r.startedAt)}</td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2">
                      <AgentGlyph id={r.agentId} size="sm" />
                      <span className="min-w-0">
                        <span className="block font-medium text-fg">{AGENT_CATALOGUE[r.agentId].name}</span>
                        <span className="block text-xs text-fg-muted">{describeScope(data, runScopeOf(r))}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-fg-muted">{personName(r.startedById)}</td>
                  <td className="px-3 py-2">
                    <Badge size="sm" tone={r.status === 'completed' ? 'green' : r.status === 'failed' ? 'red' : 'neutral'}>
                      {r.status === 'completed' ? 'Completed' : r.status === 'failed' ? 'Failed' : r.status}
                    </Badge>
                  </td>
                  <td className="max-w-[420px] px-3 py-2 text-fg">{r.summary}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{runFindings(r).length}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {own.length}
                    {open > 0 ? <span className="block text-xs text-accent">{open} awaiting</span> : null}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="ghost" icon={<RotateCcw />} onClick={() => onReopen(r.id)} disabledReason={r.status !== 'completed' ? 'This run did not complete.' : undefined}>
                      Reopen
                    </Button>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
      <div className="flex items-center justify-end border-t border-line bg-surface-2 px-3 py-2">
        <ProvenanceBadge kind="scripted-agent" size="sm" />
      </div>
    </div>
  );
}
