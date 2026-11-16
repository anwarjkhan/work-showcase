/**
 * Outcome mapping (propose change). For story-level items with no Outcome ID
 * (or one that does not resolve), it scores every outcome of the item's
 * deliverable by the words the item shares with the outcome and by which
 * outcome its Epic siblings carry, and proposes the best match. Items with no
 * credible match are reported, not guessed.
 */
import { AGENT_CATALOGUE } from '@/lib/agents/catalogue';
import { terms } from '@/lib/config/terminology';
import type { AgentRunOutput, Outcome, WorkItem } from '@/lib/types';
import { AgentKit, compareKeys, listPhrases, plural, quote, ref, sharedTokens, tokens } from '../kit';
import type { ScriptedAgent, ScriptedAgentInput } from '../types';

const meta = AGENT_CATALOGUE['outcome-mapping'];
/** Minimum score for a suggestion (0..1). */
const MIN_SCORE = 0.2;
const EXEMPT = new Set(['raid']);

export interface OutcomeScore {
  outcome: Outcome;
  score: number;
  shared: string[];
  siblingShare: number;
  siblingKeys: string[];
}

export const outcomeMappingAgent: ScriptedAgent = {
  id: meta.id,
  name: meta.name,
  purpose: meta.purpose,
  stages: meta.stages,
  mode: meta.mode,
  output: meta.output,
  scopes: ['deliverable', 'pdlc-stage', 'portfolio'],
  acceptsProgramme: true,
  provenance: 'scripted-agent',
  run(input: ScriptedAgentInput): AgentRunOutput {
    const kit = new AgentKit(input);
    const ds = kit.deliverables;
    const stories = ds.flatMap((d) => kit.stories(d.id).map((w) => ({ d, w })));
    const outcomeCount = ds.reduce((n, d) => n + (kit.ctx.idx.outcomesByDeliverable.get(d.id)?.length ?? 0), 0);
    kit.step('read', `Read ${plural(stories.length, 'story-level item')} and ${plural(outcomeCount, 'outcome')} in ${kit.scopeLabel}`, `Across ${plural(ds.length, 'deliverable')}.`, ds.slice(0, 25).map((d) => ref.deliverable(d.id)));

    const unmapped = stories.filter(({ w }) => !EXEMPT.has(w.type) && (!w.outcomeId || !kit.ctx.resolveOutcome(w.outcomeId)));
    const dangling = unmapped.filter(({ w }) => w.outcomeId);
    kit.step(
      'check',
      `Checked every item for an ${terms.hierarchy.outcomeIdField}`,
      `${plural(unmapped.length, 'item')} ${unmapped.length === 1 ? 'has' : 'have'} none${dangling.length > 0 ? `; ${dangling.length} point to an outcome that does not exist` : ''}.`,
      unmapped.map(({ w }) => ref.item(w.key)),
    );

    let proposed = 0;
    const noMatch: WorkItem[] = [];
    for (const { d, w } of unmapped.sort((a, b) => compareKeys(a.w.key, b.w.key))) {
      const outcomes = kit.ctx.idx.outcomesByDeliverable.get(d.id) ?? [];
      const scores = scoreOutcomes(kit, w, outcomes);
      const best = scores[0];
      if (!best || (best.score < MIN_SCORE && outcomes.length > 1)) {
        noMatch.push(w);
        kit.finding('R9', 'low', ref.item(w.key), d.id, `${w.key} ${quote(w.summary)} has no ${terms.hierarchy.outcomeIdField} and no outcome of ${d.ref} is a credible match.`, [ref.deliverable(d.id)]);
        continue;
      }
      const reasons: string[] = [];
      if (best.shared.length > 0) reasons.push(`it shares ${listPhrases(best.shared.map((t) => quote(t)))} with the outcome`);
      if (best.siblingKeys.length > 0) reasons.push(`${best.siblingKeys.length} of the mapped items in ${w.epicKey ?? 'its Epic'} carry ${best.outcome.ref}`);
      if (outcomes.length === 1) reasons.push(`it is the only outcome of ${d.ref}`);
      kit.propose({
        agentId: 'outcome-mapping',
        deliverableId: d.id,
        target: ref.item(w.key),
        title: `Set ${terms.hierarchy.outcomeIdField} on ${w.key} to ${best.outcome.ref}`,
        rationale: `${w.key} ${quote(w.summary)} best matches ${best.outcome.ref} ${quote(best.outcome.title)} (score ${Math.round(best.score * 100)}): ${listPhrases(reasons)}.`,
        evidence: [ref.item(w.key), ref.outcome(best.outcome.id), ...best.siblingKeys.slice(0, 5).map(ref.item)],
        patch: { op: 'set-field', entity: 'work-item', id: w.key, field: 'outcomeId', before: w.outcomeId, after: best.outcome.id },
        beforeText: `${terms.hierarchy.outcomeIdField}: ${w.outcomeId ?? 'none'}`,
        afterText: `${terms.hierarchy.outcomeIdField}: ${best.outcome.ref} ${quote(best.outcome.title)}`,
        riskTier: kit.tierOf(d, w),
        assigneeId: w.assigneeId,
      });
      proposed += 1;
    }
    kit.step('compute', `Scored ${plural(unmapped.length, 'item')} against their deliverable's outcomes`, 'Score = 60% shared words with the outcome + 40% share of Epic siblings carrying it.', unmapped.slice(0, 10).map(({ w }) => ref.item(w.key)));
    kit.step(
      'propose',
      `Proposed ${plural(proposed, `${terms.hierarchy.outcomeIdField} change`)}`,
      noMatch.length > 0 ? `${plural(noMatch.length, 'item')} left for a person to map: ${listPhrases(noMatch.slice(0, 5).map((w) => w.key))}.` : 'Every unmapped item has a suggestion.',
      noMatch.map((w) => ref.item(w.key)),
    );
    return kit.output(`${plural(proposed, 'Outcome ID suggestion')} for ${plural(unmapped.length, 'unmapped item')} in ${kit.scopeLabel}.`);
  },
};

export function scoreOutcomes(kit: AgentKit, item: WorkItem, outcomes: Outcome[]): OutcomeScore[] {
  const siblings = kit.ctx.data.workItems.filter((s) => s.key !== item.key && s.epicKey !== null && s.epicKey === item.epicKey && s.outcomeId && kit.ctx.resolveOutcome(s.outcomeId));
  return outcomes
    .map((o) => {
      const text = `${o.title} ${o.description}`;
      const shared = sharedTokens(item.summary, text);
      const textScore = tokens(item.summary).size === 0 ? 0 : shared.length / tokens(item.summary).size;
      const carrying = siblings.filter((s) => kit.ctx.resolveOutcome(s.outcomeId)?.id === o.id);
      const siblingShare = siblings.length === 0 ? 0 : carrying.length / siblings.length;
      return { outcome: o, score: 0.6 * textScore + 0.4 * siblingShare, shared, siblingShare, siblingKeys: carrying.map((s) => s.key) };
    })
    .sort((a, b) => b.score - a.score || compareKeys(a.outcome.ref, b.outcome.ref));
}
