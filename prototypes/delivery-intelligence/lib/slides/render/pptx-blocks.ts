/**
 * PowerPoint drawing for each block type, into a rectangle chosen by layout.ts.
 *
 * Everything is native and editable: text boxes, shapes, tables and charts.
 * Fonts are fixed sizes with autofit off, so what the composer limited is what
 * appears. Status is always drawn as glyph + word as well as colour. Nothing
 * here passes a URL or a file path to the library.
 */
import type PptxGenJS from 'pptxgenjs';
import type { Block, Cell, MeasureView, ReadinessView, Tone } from '@/lib/slides/types';
import { estimateLines, measuresStacked, ragChipWidth } from './layout';
import {
  CHART_PALETTE,
  COLOURS,
  FONTS,
  MAX_TABLE_BODY_ROWS,
  RENDER_TEXT,
  TONES,
  TYPE,
  isStatusTone,
  statusBesideLabel,
  tableRowHeight,
  textWidth,
  tileValueSize,
  toneLabel,
  withGlyph,
  type Rect,
} from './theme';
import {
  TIMELINE_AXIS_H,
  TIMELINE_LABEL_LINE_H,
  TIMELINE_LABEL_W,
  TIMELINE_ROW_MAX_H,
  TIMELINE_ROW_MIN_H,
  placeRowLabels,
  timelineGeometry,
} from './timeline';

type Slide = PptxGenJS.Slide;
type Run = PptxGenJS.TextProps;
type BlockOf<T extends Block['type']> = Extract<Block, { type: T }>;

/** What a block renderer needs besides the slide. */
export interface DrawContext {
  pptx: PptxGenJS;
  slideId: string;
  warn: (message: string) => void;
}

/**
 * Base text options: fixed size, autofit off, no inset, top aligned.
 * Note: PptxGenJS 4.0.1 reads a text-box `margin` array as [left, right, bottom, top] in points
 * (not the CSS order its type comment suggests); table cell margins below 1 are inches.
 */
function textOpts(rect: Rect, extra: PptxGenJS.TextPropsOptions = {}): PptxGenJS.TextPropsOptions {
  return {
    x: rect.x,
    y: rect.y,
    w: rect.w,
    h: rect.h,
    fontFace: FONTS.body,
    fontSize: TYPE.body,
    color: COLOURS.body,
    margin: 0,
    valign: 'top',
    fit: 'none',
    ...extra,
  };
}

function addText(slide: Slide, text: string | Run[], rect: Rect, extra: PptxGenJS.TextPropsOptions = {}) {
  slide.addText(text, textOpts(rect, extra));
}

function tile(ctx: DrawContext, slide: Slide, rect: Rect, tone?: Tone) {
  slide.addShape(ctx.pptx.ShapeType.roundRect, {
    ...rect,
    rectRadius: 0.06,
    fill: { color: COLOURS.card },
    line: { color: COLOURS.line, width: 0.75 },
  });
  if (tone && isStatusTone(tone)) {
    slide.addShape(ctx.pptx.ShapeType.rect, { x: rect.x, y: rect.y + 0.06, w: 0.07, h: rect.h - 0.12, fill: { color: TONES[tone].mark }, line: { type: 'none' } });
  }
}

/** Splits a width into n equal tiles with gaps. */
function columns(rect: Rect, n: number, gap: number): Rect[] {
  const w = (rect.w - gap * (n - 1)) / Math.max(1, n);
  return Array.from({ length: n }, (_, i) => ({ x: rect.x + i * (w + gap), y: rect.y, w, h: rect.h }));
}

/** Splits a height into n equal rows with gaps. */
function rows(rect: Rect, n: number, gap: number): Rect[] {
  const h = (rect.h - gap * (n - 1)) / Math.max(1, n);
  return Array.from({ length: n }, (_, i) => ({ x: rect.x, y: rect.y + i * (h + gap), w: rect.w, h }));
}

