import type { ReactNode } from 'react';
import { terms } from '@/lib/config/terminology';
import type { EvidenceRagStatus } from '@/lib/types';
import { StatusGlyph, TONE } from '../ui/status';

/** Categorical series colours (theme tokens `--di-chart-1..6`). */
export const CHART_COLORS = [
  'var(--di-chart-1)',
  'var(--di-chart-2)',
  'var(--di-chart-3)',
  'var(--di-chart-4)',
  'var(--di-chart-5)',
  'var(--di-chart-6)',
] as const;

/** Colour for the n-th category, cycling after six. */
export function chartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length] ?? CHART_COLORS[0];
}

/** Chart furniture colours (theme tokens). */
export const CHART_GRID = 'var(--di-chart-grid)';
export const CHART_AXIS = 'var(--di-chart-axis)';
export const CHART_TEXT = 'var(--di-fg-muted)';
export const CHART_TEXT_STRONG = 'var(--di-title)';
export const CHART_FONT = 'var(--di-font-sans)';

/** One slice of a part-to-whole chart. */
export interface Segment {
  id: string;
  label: string;
  value: number;
  /** Any CSS colour; use `chartColor(i)` or a `var(--di-status-*)` token. */
  color: string;
  /** Optional shape shown in the legend in place of a swatch (status shapes). */
  icon?: ReactNode;
}

const RAG_ORDER: EvidenceRagStatus[] = ['red', 'amber', 'green', 'unknown'];

/**
 * Turns RAG counts into segments (red, amber, green, unknown order) with
 * terminology labels and a status shape for the legend.
 *
 *   <StackedBar segments={ragSegments(summary.reportedRag)} />
 */
export function ragSegments(counts: Partial<Record<EvidenceRagStatus, number>>, order: EvidenceRagStatus[] = RAG_ORDER): Segment[] {
  return order.map((status) => ({
    id: status,
    label: terms.rag[status],
    value: counts[status] ?? 0,
    color: TONE[status].cssVar,
    icon: <StatusGlyph status={status} />,
  }));
}
