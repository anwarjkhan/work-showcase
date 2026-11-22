/**
 * Display formatting for facts: measure views, status words and tones, dates,
 * record labels and citations. Words come from `terms`; records are named by
 * their key or ref, never by internal id.
 */
import { formatDate } from '@/lib/config/clock';
import { terms } from '@/lib/config/terminology';
import type { MeasureRollup } from '@/lib/engine';
import type {
  AcceptedOutcomes,
  Computable,
  EntityRef,
  EvidenceRagStatus,
  Outcome,
  Provenance,
  ReadinessAssessment,
  ReadinessState,
  WorkCompletion,
} from '@/lib/types';
import type { MeasureView, ReadinessView, SlideSpec, Tone } from '../types';
import type { SlideEnv } from './common';

export type Citation = SlideSpec['citations'][number];

export const date = (d: string): string => formatDate(d);

export function ragTone(s: EvidenceRagStatus): Tone {
  return s;
}

export function ragWord(s: EvidenceRagStatus): string {
  return terms.rag[s];
}

const READINESS_TONE: Record<ReadinessState, Tone> = { ready: 'green', 'not-ready': 'red', unknown: 'unknown' };

export function readinessTone(s: ReadinessState): Tone {
  return READINESS_TONE[s];
}

/** Outcome reported status words. */
export function outcomeStatusWord(s: Outcome['reportedStatus']): string {
  return terms.outcomeStatus[s];
}

export function outcomeStatusTone(s: Outcome['reportedStatus']): Tone {
  return s === 'off-track' ? 'red' : s === 'at-risk' ? 'amber' : 'green';
}

/** "On track" means on track or complete (rule R11). */
export const reportedOnTrack = (s: Outcome['reportedStatus']): boolean => s === 'on-track' || s === 'complete';

export function workView(m: Computable<WorkCompletion> | undefined): MeasureView {
  const label = terms.measures.workCompletion;
  if (!m) return { label, value: terms.measures.notComputable, caption: 'No measures are available.', computable: false };
  if (!m.computable) return { label, value: terms.measures.notComputable, caption: m.detail, computable: false };
  const v = m.value;
  return { label, value: `${v.percent}%`, caption: `${v.closedPoints} of ${v.totalPoints} points closed`, computable: true };
}

export function acceptedView(m: Computable<AcceptedOutcomes> | undefined): MeasureView {
  const label = terms.measures.acceptedOutcomes;
  if (!m) return { label, value: terms.measures.notComputable, caption: 'No measures are available.', computable: false };
  if (!m.computable) return { label, value: terms.measures.notComputable, caption: m.detail, computable: false };
  const v = m.value;
  return {
    label,
    value: `${v.acceptedCount} of ${v.totalCount}`,
    caption: `${v.percent}% of outcome weight accepted (${v.acceptedWeight} of ${v.totalWeight})`,
    computable: true,
  };
}

/** Readiness of one deliverable: a state with the held-evidence counts, never a percentage. */
export function readinessView(r: ReadinessAssessment): ReadinessView {
  const count = (s: string) => r.held.filter((h) => h.state === s).length;
  const parts = [`${count('passing')} of ${r.requiredEvidence.length} held, passing`];
  if (count('failing') > 0) parts.push(`${count('failing')} failing`);
  if (count('missing') > 0) parts.push(`${count('missing')} missing`);
  if (count('stale') > 0) parts.push(`${count('stale')} stale`);
  if (count('pending') > 0) parts.push(`${count('pending')} pending`);
  if (r.blockingDependencyIds.length > 0) parts.push(`${r.blockingDependencyIds.length} blocking dependency`);
  return { label: terms.measures.readiness, state: r.state, stateText: terms.readiness[r.state], caption: parts.join(' · '), tone: readinessTone(r.state) };
}

/** Readiness of a set of deliverables: counts per state, never a percentage. A count is not a status, so the tone is neutral. */
export function readinessRollupView(counts: MeasureRollup['readiness']): ReadinessView {
  const total = counts.ready + counts['not-ready'] + counts.unknown;
  const state: ReadinessState = counts['not-ready'] > 0 ? 'not-ready' : counts.unknown > 0 || total === 0 ? 'unknown' : 'ready';
  return {
    label: terms.measures.readiness,
    state,
    stateText: `${counts.ready} of ${total} ${terms.readiness.ready.toLowerCase()}`,
    caption: `${counts['not-ready']} ${terms.readiness['not-ready'].toLowerCase()} · ${counts.unknown} ${terms.readiness.unknown.toLowerCase()}`,
    tone: 'neutral',
  };
}

/** Short cell text for a measure ("82%" or "Not computable"). */
export const measureCell = (v: MeasureView): string => v.value;