// ---------------------------------------------------------------------------
// kpis, measures, rag-pair
// ---------------------------------------------------------------------------

/**
 * One stat tile: label (with the status word beside it when it fits), value
 * sized to fit one line, then caption (led by the status word when it did not
 * fit beside the label).
 */
function statTile(ctx: DrawContext, slide: Slide, r: Rect, label: string, value: string, caption: string | undefined, tone: Tone | undefined) {
  tile(ctx, slide, r, tone);
  const pad = 0.18;
  const inner = { x: r.x + pad, w: r.w - 2 * pad };
  const status = toneLabel(tone);
  const toneFg = tone && isStatusTone(tone) ? TONES[tone].fg : COLOURS.ink;
  // A value that already leads with the status glyph (readiness state, not computable) carries its own status.
  const own = Boolean(status) && value.startsWith(TONES[tone!].glyph);
  const beside = Boolean(status) && !own && statusBesideLabel(label, status, inner.w);
  const statusW = beside ? textWidth(status, TYPE.label) + 0.1 : 0;
  addText(slide, label, { ...inner, y: r.y + 0.1, w: inner.w - statusW, h: 0.3 }, { fontSize: TYPE.label, color: COLOURS.muted });
  if (beside) addText(slide, status, { x: inner.x + inner.w - statusW, y: r.y + 0.1, w: statusW, h: 0.3 }, { fontSize: TYPE.label, bold: true, color: toneFg, align: 'right' });
  addText(slide, value, { ...inner, y: r.y + 0.4, h: 0.5 }, { fontFace: FONTS.heading, fontSize: tileValueSize(value, inner.w), bold: true, color: toneFg, valign: 'middle' });
  const runs: Run[] = [];
  if (status && !own && !beside) runs.push({ text: caption ? `${status} \u00B7 ` : status, options: { bold: true, color: toneFg } });
  if (caption) runs.push({ text: caption, options: { color: COLOURS.muted } });
  if (runs.length) addText(slide, runs, { ...inner, y: r.y + 0.92, h: Math.max(0.25, r.h - 0.97) }, { fontSize: TYPE.caption });
}

function drawKpis(ctx: DrawContext, slide: Slide, b: BlockOf<'kpis'>, rect: Rect) {
  const tiles = columns(rect, b.items.length, 0.2);
  b.items.forEach((item, i) => statTile(ctx, slide, tiles[i]!, item.label, item.value, item.caption, item.tone));
}

function measureValue(m: MeasureView): { value: string; tone?: Tone } {
  return m.computable ? { value: m.value } : { value: withGlyph(m.value, 'unknown'), tone: 'unknown' };
}

function drawMeasures(ctx: DrawContext, slide: Slide, b: BlockOf<'measures'>, rect: Rect) {
  // Narrow regions stack the three tiles so values and captions keep their size.
  const [a, c2, d] = (measuresStacked(rect.w) ? rows(rect, 3, 0.15) : columns(rect, 3, 0.2)) as [Rect, Rect, Rect];
  for (const [r, m] of [[a, b.work], [c2, b.accepted]] as const) {
    const v = measureValue(m);
    statTile(ctx, slide, r, m.label, v.value, m.caption, v.tone);
  }
  const rd: ReadinessView = b.readiness;
  // Readiness is a state word with its glyph, never a percentage.
  const value = withGlyph(rd.stateText, rd.tone);
  statTile(ctx, slide, d, rd.label, value, rd.caption, rd.tone);
}

function chip(ctx: DrawContext, slide: Slide, r: Rect, label: string, text: string, tone: Tone) {
  addText(slide, label, { x: r.x, y: r.y, w: r.w, h: 0.28 }, { fontSize: TYPE.label, color: COLOURS.muted });
  const t = TONES[tone];
  slide.addText(withGlyph(text, tone), {
    ...textOpts({ x: r.x, y: r.y + 0.3, w: r.w, h: 0.48 }),
    shape: ctx.pptx.ShapeType.roundRect,
    rectRadius: 0.08,
    fill: { color: t.soft },
    line: { color: t.line, width: 1 },
    fontSize: 16,
    bold: true,
    color: t.fg,
    valign: 'middle',
    margin: [10, 10, 0, 0],
  });
}

