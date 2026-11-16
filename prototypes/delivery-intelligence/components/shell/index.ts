// Public entry point of the shell. Screens typically need only ProvenanceBadge(s) and usePageMeta / PageMeta.
export { AppShell } from './AppShell';
export { DemoControlSlot, DemoOverlaySlot } from './DemoSlot';
export { PageMeta, usePageMeta, type PageMetaValue } from './page-meta';
export { ProvenanceBadge, ProvenanceBadges, type ProvenanceBadgeProps } from './ProvenanceBadge';
export { ResetDemoButton } from './ResetDemoButton';
export { RoutePlaceholder } from './RoutePlaceholder';
export { ThemeSwitch } from './ThemeSwitch';
export { applyTheme, useTheme, type ThemeName } from './theme';
