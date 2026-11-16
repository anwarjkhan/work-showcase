/**
 * Status reporting (draft). A weekly status for a deliverable, a programme or
 * the portfolio, in the structure a programme manager sends: headline, progress
 * on the three measures kept separate, milestones, risks and issues,
 * dependencies, decisions needed, next period. Every sentence cites records,
 * and the draft says plainly when the evidence disagrees with the reported RAG.
 */
import { AGENT_CATALOGUE } from '@/lib/agents/catalogue';
import { terms } from '@/lib/config/terminology';
import { isClosed, rollupMeasures } from '@/lib/engine';
import type { AgentRunOutput, DraftSentence, EntityRef, TechDeliverable } from '@/lib/types';
import {
  dependenciesInto,
  dependencySentence,
  decisionsFor,
  itemsDueSoon,
  milestoneFacts,
  milestoneSentence,
  openRaid,
  outstandingStageReviews,
  raidProblems,
  raidSentence,
  stageName,
} from '../facts';
import { AgentKit, date, listPhrases, lowerFirst, plural, quote, ref } from '../kit';
import type { ScriptedAgent, ScriptedAgentInput } from '../types';

const meta = AGENT_CATALOGUE['status-reporting'];
const PS = () => terms.systems['portfolio-system'];

export const statusReportingAgent: ScriptedAgent = {
  id: meta.id,
  name: meta.name,
  purpose: meta.purpose,
  stages: meta.stages,
  mode: meta.mode,
  output: meta.output,
  scopes: ['deliverable', 'portfolio'],
  acceptsProgramme: true,
  provenance: 'scripted-agent',
  run(input: ScriptedAgentInput): AgentRunOutput {
    const kit = new AgentKit(input);
    if (input.scope.kind === 'deliverable' || input.scope.kind === 'pdlc-stage') {
      const d = kit.deliverables[0];
      if (!d) return missing(kit);
      return deliverableStatus(kit, d);
    }
    return groupStatus(kit);
  },
};

function missing(kit: AgentKit): AgentRunOutput {
  kit.step('blocked', 'Nothing to report', `No deliverable matches ${kit.scopeLabel}.`);
  return kit.output('No deliverable in scope.');
}

// ---------------------------------------------------------------------------
// One deliverable
// ---------------------------------------------------------------------------