function drawRagPair(ctx: DrawContext, slide: Slide, b: BlockOf<'rag-pair'>, rect: Rect) {
  const chipW = ragChipWidth(rect.w);
  chip(ctx, slide, { x: rect.x, y: rect.y, w: chipW, h: 0.8 }, RENDER_TEXT.reported, b.reportedText, b.reported);
  chip(ctx, slide, { x: rect.x + chipW + 0.25, y: rect.y, w: chipW, h: 0.8 }, RENDER_TEXT.evidence, b.evidenceText, b.evidence);
  const runs: Run[] = [];
  if (b.disagree) runs.push({ text: `≠ ${RENDER_TEXT.disagree}`, options: { bold: true, color: COLOURS.redFg, breakLine: Boolean(b.reason) } });
  if (b.reason) runs.push({ text: b.reason, options: { color: COLOURS.muted, fontSize: TYPE.caption } });
  if (runs.length === 0) return;
  const side = rect.w >= 9;
  const r = side
    ? { x: rect.x + 2 * chipW + 0.55, y: rect.y + 0.05, w: rect.w - 2 * chipW - 0.55, h: Math.max(0.5, rect.h - 0.05) }
    : { x: rect.x, y: rect.y + 0.9, w: rect.w, h: Math.max(0.3, rect.h - 0.9) };
  addText(slide, runs, r, { fontSize: TYPE.body, paraSpaceAfter: 2 });
}

// ---------------------------------------------------------------------------
// table
// ---------------------------------------------------------------------------

const cellText = (c: Cell) => (typeof c === 'string' ? c : c.text);

function drawTable(ctx: DrawContext, slide: Slide, b: BlockOf<'table'>, rect: Rect) {
  if (b.rows.length > MAX_TABLE_BODY_ROWS) {
    ctx.warn(`${ctx.slideId}: table has ${b.rows.length} body rows; the composer limit is ${MAX_TABLE_BODY_ROWS}. Rendered in full; it may run past its region.`);
  }
  const total = b.columns.reduce((s, c) => s + Math.max(0.1, c.width), 0);
  const colW = b.columns.map((c) => Math.round(((rect.w * Math.max(0.1, c.width)) / total) * 1000) / 1000);
  const rowH = tableRowHeight(rect.h, Math.max(1, b.rows.length) + 1);
  const cellMargin: [number, number, number, number] = [0.03, 0.08, 0.03, 0.08];
  const border = { type: 'solid' as const, pt: 0.75, color: COLOURS.line };

  const header: PptxGenJS.TableRow = b.columns.map((col) => ({
    text: col.header,
    options: { bold: true, color: COLOURS.paper, fill: { color: COLOURS.navy }, align: col.align ?? 'left' },
  }));
  const body: PptxGenJS.TableRow[] = b.rows.map((row, ri) =>
    b.columns.map((col, ci) => {
      const cell = row[ci] ?? '';
      const zebra = ri % 2 === 1 ? COLOURS.card : COLOURS.paper;
      if (typeof cell === 'string') return { text: cell, options: { fill: { color: zebra }, align: col.align ?? 'left' } };
      const tone = cell.tone;
      const status = tone && isStatusTone(tone) ? TONES[tone] : undefined;
      return {
        text: withGlyph(cellText(cell), tone),
        options: {
          bold: cell.bold || Boolean(status),
          color: status ? status.fg : tone === 'accent' ? COLOURS.heading : COLOURS.body,
          fill: { color: status ? status.soft : zebra },
          align: col.align ?? 'left',
        },
      };
    }),
  );
  if (body.length === 0) {
    body.push([
      {
        text: b.emptyText ?? RENDER_TEXT.noRows,
        options: { colspan: b.columns.length, italic: true, color: COLOURS.muted, fill: { color: COLOURS.paper } },
      },
    ]);
  }
  slide.addTable([header, ...body], {
    x: rect.x,
    y: rect.y,
    w: rect.w,
    colW,
    rowH,
    fontFace: FONTS.body,
    fontSize: TYPE.table,
    color: COLOURS.body,
    valign: 'middle',
    margin: cellMargin,
    border: [border, border, border, border],
    autoPage: false,
  });
}

