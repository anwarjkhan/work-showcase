/**
 * Technology deliverable slides, part 2: RAID and dependencies, lifecycle
 * position, pod, the Jira mapping and the weekly status draft.
 */
import { AGENT_CATALOGUE } from '@/lib/agents';
import { daysBetween } from '@/lib/config/clock';
import { stageDefinition } from '@/lib/config/pdlc';
import { routeById } from '@/lib/config/routes';
import { terms } from '@/lib/config/terminology';
import type { CoreRole, EntityRef, PdlcStageStatus, ReviewState, Severity } from '@/lib/types';
import { date, personName, plural, type CoreSeatLine } from '../../extract';
import type { Cell, StageView, Tone } from '../../types';
import { at, callout, col, makeSlide, table, text, TITLE_TARGET, toned, type SlideBuilder } from '../kit';
import { factsOf } from './deliverable';
import { draftDocument, ragCell, severityCell } from './shared';

const STAGE_STATUS: Record<PdlcStageStatus, string> = terms.pdlcStageStatus;
const reviewState = (s: ReviewState): string => terms.reviewStates[s].toLowerCase();
const DEP_TONE: Record<string, Tone> = { 'on-track': 'green', 'at-risk': 'amber', late: 'red', blocked: 'red', delivered: 'green' };
const SEV_RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export const tdRaid: SlideBuilder = (input) => {
  const f = factsOf(input);
  const { env } = input;
  const ref = f.deliverable.ref;
  const raid = f.raid
    .slice()
    .sort((a, b) => Number(a.status === 'closed') - Number(b.status === 'closed') || SEV_RANK[b.severity] - SEV_RANK[a.severity] || a.key.localeCompare(b.key, 'en', { numeric: true }));
  const open = raid.filter((r) => r.status !== 'closed').length;
  const troubled = f.dependencies.filter((d) => d.troubled).length;
  // Open and mitigating items only, so the half-width table keeps room for its columns; closed items are listed in notes.
  const raidRows: Cell[][] = raid
    .filter((r) => r.status !== 'closed')
    .map((r) => [
      r.key,
      terms.raidKinds[r.kind],
      r.status === 'mitigating' ? `${r.title} (${terms.raidStatus.mitigating.toLowerCase()})` : r.title,
      severityCell(r.severity),
      personName(env, r.ownerId),
      `${daysBetween(r.created, env.asOf)}d`,
    ]);
  const closed = raid.filter((r) => r.status === 'closed');
  const depRows: Cell[][] = f.dependencies.map((d) => [
    d.direction === 'inbound' ? `In from ${d.other?.ref ?? '?'}` : `Out to ${d.other?.ref ?? '?'}`,
    d.dependency.title,
    date(d.dependency.needBy),
    toned(terms.dependencyStatus[d.dependency.status], DEP_TONE[d.dependency.status] ?? 'neutral'),
    d.lateDays > 0 ? `${d.lateDays}d` : '—',
  ]);
  return [
    makeSlide(input, {
      kind: 'td-raid',
      title: `${ref}: ${plural(open, 'open RAID item')}, ${plural(troubled, 'late dependency', 'late dependencies')}`,
      layout: 'two-column',
      blocks: [
        at('left', table([col('Key', 2), col('Kind', 2), col('Title', 5, { maxChars: 60 }), col('Severity', 2), col('Owner', 3), col('Age', 1, { align: 'right' })], raidRows, `No open RAID items are recorded for ${ref}.`)),
        at('right', table([col('Direction', 3), col('Dependency', 5, { maxChars: 40 }), col('Need by', 2), col('Status', 2), col('Late', 1, { align: 'right' })], depRows, `${ref} has no dependencies recorded.`)),
      ],
      say: `${ref} has ${plural(open, 'open RAID item')} and ${plural(troubled, 'late or blocked dependency', 'late or blocked dependencies')}. Age counts days since each item was raised.`,
      refs: [{ kind: 'deliverable', id: f.deliverable.id }, ...raid.map((r) => ({ kind: 'raid' as const, id: r.id })), ...f.dependencies.map((d) => ({ kind: 'dependency' as const, id: d.dependency.id }))],
      provenance: ['computed', 'reported'],
      extraNotes: closed.length > 0 ? [`${terms.raidStatus.closed}:\n${closed.map((r) => `- ${r.key} ${r.title}`).join('\n')}`] : [],
    }),
  ];
};

