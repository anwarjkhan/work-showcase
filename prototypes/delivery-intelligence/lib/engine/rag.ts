/**
 * Evidence-based RAG, always shown beside the reported RAG and never replacing it.
 *   Red      any critical finding, or a missed committed date
 *   Amber    any high finding, or stale data (reported status older than the stale window)
 *   Unknown  too little data to say Green (no story-level work or no evidence at all)
 *   Green    otherwise
 * A known problem is never hidden behind Unknown: Red and Amber take precedence.
 * Roll-ups take the worst child, ordering Red > Amber > Unknown > Green, so a
 * parent is only Green when every deliverable under it is Green.
 */
import { terms } from '@/lib/config/terminology';
import type { EntityRef, EvidenceRag, EvidenceRagStatus, Finding, Milestone, RagStatus, Reason, RuleId, TechDeliverable } from '@/lib/types';
import { RAG_RULES, RULE_THRESHOLDS } from './constants';
import type { EngineContext } from './context';
import type { MeasuresResult } from './measures';
import { date, days, listPhrases, lowerFirst, plural, portfolioSystem, quote } from './messages';
import { RULE_DESCRIPTIONS } from '@/lib/config/thresholds';
import { compareIds, dayDiff, RAG_RANK, SEVERITY_RANK } from './util';

/** Milestones that are missed, or planned with their date already passed. */
export function missedMilestones(ctx: EngineContext, deliverableId: string): Milestone[] {
  return (ctx.milestonesByDeliverable.get(deliverableId) ?? []).filter(
    (m) => m.status === 'missed' || (m.status === 'planned' && dayDiff(m.date, ctx.clock.today) > 0),
  );
}

function findingReasons(findings: Finding[], code: string): Reason[] {
  const byRule = new Map<RuleId, Finding[]>();
  for (const f of findings) {
    const list = byRule.get(f.ruleId);
    if (list) list.push(f);
    else byRule.set(f.ruleId, [f]);
  }
  const reasons: Reason[] = [];
  for (const [ruleId, list] of byRule) {
    const first = list[0] as Finding;
    const refs: EntityRef[] = list.map((f) => ({ kind: 'finding', id: f.id }));
    reasons.push({
      code: `${code}-${ruleId}`,
      message:
        list.length === 1
          ? first.message
          : `${plural(list.length, `${lowerFirst(terms.severity[first.severity])} finding`)} (${ruleId}: ${RULE_DESCRIPTIONS[ruleId]}). First: ${first.message}`,
      refs,
    });
  }
  return reasons;
}

export function deliverableEvidenceRag(
  ctx: EngineContext,
  d: TechDeliverable,
  findings: Finding[],
  measures: MeasuresResult,
): EvidenceRag {
  const redRank = SEVERITY_RANK[RAG_RULES.redSeverity];
  const amberRank = SEVERITY_RANK[RAG_RULES.amberSeverity];
  const red = findings.filter((f) => SEVERITY_RANK[f.severity] >= redRank);
  const amber = findings.filter((f) => SEVERITY_RANK[f.severity] >= amberRank && SEVERITY_RANK[f.severity] < redRank);

  const redReasons: Reason[] = findingReasons(red, 'critical-finding');
  for (const m of missedMilestones(ctx, d.id)) {
    redReasons.push({
      code: 'missed-milestone',
      message: `${m.regulatory ? 'Regulatory milestone' : 'Milestone'} ${quote(m.title)} was due on ${date(m.date)} and has not been met.`,
      refs: [{ kind: 'milestone', id: m.id }],
    });
  }
  const work = measures.deliverables[d.id]?.workCompletion;
  const workDone = work?.computable === true && work.value.closedPoints >= work.value.totalPoints;
  const pastEnd = dayDiff(d.plannedEnd, ctx.clock.today);
  if (pastEnd > 0 && !workDone) {
    redReasons.push({
      code: 'missed-planned-end',
      message: `Planned end ${date(d.plannedEnd)} passed ${days(pastEnd)} ago with work still open.`,
      refs: [{ kind: 'deliverable', id: d.id }],
    });
  }

  const amberReasons: Reason[] = findingReasons(amber, 'high-finding');
  const reportAge = dayDiff(d.reportedAt, ctx.clock.today);
  if (reportAge > RULE_THRESHOLDS.staleDataDays) {
    amberReasons.push({
      code: 'stale-report',
      message: `The status in ${portfolioSystem()} was last updated on ${date(d.reportedAt)}, ${days(reportAge)} ago.`,
      refs: [{ kind: 'deliverable', id: d.id }],
    });
  }

  const stories = ctx.storiesByDeliverable.get(d.id) ?? [];
  const evidence = ctx.evidenceByDeliverable.get(d.id) ?? [];
  const tooLittle: Reason[] = [];
  if (stories.length < RAG_RULES.minWorkItemsForRag) {
    tooLittle.push({ code: 'no-work', message: `No story-level work is linked yet, so status cannot be judged from evidence.`, refs: [{ kind: 'deliverable', id: d.id }] });
  }
  if (evidence.length === 0) {
    tooLittle.push({ code: 'no-evidence', message: `No evidence records are held yet, so status cannot be judged from evidence.`, refs: [{ kind: 'deliverable', id: d.id }] });
  }

  let status: EvidenceRagStatus;
  let reasons: Reason[];
  if (redReasons.length > 0) {
    status = 'red';
    reasons = [...redReasons, ...amberReasons];
  } else if (amberReasons.length > 0) {
    status = 'amber';
    reasons = amberReasons;
  } else if (tooLittle.length > 0) {
    status = 'unknown';
    reasons = tooLittle;
  } else {
    status = 'green';
    reasons = [
      {
        code: 'no-exceptions',
        message: `No critical or high findings, no missed dates and the reported status is current.`,
        refs: [{ kind: 'deliverable', id: d.id }],
      },
    ];
  }
  return withDisagreement({ kind: 'deliverable', id: d.id }, d.reportedRag, status, reasons);
}

