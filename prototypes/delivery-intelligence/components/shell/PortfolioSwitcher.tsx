'use client';

/**
 * Portfolio switcher (visual stub). Sits under the wordmark in the left
 * navigation. The prototype holds one portfolio: choosing another opens a
 * preview panel and never changes data. Only open/closed state is kept, in
 * memory; nothing is persisted and Reset demo does not touch it.
 */
import { Check, ChevronsUpDown, CircleDashed, Layers, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Button, IconButton } from '@/components/ui';
import { DemoNote } from '@/components/ui/DemoNote';
import { cx, FOCUS_RING } from '@/components/ui/cx';
import { CONNECTION_PLAN_HREF, LOADED_PORTFOLIO, PORTFOLIOS, type NotLoadedPortfolio, type Portfolio } from '@/lib/config/portfolios';
import { terms } from '@/lib/config/terminology';
import { ProvenanceBadge } from './ProvenanceBadge';

const t = terms.portfolioSwitch;
const SEARCH_THRESHOLD = 5;
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function PortfolioSwitcher() {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<NotLoadedPortfolio | null>(null);
  const [query, setQuery] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuId = useId();
  const showSearch = PORTFOLIOS.length > SEARCH_THRESHOLD;

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? PORTFOLIOS.filter((p) => p.name.toLowerCase().includes(q)) : [...PORTFOLIOS];
  }, [query]);

  const options = useCallback(() => Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? []), []);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    setQuery('');
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  // Focus the current portfolio (or the search field) when the menu opens.
  useEffect(() => {
    if (!open) return;
    const target = showSearch ? searchRef.current : (options().find((o) => o.getAttribute('aria-checked') === 'true') ?? options()[0]);
    target?.focus();
  }, [open, showSearch, options]);

  // Click outside closes without stealing focus.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, close]);

  const onMenuKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close(true);
      return;
    }
    if (e.key === 'Tab') {
      close(false);
      return;
    }
    const list = options();
    const i = list.indexOf(document.activeElement as HTMLElement);
    let next: number | null = null;
    if (e.key === 'ArrowDown') next = i < 0 ? 0 : Math.min(list.length - 1, i + 1);
    else if (e.key === 'ArrowUp') {
      if (i <= 0 && showSearch) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      next = Math.max(0, i - 1);
    } else if (e.key === 'Home' && i >= 0) next = 0;
    else if (e.key === 'End' && i >= 0) next = list.length - 1;
    if (next !== null) {
      e.preventDefault();
      list[next]?.focus();
    }
  };

  const choose = (p: Portfolio) => {
    if (p.status === 'loaded') {
      close(true);
      return;
    }
    close(false);
    setPreview(p);
  };

  return (
    <div ref={rootRef} className="relative border-b border-nav-line px-3 py-2.5" onKeyDown={open ? onMenuKey : undefined}>
      <button
        ref={triggerRef}
        type="button"
        data-testid="portfolio-switcher"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`${t.label}: ${LOADED_PORTFOLIO.name}. ${t.menuLabel}`}
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={cx(
          'flex h-11 w-full items-center gap-2 rounded-md border border-nav-line bg-nav-hover/40 pr-2.5 pl-3 text-left transition-colors duration-150 hover:bg-nav-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-nav-indicator',
          open && 'bg-nav-hover',
        )}
      >
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-nav-muted">{t.label}</span>
          <span data-testid="portfolio-switcher-name" title={LOADED_PORTFOLIO.name} className="truncate text-[13px] font-medium text-nav-fg-strong">
            {LOADED_PORTFOLIO.name}
          </span>
        </span>
        <ChevronsUpDown aria-hidden className="size-3.5 shrink-0 text-nav-muted" strokeWidth={2} />
      </button>

      {open && (
        <div
          id={menuId}
          data-testid="portfolio-menu"
          className="absolute top-[calc(100%-4px)] left-3 z-50 w-[min(340px,calc(100vw-24px))] overflow-hidden rounded-lg border border-line-strong bg-surface text-fg shadow-overlay"
        >
          {showSearch && (
            <div className="flex items-center gap-2 border-b border-line px-3">
              <Search aria-hidden className="size-3.5 shrink-0 text-fg-subtle" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    options()[0]?.focus();
                  }
                }}
                aria-label={t.search}
                placeholder={t.search}
                className="h-9 w-full bg-transparent text-[13px] text-fg outline-none placeholder:text-fg-subtle"
              />
            </div>
          )}
          <div role="menu" aria-label={t.menuLabel} className="flex max-h-[360px] flex-col gap-0.5 overflow-y-auto p-1.5">
            {items.map((p) => {
              const current = p.status === 'loaded';
              return (
                <button
                  key={p.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={current}
                  data-testid={`portfolio-option-${p.id}`}
                  onClick={() => choose(p)}
                  className={cx('flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left', FOCUS_RING, 'hover:bg-hover focus-visible:bg-hover', current && 'bg-accent-soft')}
                >
                  <span className="mt-0.5 grid size-4 shrink-0 place-items-center">
                    {current ? <Check aria-hidden className="size-4 text-accent" strokeWidth={2.4} /> : p.rollup ? <Layers aria-hidden className="size-3.5 text-fg-subtle" /> : <CircleDashed aria-hidden className="size-3.5 text-fg-subtle" />}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13px] font-medium text-title">{p.name}</span>
                    {current ? (
                      <span className="text-[11.5px] text-accent">{t.current}</span>
                    ) : (
                      <DemoNote className="text-[11.5px] text-fg-subtle">{t.notLoaded}</DemoNote>
                    )}
                  </span>
                </button>
              );
            })}
            {items.length === 0 && <p className="px-2.5 py-2 text-[12.5px] text-fg-muted">{t.noMatch}</p>}
          </div>
        </div>
      )}

      {preview && (
        <PreviewPanel
          portfolio={preview}
          onClose={() => {
            setPreview(null);
            triggerRef.current?.focus();
          }}
        />
      )}
    </div>
  );
}

