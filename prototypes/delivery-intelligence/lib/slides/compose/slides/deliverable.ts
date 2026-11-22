/**
 * Technology deliverable slides, part 1: verdict, readiness evidence,
 * outcomes, findings and plan (docs/SLIDES_PLAN.md section 4).
 */
import { addDays, daysBetween } from '@/lib/config/clock';
import { workCompletionOf } from '@/lib/engine';
import { terms } from '@/lib/config/terminology';
import type { EntityRef, EvidenceHeldState } from '@/lib/types';
import {
  date,
  deliverableFacts,
  listPhrases,
  outcomeStatusTone,
  outcomeStatusWord,
  plural,
  reportedOnTrack,
  type DeliverableFacts,
} from '../../extract';
import type { Block, Cell, TimelineRow, Tone } from '../../types';
import { at, bullets, col, makeSlide, table, toned, type BuildInput, type SlideBuilder } from '../kit';
import { expandRefs, fitTimelineRows, measures, ragPairOf, refLabels, severityCell } from './shared';

export function factsOf(input: BuildInput): DeliverableFacts {
  if (input.scope.kind !== 'deliverable') throw new Error('This slide needs a deliverable scope.');
  return deliverableFacts(input.env, input.scope.deliverableId);
}

const dRef = (f: DeliverableFacts): EntityRef => ({ kind: 'deliverable', id: f.deliverable.id });

/** Tone of an engine reason from its code: critical findings and missed dates are Red, high findings and stale reports Amber. */
function reasonTone(code: string, fallback: Tone): Tone {
  if (code.startsWith('critical') || code.startsWith('missed')) return 'red';
  if (code.startsWith('high') || code.startsWith('stale')) return 'amber';
  return fallback;
}

export const tdVerdict: SlideBuilder = (input) => {
  const f = factsOf(input);
  // Three reasons fit under the measures; the rest go to the notes.
  const reasons = f.rag.reasons.slice(0, 3);
  const more = f.rag.reasons.slice(3);
  const v = f.views;
  return [
    makeSlide(input, {
      kind: 'td-verdict',
      title: f.verdict,
      layout: 'kpis-over-table',
      blocks: [at('top', ragPairOf(f.rag)), at('top', measures(v)), at('main', bullets(reasons.map((r) => ({ text: r.message, tone: reasonTone(r.code, f.rag.evidence) }))))],
      say:
        `${f.verdict}. ${v.work.label} is ${v.work.value}, ${v.accepted.value} outcomes are accepted and readiness is ${v.readiness.stateText.toLowerCase()}; ` +
        `each measure moves only with its own evidence.`,
      refs: [dRef(f), ...expandRefs(input.env, f.rag.reasons.flatMap((r) => r.refs))],
      provenance: ['computed', 'reported'],
      extraNotes: more.length > 0 ? [`Further reasons:\n${more.map((r) => `- ${r.message}`).join('\n')}`] : [],
    }),
  ];
};

const HELD_TONE: Record<EvidenceHeldState, Tone> = { passing: 'green', failing: 'red', missing: 'red', stale: 'amber', pending: 'unknown' };

