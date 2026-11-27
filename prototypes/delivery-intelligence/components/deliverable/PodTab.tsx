'use client';

import { CheckCircle2, UserRoundX, UsersRound, Clock3 } from 'lucide-react';
import { DemoNote, Avatar, Badge, Card, EmptyState } from '@/components/ui';
import { formatDate } from '@/lib/config/clock';
import { CORE_ROLE_SUMMARY, GATE_ROLE } from '@/lib/config/pdlc';
import { StackedBar, chartColor } from '@/components/charts';
import { terms } from '@/lib/config/terminology';
import { AGENT_CATALOGUE } from '@/lib/agents';
import type { CoreSeatRow, CoreSeatStatus, DeliverableModel } from './model';
import { RecordChip } from './records';

const STATUS: Record<CoreSeatStatus, { label: string; tone: 'green' | 'amber' | 'red'; icon: React.ReactNode }> = {
  'in-place': { label: terms.coreTeam.inPlace, tone: 'green', icon: <CheckCircle2 /> },
  'not-named': { label: terms.coreTeam.missing, tone: 'red', icon: <UserRoundX /> },
  'two-roles': { label: 'Holds two roles', tone: 'amber', icon: <UsersRound /> },
  'joined-late': { label: terms.coreTeam.joinedLate, tone: 'amber', icon: <Clock3 /> },
};

function CoreSeat({ seat }: { seat: CoreSeatRow }) {
  const gate = seat.roleId === GATE_ROLE;
  return (
    <li
      className={`flex min-w-0 flex-col gap-2 rounded-md border p-3 ${gate ? 'border-accent-line bg-accent-soft' : 'border-line bg-surface'}`}
      data-testid={`core-seat-${seat.roleId}`}
      title={CORE_ROLE_SUMMARY[seat.roleId]}
    >
      <span className="di-eyebrow">{gate ? `${terms.coreRoles[seat.roleId]} · decides the gate` : terms.coreRoles[seat.roleId]}</span>
      <span className="flex min-w-0 items-center gap-2.5">
        {seat.person ? (
          <Avatar initials={seat.person.initials} name={seat.person.name} size="md" />
        ) : (
          <span aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-dashed border-status-red-line bg-status-red-soft text-status-red-fg">
            <UserRoundX className="size-4" />
          </span>
        )}
        <span className="flex min-w-0 flex-col leading-tight">
          <span className={`truncate text-[13px] font-medium ${seat.person ? 'text-fg' : 'text-status-red-fg'}`} data-testid={`core-seat-name-${seat.roleId}`}>
            {seat.person?.name ?? terms.coreTeam.missing}
          </span>
          <span className="truncate text-xs text-fg-subtle">{seat.person ? `${terms.coreTeam.joined} ${seat.joinedAt ? formatDate(seat.joinedAt) : 'date not recorded'}` : 'Nobody can decide this role’s reviews'}</span>
        </span>
      </span>
      <span className="flex flex-wrap gap-1.5" data-testid={`core-seat-status-${seat.roleId}`}>
        {seat.statuses.map((st) => (
          <Badge key={st} size="sm" tone={STATUS[st].tone} icon={STATUS[st].icon}>
            {STATUS[st].label}
          </Badge>
        ))}
      </span>
    </li>
  );
}

function CoreFourPanel({ model }: { model: DeliverableModel }) {
  const { coreFour } = model;
  return (
    <Card
      level={4}
      padding="sm"
      eyebrow="Named on this deliverable"
      title={`${terms.coreTeam.name}${coreFour.gaps > 0 ? `: ${coreFour.gaps} ${coreFour.gaps === 1 ? 'seat needs' : 'seats need'} attention` : ''}`}
      description={`Each stage's reviews are decided by these four people: the specialists confirm first, then the ${terms.coreRoles[GATE_ROLE]} decides the gate. Each role needs a different person, in place before work starts.`}
    >
      <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 xl:grid-cols-4" data-testid="core-four">
        {coreFour.seats.map((seat) => (
          <CoreSeat key={seat.roleId} seat={seat} />
        ))}
      </ul>
      {coreFour.workStartedAt ? (
        <p className="mt-2.5 text-xs text-fg-muted">
          Work had started by {formatDate(coreFour.workStartedAt.slice(0, 10))}
          {coreFour.workStartedKey ? ` (${coreFour.workStartedKey} left ${terms.statusCategories['to-do'].toLowerCase()})` : ''}.
        </p>
      ) : null}
    </Card>
  );
}

