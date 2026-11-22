/**
 * Hand-written DeckSpecs for renderer tests and the visual check. They cover
 * every block type and every layout, including the awkward cases: a full
 * 10-row table, a measure that cannot be computed, unknown readiness, a
 * reported/evidence disagreement, a document with citations and a timeline with
 * a regulatory milestone and a knock-on extension.
 *
 * Text follows the app's wording rules (record keys, never internal ids). The
 * figures are illustrative and are not taken from the engine.
 */
import type { Block, DeckSpec, LayoutId, PlacedBlock, SlideSpec } from '@/lib/slides/types';

const AS_OF = '2027-03-08';
const SCOPE = { kind: 'deliverable', deliverableId: 'td-1001' } as const;
const SUBTITLE = 'IR-2027-001 › Counterparty Credit Risk Modernisation › TD-1001';

function slide(id: string, kind: SlideSpec['kind'], layout: LayoutId, title: string, blocks: PlacedBlock[], extra: Partial<SlideSpec> = {}): SlideSpec {
  return {
    id: `${kind}:deliverable:td-1001${id}`,
    kind,
    scope: SCOPE,
    title,
    subtitle: SUBTITLE,
    layout,
    blocks,
    notes: `Talk track for ${title}. Records: TD-1001, OC-1001-2.`,
    citations: [
      { ref: { kind: 'deliverable', id: 'td-1001' }, label: 'TD-1001', system: 'Portfolio system' },
      { ref: { kind: 'outcome', id: 'oc-1001-2' }, label: 'OC-1001-2', system: 'Work tracker' },
    ],
    provenance: ['computed'],
    asOf: AS_OF,
    ...extra,
  };
}

const at = (region: PlacedBlock['region'], block: Block): PlacedBlock => ({ region, block });

const measures: Block = {
  type: 'measures',
  work: { label: 'Work completion', value: '82%', caption: '82 of 100 points closed', computable: true },
  accepted: { label: 'Accepted outcomes', value: '1 of 4', caption: '1 accepted · 3 awaiting business acceptance', computable: true },
  readiness: { label: 'Delivery readiness', state: 'not-ready', stateText: 'Not ready', caption: '3 of 6 held, passing · 1 failing · 2 missing', tone: 'red' },
};

const measuresUnknown: Block = {
  type: 'measures',
  work: { label: 'Work completion', value: 'Not computable', caption: 'No estimates on 7 of 9 stories', computable: false },
  accepted: { label: 'Accepted outcomes', value: '0 of 2', caption: 'No outcome accepted yet', computable: true },
  readiness: { label: 'Delivery readiness', state: 'unknown', stateText: 'Unknown', caption: 'Risk tier not set, so required evidence is unknown', tone: 'unknown' },
};

const ragPair: Block = {
  type: 'rag-pair',
  reported: 'green',
  reportedText: 'Green',
  evidence: 'red',
  evidenceText: 'Red',
  disagree: true,
  reason: 'A mandatory test result is failing and two required evidence kinds are missing.',
};

const tenRowTable: Block = {
  type: 'table',
  columns: [
    { header: 'Deliverable', width: 1.1 },
    { header: 'Programme', width: 2.4 },
    { header: 'Reported', width: 1 },
    { header: 'Evidence', width: 1 },
    { header: 'Top reason', width: 3.4 },
    { header: 'Work', width: 0.8, align: 'right' },
    { header: 'Accepted', width: 0.9, align: 'right' },
    { header: 'Readiness', width: 1.2 },
  ],
  rows: Array.from({ length: 10 }, (_, i) => [
    { text: `TD-10${String(i + 1).padStart(2, '0')}`, bold: true },
    i % 2 ? 'Liquidity Reporting Uplift' : 'Counterparty Credit Risk Modernisation',
    { text: 'Green', tone: 'green' as const },
    { text: i % 3 === 0 ? 'Red' : i % 3 === 1 ? 'Amber' : 'Unknown', tone: (i % 3 === 0 ? 'red' : i % 3 === 1 ? 'amber' : 'unknown') as 'red' | 'amber' | 'unknown' },
    i % 3 === 0 ? 'Mandatory test result failing' : i % 3 === 1 ? 'Dependency CCR-301 is 12 days late' : 'No risk tier recorded',
    `${60 + i * 3}%`,
    `${i % 4} of 4`,
    { text: i % 3 === 2 ? 'Unknown' : 'Not ready', tone: (i % 3 === 2 ? 'unknown' : 'red') as 'unknown' | 'red' },
  ]),
};

const smallTable: Block = {
  type: 'table',
  columns: [
    { header: 'Evidence kind', width: 2 },
    { header: 'State', width: 1.2 },
    { header: 'Latest', width: 1 },
  ],
  rows: [
    ['Requirements sign-off', { text: 'Held', tone: 'green' }, '12 Jan 2027'],
    ['Design review', { text: 'Held', tone: 'green' }, '2 Feb 2027'],
    ['Control assessment', { text: 'Stale', tone: 'amber' }, '4 Oct 2026'],
    ['Test result', { text: 'Failing', tone: 'red' }, '1 Mar 2027'],
    ['Change approval', { text: 'Missing', tone: 'red' }, '—'],
  ],
};