function withDisagreement(entity: EntityRef, reported: RagStatus, evidence: EvidenceRagStatus, reasons: Reason[]): EvidenceRag {
  return { entity, reported, evidence, disagrees: evidence !== 'unknown' && evidence !== reported, reasons };
}

/** Worst status, ordering Red > Amber > Unknown > Green. Empty gives Unknown. */
export function worstRag(statuses: EvidenceRagStatus[]): EvidenceRagStatus {
  if (statuses.length === 0) return 'unknown';
  return statuses.reduce((worst, s) => (RAG_RANK[s] > RAG_RANK[worst] ? s : worst), 'green' as EvidenceRagStatus);
}

/** Roll-up RAG for a set of deliverables (programme, project, initiative, investment request). */
export function rollupRag(
  entity: EntityRef,
  reported: RagStatus,
  deliverableIds: string[],
  rags: Record<string, EvidenceRag>,
  deliverables: ReadonlyMap<string, TechDeliverable>,
): EvidenceRag {
  const children = deliverableIds.map((id) => rags[id]).filter((r): r is EvidenceRag => r !== undefined);
  const status = worstRag(children.map((r) => r.evidence));
  const reasons: Reason[] = [];
  if (children.length === 0) {
    reasons.push({ code: 'no-deliverables', message: 'No deliverables sit under it, so status cannot be judged from evidence.', refs: [entity] });
  } else {
    const order: EvidenceRagStatus[] = ['red', 'amber', 'unknown', 'green'];
    for (const s of order) {
      const ids = children.filter((r) => r.evidence === s).map((r) => r.entity.id);
      if (ids.length === 0) continue;
      const refsText = listPhrases(ids.map((id) => deliverables.get(id)?.ref ?? id));
      reasons.push({
        code: `deliverables-${s}`,
        message: `${ids.length} of ${plural(children.length, 'deliverable')} ${ids.length === 1 ? 'is' : 'are'} ${terms.rag[s]} on evidence: ${refsText}.`,
        refs: ids.map((id) => ({ kind: 'deliverable', id })),
      });
    }
  }
  return withDisagreement(entity, reported, status, reasons);
}

const REPORTED_RANK: Record<RagStatus, number> = { red: 2, amber: 1, green: 0 };
const EVIDENCE_RANK: Record<EvidenceRagStatus, number> = { red: 2, amber: 1, green: 0, unknown: -1 };

/**
 * Deliverables whose reported and evidence-based RAG disagree, worst first:
 * the widest gap (reported Green, evidence Red) first, then the worse evidence
 * status, then evidence worse than reported before evidence better than reported,
 * then by deliverable id.
 */
export function statusDisagreements(rags: Record<string, EvidenceRag>): string[] {
  return Object.values(rags)
    .filter((r) => r.disagrees)
    .sort((a, b) => {
      const gapA = EVIDENCE_RANK[a.evidence] - REPORTED_RANK[a.reported];
      const gapB = EVIDENCE_RANK[b.evidence] - REPORTED_RANK[b.reported];
      return (
        Math.abs(gapB) - Math.abs(gapA) ||
        EVIDENCE_RANK[b.evidence] - EVIDENCE_RANK[a.evidence] ||
        gapB - gapA ||
        compareIds(a.entity.id, b.entity.id)
      );
    })
    .map((r) => r.entity.id);
}
