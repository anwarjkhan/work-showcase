'use client';

import { LoaderCircle } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cx, FOCUS_RING, TRANSITION } from './cx';
import { Tooltip } from './Tooltip';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'border-transparent bg-accent text-on-accent shadow-card hover:bg-accent-strong',
  secondary: 'border-line-strong bg-surface text-fg shadow-card hover:border-accent-line hover:text-accent',
  ghost: 'border-transparent bg-transparent text-fg-muted hover:bg-hover hover:text-fg',
  danger: 'border-status-red-line bg-status-red-soft text-status-red-fg hover:border-status-red',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-7 gap-1.5 px-2.5 text-xs',
  md: 'h-9 gap-2 px-3.5 text-[13px]',
  lg: 'h-10 gap-2 px-4 text-sm',
};

const ICON_SIZE: Record<ButtonSize, string> = {
  sm: 'size-7',
  md: 'size-9',
  lg: 'size-10',
};

const BASE = 'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md border font-medium select-none';
const DISABLED = 'cursor-not-allowed opacity-50 shadow-none hover:bg-inherit';

export interface ButtonProps extends Omit<ComponentProps<'button'>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Leading icon element, e.g. `<Play className="size-4" />`. */
  icon?: ReactNode;
  /** Trailing icon element. */
  iconRight?: ReactNode;
  loading?: boolean;
  /**
   * Disabled with a visible reason: the button stays focusable, ignores clicks and
   * shows this text in a tooltip on hover and focus. Prefer this over bare `disabled`.
   */
  disabledReason?: string;
  children: ReactNode;
}

/**
 * Button with four variants.
 *
 *   <Button variant="primary" icon={<Play className="size-4" />} onClick={run}>Run agent</Button>
 *   <Button disabledReason="Approve the review first">Move forward</Button>
 */
export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconRight,
  loading,
  disabledReason,
  disabled,
  className,
  children,
  onClick,
  type = 'button',
  ...rest
}: ButtonProps) {
  const blocked = Boolean(disabledReason) || Boolean(disabled) || Boolean(loading);
  const button = (
    <button
      {...rest}
      type={type}
      disabled={disabled && !disabledReason}
      aria-disabled={blocked || undefined}
      aria-busy={loading || undefined}
      onClick={(e) => {
        if (blocked) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      className={cx(BASE, SIZE[size], VARIANT[variant], TRANSITION, FOCUS_RING, blocked && DISABLED, className)}
    >
      {loading ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : icon ? <span aria-hidden className="inline-flex [&>svg]:size-4">{icon}</span> : null}
      {children}
      {iconRight ? <span aria-hidden className="inline-flex [&>svg]:size-4">{iconRight}</span> : null}
    </button>
  );
  return disabledReason ? <Tooltip content={disabledReason}>{button}</Tooltip> : button;
}

export interface IconButtonProps extends Omit<ComponentProps<'button'>, 'children' | 'aria-label'> {
  /** Required: names the action for screen readers and shows as a tooltip. */
  label: string;
  /** The icon element, e.g. `<X className="size-4" />`. */
  icon: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabledReason?: string;
}

/**
 * Square icon-only button with a tooltip label.
 *
 *   <IconButton label="Close panel" icon={<X className="size-4" />} variant="ghost" onClick={close} />
 */
export function IconButton({ label, icon, variant = 'ghost', size = 'md', disabledReason, disabled, className, onClick, type = 'button', ...rest }: IconButtonProps) {
  const blocked = Boolean(disabledReason) || Boolean(disabled);
  const button = (
    <button
      {...rest}
      type={type}
      aria-label={label}
      disabled={disabled && !disabledReason}
      aria-disabled={blocked || undefined}
      onClick={(e) => {
        if (blocked) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      className={cx(BASE, ICON_SIZE[size], VARIANT[variant], TRANSITION, FOCUS_RING, blocked && DISABLED, className)}
    >
      <span aria-hidden className="inline-flex [&>svg]:size-4">{icon}</span>
    </button>
  );
  return <Tooltip content={disabledReason ? `${label}: ${disabledReason}` : label}>{button}</Tooltip>;
}
