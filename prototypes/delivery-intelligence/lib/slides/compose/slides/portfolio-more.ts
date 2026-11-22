/**
 * Portfolio slides, part 2: findings per rule, this quarter's commitments,
 * where the work sits (regions) and the executive brief draft.
 */
import { AGENT_CATALOGUE } from '@/lib/agents';
import { routeById } from '@/lib/config/routes';
import { terms } from '@/lib/config/terminology';
import type { EvidenceRagStatus, Severity } from '@/lib/types';
import { date, plural } from '../../extract';
import type { Cell, TimelineRow, Tone } from '../../types';
import { at, callout, col, makeSlide, table, TIMELINE_ROWS_PER_SLIDE, toned, type SlideBuilder } from '../kit';
import { factsOf } from './portfolio';
import { draftDocument, severityCell } from './shared';

const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low'];
const SEV_TONE: Record<Severity, Tone> = { critical: 'red', high: 'amber', medium: 'neutral', low: 'neutral' };

export const portfolioFindings: SlideBuilder = (input) => {
  const f = factsOf(input);
  const s = f.summary;
  const total = SEVERITIES.reduce((n, sev) => n + s.findingsBySeverity[sev], 0);
  const top = f.rules[0];
  return [
    makeSlide(input, {
      kind: 'portfolio-findings',
      title: `${plural(total, 'data-quality finding')}: ${s.findingsBySeverity.critical} critical, ${s.findingsBySeverity.high} high`,
      layout: 'kpis-over-table',
      blocks: [
        at('top', { type: 'kpis', items: SEVERITIES.map((sev) => ({ label: terms.severity[sev], value: String(s.findingsBySeverity[sev]), tone: s.findingsBySeverity[sev] > 0 ? SEV_TONE[sev] : 'neutral' })) }),
        at(
          'main',
          table(
            [col('Rule', 1), col('What it checks', 8, { maxChars: 80 }), col('Severity', 2), col('Findings', 1, { align: 'right' }), col('Deliverables', 5, { maxChars: 48 })],
            f.rules.map((r) => [r.ruleId, r.description, severityCell(r.severity), String(r.count), r.deliverableRefs.join(', ') || '—']),
            'The engine raised no findings.',
          ),
        ),
      ],
      say: top ? `Findings per rule, most severe first. ${top.ruleId} leads: ${top.first.message}` : 'The engine raised no findings.',
      refs: f.rules.flatMap((r) => [r.first.subject, ...r.first.evidence]),
      provenance: ['computed'],
    }),
  ];
};

export const portfolioQuarter: SlideBuilder = (input) => {
  const f = factsOf(input);
  const { env } = input;
  const q = f.quarter;
  const slipping = new Set(q.slipping.map((l) => l.deliverable.id));
  const knockBy = new Map<string, (typeof env.knockOn)[number]>();
  for (const k of env.knockOn) {
    const prev = knockBy.get(k.receiverId);
    if (!prev || k.lateDays > prev.lateDays) knockBy.set(k.receiverId, k);
  }
  const regulatoryIds = new Set(q.regulatoryAtRisk.map((r) => r.milestone.id));
  // Most at-risk first so the 12 rows that fit show what matters.
  const score = (id: string) => (slipping.has(id) ? 4 : 0) + (knockBy.has(id) ? 2 : 0) + (env.result.deliverableRag[id]?.evidence === 'red' ? 1 : 0);
  const due = q.due.slice().sort((a, b) => score(b.deliverable.id) - score(a.deliverable.id) || a.deliverable.plannedEnd.localeCompare(b.deliverable.plannedEnd) || a.deliverable.ref.localeCompare(b.deliverable.ref, 'en', { numeric: true }));
  const shown = due.slice(0, TIMELINE_ROWS_PER_SLIDE);
  const rows: TimelineRow[] = shown.map((l) => {
    const d = l.deliverable;
    const k = knockBy.get(d.id);
    const ends = [l.forecast?.forecastEnd ?? d.plannedEnd, k && k.lateDays > 0 ? k.receiverEndWithDelay : d.plannedEnd];
    const projected = ends.reduce((a, b) => (b > a ? b : a), d.plannedEnd);
    const work = l.measures?.workCompletion;
    return {
      label: d.ref,
      plannedStart: d.plannedStart < q.start ? q.start : d.plannedStart,
      plannedEnd: d.plannedEnd,
      ...(projected !== d.plannedEnd ? { projectedEnd: projected } : {}),
      ...(work?.computable ? { completion: work.value.ratio } : {}),
      tone: (l.rag?.evidence ?? 'unknown') as EvidenceRagStatus,
      milestones: env.data.milestones
        .filter((m) => m.deliverableId === d.id && m.date >= q.start && m.date <= q.end)
        .map((m) => ({ date: m.date, label: m.title, regulatory: m.regulatory, tone: (regulatoryIds.has(m.id) ? 'red' : 'neutral') as Tone })),
      ...(k && k.lateDays > 0 ? { note: `+${k.lateDays}d knock-on from ${env.idx.deliverables.get(k.providerId)?.ref ?? 'a provider'}` } : {}),
    };
  });
  const end = rows.reduce((a, r) => (r.projectedEnd && r.projectedEnd > a ? r.projectedEnd : a), q.end);
  const knockLines = env.knockOn.map((k) => `- ${k.explanation}`);
  const hidden = due.slice(TIMELINE_ROWS_PER_SLIDE).map((l) => l.deliverable.ref);
  return [
    makeSlide(input, {
      kind: 'portfolio-quarter',
      title: `${q.label}: ${q.due.length} due, ${q.slipping.length} forecast to slip, ${plural(q.regulatoryAtRisk.length, 'regulatory risk')}`,
      layout: 'timeline',
      blocks: [
        at('top', {
          type: 'kpis',
          items: [
            { label: `Due in ${q.label}`, value: String(q.due.length) },
            { label: 'Forecast to slip', value: String(q.slipping.length), tone: q.slipping.length > 0 ? 'amber' : 'green' },
            { label: 'Regulatory milestones at risk', value: String(q.regulatoryAtRisk.length), tone: q.regulatoryAtRisk.length > 0 ? 'red' : 'green' },
            { label: 'Late or blocked inputs', value: String(env.knockOn.length), tone: env.knockOn.length > 0 ? 'red' : 'green' },
          ],
        }),
        at('main', { type: 'timeline', window: { start: q.start, end }, today: env.asOf, rows }),
      ],
      say: `Deliverables planned to finish in ${q.label} (${date(q.start)} to ${date(q.end)}), most at risk first, with forecast and knock-on ends where they differ from plan.`,
      refs: [
        ...shown.map((l) => ({ kind: 'deliverable' as const, id: l.deliverable.id })),
        ...q.regulatoryAtRisk.map((r) => ({ kind: 'milestone' as const, id: r.milestone.id })),
        ...env.knockOn.map((k) => ({ kind: 'dependency' as const, id: k.dependencyId })),
      ],
      provenance: ['computed', 'reported'],
      extraNotes: [
        ...(q.regulatoryAtRisk.length > 0 ? [`Regulatory milestones at risk:\n${q.regulatoryAtRisk.map((r) => `- ${r.deliverable?.ref ?? ''} ${r.milestone.title}, ${date(r.milestone.date)}: ${r.why}`).join('\n')}`] : []),
        ...(knockLines.length > 0 ? [`Knock-on:\n${knockLines.join('\n')}`] : []),
        ...(hidden.length > 0 ? [`Also due this quarter, not shown: ${hidden.join(', ')}`] : []),
      ],
    }),
  ];
};