export function PodTab({ model }: { model: DeliverableModel }) {
  const { pod, members, agents, share } = model;
  if (!pod)
    return (
      <div className="flex flex-col gap-4">
        <CoreFourPanel model={model} />
        <EmptyState title="No pod is assigned" description="Pod members and agent identities appear here once a pod is set for this deliverable." />
      </div>
    );
  const total = share.human + share.agent;
  return (
    <div className="flex flex-col gap-4">
      <CoreFourPanel model={model} />
      <Card
        level={4}
        padding="sm"
        title={`${pod.name}`}
        description={pod.focus}
        eyebrow="Human and agent share of this deliverable's work"
      >
        {total === 0 ? (
          <p className="text-[13px] text-fg-muted">No story-level work yet, so the human and agent share is not computable.</p>
        ) : (
          <div className="flex flex-col gap-2" data-testid="work-share">
            <StackedBar
              size="md"
              ariaLabel={`${share.human} items assigned to people and ${share.agent} to agents`}
              segments={[
                { id: 'human', label: `People: ${share.human} items, ${share.humanPoints} points`, value: share.human, color: chartColor(0) },
                { id: 'agent', label: `Agents: ${share.agent} items, ${share.agentPoints} points`, value: share.agent, color: chartColor(2) },
              ]}
            />
            <p className="text-xs text-fg-muted tabular-nums">Agents hold {Math.round(share.agentShare * 100)}% of items. Every agent item needs a named human reviewer.</p>
          </div>
        )}
      </Card>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card level={4} padding="sm" title={`People (${members.length})`}>
          <ul className="m-0 flex list-none flex-col divide-y divide-line p-0">
            {members.map((m) => (
              <li key={m.person.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <span className="flex min-w-0 items-center gap-2.5">
                  <Avatar initials={m.person.initials} name={m.person.name} size="md" />
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate text-[13px] font-medium text-fg">{m.person.name}</span>
                    <span className="truncate text-xs text-fg-subtle">{m.person.title}</span>
                  </span>
                </span>
                <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 text-xs text-fg-muted tabular-nums">
                  {m.isOwner ? <Badge size="sm" tone="accent">Owner</Badge> : null}
                  {m.isLead ? <Badge size="sm" tone="neutral">Pod lead</Badge> : null}
                  <span>{m.assigned} assigned</span>
                  <span>{m.reviewing} reviewing</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card level={4} padding="sm" title={`Agent identities (${agents.length})`} description="Scripted agents named on this pod. An agent never approves, accepts an outcome or sets readiness.">
          {agents.length === 0 ? (
            <p className="text-[13px] text-fg-muted">No agent identities are attached to this pod.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col divide-y divide-line p-0">
              {agents.map((a) => {
                const owner = model.ctx.idx.people.get(a.identity.accountableOwnerId);
                return (
                  <li key={a.identity.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Avatar kind="agent" name={a.identity.handle} size="md" />
                      <span className="flex min-w-0 flex-col leading-tight">
                        <span className="truncate font-mono text-xs font-medium text-fg">{a.identity.handle}</span>
                        <span className="truncate text-xs text-fg-subtle">
                          {AGENT_CATALOGUE[a.identity.agentId]?.name ?? a.identity.agentId} · accountable: {owner?.name ?? 'Not named'}
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-fg-muted tabular-nums">{a.assigned} items</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
      <p className="text-xs text-fg-subtle">
        Pod <RecordChip to={{ kind: 'pod', id: pod.id }} label={pod.name} /> sits in {model.ctx.idx.hubs.get(pod.hubId)?.city ?? 'its hub'}. <DemoNote>{terms.app.demoNotice}.</DemoNote>
      </p>
    </div>
  );
}
