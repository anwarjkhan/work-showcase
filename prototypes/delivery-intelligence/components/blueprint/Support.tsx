import { CircleCheck, CircleDashed, CircleOff } from 'lucide-react';
import { cx } from '@/components/ui';
import type { Support } from '@/lib/config/blueprint';

const STYLE = {
  yes: { Icon: CircleCheck, label: 'Yes', cls: 'text-status-green-fg bg-status-green-soft border-status-green-line' },
  partial: { Icon: CircleDashed, label: 'Partial', cls: 'text-status-amber-fg bg-status-amber-soft border-status-amber-line' },
  no: { Icon: CircleOff, label: 'No', cls: 'text-status-unknown-fg bg-status-unknown-soft border-status-unknown-line' },
} as const;

/** Yes / partial / no as text plus shape plus colour. */
export function SupportMark({ support }: { support: Support }) {
  const { Icon, label, cls } = STYLE[support];
  return (
    <span className={cx('inline-flex h-6 items-center gap-1 rounded-pill border px-2 text-xs font-medium', cls)}>
      <Icon aria-hidden className="size-3.5" strokeWidth={2.2} />
      {label}
    </span>
  );
}
