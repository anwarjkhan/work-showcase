'use client';

import type { ReactNode } from 'react';
import { DemoOverlaySlot } from './DemoSlot';
import { PageMetaProvider } from './page-meta';
import { SideNav } from './SideNav';
import { TopBar } from './TopBar';

/**
 * The frame every route renders in: left navigation, sticky top bar, content.
 * Page content is placed in a centred column up to --di-content-max wide with
 * the standard gutter; pages should not add their own outer padding.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <PageMetaProvider>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-on-accent"
      >
        Skip to content
      </a>
      <div className="flex min-h-screen">
        <SideNav />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main id="main" className="flex-1 px-[var(--di-gutter)] pt-7 pb-16">
            <div className="mx-auto w-full max-w-[var(--di-content-max)]">{children}</div>
          </main>
        </div>
      </div>
      <DemoOverlaySlot />
    </PageMetaProvider>
  );
}
