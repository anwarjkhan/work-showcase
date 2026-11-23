import { BookMarked, Bot, CalendarClock, Database, FlaskConical, Sigma, type LucideIcon } from 'lucide-react';
import { terms } from '@/lib/config/terminology';
import type { Provenance } from '@/lib/types';

/**
 * Says where a figure or screen comes from (design section 4). Always text
 * plus an icon shape, never colour alone. Works in server and client components.
 *
 *   <ProvenanceBadge kind="computed" />
 *   <ProvenanceBadge kind="scripted-agent" size="sm" />
 */

const STYLE: Record<Provenance, { Icon: LucideIcon; className: string }> = {
  sample: { Icon: Database, className: 'text-prov-sample bg-prov-sample-soft border-prov-sample/25' },
  computed: { Icon: Sigma, className: 'text-prov-computed bg-prov-computed-soft border-prov-computed/25' },
  'scripted-agent': { Icon: Bot, className: 'text-prov-scripted bg-prov-scripted-soft border-prov-scripted/25' },
  reported: { Icon: BookMarked, className: 'text-prov-reported bg-prov-reported-soft border-prov-reported/25' },
  planned: { Icon: CalendarClock, className: 'text-prov-planned bg-prov-planned-soft border-prov-planned/45 border-dashed' },
  simulated: { Icon: FlaskConical, className: 'text-prov-simulated bg-prov-simulated-soft border-prov-simulated/25' },
};

export interface ProvenanceBadgeProps {
  kind: Provenance;
  size?: 'sm' | 'md';
  /** Override the label (rare; defaults to terminology). */
  label?: string;
  className?: string;
}

export function ProvenanceBadge({ kind, size = 'md', label, className = '' }: ProvenanceBadgeProps) {
  const { Icon, className: tone } = STYLE[kind];
  const text = label ?? terms.provenance[kind];
  const sizing = size === 'sm' ? 'h-5 gap-1 px-1.5 text-[10.5px]' : 'h-6 gap-1.5 px-2 text-[11.5px]';
  return (
    <span
      className={`di-demo-label inline-flex shrink-0 items-center whitespace-nowrap rounded-pill border font-medium tracking-[0.01em] ${sizing} ${tone} ${className}`}
      title={terms.provenanceHelp[kind]}
      data-provenance={kind}
    >
      <Icon aria-hidden className={size === 'sm' ? 'size-3' : 'size-3.5'} strokeWidth={2.2} />
      {text}
    </span>
  );
}

/** A row of badges, de-duplicated, in the order given. */
export function ProvenanceBadges({ kinds, size, className = '' }: { kinds: Provenance[]; size?: 'sm' | 'md'; className?: string }) {
  const unique = [...new Set(kinds)];
  return (
    <span className={`di-demo-label inline-flex flex-wrap items-center gap-1.5 ${className}`} aria-label="Provenance">
      {unique.map((k) => (
        <ProvenanceBadge key={k} kind={k} size={size} />
      ))}
    </span>
  );
}
