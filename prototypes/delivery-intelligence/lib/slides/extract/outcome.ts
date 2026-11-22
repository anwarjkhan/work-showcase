/**
 * Facts for one outcome: reported status beside acceptance, criteria and who
 * accepted them, the business acceptance record, the story-level work that
 * carries its Outcome ID, and its evidence with staleness (engine helper).
 */
import { evidenceStaleness, isClosed } from '@/lib/engine';
import type { AcceptanceCriterion, Evidence, Finding, Outcome, OutcomeMeasures, Person, TechDeliverable, WorkItem } from '@/lib/types';
import type { MeasureView } from '../types';
import type { SlideEnv } from './common';
import { workView } from './format';

export interface CriterionLine {
  criterion: AcceptanceCriterion;
  /** 1-based position under the outcome. */
  number: number;
  acceptedBy: Person | undefined;
  rejectedBy: Person | undefined;
}

export interface EvidenceLine {
  evidence: Evidence;
  stale: boolean;
  workChangedAt: string | null;
  changedItemKey: string | null;
}

export interface OutcomeFacts {
  outcome: Outcome;
  deliverable: TechDeliverable | undefined;
  measures: OutcomeMeasures;
  owner: Person | undefined;
  work: MeasureView;
  /** Weight of this outcome and of all outcomes of its deliverable. */
  weight: { own: number; total: number };
  criteria: CriterionLine[];
  businessAcceptance: Evidence[];
  /** Story-level items carrying this Outcome ID, by Epic key then item key. */
  items: WorkItem[];
  openItems: WorkItem[];
  /** Agent-assigned items with no named human reviewer (rule R10). */
  missingReviewer: WorkItem[];
  evidence: EvidenceLine[];
  findings: Finding[];
}

const byKey = (a: WorkItem, b: WorkItem) => (a.epicKey ?? '').localeCompare(b.epicKey ?? '', 'en', { numeric: true }) || a.key.localeCompare(b.key, 'en', { numeric: true });

export function outcomeFacts(env: SlideEnv, outcomeId: string): OutcomeFacts {
  const { idx, eng, result } = env;
  const outcome = idx.outcomes.get(outcomeId);
  const measures = result.outcomes[outcomeId];
  if (!outcome || !measures) throw new Error('No outcome matches this slide scope.');
  const siblings = idx.outcomesByDeliverable.get(outcome.deliverableId) ?? [];
  const items = (eng.storiesByOutcome.get(outcome.id) ?? []).slice().sort(byKey);
  const evidence = env.data.evidence
    .filter((e) => e.outcomeId === outcome.id)
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt) || a.id.localeCompare(b.id))
    .map((e) => {
      const s = evidenceStaleness(eng, e);
      return { evidence: e, stale: s.stale, workChangedAt: s.workChangedAt, changedItemKey: s.changedItemKey };
    });
  const findingRefersHere = (f: Finding) => (f.subject.kind === 'outcome' && f.subject.id === outcome.id) || f.evidence.some((r) => r.kind === 'outcome' && r.id === outcome.id);
  return {
    outcome,
    deliverable: idx.deliverables.get(outcome.deliverableId),
    measures,
    owner: idx.people.get(outcome.acceptanceOwnerId),
    work: workView(measures.workCompletion),
    weight: { own: outcome.weight, total: siblings.reduce((sum, o) => sum + o.weight, 0) },
    criteria: (idx.criteriaByOutcome.get(outcome.id) ?? []).map((c, i) => ({
      criterion: c,
      number: i + 1,
      acceptedBy: c.acceptedById ? idx.people.get(c.acceptedById) : undefined,
      rejectedBy: c.rejectedById ? idx.people.get(c.rejectedById) : undefined,
    })),
    businessAcceptance: measures.acceptance.businessAcceptanceEvidenceIds.map((id) => idx.evidence.get(id)).filter((e): e is Evidence => e !== undefined),
    items,
    openItems: items.filter((w) => !isClosed(w)),
    missingReviewer: items.filter((w) => w.assigneeType === 'agent' && !w.reviewerId),
    evidence,
    findings: result.findings.filter(findingRefersHere),
  };
}