const portfolioRag: Block = {
  type: 'stacked-bar',
  categories: ['Reported', 'Evidence-based'],
  series: [
    { name: 'Green', values: [31, 12], tone: 'green' },
    { name: 'Amber', values: [6, 11], tone: 'amber' },
    { name: 'Red', values: [3, 9], tone: 'red' },
    { name: 'Unknown', values: [0, 8], tone: 'unknown' },
  ],
  horizontal: true,
};

const stagesBar: Block = {
  type: 'bar',
  categories: ['Ideation', 'Design', 'Risk & control', 'Build & test', 'Launch'],
  series: [
    { name: 'Human', values: [5, 8, 6, 12, 4] },
    { name: 'Agent', values: [2, 3, 1, 7, 1] },
  ],
  unit: 'Deliverables',
};

const rail: Block = {
  type: 'stage-rail',
  stages: [
    { stageId: 'ideation-requirements', name: 'Ideation & Requirements', state: 'done', detail: 'Approved by Alexis Merrow · 1 record' },
    { stageId: 'design-specifications', name: 'Design & Specifications', state: 'done', detail: 'Approved by Priya Natarajan · 2 records' },
    { stageId: 'risk-control-compliance', name: 'Risk, Control & Compliance', state: 'current', detail: '1 review open', movedBackFrom: 'Build, Test & Validate' },
    { stageId: 'build-test-validate', name: 'Build, Test & Validate', state: 'not-started', detail: 'Needs a test result' },
    { stageId: 'delivery-launch', name: 'Delivery & Launch', state: 'not-started', detail: 'Needs change approval' },
  ],
};

const timeline: Block = {
  type: 'timeline',
  window: { start: '2027-01-01', end: '2027-08-31' },
  today: AS_OF,
  rows: [
    {
      label: 'TD-1001',
      plannedStart: '2027-01-11',
      plannedEnd: '2027-05-28',
      projectedEnd: '2027-06-18',
      completion: 0.82,
      tone: 'red',
      milestones: [
        { date: '2027-03-31', label: 'Model sign-off', regulatory: true, tone: 'amber' },
        { date: '2027-05-28', label: 'Go-live', regulatory: false },
      ],
      note: '+21d knock-on from TD-1016',
    },
    { label: 'TD-1016', plannedStart: '2027-02-01', plannedEnd: '2027-04-30', projectedEnd: '2027-05-21', completion: 0.55, tone: 'amber', note: 'Forecast +21d' },
    { label: 'TD-1004', plannedStart: '2027-01-04', plannedEnd: '2027-03-26', completion: 0.95, tone: 'green', milestones: [{ date: '2027-03-26', label: 'Pilot complete', regulatory: false, tone: 'green' }] },
    { label: 'TD-1022', plannedStart: '2027-04-05', plannedEnd: '2027-08-13', completion: 0, tone: 'unknown' },
  ],
};

const document: Block = {
  type: 'document',
  label: 'Scripted agent draft',
  sections: [
    {
      heading: 'Summary',
      sentences: [
        { text: 'TD-1001 is reported Green, but the evidence says Red.', cites: [1] },
        { text: 'Work completion is 82%, and 1 of 4 outcomes is accepted.', cites: [1, 2] },
      ],
    },
    {
      heading: 'Why the evidence says Red',
      sentences: [
        { text: 'The regression test result recorded on 1 Mar 2027 is failing.', cites: [3] },
        { text: 'Change approval and a current control assessment are missing.', cites: [1] },
        { text: 'Dependency CCR-301 from TD-1016 is 12 days late.', cites: [4] },
      ],
    },
    {
      heading: 'Next steps',
      sentences: [
        { text: 'Re-run the regression suite after the fix in CCR-118 lands.', cites: [3] },
        { text: 'Agree a revised need-by date for CCR-301 with the TD-1016 pod.', cites: [] },
      ],
    },
  ],
};

export const FIXTURE_FOOTER = { text: 'Prototype · synthetic data · as at 8 Mar 2027' };

