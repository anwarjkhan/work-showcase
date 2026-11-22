/**
 * Column fitting: turns builders' relative column weights into weights that
 * give every column room for its longest word, and short columns (no
 * `maxChars`: dates, counts, statuses, keys) room for their whole header and
 * values on one line, so nothing breaks mid-word. Long text columns (with
 * `maxChars`) share what is left, by their weights, and their `maxChars` is
 * lowered to what fits in about two lines.
 *
 * Widths are estimated for 11 pt Arial: about 0.11 in per character for bold
 * headers and status words, 0.095 for regular cell text, against the region
 * widths in render/theme.ts. Long text columns may wrap inside a long word
 * when space is short; headers and short values never do.
 */
import { LAYOUT_REGIONS as REGION_RECTS } from '../render/theme';
import type { Block, Cell, Column, LayoutId, RegionId } from '../types';

const HEADER_IN_PER_CHAR = 0.11;
const CELL_IN_PER_CHAR = 0.095;
const IN_PER_CHAR = CELL_IN_PER_CHAR;
/** Narrowest a long text column goes, in characters. */
const LONG_MIN_CHARS = 8;
/** Left and right cell margins plus a little slack. */
const CELL_PAD_IN = 0.22;
/** Status cells are drawn with a glyph and a space before the word, in bold. */
const TONE_EXTRA_CHARS = 3;
/** A short column never asks for more than this, so one long value cannot starve the rest. */
const SHORT_MAX_IN = 2.6;
/** Lines a shortened long-text cell may wrap to. */
const LONG_TEXT_LINES = 2;

type TableBlock = Extract<Block, { type: 'table' }>;

const cellText = (c: Cell): string => (typeof c === 'string' ? c : c.text);
const toned = (c: Cell): boolean => typeof c !== 'string' && c.tone !== undefined && c.tone !== 'neutral' && c.tone !== 'accent';
const longestWord = (t: string): number => t.split(/\s+/).reduce((n, w) => Math.max(n, w.length), 0);
const inches = (chars: number, perChar = CELL_IN_PER_CHAR): number => chars * perChar + CELL_PAD_IN;

/** Width in inches of a layout region (falls back to the full content width). */
export function regionWidth(layout: LayoutId, region: RegionId): number {
  const rects = REGION_RECTS[layout];
  return rects[region]?.w ?? rects.main?.w ?? 12.33;
}

/** Fits a table's column weights (in inches) and long-text limits to the width it will be drawn at. */
export function fitTable(table: TableBlock, widthIn: number): TableBlock {
  const cols = table.columns;
  const values = (i: number) => table.rows.map((r) => r[i]).filter((c): c is Cell => c !== undefined);
  const need = cols.map((col, i) => {
    const cells = values(i);
    const tonedCells = cells.some(toned);
    // Status words are bold, like headers.
    const perChar = tonedCells ? HEADER_IN_PER_CHAR : CELL_IN_PER_CHAR;
    const extra = tonedCells ? TONE_EXTRA_CHARS : 0;
    const headerWord = inches(longestWord(col.header), HEADER_IN_PER_CHAR);
    const short = col.maxChars === undefined;
    if (!short) {
      const min = Math.max(headerWord, inches(LONG_MIN_CHARS));
      return { min, ideal: min, short };
    }
    const cellWord = inches(Math.max(0, ...cells.map((c) => longestWord(cellText(c)))) + extra, perChar);
    const whole = Math.max(inches(col.header.length, HEADER_IN_PER_CHAR), inches(Math.max(0, ...cells.map((c) => cellText(c).length)) + extra, perChar));
    const min = Math.max(headerWord, cellWord);
    return { min, ideal: Math.min(SHORT_MAX_IN, Math.max(min, whole)), short };
  });

  // Every column gets its minimum; short columns then grow to their ideal; long columns share the rest by weight.
  const width = need.map((n) => n.min);
  let spare = widthIn - width.reduce((a, b) => a + b, 0);
  if (spare > 0) {
    const grow = need.map((n, i) => (n.short ? Math.max(0, n.ideal - (width[i] ?? 0)) : 0));
    const want = grow.reduce((a, b) => a + b, 0);
    const k = want > 0 ? Math.min(1, spare / want) : 0;
    grow.forEach((g, i) => (width[i] = (width[i] ?? 0) + g * k));
    spare -= want * k;
  }
  const longIdx = need.map((n, i) => (n.short ? -1 : i)).filter((i) => i >= 0);
  if (spare > 0) {
    const targets = longIdx.length > 0 ? longIdx : cols.map((_, i) => i);
    const totalWeight = targets.reduce((s, i) => s + Math.max(0.1, cols[i]?.width ?? 1), 0);
    for (const i of targets) width[i] = (width[i] ?? 0) + (spare * Math.max(0.1, cols[i]?.width ?? 1)) / totalWeight;
  }

  const columns: Column[] = cols.map((col, i) => {
    const w = Math.round((width[i] ?? 0.5) * 100) / 100;
    if (col.maxChars === undefined) return { ...col, width: w };
    const fits = Math.max(8, Math.floor(((w - CELL_PAD_IN) / IN_PER_CHAR) * LONG_TEXT_LINES));
    return { ...col, width: w, maxChars: Math.min(col.maxChars, fits) };
  });
  return { ...table, columns };
}