export const portfolioHubs: SlideBuilder = (input) => {
  const f = factsOf(input);
  const { env } = input;
  const regions = f.regions;
  const busiest = regions.length > 0 ? regions.reduce((a, b) => (b.workItems > a.workItems ? b : a)) : null;
  const order: EvidenceRagStatus[] = ['red', 'amber', 'green', 'unknown'];
  const rows: Cell[][] = regions.map((r) => [
    r.label,
    String(r.hubNames.length),
    String(r.workItems),
    r.workItems === 0 ? '—' : `${Math.round((r.agentItems / r.workItems) * 100)}%`,
    r.lateCrossHubInbound > 0 ? toned(String(r.lateCrossHubInbound), 'red') : '0',
  ]);
  const hubName = (id: string) => env.idx.hubs.get(id)?.name ?? '?';
  return [
    makeSlide(input, {
      kind: 'portfolio-hubs',
      title: busiest ? `Most work sits in ${busiest.label}; ${plural(f.lateCrossHub.length, 'cross-hub dependency', 'cross-hub dependencies')} late` : 'Where the work sits',
      layout: 'chart-and-table',
      blocks: [
        at('left', {
          type: 'stacked-bar',
          categories: regions.map((r) => r.label),
          series: order.map((s) => ({ name: terms.rag[s], values: regions.map((r) => r.deliverableRag[s]), tone: s })),
          unit: 'deliverables by lead hub, on evidence',
          horizontal: true,
        }),
        at('right', table([col('Region', 3), col('Hubs', 1, { align: 'right' }), col('Work items', 2, { align: 'right' }), col('Agent share', 2, { align: 'right' }), col('Late cross-hub in', 2, { align: 'right' })], rows)),
      ],
      say: 'Health by region counts deliverables by their lead hub on evidence; work items count where each item is worked.',
      refs: f.lateCrossHub.map((x) => ({ kind: 'dependency' as const, id: x.dependency.id })),
      provenance: ['computed'],
      extraNotes:
        f.lateCrossHub.length > 0
          ? [`Late cross-hub dependencies:\n${f.lateCrossHub.map((x) => `- ${x.dependency.title}: ${hubName(x.dependency.fromHubId)} to ${hubName(x.dependency.toHubId)}, ${x.dependency.status === 'blocked' ? terms.dependencyStatus.blocked.toLowerCase() : `${x.lateDays} days late`}`).join('\n')}`]
          : [],
    }),
  ];
};

export const portfolioBrief: SlideBuilder = (input) => {
  const brief = input.env.extras.executiveBrief;
  const agentName = AGENT_CATALOGUE['executive-briefing'].name;
  if (!brief) {
    const how = `In the app, open the ${routeById('agents').title}, run the ${agentName} agent for the portfolio, then build this slide again.`;
    return [
      makeSlide(input, {
        kind: 'portfolio-brief',
        title: 'Executive brief: no draft generated yet',
        layout: 'statement',
        blocks: [at('main', callout('neutral', `No executive brief has been generated yet. ${how}`, 'No draft yet'))],
        say: `No scripted executive brief exists yet, so no narrative is shown. ${how}`,
        refs: [],
        provenance: ['computed'],
      }),
    ];
  }
  const doc = draftDocument(input.env, brief);
  return [
    makeSlide(input, {
      kind: 'portfolio-brief',
      title: 'Executive brief (scripted agent draft)',
      layout: 'document',
      blocks: [at('main', doc.block)],
      say: `This is the ${agentName} agent’s scripted draft of ${date(brief.generatedAt)}, not a person’s brief; every sentence cites the records it rests on.`,
      refs: [],
      citations: doc.citations,
      provenance: ['scripted-agent'],
      extraNotes: [doc.numbered],
    }),
  ];
};