/** Every layout and every block type at least once. */
export const FIXTURE_DECK: DeckSpec = {
  title: 'TD-1001 Technology Deliverable pack',
  fileName: 'TD-1001-deliverable-pack-2027-03-08.pptx',
  footer: FIXTURE_FOOTER,
  slides: [
    slide('', 'cover', 'cover', 'TD-1001 Counterparty exposure engine', [
      at('main', { type: 'text', emphasis: 'body', text: 'Technology Deliverable pack · as at 8 Mar 2027 · Source: synthetic portfolio' }),
      at('main', { type: 'kpis', items: [
        { label: 'Reported', value: 'Green', tone: 'green' },
        { label: 'Evidence-based', value: 'Red', tone: 'red' },
        { label: 'Work completion', value: '82%' },
        { label: 'Accepted outcomes', value: '1 of 4' },
      ] }),
    ], { subtitle: 'IR-2027-001 › Counterparty Credit Risk Modernisation' }),
    slide('', 'contents', 'title-only', 'Contents', [
      at('main', { type: 'bullets', items: [
        { text: 'Verdict and the three measures' },
        { text: 'Readiness evidence' },
        { text: 'Outcomes and acceptance' },
        { text: 'Plan, milestones and knock-on' },
        { text: 'Lifecycle position' },
        { text: 'Weekly status (scripted agent draft)' },
      ] }),
    ]),
    slide('', 'td-verdict', 'kpis-over-table', 'TD-1001 is reported Green; the evidence says Red', [
      at('top', ragPair),
      at('main', measures),
      at('main', { type: 'callout', tone: 'red', title: 'Mandatory evidence failing', text: 'The regression test result is failing and change approval is missing, so delivery readiness is Not ready.' }),
    ]),
    slide('', 'how-to-read', 'statement', 'Readiness is a state, not a percentage', [
      at('main', { type: 'text', emphasis: 'statement', text: 'Three measures, kept separate: work completion, accepted outcomes and delivery readiness.' }),
      at('main', { type: 'callout', tone: 'unknown', title: 'Not computable', text: 'When a measure cannot be computed, the slide says so in words, with the reason. It is never shown as zero.' }),
    ]),
    slide('', 'portfolio-disagreements', 'table', 'Where reported status and evidence disagree', [at('main', tenRowTable)], { page: { index: 1, of: 2 } }),
    slide('', 'portfolio-rag', 'chart-and-table', 'Reported against evidence: 40 deliverables', [
      at('left', portfolioRag),
      at('right', { type: 'bullets', items: [
        { text: '19 deliverables are reported better than their evidence', tone: 'red' },
        { text: '8 have no evidence-based status yet', tone: 'unknown' },
        { text: '11 are Amber on evidence', tone: 'amber' },
        { text: '12 agree with their evidence', tone: 'green' },
      ] }),
    ]),
    slide('', 'td-readiness', 'two-column', 'Two required evidence kinds are missing', [
      at('left', smallTable),
      at('right', measuresUnknown),
      at('right', { type: 'text', emphasis: 'caption', text: 'Required kinds come from the deliverable’s risk tier. Stale means older than 120 days.' }),
    ]),
    slide('', 'portfolio-stages', 'chart-and-table', 'Work across the lifecycle', [
      at('left', stagesBar),
      at('right', { type: 'table', columns: [{ header: 'Stage', width: 2 }, { header: 'Human', width: 1, align: 'right' }, { header: 'Agent', width: 1, align: 'right' }], rows: [], emptyText: 'No deliverables in this scope' }),
    ]),
    slide('', 'td-pdlc', 'rail', 'TD-1001 moved back to Risk, Control & Compliance', [
      at('top', rail),
      at('main', { type: 'table', columns: [{ header: 'Review', width: 2 }, { header: 'Reviewer', width: 1.6 }, { header: 'State', width: 1.2 }, { header: 'Date', width: 1 }], rows: [
        ['Requirements review', 'Alexis Merrow', { text: 'Approved', tone: 'green' }, '14 Jan 2027'],
        ['Design review', 'Priya Natarajan', { text: 'Approved', tone: 'green' }, '3 Feb 2027'],
        ['Control owner review', 'Jonas Whitfield', { text: 'Open', tone: 'amber' }, '—'],
      ] }),
    ]),
    slide('', 'td-plan', 'timeline', 'TD-1001 is forecast 21 days late', [
      at('top', { type: 'kpis', items: [
        { label: 'Planned end', value: '28 May 2027' },
        { label: 'Forecast end', value: '18 Jun 2027', tone: 'red', caption: 'Knock-on from TD-1016' },
        { label: 'Regulatory milestones at risk', value: '1', tone: 'amber' },
      ] }),
      at('main', timeline),
    ]),
    slide('', 'node-plan', 'timeline', 'Plan and milestones without a summary row', [at('main', timeline)]),
    slide('', 'td-status', 'document', 'Weekly status: TD-1001', [at('main', document)], {
      provenance: ['scripted-agent'],
      notes: 'Scripted agent draft. Citations: [1] TD-1001 (Portfolio system); [2] OC-1001-2 (Work tracker); [3] EV-2201 (Work tracker); [4] CCR-301 (Work tracker).',
    }),
  ],
};

/** All layouts the fixture deck uses (for coverage assertions). */
export const FIXTURE_LAYOUTS: LayoutId[] = [...new Set(FIXTURE_DECK.slides.map((s) => s.layout))];
