'use client';

/**
 * Record chips and the side drawer that opens the record behind any claim:
 * work item, evidence record, RAID item, dependency, milestone, outcome,
 * criterion, finding and a few reference records. One drawer serves the
 * whole screen (the findings, the tables and the drafted status citations).
 */
import {
  CalendarDays,
  CircleDot,
  FileCheck2,
  Flag,
  GitBranch,
  Link2,
  ListChecks,
  MapPin,
  ShieldAlert,
  SquareKanban,
  Target,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { ProvenanceBadge } from '@/components/shell';
import { Avatar, Drawer, KeyValue, ReadinessPill, RagPill, SeverityBadge, cx, type KeyValueItem } from '@/components/ui';
import { FOCUS_RING } from '@/components/ui/cx';
import { formatDate, daysBetween } from '@/lib/config/clock';
import { terms } from '@/lib/config/terminology';
import { RULE_DESCRIPTIONS } from '@/lib/config/thresholds';
import { hrefs } from '@/lib/config/routes';
import { resolveRef } from '@/lib/agents';
import { dependencyLateDays, evidenceStaleness, type EngineContext } from '@/lib/engine';
import { recordState } from '@/lib/engine/evidence';
import { useDemoState } from '@/lib/store';
import type {
  AcceptanceCriterion,
  Dependency,
  EntityKind,
  EntityRef,
  Evidence,
  Finding,
  Milestone,
  Outcome,
  Person,
  RaidItem,
  WorkItem,
} from '@/lib/types';
import { buildContext } from '@/lib/engine';

const KIND_LABEL: Partial<Record<EntityKind, string>> = {
  'investment-request': terms.hierarchy.investmentRequest,
  'pm-node': terms.hierarchy.programme,
  deliverable: terms.hierarchy.deliverableShort,
  outcome: terms.hierarchy.outcome,
  criterion: terms.hierarchy.criterion,
  'work-item': 'Work item',
  evidence: 'Evidence record',
  raid: 'RAID item',
  dependency: 'Dependency',
  milestone: 'Milestone',
  hub: 'Hub',
  pod: 'Pod',
  person: 'Person',
  'agent-identity': 'Agent identity',
  sprint: 'Sprint',
  finding: 'Finding',
  'agent-run': 'Agent run',
  proposal: 'Proposed change',
  'status-draft': 'Status draft',
};

const KIND_ICON: Partial<Record<EntityKind, LucideIcon>> = {
  deliverable: Target,
  outcome: Target,
  criterion: ListChecks,
  'work-item': SquareKanban,
  evidence: FileCheck2,
  raid: ShieldAlert,
  dependency: GitBranch,
  milestone: Flag,
  hub: MapPin,
  pod: Users,
  person: UserRound,
  finding: CircleDot,
  sprint: CalendarDays,
};

export const kindLabel = (k: EntityKind): string => KIND_LABEL[k] ?? k;

interface RecordsContextValue {
  open: (ref: EntityRef) => void;
}
const RecordsContext = createContext<RecordsContextValue | null>(null);

/** Opens the record drawer for a reference. Falls back to a no-op outside the provider. */
export function useOpenRecord(): (ref: EntityRef) => void {
  return useContext(RecordsContext)?.open ?? (() => {});
}

/** Label for a reference (short id, key or title), resolved against the live state. */
export function useRefLabel(): (ref: EntityRef) => string {
  const state = useDemoState((s) => s);
  return useCallback((ref) => resolveRef(state, ref)?.label ?? ref.id, [state]);
}

/**
 * Clickable reference. Shows the record's short label and opens the drawer.
 *   <RecordChip to={{ kind: 'work-item', id: 'CCR-203' }} />
 */
export function RecordChip({ to, label, className, showKind = true }: { to: EntityRef; label?: ReactNode; className?: string; showKind?: boolean }) {
  const open = useOpenRecord();
  const resolve = useRefLabel();
  const Icon = KIND_ICON[to.kind] ?? Link2;
  const text = label ?? resolve(to);
  return (
    <button
      type="button"
      onClick={() => open(to)}
      title={`Open ${kindLabel(to.kind).toLowerCase()}`}
      data-record-chip={`${to.kind}:${to.id}`}
      className={cx(
        'inline-flex max-w-full items-center gap-1 rounded-sm border border-line bg-surface-2 px-1.5 py-0.5 align-baseline text-xs font-medium text-accent transition-colors hover:border-accent-line hover:bg-accent-soft',
        FOCUS_RING,
        className,
      )}
    >
      {showKind ? <Icon aria-hidden className="size-3 shrink-0 text-fg-subtle" /> : null}
      <span className="truncate">{text}</span>
    </button>
  );
}

function PersonValue({ person, agentHandle }: { person?: Person; agentHandle?: string }) {
  if (agentHandle) {
    return (
      <span className="inline-flex items-center gap-2">
        <Avatar kind="agent" name={agentHandle} size="xs" />
        <span className="font-mono text-xs">{agentHandle}</span>
      </span>
    );
  }
  if (!person) return <span className="text-fg-subtle">Not assigned</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <Avatar initials={person.initials} name={person.name} size="xs" />
      {person.name}
    </span>
  );
}

