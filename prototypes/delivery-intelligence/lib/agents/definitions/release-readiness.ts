/**
 * Release readiness (read only). Builds the readiness checklist for a
 * deliverable (or every deliverable in scope) from what the engine holds:
 * each required evidence kind with its state, open critical dependencies, the
 * outstanding PDLC reviews and the open work, and lists the exceptions. It
 * reports the readiness the engine computed; it never sets readiness.
 */
import { AGENT_CATALOGUE } from '@/lib/agents/catalogue';
import { terms } from '@/lib/config/terminology';
import { isClosed } from '@/lib/engine';
import type { AgentRunOutput, DraftSentence, TechDeliverable } from '@/lib/types';
import { dependenciesInto, dependencySentence, outstandingStageReviews, stageName } from '../facts';
import { AgentKit, softLower, date, listPhrases, lowerFirst, plural, quote, ref } from '../kit';
import type { ScriptedAgent, ScriptedAgentInput } from '../types';

const meta = AGENT_CATALOGUE['release-readiness'];

export const releaseReadinessAgent: ScriptedAgent = {
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
    if (ds.length === 0) {
      kit.step('blocked', 'No deliverable', `Nothing matches ${kit.scopeLabel}.`);
      return kit.output('No deliverable in scope.');
    }
    const evidence = ds.reduce((n, d) => n + (kit.ctx.evidenceByDeliverable.get(d.id)?.length ?? 0), 0);
    kit.step('read', `Read ${plural(evidence, 'evidence record')} for ${plural(ds.length, 'deliverable')}`, `In ${kit.scopeLabel}.`, ds.slice(0, 25).map((d) => ref.deliverable(d.id)));

    const counts = { ready: 0, 'not-ready': 0, unknown: 0 };
    let exceptions = 0;
    if (ds.length === 1) {
      exceptions = checklist(kit, ds[0]!);
      counts[kit.results.deliverables[ds[0]!.id]?.readiness.state ?? 'unknown'] += 1;
    } else {
      const lines: DraftSentence[] = [];
      for (const d of ds) {
        const rd = kit.results.deliverables[d.id]?.readiness;
        if (!rd) continue;
        counts[rd.state] += 1;
        const ex = rd.missing.length + rd.failing.length + rd.stale.length + rd.blockingDependencyIds.length;
        exceptions += ex;
        if (rd.state === 'ready') continue;
        lines.push(kit.sentence(`${d.ref} ${quote(d.title)} is ${lowerFirst(terms.readiness[rd.state])}: ${rd.reasons.map((r) => softLower(r.message.replace(/\.$/, ''))).slice(0, 2).join('; ')}.`, [ref.deliverable(d.id), ...rd.reasons.flatMap((r) => r.refs)]));
      }
      kit.step('check', `Checked required evidence and critical dependencies for ${plural(ds.length, 'deliverable')}`, `${counts.ready} ready, ${counts['not-ready']} not ready, ${counts.unknown} unknown.`, []);
      kit.section('Summary', [
        kit.sentence(
          `${counts.ready} ${lowerFirst(terms.readiness.ready)}, ${counts['not-ready']} ${lowerFirst(terms.readiness['not-ready'])} and ${counts.unknown} ${lowerFirst(terms.readiness.unknown)} across ${plural(ds.length, 'deliverable')}, with ${plural(exceptions, 'exception')}.`,
          ds.map((d) => ref.deliverable(d.id)),
        ),
      ]);
      kit.section('Exceptions', lines.slice(0, 12));
    }
    kit.step('note', 'Report only', 'Readiness is computed by the engine from evidence; this agent cannot set it.', []);
    const one = ds.length === 1 ? ds[0]! : null;
    return kit.output(
      one ? `${one.ref} is ${lowerFirst(terms.readiness[kit.results.deliverables[one.id]?.readiness.state ?? 'unknown'])} with ${plural(exceptions, 'exception')}.` : `${counts.ready} ready, ${counts['not-ready']} not ready, ${counts.unknown} unknown in ${kit.scopeLabel}.`,
      {
        kind: 'readiness-checklist',
        deliverableId: one?.id ?? null,
        title: `Readiness checklist: ${one ? `${one.ref} ${one.title}` : kit.scopeLabel}`,
        agentId: 'release-readiness',
        sections: kit.sections,
        provenance: 'scripted-agent',
      },
    );
  },
};