/** "1 Red · 1 Amber · 4 Green" (zero counts left out). */
export function ragMix(counts: Record<EvidenceRagStatus, number>): string {
  const order: EvidenceRagStatus[] = ['red', 'amber', 'green', 'unknown'];
  const parts = order.filter((s) => counts[s] > 0).map((s) => `${counts[s]} ${terms.rag[s]}`);
  return parts.length > 0 ? parts.join(' · ') : 'None';
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function listPhrases(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

export const personName = (env: SlideEnv, id: string | null | undefined): string => (id ? env.idx.people.get(id)?.name ?? 'Unknown person' : 'Unassigned');

// ---------------------------------------------------------------------------
// Records: labels, systems, descriptions and citations
// ---------------------------------------------------------------------------

const PTS = (): string => terms.systems['portfolio-system'];
const JIRA = (): string => terms.systems['work-tracker'];

export interface RecordInfo {
  label: string;
  system: string;
  /** Kind of record in words, e.g. "Risk", "Story", "Outcome". */
  type: string;
  /** Title or summary of the record. */
  description: string;
}

/** Key, system, type and description of a record, or null when it does not resolve or is not citable. */
export function recordInfo(env: SlideEnv, ref: EntityRef): RecordInfo | null {
  const { idx } = env;
  switch (ref.kind) {
    case 'investment-request': {
      const x = idx.investmentRequests.get(ref.id);
      return x ? { label: x.ref, system: PTS(), type: terms.hierarchy.investmentRequest, description: x.title } : null;
    }
    case 'pm-node': {
      const x = idx.pmNodes.get(ref.id);
      return x ? { label: x.ref, system: PTS(), type: terms.pmNodeLevels[x.level], description: x.title } : null;
    }
    case 'deliverable': {
      const x = idx.deliverables.get(ref.id);
      return x ? { label: x.ref, system: PTS(), type: terms.hierarchy.deliverable, description: x.title } : null;
    }
    case 'outcome': {
      const x = idx.outcomes.get(ref.id);
      return x ? { label: x.ref, system: PTS(), type: terms.hierarchy.outcome, description: x.title } : null;
    }
    case 'criterion': {
      const x = idx.criteria.get(ref.id);
      if (!x) return null;
      const o = idx.outcomes.get(x.outcomeId);
      const n = (idx.criteriaByOutcome.get(x.outcomeId) ?? []).indexOf(x) + 1;
      return { label: `${o?.ref ?? terms.hierarchy.outcome} criterion ${n}`, system: PTS(), type: terms.hierarchy.criterion, description: x.text };
    }
    case 'milestone': {
      const x = idx.milestones.get(ref.id);
      if (!x) return null;
      const d = idx.deliverables.get(x.deliverableId);
      return { label: `${d?.ref ?? ''} milestone ${date(x.date)}`.trim(), system: PTS(), type: x.regulatory ? terms.milestones.regulatory : terms.milestones.milestone, description: x.title };
    }
    case 'work-item': {
      const x = idx.workItems.get(ref.id);
      return x ? { label: x.key, system: JIRA(), type: terms.workItemTypes[x.type], description: x.summary } : null;
    }
    case 'raid': {
      const x = idx.raid.get(ref.id);
      return x ? { label: x.key, system: JIRA(), type: terms.raidKinds[x.kind], description: x.title } : null;
    }
    case 'dependency': {
      const x = idx.dependencies.get(ref.id);
      if (!x) return null;
      const from = idx.deliverables.get(x.fromDeliverableId)?.ref ?? '?';
      const to = idx.deliverables.get(x.toDeliverableId)?.ref ?? '?';
      return { label: x.raidKey ?? x.workItemKey ?? `${from} to ${to}`, system: JIRA(), type: terms.raidKinds.dependency, description: `${x.title} (${from} to ${to})` };
    }
    case 'evidence': {
      const x = idx.evidence.get(ref.id);
      return x ? { label: x.sourceRef || x.title, system: terms.systems[x.source], type: terms.evidenceKinds[x.kind], description: x.title } : null;
    }
    default:
      // People, hubs, pods, findings, runs and drafts are not cited as records.
      return null;
  }
}

/** Citations for a list of refs: deduplicated, unresolvable refs dropped, order kept. */
export function citationsFor(env: SlideEnv, refs: readonly EntityRef[]): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const ref of refs) {
    const k = `${ref.kind}:${ref.id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const info = recordInfo(env, ref);
    if (info) out.push({ ref: { kind: ref.kind, id: ref.id }, label: info.label, system: info.system });
  }
  return out;
}

/** Provenance kinds for a slide, always including `sample` when the data is synthetic. */
export function provenanceFor(env: SlideEnv, kinds: Provenance[]): Provenance[] {
  const set = new Set<Provenance>(kinds);
  if (env.synthetic) set.add('sample');
  const order: Provenance[] = ['computed', 'reported', 'scripted-agent', 'planned', 'simulated', 'sample'];
  return order.filter((p) => set.has(p));
}
