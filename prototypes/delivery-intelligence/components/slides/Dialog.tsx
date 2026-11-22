'use client';
/** A centred modal (small by default; `size` widens it): focus moves in and is trapped, Escape closes, focus returns to the opener. */
import { X } from 'lucide-react';
import { useEffect, useId, useRef, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from '@/components/ui';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const subscribe = () => () => {};

export type DialogSize = 'md' | 'lg' | 'xl';
const WIDTH: Record<DialogSize, string> = { md: 'w-[min(520px,100%)]', lg: 'w-[min(880px,100%)]', xl: 'w-[min(1280px,100%)]' };

interface PanelProps {
  title: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  size?: DialogSize;
  /** Extra key handling (for example arrow keys in the slide viewer); runs after Escape and Tab. */
  onKey?: (e: KeyboardEvent<HTMLDivElement>) => void;
}

function Panel({ title, onClose, footer, children, size = 'md', onKey }: PanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    (ref.current?.querySelector<HTMLElement>('[data-autofocus]') ?? ref.current?.querySelector<HTMLElement>(FOCUSABLE) ?? ref.current)?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab') {
      onKey?.(e);
      return;
    }
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

  return (
    // React passes portal events up to the opener's ancestors (tree rows with their own click and
    // arrow-key handling, cards that navigate): stop them here so the dialog never acts on the page.
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-overlay p-4"
      onMouseDown={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onFocus={(e) => e.stopPropagation()}
      onBlur={(e) => e.stopPropagation()}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={`flex max-h-[92vh] ${WIDTH[size]} flex-col rounded-lg border border-line-strong bg-surface shadow-overlay outline-none`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <h2 id={titleId} className="font-display text-[16px] leading-snug font-semibold text-title">
            {title}
          </h2>
          <IconButton label="Close" icon={<X />} size="sm" onClick={onClose} />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer> : null}
      </div>
    </div>
  );
}

export function Dialog({ open, ...rest }: PanelProps & { open: boolean }) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  if (!open || !mounted) return null;
  return createPortal(<Panel {...rest} />, document.body);
}