function checklist(kit: AgentKit, d: TechDeliverable): number {
  const dRef = ref.deliverable(d.id);
  const m = kit.results.deliverables[d.id];
  if (!m) return 0;
  const rd = m.readiness;
  const deps = dependenciesInto(kit, d).filter((x) => x.critical);
  kit.step('check', `Checked ${plural(rd.requiredEvidence.length, 'required evidence kind')} for ${terms.riskTiers[d.riskTier]}`, listPhrases(rd.held.map((h) => `${lowerFirst(terms.evidenceKinds[h.kind])}: ${lowerFirst(terms.evidenceHeld[h.state])}`)) + '.', rd.held.flatMap((h) => (h.evidenceId ? [ref.evidence(h.evidenceId)] : [])));
  kit.step('check', `Checked ${plural(deps.length, 'open critical dependency', 'open critical dependencies')}`, deps.length > 0 ? listPhrases(deps.map((x) => quote(x.title))) : 'None open.', deps.map((x) => ref.dependency(x.id)));

  const items: DraftSentence[] = rd.held.map((h) => {
    const e = h.evidenceId ? kit.ctx.idx.evidence.get(h.evidenceId) : undefined;
    const detail = e
      ? ` (${quote(e.title)}, ${e.sourceRef}, observed ${date(e.observedAt)}${e.provenance === 'simulated' ? ', simulated' : ''}${h.state === 'stale' && h.workChangedAt ? `; work changed ${date(h.workChangedAt)}` : ''})`
      : '';
    return kit.sentence(`${h.state === 'passing' ? 'Done' : 'Exception'}: ${terms.evidenceKinds[h.kind]} is ${lowerFirst(terms.evidenceHeld[h.state])}${detail}.`, e ? [ref.evidence(e.id)] : [dRef]);
  });
  for (const dep of deps) items.push(kit.sentence(`Exception: ${dependencySentence(kit, dep, 'receiver')}`, [ref.dependency(dep.id), ref.deliverable(dep.fromDeliverableId)]));
  if (deps.length === 0) items.push(kit.sentence('Done: no critical dependency into this deliverable is open.', [dRef]));
  kit.section('Checklist', items);

  const context: DraftSentence[] = [];
  context.push(kit.sentence(`The engine computes ${d.ref} as ${terms.readiness[rd.state]}; this checklist reports it and does not set it.`, [dRef, ...rd.reasons.flatMap((r) => r.refs)]));
  const { run, reviews } = outstandingStageReviews(kit, d);
  if (run) {
    context.push(
      reviews.length > 0
        ? kit.sentence(`${stageName(d)} still needs the ${listPhrases(reviews.map((r) => terms.coreRoles[r.roleId]))} ${reviews.length === 1 ? 'review' : 'reviews'}.`, [ref.pdlcRun(run.id)])
        : kit.sentence(`Every ${stageName(d)} review is approved.`, [ref.pdlcRun(run.id)]),
    );
  }
  const stories = kit.stories(d.id);
  const open = stories.filter((w) => !isClosed(w));
  context.push(kit.sentence(`${plural(open.length, 'story-level item')} of ${stories.length} ${open.length === 1 ? 'is' : 'are'} still open; open work does not change readiness but should be explained at release.`, open.length > 0 ? open.slice(0, 10).map((w) => ref.item(w.key)) : [dRef], dRef));
  if (m.acceptedOutcomes.computable) {
    context.push(kit.sentence(`${m.acceptedOutcomes.value.acceptedCount} of ${plural(m.acceptedOutcomes.value.totalCount, 'outcome')} accepted; acceptance is reported separately from readiness.`, m.acceptedOutcomes.value.outcomes.map((o) => ref.outcome(o.outcomeId)), dRef));
  }
  kit.section('Context', context);
  return rd.missing.length + rd.failing.length + rd.stale.length + rd.held.filter((h) => h.state === 'pending').length + deps.length;
}
