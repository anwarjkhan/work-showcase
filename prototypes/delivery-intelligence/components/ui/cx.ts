/** Joins class names, skipping falsy values. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** Visible keyboard focus: the theme's focus shadow in place of the default outline. */
export const FOCUS_RING = 'focus-visible:outline-none focus-visible:shadow-focus';

/** Standard colour/shadow transition using the theme's durations and easing. */
export const TRANSITION = 'transition-[color,background-color,border-color,box-shadow,opacity] duration-(--di-duration-fast) ease-standard';