// ---------------------------------------------------------------------------
// charts
// ---------------------------------------------------------------------------

function seriesColours(b: BlockOf<'bar' | 'stacked-bar'>): string[] {
  let next = 0;
  return b.series.map((s) => (s.tone && isStatusTone(s.tone) ? TONES[s.tone].mark : s.tone === 'accent' ? COLOURS.accent : CHART_PALETTE[next++ % CHART_PALETTE.length]!));
}

function drawChart(ctx: DrawContext, slide: Slide, b: BlockOf<'bar' | 'stacked-bar'>, rect: Rect) {
  const stacked = b.type === 'stacked-bar';
  const data = b.series.map((s) => ({
    // Status series carry their word in the legend name already; add the glyph so the legend does not rely on colour.
    // Status series are named with their word ("Green"), so the legend never relies on colour alone.
    name: s.name,
    labels: b.categories,
    values: s.values,
  }));
  slide.addChart(ctx.pptx.ChartType.bar, data, {
    x: rect.x,
    y: rect.y,
    w: rect.w,
    h: rect.h,
    barDir: b.horizontal ? 'bar' : 'col',
    // Horizontal bars list the first category at the top, as people read. PptxGenJS writes the
    // value through to <c:orientation>; its type only names 'minMax'.
    catAxisOrientation: (b.horizontal ? 'maxMin' : 'minMax') as 'minMax',
    barGrouping: stacked ? 'stacked' : 'clustered',
    barGapWidthPct: 60,
    chartColors: seriesColours(b),
    showLegend: true,
    legendPos: 'b',
    legendFontFace: FONTS.body,
    legendFontSize: TYPE.chartLabel,
    legendColor: COLOURS.body,
    showValue: true,
    dataLabelFontFace: FONTS.body,
    dataLabelFontSize: TYPE.chartDataLabel,
    dataLabelFontBold: true,
    dataLabelColor: stacked ? COLOURS.body : COLOURS.body,
    dataLabelPosition: stacked ? 'ctr' : 'outEnd',
    // Hide zero-value labels (they clutter stacked bars).
    dataLabelFormatCode: '#,##0;-#,##0;;',
    catAxisLabelFontFace: FONTS.body,
    catAxisLabelFontSize: TYPE.chartLabel,
    catAxisLabelColor: COLOURS.body,
    catAxisLineShow: true,
    valAxisLabelFontFace: FONTS.body,
    valAxisLabelFontSize: TYPE.chartLabel,
    valAxisLabelColor: COLOURS.muted,
    valGridLine: { color: COLOURS.grid, style: 'solid', size: 0.75 },
    showValAxisTitle: Boolean(b.unit),
    valAxisTitle: b.unit,
    valAxisTitleFontSize: TYPE.chartLabel,
    valAxisTitleColor: COLOURS.muted,
  });
}

// ---------------------------------------------------------------------------
// stage rail
// ---------------------------------------------------------------------------

