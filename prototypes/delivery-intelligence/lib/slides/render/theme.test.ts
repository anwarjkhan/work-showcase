/**
 * Theme guards: slide colours stay in step with the light theme in
 * app/theme.css, type sizes keep to plan section 6, and every layout's regions
 * sit inside the content area without overlapping the bands or each other.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LayoutId, RegionId } from '@/lib/slides/types';
import { BANDS, COLOUR_TOKENS, COVER, LAYOUT_REGIONS, SLIDE_H, SLIDE_W, STATUS_GLYPHS, TONES, TYPE, type Rect } from './theme';

function lightThemeVars(): Map<string, string> {
  const cssText = readFileSync(path.join(process.cwd(), 'app/theme.css'), 'utf8');
  const start = cssText.indexOf(":root[data-theme='light']");
  expect(start).toBeGreaterThan(-1);
  const open = cssText.indexOf('{', start);
  const close = cssText.indexOf('\n}', open);
  const block = cssText.slice(open + 1, close);
  const vars = new Map<string, string>();
  for (const m of block.matchAll(/(--di-[\w-]+)\s*:\s*([^;]+);/g)) vars.set(m[1]!, m[2]!.trim().toLowerCase());
  return vars;
}

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('slide theme', () => {
  it('copies the light-theme colours from app/theme.css exactly', () => {
    const vars = lightThemeVars();
    for (const [role, token] of Object.entries(COLOUR_TOKENS)) {
      expect(vars.get(token.cssVar), `${role} (${token.cssVar})`).toBe(`#${token.hex.toLowerCase()}`);
    }
  });

  it('keeps type sizes within plan section 6', () => {
    expect(TYPE.title).toBeGreaterThanOrEqual(24);
    expect(TYPE.title).toBeLessThanOrEqual(28);
    for (const key of ['body', 'bullet', 'caption', 'label', 'documentBody', 'chartLabel'] as const) expect(TYPE[key]).toBeGreaterThanOrEqual(12);
    expect(TYPE.table).toBeGreaterThanOrEqual(11);
    expect(TYPE.chartDataLabel).toBeGreaterThanOrEqual(11);
  });

  it('pairs every status tone with a glyph and a word', () => {
    for (const tone of ['red', 'amber', 'green', 'unknown'] as const) {
      expect(TONES[tone].glyph).toBe(STATUS_GLYPHS[tone]);
      expect(TONES[tone].word.length).toBeGreaterThan(0);
    }
    expect(new Set(Object.values(STATUS_GLYPHS)).size).toBe(4);
  });

  it('defines the documented regions for every layout, inside the content area', () => {
    const expected: Record<LayoutId, RegionId[]> = {
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
    for (const [layout, regions] of Object.entries(expected) as [LayoutId, RegionId[]][]) {
      const defined = LAYOUT_REGIONS[layout];
      expect(Object.keys(defined).sort(), layout).toEqual([...regions].sort());
      const rects = regions.map((r) => defined[r]!);
      for (const r of rects) {
        expect(r.x).toBeGreaterThanOrEqual(0.5);
        expect(r.x + r.w).toBeLessThanOrEqual(SLIDE_W - 0.5 + 1e-9);
        expect(r.y + r.h).toBeLessThanOrEqual(BANDS.footerRule.y);
        if (layout === 'cover') expect(overlaps(r, COVER.title) || overlaps(r, COVER.subtitle)).toBe(false);
        else expect(r.y).toBeGreaterThanOrEqual(BANDS.rule.y);
      }
      for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) expect(overlaps(rects[i]!, rects[j]!), `${layout} regions overlap`).toBe(false);
    }
  });

  it('keeps the bands on the page', () => {
    for (const r of Object.values(BANDS)) {
      expect(r.x + r.w).toBeLessThanOrEqual(SLIDE_W);
      expect(r.y + r.h).toBeLessThanOrEqual(SLIDE_H);
    }
    expect(overlaps(BANDS.footerText, BANDS.logo)).toBe(false);
    expect(overlaps(BANDS.logo, BANDS.slideNumber)).toBe(false);
  });
});
