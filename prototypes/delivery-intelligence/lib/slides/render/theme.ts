/**
 * Slide theme: page size, colours, fonts, type sizes, layout regions and
 * status glyphs shared by the PowerPoint renderer (pptx.ts) and the HTML
 * preview (html.tsx), so both draw the same picture.
 *
 * Colours mirror the LIGHT theme in app/theme.css as hex (PowerPoint has no
 * CSS variables). theme.test.ts fails if the two drift apart. A slide is
 * always light, whatever theme the app is in: it is a picture of the slide.
 *
 * All geometry is in inches on a 13.333 x 7.5 in (16:9) page.
 */
import type { LayoutId, RegionId, Tone } from '@/lib/slides/types';
import { terms } from '@/lib/config/terminology';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export const SLIDE_W = 13.333;
export const SLIDE_H = 7.5;
export const LAYOUT_NAME = 'DI_16x9';
export const MASTER_NAME = 'DI_MASTER';

/** Left/right page margin. */
export const MARGIN_X = 0.5;
const CONTENT_W = SLIDE_W - 2 * MARGIN_X;

// ---------------------------------------------------------------------------
// Colours (hex without '#', as PptxGenJS wants). `cssVar` names the source token.
// ---------------------------------------------------------------------------

interface ColourToken {
  hex: string;
  cssVar: string;
}

const c = (hex: string, cssVar: string): ColourToken => ({ hex, cssVar });

/** Every colour the slides use, keyed by role, with the app token it copies. */
export const COLOUR_TOKENS = {
  ink: c('0A1B3D', '--di-title'),
  body: c('0B1A33', '--di-fg'),
  muted: c('46577A', '--di-fg-muted'),
  subtle: c('7A889F', '--di-fg-subtle'),
  paper: c('FFFFFF', '--di-surface'),
  card: c('F8FAFD', '--di-surface-2'),
  inset: c('EEF2F8', '--di-inset'),
  line: c('E0E6EF', '--di-line'),
  lineStrong: c('C9D3E1', '--di-line-strong'),
  heading: c('1450D8', '--di-heading'),
  accent: c('1A5CFF', '--di-accent'),
  accentStrong: c('0F47D6', '--di-accent-strong'),
  navy: c('0A1730', '--di-nav-bg'),
  red: c('D1343D', '--di-status-red'),
  redSoft: c('FDEEEE', '--di-status-red-soft'),
  redFg: c('9F1D26', '--di-status-red-fg'),
  redLine: c('F3C2C5', '--di-status-red-line'),
  amber: c('E09A0B', '--di-status-amber'),
  amberSoft: c('FDF5E3', '--di-status-amber-soft'),
  amberFg: c('8A5600', '--di-status-amber-fg'),
  amberLine: c('F1D79C', '--di-status-amber-line'),
  green: c('13875F', '--di-status-green'),
  greenSoft: c('E8F6EF', '--di-status-green-soft'),
  greenFg: c('0B6446', '--di-status-green-fg'),
  greenLine: c('B6E2CD', '--di-status-green-line'),
  unknown: c('74819A', '--di-status-unknown'),
  unknownSoft: c('EEF1F5', '--di-status-unknown-soft'),
  unknownFg: c('4A5568', '--di-status-unknown-fg'),
  unknownLine: c('D3D9E3', '--di-status-unknown-line'),
  scripted: c('6A4CE0', '--di-prov-scripted'),
  scriptedSoft: c('F0ECFD', '--di-prov-scripted-soft'),
  chart1: c('1A5CFF', '--di-chart-1'),
  chart2: c('0B7A85', '--di-chart-2'),
  chart3: c('6A4CE0', '--di-chart-3'),
  chart4: c('3AA0FF', '--di-chart-4'),
  chart5: c('2F4670', '--di-chart-5'),
  chart6: c('9AA8C0', '--di-chart-6'),
  grid: c('E8EDF4', '--di-chart-grid'),
  axis: c('8A97AD', '--di-chart-axis'),
} as const satisfies Record<string, ColourToken>;

export type ColourRole = keyof typeof COLOUR_TOKENS;

/** Hex values by role, e.g. COLOURS.ink === '0A1B3D'. */
export const COLOURS = Object.fromEntries(
  Object.entries(COLOUR_TOKENS).map(([role, token]) => [role, token.hex]),
) as Record<ColourRole, string>;

/** CSS form of a hex colour, for the HTML preview. */
export const css = (hex: string): string => `#${hex}`;

/** Categorical chart series colours, in order. */
export const CHART_PALETTE = [COLOURS.chart1, COLOURS.chart2, COLOURS.chart3, COLOURS.chart4, COLOURS.chart5, COLOURS.chart6];

// ---------------------------------------------------------------------------
// Tones: colour, soft fill, text colour, glyph and word
// ---------------------------------------------------------------------------

