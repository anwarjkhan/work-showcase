'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Radar } from 'lucide-react';
import { formatDate } from '@/lib/config/clock';
import { NAV_GROUP_LABELS, ROUTES, routeForPath, type NavGroup } from '@/lib/config/routes';
import { terms } from '@/lib/config/terminology';
import { useClock, useDemoState } from '@/lib/store';
import { NAV_ICONS } from './nav-icons';
import { PortfolioSwitcher } from './PortfolioSwitcher';

const GROUP_ORDER: NavGroup[] = ['portfolio', 'delivery', 'adoption', 'build'];

/** Left navigation: every route of design section 4, grouped. */
export function SideNav() {
  const pathname = usePathname() ?? '/';
  const activeId = routeForPath(pathname)?.id;
  const clock = useClock();
  const sourceKind = useDemoState((s) => s.data.meta.sourceKind);

  return (
    <nav
      aria-label={terms.shell.navLabel}
      className="sticky top-0 z-40 flex h-screen w-[var(--di-nav-width)] shrink-0 flex-col border-r border-nav-line bg-nav bg-gradient-to-b from-nav to-nav-2 text-nav-fg"
    >
      {/* Product wordmark: text only, no brand mark. */}
      <div className="flex h-[var(--di-topbar-height)] items-center gap-3 border-b border-nav-line px-5">
        <span className="grid size-8 place-items-center rounded-md bg-nav-active text-nav-indicator ring-1 ring-nav-indicator/40">
          <Radar aria-hidden className="size-[18px]" strokeWidth={2} />
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate font-display text-[15px] font-semibold tracking-[-0.01em] text-nav-fg-strong">{terms.app.name}</span>
          <span className="truncate text-[11px] text-nav-muted">{terms.app.navSubtitle}</span>
        </span>
      </div>

      <PortfolioSwitcher />

      <div className="flex-1 overflow-y-auto px-3 py-4">
        {GROUP_ORDER.map((group) => (
          <div key={group} className="mb-5 last:mb-0">
            <div className="mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-nav-muted">{NAV_GROUP_LABELS[group]}</div>
            <ul className="flex flex-col gap-0.5">
              {ROUTES.filter((r) => r.group === group).map((route) => {
                const Icon = NAV_ICONS[route.icon];
                const active = route.id === activeId;
                return (
                  <li key={route.id}>
                    <Link
                      href={route.navHref}
                      aria-current={active ? 'page' : undefined}
                      data-testid={`nav-${route.id}`}
                      className={`group relative flex h-9 items-center gap-3 rounded-md px-3 text-[13.5px] font-medium transition-colors duration-150 focus-visible:outline-nav-indicator ${
                        active ? 'bg-nav-active text-nav-fg-strong' : 'text-nav-fg hover:bg-nav-hover hover:text-nav-fg-strong'
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`absolute top-2 bottom-2 left-0 w-[3px] rounded-r-pill bg-nav-indicator transition-opacity duration-200 ${active ? 'opacity-100' : 'opacity-0'}`}
                      />
                      <Icon aria-hidden className={`size-[17px] shrink-0 ${active ? 'text-nav-indicator' : 'text-nav-muted group-hover:text-nav-fg'}`} strokeWidth={1.9} />
                      <span className="truncate">{route.navLabel}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-nav-line px-5 py-4 text-[11.5px] leading-relaxed">
        <div className="flex items-center justify-between gap-2">
          <span className="text-nav-muted">{terms.shell.demoClock}</span>
          <span className="font-mono text-nav-fg-strong">{formatDate(clock.today)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-nav-muted">{terms.shell.dataSource}</span>
          <span className="text-nav-fg">{sourceKind === 'jira' ? terms.systems['work-tracker'] : 'Synthetic'}</span>
        </div>
        <p className="mt-2 text-[10.5px] text-nav-muted">{terms.app.demoNotice}</p>
      </div>
    </nav>
  );
}
