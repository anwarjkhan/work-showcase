'use client';

import { X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useId, useRef, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from './cx';
import { IconButton } from './Button';
import { uiText } from './labels';
import { MOTION } from './motion';

const WIDTH = { md: 'w-[min(480px,100vw)]', lg: 'w-[min(640px,100vw)]', xl: 'w-[min(840px,100vw)]' } as const;

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Small line above the title (record type, id). */
  eyebrow?: ReactNode;
  /** Pinned bottom bar, usually the action buttons. */
  footer?: ReactNode;
  width?: keyof typeof WIDTH;
  children: ReactNode;
}

const subscribe = () => () => {};

function Panel({ onClose, title, eyebrow, footer, width = 'md', children }: Omit<DrawerProps, 'open'>) {
  const ref = useRef<HTMLElement>(null);
  const titleId = useId();
  const reduce = useReducedMotion();

  // Move focus in, lock page scroll, and put focus back where it was when the drawer closes.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const first = ref.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? ref.current)?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab') return;
    const nodes = Array.from(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter((n) => n.offsetParent !== null || n === document.activeElement);
    const firstNode = nodes[0];
    const lastNode = nodes[nodes.length - 1];
    if (!firstNode || !lastNode) {
      e.preventDefault();
      return;
    }
    if (e.shiftKey && (document.activeElement === firstNode || document.activeElement === ref.current)) {
      e.preventDefault();
      lastNode.focus();
    } else if (!e.shiftKey && document.activeElement === lastNode) {
      e.preventDefault();
      firstNode.focus();
    }
  };

  const t = { duration: reduce ? 0 : MOTION.slow, ease: MOTION.easeEmphasis };
  return (
    <div className="fixed inset-0 z-[60]">
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-overlay backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduce ? 0 : MOTION.base, ease: MOTION.easeStandard }}
        onClick={onClose}
      />
      <motion.aside
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        initial={{ x: reduce ? 0 : 40, opacity: reduce ? 1 : 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: reduce ? 0 : 40, opacity: 0 }}
        transition={t}
        className={cx('absolute inset-y-0 right-0 flex max-w-full flex-col border-l border-line-strong bg-surface shadow-overlay outline-none', WIDTH[width])}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div className="min-w-0">
            {eyebrow ? <div className="di-eyebrow mb-1">{eyebrow}</div> : null}
            <h2 id={titleId} className="font-display text-lg leading-snug font-semibold text-title">
              {title}
            </h2>
          </div>
          <IconButton label={uiText.close} icon={<X />} onClick={onClose} className="-mr-2" />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer ? <footer className="flex items-center justify-end gap-2 border-t border-line bg-surface-2 px-6 py-3">{footer}</footer> : null}
      </motion.aside>
    </div>
  );
}

/**
 * Right-side panel with a scrim. Focus moves in, Tab is trapped, Escape or the scrim closes,
 * and focus returns to the trigger. Page scroll is locked while open.
 *
 *   <Drawer open={open} onClose={() => setOpen(false)} eyebrow="Finding R5" title="Reported Green with a blocked dependency" footer={<Button onClick={...}>Open deliverable</Button>}>
 *     <KeyValue ... />
 *   </Drawer>
 */
export function Drawer({ open, ...rest }: DrawerProps) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  if (!mounted) return null;
  return createPortal(<AnimatePresence>{open ? <Panel key="drawer" {...rest} /> : null}</AnimatePresence>, document.body);
}
