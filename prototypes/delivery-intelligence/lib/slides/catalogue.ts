/**
 * Slide catalogue and pack definitions (docs/SLIDES_PLAN.md sections 4 and 5).
 *
 * Metadata only: what each slide kind is called, what it shows and which
 * scopes it accepts, plus the five ordered packs. Builders live in
 * compose/slides/*; this file has no dependency on data or the engine so the
 * interface can list kinds and packs cheaply.
 */
import type { PmNodeLevel } from '@/lib/types';
import type { CatalogueEntry, PackDefinition, PackId, SlideKind, SlideScope, SlideScopeKind } from './types';

const ALL_SCOPES: SlideScopeKind[] = ['portfolio', 'pm-node', 'deliverable', 'outcome'];

const entry = (kind: SlideKind, title: string, description: string, scopes: SlideScopeKind[]): CatalogueEntry => ({ kind, title, description, scopes });

/** Every slide kind, in catalogue order (common, portfolio, node, deliverable, outcome). */
export const CATALOGUE_LIST: readonly CatalogueEntry[] = [
  // Common
  entry('cover', 'Cover', 'Scope name and path, as-at date, data source and the prototype marker when synthetic.', ALL_SCOPES),
  entry('contents', 'Contents', 'Section titles of the pack.', ALL_SCOPES),
  entry('how-to-read', 'How to read these measures', 'The three measures, reported against evidence-based status, and what “not computable” means.', ALL_SCOPES),
  entry('decisions', 'Decisions and next steps', 'Editable placeholders, prefilled from the most severe findings that name an action.', ALL_SCOPES),
  entry('record-index', 'Records cited', 'Appendix table of every record cited, with the system it lives in.', ALL_SCOPES),
  // Portfolio
  entry('portfolio-headline', 'Status disagreements', 'The disagreement count and sentence, beside the three portfolio measures.', ['portfolio']),
  entry('portfolio-rag', 'Reported against evidence', 'Reported and evidence-based status counts as aligned stacked bars.', ['portfolio']),
  entry('portfolio-disagreements', 'Where reported status and evidence disagree', 'Each disagreeing deliverable with its status pair, top reason and three measures.', ['portfolio']),
  entry('portfolio-programmes', 'Health by programme', 'Each programme with its status pair and rolled-up measures.', ['portfolio']),
  entry('portfolio-stages', 'Work across the lifecycle', 'Deliverables per lifecycle stage and the human and agent share of work.', ['portfolio']),
  entry('portfolio-findings', 'Data-quality findings', 'Findings per rule, most severe first.', ['portfolio']),
  entry('portfolio-quarter', 'This quarter’s commitments', 'Due this quarter, forecast to slip, regulatory milestones at risk and knock-on.', ['portfolio']),
  entry('portfolio-hubs', 'Where the work sits', 'Work and health per region, and late cross-hub dependencies.', ['portfolio']),
  entry('portfolio-brief', 'Executive brief', 'The executive-briefing agent’s latest draft, labelled as scripted.', ['portfolio']),
  // Programme, project or initiative
  entry('node-overview', 'Overview', 'Path, child counts, rolled-up status pair and measures, and the route.', ['pm-node']),
  entry('node-deliverables', 'Deliverables', 'Every deliverable beneath it: status pair, three measures, stage and forecast end.', ['pm-node']),
  entry('node-plan', 'Plan and milestones', 'Simplified timeline of its deliverables, milestones, regulatory flags and knock-on.', ['pm-node']),
  entry('node-risks', 'Risks, issues and dependencies', 'RAID and dependencies across its deliverables, and the top findings.', ['pm-node']),
  entry('node-disagreements', 'Disagreements', 'Deliverables beneath it reported differently from their evidence.', ['pm-node']),
  // Technology deliverable
  entry('td-verdict', 'Verdict', 'Status pair, the verdict sentence and the three measures.', ['deliverable']),
  entry('td-readiness', 'Readiness evidence', 'Required evidence for its risk tier against held, failing, missing and stale.', ['deliverable']),
  entry('td-outcomes', 'Outcomes', 'Weight, due date, reported status beside acceptance, work completion and gaps.', ['deliverable']),
  entry('td-findings', 'Why the evidence says this', 'Findings, most severe first, with the records behind them.', ['deliverable']),
  entry('td-plan', 'Plan', 'Planned against forecast, milestones and dependency knock-on.', ['deliverable']),
  entry('td-raid', 'Risks, issues and dependencies', 'RAID with age and owner; inbound and outbound dependencies with days late.', ['deliverable']),
  entry('td-pdlc', 'Lifecycle position', 'Stage rail with reviews, reviewers and evidence per stage, and any moves back.', ['deliverable']),
  entry('td-pod', 'Pod', 'People and agent identities, and the human and agent share of work.', ['deliverable']),
  entry('td-jira-map', 'How it maps to Jira', 'The portfolio record above the boundary; its Epics and linking fields below.', ['deliverable']),
  entry('td-status', 'Weekly status', 'The status-reporting agent’s latest draft with numbered citations.', ['deliverable']),
  // Outcome
  entry('outcome-summary', 'Outcome', 'Reported status beside acceptance, weight, due date, owner and work completion.', ['outcome']),
  entry('outcome-criteria', 'Acceptance', 'Criteria with mandatory flag, state, who accepted and when; the business acceptance record.', ['outcome']),
  entry('outcome-work', 'Work carrying this outcome', 'Story-level items by Epic, open items and missing reviewers.', ['outcome']),
  entry('outcome-evidence', 'Evidence', 'Evidence linked to the outcome with result, date and staleness.', ['outcome']),
];

