/**
 * Pagination and text fitting (docs/SLIDES_PLAN.md section 6).
 */
import { describe, expect, it } from 'vitest';
import type { SlideSpec } from '../types';
import { buildPack, buildSlides } from './packs';
import { capTables, pageTitle, paginate } from './paginate';
import { syntheticContext } from './test-helpers';

function spec(rows: number, extra: Partial<SlideSpec> = {}): SlideSpec {
  return {
    id: 'td-findings:deliverable:td-1001',
    kind: 'td-findings',
    scope: { kind: 'deliverable', deliverableId: 'td-1001' },
    title: 'A table that is far too long for one slide',
    layout: 'kpis-over-table',
    blocks: [
      { region: 'top', block: { type: 'kpis', items: [{ label: 'Rows', value: String(rows) }] } },
      {
        region: 'main',
        block: {
          type: 'table',
          columns: [{ header: 'Key', width: 1 }, { header: 'Text', width: 4, maxChars: 12 }],
          rows: Array.from({ length: rows }, (_, i) => [`K-${i + 1}`, i === 0 ? 'A cell with a very long text' : 'short']),
        },
      },
    ],
    notes: 'Say this.\n\nRecords: TD-1001',
    citations: [],
    provenance: ['computed'],
    asOf: '2027-03-08',
    ...extra,
  };
}

describe('paginate', () => {
  it('splits a 25-row table over 3 slides with repeated headers, page numbers and ids', () => {
    const pages = paginate(spec(25));
    expect(pages.map((p) => p.id)).toEqual(['td-findings:deliverable:td-1001', 'td-findings:deliverable:td-1001:p2', 'td-findings:deliverable:td-1001:p3']);
    expect(pages.map((p) => p.page)).toEqual([
      { index: 1, of: 3 },
      { index: 2, of: 3 },
      { index: 3, of: 3 },
    ]);
    expect(pages.map((p) => p.title)).toEqual([
      'A table that is far too long for one slide',
      'A table that is far too long for one slide (continued, 2 of 3)',
      'A table that is far too long for one slide (continued, 3 of 3)',
    ]);
    const tables = pages.map((p) => p.blocks.find((b) => b.block.type === 'table')?.block);
    expect(tables.map((t) => (t?.type === 'table' ? t.rows.length : 0))).toEqual([10, 10, 5]);
    for (const t of tables) expect(t?.type === 'table' ? t.columns.map((c) => c.header) : []).toEqual(['Key', 'Text']);
    // Continuations keep only the table, in a layout that has its region.
    expect(pages[1]?.layout).toBe('table');
    expect(pages[1]?.blocks.map((b) => b.region)).toEqual(['main']);
    expect(pages[0]?.blocks.length).toBe(2);
  });

  it('leaves a 10-row table on one slide without a page marker', () => {
    const pages = paginate(spec(10));
    expect(pages.length).toBe(1);
    expect(pages[0]?.page).toBeUndefined();
  });

  it('shortens long cells with an ellipsis and puts the full text in notes', () => {
    const [first] = paginate(spec(3));
    const t = first?.blocks[1]?.block;
    expect(t?.type === 'table' ? t.rows[0]?.[1] : '').toBe('A cell with…');
    expect(first?.notes).toContain('Shortened on the slide:\n- A cell with a very long text');
    expect(first?.notes.startsWith('Say this.\n\nRecords: TD-1001')).toBe(true);
  });

  it('caps bullets at 8 per slide with the same continuation rule', () => {
    const s = spec(0, { layout: 'title-only', blocks: [{ region: 'main', block: { type: 'bullets', items: Array.from({ length: 17 }, (_, i) => ({ text: `Item ${i + 1}` })) } }] });
    const pages = paginate(s);
    expect(pages.map((p) => (p.blocks[0]?.block.type === 'bullets' ? p.blocks[0].block.items.length : 0))).toEqual([8, 8, 1]);
    expect(pages[2]?.title).toMatch(/\(continued, 3 of 3\)$/);
  });

  it('keeps continued titles within 70 characters', () => {
    const long = 'x'.repeat(70);
    expect(pageTitle(long, 2, 3).length).toBeLessThanOrEqual(70);
    expect(pageTitle(long, 2, 3).endsWith(' (continued, 2 of 3)')).toBe(true);
    expect(pageTitle(long, 1, 3)).toBe(long);
  });

  it('caps tables at topN before paginating', () => {
    const capped = capTables(spec(25), 4);
    expect(capped.blocks[1]?.block.type === 'table' ? capped.blocks[1].block.rows.length : 0).toBe(4);
    expect(capped.notes).toContain('Table limited to the top 4 of 25 rows.');
  });
});

describe('pagination in real packs', () => {
  const ctx = syntheticContext();

  it('the portfolio findings table and record index continue with page counts that add up', () => {
    const slides = buildPack('portfolio', { kind: 'portfolio' }, {}, ctx);
    for (const kind of ['portfolio-findings', 'record-index'] as const) {
      const pages = slides.filter((s) => s.kind === kind);
      const rows = pages.map((p) => p.blocks.find((b) => b.block.type === 'table')?.block).map((t) => (t?.type === 'table' ? t.rows.length : 0));
      const total = rows.reduce((a, b) => a + b, 0);
      expect(pages.length).toBe(Math.max(1, Math.ceil(total / 10)));
      if (pages.length > 1) {
        expect(pages.every((p, i) => p.page?.index === i + 1 && p.page.of === pages.length)).toBe(true);
        const headers = pages.map((p) => JSON.stringify((p.blocks.find((b) => b.block.type === 'table')?.block as { columns: unknown }).columns));
        expect(new Set(headers).size).toBe(1);
      }
    }
  });

  it('a timeline continues at 6 rows under headline figures (10 alone), in the timeline layout', () => {
    const rows = Array.from({ length: 15 }, (_, i) => ({ label: `TD-${3000 + i}`, plannedStart: '2027-01-04', plannedEnd: '2027-03-31' }));
    const s = spec(0, { layout: 'timeline', blocks: [{ region: 'top', block: { type: 'kpis', items: [] } }, { region: 'main', block: { type: 'timeline', window: { start: '2027-01-01', end: '2027-03-31' }, today: '2027-03-08', rows } }] });
    const pages = paginate(s);
    expect(pages.map((p) => p.layout)).toEqual(['timeline', 'timeline', 'timeline']);
    expect(pages.map((p) => p.blocks.find((b) => b.block.type === 'timeline')?.block).map((t) => (t?.type === 'timeline' ? t.rows.length : 0))).toEqual([6, 6, 3]);
    const alone = paginate({ ...s, blocks: s.blocks.filter((b) => b.region === 'main') });
    expect(alone.map((p) => (p.blocks[0]?.block.type === 'timeline' ? p.blocks[0].block.rows.length : 0))).toEqual([10, 5]);
    for (const slide of buildSlides({ kind: 'portfolio' }, ['portfolio-quarter'], ctx)) for (const b of slide.blocks) if (b.block.type === 'timeline') expect(b.block.rows.length).toBeLessThanOrEqual(12);
  });
});
