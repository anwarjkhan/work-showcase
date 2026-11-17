/**
 * Executive briefing (draft). A decision-focused brief for the portfolio or a
 * programme: what changed in the last seven days, what needs a decision, where
 * reported and evidence-based status disagree, and the three measures kept
 * separate. Every sentence cites records.
 */
import { AGENT_CATALOGUE } from '@/lib/agents/catalogue';
import { terms } from '@/lib/config/terminology';
import { dependencyKnockOn, isClosed, isDependencyTroubled, rollupMeasures } from '@/lib/engine';
import type { AgentRunOutput, DraftSentence, EntityRef } from '@/lib/types';
import { decisionsFor } from '../facts';
import { AgentKit, softLower, date, listPhrases, lowerFirst, plural, quote, ref } from '../kit';
import type { ScriptedAgent, ScriptedAgentInput } from '../types';
import { ragPair } from './status-reporting';

const meta = AGENT_CATALOGUE['executive-briefing'];
const WINDOW_DAYS = 7;

export const executiveBriefingAgent: ScriptedAgent = {
  id: meta.id,
  name: meta.name,
  purpose: meta.purpose,
  stages: meta.stages,
  mode: meta.mode,
  output: meta.output,
  scopes: ['portfolio'],
  acceptsProgramme: true,
  provenance: 'scripted-agent',
  run(input: ScriptedAgentInput): AgentRunOutput {
    const kit = new AgentKit(input);
    const ds = kit.deliverables;
    const ids = new Set(ds.map((d) => d.id));
    const scope = input.scope;
    const node = scope.kind === 'programme' ? kit.ctx.idx.pmNodes.get(scope.pmNodeId) : undefined;
    const label = node ? `${node.ref} ${node.title}` : 'the portfolio';
    if (ds.length === 0) {
      kit.step('blocked', 'Nothing to brief', `No deliverables in ${kit.scopeLabel}.`);
      return kit.output('No deliverables in scope.');
    }
    const anchor: EntityRef = node ? ref.pmNode(node.id) : ref.deliverable(ds[0]!.id);
    const since = kit.plusDays(-WINDOW_DAYS);
    const stories = ds.flatMap((d) => kit.stories(d.id));
    const evidence = kit.data.evidence.filter((e) => ids.has(e.deliverableId));
    const raid = kit.data.raid.filter((r) => ids.has(r.deliverableId));
    const deps = kit.data.dependencies.filter((d) => ids.has(d.toDeliverableId) || ids.has(d.fromDeliverableId));

    kit.step('read', `Read ${plural(ds.length, 'deliverable')} in ${kit.scopeLabel}`, `${plural(stories.length, 'work item')}, ${plural(evidence.length, 'evidence record')}, ${plural(raid.length, 'RAID item')}, ${plural(deps.length, 'dependency', 'dependencies')}.`, [anchor]);

    // --- What changed in the last seven days
    const closed = stories.filter((w) => isClosed(w) && w.resolved && w.resolved.slice(0, 10) > since);
    const closedPoints = closed.reduce((n, w) => n + (w.points ?? 0), 0);
    const newEvidence = evidence.filter((e) => e.observedAt.slice(0, 10) > since);
    const newFails = newEvidence.filter((e) => e.result === 'fail');
    const newPasses = newEvidence.filter((e) => e.result === 'pass');
    const newRaid = raid.filter((r) => r.created.slice(0, 10) > since);
    const turnedLate = deps.filter((d) => d.status !== 'delivered' && d.deliveredOn === null && d.needBy > since && d.needBy <= kit.today);
    kit.step(
      'compute',
      `Compared the last ${WINDOW_DAYS} days with the week before`,
      `${plural(closed.length, 'item')} closed (${closedPoints} points), ${plural(newEvidence.length, 'evidence record')} arrived (${newFails.length} failing), ${plural(newRaid.length, 'RAID item')} raised.`,
      [...newFails.map((e) => ref.evidence(e.id)), ...newRaid.map((r) => ref.raid(r.id))],
    );

    const changed: DraftSentence[] = [];
    changed.push(
      closed.length > 0
        ? kit.sentence(`${plural(closed.length, 'work item')} closed in the last ${WINDOW_DAYS} days, ${closedPoints} points in total.`, closed.map((w) => ref.item(w.key)))
        : kit.sentence(`No work items closed in the last ${WINDOW_DAYS} days.`, [anchor]),
    );
    if (newFails.length > 0) {
      changed.push(
        kit.sentence(
          `${plural(newFails.length, 'new evidence record')} ${newFails.length === 1 ? 'is' : 'are'} failing: ${listPhrases(newFails.slice(0, 4).map((e) => `${kit.deliverable(e.deliverableId)?.ref ?? ''} ${quote(e.title)} (${e.sourceRef})`))}.`,
          newFails.map((e) => ref.evidence(e.id)),
        ),
      );
    }
    if (newPasses.length > 0) changed.push(kit.sentence(`${plural(newPasses.length, 'new evidence record')} passed.`, newPasses.map((e) => ref.evidence(e.id))));
    if (newRaid.length > 0) {
      changed.push(kit.sentence(`${plural(newRaid.length, 'RAID item')} raised, ${newRaid.filter((r) => r.severity === 'critical' || r.severity === 'high').length} of them high or critical.`, newRaid.map((r) => ref.raid(r.id))));
    }
    if (turnedLate.length > 0) {
      changed.push(
        kit.sentence(
          `${plural(turnedLate.length, 'dependency', 'dependencies')} passed ${turnedLate.length === 1 ? 'its' : 'their'} need-by date undelivered: ${listPhrases(turnedLate.map((d) => quote(d.title)))}.`,
          turnedLate.map((d) => ref.dependency(d.id)),
        ),
      );
    }
    kit.section('What changed this week', changed);

    // --- Decisions needed
    const knockOn = dependencyKnockOn(kit.ctx).filter((k) => ids.has(k.receiverId));
    const decisions = ds.flatMap((d) => decisionsFor(kit, d).map((x) => ({ ...x, d })));
    const regulatoryAtRisk = knockOn.flatMap((k) => k.affectedMilestones.filter((m) => m.regulatory).map((m) => ({ k, m })));
    kit.step(
      'check',
      `Checked ${plural(deps.filter((d) => isDependencyTroubled(d, kit.input.clock)).length, 'troubled dependency', 'troubled dependencies')} for knock-on`,
      `${plural(regulatoryAtRisk.length, 'regulatory milestone')} pushed by a late or blocked dependency.`,
      regulatoryAtRisk.map((x) => ref.milestone(x.m.milestoneId)),
    );
    const decisionSentences: DraftSentence[] = [];
    for (const { k, m } of regulatoryAtRisk.slice(0, 2)) {
      const ms = kit.ctx.idx.milestones.get(m.milestoneId);
      const receiver = kit.deliverable(k.receiverId);
      decisionSentences.push(
        kit.sentence(
          `Decide how to protect regulatory milestone ${quote(ms?.title ?? 'milestone')} for ${receiver?.ref ?? 'an unknown deliverable'}: a dependency ${k.lateDays} days late would move it from ${date(m.date)} to ${date(m.shiftedTo)}.`,
          [ref.milestone(m.milestoneId), ref.dependency(k.dependencyId), ref.deliverable(k.receiverId)],
        ),
      );
    }
    for (const x of decisions.sort((a, b) => a.rank - b.rank).slice(0, 5 - decisionSentences.length)) {
      decisionSentences.push(kit.sentence(`${x.d.ref}: ${x.text}`, [ref.deliverable(x.d.id), ...x.refs]));
    }
    if (decisionSentences.length === 0) decisionSentences.push(kit.sentence(`Nothing in ${label} needs a decision this week.`, [anchor]));
    kit.section('Decisions needed', decisionSentences);

    // --- Where reported and evidence disagree
    const order = kit.results.portfolio.disagreementDeliverableIds.filter((id) => ids.has(id));
    kit.step('check', `Compared reported and evidence-based RAG for ${plural(ds.length, 'deliverable')}`, `${plural(order.length, 'disagreement')}.`, order.map(ref.deliverable));
    const disagree: DraftSentence[] = [];
    if (order.length === 0) disagree.push(kit.sentence(`Reported and evidence-based status agree across ${label}.`, ds.map((d) => ref.deliverable(d.id)), anchor));
    else {
      disagree.push(kit.sentence(`${plural(order.length, 'deliverable')} ${order.length === 1 ? 'is' : 'are'} reported in a better state than the evidence supports.`, order.map(ref.deliverable)));
      for (const id of order.slice(0, 5)) {
        const rag = kit.results.deliverableRag[id];
        const d = kit.deliverable(id);
        if (!rag || !d) continue;
        const first = rag.reasons[0];
        disagree.push(
          kit.sentence(
            `${d.ref} ${quote(d.title)} is ${ragPair(kit, id, false)}${first ? `: ${softLower(first.message)}` : '.'}`,
            [ref.deliverable(id), ...(first?.refs ?? [])],
          ),
        );
      }
    }
    kit.section('Where reported and evidence disagree', disagree);

    // --- The three measures
    const roll = rollupMeasures(kit.results, ds.map((d) => d.id));
    kit.step('compute', 'Rolled up the three measures', 'Work completion, accepted outcomes and readiness, kept separate.', [anchor]);
    const measures: DraftSentence[] = [];
    measures.push(
      roll.workCompletion.computable
        ? kit.sentence(`${terms.measures.workCompletion}: ${roll.workCompletion.value.percent}% (${roll.workCompletion.value.closedPoints} of ${roll.workCompletion.value.totalPoints} points).`, ds.map((d) => ref.deliverable(d.id)))
        : kit.sentence(`${terms.measures.workCompletion}: ${lowerFirst(terms.measures.notComputable)}.`, [anchor]),
    );
    measures.push(
      roll.acceptedOutcomes.computable
        ? kit.sentence(
            `${terms.measures.acceptedOutcomes}: ${roll.acceptedOutcomes.value.acceptedCount} of ${roll.acceptedOutcomes.value.totalCount} (${roll.acceptedOutcomes.value.percent}% of weight).`,
            roll.acceptedOutcomes.value.outcomes.slice(0, 12).map((o) => ref.outcome(o.outcomeId)),
            anchor,
          )
        : kit.sentence(`${terms.measures.acceptedOutcomes}: ${lowerFirst(terms.measures.notComputable)}.`, [anchor]),
    );
    measures.push(
      kit.sentence(
        `${terms.measures.readiness}: ${roll.readiness.ready} ${lowerFirst(terms.readiness.ready)}, ${roll.readiness['not-ready']} ${lowerFirst(terms.readiness['not-ready'])}, ${roll.readiness.unknown} ${lowerFirst(terms.readiness.unknown)}.`,
        ds.filter((d) => kit.results.deliverables[d.id]?.readiness.state !== 'unknown').map((d) => ref.deliverable(d.id)),
        anchor,
      ),
    );
    kit.section('Position on the three measures', measures);

    kit.step('draft', `Drafted ${kit.sections.reduce((n, s) => n + s.sentences.length, 0)} cited sentences`, 'Decision-focused; every sentence cites records.', [anchor]);
    return kit.output(`Executive brief for ${label}: ${plural(decisionSentences.length, 'decision')}, ${plural(order.length, 'status disagreement')}.`, {
      kind: 'executive-brief',
      deliverableId: null,
      title: `Executive brief: ${label}, ${date(kit.today)}`,
      agentId: 'executive-briefing',
      sections: kit.sections,
      provenance: 'scripted-agent',
    });
  },
};
