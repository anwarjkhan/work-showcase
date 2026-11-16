/**
 * Mirrors of the theme's motion tokens for the `motion` library, which cannot
 * read CSS variables for easings. Keep in step with `--di-ease-*` and
 * `--di-duration-*` in `app/theme.css`.
 */
export const MOTION = {
  easeStandard: [0.2, 0.7, 0.2, 1] as [number, number, number, number],
  easeEmphasis: [0.16, 1, 0.3, 1] as [number, number, number, number],
  fast: 0.12,
  base: 0.2,
  slow: 0.36,
} as const;
