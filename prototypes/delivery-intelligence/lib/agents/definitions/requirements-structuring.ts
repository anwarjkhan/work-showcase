/**
 * Requirements structuring (draft). For the thinnest Epic of a deliverable, it
 * drafts stories with acceptance criteria from the deliverable's title, summary,
 * outcomes, outcome criteria and open assumptions, using scripted templates.
 * The draft is labelled as scripted; the stories are also offered as one
 * proposed change (add-work-items) that a named human must approve.
 *
 * Story acceptance criteria are stored as NON-mandatory criteria on the
 * outcome the story serves (text prefixed with the story key), so approving
 * the stories never changes the accepted-outcomes measure.
 */
import { AGENT_CATALOGUE } from '@/lib/agents/catalogue';
import { terms } from '@/lib/config/terminology';
import { isClosed } from '@/lib/engine';
import type { AcceptanceCriterion, AgentRunOutput, DraftSentence, EntityRef, Outcome, RaidItem, TechDeliverable, WorkItem, WorkItemType } from '@/lib/types';
import { AgentKit, compareKeys, coverage, date, gerund, listPhrases, lowerFirst, plural, quote, ref } from '../kit';
import type { ScriptedAgent, ScriptedAgentInput } from '../types';

const meta = AGENT_CATALOGUE['requirements-structuring'];
const MAX_STORIES = 6;

interface DraftStory {
  type: WorkItemType;
  summary: string;
  narrative: string;
  points: number;
  outcome: Outcome | null;
  criteria: { text: string; refs: EntityRef[] }[];
  basis: EntityRef[];
}

export const requirementsStructuringAgent: ScriptedAgent = {
  id: meta.id,
  name: meta.name,
  purpose: meta.purpose,
  stages: meta.stages,
  mode: meta.mode,
  output: meta.output,
  scopes: ['pdlc-stage', 'deliverable'],
  acceptsProgramme: false,
  provenance: 'scripted-agent',
  run(input: ScriptedAgentInput): AgentRunOutput {
    const kit = new AgentKit(input);
    const d = kit.deliverables[0];
    if (!d) {
      kit.step('blocked', 'No deliverable', `Nothing matches ${kit.scopeLabel}.`);
      return kit.output('No deliverable in scope.');
    }
    return structure(kit, d);
  },
};