export interface ToneStyle {
  /** Base colour for marks (bars, strips, diamonds). */
  mark: string;
  /** Soft fill behind text. */
  soft: string;
  /** Text colour on the soft fill (and on paper). */
  fg: string;
  /** Border colour for chips. */
  line: string;
  /** Shape glyph drawn before the word so status never relies on colour alone ('' for non-status tones). */
  glyph: string;
  /** The status word from terms ('' for non-status tones). */
  word: string;
}

/**
 * Glyphs are from the WGL4 set, which Arial and its metric-compatible
 * substitute (Liberation Sans, used by LibreOffice) both contain.
 */
export const STATUS_GLYPHS = { green: '●', amber: '▲', red: '■', unknown: '?' } as const;

export const TONES: Record<Tone, ToneStyle> = {
  red: { mark: COLOURS.red, soft: COLOURS.redSoft, fg: COLOURS.redFg, line: COLOURS.redLine, glyph: STATUS_GLYPHS.red, word: terms.rag.red },
  amber: { mark: COLOURS.amber, soft: COLOURS.amberSoft, fg: COLOURS.amberFg, line: COLOURS.amberLine, glyph: STATUS_GLYPHS.amber, word: terms.rag.amber },
  green: { mark: COLOURS.green, soft: COLOURS.greenSoft, fg: COLOURS.greenFg, line: COLOURS.greenLine, glyph: STATUS_GLYPHS.green, word: terms.rag.green },
  unknown: { mark: COLOURS.unknown, soft: COLOURS.unknownSoft, fg: COLOURS.unknownFg, line: COLOURS.unknownLine, glyph: STATUS_GLYPHS.unknown, word: terms.rag.unknown },
  neutral: { mark: COLOURS.chart6, soft: COLOURS.card, fg: COLOURS.body, line: COLOURS.line, glyph: '', word: '' },
  accent: { mark: COLOURS.accent, soft: COLOURS.inset, fg: COLOURS.heading, line: COLOURS.lineStrong, glyph: '', word: '' },
};

/** True for the four semantic statuses (which always carry a glyph and word). */
export const isStatusTone = (tone: Tone | undefined): tone is 'red' | 'amber' | 'green' | 'unknown' =>
  tone === 'red' || tone === 'amber' || tone === 'green' || tone === 'unknown';

/**
 * Text for a toned value: the glyph, then the given text. When the text does not
 * already contain the status word (e.g. a KPI value "3"), callers show the word
 * separately via `toneLabel`.
 */
export function withGlyph(text: string, tone: Tone | undefined): string {
  if (!tone || !isStatusTone(tone)) return text;
  return `${TONES[tone].glyph} ${text}`;
}

/** "▲ Amber" for a status tone, '' otherwise. */
export function toneLabel(tone: Tone | undefined): string {
  if (!tone || !isStatusTone(tone)) return '';
  return `${TONES[tone].glyph} ${TONES[tone].word}`;
}

// ---------------------------------------------------------------------------
// Fonts and type sizes (points). Change fonts here only.
// ---------------------------------------------------------------------------

export const FONTS = {
  heading: 'Arial',
  body: 'Arial',
} as const;

/** Plan section 6: titles 24 to 28 pt, body at least 12 pt, tables at least 11 pt. */
export const TYPE = {
  coverTitle: 36,
  coverSubtitle: 18,
  title: 26,
  titleLong: 24,
  subtitle: 14,
  statement: 28,
  body: 14,
  bullet: 14,
  caption: 12,
  label: 12,
  kpiValue: 26,
  measureValueLong: 18,
  table: 11,
  chartLabel: 12,
  chartDataLabel: 11,
  documentHeading: 16,
  documentBody: 14,
  footer: 10,
} as const;

/** Rough width in inches of a line of bold Arial text. */
export const textWidth = (text: string, points: number): number => (text.length * 0.56 * points) / 72;

/** Largest tile value size (26, 18 or 14 pt) at which `value` fits on one line of `width` inches. */
export function tileValueSize(value: string, width: number): number {
  for (const size of [TYPE.kpiValue, TYPE.measureValueLong, 14]) if (textWidth(value, size) <= width) return size;
  return 14;
}

/** Title size: 26 pt when the title fits on one line, else 24 pt (which may wrap to a second line, upwards). */
export const titleSize = (title: string): number => (textWidth(title, TYPE.title) * 0.92 <= CONTENT_W ? TYPE.title : TYPE.titleLong);

/** Whether a tile's status ("▲ Amber") fits beside its label; otherwise it moves to the caption line. */
export const statusBesideLabel = (label: string, status: string, width: number): boolean => textWidth(label, TYPE.label) * 0.9 + textWidth(status, TYPE.label) + 0.15 <= width;

