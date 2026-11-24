/**
 * Slide extraction: shared contract (docs/SLIDES_PLAN.md section 3).
 *
 * Three layers meet here:
 *   extract  (data + engine result -> facts)          lib/slides/extract/*
 *   compose  (facts -> SlideSpec[])                    lib/slides/compose/*
 *   render   (SlideSpec[] -> .pptx and HTML preview)   lib/slides/render/*
 *
 * A SlideSpec is renderer-agnostic and plain JSON (no functions, no Dates, no
 * class instances), so it can be snapshot-tested, stored in session storage
 * and handed to either renderer. Every user-visible string in a spec is final
 * text: renderers never look anything up, never translate ids, never compute.
 */
import type {
  EntityRef,
  EvidenceRagStatus,
  IsoDate,
  PdlcStageId,
  Provenance,
  RagStatus,
  ReadinessState,
  Severity,
} from '@/lib/types';

// ---------------------------------------------------------------------------
// Scopes
// ---------------------------------------------------------------------------

/** What a slide or pack is about. `pm-node` covers initiative, programme and project. */
export type SlideScope =
  | { kind: 'portfolio' }
  | { kind: 'pm-node'; pmNodeId: string }
  | { kind: 'deliverable'; deliverableId: string }
  | { kind: 'outcome'; outcomeId: string };

export type SlideScopeKind = SlideScope['kind'];

// ---------------------------------------------------------------------------
// Slide kinds (catalogue ids, docs/SLIDES_PLAN.md section 4)
// ---------------------------------------------------------------------------

export type CommonSlideKind = 'cover' | 'contents' | 'how-to-read' | 'decisions' | 'record-index';

export type PortfolioSlideKind =
  | 'portfolio-headline'
  | 'portfolio-rag'
  | 'portfolio-disagreements'
  | 'portfolio-programmes'
  | 'portfolio-stages'
  | 'portfolio-findings'
  | 'portfolio-quarter'
  | 'portfolio-hubs'
  | 'portfolio-brief';

export type NodeSlideKind = 'node-overview' | 'node-deliverables' | 'node-plan' | 'node-risks' | 'node-disagreements';

export type DeliverableSlideKind =
  | 'td-verdict'
  | 'td-readiness'
  | 'td-outcomes'
  | 'td-findings'
  | 'td-plan'
  | 'td-raid'
  | 'td-pdlc'
  | 'td-pod'
  | 'td-jira-map'
  | 'td-status';

export type OutcomeSlideKind = 'outcome-summary' | 'outcome-criteria' | 'outcome-work' | 'outcome-evidence';

export type SlideKind = CommonSlideKind | PortfolioSlideKind | NodeSlideKind | DeliverableSlideKind | OutcomeSlideKind;

// ---------------------------------------------------------------------------
// Layouts (16:9, 13.333 x 7.5 in; regions defined in render/theme.ts)
// ---------------------------------------------------------------------------

/**
 * Each layout has named regions. Blocks are placed into regions in order:
 *  - `cover`:            title, subtitle, `main` (meta text / kpis)
 *  - `statement`:        `main` (one statement or callout, large)
 *  - `title-only`:       `main` (one block, full width)
 *  - `kpis-over-table`:  `top` (kpis / rag-pair / measures), `main` (table or chart)
 *  - `two-column`:       `left`, `right`
 *  - `table`:            `main` (one table)
 *  - `chart-and-table`:  `left` (chart), `right` (table or bullets)
 *  - `rail`:             `top` (stage-rail), `main` (table or bullets)
 *  - `timeline`:         `top` (kpis optional), `main` (timeline)
 *  - `document`:         `main` (document block; long text)
 */
export type LayoutId =
  | 'cover'
  | 'statement'
  | 'title-only'
  | 'kpis-over-table'
  | 'two-column'
  | 'table'
  | 'chart-and-table'
  | 'rail'
  | 'timeline'
  | 'document';

export type RegionId = 'main' | 'top' | 'left' | 'right';

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

/** Semantic tone; renderers map to colour AND always show the word. Never a raw colour. */
export type Tone = 'red' | 'amber' | 'green' | 'unknown' | 'neutral' | 'accent';

/** A measure as display text, already formatted (e.g. "82%", "1 of 4", "Not computable"). */
export interface MeasureView {
  label: string;          // "Work completion"
  value: string;          // "82%" | "Not computable"
  caption: string;        // "82 of 100 points closed" | reason when not computable
  computable: boolean;
}

export interface ReadinessView {
  label: string;          // "Delivery readiness"
  state: ReadinessState;
  stateText: string;      // "Not ready" (from terms)
  caption: string;        // "3 of 6 held, passing · 1 failing · 2 missing"
  tone: Tone;
}

export interface Column {
  header: string;
  /** Relative width weight; renderer normalises across columns. */
  width: number;
  align?: 'left' | 'right' | 'center';
  /** Max characters before the composer shortens cell text (full text goes to notes). */
  maxChars?: number;
}

/** A cell is plain text, optionally with a tone (rendered as coloured word with its shape glyph). */
export type Cell = string | { text: string; tone?: Tone; bold?: boolean };

