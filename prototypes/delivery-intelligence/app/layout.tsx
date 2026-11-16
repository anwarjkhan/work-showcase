import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
// Fonts are bundled from npm packages: nothing is fetched at build or run time.
import '@fontsource-variable/inter/opsz.css';
import '@fontsource-variable/plus-jakarta-sans/index.css';
import '@fontsource-variable/jetbrains-mono/index.css';
import './globals.css';
import { AppShell } from '@/components/shell/AppShell';
import { THEME_INIT_SCRIPT } from '@/components/shell/theme-script';
import { terms } from '@/lib/config/terminology';
import { DemoStoreProvider } from '@/lib/store/provider';

export const metadata: Metadata = {
  title: { default: terms.app.name, template: `%s · ${terms.app.name}` },
  description: terms.app.tagline,
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // data-theme is set by the inline script before paint; React must not fight it.
    <html lang="en-GB" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <DemoStoreProvider>
          <AppShell>{children}</AppShell>
        </DemoStoreProvider>
      </body>
    </html>
  );
}