function drawStageRail(ctx: DrawContext, slide: Slide, b: BlockOf<'stage-rail'>, rect: Rect) {
  const gap = 0.28;
  const boxes = columns(rect, b.stages.length, gap);
  b.stages.forEach((stage, i) => {
    const r = boxes[i]!;
    const current = stage.state === 'current';
    const done = stage.state === 'done';
    const fill = current ? COLOURS.navy : done ? COLOURS.card : COLOURS.paper;
    const fg = current ? COLOURS.paper : done ? COLOURS.body : COLOURS.muted;
    const stateWord = current ? RENDER_TEXT.stageCurrent : done ? RENDER_TEXT.stageDone : RENDER_TEXT.stageNotStarted;
    const chipH = stage.movedBackFrom ? 0.58 : 0;
    slide.addShape(ctx.pptx.ShapeType.roundRect, {
      ...r,
      rectRadius: 0.08,
      fill: { color: fill },
      line: { color: current ? COLOURS.accent : done ? COLOURS.lineStrong : COLOURS.line, width: current ? 2 : 0.75, dashType: stage.state === 'not-started' ? 'dash' : 'solid' },
    });
    const runs: Run[] = [
      { text: `${i + 1}. ${stage.name}`, options: { bold: true, fontSize: TYPE.label, color: fg, breakLine: true } },
      { text: stateWord, options: { fontSize: TYPE.caption, bold: current, color: current ? 'BFD3FF' : fg, breakLine: true } },
      { text: stage.detail, options: { fontSize: TYPE.caption, color: current ? 'DCE6FA' : COLOURS.muted } },
    ];
    addText(slide, runs, { x: r.x + 0.1, y: r.y + 0.08, w: r.w - 0.2, h: r.h - 0.16 - chipH }, { paraSpaceAfter: 3 });
    if (stage.movedBackFrom) {
      slide.addText(`◄ ${RENDER_TEXT.movedBackFrom} ${stage.movedBackFrom}`, {
        ...textOpts({ x: r.x + 0.08, y: r.y + r.h - chipH - 0.04, w: r.w - 0.16, h: chipH - 0.04 }),
        shape: ctx.pptx.ShapeType.roundRect,
        rectRadius: 0.05,
        fill: { color: COLOURS.amberSoft },
        line: { color: COLOURS.amberLine, width: 0.75 },
        fontSize: TYPE.caption,
        bold: true,
        color: COLOURS.amberFg,
        valign: 'middle',
        margin: [5, 5, 0, 0],
      });
    }
    if (i < b.stages.length - 1) {
      addText(slide, '►', { x: r.x + r.w, y: r.y + r.h / 2 - 0.15, w: gap, h: 0.3 }, { align: 'center', valign: 'middle', fontSize: 12, color: COLOURS.subtle });
    }
  });
}

// ---------------------------------------------------------------------------
// timeline
// ---------------------------------------------------------------------------

