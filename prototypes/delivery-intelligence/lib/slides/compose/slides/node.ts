/**
 * Programme, project and initiative slides: overview, deliverables, plan and
 * milestones, risks and dependencies, and disagreements. Roll-ups come from
 * `computeHierarchyRollups`.
 */
import { addDays, daysBetween } from '@/lib/config/clock';
import { terms } from '@/lib/config/terminology';
import type { EntityRef, Severity } from '@/lib/types';
import { date, nodeFacts, plural, ragMix, verdictSentence, type NodeDeliverableLine, type NodeFacts } from '../../extract';
import type { Cell, TimelineRow, Tone } from '../../types';
import { at, bullets, callout, col, makeSlide, table, toned, type BuildInput, type SlideBuilder, TIMELINE_ROWS_PER_SLIDE } from '../kit';
import { measures, ragCell, ragPairOf, readinessCell, severityCell } from './shared';

function factsOf(input: BuildInput): NodeFacts {
  if (input.scope.kind !== 'pm-node') throw new Error('This slide needs a programme, project or initiative scope.');
  return nodeFacts(input.env, input.scope.pmNodeId);
}

const nRef = (f: NodeFacts): EntityRef => ({ kind: 'pm-node', id: f.node.id });
const dRefs = (lines: NodeDeliverableLine[]): EntityRef[] => lines.map((l) => ({ kind: 'deliverable', id: l.deliverable.id }));
const SEV_RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export const nodeOverview: SlideBuilder = (input) => {
  const f = factsOf(input);
  const level = terms.pmNodeLevels[f.node.level];
  const route = f.request ? terms.routes[f.request.route] : terms.routes.formal;
  const verdict = verdictSentence(f.node.ref, f.rollup.rag);
  const children = f.children;
  const main =
    children.length > 0
      ? table(
          [col(terms.pmNodeLevels[children[0]?.node.level ?? 'project'], 5, { maxChars: 40 }), col(terms.ragKinds.reported, 2), col(terms.ragKinds.evidence, 2), col('Deliverables', 1, { align: 'right' }), col(terms.measures.workCompletion, 2, { align: 'right' }), col(terms.measures.acceptedOutcomes, 2), col(terms.measures.readiness, 2)],
          children.map((c) => [
            `${c.node.ref} ${c.node.title}`,
            ragCell(c.node.reportedRag),
            ragCell(c.rollup?.rag.evidence ?? 'unknown'),
            String(c.rollup?.deliverableIds.length ?? 0),
            c.views.work.value,
            c.views.accepted.value,
            toned(c.views.readiness.stateText, c.views.readiness.tone),
          ]),
        )
      : table(
          [col('Field', 2), col('Value', 6, { maxChars: 80 })],
          [
            ['Path', [f.request?.ref, ...f.chain.map((n) => n.title)].filter(Boolean).join(' › ')],
            ['Owner', input.env.idx.people.get(f.node.ownerId)?.name ?? '—'],
            ['Route', route],
            ['Deliverables', String(f.deliverables.length)],
            [`${terms.hierarchy.outcome}s`, String(f.outcomeCount)],
            [`${terms.hierarchy.epic}s`, String(f.epicCount)],
            ['Planned', `${date(f.node.plannedStart)} to ${date(f.node.plannedEnd)}`],
          ],
        );
  const childText = children.length > 0 ? `${plural(children.length, terms.pmNodeLevels[children[0]?.node.level ?? 'project'].toLowerCase())}, ` : '';
  return [
    makeSlide(input, {
      kind: 'node-overview',
      title: verdict,
      layout: 'kpis-over-table',
      blocks: [at('top', ragPairOf(f.rollup.rag)), at('top', measures(f.views)), at('main', main)],
      say: `${level} ${f.node.ref} ${f.node.title}, on the ${route.toLowerCase()}: ${childText}${plural(f.deliverables.length, 'deliverable')} and ${plural(f.outcomeCount, 'outcome')}. ${verdict}; its evidence status is the worst of its deliverables.`,
      refs: [nRef(f), ...(f.request ? [{ kind: 'investment-request' as const, id: f.request.id }] : []), ...children.map((c) => ({ kind: 'pm-node' as const, id: c.node.id })), ...f.rollup.rag.reasons.flatMap((r) => r.refs)],
      provenance: ['computed', 'reported'],
    }),
  ];
};

