'use client';

import { ArrowDownLeft, ArrowRight, ArrowUpRight, Clock, Globe2, MapPin, X } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ProvenanceBadge } from '@/components/shell';
import { AvatarStack, Badge, Button, IconButton, RagPair, RagPill, ReadinessPill } from '@/components/ui';
import { formatDate } from '@/lib/config/clock';
import { hrefs } from '@/lib/config/routes';
import { terms } from '@/lib/config/terminology';
import { usePortfolioIndex, useEngineResult } from '@/lib/store';
import type { DependencyStatus } from '@/lib/types';
import { ARC_STYLE } from './WorldMap';
import { CONTINENT_LABEL, HEALTH_RULE, type DependencyView, type GlobalModel, type HubView } from './model';

const DEP_TONE: Record<DependencyView['tone'], 'red' | 'amber' | 'accent' | 'neutral'> = {
  late: 'red',
  'at-risk': 'amber',
  'on-track': 'accent',
  delivered: 'neutral',
};

/** Status word for the computed tone: a dependency the engine finds late reads "Late" even if reported "At risk". */
export function toneStatus(view: DependencyView): DependencyStatus {
  if (view.tone === 'late') return view.dep.status === 'blocked' ? 'blocked' : 'late';
  return view.tone;
}

/** Dependency status as text plus a line sample matching the map's arc style. */
export function DependencyStatusBadge({ view }: { view: DependencyView }) {
  const st = ARC_STYLE[view.tone];
  return (
    <Badge
      size="sm"
      tone={DEP_TONE[view.tone]}
      icon={
        <svg aria-hidden width="16" height="6" className="shrink-0">
          <line x1="1" y1="3" x2="15" y2="3" stroke={st.stroke} strokeWidth={Math.min(3, st.width + 0.4)} strokeDasharray={st.dash} strokeLinecap="round" />
        </svg>
      }
    >
      {terms.dependencyStatus[toneStatus(view)]}
      {view.lateDays > 0 ? ` · ${view.lateDays}d` : ''}
    </Badge>
  );
}

function SubHeading({ children, count }: { children: ReactNode; count?: number }) {
  return (
    <h4 className="di-eyebrow flex items-center gap-2">
      {children}
      {count !== undefined ? <span className="rounded-pill bg-inset px-1.5 text-[10px] leading-4 text-fg-muted tabular-nums">{count}</span> : null}
    </h4>
  );
}

function DeliverableLink({ id }: { id: string }) {
  const index = usePortfolioIndex();
  const d = index.deliverables.get(id);
  if (!d) return <span className="font-mono text-xs text-fg-subtle">{id}</span>;
  return (
    <Link href={hrefs.deliverable(id)} className="rounded-xs text-accent hover:underline focus-visible:shadow-focus focus-visible:outline-none">
      <span className="font-mono text-[11px] text-fg-subtle">{d.ref}</span> {d.title}
    </Link>
  );
}