function deliverableStatus(kit: AgentKit, d: TechDeliverable): AgentRunOutput {
  const dRef = ref.deliverable(d.id);
  const m = kit.results.deliverables[d.id];
  const rag = kit.results.deliverableRag[d.id];
  const epics = kit.epics(d.id);
  const stories = kit.stories(d.id);
  const outcomes = kit.ctx.idx.outcomesByDeliverable.get(d.id) ?? [];
  const evidence = kit.ctx.evidenceByDeliverable.get(d.id) ?? [];
  const raid = openRaid(kit, d);
  const deps = dependenciesInto(kit, d);
  const findings = kit.engineFindings((f) => f.deliverableId === d.id);

  kit.step('read', `Read ${d.ref} from ${PS()}`, `Reported ${terms.rag[d.reportedRag]} on ${date(d.reportedAt)}; ${plural(outcomes.length, 'outcome')}, ${plural(epics.length, 'Epic')} listed.`, [dRef]);
  kit.step(
    'read',
    `Read ${plural(epics.length, 'Epic')} and ${plural(stories.length, 'work item')} from ${terms.systems['work-tracker']}`,
    `${stories.filter(isClosed).length} closed, ${stories.filter((s) => !isClosed(s)).length} open.`,
    epics.map(ref.item),
  );
  kit.step('read', `Read ${plural(evidence.length, 'evidence record')}, ${plural(raid.length, 'open RAID item')} and ${plural(deps.length, 'open dependency', 'open dependencies')}`, 'Evidence, RAID and dependencies linked to the deliverable.', [
    ...evidence.map((e) => ref.evidence(e.id)),
    ...raid.map((r) => ref.raid(r.id)),
  ]);
  kit.step('compute', 'Computed the three measures separately', measureLine(kit, d.id), [dRef]);
  kit.step(
    'check',
    `Compared reported ${terms.rag[d.reportedRag]} with the evidence`,
    rag ? `Evidence-based RAG is ${terms.rag[rag.evidence]}${rag.disagrees ? '; they disagree' : ''}. ${plural(findings.length, 'finding')} apply.` : 'No evidence-based RAG.',
    [dRef, ...findings.slice(0, 6).map((f) => ref.finding(f.id))],
  );

  // --- Headline
  const headline: DraftSentence[] = [];
  headline.push(kit.sentence(`${d.ref} ${quote(d.title)} is in ${stageName(d)} and is reported ${terms.rag[d.reportedRag]} in ${PS()} as of ${date(d.reportedAt)}.`, [dRef]));
  if (rag) {
    if (rag.disagrees) {
      headline.push(
        kit.sentence(
          `The evidence does not support the reported ${terms.rag[rag.reported]}: on the records it is ${terms.rag[rag.evidence]}.`,
          [dRef, ...rag.reasons.flatMap((r) => r.refs)],
        ),
      );
    } else if (rag.evidence === 'unknown') {
      headline.push(kit.sentence(`There is too little evidence to confirm the reported ${terms.rag[rag.reported]}.`, [dRef, ...rag.reasons.flatMap((r) => r.refs)]));
    } else {
      headline.push(kit.sentence(`The evidence supports the reported ${terms.rag[rag.reported]}.`, [dRef, ...rag.reasons.flatMap((r) => r.refs)]));
    }
    for (const r of rag.reasons.slice(0, 3)) headline.push(kit.sentence(r.message, r.refs, dRef));
  }
  kit.section('Headline', headline);

  // --- Progress: three measures, separately
  const progress: DraftSentence[] = [];
  if (m) {
    const wc = m.workCompletion;
    progress.push(
      wc.computable
        ? kit.sentence(
            `Work completion is ${wc.value.percent}%: ${wc.value.closedPoints} of ${wc.value.totalPoints} points closed across ${plural(wc.value.epicKeys.length, 'Epic')} (${listPhrases(wc.value.epicKeys)})` +
              (wc.value.unestimatedItemCount > 0 ? `, with ${plural(wc.value.unestimatedItemCount, 'item')} not estimated.` : '.'),
            wc.value.epicKeys.map(ref.item),
            dRef,
          )
        : kit.sentence(`Work completion is ${lowerFirst(terms.measures.notComputable)}: ${wc.detail}`, [dRef]),
    );
    const ao = m.acceptedOutcomes;
    if (ao.computable) {
      progress.push(
        kit.sentence(
          `Accepted outcomes: ${ao.value.acceptedCount} of ${plural(ao.value.totalCount, 'outcome')} accepted, ${ao.value.percent}% of outcome weight.`,
          ao.value.outcomes.map((o) => ref.outcome(o.outcomeId)),
          dRef,
        ),
      );
      const claimed = outcomes.filter((o) => (o.reportedStatus === 'on-track' || o.reportedStatus === 'complete') && kit.results.outcomes[o.id]?.acceptance.accepted === false);
      if (claimed.length > 0) {
        progress.push(
          kit.sentence(
            `${plural(claimed.length, 'outcome')} ${claimed.length === 1 ? 'is' : 'are'} reported on track or complete in ${PS()} with no acceptance recorded: ${listPhrases(claimed.map((o) => `${o.ref} ${quote(o.title)}`))}.`,
            claimed.map((o) => ref.outcome(o.id)),
          ),
        );
      }
    } else {
      progress.push(kit.sentence(`Accepted outcomes are ${lowerFirst(terms.measures.notComputable)}: ${ao.detail}`, [dRef]));
    }
    const rd = m.readiness;
    progress.push(kit.sentence(`Delivery readiness is ${terms.readiness[rd.state]} against the ${rd.requiredEvidence.length} evidence kinds ${terms.riskTiers[rd.riskTier]} requires.`, [dRef]));
    for (const r of rd.reasons.slice(0, 3)) progress.push(kit.sentence(r.message, r.refs, dRef));
  }
  kit.section('Progress', progress);

  // --- Milestones
  const ms = milestoneFacts(kit, d);
  const relevant = ms.filter((f) => f.milestone.status !== 'met' && f.daysAway <= 45);
  const msSentences: DraftSentence[] = relevant.slice(0, 4).map((f) => kit.sentence(milestoneSentence(kit, f), [ref.milestone(f.milestone.id), ...f.linked.filter((w) => !isClosed(w)).slice(0, 5).map((w) => ref.item(w.key))]));
  if (msSentences.length === 0) {
    const next = ms.find((f) => f.daysAway >= 0);
    msSentences.push(
      next
        ? kit.sentence(`No milestone falls in the next 45 days; the next is ${quote(next.milestone.title)} on ${date(next.milestone.date)}.`, [ref.milestone(next.milestone.id)])
        : kit.sentence(`No upcoming milestones are recorded for ${d.ref}.`, [dRef]),
    );
  }
  kit.section('Milestones', msSentences);

  // --- Risks and issues
  const risks: DraftSentence[] = [];
  if (raid.length === 0) risks.push(kit.sentence(`No RAID items are open for ${d.ref}.`, [dRef]));
  else {
    const bySev = (['critical', 'high', 'medium', 'low'] as const).map((s) => [s, raid.filter((r) => r.severity === s).length] as const).filter(([, n]) => n > 0);
    risks.push(kit.sentence(`${plural(raid.length, 'RAID item')} ${raid.length === 1 ? 'is' : 'are'} open: ${listPhrases(bySev.map(([s, n]) => `${n} ${lowerFirst(terms.severity[s])}`))}.`, raid.map((r) => ref.raid(r.id))));
    for (const r of raid.slice(0, 4)) {
      const problems = raidProblems(kit, r);
      risks.push(kit.sentence(raidSentence(kit, r) + (problems.length > 0 ? ` It ${listPhrases(problems)}.` : ''), [ref.raid(r.id), ...(r.ownerId ? [ref.person(r.ownerId)] : [])]));
    }
  }
  kit.section('Risks and issues', risks);

  // --- Dependencies
  const depSentences: DraftSentence[] = deps.slice(0, 4).map((dep) => kit.sentence(dependencySentence(kit, dep, 'receiver'), [ref.dependency(dep.id), ref.deliverable(dep.fromDeliverableId)]));
  const provides = (kit.ctx.dependenciesFrom.get(d.id) ?? []).filter((x) => x.status !== 'delivered' && x.deliveredOn === null);
  if (provides.length > 0) {
    depSentences.push(kit.sentence(`${d.ref} provides ${plural(provides.length, 'open dependency', 'open dependencies')} to ${listPhrases([...new Set(provides.map((x) => kit.deliverable(x.toDeliverableId)?.ref ?? x.toDeliverableId))])}.`, provides.map((x) => ref.dependency(x.id))));
  }
  if (depSentences.length === 0) depSentences.push(kit.sentence(`${d.ref} has no open dependencies in either direction.`, [dRef]));
  kit.section('Dependencies', depSentences);

  // --- Decisions needed
  const decisions = decisionsFor(kit, d);
  kit.section(
    'Decisions needed',
    decisions.length > 0 ? decisions.slice(0, 5).map((x) => kit.sentence(x.text, x.refs, dRef)) : [kit.sentence(`No decisions are needed on ${d.ref} this period.`, [dRef])],
  );

  // --- Next period
  const next: DraftSentence[] = [];
  const due = itemsDueSoon(kit, d);
  next.push(
    due.length > 0
      ? kit.sentence(`${plural(due.length, 'open item')} ${due.length === 1 ? 'is' : 'are'} due by ${date(kit.plusDays(14))}: ${listPhrases(due.slice(0, 6).map((w) => `${w.key} (${date(w.due as string)})`))}${due.length > 6 ? ' and others' : ''}.`, due.map((w) => ref.item(w.key)))
      : kit.sentence(`No open items are due in the next 14 days.`, [dRef]),
  );
  const { run, reviews } = outstandingStageReviews(kit, d);
  if (run && reviews.length > 0) {
    next.push(
      kit.sentence(
        `${stageName(d)} needs the ${listPhrases(reviews.map((r) => `${lowerFirst(terms.reviewRoles[r.roleId])} review${r.reviewerId ? ` by ${kit.person(r.reviewerId)}` : ''}`))} before it can move on.`,
        [ref.pdlcRun(run.id), ...reviews.flatMap((r) => (r.reviewerId ? [ref.person(r.reviewerId)] : []))],
      ),
    );
  }
  if (m && m.readiness.missing.length > 0) {
    next.push(kit.sentence(`Evidence still to obtain for readiness: ${listPhrases(m.readiness.missing.map((k) => lowerFirst(terms.evidenceKinds[k])))}.`, [dRef]));
  }
  kit.section('Next period', next);

  kit.step('draft', `Drafted ${kit.sections.reduce((n, s) => n + s.sentences.length, 0)} cited sentences in ${kit.sections.length} sections`, 'Every sentence cites at least one record.', [dRef]);

  const verdict = rag && rag.disagrees ? `reported ${terms.rag[rag.reported]}, evidence ${terms.rag[rag.evidence]}` : `reported ${terms.rag[d.reportedRag]}`;
  return kit.output(`Weekly status for ${d.ref} drafted (${verdict}).`, {
    kind: 'weekly-status',
    deliverableId: d.id,
    title: `Weekly status: ${d.ref} ${d.title}, week to ${date(kit.today)}`,
    agentId: 'status-reporting',
    sections: kit.sections,
    provenance: 'scripted-agent',
  });
}

