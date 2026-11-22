/**
 * Composer toolkit: builds a SlideSpec from a builder's parts and enforces the
 * shared rules (section 6 and 9): title at most 70 characters (shortened with
 * the full text in notes), notes in the form "<say>\n\nRecords: …", citations
 * resolved to record keys and systems, provenance with `sample` on synthetic
 * data. Also the layout-region map every builder and test checks against.
 */
import type { EntityRef, Provenance } from '@/lib/types';
import { citationsFor, provenanceFor, scopeKey, scopePath, type Citation, type SlideEnv } from '../extract';
import type { Block, Cell, Column, LayoutId, PackId, PackOptions, PlacedBlock, RegionId, SlideKind, SlideScope, SlideSpec, Tone } from '../types';

/** Regions each layout has (mirrors the comment in types.ts). */
export const LAYOUT_REGIONS: Readonly<Record<LayoutId, readonly RegionId[]>> = {
  cover: ['main'],
  statement: ['main'],
  'title-only': ['main'],
  'kpis-over-table': ['top', 'main'],
  'two-column': ['left', 'right'],
  table: ['main'],
  'chart-and-table': ['left', 'right'],
  rail: ['top', 'main'],
  timeline: ['top', 'main'],
  document: ['main'],
};

/** Hard cap on title length; the composer shortens beyond it. */
export const TITLE_MAX = 70;
/** What fits on one line at 26 pt; builders aim titles at this. */
export const TITLE_TARGET = 55;
export const TABLE_ROWS_PER_SLIDE = 10;
export const BULLETS_PER_SLIDE = 8;
export const TIMELINE_ROWS_PER_SLIDE = 12;
/**
 * Timeline rows the renderer's region holds at its minimum row height
 * (render/theme.ts and pptx-blocks.ts): 6 under a row of headline figures,
 * 10 when the timeline has the slide to itself. Both are within the 12-row cap.
 */
export const TIMELINE_ROWS_WITH_TOP = 6;
export const TIMELINE_ROWS_ALONE = 10;

/** Label lines the renderer gives each timeline row: two when rows are tall, one at minimum height. */
export function timelineLabelLines(rowCount: number, hasTop: boolean): number {
  const area = (hasTop ? 3.75 : 5.15) - 0.64;
  const rowH = Math.max(0.45, Math.min(0.78, area / Math.max(1, rowCount)));
  return rowH >= 0.75 ? 2 : 1;
}
export const BULLET_MAX_CHARS = 150;
export const CHART_MAX_CATEGORIES = 8;

/** What every builder receives. */
export interface BuildInput {
  env: SlideEnv;
  scope: SlideScope;
  options: PackOptions;
  /** Set when building inside a pack (or a multi-kind request). */
  pack?: {
    id: PackId | null;
    title: string;
    /** Section titles, in order, for the contents slide. */
    sections: string[];
    /** Slides already built (for record-index). */
    slides: readonly SlideSpec[];
  };
}

export type SlideBuilder = (input: BuildInput) => SlideSpec[];

/** Shortens text to `max` characters with an ellipsis. */
export function shorten(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

export interface SlideParts {
  kind: SlideKind;
  title: string;
  layout: LayoutId;
  blocks: PlacedBlock[];
  /** One or two sentences to say. */
  say: string;
  /** Records the slide rests on; unresolvable and uncitable refs are dropped. */
  refs: EntityRef[];
  provenance: Provenance[];
  /** Overrides the scope path subtitle. */
  subtitle?: string;
  /** Extra notes after the records line (e.g. full citations, lists). */
  extraNotes?: string[];
  /** Pre-built citations (document slides), used instead of `refs`. */
  citations?: Citation[];
}

export function recordsLine(citations: readonly Citation[]): string {
  return `Records: ${citations.length > 0 ? citations.map((c) => c.label).join(', ') : 'none cited'}`;
}

export function makeSlide(input: BuildInput, parts: SlideParts): SlideSpec {
  const { env, scope } = input;
  const citations = parts.citations ?? citationsFor(env, parts.refs);
  const extra = [...(parts.extraNotes ?? [])];
  let title = parts.title;
  if (title.length > TITLE_MAX) {
    extra.push(`Full title: ${title}`);
    title = shorten(title, TITLE_MAX);
  }
  const notes = [parts.say.trim(), recordsLine(citations), ...extra].join('\n\n');
  return {
    id: `${parts.kind}:${scopeKey(scope)}`,
    kind: parts.kind,
    scope,
    title,
    subtitle: parts.subtitle ?? scopePath(env, scope),
    layout: parts.layout,
    blocks: parts.blocks,
    notes,
    citations,
    provenance: provenanceFor(env, parts.provenance),
    asOf: env.asOf,
  };
}

// --- Block helpers ----------------------------------------------------------------

export const at = (region: RegionId, block: Block): PlacedBlock => ({ region, block });

export const col = (header: string, width: number, extra: Partial<Column> = {}): Column => ({ header, width, ...extra });

export const toned = (text: string, tone: Tone, bold = false): Cell => (bold ? { text, tone, bold } : { text, tone });

export function table(columns: Column[], rows: Cell[][], emptyText?: string): Block {
  return emptyText ? { type: 'table', columns, rows, emptyText } : { type: 'table', columns, rows };
}

export function bullets(items: (string | { text: string; tone?: Tone })[]): Block {
  return { type: 'bullets', items: items.map((i) => (typeof i === 'string' ? { text: i } : i)) };
}

export const text = (t: string, emphasis: 'statement' | 'body' | 'caption' = 'body'): Block => ({ type: 'text', text: t, emphasis });

export const callout = (tone: Tone, t: string, title?: string): Block => (title ? { type: 'callout', tone, title, text: t } : { type: 'callout', tone, text: t });

/** Text of a cell. */
export const cellText = (c: Cell): string => (typeof c === 'string' ? c : c.text);