export const tdPdlc: SlideBuilder = (input) => {
  const f = factsOf(input);
  const { env } = input;
  const ref = f.deliverable.ref;
  const wf = f.workflow;
  if (!wf) {
    return [
      makeSlide(input, {
        kind: 'td-pdlc',
        title: `${ref} has no lifecycle workflow recorded`,
        layout: 'statement',
        blocks: [at('main', callout('unknown', `${ref} is recorded at ${f.stageName} in ${terms.systems['portfolio-system']}, but no workflow run is held.`))],
        say: `No lifecycle workflow is held for ${ref}.`,
        refs: [{ kind: 'deliverable', id: f.deliverable.id }],
        provenance: ['reported'],
      }),
    ];
  }
  const currentIndex = wf.stages.findIndex((s) => s.current);
  const backInto = new Map<string, string>();
  for (const m of wf.run.moves) if (m.direction === 'back') backInto.set(m.to, stageDefinition(m.from).name);
  type Review = (typeof wf.stages)[number]['reviews'][number];
  const reviewText = (r: Review) => `${r.roleShort} ${reviewState(r.state)} (${r.personName ?? terms.coreTeam.missing.toLowerCase()})`;
  /** One stage's reviews: compact once all are approved ("Risk Lead and UX Lead confirmed; gate approved by …"). */
  const reviewsText = (reviews: Review[]): string => {
    if (reviews.length === 0) return '—';
    const gate = reviews.find((r) => r.gate);
    const specialists = reviews.filter((r) => !r.gate);
    if (reviews.every((r) => r.state === 'approved') && gate) {
      const confirmed = specialists.length > 0 ? `${specialists.map((r) => r.roleShort).join(' and ')} confirmed; ` : '';
      return `${confirmed}gate approved by ${gate.personName ?? terms.coreTeam.missing.toLowerCase()}`;
    }
    return reviews.map(reviewText).join('; ');
  };
  const stages: StageView[] = wf.stages.map((s, i) => {
    const state = s.current ? 'current' : i < currentIndex ? 'done' : 'not-started';
    const approvedBy = s.reviews.flatMap((r) => r.decisions.filter((d) => d.decision === 'approved').map((d) => personName(env, d.reviewerId)));
    const held = s.evidence.filter((e) => e.latest).length;
    const detail =
      state === 'done'
        ? `${approvedBy.length > 0 ? `Approved by ${[...new Set(approvedBy)].join(', ')}` : STAGE_STATUS[s.state.status]} · ${plural(held, 'record')}`
        : state === 'current'
          ? `Current · ${s.reviews.filter((r) => r.state !== 'approved').map(reviewText).join('; ') || 'reviews approved'}`
          : terms.pdlcStageStatus['not-started'];
    const view: StageView = { stageId: s.definition.id, name: s.definition.name, state, detail };
    const back = backInto.get(s.definition.id);
    return back ? { ...view, movedBackFrom: back } : view;
  });
  const current = wf.stages[currentIndex];
  const next = current?.reviews.find((r) => r.next);
  // The first wording that fits on one line wins: full stage name, short name, then without the review state.
  const role = next ? next.roleLabel : '';
  const candidates = current
    ? [current.definition.name, current.definition.shortName].flatMap((stage) => (next ? [`${ref} in ${stage}; ${role} ${reviewState(next.state)}`, `${ref} in ${stage}; ${role} review next`] : [`${ref} in ${stage}; all reviews approved`]))
    : [`${ref} lifecycle position`];
  if (current) candidates.push(`${ref} in ${current.definition.shortName}`);
  const title = candidates.find((t) => t.length <= TITLE_TARGET) ?? (candidates.at(-1) as string);
  const rows: Cell[][] = wf.stages.map((s) => [
    s.definition.name,
    STAGE_STATUS[s.state.status],
    reviewsText(s.reviews),
    s.evidence.map((e) => `${terms.evidenceKinds[e.kind]}: ${e.result === 'missing' ? 'missing' : terms.evidenceResults[e.result].toLowerCase()}`).join('; ') || '—',
  ]);
  const backMoves = wf.run.moves.filter((m) => m.direction === 'back');
  return [
    makeSlide(input, {
      kind: 'td-pdlc',
      title,
      layout: 'rail',
      blocks: [at('top', { type: 'stage-rail', stages }), at('main', table([col('Stage', 3), col('Status', 2), col('Reviews', 5, { maxChars: 70 }), col('Evidence left', 5, { maxChars: 70 })], rows))],
      say: `${title}. ${wf.forward.allowed ? 'It can move forward now.' : wf.forward.reason}`,
      refs: [{ kind: 'deliverable', id: f.deliverable.id }, ...wf.stages.flatMap((s) => s.evidence.flatMap((e) => (e.latest ? [{ kind: 'evidence' as const, id: e.latest.id }] : [])))],
      provenance: ['computed', 'reported'],
      extraNotes: backMoves.length > 0 ? [`Moves back:\n${backMoves.map((m) => `- ${date(m.at)}: ${stageDefinition(m.from).name} to ${stageDefinition(m.to).name}. ${m.reason ?? ''}`.trim()).join('\n')}`] : [],
    }),
  ];
};

