'use client';

import { usePathname } from 'next/navigation';
import { NAV_GROUP_LABELS, routeForPath } from '@/lib/config/routes';
import { BasketControl } from '@/components/slides/BasketControl';
import { DemoControlSlot } from './DemoSlot';
import { useCurrentPageMeta } from './page-meta';
import { ProvenanceBadges } from './ProvenanceBadge';
import { ResetDemoButton } from './ResetDemoButton';
import { LabelsToggle } from './LabelsToggle';
import { ThemeSwitch } from './ThemeSwitch';

/** Page title, provenance, guided-demo control, theme switch and reset. */
export function TopBar() {
  const pathname = usePathname() ?? '/';
  const route = routeForPath(pathname);
  const meta = useCurrentPageMeta();
  const title = meta.title ?? route?.title ?? '';
  const provenance = meta.provenance ?? route?.provenance ?? [];

  return (
    <header className="sticky top-0 z-30 flex h-[var(--di-topbar-height)] shrink-0 items-center gap-6 border-b border-topbar-line bg-topbar px-[var(--di-gutter)] backdrop-blur-md backdrop-saturate-150">
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="flex min-w-0 items-center gap-2 text-[11px] font-medium uppercase tracking-[0.09em] text-fg-subtle">
          {route && <span className="shrink-0">{NAV_GROUP_LABELS[route.group]}</span>}
          {meta.subtitle && (
            <>
              <span aria-hidden className="text-line-strong">/</span>
              <span className="truncate normal-case tracking-normal">{meta.subtitle}</span>
            </>
          )}
        </div>
        <h1 data-testid="page-title" className="truncate font-display text-[21px] leading-tight font-semibold text-title max-[1535px]:text-[19px]">
          {title}
        </h1>
      </div>

      <ProvenanceBadges kinds={provenance} className="hidden shrink-0 justify-end min-[1280px]:inline-flex" />
      {/* Labels off: the page provenance pills hide; this quiet marker says what the screen is. */}
      <span data-testid="prototype-marker" className="di-labels-off-only shrink-0 text-[11px] font-medium tracking-[0.09em] text-fg-subtle uppercase">
        Prototype
      </span>

      <div className="flex shrink-0 items-center gap-2.5">
        <DemoControlSlot />
        <span aria-hidden className="mx-0.5 h-6 w-px bg-line" />
        <BasketControl />
        <LabelsToggle />
        <ThemeSwitch />
        <ResetDemoButton />
      </div>
    </header>
  );
}
