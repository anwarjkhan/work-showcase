'use client';
import { Check, Maximize2, Presentation } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { IconButton, type ButtonSize } from '@/components/ui';
import { buildSlides, CATALOGUE, footerText, scopeKey } from '@/lib/slides';
import type { SlideKind, SlideScope, SlideSpec } from '@/lib/slides';
import { SlidePreview } from '@/lib/slides/render/html';
import { addToBasket, itemId, useBasket } from './basket';
import { SlideViewer } from './SlideViewer';
import { useSlideContext } from './useSlideContext';

export interface AddToSlidesProps {
  kind: SlideKind;
  scope: SlideScope;
  /** What the button names for assistive technology; defaults to the catalogue title of the slide. */
  label?: string;
  size?: ButtonSize;
  /** Use -1 inside tree rows, whose own arrow-key handling owns focus. */
  tabIndex?: number;
}

/** Hover delay before the preview appears (focus shows it at once). */
const HOVER_DELAY = 350;
/** Grace period after the pointer leaves, so it can travel from the button onto the preview. */
const LEAVE_DELAY = 200;
const CARD_W = 420;
/** Card height: a 16:9 slide plus the caption. */
const CARD_H = (CARD_W * 9) / 16 + 56;
const GAP = 8;
/** Extra clearance when the card sits above the button, where the button's own label tooltip shows. */
const TOOLTIP_CLEARANCE = 40;

const noop = () => () => {};

/**
 * Small icon button that adds one slide to the basket and announces
 * "Added to slides (n)". Shows a check once that slide is already in the basket.
 * Hovering or focusing it shows a preview of the slide it adds; clicking the
 * preview opens it full size.
 *
 *   <AddToSlides kind="td-verdict" scope={{ kind: 'deliverable', deliverableId }} />
 */
export function AddToSlides({ kind, scope, label, size = 'sm', tabIndex }: AddToSlidesProps) {
  const { items } = useBasket();
  const added = items.some((i) => i.id === itemId(kind, scope));
  const name = label ?? `the ${CATALOGUE[kind].title} slide`;
  const wrap = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [viewing, setViewing] = useState<{ slides: SlideSpec[]; footer: string; index: number } | null>(null);

  const show = (wait: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const r = wrap.current?.getBoundingClientRect();
      if (r) setAnchor(r);
    }, wait);
  };
  const hide = (wait = 0) => {
    window.clearTimeout(timer.current);
    if (wait) timer.current = window.setTimeout(() => setAnchor(null), wait);
    else setAnchor(null);
  };
  const keep = () => window.clearTimeout(timer.current);

  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (!anchor) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setAnchor(null);
    const onScroll = () => setAnchor(null);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [anchor]);

  return (
    <span ref={wrap} className="inline-flex" onMouseEnter={() => show(HOVER_DELAY)} onMouseLeave={() => hide(LEAVE_DELAY)} onFocus={() => show(0)} onBlur={() => hide()}>
      <IconButton
        label={added ? `In slides: ${name}` : `Add ${name} to slides`}
        icon={added ? <Check className="text-status-green" /> : <Presentation />}
        variant="secondary"
        size={size}
        tabIndex={tabIndex}
        data-testid="add-to-slides"
        data-slide-kind={kind}
        data-slide-scope={scopeKey(scope)}
        data-added={added || undefined}
        onClick={(e) => {
          e.stopPropagation();
          addToBasket(kind, scope);
        }}
      />
      {anchor && !viewing ? (
        <SlideHoverCard
          kind={kind}
          scope={scope}
          anchor={anchor}
          added={added}
          onEnter={keep}
          onLeave={() => hide(LEAVE_DELAY)}
          onExpand={(slides, footer) => {
            hide();
            setViewing({ slides, footer, index: 0 });
          }}
        />
      ) : null}
      {viewing ? (
        <SlideViewer
          deck={{ slides: viewing.slides, footer: { text: viewing.footer } }}
          index={viewing.index}
          onIndex={(index) => setViewing(index === null ? null : { ...viewing, index })}
        />
      ) : null}
    </span>
  );
}

interface SlideHoverCardProps {
  kind: SlideKind;
  scope: SlideScope;
  anchor: DOMRect;
  added: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onExpand: (slides: SlideSpec[], footer: string) => void;
}

/**
 * The floating preview: built only while shown, positioned in a portal so rows and cards never clip it.
 * Clicking it opens the full-size viewer. It is a mouse convenience (hidden from assistive technology);
 * keyboard users get the same full-size view from the slide builder and the Slides drawer.
 */
function SlideHoverCard({ kind, scope, anchor, added, onEnter, onLeave, onExpand }: SlideHoverCardProps) {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const ctx = useSlideContext();
  const built = useMemo(() => {
    try {
      return { specs: buildSlides(scope, [kind], ctx) };
    } catch (e) {
      return { specs: [] as SlideSpec[], error: e instanceof Error ? e.message : 'This slide could not be built.' };
    }
  }, [kind, scope, ctx]);
  if (!mounted) return null;

  const below = window.innerHeight - anchor.bottom >= CARD_H + GAP || anchor.top < CARD_H + GAP + TOOLTIP_CLEARANCE;
  const left = Math.min(Math.max(anchor.left + anchor.width / 2 - CARD_W / 2, GAP), Math.max(GAP, window.innerWidth - CARD_W - GAP));
  const first = built.specs[0];
  const more = built.specs.length - 1;
  const footer = footerText(ctx);

  return createPortal(
    <div
      aria-hidden
      data-testid="slide-hover-preview"
      data-slide-kind={kind}
      title={first ? 'Click to view full size' : undefined}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      // Keep focus on the add button (its blur would close the card before the click lands).
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        // The card is a portal of the button's wrapper: stop the click reaching row or card handlers.
        e.stopPropagation();
        if (first) onExpand(built.specs, footer);
      }}
      className={`group fixed z-[80] rounded-lg border border-line-strong bg-surface p-2 shadow-overlay ${first ? 'cursor-zoom-in hover:border-accent-line' : ''}`}
      style={{ width: CARD_W, left, ...(below ? { top: anchor.bottom + GAP } : { bottom: window.innerHeight - anchor.top + GAP + TOOLTIP_CLEARANCE }) }}
    >
      {first ? (
        <div className="relative">
          <SlidePreview spec={first} footer={{ text: footer }} className="overflow-hidden rounded-sm border border-line" />
          <span className="absolute top-1.5 right-1.5 inline-flex items-center gap-1 rounded-pill bg-surface/95 px-2 py-0.5 text-[11px] font-medium text-fg-muted shadow-card group-hover:text-accent">
            <Maximize2 aria-hidden className="size-3" />
            Enlarge
          </span>
        </div>
      ) : (
        <div className="grid aspect-video place-items-center rounded-sm border border-line px-4 text-center text-xs text-fg-muted">{built.error ?? 'No preview'}</div>
      )}
      <div className="mt-2 flex items-baseline justify-between gap-2 px-1 text-xs">
        <span className="truncate font-medium text-fg">{CATALOGUE[kind].title}</span>
        <span className="shrink-0 text-fg-muted">
          {[more > 0 ? `+${more} more ${more === 1 ? 'slide' : 'slides'}` : null, added ? 'In slides' : 'Button adds it'].filter(Boolean).join(' · ')}
        </span>
      </div>
    </div>,
    document.body,
  );
}
