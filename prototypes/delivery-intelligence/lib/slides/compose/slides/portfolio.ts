/**
 * Portfolio slides, part 1: headline, reported against evidence,
 * disagreements, programme health and the lifecycle (stages).
 */
import { PDLC_STAGES } from '@/lib/config/pdlc';
import { terms } from '@/lib/config/terminology';
import type { EvidenceRagStatus } from '@/lib/types';
import { nodeChain, plural, portfolioFacts, ragMix, type PortfolioFacts } from '../../extract';
import type { Cell } from '../../types';
import { at, col, makeSlide, table, text, type BuildInput, type SlideBuilder } from '../kit';
import { measures, ragCell, readinessCell } from './shared';

export function factsOf(input: BuildInput): PortfolioFacts {
  if (input.scope.kind !== 'portfolio') throw new Error('This slide needs the portfolio scope.');
  return portfolioFacts(input.env);
}

/** Title of the programme above a node (or the top node), or the standalone route. */
function programmeTitle(input: BuildInput, pmNodeId: string | null): string {
  const chain = nodeChain(input.env, pmNodeId);
  if (chain.length === 0) return terms.routes.standalone;
  return (chain.find((n) => n.level === 'programme') ?? chain[chain.length - 1])?.title ?? '—';
}

const RAG_ORDER: EvidenceRagStatus[] = ['red', 'amber', 'green', 'unknown'];

export const portfolioHeadline: SlideBuilder = (input) => {
  const f = factsOf(input);
  const s = f.summary;
  const n = f.disagreeing.length;
  const total = s.counts.deliverables;
  const worst = f.disagreeing[0];
  const sentence =
    n === 0
      ? `Every deliverable is reported as its evidence says, or evidence is too thin to judge.`
      : `${n} of ${total} deliverables are reported differently from what their evidence says.${worst ? ` The widest gap: ${worst.deliverable.ref} is reported ${terms.rag[worst.deliverable.reportedRag]} and is ${terms.rag[worst.rag?.evidence ?? 'unknown']} on evidence.` : ''}`;
  return [
    makeSlide(input, {
      kind: 'portfolio-headline',
      title: n === 0 ? 'Reported status matches evidence across the portfolio' : `${n} of ${total} deliverables are reported differently from their evidence`,
      layout: 'two-column',
      blocks: [
        at('left', text(sentence, 'statement')),
        at('left', {
          type: 'kpis',
          items: [
            { label: 'Disagreements', value: `${n} of ${total}`, tone: n > 0 ? 'red' : 'green' },
            { label: `${terms.ragKinds.reported} ${terms.rag.green}`, value: String(s.reportedRag.green), tone: 'green' },
            { label: `${terms.ragKinds.evidence} ${terms.rag.red}`, value: String(s.evidenceRag.red), tone: 'red' },
          ],
        }),
        at('right', measures(f.views)),
      ],
      say: `${sentence} Beside it, the three portfolio measures: ${f.views.work.value} of work closed, ${f.views.accepted.value} outcomes accepted, and ${f.views.readiness.stateText} on readiness.`,
      refs: f.disagreeing.map((l) => ({ kind: 'deliverable' as const, id: l.deliverable.id })),
      provenance: ['computed', 'reported'],
    }),
  ];
};

export const portfolioRag: SlideBuilder = (input) => {
  const f = factsOf(input);
  const s = f.summary;
  const reported = (r: EvidenceRagStatus) => (r === 'unknown' ? 0 : s.reportedRag[r]);
  return [
    makeSlide(input, {
      kind: 'portfolio-rag',
      title: `${terms.ragKinds.reported}: ${s.reportedRag.green} ${terms.rag.green}. ${terms.ragKinds.evidence}: ${s.evidenceRag.green} ${terms.rag.green}`,
      layout: 'chart-and-table',
      blocks: [
        at('left', {
          type: 'stacked-bar',
          categories: [terms.ragKinds.reported, terms.ragKinds.evidence],
          series: RAG_ORDER.map((r) => ({ name: terms.rag[r], values: [reported(r), s.evidenceRag[r]], tone: r })),
          unit: 'deliverables',
          horizontal: true,
        }),
        at(
          'right',
          table(
            [col('Status', 3), col(terms.ragKinds.reported, 2, { align: 'right' }), col(terms.ragKinds.evidence, 2, { align: 'right' })],
            RAG_ORDER.map((r): Cell[] => [ragCell(r), r === 'unknown' ? '—' : String(s.reportedRag[r]), String(s.evidenceRag[r])]),
          ),
        ),
      ],
      say: `The same ${s.counts.deliverables} deliverables counted twice: as reported in ${terms.systems['portfolio-system']}, and as their evidence says. ${terms.rag.unknown} means too little evidence to judge.`,
      refs: [],
      provenance: ['computed', 'reported'],
    }),
  ];
};

