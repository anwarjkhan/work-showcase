/**
 * Resolves an `EntityRef` (a citation, a step reference, a proposal's evidence)
 * to the record it points at. Screens use `resolveRef` to open a cited record;
 * tests use it to prove every draft sentence cites something real.
 */
import { indexPortfolio } from '@/lib/store/indexes';
import type { DemoState, EntityRef, PortfolioData } from '@/lib/types';

export interface ResolvedRef {
  ref: EntityRef;
  record: unknown;
  /** Short label for a chip, e.g. "CCR-203", "TD-1001", "OC-1001-2", or the record's title. */
  label: string;
}

type StateLike = Pick<DemoState, 'data'> & Partial<Pick<DemoState, 'results' | 'agentRuns' | 'proposals' | 'approvals' | 'drafts' | 'audit'>>;

/** The record behind a reference, or null when it does not resolve. */
export function resolveRef(state: StateLike | PortfolioData, r: EntityRef): ResolvedRef | null {
  const s: StateLike = 'meta' in state ? { data: state } : state;
  const idx = indexPortfolio(s.data);
  const hit = (record: unknown, label: string): ResolvedRef => ({ ref: r, record, label });
  switch (r.kind) {
    case 'investment-request': {
      const x = idx.investmentRequests.get(r.id);
      return x ? hit(x, x.ref) : null;
    }
    case 'pm-node': {
      const x = idx.pmNodes.get(r.id);
      return x ? hit(x, x.ref) : null;
    }
    case 'deliverable': {
      const x = idx.deliverables.get(r.id);
      return x ? hit(x, x.ref) : null;
    }
    case 'outcome': {
      const x = idx.outcomes.get(r.id);
      return x ? hit(x, x.ref) : null;
    }
    case 'criterion': {
      const x = idx.criteria.get(r.id);
      return x ? hit(x, x.text) : null;
    }
    case 'work-item': {
      const x = idx.workItems.get(r.id);
      return x ? hit(x, x.key) : null;
    }
    case 'evidence': {
      const x = idx.evidence.get(r.id);
      return x ? hit(x, x.sourceRef || x.title) : null;
    }
    case 'raid': {
      const x = idx.raid.get(r.id);
      return x ? hit(x, x.key) : null;
    }
    case 'dependency': {
      const x = idx.dependencies.get(r.id);
      return x ? hit(x, x.title) : null;
    }
    case 'milestone': {
      const x = idx.milestones.get(r.id);
      return x ? hit(x, x.title) : null;
    }
    case 'hub': {
      const x = idx.hubs.get(r.id);
      return x ? hit(x, x.name) : null;
    }
    case 'pod': {
      const x = idx.pods.get(r.id);
      return x ? hit(x, x.name) : null;
    }
    case 'person': {
      const x = idx.people.get(r.id);
      return x ? hit(x, x.name) : null;
    }
    case 'agent-identity': {
      const x = idx.agentIdentities.get(r.id);
      return x ? hit(x, x.handle) : null;
    }
    case 'sprint': {
      const x = idx.sprints.get(r.id);
      return x ? hit(x, x.name) : null;
    }
    case 'pdlc-run': {
      const x = s.data.pdlcRuns.find((p) => p.id === r.id);
      return x ? hit(x, idx.deliverables.get(x.deliverableId)?.ref ?? x.id) : null;
    }
    case 'finding': {
      const x = s.results?.findings.find((f) => f.id === r.id) ?? s.agentRuns?.flatMap((run) => (run as { findings?: { id: string }[] }).findings ?? []).find((f) => f.id === r.id);
      return x ? hit(x, r.id) : null;
    }
    case 'agent-run': {
      const x = s.agentRuns?.find((a) => a.id === r.id);
      return x ? hit(x, x.id) : null;
    }
    case 'proposal': {
      const x = s.proposals?.find((p) => p.id === r.id);
      return x ? hit(x, x.title) : null;
    }
    case 'approval': {
      const x = s.approvals?.find((a) => a.id === r.id);
      return x ? hit(x, x.id) : null;
    }
    case 'status-draft': {
      const x = s.drafts?.find((d) => d.id === r.id);
      return x ? hit(x, x.title) : null;
    }
    case 'audit-event': {
      const x = s.audit?.find((a) => a.id === r.id);
      return x ? hit(x, `#${x.seq}`) : null;
    }
  }
}

/** References that do not resolve (empty when all do). */
export function unresolvedRefs(state: StateLike | PortfolioData, refs: EntityRef[]): EntityRef[] {
  return refs.filter((r) => resolveRef(state, r) === null);
}