function drawTimeline(ctx: DrawContext, slide: Slide, b: BlockOf<'timeline'>, rect: Rect) {
  const g = timelineGeometry(b);
  const S = ctx.pptx.ShapeType;
  const plotX = rect.x + TIMELINE_LABEL_W;
  const plotW = rect.w - TIMELINE_LABEL_W - 0.1;
  const xAt = (f: number) => plotX + f * plotW;
  const top = rect.y + TIMELINE_AXIS_H;
  const todayLabelH = 0.28;
  const rowsH = rect.h - TIMELINE_AXIS_H - todayLabelH;
  const rowH = Math.max(TIMELINE_ROW_MIN_H, Math.min(TIMELINE_ROW_MAX_H, rowsH / Math.max(1, g.rows.length)));
  const bottom = top + rowH * g.rows.length;
  if (bottom > rect.y + rect.h + 0.01) ctx.warn(`${ctx.slideId}: timeline has too many rows for its region`);

  // Axis: month ticks and gridlines.
  slide.addShape(S.line, { x: plotX, y: top, w: plotW, h: 0, line: { color: COLOURS.axis, width: 1 } });
  g.ticks.forEach((t, i) => {
    slide.addShape(S.line, { x: xAt(t.at), y: top, w: 0, h: bottom - top, line: { color: COLOURS.grid, width: 0.75 } });
    const nextAt = g.ticks[i + 1]?.at ?? 1;
    const w = Math.max(0.3, (nextAt - t.at) * plotW);
    addText(slide, t.label, { x: xAt(t.at) + 0.04, y: rect.y, w, h: TIMELINE_AXIS_H - 0.04 }, { fontSize: TYPE.table, color: COLOURS.muted, valign: 'bottom' });
  });

  g.rows.forEach((rg, i) => {
    const y = top + i * rowH;
    if (i > 0) slide.addShape(S.line, { x: rect.x, y, w: rect.w, h: 0, line: { color: COLOURS.line, width: 0.5 } });
    const tone = rg.row.tone ?? 'accent';
    const t = TONES[tone];
    const barY = y + 0.08;
    const barH = 0.24;
    addText(slide, rg.row.label, { x: rect.x, y: barY - 0.06, w: TIMELINE_LABEL_W - 0.12, h: rowH - 0.06 }, { fontSize: TYPE.caption, bold: true, color: COLOURS.ink });
    const x0 = xAt(rg.start);
    const x1 = xAt(rg.end);
    const barW = Math.max(0.04, x1 - x0);
    slide.addShape(S.rect, { x: x0, y: barY, w: barW, h: barH, fill: { color: t.soft }, line: { color: t.mark, width: 1 } });
    if (rg.completion > 0) slide.addShape(S.rect, { x: x0, y: barY, w: Math.max(0.02, barW * rg.completion), h: barH, fill: { color: t.mark }, line: { type: 'none' } });
    let noteX = x1;
    if (rg.projectedEnd !== undefined) {
      const px = xAt(rg.projectedEnd);
      slide.addShape(S.rect, { x: x1, y: barY + 0.03, w: Math.max(0.03, px - x1), h: barH - 0.06, fill: { color: COLOURS.amberSoft }, line: { color: COLOURS.amber, width: 1, dashType: 'dash' } });
      noteX = px;
    }
    if (rg.earlyEnd !== undefined) {
      slide.addShape(S.line, { x: xAt(rg.earlyEnd), y: barY - 0.04, w: 0, h: barH + 0.08, line: { color: COLOURS.green, width: 2 } });
    }
    // Milestones: diamonds on the bar line; labels share the line below without overlapping.
    const labelY = barY + barH + 0.03;
    const labelH = Math.max(0.2, rowH - (labelY - y) - 0.02);
    const right = rect.x + rect.w;
    const noteOnBar = Boolean(rg.row.note) && right - noteX - 0.12 >= 1.6;
    const labels: { anchor: number; text: string; runs: Run[]; align?: 'right' }[] = [];
    for (const ms of rg.milestones) {
      const mx = xAt(ms.at);
      const mt = ms.tone && isStatusTone(ms.tone) ? TONES[ms.tone] : undefined;
      slide.addShape(S.diamond, {
        x: mx - 0.1,
        y: barY + barH / 2 - 0.1,
        w: 0.2,
        h: 0.2,
        fill: { color: mt ? mt.mark : ms.regulatory ? COLOURS.navy : COLOURS.paper },
        line: { color: COLOURS.navy, width: 1 },
      });
      const label = mt ? withGlyph(ms.label, ms.tone) : ms.label;
      const runs: Run[] = [];
      if (ms.regulatory) runs.push({ text: `${RENDER_TEXT.regulatory} `, options: { bold: true, color: COLOURS.redFg } });
      runs.push({ text: label, options: { color: mt ? mt.fg : COLOURS.body } });
      labels.push({ anchor: mx - 0.1, text: `${ms.regulatory ? `${RENDER_TEXT.regulatory} ` : ''}${label}`, runs });
    }
    if (rg.row.note && noteOnBar) {
      addText(slide, rg.row.note, { x: noteX + 0.1, y: barY - 0.03, w: right - noteX - 0.12, h: barH + 0.06 }, { fontSize: TYPE.table, bold: true, color: COLOURS.amberFg, valign: 'middle' });
    } else if (rg.row.note) {
      labels.push({ anchor: noteX - 0.1, text: rg.row.note, runs: [{ text: rg.row.note, options: { bold: true, color: COLOURS.amberFg } }] });
    }
    const lines = Math.max(1, Math.floor(labelH / TIMELINE_LABEL_LINE_H));
    const spots = placeRowLabels(labels, plotX, right, Math.min(2, lines));
    labels.forEach((l, li) => {
      const spot = spots[li];
      if (!spot) return ctx.warn(`${ctx.slideId}: timeline label "${l.text}" has no room in row "${rg.row.label}" and was left out`);
      addText(slide, l.runs, { x: spot.x, y: labelY + spot.line * TIMELINE_LABEL_LINE_H, w: spot.w, h: TIMELINE_LABEL_LINE_H }, { fontSize: TYPE.table, valign: 'middle' });
    });
  });

  if (g.today !== null) {
    const tx = xAt(g.today);
    slide.addShape(S.line, { x: tx, y: top - 0.05, w: 0, h: bottom - top + 0.1, line: { color: COLOURS.accent, width: 1.5, dashType: 'dash' } });
    addText(slide, RENDER_TEXT.today, { x: tx - 0.6, y: bottom + 0.04, w: 1.2, h: todayLabelH - 0.04 }, { fontSize: TYPE.table, bold: true, color: COLOURS.heading, align: 'center' });
  }
}

