'use client';
/** Searchable single choice from a long list: a search box over a scrollable list; Up and Down move between rows. */
import { Check, Search } from 'lucide-react';
import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { cx, FOCUS_RING } from '@/components/ui/cx';

export interface PickerOption {
  key: string;
  /** Record ref in mono, when there is one. */
  ref?: string;
  label: string;
  detail?: string;
}

export function EntityPicker({ options, value, onChange, label }: { options: PickerOption[]; value: string | null; onChange: (key: string) => void; label: string }) {
  const [query, setQuery] = useState('');
  const listRef = useRef<HTMLUListElement>(null);
  const searchId = useId();
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => `${o.ref ?? ''} ${o.label} ${o.detail ?? ''}`.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const buttons = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = buttons[at + (e.key === 'ArrowDown' ? 1 : -1)];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={searchId} className="sr-only">{`Search ${label}`}</label>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-fg-subtle" />
        <input
          id={searchId}
          type="search"
          data-testid="entity-search"
          value={query}
          placeholder={`Search ${label}`}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              listRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
            }
          }}
          className={cx('h-9 w-full rounded-md border border-line-strong bg-surface pr-3 pl-8 text-[13px] text-fg placeholder:text-fg-subtle', FOCUS_RING)}
        />
      </div>
      <ul ref={listRef} onKeyDown={onKeyDown} aria-label={label} data-testid="entity-list" className="m-0 max-h-72 list-none overflow-y-auto rounded-md border border-line p-0">
        {shown.length === 0 ? <li className="px-3 py-3 text-[13px] text-fg-muted">Nothing matches that search.</li> : null}
        {shown.map((o) => {
          const on = o.key === value;
          return (
            <li key={o.key} className="border-b border-line last:border-b-0">
              <button
                type="button"
                aria-pressed={on}
                data-testid="entity-option"
                data-key={o.key}
                onClick={() => onChange(o.key)}
                className={cx('flex w-full items-start gap-2 px-3 py-2 text-left text-[13px] hover:bg-hover focus-visible:shadow-[inset_0_0_0_2px_var(--di-accent)] focus-visible:outline-none', on && 'bg-selected')}
              >
                <Check aria-hidden className={cx('mt-0.5 size-3.5 shrink-0', on ? 'text-accent' : 'text-transparent')} />
                <span className="min-w-0">
                  <span className="block text-fg">
                    {o.ref ? <span className="mr-1.5 font-mono text-xs font-semibold text-title">{o.ref}</span> : null}
                    {o.label}
                  </span>
                  {o.detail ? <span className="block truncate text-xs text-fg-muted">{o.detail}</span> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
