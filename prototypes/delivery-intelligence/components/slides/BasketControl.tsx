'use client';
import { ArrowDown, ArrowUp, FileDown, LayoutGrid, Presentation, Trash2 } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useState } from 'react';
import { Button, Drawer, EmptyState, IconButton } from '@/components/ui';
import { cx, FOCUS_RING } from '@/components/ui/cx';
import { buildDeck, buildSlides, CATALOGUE, footerText, scopeLabel } from '@/lib/slides';
import type { SlideSpec } from '@/lib/slides';
import { EnlargeBadge, SlidePreview } from '@/lib/slides/render/html';
import { clearBasket, moveInBasket, removeFromBasket, setBasketName, useBasket, type BasketItem } from './basket';
import { ExportStatus } from './ExportStatus';
import { SlideViewer } from './SlideViewer';
import { useExport } from './useExport';
import { useSlideContext } from './useSlideContext';

const RESET_BUTTONS = '[data-testid="reset-demo"],[data-testid="demo-start-reset"]';

/** Reset demo clears the basket. Detected the way the guided demo does: a click on the shell's reset button. */
function useClearOnReset() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest(RESET_BUTTONS)) clearBasket();
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);
}

/** The visible toast plus a polite live region for "Added to slides (n)". */
function Announcer() {
  const { notice } = useBasket();
  const [hiddenSeq, setHiddenSeq] = useState(0);
  const seq = notice?.seq ?? 0;
  useEffect(() => {
    if (!seq) return;
    const t = window.setTimeout(() => setHiddenSeq(seq), 2600);
    return () => window.clearTimeout(t);
  }, [seq]);
  return (
    <>
      <div role="status" aria-live="polite" className="sr-only" data-testid="basket-live">
        {notice?.text ?? ''}
      </div>
      {notice && hiddenSeq !== seq ? (
        <div aria-hidden data-testid="basket-toast" className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-pill border border-line-strong bg-surface px-4 py-2 text-[13px] font-medium text-fg shadow-overlay">
          {notice.text}
        </div>
      ) : null}
    </>
  );
}

interface Built {
  item: BasketItem;
  specs: SlideSpec[];
  error?: string;
}

function BasketList({ built }: { built: Built[] }) {
  const ctx = useSlideContext();
  const footer = footerText(ctx);
  const [viewing, setViewing] = useState<number | null>(null);
  const all = built.flatMap((b) => b.specs);
  // Slide numbers as in the exported file: earlier items may span several slides.
  const starts = built.map((_, i) => 1 + built.slice(0, i).reduce((sum, b) => sum + b.specs.length, 0));
  return (
    <ol className="m-0 flex list-none flex-col gap-3 p-0" aria-label="Slides in the basket" data-testid="basket-list">
      {built.map((b, i) => {
        const first = b.specs[0];
        const number = starts[i] ?? 1;
        const title = first?.title ?? CATALOGUE[b.item.kind].title;
        return (
          <li key={b.item.id} data-testid="basket-item" data-kind={b.item.kind} className="di-card grid grid-cols-[minmax(0,220px)_minmax(0,1fr)] gap-3 p-3">
            {first ? (
              <button
                type="button"
                data-testid="basket-thumb"
                aria-label={`View slide ${number}: ${title}`}
                onClick={() => setViewing(number - 1)}
                className={cx('group relative block w-full cursor-zoom-in rounded-sm text-left transition-shadow duration-150 hover:shadow-raised', FOCUS_RING)}
              >
                <SlidePreview spec={first} footer={{ text: footer }} number={number} className="overflow-hidden rounded-sm border border-line" />
                <EnlargeBadge />
              </button>
            ) : <div className="grid aspect-video place-items-center rounded-sm border border-line text-xs text-fg-muted">No preview</div>}
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-[13px] leading-snug font-semibold text-title" data-testid="basket-item-title">{title}</p>
              <p className="truncate text-xs text-fg-muted">{CATALOGUE[b.item.kind].title}</p>
              {b.error ? <p className="text-xs text-status-red-fg" role="alert">{b.error}</p> : null}
              {b.specs.length > 1 ? <p className="text-xs text-fg-subtle">{`${b.specs.length} slides (long tables continue)`}</p> : null}
              <div className="mt-auto flex items-center gap-1.5 pt-1">
                <IconButton label={`Move up: ${title}`} icon={<ArrowUp />} size="sm" variant="secondary" disabledReason={i === 0 ? 'Already first' : undefined} onClick={() => moveInBasket(b.item.id, -1)} data-testid="basket-up" />
                <IconButton label={`Move down: ${title}`} icon={<ArrowDown />} size="sm" variant="secondary" disabledReason={i === built.length - 1 ? 'Already last' : undefined} onClick={() => moveInBasket(b.item.id, 1)} data-testid="basket-down" />
                <IconButton label={`Remove: ${title}`} icon={<Trash2 />} size="sm" variant="ghost" onClick={() => removeFromBasket(b.item.id)} data-testid="basket-remove" />
              </div>
            </div>
          </li>
        );
      })}
      <SlideViewer deck={{ slides: all, footer: { text: footer } }} index={viewing} onIndex={setViewing} />
    </ol>
  );
}

function BasketDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ctx = useSlideContext();
  const { items, name } = useBasket();
  const router = useRouter();
  const pathname = usePathname();
  const exp = useExport();
  const nameId = useId();

  // Built live from the current store state, so slides follow approvals and drafts.
  const built = useMemo<Built[]>(
    () =>
      open
        ? items.map((item) => {
            try {
              return { item, specs: buildSlides(item.scope, [item.kind], ctx) };
            } catch (e) {
              return { item, specs: [], error: e instanceof Error ? e.message : 'This slide could not be built.' };
            }
          })
        : [],
    [open, items, ctx],
  );
  const slides = built.flatMap((b) => b.specs);
  const first = items[0];
  const defaultTitle = first ? `${scopeLabel(first.scope, ctx)} · Slides` : 'Slides';

  const openBuilder = () => {
    onClose();
    if (pathname?.startsWith('/slides')) window.location.hash = 'basket';
    else router.push('/slides/#basket');
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      eyebrow="Slide basket"
      title={`${items.length} ${items.length === 1 ? 'slide' : 'slides'} collected`}
      width="lg"
      footer={
        <div className="flex w-full flex-col gap-2">
          <ExportStatus state={exp.state} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="ghost" icon={<Trash2 />} disabled={items.length === 0} onClick={() => clearBasket()} data-testid="basket-clear">
              Empty basket
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="secondary" icon={<LayoutGrid />} disabled={items.length === 0} onClick={openBuilder} data-testid="basket-open-builder">
                Open in builder
              </Button>
              <Button
                variant="primary"
                icon={<FileDown />}
                disabled={slides.length === 0}
                loading={exp.state.phase === 'busy'}
                data-testid="basket-export"
                onClick={() => exp.run(() => buildDeck(slides, ctx, { title: name.trim() || defaultTitle }))}
              >
                Export .pptx
              </Button>
            </div>
          </div>
        </div>
      }
    >
      {items.length === 0 ? (
        <EmptyState
          variant="inline"
          icon={<Presentation />}
          title="No slides collected yet"
          description="Use the slides button on a card or section to add that view here. Reorder, then export one deck."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor={nameId} className="di-eyebrow">Deck name</label>
            <input
              id={nameId}
              data-testid="basket-name"
              value={name}
              placeholder={defaultTitle}
              onChange={(e) => setBasketName(e.target.value)}
              className={cx('h-9 rounded-md border border-line-strong bg-surface px-3 text-[13px] text-fg placeholder:text-fg-subtle', FOCUS_RING)}
            />
          </div>
          <BasketList built={built} />
          <p className="text-xs text-fg-muted" data-testid="basket-footer-text">
            Every slide is printed with: {footerText(ctx)}
          </p>
        </div>
      )}
    </Drawer>
  );
}

/** Top-bar control: the basket with a count badge, opening the drawer. Also mounts the announcer. */
export function BasketControl() {
  const { items } = useBasket();
  const [open, setOpen] = useState(false);
  useClearOnReset();
  return (
    <>
      <button
        type="button"
        data-testid="basket-button"
        aria-label={`Slide basket, ${items.length} ${items.length === 1 ? 'slide' : 'slides'}`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={cx(
          'relative inline-flex h-8 items-center gap-1.5 rounded-pill border border-line-strong bg-surface px-3 text-xs font-medium text-fg-muted transition-colors duration-150 hover:border-accent-line hover:text-accent',
          FOCUS_RING,
        )}
      >
        <Presentation aria-hidden className="size-3.5" />
        <span>Slides</span>
        <span data-testid="basket-count" className={cx('min-w-5 rounded-pill px-1.5 text-center text-[11px] leading-5 font-semibold tabular-nums', items.length > 0 ? 'bg-accent text-on-accent' : 'bg-inset text-fg-subtle')}>
          {items.length}
        </span>
      </button>
      <Announcer />
      <BasketDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
