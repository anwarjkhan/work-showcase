'use client';
/**
 * HTML preview of slides: the same SlideSpec and the same region placement as
 * the PowerPoint renderer, drawn with the slide's own light palette (theme.ts)
 * so the preview is a faithful picture of the slide in either app theme.
 *
 * The slide keeps a fixed 16:9 box scaled to its container's width; text sizes
 * use container-width units, so nothing is measured in script and nothing can
 * push the page wider than its column.
 */
import { Maximize2 } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { DeckSpec, FooterSpec, SlideSpec } from '@/lib/slides/types';
import { HtmlBlock, pt } from './html-blocks';
import { placeBlocks } from './layout';
import { BANDS, COLOURS, COVER, FONTS, SLIDE_H, SLIDE_W, TYPE, css, titleSize, type Rect } from './theme';

const box = (r: Rect): CSSProperties => ({
  position: 'absolute',
  left: `${(r.x / SLIDE_W) * 100}%`,
  top: `${(r.y / SLIDE_H) * 100}%`,
  width: `${(r.w / SLIDE_W) * 100}%`,
  height: `${(r.h / SLIDE_H) * 100}%`,
});

export interface SlidePreviewProps {
  spec: SlideSpec;
  footer: FooterSpec;
  /** 1-based slide number shown in the footer, as in the exported file. */
  number?: number;
  /** Fixed width as a multiple of 960 px (1 pt = 1 px at scale 1). Omit to fill the container's width. */
  scale?: number;
  className?: string;
}

/** Visible slide title for assistive technology: the slide number and title. */
export const slideLabel = (spec: SlideSpec, number?: number): string => (number ? `Slide ${number}: ${spec.title}` : `Slide: ${spec.title}`);

export function SlidePreview({ spec, footer, number, scale, className }: SlidePreviewProps) {
  const { boxes } = placeBlocks(spec);
  const cover = spec.layout === 'cover';
  return (
    <div className={className} style={{ width: scale ? `${960 * scale}px` : '100%', maxWidth: '100%', minWidth: 0 }}>
      <div
        role="group"
        aria-roledescription="slide"
        aria-label={slideLabel(spec, number)}
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: `${SLIDE_W} / ${SLIDE_H}`,
          containerType: 'inline-size',
          overflow: 'hidden',
          background: css(COLOURS.paper),
          color: css(COLOURS.body),
          fontFamily: FONTS.body,
          lineHeight: 1.2,
          textAlign: 'left',
        }}
      >
        {cover ? (
          <>
            <div aria-hidden style={{ ...box(COVER.bar), background: css(COLOURS.navy) }} />
            <div style={{ ...box(COVER.title), margin: 0, display: 'flex', alignItems: 'flex-end', fontFamily: FONTS.heading, fontSize: pt(TYPE.coverTitle), fontWeight: 700, color: css(COLOURS.ink) }}>{spec.title}</div>
            {spec.subtitle ? <p style={{ ...box(COVER.subtitle), margin: 0, fontSize: pt(TYPE.coverSubtitle), color: css(COLOURS.muted) }}>{spec.subtitle}</p> : null}
          </>
        ) : (
          <>
            <div style={{ ...box(BANDS.title), margin: 0, display: 'flex', alignItems: 'flex-end', fontFamily: FONTS.heading, fontSize: pt(titleSize(spec.title)), fontWeight: 700, color: css(COLOURS.ink), lineHeight: 1.1, overflow: 'hidden' }}>{spec.title}</div>
            {spec.subtitle ? <p style={{ ...box(BANDS.subtitle), margin: 0, display: 'flex', alignItems: 'center', fontSize: pt(TYPE.subtitle), color: css(COLOURS.muted) }}>{spec.subtitle}</p> : null}
            <div aria-hidden style={{ ...box({ ...BANDS.rule, h: 0 }), borderTop: `1px solid ${css(COLOURS.line)}` }} />
            <div aria-hidden style={{ ...box({ x: BANDS.rule.x, y: BANDS.rule.y - 0.025, w: 0.9, h: 0.05 }), background: css(COLOURS.accent) }} />
          </>
        )}

        {boxes.map((b, i) => (
          <div key={i} style={{ ...box(b.rect), overflow: 'hidden' }}>
            <HtmlBlock block={b.block} rect={b.rect} />
          </div>
        ))}

        <div aria-hidden style={{ ...box({ ...BANDS.footerRule, h: 0 }), borderTop: `1px solid ${css(COLOURS.line)}` }} />
        <p style={{ ...box(BANDS.footerText), margin: 0, display: 'flex', alignItems: 'center', fontSize: pt(TYPE.footer), color: css(COLOURS.muted) }}>{footer.text}</p>
        {number ? (
          <p style={{ ...box(BANDS.slideNumber), margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontSize: pt(TYPE.footer), color: css(COLOURS.muted) }}>{number}</p>
        ) : null}
      </div>
    </div>
  );
}

export interface DeckPreviewGridProps {
  deck: DeckSpec;
  /** Minimum thumbnail width in px. */
  minThumbWidth?: number;
  /** Makes each thumbnail a button that opens that slide (0-based index), e.g. in a full-size viewer. */
  onOpen?: (index: number) => void;
}

const THUMB = 'overflow-hidden rounded-md border border-line shadow-card';

/** "Enlarge" badge shown over a clickable thumbnail on hover or keyboard focus (parent needs `group relative`). */
export function EnlargeBadge() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute top-1.5 right-1.5 inline-flex items-center gap-1 rounded-pill bg-surface/95 px-2 py-0.5 text-[11px] font-medium text-accent opacity-0 shadow-card transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
    >
      <Maximize2 className="size-3" />
      Enlarge
    </span>
  );
}

/** Thumbnails of every slide in a deck, in order, numbered as in the exported file. */
export function DeckPreviewGrid({ deck, minThumbWidth = 240, onOpen }: DeckPreviewGridProps) {
  return (
    <ol
      aria-label={`${deck.title}: ${deck.slides.length} slides`}
      className="grid min-w-0 list-none gap-4 p-0"
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(${minThumbWidth}px, 100%), 1fr))` }}
    >
      {deck.slides.map((spec, i) => (
        <li key={spec.id} className="min-w-0">
          {onOpen ? (
            <button
              type="button"
              data-testid="slide-thumb"
              aria-label={`View ${slideLabel(spec, i + 1)}`}
              onClick={() => onOpen(i)}
              className="group relative block w-full cursor-zoom-in rounded-md text-left transition-shadow duration-150 hover:shadow-raised focus-visible:outline-none focus-visible:shadow-focus"
            >
              <SlidePreview spec={spec} footer={deck.footer} number={i + 1} className={THUMB} />
              <EnlargeBadge />
            </button>
          ) : (
            <SlidePreview spec={spec} footer={deck.footer} number={i + 1} className={THUMB} />
          )}
          <p className="mt-1 truncate text-xs text-fg-muted">{`${i + 1}. ${spec.title}`}</p>
        </li>
      ))}
    </ol>
  );
}
