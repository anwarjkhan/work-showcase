// @vitest-environment jsdom
/**
 * File-structure tests for the PowerPoint renderer (plan section 10): render
 * the fixture deck in Node, open the .pptx with jszip and check slide count,
 * notes, the footer on every slide, well-formed XML, no external links and a
 * native chart part per chart block.
 */
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { BlockType, DeckSpec } from '@/lib/slides/types';
import { FIXTURE_DECK, FIXTURE_FOOTER } from './fixtures';
import { buildPresentation, loadPptxGenJS, renderPptx } from './pptx';

const ALL_BLOCK_TYPES: BlockType[] = ['kpis', 'rag-pair', 'measures', 'table', 'bar', 'stacked-bar', 'stage-rail', 'timeline', 'bullets', 'text', 'callout', 'document'];
const ALL_LAYOUTS = ['cover', 'statement', 'title-only', 'kpis-over-table', 'two-column', 'table', 'chart-and-table', 'rail', 'timeline', 'document'];
/** Hosts that only ever appear as XML namespace or schema identifiers in Office files. */
const NAMESPACE_HOSTS = /^https?:\/\/(schemas\.openxmlformats\.org|schemas\.microsoft\.com|purl\.org|www\.w3\.org)\//;

// jsdom's DOMParser is a conforming XML parser: malformed input yields a <parsererror> document.
const parser = new DOMParser();
const parseXml = (text: string) => parser.parseFromString(text, 'application/xml');
const isWellFormed = (text: string) => parseXml(text).getElementsByTagName('parsererror').length === 0;

const slideNo = (path: string) => Number(/(\d+)\.xml$/.exec(path)?.[1]);
const byNumber = (a: string, b: string) => slideNo(a) - slideNo(b);
const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

let zip: JSZip;
let files: string[];
const read = (p: string) => zip.file(p)!.async('string');

beforeAll(async () => {
  const buf = await renderPptx(FIXTURE_DECK, PptxGenJS);
  expect(Buffer.isBuffer(buf)).toBe(true);
  zip = await JSZip.loadAsync(buf);
  files = Object.keys(zip.files).filter((f) => !zip.files[f]!.dir);
});

afterEach(() => vi.restoreAllMocks());