// ---------------------------------------------------------------------------
// text, bullets, callout, document
// ---------------------------------------------------------------------------

function drawText(_ctx: DrawContext, slide: Slide, b: BlockOf<'text'>, rect: Rect) {
  if (b.emphasis === 'statement') addText(slide, b.text, rect, { fontFace: FONTS.heading, fontSize: TYPE.statement, bold: true, color: COLOURS.ink });
  else if (b.emphasis === 'body') addText(slide, b.text, rect, { fontSize: TYPE.body, color: COLOURS.body });
  else addText(slide, b.text, rect, { fontSize: TYPE.caption, color: COLOURS.muted });
}

function drawBullets(_ctx: DrawContext, slide: Slide, b: BlockOf<'bullets'>, rect: Rect) {
  // Status items use their shape glyph as the bullet character, so the shape shows even in greyscale.
  const runs: Run[] = b.items.map((item, i) => {
    const tone = item.tone && isStatusTone(item.tone) ? TONES[item.tone] : undefined;
    const code = tone ? tone.glyph.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0') : undefined;
    return {
      text: item.text,
      options: {
        bullet: code ? { characterCode: code, indent: 18 } : { indent: 18 },
        color: tone ? tone.fg : COLOURS.body,
        breakLine: i < b.items.length - 1,
        paraSpaceAfter: 6,
      },
    };
  });
  addText(slide, runs, rect, { fontSize: TYPE.bullet });
}

function drawCallout(ctx: DrawContext, slide: Slide, b: BlockOf<'callout'>, rect: Rect) {
  const t = TONES[b.tone];
  slide.addShape(ctx.pptx.ShapeType.rect, { ...rect, fill: { color: t.soft }, line: { color: t.line, width: 0.75 } });
  slide.addShape(ctx.pptx.ShapeType.rect, { x: rect.x, y: rect.y, w: 0.08, h: rect.h, fill: { color: t.mark }, line: { type: 'none' } });
  const runs: Run[] = [];
  if (b.title) runs.push({ text: withGlyph(b.title, b.tone), options: { bold: true, color: t.fg, breakLine: true } });
  runs.push({ text: b.text, options: { color: COLOURS.body } });
  addText(slide, runs, { x: rect.x + 0.25, y: rect.y + 0.14, w: rect.w - 0.4, h: rect.h - 0.24 }, { fontSize: TYPE.body, paraSpaceAfter: 4 });
}

