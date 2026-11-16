/**
 * Control evidence check (read only). For each deliverable in scope it lists
 * the evidence its risk tier requires and whether each kind is held, passing,
 * failing, stale, pending or missing, and checks the fields the tier depends on:
 *   all tiers  Epics carry a valid Deliverable ID; every review role has a named person
 *   T2 and up  agent-assigned items have a named human reviewer
 *   T3 and up  high and critical RAID items have an owner and a mitigation date;
 *              every outcome has at least one mandatory acceptance criterion
 *   T4         the control owner is not the deliverable owner (segregation of duties)
 * It changes nothing and proposes nothing.
 */
import { AGENT_CATALOGUE } from '@/lib/agents/catalogue';
import { requiredEvidenceFor } from '@/lib/config/risk-tiers';
import { terms } from '@/lib/config/terminology';
import type { AgentRunOutput, DraftSentence, EntityRef, ReviewRoleId, RiskTier, TechDeliverable } from '@/lib/types';
import { AgentKit, listPhrases, lowerFirst, plural, ref } from '../kit';
import type { ScriptedAgent, ScriptedAgentInput } from '../types';

const meta = AGENT_CATALOGUE['control-evidence-check'];
const ROLES: ReviewRoleId[] = ['requirements-owner', 'design-reviewer', 'control-owner', 'independent-validator', 'business-owner', 'release-owner'];
const TIER_RANK: Record<RiskTier, number> = { T1: 1, T2: 2, T3: 3, T4: 4 };

export interface ControlGap {
  text: string;
  refs: EntityRef[];
}

export const controlEvidenceCheckAgent: ScriptedAgent = {
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
    const evidenceCount = ds.reduce((n, d) => n + (kit.ctx.evidenceByDeliverable.get(d.id)?.length ?? 0), 0);
    const tiers = [...new Set(ds.map((d) => d.riskTier))].sort();
    kit.step('read', `Read ${plural(ds.length, 'deliverable')} and ${plural(evidenceCount, 'evidence record')}`, `Risk tiers in scope: ${listPhrases(tiers.map((t) => terms.riskTiers[t]))}.`, ds.slice(0, 25).map((d) => ref.deliverable(d.id)));
    kit.step('read', 'Read the evidence each risk tier requires', listPhrases(tiers.map((t) => `${t}: ${requiredEvidenceFor(t).length} kinds`)) + '.', []);

    let checked = 0;
    let held = 0;
    let missing = 0;
    let fieldGaps = 0;
    const rows: { d: TechDeliverable; gaps: ControlGap[]; evidence: DraftSentence[] }[] = [];
    for (const d of ds) {
      const rd = kit.results.deliverables[d.id]?.readiness;
      const dRef = ref.deliverable(d.id);
      const evidence: DraftSentence[] = [];
      if (rd) {
        checked += rd.requiredEvidence.length;
        held += rd.held.filter((h) => h.state !== 'missing').length;
        missing += rd.missing.length;
        const groups = (['passing', 'failing', 'stale', 'pending', 'missing'] as const)
          .map((state) => ({ state, kinds: rd.held.filter((h) => h.state === state) }))
          .filter((g) => g.kinds.length > 0);
        evidence.push(
          kit.sentence(
            `${d.ref} (${terms.riskTiers[d.riskTier]}) requires ${plural(rd.requiredEvidence.length, 'evidence kind')}: ${listPhrases(groups.map((g) => `${listPhrases(g.kinds.map((h) => lowerFirst(terms.evidenceKinds[h.kind])))} ${lowerFirst(terms.evidenceHeld[g.state])}`))}.`,
            [dRef, ...rd.held.flatMap((h) => (h.evidenceId ? [ref.evidence(h.evidenceId)] : []))],
          ),
        );
        for (const h of rd.held) {
          if (h.state === 'failing' && h.evidenceId) {
            const e = kit.ctx.idx.evidence.get(h.evidenceId);
            kit.finding('R13', 'critical', ref.evidence(h.evidenceId), d.id, `${d.ref}: required ${lowerFirst(terms.evidenceKinds[h.kind])} ${e ? `${e.sourceRef} ` : ''}is failing.`, [dRef]);
          }
          if (h.state === 'stale' && h.evidenceId) {
            kit.finding('R12', 'high', ref.evidence(h.evidenceId), d.id, `${d.ref}: ${lowerFirst(terms.evidenceKinds[h.kind])} is older than the latest change to the work it covers.`, [dRef]);
          }
        }
      }
      const gaps = fieldGapsFor(kit, d);
      fieldGaps += gaps.length;
      rows.push({ d, gaps, evidence });
    }
    kit.step('check', `Checked ${plural(checked, 'required evidence kind')} across ${plural(ds.length, 'deliverable')}`, `${held} held, ${missing} missing.`, []);
    kit.step('check', 'Checked the fields each tier depends on', `${plural(fieldGaps, 'field gap')} found.`, rows.flatMap((r) => r.gaps.flatMap((g) => g.refs)).slice(0, 25));

    const withGaps = rows.filter((r) => r.gaps.length > 0 || (kit.results.deliverables[r.d.id]?.readiness.state ?? 'unknown') !== 'ready');
    const shown = ds.length === 1 ? rows : withGaps.slice(0, 10);
    if (ds.length > 1) {
      kit.section('Summary', [
        kit.sentence(`${plural(withGaps.length, 'deliverable')} of ${ds.length} ${withGaps.length === 1 ? 'has' : 'have'} missing, failing or stale control evidence or a field gap.`, withGaps.map((r) => ref.deliverable(r.d.id)), ref.deliverable(ds[0]!.id)),
      ]);
    }
    for (const r of shown) {
      const sentences = [...r.evidence, ...r.gaps.map((g) => kit.sentence(g.text, g.refs, ref.deliverable(r.d.id)))];
      if (r.gaps.length === 0) sentences.push(kit.sentence(`No field gaps for ${terms.riskTiers[r.d.riskTier]}.`, [ref.deliverable(r.d.id)]));
      kit.section(`${r.d.ref} ${r.d.title}`, sentences);
    }
    kit.step('note', 'Report only', 'This agent reports what is held and missing; it records no evidence and sets no readiness.', []);
    return kit.output(`Control evidence for ${kit.scopeLabel}: ${missing} required kinds missing, ${plural(fieldGaps, 'field gap')}.`, {
      kind: 'readiness-checklist',
      deliverableId: ds.length === 1 ? ds[0]!.id : null,
      title: `Control evidence check: ${ds.length === 1 ? `${ds[0]!.ref} ${ds[0]!.title}` : kit.scopeLabel}`,
      agentId: 'control-evidence-check',
      sections: kit.sections,
      provenance: 'scripted-agent',
    });
  },
};

