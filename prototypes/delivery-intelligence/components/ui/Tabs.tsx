'use client';

import { createContext, useContext, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cx, FOCUS_RING } from './cx';
import { Tooltip } from './Tooltip';

export interface TabItem {
  id: string;
  label: string;
  /** Small count after the label. */
  count?: number;
  icon?: ReactNode;
  /** Makes the tab unavailable and shows why in a tooltip. */
  disabledReason?: string;
}

interface TabsContextValue {
  base: string;
  value: string;
}
const TabsContext = createContext<TabsContextValue | null>(null);

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  /** `underline` for page and card sections; `segmented` for compact view switches. */
  variant?: 'underline' | 'segmented';
  ariaLabel: string;
  /** `TabPanel` children. Omit when the tabs only switch a view you render yourself. */
  children?: ReactNode;
  className?: string;
}

/**
 * Controlled tabs with roving focus (arrow keys, Home, End). Panels are `TabPanel`s.
 *
 *   const [tab, setTab] = useState('evidence');
 *   <Tabs ariaLabel="Deliverable sections" items={[{ id: 'evidence', label: 'Evidence', count: 6 }, { id: 'raid', label: 'RAID' }]} value={tab} onChange={setTab}>
 *     <TabPanel id="evidence">...</TabPanel>
 *     <TabPanel id="raid">...</TabPanel>
 *   </Tabs>
 */
export function Tabs({ items, value, onChange, variant = 'underline', ariaLabel, children, className }: TabsProps) {
  const base = useId();
  const listRef = useRef<HTMLDivElement>(null);

  const enabled = items.filter((t) => !t.disabledReason);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const idx = enabled.findIndex((t) => t.id === value);
    let next: TabItem | undefined;
    if (e.key === 'ArrowRight') next = enabled[(idx + 1) % enabled.length];
    else if (e.key === 'ArrowLeft') next = enabled[(idx - 1 + enabled.length) % enabled.length];
    else if (e.key === 'Home') next = enabled[0];
    else if (e.key === 'End') next = enabled[enabled.length - 1];
    if (!next) return;
    e.preventDefault();
    onChange(next.id);
    listRef.current?.querySelector<HTMLElement>(`[data-tab="${CSS.escape(next.id)}"]`)?.focus();
  };

  const list = (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cx(
        'flex items-center',
        variant === 'underline' ? 'gap-5 border-b border-line' : 'w-fit gap-0.5 rounded-pill border border-line bg-surface-2 p-0.5',
        !children && className,
      )}
    >
      {items.map((t) => {
        const selected = t.id === value;
        const blocked = Boolean(t.disabledReason);
        const tab = (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`${base}-tab-${t.id}`}
            data-tab={t.id}
            aria-selected={selected}
            aria-controls={`${base}-panel-${t.id}`}
            aria-disabled={blocked || undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => !blocked && onChange(t.id)}
            className={cx(
              'inline-flex items-center gap-1.5 whitespace-nowrap font-medium transition-colors duration-(--di-duration-fast) ease-standard',
              FOCUS_RING,
              variant === 'underline'
                ? cx('-mb-px h-10 border-b-2 text-[13px]', selected ? 'border-accent text-title' : 'border-transparent text-fg-muted hover:text-fg')
                : cx('h-7 rounded-pill px-3 text-xs', selected ? 'bg-surface text-title shadow-card ring-1 ring-line' : 'text-fg-muted hover:text-fg'),
              blocked && 'cursor-not-allowed opacity-50',
            )}
          >
            {t.icon ? <span aria-hidden className="inline-flex [&>svg]:size-3.5">{t.icon}</span> : null}
            {t.label}
            {t.count !== undefined ? (
              <span className={cx('rounded-pill px-1.5 text-[10.5px] leading-[18px] tabular-nums', selected ? 'bg-accent-soft text-accent' : 'bg-inset text-fg-muted')}>{t.count}</span>
            ) : null}
          </button>
        );
        return blocked ? (
          <Tooltip key={t.id} content={t.disabledReason}>
            {tab}
          </Tooltip>
        ) : (
          tab
        );
      })}
    </div>
  );

  if (!children) return list;
  return (
    <TabsContext.Provider value={{ base, value }}>
      <div className={cx('flex min-w-0 flex-col gap-4', className)}>
        {list}
        {children}
      </div>
    </TabsContext.Provider>
  );
}

/** Content for one tab. Renders only while its tab is selected. Must sit inside `Tabs`. */
export function TabPanel({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  const ctx = useContext(TabsContext);
  if (!ctx || ctx.value !== id) return null;
  return (
    <div role="tabpanel" id={`${ctx.base}-panel-${id}`} aria-labelledby={`${ctx.base}-tab-${id}`} tabIndex={0} className={cx('min-w-0 rounded-md', FOCUS_RING, className)}>
      {children}
    </div>
  );
}