export const tdPod: SlideBuilder = (input) => {
  const f = factsOf(input);
  const { env } = input;
  const ref = f.deliverable.ref;
  const dRef: EntityRef = { kind: 'deliverable', id: f.deliverable.id };
  if (!f.pod) {
    return [
      makeSlide(input, {
        kind: 'td-pod',
        title: `${ref} has no pod recorded`,
        layout: 'statement',
        blocks: [at('main', callout('unknown', `No pod is recorded for ${ref}.`))],
        say: `No pod is recorded for ${ref}.`,
        refs: [dRef],
        provenance: ['reported'],
      }),
    ];
  }
  const totalItems = f.workShare.human + f.workShare.agent;
  const agentShare = totalItems === 0 ? 'No work' : `${Math.round((f.workShare.agent / totalItems) * 100)}%`;
  const hub = (id: string | null) => (id ? env.idx.hubs.get(id)?.name ?? '—' : '—');
  const roleLabel = (r: CoreRole) => terms.coreRoles[r];
  const flagCell = (s: CoreSeatLine): Cell => {
    switch (s.flag) {
      case 'missing':
        return toned(terms.coreTeam.missing, 'red', true);
      case 'shared':
        return toned(`Also ${s.alsoHolds.map((r) => terms.coreRolesShort[r]).join(', ')}`, 'amber');
      case 'late':
        return toned(terms.coreTeam.joinedLate, 'amber');
      case 'in-place':
        return toned(terms.coreTeam.inPlace, 'green');
    }
  };
  const coreRows: Cell[][] = f.coreTeam.map((s) => [roleLabel(s.roleId), s.personId ? personName(env, s.personId) : '—', s.joinedAt ? date(s.joinedAt) : '—', flagCell(s)]);
  const missing = f.coreTeam.filter((s) => s.flag === 'missing').map((s) => roleLabel(s.roleId));
  const shared = f.coreTeam.filter((s) => s.flag === 'shared');
  const late = f.coreTeam.filter((s) => s.flag === 'late').map((s) => roleLabel(s.roleId));
  const gaps: string[] = [];
  if (missing.length > 0) gaps.push(`no ${listOf(missing)}`);
  if (shared.length > 0) gaps.push(`${personName(env, shared[0]!.personId)} holds two core roles`);
  if (late.length > 0) gaps.push(`the ${listOf(late)} joined after work started`);
  const coreName = terms.coreTeam.name;
  const candidates =
    gaps.length > 0
      ? [`${ref} ${coreName} gaps: ${gaps.join('; ')}`, `${ref} ${coreName} has ${plural(gaps.length, 'gap')}`]
      : [`${ref} ${coreName} in place; ${f.pod.name}: ${plural(f.members.length, 'person', 'people')}, ${plural(f.agents.length, 'agent')}`, `${ref} ${coreName} in place before work started`];
  const title = candidates.find((t) => t.length <= TITLE_TARGET) ?? (candidates.at(-1) as string);
  const coreSay =
    gaps.length > 0
      ? `The ${coreName} of ${ref} is not complete: ${gaps.join('; ')}.`
      : `${ref} has its full ${coreName}, four different people, all in place before work started.`;
  return [
    makeSlide(input, {
      kind: 'td-pod',
      title,
      layout: 'two-column',
      blocks: [
        at('left', table([col(coreName, 3), col('Name', 3), col('Joined', 2), col('Status', 3, { maxChars: 32 })], coreRows)),
        at('left', {
          type: 'kpis',
          items: [
            { label: 'People', value: String(f.members.length), caption: `Lead: ${personName(env, f.pod.leadId)}` },
            { label: 'Agent identities', value: String(f.agents.length) },
            { label: 'Agent share of items', value: agentShare, caption: `${f.workShare.agent} of ${totalItems} items assigned to agents` },
          ],
        }),
        at('right', table([col('Name', 3), col('Title', 3, { maxChars: 28 }), col('Hub', 2)], f.members.map((p) => [p.name, p.title, hub(p.hubId)]), 'No people are recorded in this pod.')),
        at(
          'right',
          table(
            [col('Identity', 3), col('Agent', 3), col('Accountable owner', 3)],
            f.agents.map((a) => [a.handle, AGENT_CATALOGUE[a.agentId]?.name ?? a.agentId, personName(env, a.accountableOwnerId)]),
            'No agent identities are attached to this pod.',
          ),
        ),
      ],
      say: `${coreSay} ${f.pod.name} in ${hub(f.pod.hubId)} delivers ${ref}. Agents carry ${f.workShare.agent} of ${totalItems} items; each agent identity has a named accountable owner.`,
      refs: [dRef, ...f.coreTeam.flatMap((s) => (s.personId ? [{ kind: 'person' as const, id: s.personId }] : []))],
      provenance: ['computed', 'reported'],
    }),
  ];
};