export const tdReadiness: SlideBuilder = (input) => {
  const f = factsOf(input);
  const { env } = input;
  const r = f.measures.readiness;
  const count = (s: EvidenceHeldState) => r.held.filter((h) => h.state === s).length;
  const ref = f.deliverable.ref;
  const problems = [count('failing') && `${count('failing')} failing`, count('missing') && `${count('missing')} missing`, count('stale') && `${count('stale')} stale`].filter(Boolean) as string[];
  const title =
    r.state === 'ready'
      ? `${ref} is ready: all ${r.requiredEvidence.length} required evidence kinds pass`
      : r.state === 'not-ready'
        ? `${ref} not ready: ${problems.length > 0 ? `${problems.join(', ')} of ${r.requiredEvidence.length}` : 'a blocking dependency'}`
        : `${ref} readiness unknown: ${problems.length > 0 ? `${problems.join(', ')} of ${r.requiredEvidence.length}` : 'evidence pending'}`;
  const simulated = r.held.some((h) => h.evidenceId && env.idx.evidence.get(h.evidenceId)?.provenance === 'simulated');
  const rows: Cell[][] = r.held.map((h) => {
    const e = h.evidenceId ? env.idx.evidence.get(h.evidenceId) : undefined;
    return [
      terms.evidenceKinds[h.kind],
      toned(terms.evidenceHeld[h.state], HELD_TONE[h.state]),
      e ? e.sourceRef || e.title : '—',
      h.observedAt ? date(h.observedAt) : '—',
      e ? terms.systems[e.source] : '—',
      h.state === 'stale' && h.workChangedAt ? `Work changed ${date(h.workChangedAt)}` : e ? e.title : '',
    ];
  });
  for (const id of r.blockingDependencyIds) {
    const dep = env.idx.dependencies.get(id);
    if (!dep) continue;
    rows.push([terms.raidKinds.dependency, toned('Blocking', 'red'), dep.raidKey ?? dep.workItemKey ?? '—', '—', terms.systems['work-tracker'], `Needed by ${date(dep.needBy)}: ${dep.title}`]);
  }
  return [
    makeSlide(input, {
      kind: 'td-readiness',
      title,
      layout: 'kpis-over-table',
      blocks: [
        at('top', {
          type: 'kpis',
          items: [
            { label: terms.measures.readiness, value: terms.readiness[r.state], caption: terms.riskTiers[r.riskTier], tone: f.views.readiness.tone },
            { label: 'Required', value: String(r.requiredEvidence.length), caption: 'evidence kinds' },
            { label: terms.evidenceHeld.passing, value: String(count('passing')), tone: 'green' },
            { label: terms.evidenceHeld.failing, value: String(count('failing')), tone: count('failing') > 0 ? 'red' : 'neutral' },
            { label: terms.evidenceHeld.missing, value: String(count('missing')), tone: count('missing') > 0 ? 'red' : 'neutral' },
            { label: terms.evidenceHeld.stale, value: String(count('stale')), tone: count('stale') > 0 ? 'amber' : 'neutral' },
          ],
        }),
        at('main', table([col('Evidence', 3), col('State', 2), col('Latest record', 2, { maxChars: 18 }), col('Observed', 2), col('System', 2), col('Note', 5, { maxChars: 48 })], rows)),
      ],
      say: `${title}. Readiness is one of three states and never a percentage; it needs every kind ${terms.riskTiers[r.riskTier]} requires held and passing.`,
      refs: [dRef(f), ...r.held.flatMap((h) => (h.evidenceId ? [{ kind: 'evidence' as const, id: h.evidenceId }] : [])), ...r.blockingDependencyIds.map((id) => ({ kind: 'dependency' as const, id }))],
      provenance: simulated ? ['computed', 'simulated'] : ['computed'],
      extraNotes: r.reasons.length > 0 ? [`Why: ${r.reasons.map((x) => x.message).join(' ')}`] : [],
    }),
  ];
};

export const tdOutcomes: SlideBuilder = (input) => {
  const f = factsOf(input);
  const ref = f.deliverable.ref;
  const acc = f.measures.acceptedOutcomes;
  const onTrackNotAccepted = f.outcomes.filter((o) => !o.accepted && reportedOnTrack(o.outcome.reportedStatus)).length;
  const title = !acc.computable
    ? `${ref} accepted outcomes are not computable`
    : onTrackNotAccepted > 0
      ? `${acc.value.acceptedCount} of ${acc.value.totalCount} outcomes accepted; ${onTrackNotAccepted} on track without acceptance`
      : `${acc.value.acceptedCount} of ${acc.value.totalCount} ${ref} outcomes are accepted`;
  const rows: Cell[][] = f.outcomes.map((o) => [
    o.outcome.ref,
    o.outcome.title,
    String(o.outcome.weight),
    date(o.outcome.dueDate),
    toned(outcomeStatusWord(o.outcome.reportedStatus), outcomeStatusTone(o.outcome.reportedStatus)),
    toned(o.accepted ? terms.acceptance.accepted : terms.acceptance.notAccepted, o.accepted ? 'green' : 'red'),
    o.measures ? (o.measures.workCompletion.computable ? `${o.measures.workCompletion.value.percent}%` : terms.measures.notComputable) : terms.measures.notComputable,
    o.gaps.join('; ') || '—',
  ]);
  return [
    makeSlide(input, {
      kind: 'td-outcomes',
      title,
      layout: 'table',
      blocks: [
        at(
          'main',
          table(
            [col(terms.hierarchy.outcome, 2), col('Title', 5, { maxChars: 46 }), col('Weight', 1, { align: 'right' }), col('Due', 2), col(terms.ragKinds.reported, 2), col('Acceptance', 2), col(terms.measures.workCompletion, 2, { align: 'right' }), col('Gaps', 4, { maxChars: 40 })],
            rows,
            `${ref} has no outcomes recorded.`,
          ),
        ),
      ],
      say: `Reported status sits beside acceptance for each outcome. ${!acc.computable ? acc.detail : `Accepted outcomes is ${acc.value.acceptedCount} of ${acc.value.totalCount}, ${acc.value.percent}% of outcome weight; work completion does not accept an outcome.`}`,
      refs: [dRef(f), ...f.outcomes.map((o) => ({ kind: 'outcome' as const, id: o.outcome.id }))],
      provenance: ['computed', 'reported'],
    }),
  ];
};

