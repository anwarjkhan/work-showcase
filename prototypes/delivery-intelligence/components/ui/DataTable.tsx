'use client';

import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-react';
import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cx, FOCUS_RING } from './cx';
import { EmptyState } from './EmptyState';
import { uiText } from './labels';

export type SortValue = string | number | boolean | null | undefined;

export interface Column<T> {
  id: string;
  header: ReactNode;
  /** Plain-text name for the sort button's accessible label. Defaults to `header` when it is a string. */
  headerLabel?: string;
  /** Renders the cell. Defaults to the accessor's value. */
  cell?: (row: T) => ReactNode;
  /** Value used for sorting (and as the default cell). A column is sortable when it has one. */
  accessor?: (row: T) => SortValue;
  /** Set false to keep an accessor but disable sorting. */
  sortable?: boolean;
  /** Right-aligned with tabular figures. */
  numeric?: boolean;
  align?: 'left' | 'center' | 'right';
  /** Minimum width in px. The table scrolls horizontally inside its own frame when columns need more. */
  minWidth?: number;
  /** Extra classes for body cells. */
  className?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  /** Stable id per row (used for keys, selection and `onRowClick`). */
  getRowId: (row: T) => string;
  /** Makes rows clickable and keyboard-activatable (Enter or Space). */
  onRowClick?: (row: T) => void;
  selectedId?: string | null;
  defaultSort?: { columnId: string; direction: 'asc' | 'desc' };
  /** CSS max-height of the scrolling area (e.g. 480 or "60vh"). The header stays pinned. */
  maxHeight?: number | string;
  /** Tighter rows. */
  dense?: boolean;
  /** Pin the first column while scrolling sideways. */
  stickyFirstColumn?: boolean;
  /** Shown when `rows` is empty. Defaults to a plain "No data" message. */
  empty?: ReactNode;
  /** Accessible table name. */
  ariaLabel: string;
  className?: string;
}

function compare(a: SortValue, b: SortValue): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1; // empty values last
  if (b === null || b === undefined) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a).localeCompare(String(b), 'en', { numeric: true, sensitivity: 'base' });
}

const ALIGN = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;

/**
 * Typed table: sortable columns, pinned header, clickable rows, horizontal scroll contained in its frame.
 *
 *   <DataTable
 *     ariaLabel="Deliverables"
 *     rows={deliverables}
 *     getRowId={(d) => d.id}
 *     onRowClick={(d) => router.push(hrefs.deliverable(d.id))}
 *     defaultSort={{ columnId: 'title', direction: 'asc' }}
 *     maxHeight={520}
 *     columns={[
 *       { id: 'title', header: 'Deliverable', accessor: (d) => d.title, minWidth: 260 },
 *       { id: 'rag', header: 'RAG', cell: (d) => <RagPill status={d.reportedRag} /> },
 *     ]}
 *   />
 */
export function DataTable<T>({ columns, rows, getRowId, onRowClick, selectedId, defaultSort, maxHeight, dense, stickyFirstColumn, empty, ariaLabel, className }: DataTableProps<T>) {
  const [sort, setSort] = useState<{ columnId: string; direction: 'asc' | 'desc' } | null>(defaultSort ?? null);

  const sorted = useMemo(() => {
    const col = sort ? columns.find((c) => c.id === sort.columnId) : undefined;
    if (!sort || !col?.accessor) return rows;
    const get = col.accessor;
    const dir = sort.direction === 'asc' ? 1 : -1;
    return rows
      .map((row, index) => ({ row, index }))
      .sort((a, b) => {
        const av = get(a.row);
        const bv = get(b.row);
        const empty = (v: SortValue) => v === null || v === undefined;
        if (empty(av) || empty(bv)) return compare(av, bv) || a.index - b.index; // empties stay last in both directions
        return dir * compare(av, bv) || a.index - b.index;
      })
      .map((x) => x.row);
  }, [rows, columns, sort]);

  const minTable = columns.reduce((sum, c) => sum + (c.minWidth ?? 96), 0);
  const pad = dense ? 'px-3 py-1.5' : 'px-4 py-2.5';

  const toggle = (id: string) =>
    setSort((prev) => (prev?.columnId === id ? { columnId: id, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { columnId: id, direction: 'asc' }));

  const onRowKey = (e: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onRowClick?.(row);
    }
  };

  return (
    <div className={cx('di-card min-w-0 overflow-hidden', className)}>
      <div className="max-w-full overflow-auto" style={{ maxHeight }}>
        <table aria-label={ariaLabel} className="w-full border-separate border-spacing-0 text-[13px] tabular-nums" style={{ minWidth: minTable }}>
          <thead>
            <tr>
              {columns.map((c, ci) => {
                const sortable = c.sortable ?? Boolean(c.accessor);
                const active = sort?.columnId === c.id ? sort.direction : null;
                const align = c.align ?? (c.numeric ? 'right' : 'left');
                const name = c.headerLabel ?? (typeof c.header === 'string' ? c.header : c.id);
                return (
                  <th
                    key={c.id}
                    scope="col"
                    aria-sort={active ? (active === 'asc' ? 'ascending' : 'descending') : sortable ? 'none' : undefined}
                    style={{ minWidth: c.minWidth ?? 96 }}
                    className={cx(
                      'sticky top-0 z-10 border-b border-line bg-surface-2 px-4 py-2.5 text-[11px] font-semibold tracking-[0.06em] whitespace-nowrap text-fg-muted uppercase',
                      ALIGN[align],
                      dense && 'px-3 py-2',
                      stickyFirstColumn && ci === 0 && 'left-0 z-20 border-r',
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => toggle(c.id)}
                        aria-label={`${uiText.sortBy} ${name}`}
                        className={cx('inline-flex items-center gap-1 rounded-xs uppercase transition-colors duration-(--di-duration-fast) hover:text-fg', FOCUS_RING, align === 'right' && 'flex-row-reverse', active && 'text-fg')}
                      >
                        {c.header}
                        {active === 'asc' ? <ChevronUp aria-hidden className="size-3.5 text-accent" /> : active === 'desc' ? <ChevronDown aria-hidden className="size-3.5 text-accent" /> : <ChevronsUpDown aria-hidden className="size-3.5 text-fg-subtle" />}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const id = getRowId(row);
              const selected = selectedId === id;
              return (
                <tr
                  key={id}
                  aria-selected={onRowClick ? selected : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? (e) => onRowKey(e, row) : undefined}
                  className={cx(
                    'group',
                    selected ? 'bg-selected' : 'bg-surface',
                    onRowClick && cx('cursor-pointer hover:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus'),
                  )}
                >
                  {columns.map((c, ci) => {
                    const align = c.align ?? (c.numeric ? 'right' : 'left');
                    const content = c.cell ? c.cell(row) : c.accessor ? String(c.accessor(row) ?? '') : null;
                    return (
                      <td
                        key={c.id}
                        className={cx(
                          'border-b border-line align-middle text-fg',
                          pad,
                          ALIGN[align],
                          stickyFirstColumn && ci === 0 && 'sticky left-0 z-[1] border-r bg-surface',
                          c.className,
                        )}
                      >
                        {content}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 ? (empty ?? <EmptyState variant="inline" title={uiText.noData} />) : null}
      </div>
    </div>
  );
}
