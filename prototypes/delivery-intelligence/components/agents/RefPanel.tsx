'use client';

/**
 * Side panel that opens any cited or referenced record (a draft citation, a
 * step reference, a proposal's evidence). Records are resolved with
 * `resolveRef` against the live store, so the panel always shows current data.
 */
import { ArrowUpRight, FileSearch } from 'lucide-react';
import Link from 'next/link';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { ProvenanceBadge } from '@/components/shell';
import { Badge, Drawer, KeyValue, RagPair, ReadinessPill, SeverityBadge, cx, type KeyValueItem } from '@/components/ui';
import { resolveRef } from '@/lib/agents';
import { formatDate } from '@/lib/config/clock';
import { hrefs } from '@/lib/config/routes';
import { terms } from '@/lib/config/terminology';
import { useDemoState } from '@/lib/store';
import type {
  AcceptanceCriterion,
  Dependency,
  DemoState,
  EntityKind,
  EntityRef,
  Evidence,
  Finding,
  Milestone,
  Outcome,
  PmNode,
  RaidItem,
  TechDeliverable,
  WorkItem,
} from '@/lib/types';
import { deliverableIdForRef } from './model';

interface OpenRequest {
  refs: EntityRef[];
  /** Heading of the panel, e.g. "Citation 4". */
  title: string;
  /** The sentence or step that cites the records. */
  quote?: string;
}

const RefPanelContext = createContext<((req: OpenRequest) => void) | null>(null);

export function useOpenRefs(): (req: OpenRequest) => void {
  const ctx = useContext(RefPanelContext);
  return ctx ?? (() => {});
}

const KIND_LABEL: Record<EntityKind, string> = {
  'investment-request': terms.hierarchy.investmentRequest,
  'pm-node': 'Programme node',
  deliverable: terms.hierarchy.deliverable,
  outcome: terms.hierarchy.outcome,
  criterion: terms.hierarchy.criterion,
  'work-item': 'Work item',
  evidence: 'Evidence',
  raid: 'RAID item',
  dependency: 'Dependency',
  milestone: 'Milestone',
  hub: 'Hub',
  pod: 'Pod',
  person: 'Person',
  'agent-identity': 'Agent identity',
  sprint: 'Sprint',
  'pdlc-run': 'PDLC workflow',
  finding: 'Finding',
  'agent-run': 'Agent run',
  proposal: 'Proposed change',
  approval: 'Approval',
  'status-draft': 'Draft',
  'audit-event': 'Audit event',
};

export function RefPanelProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<OpenRequest | null>(null);
  const open = useCallback((r: OpenRequest) => setReq(r), []);
  return (
    <RefPanelContext.Provider value={open}>
      {children}
      <Drawer
        open={req !== null}
        onClose={() => setReq(null)}
        width="lg"
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <FileSearch aria-hidden className="size-3.5" /> Cited records
          </span>
        }
        title={req?.title ?? ''}
      >
        {req ? <PanelBody req={req} /> : null}
      </Drawer>
    </RefPanelContext.Provider>
  );
}

const selectState = (s: DemoState) => s;