function documentRuns(sections: BlockOf<'document'>['sections']): Run[] {
  const runs: Run[] = [];
  sections.forEach((section, si) => {
    runs.push({ text: section.heading, options: { bold: true, fontSize: TYPE.documentHeading, color: COLOURS.heading, breakLine: true, paraSpaceBefore: si === 0 ? 0 : 8 } });
    section.sentences.forEach((s, i) => {
      const last = i === section.sentences.length - 1;
      runs.push({ text: `${s.text}${s.cites.length ? '' : ' '}`, options: { color: COLOURS.body } });
      if (s.cites.length) {
        runs.push({ text: s.cites.map((n) => `[${n}]`).join(''), options: { superscript: true, color: COLOURS.heading } });
        if (!last) runs.push({ text: ' ', options: {} });
      }
      if (last) runs[runs.length - 1]!.options = { ...runs[runs.length - 1]!.options, breakLine: si < sections.length - 1 };
    });
  });
  return runs;
}

function drawDocument(ctx: DrawContext, slide: Slide, b: BlockOf<'document'>, rect: Rect) {
  slide.addText(b.label, {
    ...textOpts({ x: rect.x, y: rect.y, w: Math.min(rect.w, 0.4 + b.label.length * 0.078), h: 0.32 }),
    shape: ctx.pptx.ShapeType.roundRect,
    rectRadius: 0.06,
    fill: { color: COLOURS.scriptedSoft },
    line: { color: COLOURS.scripted, width: 0.75 },
    fontSize: TYPE.caption,
    bold: true,
    color: COLOURS.scripted,
    valign: 'middle',
    margin: [8, 8, 0, 0],
  });
  const body = { x: rect.x, y: rect.y + 0.45, w: rect.w, h: rect.h - 0.45 };
  // Long drafts flow into two columns, split between sections, rather than past the region.
  const text = b.sections.map((s) => `${s.heading}\n${s.sentences.map((x) => x.text).join(' ')}`).join('\n');
  const lineH = (TYPE.documentBody * 1.25) / 72;
  const oneColumnLines = estimateLines(text, body.w, TYPE.documentBody) + b.sections.length * 0.6;
  if (oneColumnLines * lineH <= body.h || b.sections.length < 2) {
    addText(slide, documentRuns(b.sections), body, { fontSize: TYPE.documentBody });
    if (oneColumnLines * lineH > body.h) ctx.warn(`${ctx.slideId}: document text may exceed its region`);
    return;
  }
  const half = (body.w - 0.4) / 2;
  const sizes = b.sections.map((s) => s.heading.length + s.sentences.reduce((n, x) => n + x.text.length, 0));
  const totalSize = sizes.reduce((a, n) => a + n, 0);
  let acc = 0;
  let split = 1;
  for (let i = 0; i < sizes.length - 1; i++) {
    acc += sizes[i]!;
    split = i + 1;
    if (acc >= totalSize / 2) break;
  }
  addText(slide, documentRuns(b.sections.slice(0, split)), { ...body, w: half }, { fontSize: TYPE.documentBody });
  addText(slide, documentRuns(b.sections.slice(split)), { ...body, x: body.x + half + 0.4, w: half }, { fontSize: TYPE.documentBody });
}

// ---------------------------------------------------------------------------

export function drawBlock(ctx: DrawContext, slide: Slide, block: Block, rect: Rect): void {
  switch (block.type) {
    case 'kpis':
      return drawKpis(ctx, slide, block, rect);
    case 'rag-pair':
      return drawRagPair(ctx, slide, block, rect);
    case 'measures':
      return drawMeasures(ctx, slide, block, rect);
    case 'table':
      return drawTable(ctx, slide, block, rect);
    case 'bar':
    case 'stacked-bar':
      return drawChart(ctx, slide, block, rect);
    case 'stage-rail':
      return drawStageRail(ctx, slide, block, rect);
    case 'timeline':
      return drawTimeline(ctx, slide, block, rect);
    case 'bullets':
      return drawBullets(ctx, slide, block, rect);
    case 'text':
      return drawText(ctx, slide, block, rect);
    case 'callout':
      return drawCallout(ctx, slide, block, rect);
    case 'document':
      return drawDocument(ctx, slide, block, rect);
  }
}