export const nodeDeliverables: SlideBuilder = (input) => {
  const f = factsOf(input);
  const rows: Cell[][] = f.deliverables.map((l) => [
    `${l.deliverable.ref} ${l.deliverable.title}`,
    ragCell(l.deliverable.reportedRag),
    ragCell(l.rag?.evidence ?? 'unknown'),
    l.views.work.value,
    l.views.accepted.value,
    readinessCell(l.views.readiness),
    l.stageName,
    l.forecast ? date(l.forecast.forecastEnd) : date(l.deliverable.plannedEnd),
  ]);
  return [
    makeSlide(input, {
      kind: 'node-deliverables',
      title: `${plural(f.deliverables.length, 'deliverable')} under ${f.node.ref}: ${ragMix(f.rollup.evidenceRag)} on evidence`,
      layout: 'table',
      blocks: [
        at(
          'main',
          table(
            [col(terms.hierarchy.deliverableShort, 6, { maxChars: 44 }), col(terms.ragKinds.reported, 2), col(terms.ragKinds.evidence, 2), col('Work', 2, { align: 'right' }), col('Accepted', 2), col(terms.measures.readiness, 2), col('Stage', 3, { maxChars: 24 }), col('Forecast end', 2)],
            rows,
            `No deliverables sit under ${f.node.ref}.`,
          ),
        ),
      ],
      say: `Each deliverable under ${f.node.ref} with its reported and evidence-based status and the three measures, kept separate. Forecast ends come from recent throughput where there is enough history.`,
      refs: [nRef(f), ...dRefs(f.deliverables)],
      provenance: ['computed', 'reported'],
    }),
  ];
};

export const nodePlan: SlideBuilder = (input) => {
  const f = factsOf(input);
  const { env } = input;
  const knockByReceiver = new Map<string, (typeof f.knockOn)[number]>();
  for (const k of f.knockOn) {
    const prev = knockByReceiver.get(k.receiverId);
    if (!prev || k.lateDays > prev.lateDays) knockByReceiver.set(k.receiverId, k);
  }
  const pushed = new Set(f.knockOn.flatMap((k) => k.affectedMilestones.map((m) => m.milestoneId)));
  const rows: TimelineRow[] = f.deliverables
    .slice()
    .sort((a, b) => a.deliverable.plannedStart.localeCompare(b.deliverable.plannedStart) || a.deliverable.ref.localeCompare(b.deliverable.ref, 'en', { numeric: true }))
    .map((l) => {
      const d = l.deliverable;
      const k = knockByReceiver.get(d.id);
      const ends = [l.forecast?.forecastEnd ?? d.plannedEnd, k && k.lateDays > 0 ? k.receiverEndWithDelay : d.plannedEnd];
      const projected = ends.reduce((a, b) => (b > a ? b : a), d.plannedEnd);
      const work = l.measures?.workCompletion;
      const provider = k ? env.idx.deliverables.get(k.providerId)?.ref ?? 'a provider' : '';
      return {
        label: d.ref,
        plannedStart: d.plannedStart,
        plannedEnd: d.plannedEnd,
        ...(projected !== d.plannedEnd ? { projectedEnd: projected } : {}),
        ...(work?.computable ? { completion: work.value.ratio } : {}),
        tone: l.rag?.evidence ?? 'unknown',
        milestones: f.milestones
          .filter((m) => m.deliverableId === d.id)
          .map((m) => {
            const late = m.status === 'missed' || (m.status === 'planned' && m.date < env.asOf);
            return { date: m.date, label: m.title, regulatory: m.regulatory, tone: (late ? 'red' : pushed.has(m.id) ? 'amber' : m.status === 'met' ? 'green' : 'neutral') as Tone };
          }),
        ...(k && k.lateDays > 0 ? { note: `+${k.lateDays}d knock-on from ${provider}` } : {}),
      };
    });
  const dates = rows.flatMap((r) => [r.plannedStart, r.plannedEnd, r.projectedEnd ?? r.plannedEnd, ...(r.milestones ?? []).map((m) => m.date)]);
  const start = addDays(dates.reduce((a, b) => (b < a ? b : a), f.node.plannedStart), -14);
  const end = addDays(dates.reduce((a, b) => (b > a ? b : a), f.node.plannedEnd), 14);
  const regulatory = f.milestones.filter((m) => m.regulatory && m.status !== 'met');
  const atRisk = regulatory.filter((m) => m.status === 'missed' || m.date < env.asOf || pushed.has(m.id));
  const slipping = f.deliverables.filter((l) => l.forecast && (l.forecast.slipDays > 0 || l.forecast.atRisk) && l.forecast.method !== 'complete');
  const title =
    atRisk.length > 0
      ? `${f.node.ref}: ${plural(atRisk.length, 'regulatory milestone')} at risk, ${slipping.length} forecast to slip`
      : `${f.node.ref}: ${plural(slipping.length, 'deliverable')} forecast to slip, ${plural(f.knockOn.length, 'knock-on')}`;
  return [
    makeSlide(input, {
      kind: 'node-plan',
      title,
      layout: 'timeline',
      blocks: [
        at('top', {
          type: 'kpis',
          items: [
            { label: 'Milestones', value: String(f.milestones.length) },
            { label: 'Regulatory open', value: String(regulatory.length) },
            { label: 'Regulatory at risk', value: String(atRisk.length), tone: atRisk.length > 0 ? 'red' : 'green' },
            { label: 'Forecast to slip', value: String(slipping.length), tone: slipping.length > 0 ? 'amber' : 'green' },
            { label: 'Late inputs', value: String(f.knockOn.length), tone: f.knockOn.length > 0 ? 'red' : 'green' },
          ],
        }),
        at('main', { type: 'timeline', window: { start, end }, today: env.asOf, rows }),
      ],
      say: `Planned bars for each deliverable under ${f.node.ref}, with forecast or knock-on ends where they differ and milestones marked; regulatory milestones are flagged.${rows.length > TIMELINE_ROWS_PER_SLIDE ? ' The timeline continues on the next slide.' : ''}`,
      refs: [nRef(f), ...dRefs(f.deliverables), ...f.milestones.map((m) => ({ kind: 'milestone' as const, id: m.id })), ...f.knockOn.map((k) => ({ kind: 'dependency' as const, id: k.dependencyId }))],
      provenance: ['computed', 'reported'],
      extraNotes: f.knockOn.length > 0 ? [`Knock-on:\n${f.knockOn.map((k) => `- ${k.explanation}`).join('\n')}`] : [],
    }),
  ];
};

