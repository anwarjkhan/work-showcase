/**
 * Shared shape for rules R1 to R14: each rule is a pure function of the engine
 * context (and the measures where it needs them) returning findings with a
 * deterministic id, the configured severity and the records that prove it.
 */
import type { EntityRef, Finding, RuleId } from '@/lib/types';
import { MAX_FINDING_REFS, RULE_SEVERITY } from './constants';
import type { EngineContext } from './context';
import type { MeasuresResult } from './measures';

export interface RuleInput {
  ctx: EngineContext;
  measures: MeasuresResult;
}

export type Rule = (input: RuleInput) => Finding[];

export function finding(
  ctx: EngineContext,
  ruleId: RuleId,
  subject: EntityRef,
  deliverableId: string | null,
  message: string,
  evidence: EntityRef[],
  idSuffix = '',
): Finding {
  const seen = new Set<string>();
  const refs: EntityRef[] = [];
  for (const r of [subject, ...evidence]) {
    const k = `${r.kind}:${r.id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    refs.push(r);
    if (refs.length >= MAX_FINDING_REFS) break;
  }
  return {
    id: `f-${ruleId}-${subject.kind}-${subject.id}${idSuffix ? `-${idSuffix}` : ''}`,
    ruleId,
    severity: RULE_SEVERITY[ruleId],
    subject,
    deliverableId,
    message,
    evidence: refs,
    detectedAt: ctx.clock.now,
    provenance: 'computed',
    agentRunId: null,
  };
}

export const ref = {
  item: (key: string): EntityRef => ({ kind: 'work-item', id: key }),
  deliverable: (id: string): EntityRef => ({ kind: 'deliverable', id }),
  outcome: (id: string): EntityRef => ({ kind: 'outcome', id }),
  criterion: (id: string): EntityRef => ({ kind: 'criterion', id }),
  evidence: (id: string): EntityRef => ({ kind: 'evidence', id }),
  raid: (id: string): EntityRef => ({ kind: 'raid', id }),
  dependency: (id: string): EntityRef => ({ kind: 'dependency', id }),
  milestone: (id: string): EntityRef => ({ kind: 'milestone', id }),
  person: (id: string): EntityRef => ({ kind: 'person', id }),
};
