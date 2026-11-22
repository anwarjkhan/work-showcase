/**
 * Block placement shared by both renderers: turns a slide's placed blocks into
 * one rectangle per block, inside its layout region, so the PowerPoint file and
 * the HTML preview put everything in the same place.
 *
 * Several blocks in one region stack top to bottom. Blocks with a natural height
 * (tiles, chips, short text) get that height; the rest (tables, charts,
 * timelines, documents, bullets, rails) share what is left. Nothing is placed
 * outside its region; if the fixed blocks alone are taller than the region they
 * are scaled down to fit and a warning is returned.
 */
import type { Block, LayoutId, PlacedBlock, RegionId, SlideSpec } from '@/lib/slides/types';
import { LAYOUT_REGIONS, STACK_GAP, type Rect } from './theme';

export interface BlockBox {
  block: Block;
  region: RegionId;
  rect: Rect;
}

export interface SlidePlacement {
  boxes: BlockBox[];
  warnings: string[];
}

/** Rough line count for wrapped text at a given size in a given width (Arial averages ~0.5 em per character). */
export function estimateLines(text: string, widthIn: number, fontPt: number): number {
  const charsPerLine = Math.max(8, Math.floor((widthIn * 72) / (fontPt * 0.5)));
  return text
    .split('\n')
    .reduce((n, para) => n + Math.max(1, Math.ceil(para.length / charsPerLine)), 0);
}

/** Width of each status chip in a rag-pair block. */
export const ragChipWidth = (width: number): number => Math.min(2.9, (width - 0.25) / 2);

/** Measures tiles stack vertically in regions narrower than this (e.g. a half-width column). */
export const measuresStacked = (width: number): boolean => width < 7.5;

/** Natural height in inches for fixed-height blocks; null for blocks that flex to fill. */
export function naturalHeight(block: Block, width: number): number | null {
  switch (block.type) {
    case 'kpis':
      return block.items.some((i) => i.caption) ? 1.2 : 1.0;
    case 'rag-pair': {
      // Wide regions put the disagreement text beside the chips; narrow ones stack it below.
      const chipW = ragChipWidth(width);
      const side = width >= 9;
      const textW = side ? width - 2 * chipW - 0.55 : width;
      const lines = (block.disagree ? 1 : 0) + (block.reason ? estimateLines(block.reason, textW, 12) : 0);
      if (lines === 0) return 0.85;
      return side ? Math.max(0.85, 0.4 + lines * 0.22) : 0.95 + lines * 0.22;
    }
    case 'measures':
      return measuresStacked(width) ? 3.75 : 1.35;
    case 'callout': {
      const lines = estimateLines(block.text, width - 0.5, 14);
      return Math.min(3, 0.3 + (block.title ? 0.34 : 0) + lines * 0.27);
    }
    case 'text': {
      const size = block.emphasis === 'statement' ? 28 : block.emphasis === 'body' ? 14 : 12;
      const lineH = (size * 1.25) / 72;
      return Math.min(4.2, 0.12 + estimateLines(block.text, width - 0.2, size) * lineH);
    }
    default:
      return null;
  }
}

/** Height the fixed blocks of a region need, or null when the region holds a flexible block. */
function neededHeight(placed: readonly PlacedBlock[], width: number): number | null {
  let total = STACK_GAP * (placed.length - 1);
  for (const p of placed) {
    const h = naturalHeight(p.block, width);
    if (h === null) return null;
    total += h;
  }
  return total;
}

/** Least height `main` keeps when `top` grows into it. */
const MAIN_MIN_H = 1.6;

/**
 * Region rectangles for one slide. Where a layout stacks `top` over `main`, the
 * boundary moves to fit what `top` actually holds: an empty `top` gives its
 * space to `main`, a short one gives back the slack, and a tall one borrows
 * from `main` (which keeps at least MAIN_MIN_H).
 */
export function slideRegions(layout: LayoutId, byRegion: ReadonlyMap<RegionId, readonly PlacedBlock[]>): Partial<Record<RegionId, Rect>> {
  const base = LAYOUT_REGIONS[layout];
  const out: Partial<Record<RegionId, Rect>> = {};
  for (const [k, r] of Object.entries(base) as [RegionId, Rect][]) out[k] = { ...r };
  const top = out.top;
  const main = out.main;
  if (!top || !main) return out;
  const topBlocks = byRegion.get('top');
  if (!topBlocks?.length) {
    out.main = { ...main, y: top.y, h: main.y + main.h - top.y };
    return out;
  }
  const need = neededHeight(topBlocks, top.w);
  if (need === null) return out;
  const delta = Math.min(need - top.h, main.h - MAIN_MIN_H);
  out.top = { ...top, h: top.h + delta };
  out.main = { ...main, y: main.y + delta, h: main.h - delta };
  return out;
}

/** First region of a layout, used when a block names a region the layout lacks. */
function fallbackRegion(layout: LayoutId): RegionId {
  const regions = LAYOUT_REGIONS[layout];
  return (['main', 'left', 'top', 'right'] as RegionId[]).find((r) => regions[r]) ?? 'main';
}

export function placeBlocks(slide: Pick<SlideSpec, 'layout' | 'blocks' | 'id'>): SlidePlacement {
  const warnings: string[] = [];
  const byRegion = new Map<RegionId, PlacedBlock[]>();
  for (const placed of slide.blocks) {
    let region = placed.region;
    if (!LAYOUT_REGIONS[slide.layout][region]) {
      const fb = fallbackRegion(slide.layout);
      warnings.push(`${slide.id}: layout ${slide.layout} has no region "${region}"; placed in "${fb}"`);
      region = fb;
    }
    const list = byRegion.get(region) ?? [];
    list.push({ region, block: placed.block });
    byRegion.set(region, list);
  }

  const regions = slideRegions(slide.layout, byRegion);
  const boxes: BlockBox[] = [];
  for (const [region, placed] of byRegion) {
    const rect = regions[region];
    if (!rect) continue;
    const gaps = STACK_GAP * (placed.length - 1);
    const naturals = placed.map((p) => naturalHeight(p.block, rect.w));
    const fixedTotal = naturals.reduce<number>((s, h) => s + (h ?? 0), 0);
    const flexCount = naturals.filter((h) => h === null).length;
    let available = rect.h - gaps;
    let scale = 1;
    if (fixedTotal > available || (flexCount > 0 && fixedTotal > available - 1)) {
      // Leave at least an inch for flexible blocks; otherwise shrink fixed ones.
      const room = flexCount > 0 ? Math.max(0, available - 1) : available;
      scale = fixedTotal > 0 ? Math.min(1, room / fixedTotal) : 1;
      if (scale < 1) warnings.push(`${slide.id}: blocks in "${region}" are taller than the region; fixed blocks reduced`);
    }
    available -= fixedTotal * scale;
    const flexH = flexCount > 0 ? Math.max(0, available) / flexCount : 0;
    let y = rect.y;
    placed.forEach((p, i) => {
      const nat = naturals[i];
      const h = nat === null || nat === undefined ? flexH : nat * scale;
      boxes.push({ block: p.block, region, rect: { x: rect.x, y, w: rect.w, h } });
      y += h + STACK_GAP;
    });
  }
  return { boxes, warnings };
}