export function DependencyRow({ view, perspective }: { view: DependencyView; perspective: 'inbound' | 'outbound' | 'none' }) {
  const index = usePortfolioIndex();
  const from = index.hubs.get(view.dep.fromHubId);
  const to = index.hubs.get(view.dep.toHubId);
  const Icon = perspective === 'inbound' ? ArrowDownLeft : ArrowUpRight;
  return (
    <li className="flex flex-col gap-1 border-b border-line py-2.5 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-start gap-1.5 text-[13px] font-medium text-fg">
          {perspective !== 'none' ? <Icon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-fg-subtle" /> : null}
          <span className="min-w-0">{view.dep.title}</span>
        </span>
        <DependencyStatusBadge view={view} />
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 pl-5 text-xs text-fg-muted">
        <span className="inline-flex items-center gap-1">
          {from?.name ?? view.dep.fromHubId} <ArrowRight aria-hidden className="size-3" /> {to?.name ?? view.dep.toHubId}
        </span>
        <span className="text-fg-subtle">·</span>
        <span className="tabular-nums">Need by {formatDate(view.dep.needBy)}</span>
        {view.dep.critical ? <Badge size="sm" tone="red">Critical</Badge> : null}
        {toneStatus(view) !== view.dep.status ? <span className="text-fg-subtle">reported {terms.dependencyStatus[view.dep.status].toLowerCase()}</span> : null}
        {!view.crossHub ? <span className="text-fg-subtle">Within hub</span> : null}
      </div>
    </li>
  );
}

export function DeliverableRow({ id, lead }: { id: string; lead: boolean }) {
  const results = useEngineResult();
  const index = usePortfolioIndex();
  const d = index.deliverables.get(id);
  const m = results.deliverables[id];
  const rag = results.deliverableRag[id];
  if (!d) return null;
  return (
    <li className="flex flex-col gap-1.5 border-b border-line py-2.5 last:border-b-0">
      <div className="flex items-start justify-between gap-2 text-[13px] leading-snug">
        <DeliverableLink id={id} />
        {lead ? (
          <Badge size="sm" tone="accent">
            Lead hub
          </Badge>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-fg-muted">
        {rag ? <RagPair reported={rag.reported} evidence={rag.evidence} disagrees={rag.disagrees} size="sm" /> : null}
        {m ? (
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums">
            <span title={terms.measures.workCompletion}>
              Work {m.workCompletion.computable ? <b className="text-fg">{m.workCompletion.value.percent}%</b> : terms.measures.notComputable}
            </span>
            <span title={terms.measures.acceptedOutcomes}>
              Accepted{' '}
              {m.acceptedOutcomes.computable ? (
                <b className="text-fg">
                  {m.acceptedOutcomes.value.acceptedCount} of {m.acceptedOutcomes.value.totalCount}
                </b>
              ) : (
                terms.measures.notComputable
              )}
            </span>
            <ReadinessPill state={m.readiness.state} size="sm" />
          </span>
        ) : null}
      </div>
    </li>
  );
}

function Figure({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-md border border-line bg-surface-2 px-2.5 py-2">
      <span className="text-[11px] text-fg-subtle">{label}</span>
      <span className="font-display text-lg leading-none font-semibold text-title tabular-nums">{value}</span>
      {detail ? <span className="text-[11px] text-fg-muted tabular-nums">{detail}</span> : null}
    </div>
  );
}

export function HubDetail({ hub, onClose }: { hub: HubView; onClose: () => void }) {
  const index = usePortfolioIndex();
  const pods = hub.podIds.map((id) => index.pods.get(id)).filter((p) => p !== undefined);
  const leadSet = new Set(hub.leadDeliverableIds);
  const ordered = [...hub.deliverableIds].sort((a, b) => Number(leadSet.has(b)) - Number(leadSet.has(a)));
  const crossIn = hub.inbound.filter((d) => d.crossHub);
  const crossOut = hub.outbound.filter((d) => d.crossHub);
  const within = hub.inbound.filter((d) => !d.crossHub);

  return (
    <div className="flex flex-col gap-4" data-testid="hub-panel">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="di-eyebrow mb-1 flex items-center gap-1.5">
            <MapPin aria-hidden className="size-3" /> Delivery hub · {CONTINENT_LABEL[hub.hub.continent]}
          </div>
          <h3 className="font-display text-xl leading-tight font-semibold text-title">{hub.hub.name}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-fg-muted">
            <span>{hub.hub.country}</span>
            {hub.utcOffset ? (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Clock aria-hidden className="size-3" /> {hub.utcOffset}
                {hub.localTime ? `, ${hub.localTime} local at demo time` : ''}
              </span>
            ) : null}
          </p>
        </div>
        <IconButton label="Close hub panel" icon={<X />} size="sm" onClick={onClose} />
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
        <Figure label="Deliverables" value={hub.deliverableIds.length} detail={`${hub.leadDeliverableIds.length} led here`} />
        <Figure label="Open work" value={hub.openWork} detail={`of ${hub.totalWork}`} />
        <Figure label="People" value={hub.people} />
        <Figure label="Agents" value={hub.agents} />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
        <span>Hub health</span>
        <RagPill status={hub.health} size="sm" />
        {hub.healthScore !== null ? <span className="tabular-nums text-fg-subtle">score {hub.healthScore.toFixed(1)} of 3</span> : null}
        {hub.disagreementIds.length > 0 ? (
          <Badge size="sm" tone="amber">
            {hub.disagreementIds.length} status {hub.disagreementIds.length === 1 ? 'disagreement' : 'disagreements'}
          </Badge>
        ) : null}
      </div>

      <section className="flex flex-col gap-1.5">
        <SubHeading count={pods.length}>Pods</SubHeading>
        {pods.length === 0 ? (
          <p className="text-xs text-fg-muted">No pod is based here; people at this hub work in pods led from other hubs.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pods.map((pod) => {
              const members = pod.memberIds.map((id) => index.people.get(id)).filter((p) => p !== undefined);
              const agents = pod.agentIdentityIds.map((id) => index.agentIdentities.get(id)).filter((a) => a !== undefined);
              return (
                <li key={pod.id} className="rounded-md border border-line px-3 py-2">
                  <div className="text-[13px] font-semibold text-fg">{pod.name}</div>
                  <div className="text-xs text-fg-muted">{pod.focus}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-fg-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <AvatarStack size="xs" max={6} items={members.map((p) => ({ initials: p.initials, name: p.name }))} />
                      {members.length} {members.length === 1 ? 'person' : 'people'}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <AvatarStack size="xs" max={4} items={agents.map((a) => ({ kind: 'agent' as const, name: a.handle }))} />
                      {agents.length} {agents.length === 1 ? 'agent' : 'agents'}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col">
        <SubHeading count={hub.deliverableIds.length}>Deliverables</SubHeading>
        {ordered.length === 0 ? (
          <p className="mt-1 text-xs text-fg-muted">No deliverables are recorded at this hub.</p>
        ) : (
          <ul className="flex flex-col">
            {ordered.map((id) => (
              <DeliverableRow key={id} id={id} lead={leadSet.has(id)} />
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col">
        <SubHeading count={crossIn.length}>Inbound: this hub receives</SubHeading>
        {crossIn.length === 0 ? <p className="mt-1 text-xs text-fg-muted">No cross-hub dependencies into this hub.</p> : (
          <ul>{crossIn.map((v) => <DependencyRow key={v.dep.id} view={v} perspective="inbound" />)}</ul>
        )}
      </section>
      <section className="flex flex-col">
        <SubHeading count={crossOut.length}>Outbound: this hub provides</SubHeading>
        {crossOut.length === 0 ? <p className="mt-1 text-xs text-fg-muted">No cross-hub dependencies from this hub.</p> : (
          <ul>{crossOut.map((v) => <DependencyRow key={v.dep.id} view={v} perspective="outbound" />)}</ul>
        )}
      </section>
      {within.length > 0 ? (
        <section className="flex flex-col">
          <SubHeading count={within.length}>Within this hub</SubHeading>
          <ul>{within.map((v) => <DependencyRow key={v.dep.id} view={v} perspective="none" />)}</ul>
        </section>
      ) : null}
    </div>
  );
}

/** Shown in the panel when no hub is selected: where to look first. */
export function GlobalOverview({ model, onSelectHub, onShowHero }: { model: GlobalModel; onSelectHub: (id: string) => void; onShowHero: () => void }) {
  const attention = model.hubs.filter((h) => h.attention).sort((a, b) => b.lateDependencyIds.length - a.lateDependencyIds.length || b.disagreementIds.length - a.disagreementIds.length);
  const late = model.dependencies.filter((d) => d.crossHub && (d.tone === 'late' || d.tone === 'at-risk')).sort((a, b) => Number(b.tone === 'late') - Number(a.tone === 'late') || b.lateDays - a.lateDays);
  return (
    <div className="flex flex-col gap-4">
      <header>
        <div className="di-eyebrow mb-1 flex items-center gap-1.5">
          <Globe2 aria-hidden className="size-3" /> Where to look
        </div>
        <h3 className="font-display text-lg leading-tight font-semibold text-title">
          {model.totals.attentionHubs} of {model.totals.hubs} hubs need attention
        </h3>
        <p className="mt-1 text-xs text-fg-muted">Select a hub on the map, in this list or in the list view to see its pods, deliverables and dependencies.</p>
      </header>
      {model.heroDependency ? (
        <Button variant="secondary" size="sm" onClick={onShowHero} className="self-start">
          Show hero dependency
        </Button>
      ) : null}
      <section className="flex flex-col gap-1">
        <SubHeading count={late.length}>Cross-hub dependencies late or at risk</SubHeading>
        {late.length === 0 ? <p className="text-xs text-fg-muted">None.</p> : <ul>{late.map((v) => <DependencyRow key={v.dep.id} view={v} perspective="none" />)}</ul>}
      </section>
      <section className="flex flex-col gap-1">
        <SubHeading count={attention.length}>Hubs needing attention</SubHeading>
        <ul className="flex flex-col">
          {attention.map((h) => (
            <li key={h.hub.id}>
              <button
                type="button"
                onClick={() => onSelectHub(h.hub.id)}
                className="flex w-full items-center justify-between gap-2 rounded-sm px-1.5 py-1.5 text-left text-[13px] hover:bg-hover focus-visible:shadow-focus focus-visible:outline-none"
              >
                <span className="flex items-center gap-2">
                  <RagPill status={h.health} size="sm" />
                  <span className="font-medium text-fg">{h.hub.name}</span>
                </span>
                <span className="text-xs text-fg-muted tabular-nums">
                  {h.disagreementIds.length > 0 ? `${h.disagreementIds.length} disagree` : ''}
                  {h.disagreementIds.length > 0 && h.lateDependencyIds.length > 0 ? ' · ' : ''}
                  {h.lateDependencyIds.length > 0 ? `${h.lateDependencyIds.length} late dep.` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <p className="text-[11px] leading-relaxed text-fg-subtle">Hub health: {HEALTH_RULE.long}</p>
    </div>
  );
}

/** The hero story in one card: the late dependency crossing continents into the hero deliverable. */
export function HeroCallout({ view, onExit }: { view: DependencyView; onExit: () => void }) {
  const index = usePortfolioIndex();
  const from = index.hubs.get(view.dep.fromHubId);
  const to = index.hubs.get(view.dep.toHubId);
  const raid = view.dep.raidKey;
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-status-red-line bg-status-red-soft p-4" data-testid="hero-callout" role="region" aria-label="Hero dependency">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="di-eyebrow mb-1">Hero dependency</div>
          <h3 className="font-display text-base leading-snug font-semibold text-title">{view.dep.title}</h3>
        </div>
        <IconButton label="Exit hero view" icon={<X />} size="sm" onClick={onExit} />
      </div>
      <div className="flex items-end gap-3">
        <div className="font-display text-[44px] leading-none font-semibold text-status-red-fg tabular-nums">{view.lateDays}</div>
        <div className="pb-1 text-sm leading-tight text-status-red-fg">
          days late
          <br />
          <span className="text-xs text-fg-muted">past the receiver&apos;s need-by date</span>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div>
          <dt className="text-fg-subtle">Provider hub</dt>
          <dd className="font-semibold text-fg">
            {from?.name}
            <span className="font-normal text-fg-muted">, {from ? CONTINENT_LABEL[from.continent] : ''}</span>
          </dd>
        </div>
        <div>
          <dt className="text-fg-subtle">Receiver hub</dt>
          <dd className="font-semibold text-fg">
            {to?.name}
            <span className="font-normal text-fg-muted">, {to ? CONTINENT_LABEL[to.continent] : ''}</span>
          </dd>
        </div>
        <div>
          <dt className="text-fg-subtle">Need by</dt>
          <dd className="font-semibold text-fg tabular-nums">{formatDate(view.dep.needBy)}</dd>
        </div>
        <div>
          <dt className="text-fg-subtle">Committed</dt>
          <dd className="font-semibold text-fg tabular-nums">{view.dep.committed ? formatDate(view.dep.committed) : 'Not committed'}</dd>
        </div>
      </dl>
      <div className="flex flex-col gap-1.5 text-xs">
        <div>
          <span className="text-fg-subtle">Provides: </span>
          <DeliverableLink id={view.dep.fromDeliverableId} />
        </div>
        <div>
          <span className="text-fg-subtle">Receives: </span>
          <DeliverableLink id={view.dep.toDeliverableId} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <DependencyStatusBadge view={view} />
        {view.dep.critical ? <Badge size="sm" tone="red">Critical</Badge> : null}
        {raid ? <Badge size="sm">RAID {raid}</Badge> : null}
        <ProvenanceBadge kind="computed" size="sm" />
      </div>
    </div>
  );
}
