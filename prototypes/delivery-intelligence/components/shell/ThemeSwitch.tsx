'use client';

import { Moon, Sun } from 'lucide-react';
import { terms } from '@/lib/config/terminology';
import { useTheme, type ThemeName } from './theme';

const OPTIONS: Array<{ value: ThemeName; label: string; Icon: typeof Sun }> = [
  { value: 'light', label: terms.shell.themeLight, Icon: Sun },
  { value: 'dark', label: terms.shell.themeDark, Icon: Moon },
];

/** Segmented light / dark switch. The choice is remembered across visits. */
export function ThemeSwitch() {
  const [theme, setTheme] = useTheme();
  return (
    <div role="radiogroup" aria-label={terms.shell.themeSwitch} className="flex items-center rounded-pill border border-line bg-surface-2 p-0.5">
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            data-testid={`theme-${value}`}
            onClick={() => setTheme(value)}
            className={`flex h-7 items-center gap-1.5 rounded-pill px-2.5 text-xs font-medium transition-colors duration-150 ${
              active ? 'bg-surface text-fg shadow-card ring-1 ring-line' : 'text-fg-subtle hover:text-fg'
            }`}
          >
            <Icon aria-hidden className="size-3.5" strokeWidth={2} />
            <span className="max-[1535px]:sr-only">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
