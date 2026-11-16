import { Bot } from 'lucide-react';
import { cx } from './cx';
import { uiText } from './labels';

const SIZE = {
  xs: 'size-5 text-[9px]',
  sm: 'size-6 text-[10px]',
  md: 'size-8 text-xs',
  lg: 'size-10 text-sm',
} as const;
const ICON = { xs: 'size-3', sm: 'size-3.5', md: 'size-4', lg: 'size-5' } as const;

export type AvatarProps = { size?: keyof typeof SIZE; className?: string } & (
  | { kind?: 'person'; /** Two-letter initials from `Person.initials`. */ initials: string; /** Full name, for the tooltip and screen readers. */ name: string }
  | { kind: 'agent'; /** Agent handle from `AgentIdentity.handle`. */ name: string; initials?: never }
);

/**
 * Person avatar: round, initials, accent tint. Agent avatar: rounded square with a bot glyph
 * in the scripted-agent colour, so the two are never confused.
 *
 *   <Avatar initials={person.initials} name={person.name} />
 *   <Avatar kind="agent" name={identity.handle} />
 */
export function Avatar(props: AvatarProps) {
  const { size = 'md', className } = props;
  if (props.kind === 'agent') {
    return (
      <span
        role="img"
        aria-label={`${uiText.agent}: ${props.name}`}
        title={`${uiText.agent}: ${props.name}`}
        className={cx('inline-flex shrink-0 items-center justify-center rounded-md border border-prov-scripted/35 bg-prov-scripted-soft text-prov-scripted', SIZE[size], className)}
      >
        <Bot aria-hidden className={ICON[size]} strokeWidth={2.1} />
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-label={props.name}
      title={props.name}
      className={cx('inline-flex shrink-0 items-center justify-center rounded-full border border-accent-line bg-accent-soft font-semibold tracking-wide text-accent', SIZE[size], className)}
    >
      {props.initials}
    </span>
  );
}

/**
 * Avatar with a name and optional secondary line beside it.
 *
 *   <AvatarLabel initials="AB" name="Ana Byrne" detail="Delivery lead" />
 *   <AvatarLabel kind="agent" name="agent-reqs-01" detail="Requirements structuring" />
 */
export function AvatarLabel(props: AvatarProps & { detail?: string }) {
  const { detail, ...avatar } = props;
  return (
    <span className="inline-flex min-w-0 items-center gap-2.5">
      <Avatar {...(avatar as AvatarProps)} size={props.size ?? 'md'} />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className={cx('truncate text-[13px] font-medium text-fg', props.kind === 'agent' && 'font-mono text-xs')}>{props.name}</span>
        {detail ? <span className="truncate text-xs text-fg-subtle">{detail}</span> : null}
      </span>
    </span>
  );
}

/** Overlapping avatars with a "+n" overflow, for pod membership. Pass already-built avatar props. */
export function AvatarStack({ items, max = 5, size = 'sm' }: { items: AvatarProps[]; max?: number; size?: keyof typeof SIZE }) {
  const shown = items.slice(0, max);
  const extra = items.length - shown.length;
  return (
    <span className="inline-flex items-center">
      {shown.map((a, i) => (
        <Avatar key={`${a.name}-${i}`} {...a} size={size} className={cx('ring-2 ring-surface', i > 0 && '-ml-1.5')} />
      ))}
      {extra > 0 ? (
        <span className={cx('-ml-1.5 inline-flex items-center justify-center rounded-full bg-inset font-semibold text-fg-muted ring-2 ring-surface', SIZE[size])}>+{extra}</span>
      ) : null}
    </span>
  );
}