export function fieldGapsFor(kit: AgentKit, d: TechDeliverable): ControlGap[] {
  const gaps: ControlGap[] = [];
  const dRef = ref.deliverable(d.id);
  const tier = TIER_RANK[d.riskTier];

  for (const key of kit.epics(d.id)) {
    const epic = kit.ctx.idx.workItems.get(key);
    if (!epic) continue;
    if (!epic.deliverableId || !kit.ctx.resolveDeliverable(epic.deliverableId)) {
      gaps.push({ text: `${terms.hierarchy.epic} ${key} has ${epic.deliverableId ? `a ${terms.hierarchy.deliverableIdField} (${epic.deliverableId}) that does not exist` : `no ${terms.hierarchy.deliverableIdField}`}.`, refs: [ref.item(key)] });
      kit.finding('R14', 'high', ref.item(key), d.id, `${terms.hierarchy.epic} ${key} of ${d.ref} has no valid ${terms.hierarchy.deliverableIdField}.`, [dRef]);
    }
  }
  const unnamed = ROLES.filter((r) => !d.reviewers[r] || !kit.ctx.idx.people.has(d.reviewers[r] as string));
  if (unnamed.length > 0) gaps.push({ text: `No named person for the ${listPhrases(unnamed.map((r) => lowerFirst(terms.reviewRoles[r])))} ${unnamed.length === 1 ? 'review' : 'reviews'}.`, refs: [dRef] });

  if (tier >= 2) {
    const agentItems = kit.stories(d.id).filter((w) => w.assigneeType === 'agent');
    const noReviewer = agentItems.filter((w) => !w.reviewerId || !kit.ctx.idx.people.has(w.reviewerId));
    if (noReviewer.length > 0) {
      gaps.push({ text: `${plural(noReviewer.length, 'agent-assigned item')} of ${agentItems.length} ${noReviewer.length === 1 ? 'has' : 'have'} no named human reviewer: ${listPhrases(noReviewer.slice(0, 5).map((w) => w.key))}.`, refs: noReviewer.map((w) => ref.item(w.key)) });
      for (const w of noReviewer) kit.finding('R10', 'high', ref.item(w.key), d.id, `${w.key} is assigned to an agent with no named human reviewer.`, [dRef]);
    }
  }
  if (tier >= 3) {
    const serious = (kit.ctx.raidByDeliverable.get(d.id) ?? []).filter((r) => r.status !== 'closed' && (r.severity === 'high' || r.severity === 'critical'));
    const weak = serious.filter((r) => !r.ownerId || !r.mitigationDue);
    if (weak.length > 0) {
      gaps.push({ text: `${plural(weak.length, 'high or critical RAID item')} ${weak.length === 1 ? 'lacks' : 'lack'} an owner or mitigation date: ${listPhrases(weak.map((r) => r.key))}.`, refs: weak.map((r) => ref.raid(r.id)) });
      for (const r of weak) kit.finding('R4', 'medium', ref.raid(r.id), d.id, `${r.key} (${lowerFirst(terms.severity[r.severity])}) lacks ${!r.ownerId ? 'an owner' : 'a mitigation date'}.`, [dRef]);
    }
    const outcomes = kit.ctx.idx.outcomesByDeliverable.get(d.id) ?? [];
    const noCriteria = outcomes.filter((o) => !(kit.ctx.idx.criteriaByOutcome.get(o.id) ?? []).some((c) => c.mandatory));
    if (noCriteria.length > 0) gaps.push({ text: `${plural(noCriteria.length, 'outcome')} ${noCriteria.length === 1 ? 'has' : 'have'} no mandatory acceptance criterion: ${listPhrases(noCriteria.map((o) => o.ref))}.`, refs: noCriteria.map((o) => ref.outcome(o.id)) });
  }
  if (tier >= 4 && d.reviewers['control-owner'] && d.reviewers['control-owner'] === d.ownerId) {
    gaps.push({ text: `The ${lowerFirst(terms.reviewRoles['control-owner'])} (${kit.person(d.ownerId)}) is also the deliverable owner; ${terms.riskTiers.T4} needs them to be different people.`, refs: [dRef, ref.person(d.ownerId)] });
  }
  return gaps;
}