// ---------------------------------------------------------------------------
// Bands and regions (inches)
// ---------------------------------------------------------------------------

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Title and subtitle band on every non-cover slide. */
export const BANDS = {
  /** Bottom-aligned; tall enough for two lines at 24 pt when a 70-character title will not fit on one. */
  title: { x: MARGIN_X, y: 0.12, w: CONTENT_W, h: 0.86 },
  subtitle: { x: MARGIN_X, y: 0.98, w: CONTENT_W, h: 0.36 },
  /** Thin accent rule under the title band. */
  rule: { x: MARGIN_X, y: 1.4, w: CONTENT_W, h: 0 },
  /** Footer band: provenance text left, logo slot, slide number right. */
  footer: { x: MARGIN_X, y: 6.98, w: CONTENT_W, h: 0.32 },
  footerText: { x: MARGIN_X, y: 6.98, w: 9.2, h: 0.32 },
  /** Empty slot for a brand logo, to be filled inside the firm. Nothing is drawn. */
  logo: { x: 10.0, y: 6.93, w: 1.6, h: 0.42 },
  slideNumber: { x: SLIDE_W - MARGIN_X - 0.8, y: 6.98, w: 0.8, h: 0.32 },
  /** Hairline above the footer. */
  footerRule: { x: MARGIN_X, y: 6.9, w: CONTENT_W, h: 0 },
} as const satisfies Record<string, Rect>;

/** Cover slide's own title area (the cover does not use the title band). */
export const COVER = {
  bar: { x: MARGIN_X, y: 1.7, w: 0.12, h: 2.3 },
  title: { x: 0.85, y: 1.7, w: 11.5, h: 1.5 },
  subtitle: { x: 0.85, y: 3.25, w: 11.5, h: 0.75 },
} as const satisfies Record<string, Rect>;

const TOP = 1.6;
const BOTTOM = 6.75;
const FULL_H = BOTTOM - TOP;
const GAP = 0.3;
const HALF_W = (CONTENT_W - GAP) / 2;

/** Regions per layout, exactly as documented on LayoutId in lib/slides/types.ts. */
export const LAYOUT_REGIONS: Record<LayoutId, Partial<Record<RegionId, Rect>>> = {
  cover: { main: { x: 0.85, y: 4.35, w: 11.5, h: 2.3 } },
  statement: { main: { x: 1.2, y: 1.9, w: SLIDE_W - 2.4, h: 4.6 } },
  'title-only': { main: { x: MARGIN_X, y: TOP, w: CONTENT_W, h: FULL_H } },
  'kpis-over-table': {
    top: { x: MARGIN_X, y: TOP, w: CONTENT_W, h: 1.35 },
    main: { x: MARGIN_X, y: TOP + 1.35 + 0.2, w: CONTENT_W, h: FULL_H - 1.35 - 0.2 },
  },
  'two-column': {
    left: { x: MARGIN_X, y: TOP, w: HALF_W, h: FULL_H },
    right: { x: MARGIN_X + HALF_W + GAP, y: TOP, w: HALF_W, h: FULL_H },
  },
  table: { main: { x: MARGIN_X, y: TOP, w: CONTENT_W, h: FULL_H } },
  'chart-and-table': {
    left: { x: MARGIN_X, y: TOP, w: 5.6, h: FULL_H },
    right: { x: MARGIN_X + 5.6 + GAP, y: TOP, w: CONTENT_W - 5.6 - GAP, h: FULL_H },
  },
  rail: {
    top: { x: MARGIN_X, y: TOP, w: CONTENT_W, h: 1.75 },
    main: { x: MARGIN_X, y: TOP + 1.75 + 0.2, w: CONTENT_W, h: FULL_H - 1.75 - 0.2 },
  },
  timeline: {
    top: { x: MARGIN_X, y: TOP, w: CONTENT_W, h: 1.2 },
    main: { x: MARGIN_X, y: TOP + 1.2 + 0.2, w: CONTENT_W, h: FULL_H - 1.2 - 0.2 },
  },
  document: { main: { x: MARGIN_X, y: TOP, w: CONTENT_W, h: FULL_H } },
};

/** Gap between blocks stacked in one region. */
export const STACK_GAP = 0.2;

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

/** Composer limit (plan section 6): header plus 10 body rows per slide. */
export const MAX_TABLE_BODY_ROWS = 10;
export const TABLE_ROW_MAX_H = 0.42;
export const TABLE_ROW_MIN_H = 0.3;

/** Row height so header + rows fill at most `regionH`, within sensible bounds. */
export function tableRowHeight(regionH: number, totalRows: number): number {
  const fit = regionH / Math.max(1, totalRows);
  return Math.max(TABLE_ROW_MIN_H, Math.min(TABLE_ROW_MAX_H, Math.floor(fit * 100) / 100));
}

// ---------------------------------------------------------------------------
// Fixed wording the renderer draws itself (not status words: those come from terms)
// ---------------------------------------------------------------------------

export const RENDER_TEXT = {
  reported: terms.ragKinds.reported,
  evidence: terms.ragKinds.evidence,
  disagree: 'Reported status and the evidence disagree',
  agree: 'Reported status and the evidence agree',
  today: 'Today',
  regulatory: 'REG',
  stageDone: 'Done',
  stageCurrent: 'Current stage',
  stageNotStarted: 'Not started',
  movedBackFrom: 'Moved back from',
  noRows: 'No rows',
} as const;

export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
