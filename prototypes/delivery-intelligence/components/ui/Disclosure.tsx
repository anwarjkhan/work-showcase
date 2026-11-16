'use client';

import { ChevronRight } from 'lucide-react';
import { useId, useRef, useState, useLayoutEffect, type KeyboardEvent, type ReactNode } from 'react';
import { cx, FOCUS_RING } from './cx';

export interface DisclosureProps {
  /** Always-visible row content next to the chevron. */
  summary: ReactNode;
  /** Right side of the summary row (counts, badges). */
  trailing?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Controlled mode. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

/**
 * Single expandable section (button plus region). Height eases open; reduced motion is honoured globally.
 *
 *   <Disclosure summary="Evidence register" trailing={<Badge>6</Badge>}>...</Disclosure>
 */
export function Disclosure({ summary, trailing, children, defaultOpen = false, open: controlled, onOpenChange, className }: DisclosureProps) {
  const [inner, setInner] = useState(defaultOpen);
  const open = controlled ?? inner;
  const id = useId();
  const set = (next: boolean) => {
    if (controlled === undefined) setInner(next);
    onOpenChange?.(next);
  };
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => set(!open)}
        className={cx('flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[13px] font-medium text-fg hover:bg-hover', FOCUS_RING)}
      >
        <ChevronRight aria-hidden className={cx('size-4 shrink-0 text-fg-subtle transition-transform duration-(--di-duration-base) ease-standard', open && 'rotate-90')} />
        <span className="min-w-0 flex-1 truncate">{summary}</span>
        {trailing ? <span className="flex shrink-0 items-center gap-2">{trailing}</span> : null}
      </button>
      <div
        id={id}
        role="region"
        inert={!open}
        className={cx('grid transition-[grid-template-rows] duration-(--di-duration-base) ease-standard', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="px-2 pt-1 pb-2">{children}</div>
        </div>
      </div>
    </div>
  );
}

/**
 * Container for `TreeRow`s: `role="tree"` with keyboard support.
 * Up/Down move between visible rows, Right expands (or moves to the first child), Left collapses
 * (or moves to the parent), Home/End jump, Enter or Space activates. One row is in the tab order.
 *
 *   <Tree ariaLabel="Hierarchy">
 *     <TreeRow level={1} label="Request IR-01" expandable expanded={open} onToggle={toggle} />
 *     {open && <TreeRow level={2} label="Programme" />}
 *   </Tree>
 */
export function Tree({ ariaLabel, children, className }: { ariaLabel: string; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const current = useRef<HTMLElement | null>(null);

  const items = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? []);

  // Exactly one row is tabbable (roving tabindex), kept in step with whichever rows are rendered.
  useLayoutEffect(() => {
    const all = items();
    const active = current.current && all.includes(current.current) ? current.current : all[0];
    all.forEach((el) => el.setAttribute('tabindex', el === active ? '0' : '-1'));
  });

  const focusItem = (el: HTMLElement | undefined) => {
    if (!el) return;
    items().forEach((n) => n.setAttribute('tabindex', n === el ? '0' : '-1'));
    current.current = el;
    el.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.getAttribute('role') !== 'treeitem') return;
    const all = items();
    const i = all.indexOf(target);
    const level = Number(target.getAttribute('aria-level'));
    const expanded = target.getAttribute('aria-expanded');
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusItem(all[i + 1]);
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusItem(all[i - 1]);
        break;
      case 'Home':
        e.preventDefault();
        focusItem(all[0]);
        break;
      case 'End':
        e.preventDefault();
        focusItem(all[all.length - 1]);
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (expanded === 'false') target.dispatchEvent(new CustomEvent('di-tree-toggle', { bubbles: false }));
        else if (expanded === 'true') {
          const next = all[i + 1];
          if (next && Number(next.getAttribute('aria-level')) === level + 1) focusItem(next);
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (expanded === 'true') target.dispatchEvent(new CustomEvent('di-tree-toggle', { bubbles: false }));
        else {
          for (let j = i - 1; j >= 0; j--) {
            const candidate = all[j];
            if (candidate && Number(candidate.getAttribute('aria-level')) < level) {
              focusItem(candidate);
              break;
            }
          }
        }
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        target.click();
        break;
    }
  };

  return (
    <div
      ref={ref}
      role="tree"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      onFocus={(e) => {
        if ((e.target as HTMLElement).getAttribute('role') === 'treeitem') current.current = e.target as HTMLElement;
      }}
      className={cx('flex flex-col', className)}
    >
      {children}
    </div>
  );
}

export interface TreeRowProps {
  /** Depth, starting at 1. Drives indentation and `aria-level`. */
  level: number;
  label: ReactNode;
  /** Leading mark: an icon element, a badge. */
  icon?: ReactNode;
  /** Right side: status pills, counts. */
  trailing?: ReactNode;
  /** Row has children to show or hide. */
  expandable?: boolean;
  expanded?: boolean;
  /** Called when the chevron is clicked or Right/Left/Enter toggles the row. */
  onToggle?: () => void;
  selected?: boolean;
  /** Called on click and on Enter for rows that are not expandable (or in addition to toggling when set). */
  onSelect?: () => void;
  className?: string;
}

/**
 * One row of a flat tree. Render children rows yourself when `expanded`; the `Tree` handles the keys.
 * Clicking the row selects it (`onSelect`) and toggles it (`onToggle`) when expandable.
 */
export function TreeRow({ level, label, icon, trailing, expandable, expanded, onToggle, selected, onSelect, className }: TreeRowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const toggleRef = useRef(onToggle);
  useLayoutEffect(() => {
    toggleRef.current = onToggle;
  });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = () => toggleRef.current?.();
    el.addEventListener('di-tree-toggle', handler);
    return () => el.removeEventListener('di-tree-toggle', handler);
  }, []);

  return (
    <div
      ref={ref}
      role="treeitem"
      aria-level={level}
      aria-expanded={expandable ? Boolean(expanded) : undefined}
      aria-selected={selected}
      onClick={() => {
        if (expandable) onToggle?.();
        onSelect?.();
      }}
      style={{ paddingLeft: 8 + (level - 1) * 20 }}
      className={cx(
        'flex min-h-9 cursor-pointer items-center gap-2 rounded-md pr-2 text-[13px] text-fg hover:bg-hover',
        selected && 'bg-selected',
        FOCUS_RING,
        className,
      )}
    >
      <span aria-hidden className="inline-flex size-4 shrink-0 items-center justify-center text-fg-subtle">
        {expandable ? <ChevronRight className={cx('size-4 transition-transform duration-(--di-duration-base) ease-standard', expanded && 'rotate-90')} /> : null}
      </span>
      {icon ? <span aria-hidden className="inline-flex shrink-0 [&>svg]:size-4">{icon}</span> : null}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing ? <span className="flex shrink-0 items-center gap-2">{trailing}</span> : null}
    </div>
  );
}