export const tdFindings: SlideBuilder = (input) => {
  const f = factsOf(input);
  const { env } = input;
  const ref = f.deliverable.ref;
  const critical = f.findings.filter((x) => x.severity === 'critical').length;
  const high = f.findings.filter((x) => x.severity === 'high').length;
  const other = f.findings.length - critical - high;
  const parts = [critical && `${critical} critical`, high && `${high} high`, other && `${other} other`].filter(Boolean) as string[];
  const title = f.findings.length === 0 ? `No findings for ${ref}: nothing undermines its status` : `${ref}: ${listPhrases(parts)} finding${f.findings.length === 1 ? '' : 's'}`;
  const scripted = f.findings.some((x) => x.provenance === 'scripted-agent');
  return [
    makeSlide(input, {
      kind: 'td-findings',
      title,
      layout: 'table',
      blocks: [
        at(
          'main',
          table(
            [col('Severity', 2), col('Rule', 1), col('Finding', 10, { maxChars: 120 }), col('Records', 3, { maxChars: 40 })],
            f.findings.map((x) => [severityCell(x.severity), x.ruleId, x.message, refLabels(env, [x.subject, ...x.evidence]) || '—']),
            `The engine raised no findings for ${ref}.`,
          ),
        ),
      ],
      say: f.findings.length === 0 ? `${title}.` : `These findings drive the evidence-based status: critical findings make it ${terms.rag.red}, high findings ${terms.rag.amber}. Most severe first.`,
      refs: [dRef(f), ...f.findings.flatMap((x) => [x.subject, ...x.evidence])],
      provenance: scripted ? ['computed', 'scripted-agent'] : ['computed'],
    }),
  ];
};

