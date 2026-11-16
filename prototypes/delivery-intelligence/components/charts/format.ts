/**
 * Tiny number formatter shared by charts and tiles. Fixed `en-GB` locale so
 * server and browser agree. Minus signs use the true minus character.
 *
 *   fmt.number(1234)        // "1,234"
 *   fmt.compact(12400)      // "12K"
 *   fmt.percent(82.4)       // "82%"
 *   fmt.delta(-3)           // "−3"
 *   fmt.delta(4.5, { percent: true, decimals: 1 })   // "+4.5%"
 */
const LOCALE = 'en-GB';

function base(n: number, decimals: number, compact: boolean): string {
  return new Intl.NumberFormat(LOCALE, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0,
    notation: compact ? 'compact' : 'standard',
  }).format(n);
}

export const fmt = {
  number(n: number, decimals = 0): string {
    return base(n, decimals, false).replace('-', '−');
  },
  compact(n: number, decimals = 1): string {
    return base(n, decimals, true).replace('-', '−');
  },
  /** `n` is already 0..100. */
  percent(n: number, decimals = 0): string {
    return `${base(n, decimals, false).replace('-', '−')}%`;
  },
  /** Signed change: "+4", "−3", "0". */
  delta(n: number, opts: { decimals?: number; percent?: boolean } = {}): string {
    const { decimals = 0, percent = false } = opts;
    const body = base(Math.abs(n), decimals, false);
    const unit = percent ? '%' : '';
    if (Number(body.replace(/,/g, '')) === 0) return `0${unit}`;
    return `${n > 0 ? '+' : '−'}${body}${unit}`;
  },
};

/** Estimated pixel width of a label at the chart text size (for axis margins). */
export function estimateTextWidth(text: string, fontSize = 11): number {
  return Math.ceil(text.length * fontSize * 0.6);
}

/** Truncates text to roughly fit `maxWidth` pixels. */
export function fitLabel(text: string, maxWidth: number, fontSize = 11): string {
  const maxChars = Math.floor(maxWidth / (fontSize * 0.58));
  if (maxChars >= text.length) return text;
  if (maxChars <= 1) return '';
  return `${text.slice(0, maxChars - 1)}…`;
}
