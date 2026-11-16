'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Tracks an element's content box so SVG charts can draw at the container's
 * width. `width` is 0 until the first measurement (charts render nothing or a
 * placeholder then), which also keeps server and first client render identical.
 *
 *   const { ref, width } = useElementSize<HTMLDivElement>();
 *   <div ref={ref}>{width > 0 && <svg width={width} ... />}</div>
 */
export function useElementSize<T extends HTMLElement = HTMLDivElement>() {
  const [el, setEl] = useState<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const ref = useCallback((node: T | null) => setEl(node), []);

  useEffect(() => {
    if (!el) return;
    const read = (w: number, h: number) =>
      setSize((prev) => {
        const width = Math.round(w);
        const height = Math.round(h);
        return prev.width === width && prev.height === height ? prev : { width, height };
      });
    const rect = el.getBoundingClientRect();
    read(rect.width, rect.height);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) read(entry.contentRect.width, entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);

  return { ref, width: size.width, height: size.height };
}