export const tdPlan: SlideBuilder = (input) => {
  const f = factsOf(input);
  const { env } = input;
  const d = f.deliverable;
  const fc = f.forecast;
  const worstKnock = f.knockOnInto.slice().sort((a, b) => b.lateDays - a.lateDays)[0];
  const knockEnd = worstKnock && worstKnock.receiverEndWithDelay > d.plannedEnd ? worstKnock.receiverEndWithDelay : null;
  const forecastEnd = fc?.forecastEnd ?? d.plannedEnd;
  const projected = [forecastEnd, knockEnd].filter((x): x is string => !!x).reduce((a, b) => (b > a ? b : a), d.plannedEnd);
  const provider = worstKnock ? env.idx.deliverables.get(worstKnock.providerId)?.ref ?? 'a provider' : '';

  let title: string;
  if (fc?.method === 'complete') title = `${d.ref} work is complete; last item closed ${date(fc.forecastEnd)}`;
  else if (knockEnd) title = `${provider} input could move ${d.ref}’s end to ${date(knockEnd)}`;
  else if (fc && fc.slipDays > 0) title = `${d.ref} is forecast to finish ${date(fc.forecastEnd)}, ${plural(fc.slipDays, 'day')} late`;
  else if (fc?.atRisk) title = `${d.ref} is at risk of slipping beyond ${date(d.plannedEnd)}`;
  else title = `${d.ref} is forecast to finish on plan, ${date(forecastEnd)}`;

  const pushed = new Map<string, string>();
  for (const k of f.knockOnInto) for (const m of k.affectedMilestones) pushed.set(m.milestoneId, m.shiftedTo);
  const milestones = f.milestones.map((m) => {
    const late = m.status === 'missed' || (m.status === 'planned' && m.date < env.asOf);
    return { date: m.date, label: m.title, regulatory: m.regulatory, tone: (late ? 'red' : pushed.has(m.id) ? 'amber' : m.status === 'met' ? 'green' : 'neutral') as Tone };
  });
  for (const dep of f.dependencies.filter((x) => x.direction === 'inbound' && x.open)) {
    milestones.push({ date: dep.dependency.needBy, label: `Needs input from ${dep.other?.ref ?? 'another deliverable'}`, regulatory: false, tone: dep.troubled ? 'red' : 'neutral' });
  }
  const work = f.measures.workCompletion;
  const rows: TimelineRow[] = [
    {
      label: d.ref,
      plannedStart: d.plannedStart,
      plannedEnd: d.plannedEnd,
      ...(projected !== d.plannedEnd ? { projectedEnd: projected } : {}),
      ...(work.computable ? { completion: work.value.ratio } : {}),
      tone: f.rag.evidence,
      milestones: milestones.sort((a, b) => a.date.localeCompare(b.date)),
      ...(worstKnock && worstKnock.lateDays > 0 ? { note: `+${worstKnock.lateDays}d knock-on from ${provider}` } : {}),
    },
  ];
  const epicSpans = env.result.plan.spans.filter((s) => s.level === 'epic' && s.parentId === d.id);
  // The deliverable row plus up to five Epics fit under the headline figures.
  for (const s of epicSpans.slice(0, 5)) {
    const stories = (env.eng.childrenOf.get(s.entity.id) ?? []).filter((w) => w.epicKey === s.entity.id && w.type !== 'sub-task');
    const epicWork = workCompletionOf(stories, [s.entity.id]);
    rows.push({
      ...(epicWork.computable ? { completion: epicWork.value.ratio } : {}),
      label: s.label.length > 40 ? `${s.label.slice(0, 39).trimEnd()}…` : s.label,
      plannedStart: s.plannedStart,
      plannedEnd: s.plannedEnd,
      ...(s.forecastEnd !== s.plannedEnd ? { projectedEnd: s.forecastEnd } : {}),
    });
  }
  const allDates = rows.flatMap((r) => [r.plannedStart, r.plannedEnd, r.projectedEnd ?? r.plannedEnd, ...(r.milestones ?? []).map((m) => m.date)]);
  const start = addDays(allDates.reduce((a, b) => (b < a ? b : a), d.plannedStart), -7);
  const end = addDays(allDates.reduce((a, b) => (b > a ? b : a), d.plannedEnd), 14);
  const slip = daysBetween(d.plannedEnd, projected);
  const fitted = fitTimelineRows(rows, { start, end });
  const kpis: Block = {
    type: 'kpis',
    items: [
      { label: 'Planned end', value: date(d.plannedEnd) },
      { label: 'Forecast end', value: date(forecastEnd), caption: fc?.method === 'throughput' ? 'From recent throughput' : fc?.method === 'complete' ? 'Work complete' : 'Planned end shown', tone: fc && (fc.slipDays > 0 || fc.atRisk) ? 'amber' : 'neutral' },
      { label: 'With knock-on', value: knockEnd ? date(knockEnd) : 'None', caption: worstKnock ? `${plural(worstKnock.lateDays, 'day')} late input` : 'No late inputs', tone: knockEnd ? 'red' : 'neutral' },
      { label: 'Days beyond plan', value: String(Math.max(0, slip)), tone: slip > 0 ? 'red' : 'green' },
    ],
  };
  return [
    makeSlide(input, {
      kind: 'td-plan',
      title,
      layout: 'timeline',
      blocks: [at('top', kpis), at('main', { type: 'timeline', window: { start, end }, today: env.asOf, rows: fitted.rows })],
      say: `${title}. ${fc ? fc.explanation : ''}`.trim(),
      refs: [dRef(f), ...f.milestones.map((m) => ({ kind: 'milestone' as const, id: m.id })), ...f.knockOnInto.map((k) => ({ kind: 'dependency' as const, id: k.dependencyId })), ...epicSpans.map((s) => s.entity)],
      provenance: ['computed', 'reported'],
      extraNotes: [...fitted.notes, ...(f.knockOnInto.length > 0 ? [`Knock-on:\n${f.knockOnInto.map((k) => `- ${k.explanation}`).join('\n')}`] : [])],
    }),
  ];
};