function PreviewPanel({ portfolio, onClose }: { portfolio: NotLoadedPortfolio; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const loadedName = LOADED_PORTFOLIO.name;

  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab') return;
    const nodes = Array.from(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const sources = portfolio.rollup
    ? ['Each portfolio’s own portfolio system and Jira projects, read together']
    : [`${terms.systems['portfolio-system']}: deliverables, outcomes and reported status`, `${terms.systems['work-tracker']} projects: Epics, work items and dependencies`];

  return createPortal(
    <div className="fixed inset-0 z-[70] grid place-items-center p-6" data-testid="portfolio-preview">
      <div aria-hidden className="absolute inset-0 bg-overlay backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className="relative flex max-h-full w-full max-w-[560px] flex-col overflow-hidden rounded-xl border border-line-strong bg-surface shadow-overlay"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div className="min-w-0">
            <div className="di-eyebrow mb-1">
              {t.previewEyebrow} <span aria-hidden>·</span> <span data-testid="portfolio-preview-status">{t.notLoaded}</span>
            </div>
            <h2 id={titleId} className="font-display text-lg leading-snug font-semibold text-title">
              {portfolio.name}
            </h2>
            <p className="mt-1 text-[13px] text-fg-muted">{portfolio.description}</p>
          </div>
          <IconButton label="Close" icon={<X />} onClick={onClose} className="-mr-2" />
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
          <section className="flex flex-col gap-2.5">
            <h3 className="text-[13px] font-semibold text-heading">{portfolio.rollup ? t.rollupHeading : t.willShow}</h3>
            {portfolio.rollup && <p className="text-[13px] text-fg">{t.rollupBody}</p>}
            <div className="rounded-lg border border-line bg-surface-2 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-xs text-fg-muted">{t.estateHeading}</span>
                <ProvenanceBadge kind="planned" label={t.placeholder} size="sm" />
              </div>
              <dl className="m-0 grid grid-cols-2 gap-4">
                <div>
                  <dd className="m-0 font-display text-[26px] leading-none font-semibold text-title tabular-nums">{portfolio.estate.projects.toLocaleString('en-GB')}</dd>
                  <dt className="mt-1 text-xs text-fg-muted">{t.projects}</dt>
                </div>
                <div>
                  <dd className="m-0 font-display text-[26px] leading-none font-semibold text-title tabular-nums">{portfolio.estate.activeEpics.toLocaleString('en-GB')}</dd>
                  <dt className="mt-1 text-xs text-fg-muted">{t.activeEpics}</dt>
                </div>
              </dl>
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2 text-[13px] font-semibold text-heading">
              {t.sourcesHeading}
              <span className="rounded-pill border border-line px-2 py-0.5 text-[11px] font-medium text-fg-muted">{t.readOnlyFirst}</span>
            </h3>
            <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-[13px] text-fg">
              {sources.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </section>

          <DemoNote as="p" className="rounded-md border border-line bg-accent-soft px-3 py-2 text-[12.5px] text-fg-muted" data-testid="portfolio-preview-note">
            {t.note}
          </DemoNote>
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-2 px-6 py-3">
          <Link
            href={CONNECTION_PLAN_HREF}
            onClick={onClose}
            data-testid="portfolio-preview-plan"
            className={cx(
              'inline-flex h-9 items-center justify-center rounded-md border border-line-strong bg-surface px-3.5 text-[13px] font-medium whitespace-nowrap text-fg shadow-card hover:border-accent-line hover:text-accent',
              FOCUS_RING,
            )}
          >
            {t.connectionPlan}
          </Link>
          <Button variant="primary" data-autofocus data-testid="portfolio-preview-return" onClick={onClose}>
            {`${t.returnTo} ${loadedName}`}
          </Button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