export const CATALOGUE: Readonly<Record<SlideKind, CatalogueEntry>> = Object.fromEntries(CATALOGUE_LIST.map((e) => [e.kind, e])) as Record<SlideKind, CatalogueEntry>;

export function catalogueEntry(kind: SlideKind): CatalogueEntry {
  return CATALOGUE[kind];
}

/** Kinds that accept a scope kind, in catalogue order. */
export function kindsForScopeKind(scopeKind: SlideScopeKind): SlideKind[] {
  return CATALOGUE_LIST.filter((e) => e.scopes.includes(scopeKind)).map((e) => e.kind);
}

const NODE_PACK_KINDS: SlideKind[] = [
  'cover',
  'contents',
  'node-overview',
  'node-deliverables',
  'node-disagreements',
  'node-plan',
  'node-risks',
  'decisions',
  'how-to-read',
  'record-index',
];

/** The five packs of section 5, slides in order. Options are applied in compose/packs.ts. */
export const PACKS: Readonly<Record<PackId, PackDefinition>> = {
  outcome: {
    id: 'outcome',
    title: 'Outcome pack',
    scopes: ['outcome'],
    kinds: ['cover', 'outcome-summary', 'outcome-criteria', 'outcome-work', 'outcome-evidence', 'how-to-read', 'record-index'],
  },
  deliverable: {
    id: 'deliverable',
    title: 'Technology Deliverable pack',
    scopes: ['deliverable'],
    kinds: [
      'cover',
      'contents',
      'td-verdict',
      'td-readiness',
      'td-outcomes',
      'td-findings',
      'td-plan',
      'td-raid',
      'td-pdlc',
      'td-pod',
      'td-jira-map',
      'td-status',
      'decisions',
      'how-to-read',
      'record-index',
    ],
  },
  project: { id: 'project', title: 'Project pack', scopes: ['pm-node'], kinds: NODE_PACK_KINDS },
  programme: { id: 'programme', title: 'Programme pack', scopes: ['pm-node'], kinds: NODE_PACK_KINDS },
  portfolio: {
    id: 'portfolio',
    title: 'Portfolio pack',
    scopes: ['portfolio'],
    kinds: [
      'cover',
      'contents',
      'portfolio-headline',
      'portfolio-rag',
      'portfolio-disagreements',
      'portfolio-programmes',
      'portfolio-quarter',
      'portfolio-stages',
      'portfolio-hubs',
      'portfolio-findings',
      'portfolio-brief',
      'decisions',
      'how-to-read',
      'record-index',
    ],
  },
};

export const PACK_IDS: PackId[] = ['outcome', 'deliverable', 'project', 'programme', 'portfolio'];

/** Pack for a PM node level: projects use the project pack; programmes and initiatives the programme pack. */
export function packForNodeLevel(level: PmNodeLevel): PackId {
  return level === 'project' ? 'project' : 'programme';
}

/**
 * Whether a pack accepts a scope. For `pm-node` scopes the node's level must
 * match the pack (`nodeLevel` is that node's level, looked up by the caller).
 */
export function packAcceptsScope(packId: PackId, scope: SlideScope, nodeLevel?: PmNodeLevel): boolean {
  const pack = PACKS[packId];
  if (!pack.scopes.includes(scope.kind)) return false;
  if (scope.kind !== 'pm-node') return true;
  return nodeLevel !== undefined && packForNodeLevel(nodeLevel) === packId;
}
