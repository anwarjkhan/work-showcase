import {
  ChevronDown,
  CircleCheck,
  CircleHelp,
  Diamond,
  OctagonAlert,
  OctagonX,
  ShieldCheck,
  ShieldQuestionMark,
  ShieldX,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import type { EvidenceRagStatus, ReadinessState, Severity } from '@/lib/types';

/** The four status tones that exist in the theme. */
export type StatusTone = 'red' | 'amber' | 'green' | 'unknown';

/**
 * Static class strings per tone (Tailwind needs literal names).
 * `pill` = soft fill + readable text + line; `icon` = base colour for marks;
 * `fill` = solid background for bars.
 */
export const TONE: Record<StatusTone, { pill: string; text: string; icon: string; fill: string; cssVar: string }> = {
  red: {
    pill: 'bg-status-red-soft text-status-red-fg border-status-red-line',
    text: 'text-status-red-fg',
    icon: 'text-status-red',
    fill: 'bg-status-red',
    cssVar: 'var(--di-status-red)',
  },
  amber: {
    pill: 'bg-status-amber-soft text-status-amber-fg border-status-amber-line',
    text: 'text-status-amber-fg',
    icon: 'text-status-amber',
    fill: 'bg-status-amber',
    cssVar: 'var(--di-status-amber)',
  },
  green: {
    pill: 'bg-status-green-soft text-status-green-fg border-status-green-line',
    text: 'text-status-green-fg',
    icon: 'text-status-green',
    fill: 'bg-status-green',
    cssVar: 'var(--di-status-green)',
  },
  unknown: {
    pill: 'bg-status-unknown-soft text-status-unknown-fg border-status-unknown-line',
    text: 'text-status-unknown-fg',
    icon: 'text-status-unknown',
    fill: 'bg-status-unknown',
    cssVar: 'var(--di-status-unknown)',
  },
};

/** RAG shapes: circle-check, triangle, octagon, question circle. Distinct silhouettes, so never colour alone. */
export const RAG_ICON: Record<EvidenceRagStatus, LucideIcon> = {
  green: CircleCheck,
  amber: TriangleAlert,
  red: OctagonX,
  unknown: CircleHelp,
};

export const READINESS_ICON: Record<ReadinessState, LucideIcon> = {
  ready: ShieldCheck,
  'not-ready': ShieldX,
  unknown: ShieldQuestionMark,
};

export const READINESS_TONE: Record<ReadinessState, StatusTone> = {
  ready: 'green',
  'not-ready': 'red',
  unknown: 'unknown',
};

export const SEVERITY_ICON: Record<Severity, LucideIcon> = {
  critical: OctagonAlert,
  high: TriangleAlert,
  medium: Diamond,
  low: ChevronDown,
};

export const SEVERITY_TONE: Record<Severity, StatusTone> = {
  critical: 'red',
  high: 'amber',
  medium: 'unknown',
  low: 'unknown',
};

/**
 * Just the status shape in its status colour, for legends and dense lists.
 * Always pair with text.
 *
 *   <StatusGlyph status="amber" />
 */
export function StatusGlyph({ status, className = 'size-3.5' }: { status: EvidenceRagStatus; className?: string }) {
  const Icon = RAG_ICON[status];
  return <Icon aria-hidden className={`${className} shrink-0 ${TONE[status].icon}`} strokeWidth={2.2} />;
}