describe('fixture coverage', () => {
  it('covers every block type and every layout', () => {
    const types = new Set(FIXTURE_DECK.slides.flatMap((s) => s.blocks.map((b) => b.block.type)));
    expect([...types].sort()).toEqual([...ALL_BLOCK_TYPES].sort());
    expect([...new Set(FIXTURE_DECK.slides.map((s) => s.layout))].sort()).toEqual([...ALL_LAYOUTS].sort());
  });

  it('lays out without warnings', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(buildPresentation(FIXTURE_DECK, PptxGenJS).warnings).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('pptx file structure', () => {
  it('has one slide per spec, in order', async () => {
    const slides = files.filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f)).sort(byNumber);
    expect(slides).toHaveLength(FIXTURE_DECK.slides.length);
    for (const [i, spec] of FIXTURE_DECK.slides.entries()) {
      expect(await read(slides[i]!)).toContain(escapeXml(spec.title));
    }
  });

  it('has a notes part per slide carrying the spec notes', async () => {
    for (const [i, spec] of FIXTURE_DECK.slides.entries()) {
      const rels = await read(`ppt/slides/_rels/slide${i + 1}.xml.rels`);
      const target = /Target="\.\.\/notesSlides\/(notesSlide\d+\.xml)"/.exec(rels)?.[1];
      expect(target, `slide ${i + 1} notes relationship`).toBeDefined();
      const notes = await read(`ppt/notesSlides/${target}`);
      expect(notes).toContain(escapeXml(spec.notes.slice(0, 40)));
    }
  });

  it('puts the footer on every slide through the shared slide layout, plus a slide number', async () => {
    const footer = escapeXml(FIXTURE_FOOTER.text);
    for (let i = 1; i <= FIXTURE_DECK.slides.length; i++) {
      const rels = await read(`ppt/slides/_rels/slide${i}.xml.rels`);
      const layout = /Target="\.\.\/slideLayouts\/(slideLayout\d+\.xml)"/.exec(rels)?.[1];
      expect(layout, `slide ${i} layout`).toBeDefined();
      // PptxGenJS writes master objects into the slide layout each slide uses.
      expect(await read(`ppt/slideLayouts/${layout}`)).toContain(footer);
      expect(await read(`ppt/slides/slide${i}.xml`)).toContain('type="sldNum"');
    }
  });

  it('writes well-formed XML in every part', async () => {
    const xmlParts = files.filter((f) => f.endsWith('.xml') || f.endsWith('.rels'));
    expect(xmlParts.length).toBeGreaterThan(20);
    for (const f of xmlParts) expect(isWellFormed(await read(f)), f).toBe(true);
    expect(isWellFormed('<a><b></a>')).toBe(false);
  });

  it('has no external relationships and no URLs other than XML namespaces', async () => {
    for (const f of files.filter((p) => p.endsWith('.rels'))) {
      const doc = parseXml(await read(f));
      for (const rel of Array.from(doc.getElementsByTagName('Relationship'))) {
        expect(rel.getAttribute('TargetMode'), f).not.toBe('External');
        expect(rel.getAttribute('Target') ?? '', f).not.toMatch(/^(https?:|file:|\/\/)/i);
      }
    }
    for (const f of files.filter((p) => p.endsWith('.xml') || p.endsWith('.rels'))) {
      for (const m of (await read(f)).matchAll(/https?:\/\/[^\s"'<>]+/g)) expect(m[0], f).toMatch(NAMESPACE_HOSTS);
    }
  });

  it('writes a native chart part for each chart block and a native table for each table block', async () => {
    const chartBlocks = FIXTURE_DECK.slides.flatMap((s) => s.blocks).filter((b) => b.block.type === 'bar' || b.block.type === 'stacked-bar');
    const charts = files.filter((f) => /^ppt\/charts\/chart\d+\.xml$/.test(f));
    expect(charts).toHaveLength(chartBlocks.length);
    for (const c of charts) expect(await read(c)).toContain('<c:barChart>');
    for (const [i, spec] of FIXTURE_DECK.slides.entries()) {
      const tables = spec.blocks.filter((b) => b.block.type === 'table').length;
      expect(((await read(`ppt/slides/slide${i + 1}.xml`)).match(/<a:tbl>/g) ?? []).length, spec.id).toBe(tables);
    }
  });

  it('shows status as glyph and word, and readiness never as a percentage', async () => {
    const verdict = await read('ppt/slides/slide3.xml');
    expect(verdict).toContain('● Green');
    expect(verdict).toContain('■ Red');
    expect(verdict).toContain('■ Not ready');
    expect(verdict).toContain('Reported status and the evidence disagree');
    const readiness = await read('ppt/slides/slide7.xml');
    expect(readiness).toContain('? Not computable');
    expect(readiness).toContain('? Unknown');
  });

  it('marks regulatory milestones and citations in text', async () => {
    expect(await read('ppt/slides/slide10.xml')).toContain('>REG <');
    const doc = await read('ppt/slides/slide12.xml');
    expect(doc).toMatch(/baseline="30000"[^>]*>(?:<[^>]+>)*<a:t>\[1\]/);
    expect(doc).toContain('Scripted agent draft');
  });
});

describe('defensive rendering', () => {
  it('renders an over-long table in full and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const deck: DeckSpec = {
      ...FIXTURE_DECK,
      slides: [
        {
          ...FIXTURE_DECK.slides[4]!,
          blocks: [{ region: 'main', block: { type: 'table', columns: [{ header: 'Key', width: 1 }], rows: Array.from({ length: 12 }, (_, i) => [`TD-${2000 + i}`]) } }],
        },
      ],
    };
    const { warnings } = buildPresentation(deck, PptxGenJS);
    expect(warnings.some((w) => w.includes('12 body rows'))).toBe(true);
    expect(warn).toHaveBeenCalled();
  });

  it('loads the library on demand', async () => {
    expect(await loadPptxGenJS()).toBe(PptxGenJS);
  });

  it('returns a Blob or ArrayBuffer when asked', async () => {
    const one: DeckSpec = { ...FIXTURE_DECK, slides: [FIXTURE_DECK.slides[1]!] };
    expect(await renderPptx(one, PptxGenJS, 'blob')).toBeInstanceOf(Blob);
    expect(await renderPptx(one, PptxGenJS, 'arraybuffer')).toBeInstanceOf(ArrayBuffer);
  });
});