export interface Series {
  name: string;
  values: number[];
  tone?: Tone;
}

export interface StageView {
  stageId: PdlcStageId;
  name: string;           // "Build, Test & Validate"
  state: 'done' | 'current' | 'not-started';
  detail: string;         // "Approved by Anwar Khan · 1 record" | "Current · 1 review open"
  movedBackFrom?: string; // stage name, when the last move into this stage was a move back
}

export interface TimelineRow {
  label: string;
  plannedStart: IsoDate;
  plannedEnd: IsoDate;
  /** Forecast or knock-on end when different from plan. */
  projectedEnd?: IsoDate;
  completion?: number;    // 0..1 fill of the planned bar
  tone?: Tone;
  milestones?: { date: IsoDate; label: string; regulatory: boolean; tone?: Tone }[];
  note?: string;          // "+9d knock-on from TD-1016"
}

export interface DocumentSection {
  heading: string;
  /** Each sentence keeps its citation numbers (1-based indexes into the slide's citations). */
  sentences: { text: string; cites: number[] }[];
}

export type Block =
  | { type: 'kpis'; items: { label: string; value: string; caption?: string; tone?: Tone }[] }
  | { type: 'rag-pair'; reported: RagStatus; reportedText: string; evidence: EvidenceRagStatus; evidenceText: string; disagree: boolean; reason?: string }
  | { type: 'measures'; work: MeasureView; accepted: MeasureView; readiness: ReadinessView }
  | { type: 'table'; columns: Column[]; rows: Cell[][]; emptyText?: string }
  | { type: 'bar' | 'stacked-bar'; categories: string[]; series: Series[]; unit?: string; horizontal?: boolean }
  | { type: 'stage-rail'; stages: StageView[] }
  | { type: 'timeline'; window: { start: IsoDate; end: IsoDate }; today: IsoDate; rows: TimelineRow[] }
  | { type: 'bullets'; items: { text: string; tone?: Tone }[] }
  | { type: 'text'; text: string; emphasis: 'statement' | 'body' | 'caption' }
  | { type: 'callout'; tone: Tone; title?: string; text: string }
  | { type: 'document'; sections: DocumentSection[]; label: string };

export type BlockType = Block['type'];

/** A block placed into a layout region. */
export interface PlacedBlock {
  region: RegionId;
  block: Block;
}

// ---------------------------------------------------------------------------
// Slides
// ---------------------------------------------------------------------------

export interface SlideSpec {
  /** Stable: `${kind}:${scopeKey}` plus `:p${n}` on continuation pages. */
  id: string;
  kind: SlideKind;
  scope: SlideScope;
  /** At most 70 characters (composer enforces). A statement where the data supports one. */
  title: string;
  /** Scope path, e.g. "IR-2027-001 › Counterparty Credit Risk Modernisation". */
  subtitle?: string;
  layout: LayoutId;
  blocks: PlacedBlock[];
  /** Speaker notes: talk track, then "Records: KEY, KEY …", then any text shortened on the slide. */
  notes: string;
  /** Records the slide rests on, in citation order (document blocks cite by 1-based index). */
  citations: { ref: EntityRef; label: string; system: string }[];
  provenance: Provenance[];
  /** Engine computedFor. */
  asOf: IsoDate;
  page?: { index: number; of: number };
}

/** The footer every slide carries; built once per export from data meta, never by slide builders. */
export interface FooterSpec {
  /** e.g. "Prototype · synthetic data · as at 8 Mar 2027" or "Source: PTS and Jira · extracted 8 Mar 2027". */
  text: string;
}

/** What the renderers receive. */
export interface DeckSpec {
  title: string;
  /** e.g. "TD-1001-deliverable-pack-2027-03-08.pptx". */
  fileName: string;
  footer: FooterSpec;
  slides: SlideSpec[];
}

// ---------------------------------------------------------------------------
// Catalogue and packs
// ---------------------------------------------------------------------------

export type PackId = 'outcome' | 'deliverable' | 'project' | 'programme' | 'portfolio';

export interface PackOptions {
  /** Deliverable pack: add an outcome-summary slide per outcome. */
  includeOutcomeSummaries?: boolean;
  /** Deliverable and portfolio packs: include the scripted-agent narrative slide. Default true. */
  includeAgentNarrative?: boolean;
  /** Project and programme packs: append td-verdict slides. */
  appendVerdicts?: 'none' | 'disagreeing' | 'all';
  /** Cap table rows across the pack (before pagination). */
  topN?: number;
}

export interface CatalogueEntry {
  kind: SlideKind;
  title: string;          // human name for menus, e.g. "Readiness evidence"
  description: string;    // one line for the builder
  scopes: SlideScopeKind[];
}

export interface PackDefinition {
  id: PackId;
  title: string;          // "Technology Deliverable pack"
  scopes: SlideScopeKind[]; // project/programme packs accept pm-node of matching level
  kinds: SlideKind[];
}

// Re-exported for convenience in builders and renderers.
export type { Severity };