function listOf(parts: string[]): string {
  return parts.length <= 1 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

export const tdJiraMap: SlideBuilder = (input) => {
  const f = factsOf(input);
  const { env } = input;
  const d = f.deliverable;
  const pts = terms.systems['portfolio-system'];
  const jira = terms.systems['work-tracker'];
  const field = terms.hierarchy.deliverableIdField;
  const epicRows: Cell[][] = f.epics.map((e) => {
    const value = e.item?.deliverableId ?? null;
    const resolved = value ? env.eng.resolveDeliverable(value) : undefined;
    const fieldCell: Cell = !value ? toned('Missing', 'red') : !resolved ? toned('Does not resolve', 'red') : resolved.id === d.id ? toned(resolved.ref, 'green') : toned(`${resolved.ref} (mismatch)`, 'amber');
    return [e.key, e.item?.summary ?? '—', fieldCell, String(e.storyCount), `${e.mappedCount} of ${e.storyCount}`];
  });
  const mismatches = epicRows.filter((r) => typeof r[2] !== 'string' && r[2]?.tone !== 'green').length;
  const path = [f.request?.ref, ...f.nodes.map((n) => n.ref)].filter(Boolean).join(' › ') || terms.routes.standalone;
  const ptsRows: Cell[][] = [
    [field, d.ref],
    ['Title', d.title],
    ['Path', path],
    [terms.ragKinds.reported, ragCell(d.reportedRag)],
    ['Template', terms.templates[d.template]],
    [`${terms.hierarchy.outcome}s`, f.outcomes.map((o) => o.outcome.ref).join(', ') || 'None'],
  ];
  return [
    makeSlide(input, {
      kind: 'td-jira-map',
      title: `${d.ref} maps to ${plural(f.epics.length, 'Epic')} in ${jira}${mismatches > 0 ? `; ${mismatches} field problem${mismatches === 1 ? '' : 's'}` : ` by ${field}`}`,
      layout: 'two-column',
      blocks: [
        at('left', text(`Above the ${terms.bookOfRecordBoundary.toLowerCase()}: ${pts}`, 'caption')),
        at('left', table([col('Field', 2), col('Value', 5, { maxChars: 60 })], ptsRows)),
        at('right', text(`Below the boundary: ${jira}`, 'caption')),
        at(
          'right',
          table(
            [col(terms.hierarchy.epic, 2), col('Summary', 4, { maxChars: 32 }), col(field, 3), col('Items', 1, { align: 'right' }), col(terms.hierarchy.outcomeIdField, 2)],
            epicRows,
            `No Epics are linked to ${d.ref}.`,
          ),
        ),
      ],
      say: `${d.ref} is the ${pts} record; in ${jira} each Epic carries its ${field}, and story-level items carry an ${terms.hierarchy.outcomeIdField} linking work to outcomes.`,
      refs: [{ kind: 'deliverable', id: d.id }, ...f.epics.map((e) => ({ kind: 'work-item' as const, id: e.key })), ...f.outcomes.map((o) => ({ kind: 'outcome' as const, id: o.outcome.id }))],
      provenance: ['reported', 'computed'],
    }),
  ];
};

export const tdStatus: SlideBuilder = (input) => {
  const f = factsOf(input);
  const ref = f.deliverable.ref;
  const draft = f.statusDraft;
  const agentName = AGENT_CATALOGUE['status-reporting'].name;
  if (!draft) {
    const how = `In the app, open ${ref} in ${routeById('deliverable').title} or the ${routeById('agents').title}, run the ${agentName} agent, then build this slide again.`;
    return [
      makeSlide(input, {
        kind: 'td-status',
        title: `${ref} weekly status: no draft generated yet`,
        layout: 'statement',
        blocks: [at('main', callout('neutral', `No weekly status draft has been generated for ${ref} yet. ${how}`, 'No draft yet'))],
        say: `No scripted status draft exists for ${ref} yet, so no narrative is shown. ${how}`,
        refs: [{ kind: 'deliverable', id: f.deliverable.id }],
        provenance: ['computed'],
      }),
    ];
  }
  const doc = draftDocument(input.env, draft);
  return [
    makeSlide(input, {
      kind: 'td-status',
      title: `${ref} weekly status (scripted agent draft)`,
      layout: 'document',
      blocks: [at('main', doc.block)],
      say: `This is the ${agentName} agent’s scripted draft of ${date(draft.generatedAt)}, not a person’s report; every sentence cites the records it rests on.`,
      refs: [],
      citations: doc.citations,
      provenance: ['scripted-agent'],
      extraNotes: [doc.numbered],
    }),
  ];
};