function structure(kit: AgentKit, d: TechDeliverable): AgentRunOutput {
  const dRef = ref.deliverable(d.id);
  const ir = kit.ctx.idx.investmentRequests.get(d.investmentRequestId);
  const outcomes = (kit.ctx.idx.outcomesByDeliverable.get(d.id) ?? []).slice().sort((a, b) => compareKeys(a.ref, b.ref));
  const epicKeys = kit.epics(d.id);
  const stories = kit.stories(d.id);

  kit.step('read', `Read ${d.ref} ${quote(d.title)}`, `${plural(outcomes.length, 'outcome')}${ir ? `; objective of ${ir.ref}: ${quote(ir.objective)}` : ''}.`, [dRef, ...outcomes.map((o) => ref.outcome(o.id))]);

  if (epicKeys.length === 0) {
    kit.step('blocked', 'No Epic to structure', `${d.ref} has no Epic in ${terms.systems['work-tracker']}.`, [dRef]);
    return kit.output(`${d.ref} has no Epic to structure.`);
  }

  // Thinnest Epic: fewest story-level items, then the earliest key.
  const perEpic = epicKeys.map((key) => ({ key, items: stories.filter((s) => s.epicKey === key || s.parentKey === key) }));
  perEpic.sort((a, b) => a.items.length - b.items.length || compareKeys(a.key, b.key));
  const target = perEpic[0]!;
  const epic = kit.ctx.idx.workItems.get(target.key);
  const items = target.items;
  const unmapped = items.filter((w) => !w.outcomeId);
  const unestimated = items.filter((w) => w.points === null);
  const criteria = outcomes.flatMap((o) => kit.ctx.idx.criteriaByOutcome.get(o.id) ?? []);
  kit.step(
    'read',
    `Read ${plural(epicKeys.length, 'Epic')} and ${plural(stories.length, 'work item')}`,
    `${target.key} is the thinnest: ${plural(items.length, 'story-level item')}, ${unmapped.length} without an ${terms.hierarchy.outcomeIdField}, ${unestimated.length} not estimated.`,
    [ref.item(target.key), ...items.map((w) => ref.item(w.key))],
  );
  kit.step('read', `Read ${plural(criteria.length, 'acceptance criterion', 'acceptance criteria')} on ${plural(outcomes.length, 'outcome')}`, `${criteria.filter((c) => c.mandatory).length} mandatory.`, criteria.map((c) => ref.criterion(c.id)));

  const raid = (kit.ctx.raidByDeliverable.get(d.id) ?? []).filter((r) => r.status !== 'closed' && (r.kind === 'assumption' || r.kind === 'risk'));
  kit.step('read', `Read ${plural(raid.length, 'open assumption or risk', 'open assumptions and risks')}`, raid.length > 0 ? listPhrases(raid.map((r) => r.key)) : 'None open.', raid.map((r) => ref.raid(r.id)));

  // --- Templates
  const benefit = benefitOf(d, outcomes[0]);
  const drafts: DraftStory[] = [];
  for (const o of outcomes.slice(0, 2)) {
    const covered = stories.filter((s) => s.outcomeId !== null && kit.ctx.resolveOutcome(s.outcomeId)?.id === o.id);
    const mandatory = (kit.ctx.idx.criteriaByOutcome.get(o.id) ?? []).filter((c) => c.mandatory);
    const { persona, capability } = personaOf(o.title);
    if (covered.length === 0) {
      drafts.push({
        type: 'story',
        summary: capability ? capitalise(capability) : `Deliver ${lowerFirst(o.title)}`,
        narrative: capability
          ? `As a ${persona}, I want to ${capability}, so that ${benefit}.`
          : `Deliver ${quote(o.title)} so that ${benefit}.`,
        points: 5,
        outcome: o,
        criteria: [
          ...mandatory.map((c) => ({ text: c.text.replace(/\.$/, ''), refs: [ref.criterion(c.id)] })),
          { text: `The change is covered by an automated check that runs in the regression suite`, refs: [ref.outcome(o.id)] },
        ],
        basis: [ref.outcome(o.id), ...mandatory.map((c) => ref.criterion(c.id))],
      });
    }
    if (mandatory.length > 0) {
      drafts.push({
        type: 'task',
        summary: `Automate the acceptance checks for ${o.ref}`,
        narrative: `Automate the checks behind ${o.ref} ${quote(o.title)} so the result can be filed as ${lowerFirst(terms.evidenceKinds['test-result'])} evidence rather than a manual note.`,
        points: 3,
        outcome: o,
        criteria: [
          ...mandatory.map((c) => ({ text: `An automated check proves that ${lowerFirst(c.text.replace(/\.$/, ''))}`, refs: [ref.criterion(c.id)] })),
          { text: `Results are published to ${terms.systems['test-harness']} with a run id that links back to ${o.ref}`, refs: [ref.outcome(o.id)] },
        ],
        basis: [ref.outcome(o.id), ...mandatory.map((c) => ref.criterion(c.id))],
      });
    }
    if (capability) {
      drafts.push({
        type: 'story',
        summary: `Handle empty results and access limits when ${gerund(capability)}`,
        narrative: `As a ${persona}, I want a clear answer when there is nothing to show or I lack access, so that I never mistake a gap in the data for good news.`,
        points: 3,
        outcome: o,
        criteria: [
          { text: `When nothing matches, the ${persona} sees a plain message saying so and how to widen the selection`, refs: [ref.outcome(o.id)] },
          { text: `A ${persona} sees only the records they are entitled to see`, refs: [ref.outcome(o.id)] },
          { text: `Failures are logged with enough detail to reproduce them`, refs: [ref.outcome(o.id)] },
        ],
        basis: [ref.outcome(o.id)],
      });
    }
  }
  for (const r of raid.slice(0, 2)) drafts.push(spikeFor(kit, r, target.key, outcomes[0] ?? null));
  drafts.push({
    type: 'task',
    summary: `Prepare the release checklist and launch note for ${d.ref}`,
    narrative: `Prepare what the ${terms.coreRoles['tech-lead']} needs to confirm the release of ${d.ref} ${quote(d.title)} by ${date(d.plannedEnd)}.`,
    points: 2,
    outcome: outcomes[0] ?? null,
    criteria: [
      { text: `The ${lowerFirst(terms.evidenceKinds['release-checklist'])} is completed and filed as evidence before launch`, refs: [dRef] },
      { text: `The launch note names the change, the users affected and where to get help`, refs: [dRef] },
      { text: `Rollback steps are rehearsed in the user acceptance environment`, refs: [dRef] },
    ],
    basis: [dRef],
  });

  // Skip templates that existing items already cover.
  const fresh = drafts.filter((s) => !items.some((w) => coverage(s.summary, w.summary) >= 0.6 || coverage(w.summary, s.summary) >= 0.6)).slice(0, MAX_STORIES);
  const skipped = drafts.length - fresh.length;
  kit.step('compute', `Applied ${plural(drafts.length, 'story template')} to ${plural(outcomes.length, 'outcome')}`, `${plural(fresh.length, 'story', 'stories')} kept${skipped > 0 ? `, ${skipped} skipped as already covered or over the limit` : ''}.`, [ref.item(target.key)]);

  if (fresh.length === 0) {
    kit.step('note', 'Nothing to add', `${target.key} already covers every template.`, [ref.item(target.key)]);
    return kit.output(`${target.key} needs no new stories.`);
  }

  // --- Keys, items and criteria
  const prefix = target.key.replace(/-\d+$/, '');
  let next = Math.max(0, ...kit.data.workItems.filter((w) => w.key.startsWith(`${prefix}-`)).map((w) => Number(w.key.slice(prefix.length + 1))).filter(Number.isFinite)) + 1;
  const newItems: WorkItem[] = [];
  const newCriteria: AcceptanceCriterion[] = [];
  const at = kit.input.clock.now;
  for (const s of fresh) {
    const key = `${prefix}-${next++}`;
    newItems.push({
      key,
      type: s.type,
      summary: s.summary,
      status: 'To Do',
      statusCategory: 'to-do',
      deliverableId: null,
      epicKey: target.key,
      outcomeId: s.outcome?.id ?? null,
      parentKey: target.key,
      assigneeType: 'human',
      assigneeId: null,
      reviewerId: null,
      podId: epic?.podId ?? d.podId,
      hubId: epic?.hubId ?? d.hubIds[0] ?? null,
      sprintId: null,
      points: s.points,
      riskTier: null,
      created: at,
      updated: at,
      due: null,
      resolved: null,
      startDate: null,
      targetDate: null,
      ownerId: null,
      labels: ['scripted-draft'],
    });
    if (s.outcome) {
      s.criteria.forEach((c, i) =>
        newCriteria.push({
          id: `ac-${key}-${i + 1}`,
          outcomeId: (s.outcome as Outcome).id,
          text: `${key}: ${c.text}`,
          mandatory: false,
          state: 'open',
          acceptedById: null,
          acceptedAt: null,
          rejectedById: null,
          rejectionReason: null,
        }),
      );
    }
  }

  // --- Draft
  const basis: DraftSentence[] = [
    kit.sentence(
      `${target.key} ${quote(epic?.summary ?? target.key)} has ${plural(items.length, 'story-level item')} (${items.reduce((n, w) => n + (w.points ?? 0), 0)} points), ${items.filter(isClosed).length} closed, ${unmapped.length} without an ${terms.hierarchy.outcomeIdField} and ${unestimated.length} not estimated.`,
      [ref.item(target.key), ...items.map((w) => ref.item(w.key))],
    ),
    kit.sentence(`The stories below are drawn from ${d.ref} ${quote(d.title)}, ${plural(outcomes.length, 'outcome')} and ${plural(criteria.length, 'acceptance criterion', 'acceptance criteria')}.`, [dRef, ...outcomes.map((o) => ref.outcome(o.id))]),
    kit.sentence(`This is a scripted draft from fixed templates; a named person must review and approve it before anything is added, and the ${terms.coreRoles['product-manager']} decides the stage gate.`, [dRef]),
  ];
  kit.section('Basis', basis);
  fresh.forEach((s, i) => {
    const item = newItems[i]!;
    const sentences: DraftSentence[] = [kit.sentence(s.narrative, [ref.item(target.key), ...s.basis])];
    s.criteria.forEach((c) => sentences.push(kit.sentence(`Acceptance: ${c.text}.`, c.refs, dRef)));
    kit.section(`${item.key} ${terms.workItemTypes[s.type]}: ${s.summary} (${plural(s.points, 'point')})`, sentences);
  });
  kit.step('draft', `Drafted ${plural(newItems.length, 'story', 'stories')} with ${plural(newCriteria.length, 'acceptance criterion', 'acceptance criteria')}`, listPhrases(newItems.map((w) => w.key)), [ref.item(target.key)]);

  const points = newItems.reduce((n, w) => n + (w.points ?? 0), 0);
  const beforePoints = items.reduce((n, w) => n + (w.points ?? 0), 0);
  kit.propose({
    agentId: 'requirements-structuring',
    deliverableId: d.id,
    target: ref.item(target.key),
    title: `Add ${plural(newItems.length, 'drafted story', 'drafted stories')} under ${target.key}`,
    rationale: `${target.key} has only ${plural(items.length, 'story-level item')}; the drafted stories cover the outcome criteria, the open ${raid.length === 1 ? 'assumption' : 'assumptions'} and release preparation.`,
    evidence: [ref.item(target.key), ...outcomes.map((o) => ref.outcome(o.id)), ...raid.map((r) => ref.raid(r.id))],
    patch: { op: 'add-work-items', epicKey: target.key, items: newItems, criteria: newCriteria },
    beforeText: `${target.key}: ${plural(items.length, 'story-level item')}, ${beforePoints} points.`,
    afterText: `${target.key}: ${plural(items.length + newItems.length, 'story-level item')}, ${beforePoints + points} points; adds ${listPhrases(newItems.map((w) => w.key))} with ${plural(newCriteria.length, 'story acceptance criterion', 'story acceptance criteria')}.`,
    riskTier: epic?.riskTier ?? d.riskTier,
    assigneeId: null,
  });
  kit.step('propose', `Proposed adding ${plural(newItems.length, 'story', 'stories')} (${points} points) to ${target.key}`, 'Needs approval by a named person before anything is written.', [ref.item(target.key)]);

  return kit.output(`Drafted ${plural(newItems.length, 'story', 'stories')} for ${target.key} (scripted draft).`, {
    kind: 'requirements',
    deliverableId: d.id,
    title: `Scripted draft: proposed stories for ${target.key} ${epic?.summary ?? ''}`.trim(),
    agentId: 'requirements-structuring',
    sections: kit.sections,
    provenance: 'scripted-agent',
  });
}