export const nodeRisks: SlideBuilder = (input) => {
  const f = factsOf(input);
  const { env } = input;
  const ref = (id: string) => env.idx.deliverables.get(id)?.ref ?? '?';
  const openRaid = f.raid.filter((r) => r.status !== 'closed').sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity] || a.key.localeCompare(b.key, 'en', { numeric: true }));
  const rows: Cell[][] = [
    ...openRaid.map((r) => [r.key, terms.raidKinds[r.kind], ref(r.deliverableId), r.title, severityCell(r.severity), `${daysBetween(r.created, env.asOf)}d`]),
    ...f.troubledDependencies.map((d) => [
      d.dependency.raidKey ?? d.dependency.workItemKey ?? '—',
      terms.raidKinds.dependency,
      `${ref(d.dependency.fromDeliverableId)} to ${ref(d.dependency.toDeliverableId)}`,
      d.dependency.title,
      toned(d.dependency.status === 'blocked' ? terms.dependencyStatus.blocked : `${d.lateDays}d late`, 'red'),
      '—',
    ]),
  ];
  const top = f.findings.slice(0, 5);
  return [
    makeSlide(input, {
      kind: 'node-risks',
      title: `${f.node.ref}: ${plural(openRaid.length, 'open RAID item')}, ${plural(f.troubledDependencies.length, 'late dependency', 'late dependencies')}`,
      layout: 'two-column',
      blocks: [
        at('left', table([col('Key', 2), col('Kind', 2), col(terms.hierarchy.deliverableShort, 3, { maxChars: 20 }), col('Title', 5, { maxChars: 40 }), col('Severity', 2), col('Age', 1, { align: 'right' })], rows, `No open RAID items or late dependencies under ${f.node.ref}.`)),
        at('right', bullets(top.length > 0 ? top.map((x) => ({ text: `${terms.severity[x.severity]}: ${x.message}`, tone: x.severity === 'critical' ? ('red' as const) : x.severity === 'high' ? ('amber' as const) : ('neutral' as const) })) : [`No findings under ${f.node.ref}.`])),
      ],
      say: `Open RAID items and late or blocked dependencies across the deliverables under ${f.node.ref}, most severe first, with the top findings beside them.`,
      refs: [nRef(f), ...openRaid.map((r) => ({ kind: 'raid' as const, id: r.id })), ...f.troubledDependencies.map((d) => ({ kind: 'dependency' as const, id: d.dependency.id })), ...top.flatMap((x) => [x.subject, ...x.evidence])],
      provenance: ['computed', 'reported'],
    }),
  ];
};

export const nodeDisagreements: SlideBuilder = (input) => {
  const f = factsOf(input);
  const n = f.disagreeing.length;
  const title = n === 0 ? `Every deliverable under ${f.node.ref} is reported as its evidence says` : `${n} of ${f.deliverables.length} deliverables under ${f.node.ref} disagree with evidence`;
  const block =
    n === 0
      ? callout('green', `${terms.ragKinds.reported} and ${terms.ragKinds.evidence.toLowerCase()} status agree for all ${plural(f.deliverables.length, 'deliverable')}, or evidence is too thin to judge.`)
      : table(
          [col(terms.hierarchy.deliverableShort, 5, { maxChars: 40 }), col(terms.pmNodeLevels.project, 3, { maxChars: 28 }), col(terms.ragKinds.reported, 2), col(terms.ragKinds.evidence, 2), col('Top reason', 8, { maxChars: 100 })],
          f.disagreeing.map((l) => [`${l.deliverable.ref} ${l.deliverable.title}`, l.parent?.title ?? terms.routes.standalone, ragCell(l.deliverable.reportedRag), ragCell(l.rag?.evidence ?? 'unknown'), l.rag?.reasons[0]?.message ?? '—']),
        );
  return [
    makeSlide(input, {
      kind: 'node-disagreements',
      title,
      layout: n === 0 ? 'statement' : 'table',
      blocks: [at('main', block)],
      say: n === 0 ? `${title}.` : `${title}, worst gap first. Each reported status stays as recorded; the evidence-based status sits beside it with its top reason.`,
      refs: [nRef(f), ...dRefs(f.disagreeing)],
      provenance: ['computed', 'reported'],
    }),
  ];
};