export const portfolioDisagreements: SlideBuilder = (input) => {
  const f = factsOf(input);
  const rows: Cell[][] = f.disagreeing.map((l) => [
    `${l.deliverable.ref} ${l.deliverable.title}`,
    programmeTitle(input, l.deliverable.pmNodeId),
    ragCell(l.deliverable.reportedRag),
    ragCell(l.rag?.evidence ?? 'unknown'),
    l.rag?.reasons[0]?.message ?? '—',
    l.views.work.value,
    l.views.accepted.value,
    readinessCell(l.views.readiness),
  ]);
  return [
    makeSlide(input, {
      kind: 'portfolio-disagreements',
      title: f.disagreeing.length === 0 ? 'No deliverable is reported differently from its evidence' : `Where reported status and evidence disagree: ${plural(f.disagreeing.length, 'deliverable')}`,
      layout: 'table',
      blocks: [
        at(
          'main',
          table(
            [col(terms.hierarchy.deliverableShort, 5, { maxChars: 36 }), col(terms.hierarchy.programme, 3, { maxChars: 26 }), col(terms.ragKinds.reported, 2), col(terms.ragKinds.evidence, 2), col('Top reason', 7, { maxChars: 90 }), col('Work', 1, { align: 'right' }), col('Accepted', 2), col(terms.measures.readiness, 2)],
            rows,
            'Reported and evidence-based status agree for every deliverable.',
          ),
        ),
      ],
      say: 'Worst gap first: reported Green with Red evidence leads. The top reason is the first engine reason behind each evidence-based status.',
      refs: f.disagreeing.map((l) => ({ kind: 'deliverable' as const, id: l.deliverable.id })),
      provenance: ['computed', 'reported'],
    }),
  ];
};

export const portfolioProgrammes: SlideBuilder = (input) => {
  const f = factsOf(input);
  const disagreeing = f.programmes.filter((p) => p.evidence !== 'unknown' && p.evidence !== p.reported).length;
  const rows: Cell[][] = f.programmes.map((p) => [
    `${p.node.ref} ${p.node.title}`,
    ragCell(p.reported),
    ragCell(p.evidence),
    ragMix(p.deliverableRag),
    p.views.work.value,
    p.views.accepted.value,
    readinessCell(p.views.readiness),
  ]);
  return [
    makeSlide(input, {
      kind: 'portfolio-programmes',
      title: `${disagreeing} of ${plural(f.programmes.length, 'programme')} reported differently from their evidence`,
      layout: 'table',
      blocks: [
        at(
          'main',
          table(
            [col(terms.hierarchy.programme, 6, { maxChars: 46 }), col(terms.ragKinds.reported, 2), col(terms.ragKinds.evidence, 2), col('Deliverables on evidence', 4, { maxChars: 40 }), col('Work', 2, { align: 'right' }), col('Accepted', 2), col(terms.measures.readiness, 2)],
            rows,
            'No programmes are recorded.',
          ),
        ),
      ],
      say: `A programme’s evidence-based status is the worst of its deliverables; measures are rolled up from its deliverables, each separately.`,
      refs: f.programmes.map((p) => ({ kind: 'pm-node' as const, id: p.node.id })),
      provenance: ['computed', 'reported'],
    }),
  ];
};

export const portfolioStages: SlideBuilder = (input) => {
  const f = factsOf(input);
  const s = f.summary;
  const busiest = PDLC_STAGES.reduce((a, b) => (s.stageDistribution[b.id] > s.stageDistribution[a.id] ? b : a), PDLC_STAGES[0] as (typeof PDLC_STAGES)[number]);
  const rows: Cell[][] = PDLC_STAGES.map((st) => {
    const share = s.stageWorkShare[st.id];
    return [st.name, String(s.stageDistribution[st.id]), String(share.human), String(share.agent), `${Math.round(share.agentShare * 100)}%`];
  });
  return [
    makeSlide(input, {
      kind: 'portfolio-stages',
      title: `Most deliverables are in ${busiest.name} (${s.stageDistribution[busiest.id]} of ${s.counts.deliverables})`,
      layout: 'chart-and-table',
      blocks: [
        at('left', { type: 'bar', categories: PDLC_STAGES.map((st) => st.shortName), series: [{ name: 'Deliverables', values: PDLC_STAGES.map((st) => s.stageDistribution[st.id]), tone: 'accent' }], unit: 'deliverables' }),
        at('right', table([col('Stage', 4), col('Deliverables', 2, { align: 'right' }), col('Human items', 2, { align: 'right' }), col('Agent items', 2, { align: 'right' }), col('Agent share', 2, { align: 'right' })], rows)),
      ],
      say: `Deliverables per ${terms.app.lifecycleShort} stage, with the work items below Epic level split by human and agent assignee.`,
      refs: [],
      provenance: ['computed'],
    }),
  ];
};
