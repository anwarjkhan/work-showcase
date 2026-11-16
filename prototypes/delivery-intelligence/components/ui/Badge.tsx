import { X } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cx, FOCUS_RING, TRANSITION } from './cx';
import { TONE, type StatusTone } from './status';

export type BadgeTone = 'neutral' | 'accent' | StatusTone;

const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-fg-muted border-line-strong',
  accent: 'bg-accent-soft text-accent border-accent-line',
  red: TONE.red.pill,
  amber: TONE.amber.pill,
  green: TONE.green.pill,
  unknown: TONE.unknown.pill,
};

export const BADGE_SIZE = {
  sm: 'h-5 gap-1 px-1.5 text-[10.5px]',
  md: 'h-6 gap-1.5 px-2 text-[11.5px]',
  lg: 'h-7 gap-1.5 px-2.5 text-[12.5px]',
} as const;

export interface BadgeProps extends Omit<ComponentProps<'span'>, 'children'> {
  /** Colour family. Status tones (red/amber/green/unknown) must also carry an icon or text meaning. */
  tone?: BadgeTone;
  size?: keyof typeof BADGE_SIZE;
  /** Leading icon (a lucide icon element, `aria-hidden` is added for you). */
  icon?: ReactNode;
  /** Dashed outline for placeholders and planned items. */
  dashed?: boolean;
  children: ReactNode;
}

/**
 * Small rounded label.
 *
 *   <Badge tone="accent" icon={<Bot className="size-3" />}>Draft</Badge>
 */
export function Badge({ tone = 'neutral', size = 'md', icon, dashed, className, children, ...rest }: BadgeProps) {
  return (
    <span
      {...rest}
      className={cx(
        'inline-flex shrink-0 items-center whitespace-nowrap rounded-pill border font-medium tracking-[0.01em]',
        BADGE_SIZE[size],
        BADGE_TONE[tone],
        dashed && 'border-dashed',
        className,
      )}
    >
      {icon ? <span aria-hidden className="inline-flex shrink-0 [&>svg]:size-3.5">{icon}</span> : null}
      {children}
    </span>
  );
}

export interface ChipProps extends Omit<ComponentProps<'button'>, 'children'> {
  /** Toggled-on filter state. */
  selected?: boolean;
  /** Shows a remove button; click calls this. */
  onRemove?: () => void;
  removeLabel?: string;
  icon?: ReactNode;
  children: ReactNode;
}

/**
 * Interactive chip for filters and selections (a toggle button).
 *
 *   <Chip selected={on} onClick={() => setOn(!on)}>Green</Chip>
 */
export function Chip({ selected, onRemove, removeLabel = 'Remove', icon, className, children, type = 'button', ...rest }: ChipProps) {
  return (
    <span className="inline-flex items-center">
      <button
        {...rest}
        type={type}
        aria-pressed={selected}
        className={cx(
          'inline-flex h-7 items-center gap-1.5 whitespace-nowrap border px-2.5 text-xs font-medium',
          onRemove ? 'rounded-l-pill border-r-0 pr-1.5' : 'rounded-pill',
          selected
            ? 'border-accent-line bg-accent-soft text-accent'
            : 'border-line-strong bg-surface text-fg-muted hover:bg-hover hover:text-fg',
          TRANSITION,
          FOCUS_RING,
          className,
        )}
      >
        {icon ? <span aria-hidden className="inline-flex [&>svg]:size-3.5">{icon}</span> : null}
        {children}
      </button>
      {onRemove ? (
        <button
          type="button"
          aria-label={removeLabel}
          onClick={onRemove}
          className={cx(
            'inline-flex h-7 w-6 items-center justify-center rounded-r-pill border border-l-0 text-fg-subtle hover:text-fg',
            selected ? 'border-accent-line bg-accent-soft' : 'border-line-strong bg-surface',
            TRANSITION,
            FOCUS_RING,
          )}
        >
          <X aria-hidden className="size-3" strokeWidth={2.4} />
        </button>
      ) : null}
    </span>
  );
}