function RecordBody({ r, ctx }: { r: ReturnType<typeof resolveRef> & {}; ctx: EngineContext }) {
  const idx = ctx.idx;
  const clock = ctx.clock;
  const state = useDemoState((s) => s);
  const rec = r.record;
  const d = (date: string | null | undefined) => (date ? formatDate(date) : 'Not set');
  const age = (date: string) => {
    const n = daysBetween(date, clock.today);
    return `${formatDate(date)} (${n === 0 ? 'today' : `${n} day${n === 1 ? '' : 's'} ago`})`;
  };

  switch (r.ref.kind) {
    case 'work-item': {
      const w = rec as WorkItem;
      const agent = w.assigneeType === 'agent' && w.assigneeId ? idx.agentIdentities.get(w.assigneeId) : undefined;
      const outcome = w.outcomeId ? idx.outcomes.get(w.outcomeId) : undefined;
      const items: KeyValueItem[] = [
        { label: 'Summary', value: w.summary },
        { label: 'Type', value: terms.workItemTypes[w.type] },
        { label: 'Status', value: `${w.status} (${terms.statusCategories[w.statusCategory]})` },
        { label: 'Points', value: w.points ?? 'Not estimated' },
        { label: 'Assignee', value: <PersonValue person={w.assigneeType === 'human' && w.assigneeId ? idx.people.get(w.assigneeId) : undefined} agentHandle={agent?.handle} /> },
        { label: 'Named reviewer', value: w.reviewerId ? <PersonValue person={idx.people.get(w.reviewerId)} /> : <span className="font-medium text-status-amber-fg">None named</span> },
        { label: terms.hierarchy.outcomeIdField, value: outcome ? <RecordChip to={{ kind: 'outcome', id: outcome.id }} /> : <span className="font-medium text-status-amber-fg">None</span> },
        { label: terms.hierarchy.epic, value: w.epicKey ? <RecordChip to={{ kind: 'work-item', id: w.epicKey }} /> : 'None' },
        { label: 'Sprint', value: w.sprintId ? (idx.sprints.get(w.sprintId)?.name ?? w.sprintId) : 'Not in a sprint' },
        { label: 'Due', value: d(w.due) },
        { label: 'Last updated', value: age(w.updated) },
        { label: 'Source', value: terms.systems['work-tracker'] },
      ];
      return <KeyValue columns={2} items={items} />;
    }
    case 'evidence': {
      const e = rec as Evidence;
      const st = evidenceStaleness(ctx, e);
      const held = recordState(e, st);
      const items: KeyValueItem[] = [
        { label: 'Kind', value: terms.evidenceKinds[e.kind] },
        { label: 'Result', value: `${terms.evidenceResults[e.result]}${held === 'stale' ? ' (stale)' : ''}` },
        { label: 'Source', value: `${terms.systems[e.source]}`, hint: e.sourceRef },
        { label: 'Observed', value: age(e.observedAt) },
        { label: 'Recorded by', value: e.recordedById ? <PersonValue person={idx.people.get(e.recordedById)} /> : 'Automated source' },
        {
          label: 'Covers',
          value: e.workItemKey ? <RecordChip to={{ kind: 'work-item', id: e.workItemKey }} /> : e.outcomeId ? <RecordChip to={{ kind: 'outcome', id: e.outcomeId }} /> : 'The whole deliverable',
        },
        { label: 'Provenance', value: <ProvenanceBadge kind={e.provenance} size="sm" /> },
        {
          label: 'Currency',
          value: st.stale ? (
            <span className="font-medium text-status-amber-fg">
              Stale: {st.changedItemKey ? <RecordChip to={{ kind: 'work-item', id: st.changedItemKey }} /> : 'covered work'} changed {st.workChangedAt ? formatDate(st.workChangedAt) : ''} after it was observed
            </span>
          ) : (
            'No covered work has changed since it was observed'
          ),
        },
      ];
      return <KeyValue columns={2} items={items} />;
    }
    case 'raid': {
      const x = rec as RaidItem;
      const n = daysBetween(x.updated, clock.today);
      const items: KeyValueItem[] = [
        { label: 'Title', value: x.title },
        { label: 'Kind', value: terms.raidKinds[x.kind] },
        { label: 'Severity', value: <SeverityBadge severity={x.severity} size="sm" /> },
        { label: 'Status', value: x.status },
        { label: 'Owner', value: x.ownerId ? <PersonValue person={idx.people.get(x.ownerId)} /> : <span className="font-medium text-status-amber-fg">No owner</span> },
        { label: 'Last updated', value: age(x.updated), hint: n > 14 ? 'No update for more than the 14-day threshold' : undefined },
        { label: 'Mitigation due', value: x.mitigationDue ? formatDate(x.mitigationDue) : <span className="font-medium text-status-amber-fg">No date set</span> },
      ];
      return (
        <div className="flex flex-col gap-4">
          <KeyValue columns={2} items={items} />
          {x.description ? <p className="text-[13px] leading-relaxed text-fg-muted">{x.description}</p> : null}
        </div>
      );
    }
    case 'dependency': {
      const x = rec as Dependency;
      const from = idx.deliverables.get(x.fromDeliverableId);
      const to = idx.deliverables.get(x.toDeliverableId);
      const late = dependencyLateDays(x, clock);
      const items: KeyValueItem[] = [
        { label: 'Provider', value: from ? <RecordChip to={{ kind: 'deliverable', id: from.id }} label={`${from.ref} (${idx.hubs.get(x.fromHubId)?.city ?? ''})`} /> : x.fromDeliverableId },
        { label: 'Receiver', value: to ? <RecordChip to={{ kind: 'deliverable', id: to.id }} label={`${to.ref} (${idx.hubs.get(x.toHubId)?.city ?? ''})`} /> : x.toDeliverableId },
        { label: 'Needed by', value: formatDate(x.needBy) },
        { label: 'Committed', value: d(x.committed) },
        { label: 'Delivered', value: d(x.deliveredOn) },
        { label: 'Status', value: terms.dependencyStatus[x.status] },
        { label: 'Days late', value: late > 0 ? `${late}` : 'Not late' },
        { label: 'Critical', value: x.critical ? 'Yes' : 'No' },
        { label: 'Linked RAID item', value: x.raidKey ? <RecordChip to={{ kind: 'raid', id: idx.raid.get(x.raidKey)?.id ?? x.raidKey }} label={x.raidKey} /> : 'None' },
        { label: 'Origin', value: x.origin === 'agent-proposed' ? 'Proposed by a scripted agent' : terms.ragKinds.reported },
      ];
      return (
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-fg">{x.title}</p>
          <KeyValue columns={2} items={items} />
        </div>
      );
    }
    case 'milestone': {
      const x = rec as Milestone;
      const items: KeyValueItem[] = [
        { label: 'Date', value: age(x.date) },
        { label: 'Regulatory', value: x.regulatory ? 'Yes, regulatory milestone' : 'No' },
        { label: 'Status', value: x.status },
        { label: 'Linked outcomes', value: x.outcomeIds.length === 0 ? 'None' : <span className="flex flex-wrap gap-1">{x.outcomeIds.map((id) => <RecordChip key={id} to={{ kind: 'outcome', id }} />)}</span> },
        { label: 'Linked work', value: x.workItemKeys.length === 0 ? 'None' : <span className="flex flex-wrap gap-1">{x.workItemKeys.slice(0, 8).map((k) => <RecordChip key={k} to={{ kind: 'work-item', id: k }} />)}</span> },
      ];
      return <KeyValue columns={2} items={items} />;
    }
    case 'outcome': {
      const x = rec as Outcome;
      const m = state.results.outcomes[x.id];
      const crit = idx.criteriaByOutcome.get(x.id) ?? [];
      const items: KeyValueItem[] = [
        { label: 'Weight', value: x.weight },
        { label: 'Due', value: formatDate(x.dueDate) },
        { label: `Reported (${terms.systems['portfolio-system']})`, value: x.reportedStatus },
        { label: 'Acceptance owner', value: <PersonValue person={idx.people.get(x.acceptanceOwnerId)} /> },
        { label: 'Accepted', value: m?.acceptance.accepted ? 'Yes' : `No: ${m?.acceptance.mandatoryAccepted ?? 0} of ${m?.acceptance.mandatoryCount ?? 0} mandatory criteria accepted` },
        { label: terms.measures.workCompletion, value: m?.workCompletion.computable ? `${m.workCompletion.value.percent}% (${m.workCompletion.value.closedPoints} of ${m.workCompletion.value.totalPoints} points)` : terms.measures.notComputable },
      ];
      return (
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-fg">{x.title}</p>
          <KeyValue columns={2} items={items} />
          <div>
            <div className="di-eyebrow mb-2">Acceptance criteria</div>
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {crit.map((c) => (
                <li key={c.id} className="flex items-start gap-2 text-[13px]">
                  <RecordChip to={{ kind: 'criterion', id: c.id }} label={terms.criterionStates[c.state]} showKind={false} />
                  <span className="text-fg-muted">{c.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      );
    }
    case 'criterion': {
      const x = rec as AcceptanceCriterion;
      const items: KeyValueItem[] = [
        { label: 'State', value: terms.criterionStates[x.state] },
        { label: 'Mandatory', value: x.mandatory ? 'Yes' : 'No' },
        { label: 'Outcome', value: <RecordChip to={{ kind: 'outcome', id: x.outcomeId }} /> },
        { label: 'Accepted by', value: x.acceptedById ? <PersonValue person={idx.people.get(x.acceptedById)} /> : 'Nobody yet' },
        { label: 'Accepted at', value: x.acceptedAt ? formatDate(x.acceptedAt) : 'Not accepted' },
        ...(x.rejectionReason ? [{ label: 'Rejection reason', value: x.rejectionReason } as KeyValueItem] : []),
      ];
      return (
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-fg">{x.text}</p>
          <KeyValue columns={2} items={items} />
        </div>
      );
    }
    case 'finding': {
      const f = rec as Finding;
      return (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <SeverityBadge severity={f.severity} size="sm" />
            <span className="font-mono text-xs text-fg-muted">{f.ruleId}</span>
            <ProvenanceBadge kind={f.provenance} size="sm" />
          </div>
          <p className="text-[13px] text-fg">{f.message}</p>
          <KeyValue columns={1} items={[{ label: 'Rule', value: RULE_DESCRIPTIONS[f.ruleId] }]} />
          <div>
            <div className="di-eyebrow mb-2">Records it rests on</div>
            <div className="flex flex-wrap gap-1.5">
              {f.evidence.map((e) => (
                <RecordChip key={`${e.kind}:${e.id}`} to={e} />
              ))}
            </div>
          </div>
        </div>
      );
    }
    case 'deliverable': {
      const x = idx.deliverables.get(r.ref.id);
      if (!x) return null;
      const rag = state.results.deliverableRag[x.id];
      const m = state.results.deliverables[x.id];
      return (
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-fg">{x.title}</p>
          <div className="flex flex-wrap items-center gap-3">
            <RagPill status={x.reportedRag} size="sm" label={`${terms.ragKinds.reported} ${terms.rag[x.reportedRag]}`} />
            {rag ? <RagPill status={rag.evidence} size="sm" label={`${terms.ragKinds.evidence} ${terms.rag[rag.evidence]}`} /> : null}
            {m ? <ReadinessPill state={m.readiness.state} size="sm" /> : null}
          </div>
        </div>
      );
    }
    case 'person': {
      const p = rec as Person;
      return (
        <KeyValue
          columns={2}
          items={[
            { label: 'Name', value: <PersonValue person={p} /> },
            { label: 'Title', value: p.title },
            { label: 'Hub', value: idx.hubs.get(p.hubId)?.city ?? p.hubId },
            { label: 'Roles', value: p.roles.join(', ') },
          ]}
        />
      );
    }
    default:
      return <p className="text-[13px] text-fg-muted">{r.label}</p>;
  }
}

function drawerFooter(r: NonNullable<ReturnType<typeof resolveRef>>, currentId: string): ReactNode {
  if (r.ref.kind === 'deliverable' && r.ref.id !== currentId) {
    return (
      <Link href={hrefs.deliverable(r.ref.id)} className={cx('inline-flex h-9 items-center rounded-md bg-accent px-3.5 text-[13px] font-medium text-on-accent', FOCUS_RING)}>
        Open deliverable
      </Link>
    );
  }
  return null;
}

/**
 * Provides the drawer to a subtree. Records of the current deliverable open in place;
 * a reference to another deliverable offers a link to its page.
 */
export function RecordsProvider({ deliverableId, children }: { deliverableId: string; children: ReactNode }) {
  const [ref, setRef] = useState<EntityRef | null>(null);
  const state = useDemoState((s) => s);
  const ctx = useMemo(() => buildContext(state.data, state.clock), [state.data, state.clock]);
  const resolved = useMemo(() => (ref ? resolveRef(state, ref) : null), [state, ref]);
  const value = useMemo<RecordsContextValue>(() => ({ open: setRef }), []);
  const open = ref !== null;
  return (
    <RecordsContext.Provider value={value}>
      {children}
      <Drawer
        open={open}
        onClose={() => setRef(null)}
        width="lg"
        eyebrow={ref ? `${kindLabel(ref.kind)} record` : undefined}
        title={resolved ? resolved.label : ref ? `${kindLabel(ref.kind)} not found` : ''}
        footer={resolved ? drawerFooter(resolved, deliverableId) : undefined}
      >
        {resolved ? (
          <RecordBody r={resolved} ctx={ctx} />
        ) : (
          <p className="text-[13px] text-fg-muted">This record no longer exists in the current data.</p>
        )}
      </Drawer>
    </RecordsContext.Provider>
  );
}

