/**
 * Assembles the three independent measures per deliverable and per outcome.
 * Each measure is computed from its own inputs; none reads another's result.
 */
import type { DeliverableMeasures, OutcomeAcceptance, OutcomeMeasures } from '@/lib/types';
import { acceptedOutcomesOf, outcomeAcceptance } from './acceptance';
import type { EngineContext } from './context';
import { deliverableReadiness } from './readiness';
import { deliverableWorkCompletion, outcomeEpicKeys, workCompletionOf } from './work';

export interface MeasuresResult {
  deliverables: Record<string, DeliverableMeasures>;
  outcomes: Record<string, OutcomeMeasures>;
  acceptance: Map<string, OutcomeAcceptance>;
}

export function computeMeasures(ctx: EngineContext): MeasuresResult {
  const acceptance = new Map<string, OutcomeAcceptance>();
  const outcomes: Record<string, OutcomeMeasures> = {};
  for (const o of ctx.data.outcomes) {
    const a = outcomeAcceptance(ctx, o);
    acceptance.set(o.id, a);
    const items = ctx.storiesByOutcome.get(o.id) ?? [];
    const epicKeys = outcomeEpicKeys(items);
    outcomes[o.id] = {
      outcomeId: o.id,
      deliverableId: o.deliverableId,
      workCompletion: workCompletionOf(items, epicKeys),
      acceptance: a,
      epicKeys,
      workItemKeys: items.map((i) => i.key),
      reportedStatus: o.reportedStatus,
    };
  }

  const deliverables: Record<string, DeliverableMeasures> = {};
  for (const d of ctx.data.deliverables) {
    deliverables[d.id] = {
      deliverableId: d.id,
      workCompletion: deliverableWorkCompletion(ctx, d.id),
      acceptedOutcomes: acceptedOutcomesOf(ctx.idx.outcomesByDeliverable.get(d.id) ?? [], acceptance),
      readiness: deliverableReadiness(ctx, d),
    };
  }
  return { deliverables, outcomes, acceptance };
}