function PanelBody({ req }: { req: OpenRequest }) {
  const state = useDemoState(selectState);
  return (
    <div className="flex flex-col gap-5" data-testid="ref-panel">
      {req.quote ? (
        <blockquote className="rounded-md border-l-2 border-accent bg-surface-2 px-4 py-3 text-[13.5px] leading-relaxed text-fg">
          {req.quote}
          <div className="mt-2">
            <ProvenanceBadge kind="scripted-agent" size="sm" />
          </div>
        </blockquote>
      ) : null}
      <p className="text-xs text-fg-muted">
        {req.refs.length} record{req.refs.length === 1 ? '' : 's'}, resolved from the current data.
      </p>
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {req.refs.map((ref, i) => (
          <li key={`${ref.kind}:${ref.id}:${i}`}>
            <RecordCard state={state} refValue={ref} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function RecordCard({ state, refValue }: { state: DemoState; refValue: EntityRef }) {
  const resolved = resolveRef(state, refValue);
  const deliverableId = deliverableIdForRef(state, refValue);
  const deliverable = deliverableId ? state.data.deliverables.find((d) => d.id === deliverableId) : undefined;
  if (!resolved) {
    return (
      <div className="rounded-md border border-dashed border-line-strong p-4 text-[13px] text-fg-muted">
        {KIND_LABEL[refValue.kind]} <span className="font-mono">{refValue.id}</span> no longer resolves in the current data.
      </div>
    );
  }
  const { title, items, status } = describe(state, refValue, resolved.record);
  return (
    <article className="di-card flex flex-col gap-3 p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="di-eyebrow mb-1">
            {KIND_LABEL[refValue.kind]} · <span className="font-mono normal-case">{resolved.label}</span>
          </div>
          <h3 className="text-[14px] leading-snug font-semibold text-title">{title}</h3>
        </div>
        {status}
      </header>
      {items.length > 0 ? <KeyValue items={items} layout="inline" /> : null}
      {deliverable ? (
        <Link
          href={hrefs.deliverable(deliverable.id)}
          className="inline-flex w-fit items-center gap-1 rounded-sm text-[13px] font-medium text-accent hover:underline focus-visible:shadow-focus focus-visible:outline-none"
        >
          Open {deliverable.ref} <ArrowUpRight aria-hidden className="size-3.5" />
        </Link>
      ) : null}
    </article>
  );
}

function personName(state: DemoState, id: string | null | undefined): string {
  if (!id) return 'None';
  return state.data.people.find((p) => p.id === id)?.name ?? state.data.agentIdentities.find((a) => a.id === id)?.handle ?? id;
}

function describe(state: DemoState, ref: EntityRef, record: unknown): { title: string; items: KeyValueItem[]; status?: ReactNode } {
  const date = (d: string | null | undefined) => (d ? formatDate(d) : 'None');
  switch (ref.kind) {
    case 'deliverable': {
      const d = record as TechDeliverable;
      const rag = state.results.deliverableRag[d.id];
      const m = state.results.deliverables[d.id];
      return {
        title: d.title,
        status: rag ? <RagPair reported={rag.reported} evidence={rag.evidence} size="sm" /> : undefined,
        items: [
          { label: 'Risk tier', value: terms.riskTiers[d.riskTier] },
          { label: terms.measures.workCompletion, value: m?.workCompletion.computable ? `${m.workCompletion.value.percent}%` : terms.measures.notComputable },
          { label: terms.measures.acceptedOutcomes, value: m?.acceptedOutcomes.computable ? `${m.acceptedOutcomes.value.acceptedCount} of ${m.acceptedOutcomes.value.totalCount}` : terms.measures.notComputable },
          { label: terms.measures.readiness, value: m ? <ReadinessPill state={m.readiness.state} size="sm" /> : '—' },
          { label: 'Owner', value: personName(state, d.ownerId) },
        ],
      };
    }
    case 'work-item': {
      const w = record as WorkItem;
      return {
        title: w.summary,
        status: <Badge size="sm">{w.status}</Badge>,
        items: [
          { label: 'Type', value: terms.workItemTypes[w.type] },
          { label: terms.hierarchy.outcomeIdField, value: w.outcomeId ? (state.data.outcomes.find((o) => o.id === w.outcomeId)?.ref ?? w.outcomeId) : 'None', mono: true },
          { label: 'Assignee', value: `${personName(state, w.assigneeId)}${w.assigneeType === 'agent' ? ' (agent)' : ''}` },
          { label: 'Reviewer', value: personName(state, w.reviewerId) },
          { label: 'Points', value: w.points ?? 'Not estimated' },
          { label: 'Due', value: date(w.due) },
          { label: 'Updated', value: date(w.updated) },
        ],
      };
    }
    case 'evidence': {
      const e = record as Evidence;
      const tone = e.result === 'pass' ? 'green' : e.result === 'fail' ? 'red' : 'unknown';
      return {
        title: e.title,
        status: <Badge size="sm" tone={tone}>{terms.evidenceResults[e.result]}</Badge>,
        items: [
          { label: 'Kind', value: terms.evidenceKinds[e.kind] },
          { label: 'Source', value: `${terms.systems[e.source]} · ${e.sourceRef}` },
          { label: 'Observed', value: date(e.observedAt) },
          { label: 'Recorded by', value: personName(state, e.recordedById) },
          { label: 'Provenance', value: <ProvenanceBadge kind={e.provenance} size="sm" /> },
        ],
      };
    }
    case 'raid': {
      const r = record as RaidItem;
      return {
        title: r.title,
        status: <SeverityBadge severity={r.severity} size="sm" />,
        items: [
          { label: 'Kind', value: terms.raidKinds[r.kind] },
          { label: 'Status', value: r.status === 'open' ? 'Open' : r.status === 'mitigating' ? 'Mitigating' : 'Closed' },
          { label: 'Owner', value: personName(state, r.ownerId) },
          { label: 'Mitigation due', value: date(r.mitigationDue) },
          { label: 'Last updated', value: date(r.updated) },
        ],
      };
    }
    case 'dependency': {
      const d = record as Dependency;
      const ref = (id: string) => state.data.deliverables.find((x) => x.id === id)?.ref ?? id;
      return {
        title: d.title,
        status: <Badge size="sm" tone={d.status === 'late' || d.status === 'blocked' ? 'red' : d.status === 'at-risk' ? 'amber' : 'neutral'}>{terms.dependencyStatus[d.status]}</Badge>,
        items: [
          { label: 'Provided by', value: ref(d.fromDeliverableId), mono: true },
          { label: 'Needed by', value: ref(d.toDeliverableId), mono: true },
          { label: 'Need-by date', value: date(d.needBy) },
          { label: 'Committed', value: date(d.committed) },
          { label: 'Critical', value: d.critical ? 'Yes' : 'No' },
        ],
      };
    }
    case 'outcome': {
      const o = record as Outcome;
      const acc = state.results.outcomes[o.id]?.acceptance;
      return {
        title: o.title,
        items: [
          { label: 'Due', value: date(o.dueDate) },
          { label: 'Reported status', value: o.reportedStatus.replace('-', ' ') },
          { label: 'Accepted', value: acc?.accepted ? 'Yes' : 'No' },
          { label: 'Acceptance owner', value: personName(state, o.acceptanceOwnerId) },
        ],
      };
    }
    case 'criterion': {
      const c = record as AcceptanceCriterion;
      return { title: c.text, items: [{ label: 'State', value: terms.criterionStates[c.state] }, { label: 'Mandatory', value: c.mandatory ? 'Yes' : 'No' }, { label: 'Accepted by', value: personName(state, c.acceptedById) }] };
    }
    case 'milestone': {
      const m = record as Milestone;
      return { title: m.title, items: [{ label: 'Date', value: date(m.date) }, { label: 'Regulatory', value: m.regulatory ? 'Yes' : 'No' }, { label: 'Status', value: m.status }] };
    }
    case 'pm-node': {
      const n = record as PmNode;
      const rag = state.results.pmNodeRag[n.id];
      return {
        title: n.title,
        status: rag ? <RagPair reported={rag.reported} evidence={rag.evidence} size="sm" /> : undefined,
        items: [{ label: 'Level', value: terms.pmNodeLevels[n.level] }, { label: 'Owner', value: personName(state, n.ownerId) }],
      };
    }
    case 'finding': {
      const f = record as Finding;
      return { title: f.message, status: <SeverityBadge severity={f.severity} size="sm" />, items: [{ label: 'Rule', value: f.ruleId, mono: true }] };
    }
    default: {
      const rec = record as { title?: string; name?: string; summary?: string };
      return { title: rec.title ?? rec.name ?? rec.summary ?? ref.id, items: [] };
    }
  }
}

/** A clickable record reference. Shows the resolved label (a key, a ref or a title). */
export function RefChip({ refValue, className }: { refValue: EntityRef; className?: string }) {
  const open = useOpenRefs();
  const data = useDemoState(selectState);
  const label = useMemo(() => resolveRef(data, refValue)?.label ?? refValue.id, [data, refValue]);
  const short = label.length > 34 ? `${label.slice(0, 32)}…` : label;
  return (
    <button
      type="button"
      onClick={() => open({ refs: [refValue], title: `${KIND_LABEL[refValue.kind]} ${label}` })}
      title={`Open ${KIND_LABEL[refValue.kind].toLowerCase()} ${label}`}
      className={cx(
        'inline-flex h-5 max-w-full items-center rounded-xs border border-line-strong bg-surface-2 px-1.5 font-mono text-[11px] text-fg-muted transition-colors hover:border-accent-line hover:text-accent focus-visible:shadow-focus focus-visible:outline-none',
        className,
      )}
    >
      <span className="truncate">{short}</span>
    </button>
  );
}

/** Up to `max` chips, then a "+N more" button that opens them all. */
export function RefList({ refs, max = 6, title }: { refs: EntityRef[]; max?: number; title: string }) {
  const open = useOpenRefs();
  if (refs.length === 0) return null;
  const shown = refs.slice(0, max);
  return (
    <span className="flex flex-wrap items-center gap-1">
      {shown.map((r, i) => (
        <RefChip key={`${r.kind}:${r.id}:${i}`} refValue={r} />
      ))}
      {refs.length > max ? (
        <button
          type="button"
          onClick={() => open({ refs, title })}
          className="inline-flex h-5 items-center rounded-xs px-1.5 text-[11px] font-medium text-accent hover:underline focus-visible:shadow-focus focus-visible:outline-none"
        >
          +{refs.length - max} more
        </button>
      ) : null}
    </span>
  );
}
