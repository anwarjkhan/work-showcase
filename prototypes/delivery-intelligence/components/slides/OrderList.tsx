'use client';
/** An ordered list with keyboard-reachable up, down and remove buttons. */
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import { IconButton } from '@/components/ui';

export interface OrderItem {
  id: string;
  label: string;
}

export function OrderList({ items, onMove, onRemove, label }: { items: OrderItem[]; onMove: (id: string, delta: -1 | 1) => void; onRemove: (id: string) => void; label: string }) {
  return (
    <ol aria-label={label} data-testid="order-list" className="m-0 flex list-none flex-col gap-1 p-0">
      {items.map((it, i) => (
        <li key={it.id} className="flex items-center gap-2 rounded-md border border-line bg-surface px-2 py-1" data-testid="order-item">
          <span className="w-5 shrink-0 text-right text-xs text-fg-subtle tabular-nums">{i + 1}</span>
          <span className="min-w-0 flex-1 truncate text-[13px] text-fg">{it.label}</span>
          <IconButton label={`Move up: ${it.label}`} icon={<ArrowUp />} size="sm" variant="ghost" disabledReason={i === 0 ? 'Already first' : undefined} onClick={() => onMove(it.id, -1)} />
          <IconButton label={`Move down: ${it.label}`} icon={<ArrowDown />} size="sm" variant="ghost" disabledReason={i === items.length - 1 ? 'Already last' : undefined} onClick={() => onMove(it.id, 1)} />
          <IconButton label={`Remove: ${it.label}`} icon={<X />} size="sm" variant="ghost" onClick={() => onRemove(it.id)} />
        </li>
      ))}
    </ol>
  );
}
