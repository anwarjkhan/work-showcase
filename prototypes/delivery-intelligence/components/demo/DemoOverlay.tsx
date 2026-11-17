'use client';

import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, List, Presentation, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, cx, IconButton } from '@/components/ui';
import { DEMO_STEPS, DEMO_TOTAL_SECONDS, formatDuration, resolveDemoStep, type DemoTokens } from '@/lib/config/demo-script';
import { HERO_DELIVERABLE_ID, WORKFLOW_DELIVERABLE_ID } from '@/lib/config/story';
import { usePortfolioIndex } from '@/lib/store';
import { demoStore } from './demo-state';
import { useDemoController } from './useDemoController';

/** Roles whose widgets use the arrow keys themselves. */
const WIDGET = '[role=tree],[role=treeitem],[role=tab],[role=tablist],[role=grid],[role=listbox],[role=menu],[role=radiogroup],[role=slider],[role=combobox],[role=toolbar]';

/**
 * A heading or section a screen focused after a deep link (tabindex -1, no role,
 * no state attributes): nothing there uses the arrow keys, so the demo shortcuts apply.
 */
function isLandingTarget(el: Element): boolean {
  return el.getAttribute('tabindex') === '-1' && !el.hasAttribute('role') && !el.hasAttribute('aria-expanded') && !el.hasAttribute('aria-selected') && !el.closest(WIDGET);
}

const EDITABLE = 'input, select, textarea, [contenteditable=""], [contenteditable="true"]';

/**
 * Plain keys act only when focus is on the page body or inside the overlay, so
 * the tree, tab and timeline widgets keep their arrow keys. Alt+arrows work from
 * anywhere except text fields.
 */
export function shortcutAction(e: Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'target'>, overlay: Element | null): 'next' | 'prev' | 'collapse' | null {
  if (e.ctrlKey || e.metaKey) return null;
  const target = e.target instanceof Element ? e.target : null;
  if (target?.closest(EDITABLE)) return null;
  if (e.altKey) {
    if (e.shiftKey) return null;
    if (e.key === 'ArrowRight') return 'next';
    if (e.key === 'ArrowLeft') return 'prev';
    return null;
  }
  const neutral = !target || target === document.body || target === document.documentElement || (overlay !== null && overlay.contains(target)) || isLandingTarget(target);
  if (!neutral) return null;
  const key = e.key;
  if (key === 'ArrowRight' || key === 'PageDown' || key === 'n' || key === 'N') return 'next';
  if (key === 'ArrowLeft' || key === 'PageUp' || key === 'p' || key === 'P') return 'prev';
  if (key === 'Escape') return 'collapse';
  return null;
}

function useElapsed(since: number, active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return Math.max(0, Math.round(((active ? Math.max(now, since) : since) - since) / 1000));
}