function spikeFor(kit: AgentKit, r: RaidItem, epicKey: string, outcome: Outcome | null): DraftStory {
  const owner = r.ownerId && kit.ctx.idx.people.has(r.ownerId) ? kit.person(r.ownerId) : 'the owner';
  return {
    type: 'spike',
    summary: `Settle ${lowerFirst(terms.raidKinds[r.kind])} ${r.key} before build`,
    narrative: `Settle ${lowerFirst(terms.raidKinds[r.kind])} ${r.key} ${quote(r.title)} before build starts, so the design does not rest on an untested ${r.kind === 'risk' ? 'risk' : 'assumption'}.`,
    points: 2,
    outcome,
    criteria: [
      { text: `Findings are recorded on ${r.key} with a recommendation and the data behind it`, refs: [ref.raid(r.id)] },
      { text: `${owner} updates or closes ${r.key}${r.mitigationDue ? ` by ${date(r.mitigationDue)}` : ''}`, refs: [ref.raid(r.id), ...(r.ownerId ? [ref.person(r.ownerId)] : [])] },
      { text: `Any follow-on work is raised as stories under ${epicKey}`, refs: [ref.item(epicKey)] },
    ],
    basis: [ref.raid(r.id)],
  };
}

/** "Desk heads can filter limit breaches…" -> persona "desk head", capability "filter limit breaches…". */
export function personaOf(title: string): { persona: string; capability: string | null } {
  const m = /^(.+?)\s+(?:can|could)\s+(.+)$/i.exec(title.trim());
  if (!m) return { persona: 'user', capability: null };
  const words = (m[1] as string).toLowerCase().split(/\s+/);
  const last = words.pop() ?? 'user';
  words.push(/ies$/.test(last) ? `${last.slice(0, -3)}y` : /[^s]s$/.test(last) ? last.slice(0, -1) : last);
  return { persona: words.join(' '), capability: (m[2] as string).replace(/\.$/, '') };
}

function benefitOf(d: TechDeliverable, o: Outcome | undefined): string {
  const so = /\bso(?: that)?\s+(.+?)\.?$/i.exec(d.summary);
  if (so) return (so[1] as string).replace(/\.$/, '');
  if (o?.description) return lowerFirst(o.description.replace(/\.$/, ''));
  return lowerFirst(d.summary.replace(/\.$/, '')) || 'the outcome is met';
}

function capitalise(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
