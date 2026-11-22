'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { cloneElement, isValidElement, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MOTION } from './motion';

const subscribe = () => () => {};

interface Position {
  x: number;
  /** Distance from the bottom edge (side top) or from the top edge (side bottom). */
  y: number;
  side: 'top' | 'bottom';
}

export interface TooltipProps {
  /** Tooltip text or content. Falsy content disables the tooltip. */
  content: ReactNode;
  /** One focusable element (button, link, badge). It gets `aria-describedby` while open. */
  children: ReactElement<{ 'aria-describedby'?: string }> | ReactNode;
  side?: 'top' | 'bottom';
  /** Hover delay in ms (focus shows immediately). */
  delay?: number;
  className?: string;
}

/**
 * Hover and focus tooltip, closes on Escape. Positioned in a portal so tables and
 * drawers never clip it.
 *
 *   <Tooltip content="Needs an approved review first"><Button disabledReason="...">Move</Button></Tooltip>
 */
export function Tooltip({ content, children, side = 'top', delay = 250, className }: TooltipProps) {
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [pos, setPos] = useState<Position | null>(null);
  const reduce = useReducedMotion();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  const open = (wait: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const flip = side === 'top' ? r.top < 80 : window.innerHeight - r.bottom < 80;
      const actual: 'top' | 'bottom' = flip ? (side === 'top' ? 'bottom' : 'top') : side;
      const half = 150;
      const x = Math.min(Math.max(r.left + r.width / 2, half + 8), Math.max(half + 8, window.innerWidth - half - 8));
      setPos({ x, y: actual === 'top' ? window.innerHeight - r.top + 8 : r.bottom + 8, side: actual });
    }, wait);
  };
  const close = () => {
    window.clearTimeout(timer.current);
    setPos(null);
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (!pos) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPos(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pos]);

  if (!content) return <>{children}</>;

  const child = isValidElement<{ 'aria-describedby'?: string }>(children)
    ? cloneElement(children, { 'aria-describedby': pos ? id : children.props['aria-describedby'] })
    : children;

  return (
    <span
      ref={ref}
      className={className ?? 'inline-flex'}
      onMouseEnter={() => open(delay)}
      onMouseLeave={close}
      onFocus={() => open(0)}
      onBlur={close}
    >
      {child}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {pos && (
              <motion.div
                id={id}
                role="tooltip"
                initial={{ opacity: 0, y: reduce ? 0 : pos.side === 'top' ? 3 : -3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : MOTION.fast, ease: MOTION.easeStandard }}
                style={{
                  position: 'fixed',
                  left: pos.x,
                  x: '-50%',
                  ...(pos.side === 'top' ? { bottom: pos.y } : { top: pos.y }),
                }}
                className="pointer-events-none z-[80] max-w-[300px] rounded-md border border-line-strong bg-surface px-2.5 py-1.5 text-xs leading-snug text-fg shadow-raised"
              >
                {content}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </span>
  );
}