/** Docked guided-demo bar: step, point to make, prompts, timing, navigation. */
export function DemoOverlay() {
  const ctl = useDemoController();
  const { state } = ctl;
  const pathname = usePathname() ?? '/';
  const idx = usePortfolioIndex();
  const rootRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const [listFor, setListFor] = useState<number | null>(null);
  const listOpen = listFor === state.step && !state.collapsed;
  const setListOpen = (open: boolean | ((v: boolean) => boolean)) => setListFor((cur) => ((typeof open === 'function' ? open(cur === state.step) : open) ? state.step : null));

  const tokens: DemoTokens = useMemo(() => {
    const hero = idx.deliverables.get(HERO_DELIVERABLE_ID);
    const flow = idx.deliverables.get(WORKFLOW_DELIVERABLE_ID);
    return {
      heroRef: hero?.ref ?? HERO_DELIVERABLE_ID,
      heroTitle: hero?.title ?? 'the main storyline deliverable',
      flowRef: flow?.ref ?? WORKFLOW_DELIVERABLE_ID,
      flowTitle: flow?.title ?? 'the workflow deliverable',
    };
  }, [idx]);

  const step = useMemo(() => resolveDemoStep(DEMO_STEPS[state.step] ?? DEMO_STEPS[0]!, tokens), [state.step, tokens]);
  const stepElapsed = useElapsed(state.stepStartedAt, state.running);
  const totalElapsed = useElapsed(state.runStartedAt, state.running);
  const running = state.running;
  const collapsed = state.collapsed;
  const total = DEMO_STEPS.length;

  // Reset demo ends the guided run (the shell button is the only reset).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest('[data-testid="reset-demo"]')) demoStore.exit();
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  // Keyboard shortcuts.
  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent) => {
      const action = shortcutAction(e, rootRef.current);
      if (!action) return;
      const current = demoStore.get();
      if (action === 'collapse') {
        if (listOpen) setListOpen(false);
        else demoStore.setCollapsed(!current.collapsed);
      } else if (action === 'next' && current.step < total - 1) ctl.next();
      else if (action === 'prev' && current.step > 0) ctl.prev();
      else return;
      // Capture phase: Alt+arrows must win over a widget's own arrow handling.
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [running, ctl, total, listOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reserve room under the page while docked, and keep focused elements clear of it.
  useEffect(() => {
    const el = rootRef.current;
    if (!running || !el) {
      setHeight(0);
      return;
    }
    const measure = () => setHeight(Math.ceil(el.getBoundingClientRect().height));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [running, collapsed]);

  // The room is added as bottom padding on the page's main element (inside the shell's
  // frame, so the navigation column still runs to the end of the page).
  useEffect(() => {
    const root = document.documentElement;
    const main = document.getElementById('main');
    if (running) {
      root.style.scrollPaddingBottom = `${height + 16}px`;
      if (main) main.style.paddingBottom = `${height + 24}px`;
    }
    return () => {
      root.style.scrollPaddingBottom = '';
      if (main) main.style.paddingBottom = '';
    };
  }, [running, height]);

  if (!running) return null;

  const pathOnly = step.href.split('#')[0] ?? '/';
  const normalised = pathname.endsWith('/') ? pathname : `${pathname}/`;
  const onStep = normalised === pathOnly;
  const over = stepElapsed > step.seconds;
  const timing = (
    <span data-testid="demo-timing" className="text-xs whitespace-nowrap text-fg-muted tabular-nums">
      <span className={cx(over && 'font-semibold text-status-amber-fg')}>{formatDuration(stepElapsed)}</span> of about {formatDuration(step.seconds)}
      <span className="hidden min-[1280px]:inline">
        {' · '}
        {formatDuration(totalElapsed)} of about {formatDuration(DEMO_TOTAL_SECONDS)} in all
      </span>
    </span>
  );

  return (
    <>
      <div
        ref={rootRef}
        data-testid="demo-overlay"
        data-collapsed={collapsed}
        role="region"
        aria-label="Guided demo"
        className={cx(
          'pointer-events-none fixed right-0 bottom-0 z-40 px-[var(--di-gutter)] pb-3',
          collapsed ? 'left-auto' : 'left-[var(--di-nav-width)]',
        )}
      >
        {collapsed ? (
          <div className="pointer-events-auto flex justify-end">
            <button
              type="button"
              data-testid="demo-expand"
              onClick={() => ctl.setCollapsed(false)}
              aria-expanded={false}
              aria-label={`Guided demo, step ${step.n} of ${total}: ${step.title}. Expand`}
              className="inline-flex h-9 max-w-[420px] items-center gap-2 rounded-pill border border-accent-line bg-surface px-3.5 text-xs font-medium text-fg shadow-raised transition-colors hover:bg-accent-soft focus-visible:shadow-focus focus-visible:outline-none"
            >
              <Presentation aria-hidden className="size-3.5 shrink-0 text-accent" />
              <span className="shrink-0 font-semibold text-accent">
                Step {step.n} of {total}
              </span>
              <span className="truncate text-fg-muted">{step.title}</span>
              <ChevronUp aria-hidden className="size-3.5 shrink-0 text-fg-subtle" />
            </button>
          </div>
        ) : (
          <div className="pointer-events-auto mx-auto max-w-[var(--di-content-max)] rounded-xl border border-accent-line bg-surface shadow-overlay">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-2">
              <span data-testid="demo-overlay-step" className="rounded-pill bg-accent-soft px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-accent">
                Step {step.n} of {total}
              </span>
              <h2 data-testid="demo-step-title" className="min-w-0 flex-1 truncate font-display text-[15px] font-semibold text-title">
                {step.title}
              </h2>
              {timing}
              <div className="relative flex items-center gap-1">
                <IconButton
                  label="Step list"
                  icon={<List />}
                  size="sm"
                  aria-expanded={listOpen}
                  aria-haspopup="true"
                  data-testid="demo-list-toggle"
                  onClick={() => setListOpen((v) => !v)}
                />
                {listOpen ? (
                  <ol
                    data-testid="demo-step-list"
                    aria-label="Jump to a step"
                    className="absolute right-0 bottom-full z-10 mb-2 max-h-[60vh] w-[360px] overflow-auto rounded-lg border border-line-strong bg-surface p-1 shadow-overlay"
                  >
                    {DEMO_STEPS.map((s, i) => (
                      <li key={s.n}>
                        <button
                          type="button"
                          aria-current={i === state.step ? 'step' : undefined}
                          onClick={() => ctl.goto(i)}
                          className={cx(
                            'flex w-full items-baseline gap-2 rounded-md px-2.5 py-1.5 text-left text-xs focus-visible:shadow-focus focus-visible:outline-none',
                            i === state.step ? 'bg-accent-soft font-semibold text-accent' : 'text-fg hover:bg-hover',
                          )}
                        >
                          <span className="w-5 shrink-0 text-right tabular-nums text-fg-subtle">{s.n}</span>
                          <span className="min-w-0 flex-1 truncate">{s.title}</span>
                          <span className="shrink-0 text-fg-subtle">{s.screen}</span>
                        </button>
                      </li>
                    ))}
                  </ol>
                ) : null}
                <IconButton label="Previous step" icon={<ChevronLeft />} size="sm" disabled={state.step === 0} data-testid="demo-prev" onClick={ctl.prev} />
                <Button variant="primary" size="sm" iconRight={<ChevronRight />} disabled={state.step >= total - 1} data-testid="demo-next" onClick={ctl.next}>
                  Next
                </Button>
                <IconButton label="Collapse guided demo" icon={<ChevronDown />} size="sm" data-testid="demo-collapse" onClick={() => ctl.setCollapsed(true)} />
                <IconButton label="Exit guided demo" icon={<X />} size="sm" data-testid="demo-exit" onClick={ctl.exit} />
              </div>
            </div>
            <div className="grid gap-x-6 gap-y-2 px-4 py-2.5 min-[1100px]:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
              <div>
                <p className="di-eyebrow">Point to make</p>
                <p data-testid="demo-point" className="mt-0.5 text-[13px] leading-snug text-fg">
                  {step.point}
                </p>
              </div>
              <div>
                <p className="di-eyebrow">On this screen</p>
                <ul data-testid="demo-prompts" className="mt-0.5 flex list-disc flex-col gap-0.5 pl-4 text-xs leading-snug text-fg-muted marker:text-accent">
                  {step.prompts.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line px-4 py-1.5 text-[11px] text-fg-subtle">
              <span data-testid="demo-hint">
                Keys: <kbd className="font-mono">Right</kbd> / <kbd className="font-mono">N</kbd> next, <kbd className="font-mono">Left</kbd> / <kbd className="font-mono">P</kbd> back, <kbd className="font-mono">Esc</kbd> collapse. From inside a screen widget use{' '}
                <kbd className="font-mono">Alt+Right</kbd> / <kbd className="font-mono">Alt+Left</kbd>.
              </span>
              {!onStep ? (
                <button type="button" data-testid="demo-return" onClick={() => ctl.goto(state.step)} className="font-medium text-accent underline underline-offset-2 focus-visible:shadow-focus focus-visible:outline-none">
                  Back to this step&rsquo;s screen
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