function measureLine(kit: AgentKit, id: string): string {
  const m = kit.results.deliverables[id];
  if (!m) return 'No measures.';
  const wc = m.workCompletion.computable ? `${m.workCompletion.value.percent}% of work closed` : 'work completion not computable';
  const ao = m.acceptedOutcomes.computable ? `${m.acceptedOutcomes.value.acceptedCount} of ${m.acceptedOutcomes.value.totalCount} outcomes accepted` : 'accepted outcomes not computable';
  return `${wc}; ${ao}; readiness ${lowerFirst(terms.readiness[m.readiness.state])}.`;
}

// ---------------------------------------------------------------------------
// Programme or portfolio
// ---------------------------------------------------------------------------

function groupStatus(kit: AgentKit): AgentRunOutput {
  const ds = kit.deliverables;
  if (ds.length === 0) return missing(kit);
  const ids = ds.map((d) => d.id);
  const roll = rollupMeasures(kit.results, ids);
  const scope = kit.scope;
  const node = scope.kind === 'programme' ? kit.ctx.idx.pmNodes.get(scope.pmNodeId) : undefined;
  const anchor: EntityRef = node ? ref.pmNode(node.id) : ref.deliverable(ids[0] as string);
  const label = node ? `${node.ref} ${node.title}` : 'the portfolio';
  const stories = ds.flatMap((d) => kit.stories(d.id));
  const raid = ds.flatMap((d) => openRaid(kit, d));

  kit.step('read', `Read ${plural(ds.length, 'deliverable')} in ${kit.scopeLabel}`, `Reported RAG and commentary from ${PS()}.`, ids.slice(0, 25).map(ref.deliverable));
  kit.step('read', `Read ${plural(stories.length, 'work item')} under ${plural(ds.reduce((n, d) => n + kit.epics(d.id).length, 0), 'Epic')}`, `${stories.filter(isClosed).length} closed.`);
  kit.step('compute', 'Rolled up the three measures', groupMeasureLine(roll), ids.slice(0, 10).map(ref.deliverable));

  const disagree = ids.filter((id) => kit.results.deliverableRag[id]?.disagrees);
  kit.step('check', `Compared reported and evidence-based RAG for ${plural(ds.length, 'deliverable')}`, `${plural(disagree.length, 'deliverable')} disagree.`, disagree.map(ref.deliverable));

  // --- Headline
  const headline: DraftSentence[] = [];
  if (node) {
    const nodeRag = kit.results.pmNodeRag[node.id];
    headline.push(kit.sentence(`${terms.pmNodeLevels[node.level]} ${node.ref} ${quote(node.title)} is reported ${terms.rag[node.reportedRag]} in ${PS()} as of ${date(node.reportedAt)}.`, [anchor]));
    if (nodeRag) {
      headline.push(
        nodeRag.disagrees
          ? kit.sentence(`The evidence does not support the reported ${terms.rag[nodeRag.reported]}: across its ${plural(ds.length, 'deliverable')} it is ${terms.rag[nodeRag.evidence]}.`, [anchor, ...nodeRag.reasons.flatMap((r) => r.refs)])
          : kit.sentence(`The evidence-based RAG across its ${plural(ds.length, 'deliverable')} is ${terms.rag[nodeRag.evidence]}.`, [anchor, ...nodeRag.reasons.flatMap((r) => r.refs)]),
      );
    }
  }
  headline.push(
    disagree.length > 0
      ? kit.sentence(
          `${plural(disagree.length, 'deliverable')} ${disagree.length === 1 ? 'is' : 'are'} reported better than the evidence supports: ${listPhrases(disagree.slice(0, 6).map((id) => ragPair(kit, id)))}${disagree.length > 6 ? ' and others' : ''}.`,
          disagree.map(ref.deliverable),
        )
      : kit.sentence(`Reported and evidence-based RAG agree for every deliverable in ${label}.`, ids.map(ref.deliverable), anchor),
  );
  kit.section('Headline', headline);

  // --- Progress
  const progress: DraftSentence[] = [];
  const wc = roll.workCompletion;
  progress.push(
    wc.computable
      ? kit.sentence(`Work completion is ${wc.value.percent}%: ${wc.value.closedPoints} of ${wc.value.totalPoints} points closed across ${plural(ds.length, 'deliverable')}.`, ids.map(ref.deliverable))
      : kit.sentence(`Work completion is ${lowerFirst(terms.measures.notComputable)}: ${wc.detail}`, [anchor]),
  );
  const ao = roll.acceptedOutcomes;
  progress.push(
    ao.computable
      ? kit.sentence(`Accepted outcomes: ${ao.value.acceptedCount} of ${plural(ao.value.totalCount, 'outcome')} accepted, ${ao.value.percent}% of outcome weight.`, ao.value.outcomes.slice(0, 12).map((o) => ref.outcome(o.outcomeId)), anchor)
      : kit.sentence(`Accepted outcomes are ${lowerFirst(terms.measures.notComputable)}: ${ao.detail}`, [anchor]),
  );
  const notReady = ids.filter((id) => kit.results.deliverables[id]?.readiness.state === 'not-ready');
  const ready = ids.filter((id) => kit.results.deliverables[id]?.readiness.state === 'ready');
  progress.push(
    kit.sentence(
      `Delivery readiness: ${roll.readiness.ready} ${lowerFirst(terms.readiness.ready)}, ${roll.readiness['not-ready']} ${lowerFirst(terms.readiness['not-ready'])}, ${roll.readiness.unknown} ${lowerFirst(terms.readiness.unknown)}.`,
      [...notReady, ...ready].map(ref.deliverable),
      anchor,
    ),
  );
  kit.section('Progress', progress);

  // --- Deliverables (one line each, worst first; the portfolio lists only exceptions)
  const lines = ds
    .filter((d) => scope.kind === 'programme' || kit.results.deliverableRag[d.id]?.disagrees || kit.results.deliverables[d.id]?.readiness.state === 'not-ready')
    .slice(0, 10)
    .map((d) => kit.sentence(`${d.ref} ${quote(d.title)}: ${ragPair(kit, d.id, false)}; ${measureLine(kit, d.id)}`, [ref.deliverable(d.id)]));
  kit.section(scope.kind === 'programme' ? 'Deliverables' : 'Deliverables needing attention', lines);

  // --- Milestones
  const ms = ds
    .flatMap((d) => milestoneFacts(kit, d))
    .filter((f) => f.milestone.status !== 'met' && f.daysAway <= 30)
    .sort((a, b) => a.milestone.date.localeCompare(b.milestone.date));
  kit.section(
    'Milestones',
    ms.length > 0
      ? ms.slice(0, 6).map((f) => kit.sentence(milestoneSentence(kit, f, true), [ref.milestone(f.milestone.id), ref.deliverable(f.milestone.deliverableId)]))
      : [kit.sentence(`No milestones fall in the next 30 days in ${label}.`, [anchor])],
  );

  // --- Risks
  const serious = raid.filter((r) => r.severity === 'critical' || r.severity === 'high');
  const riskSentences: DraftSentence[] = [
    kit.sentence(`${plural(raid.length, 'RAID item')} ${raid.length === 1 ? 'is' : 'are'} open, ${serious.length} of them high or critical.`, raid.map((r) => ref.raid(r.id)), anchor),
    ...serious.slice(0, 4).map((r) => kit.sentence(`${kit.deliverable(r.deliverableId)?.ref ?? ''} ${raidSentence(kit, r)}`, [ref.raid(r.id), ref.deliverable(r.deliverableId)])),
  ];
  kit.section('Risks and issues', riskSentences);

  // --- Dependencies
  const deps = ds.flatMap((d) => dependenciesInto(kit, d)).filter((dep) => dep.status === 'late' || dep.status === 'blocked' || dep.status === 'at-risk');
  kit.section(
    'Dependencies',
    deps.length > 0
      ? deps.slice(0, 5).map((dep) => kit.sentence(`${kit.deliverable(dep.toDeliverableId)?.ref ?? ''}: ${dependencySentence(kit, dep, 'receiver')}`, [ref.dependency(dep.id), ref.deliverable(dep.toDeliverableId)]))
      : [kit.sentence(`No incoming dependency in ${label} is at risk, late or blocked.`, [anchor])],
  );

  // --- Decisions
  const decisions = ds.flatMap((d) => decisionsFor(kit, d).map((x) => ({ ...x, d }))).sort((a, b) => a.rank - b.rank);
  kit.section(
    'Decisions needed',
    decisions.length > 0 ? decisions.slice(0, 6).map((x) => kit.sentence(`${x.d.ref}: ${x.text}`, [ref.deliverable(x.d.id), ...x.refs])) : [kit.sentence(`No decisions are needed in ${label} this period.`, [anchor])],
  );

  // --- Next period
  const due = ds.flatMap((d) => itemsDueSoon(kit, d));
  const waiting = ds.filter((d) => outstandingStageReviews(kit, d).reviews.length > 0);
  kit.section('Next period', [
    kit.sentence(`${plural(due.length, 'open item')} ${due.length === 1 ? 'is' : 'are'} due by ${date(kit.plusDays(14))}.`, due.map((w) => ref.item(w.key)), anchor),
    kit.sentence(`${plural(waiting.length, 'deliverable')} ${waiting.length === 1 ? 'is' : 'are'} waiting on a PDLC review before moving stage.`, waiting.map((d) => ref.deliverable(d.id)), anchor),
  ]);

  kit.step('draft', `Drafted ${kit.sections.reduce((n, s) => n + s.sentences.length, 0)} cited sentences in ${kit.sections.length} sections`, 'Every sentence cites at least one record.', [anchor]);
  return kit.output(`Weekly status for ${label} drafted: ${plural(disagree.length, 'status disagreement')}, ${roll.readiness['not-ready']} not ready.`, {
    kind: 'weekly-status',
    deliverableId: null,
    title: `Weekly status: ${label}, week to ${date(kit.today)}`,
    agentId: 'status-reporting',
    sections: kit.sections,
    provenance: 'scripted-agent',
  });
}

export function ragPair(kit: AgentKit, id: string, withRef = true): string {
  const rag = kit.results.deliverableRag[id];
  const d = kit.deliverable(id);
  if (!rag || !d) return '';
  return `${withRef ? `${d.ref} ` : ''}reported ${terms.rag[rag.reported]}, evidence ${terms.rag[rag.evidence]}`;
}

function groupMeasureLine(roll: ReturnType<typeof rollupMeasures>): string {
  const wc = roll.workCompletion.computable ? `${roll.workCompletion.value.percent}% of work closed` : 'work completion not computable';
  const ao = roll.acceptedOutcomes.computable ? `${roll.acceptedOutcomes.value.acceptedCount} of ${roll.acceptedOutcomes.value.totalCount} outcomes accepted` : 'accepted outcomes not computable';
  return `${wc}; ${ao}; ${roll.readiness.ready} ready, ${roll.readiness['not-ready']} not ready, ${roll.readiness.unknown} unknown.`;
}
