/**
 * DeckSpec -> .pptx with PptxGenJS, in the browser and in Node.
 *
 * The library is never imported as a value here: callers pass the constructor
 * (`renderPptx(deck, PptxGenJS)`), and `downloadPptx` imports it dynamically
 * inside the call, so it stays out of the app's initial bundle.
 *
 * One slide master carries the paper background, the provenance footer (left),
 * an empty logo slot and the slide number (right). Every slide uses that master,
 * so the footer lives on the slide layout and builders cannot remove it.
 * No URL or file path is ever passed to the library: there are no images.
 */
import type PptxGenJS from 'pptxgenjs';
import type { DeckSpec, SlideSpec } from '@/lib/slides/types';
import { placeBlocks } from './layout';
import { drawBlock, type DrawContext } from './pptx-blocks';
import { BANDS, COLOURS, COVER, FONTS, LAYOUT_NAME, MASTER_NAME, SLIDE_H, SLIDE_W, TYPE, titleSize } from './theme';

export type PptxGenJSCtor = new () => PptxGenJS;

/** Output types and what `renderPptx` resolves to for each. */
export interface PptxOutputs {
  nodebuffer: Buffer;
  blob: Blob;
  arraybuffer: ArrayBuffer;
  uint8array: Uint8Array;
  base64: string;
}
export type PptxOutputType = keyof PptxOutputs;

export interface BuiltPresentation {
  pptx: PptxGenJS;
  /** Layout warnings (too many rows, blocks taller than a region, unknown regions). */
  warnings: string[];
}

const isDev = () => typeof process === 'undefined' || process.env.NODE_ENV !== 'production';

function defineMaster(pptx: PptxGenJS, footerText: string) {
  pptx.defineSlideMaster({
    title: MASTER_NAME,
    background: { color: COLOURS.paper },
    margin: [0, 0, 0, 0],
    objects: [
      { line: { x: BANDS.footerRule.x, y: BANDS.footerRule.y, w: BANDS.footerRule.w, h: 0, line: { color: COLOURS.line, width: 0.75 } } },
      {
        text: {
          text: footerText,
          options: {
            ...BANDS.footerText,
            fontFace: FONTS.body,
            fontSize: TYPE.footer,
            color: COLOURS.muted,
            margin: 0,
            valign: 'middle',
            fit: 'none',
          },
        },
      },
      // Empty logo slot: an unfilled picture placeholder; brand assets are added inside the firm.
      { placeholder: { options: { name: 'logo', type: 'pic', ...BANDS.logo }, text: '' } },
    ],
    slideNumber: {
      ...BANDS.slideNumber,
      fontFace: FONTS.body,
      fontSize: TYPE.footer,
      color: COLOURS.muted,
      align: 'right',
      valign: 'middle',
      margin: 0,
    },
  });
}

function drawChrome(pptx: PptxGenJS, slide: PptxGenJS.Slide, spec: SlideSpec) {
  const base = { fontFace: FONTS.heading, margin: 0, fit: 'none' as const };
  if (spec.layout === 'cover') {
    slide.addShape(pptx.ShapeType.rect, { ...COVER.bar, fill: { color: COLOURS.navy }, line: { type: 'none' } });
    slide.addText(spec.title, { ...COVER.title, ...base, fontSize: TYPE.coverTitle, bold: true, color: COLOURS.ink, valign: 'bottom' });
    if (spec.subtitle) slide.addText(spec.subtitle, { ...COVER.subtitle, ...base, fontFace: FONTS.body, fontSize: TYPE.coverSubtitle, color: COLOURS.muted, valign: 'top' });
    return;
  }
  slide.addText(spec.title, { ...BANDS.title, ...base, fontSize: titleSize(spec.title), lineSpacingMultiple: 0.95, bold: true, color: COLOURS.ink, valign: 'bottom' });
  if (spec.subtitle) slide.addText(spec.subtitle, { ...BANDS.subtitle, ...base, fontFace: FONTS.body, fontSize: TYPE.subtitle, color: COLOURS.muted, valign: 'middle' });
  slide.addShape(pptx.ShapeType.line, { ...BANDS.rule, line: { color: COLOURS.line, width: 0.75 } });
  slide.addShape(pptx.ShapeType.rect, { x: BANDS.rule.x, y: BANDS.rule.y - 0.025, w: 0.9, h: 0.05, fill: { color: COLOURS.accent }, line: { type: 'none' } });
}

/** Builds the presentation object without writing it. */
export function buildPresentation(deck: DeckSpec, Ctor: PptxGenJSCtor): BuiltPresentation {
  const pptx = new Ctor();
  const warnings: string[] = [];
  pptx.defineLayout({ name: LAYOUT_NAME, width: SLIDE_W, height: SLIDE_H });
  pptx.layout = LAYOUT_NAME;
  pptx.title = deck.title;
  pptx.subject = deck.title;
  // Theme fonts, so "use destination theme" when pasting into another template maps cleanly.
  pptx.theme = { headFontFace: FONTS.heading, bodyFontFace: FONTS.body };
  defineMaster(pptx, deck.footer.text);

  for (const spec of deck.slides) {
    const slide = pptx.addSlide({ masterName: MASTER_NAME });
    const ctx: DrawContext = { pptx, slideId: spec.id, warn: (m) => warnings.push(m) };
    drawChrome(pptx, slide, spec);
    const placement = placeBlocks(spec);
    warnings.push(...placement.warnings);
    for (const box of placement.boxes) drawBlock(ctx, slide, box.block, box.rect);
    slide.addNotes(spec.notes);
  }

  if (warnings.length && isDev()) {
    for (const w of warnings) console.warn(`[slides] ${w}`);
  }
  return { pptx, warnings };
}

/**
 * Renders a deck to bytes. Node: `renderPptx(deck, PptxGenJS)` gives a Buffer.
 * Browser: pass `'blob'` (or `'arraybuffer'`).
 */
export async function renderPptx<T extends PptxOutputType = 'nodebuffer'>(
  deck: DeckSpec,
  Ctor: PptxGenJSCtor,
  outputType?: T,
): Promise<PptxOutputs[T]> {
  const { pptx } = buildPresentation(deck, Ctor);
  const out = await pptx.write({ outputType: outputType ?? 'nodebuffer', compression: true });
  return out as PptxOutputs[T];
}

/** Loads PptxGenJS on demand (browser or Node) and returns its constructor. */
export async function loadPptxGenJS(): Promise<PptxGenJSCtor> {
  const mod = (await import('pptxgenjs')) as unknown as { default?: PptxGenJSCtor } & PptxGenJSCtor;
  return mod.default ?? mod;
}

/** Browser: builds the deck and saves it through a download named `deck.fileName`. */
export async function downloadPptx(deck: DeckSpec): Promise<{ fileName: string; slideCount: number; warnings: string[] }> {
  const Ctor = await loadPptxGenJS();
  const { pptx, warnings } = buildPresentation(deck, Ctor);
  await pptx.writeFile({ fileName: deck.fileName, compression: true });
  return { fileName: deck.fileName, slideCount: deck.slides.length, warnings };
}
