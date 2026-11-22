/**
 * Text fitting (docs/SLIDES_PLAN.md section 6): tables longer than 10 body
 * rows, bullet lists longer than 8 items and timelines longer than 12 rows
 * continue on further slides with the same columns, titled
 * "<title> (continued, 2 of 3)", with `page` set and ids suffixed `:p2`.
 * Cell text beyond a column's `maxChars` and long bullets are shortened with
 * "…"; the full text goes into that page's notes.
 */
import type { Block, Cell, LayoutId, PlacedBlock, SlideSpec } from '../types';
import { BULLET_MAX_CHARS, BULLETS_PER_SLIDE, cellText, shorten, TABLE_ROWS_PER_SLIDE, TIMELINE_ROWS_PER_SLIDE, TITLE_MAX } from './kit';

type Splittable = Extract<Block, { type: 'table' | 'bullets' | 'timeline' }>;

function capacity(block: Block): number | null {
  if (block.type === 'table') return TABLE_ROWS_PER_SLIDE;
  if (block.type === 'bullets') return BULLETS_PER_SLIDE;
  if (block.type === 'timeline') return TIMELINE_ROWS_PER_SLIDE;
  return null;
}

function length(block: Splittable): number {
  return block.type === 'bullets' ? block.items.length : block.rows.length;
}

function slice(block: Splittable, from: number, to: number): Splittable {
  if (block.type === 'table') return { ...block, rows: block.rows.slice(from, to) };
  if (block.type === 'timeline') return { ...block, rows: block.rows.slice(from, to) };
  return { ...block, items: block.items.slice(from, to) };
}

const overflows = (b: Block): b is Splittable => {
  const cap = capacity(b);
  return cap !== null && length(b as Splittable) > cap;
};

/** Cuts any block beyond its capacity, listing what was dropped. Used for a second overflowing block on one slide. */
function truncate(block: Splittable, dropped: string[]): Splittable {
  const cap = capacity(block) as number;
  if (block.type === 'table') for (const r of block.rows.slice(cap)) dropped.push(r.map(cellText).join(' · '));
  else if (block.type === 'timeline') for (const r of block.rows.slice(cap)) dropped.push(r.label);
  else for (const i of block.items.slice(cap)) dropped.push(i.text);
  return slice(block, 0, cap);
}

/** Shortens cells and bullets in place of a copy, collecting the full texts. */
function fitText(block: Block, full: string[]): Block {
  if (block.type === 'table') {
    const rows = block.rows.map((row) =>
      row.map((cell, i): Cell => {
        const max = block.columns[i]?.maxChars;
        const t = cellText(cell);
        if (!max || t.length <= max) return cell;
        full.push(t);
        return typeof cell === 'string' ? shorten(t, max) : { ...cell, text: shorten(t, max) };
      }),
    );
    return { ...block, rows };
  }
  if (block.type === 'bullets') {
    return {
      ...block,
      items: block.items.map((item) => {
        if (item.text.length <= BULLET_MAX_CHARS) return item;
        full.push(item.text);
        return { ...item, text: shorten(item.text, BULLET_MAX_CHARS) };
      }),
    };
  }
  return block;
}

function withFitText(spec: SlideSpec, extraNotes: string[] = []): SlideSpec {
  const full: string[] = [];
  const blocks = spec.blocks.map((p) => ({ ...p, block: fitText(p.block, full) }));
  const notes = [spec.notes, ...extraNotes];
  if (full.length > 0) notes.push(`Shortened on the slide:\n${full.map((t) => `- ${t}`).join('\n')}`);
  return { ...spec, blocks, notes: notes.join('\n\n') };
}

function continuationLayout(block: Splittable): LayoutId {
  if (block.type === 'table') return 'table';
  if (block.type === 'timeline') return 'timeline';
  return 'title-only';
}

/** Title for page `index` of `of`: page 1 keeps the title; later pages carry the suffix within 70 characters. */
export function pageTitle(title: string, index: number, of: number): string {
  if (index === 1) return title;
  const suffix = ` (continued, ${index} of ${of})`;
  return `${shorten(title, TITLE_MAX - suffix.length)}${suffix}`;
}

/** Splits one slide into pages and fits its text. Returns one or more specs. */
export function paginate(spec: SlideSpec): SlideSpec[] {
  const first = spec.blocks.findIndex((p) => overflows(p.block));
  if (first < 0) return [withFitText(spec)];

  // Only one block per slide is paginated; any other overflowing block is cut and listed in notes.
  const dropped: string[] = [];
  const blocks: PlacedBlock[] = spec.blocks.map((p, i) => (i !== first && overflows(p.block) ? { ...p, block: truncate(p.block, dropped) } : p));
  const target = blocks[first] as PlacedBlock & { block: Splittable };
  const cap = capacity(target.block) as number;
  const total = length(target.block);
  const of = Math.ceil(total / cap);
  const droppedNote = dropped.length > 0 ? [`Not shown on the slide:\n${dropped.map((t) => `- ${t}`).join('\n')}`] : [];

  const pages: SlideSpec[] = [];
  for (let index = 1; index <= of; index++) {
    const part = slice(target.block, (index - 1) * cap, index * cap);
    const page = { index, of };
    if (index === 1) {
      const pageBlocks = blocks.map((p, i) => (i === first ? { ...p, block: part } : p));
      pages.push(withFitText({ ...spec, blocks: pageBlocks, page }, droppedNote));
    } else {
      pages.push(
        withFitText({
          ...spec,
          id: `${spec.id}:p${index}`,
          title: pageTitle(spec.title, index, of),
          layout: continuationLayout(part),
          blocks: [{ region: 'main', block: part }],
          page,
        }),
      );
    }
  }
  return pages;
}

/** Caps every table at `topN` body rows (pack option), noting what was left out. */
export function capTables(spec: SlideSpec, topN: number | undefined): SlideSpec {
  if (!topN || topN < 1) return spec;
  const notes: string[] = [];
  const blocks = spec.blocks.map((p) => {
    if (p.block.type !== 'table' || p.block.rows.length <= topN) return p;
    notes.push(`Table limited to the top ${topN} of ${p.block.rows.length} rows.`);
    return { ...p, block: { ...p.block, rows: p.block.rows.slice(0, topN) } };
  });
  return notes.length === 0 ? spec : { ...spec, blocks, notes: [spec.notes, ...notes].join('\n\n') };
}
