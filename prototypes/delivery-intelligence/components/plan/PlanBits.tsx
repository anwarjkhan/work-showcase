'use client';

import { CircleCheck, Diamond, Landmark, OctagonX, TriangleAlert } from 'lucide-react';
import { cx } from '@/components/ui';
import { StatusGlyph } from '@/components/ui/status';

import { terms } from '@/lib/config/terminology';
import type { Computable, EvidenceRagStatus, Milestone, RagStatus, WorkCompletion } from '@/lib/types';
import { formatDateCached as formatDate, type MilestoneRisk } from './layout';

/** Copy used on this screen only (no system, template or status names here: those come from `terms`). */
export const planText = {
  standalone: terms.routes.standalone,
  standaloneShort: 'Standalone',
  regulatory: 'Regulatory',
  regulatoryShort: 'REG',
  milestones: 'Milestones',
  noOutcome: `No ${terms.hierarchy.outcomeIdField}`,
  today: 'Today',
  forecastSlip: 'Forecast slip',
  knockOn: 'Dependency knock-on',
  planned: 'Planned span',
  done: 'Work completion',
  inbound: 'Late dependency in',
  outbound: 'Late dependency out',
  risk: {
    missed: 'Missed',
    overdue: 'Past due, not met',
    shifted: 'Pushed by a late dependency',
    r1: 'At risk: too little linked work closed',
  } satisfies Record<MilestoneRisk, string>,
};

/** Reported / evidence-based RAG as two status shapes, outlined when they disagree. */
export function MiniRag({ reported, evidence, disagrees }: { reported: RagStatus; evidence: EvidenceRagStatus; disagrees: boolean }) {
  const label = `${terms.ragKinds.reported} ${terms.rag[reported]}, ${terms.ragKinds.evidence} ${terms.rag[evidence]}${disagrees ? ' (disagreement)' : ''}`;
  return (
    <span
      title={label}
      className={cx(
        'inline-flex h-5 shrink-0 items-center gap-0.5 rounded-pill border px-1',
        disagrees ? 'border-status-amber-line bg-status-amber-soft' : 'border-transparent',
      )}
    >
      <span className="sr-only">{label}</span>
      <StatusGlyph status={reported} className="size-3.5" />
      <span aria-hidden className="text-[10px] text-fg-subtle">/</span>
      <StatusGlyph status={evidence} className="size-3.5" />
    </span>
  );
}

/** Compact work-completion figure; "n/c" with the reason when not computable. */
export function ProgressFigure({ value }: { value: Computable<WorkCompletion> | undefined }) {
  if (!value || !value.computable) {
    return (
      <span title={value && !value.computable ? `${terms.measures.notComputable}: ${value.detail}` : terms.measures.notComputable} className="w-9 shrink-0 text-right text-[11px] text-fg-subtle tabular-nums">
        n/c
      </span>
    );
  }
  return (
    <span title={`${terms.measures.workCompletion} ${value.value.percent}%`} className="w-9 shrink-0 text-right text-[12px] font-semibold text-fg tabular-nums">
      {value.value.percent}
      <span className="text-[10px] font-normal text-fg-subtle">%</span>
    </span>
  );
}

/**
 * Milestone marker: diamond for an ordinary milestone; a landmark shape with a
 * "REG" tag for a regulatory one. Missed or at-risk ones carry a status shape.
 */
export function MilestoneMark({
  milestone,
  risk,
  ghost,
  showTitle,
  flip,
  size = 'md',
}: {
  milestone: Milestone;
  risk: MilestoneRisk | null;
  ghost?: boolean;
  showTitle?: boolean;
  /** Put the tag and title on the left of the marker (near the right edge). */
  flip?: boolean;
  size?: 'sm' | 'md';
}) {
  const reg = milestone.regulatory;
  const met = milestone.status === 'met';
  const bad = risk === 'missed' || risk === 'overdue';
  const tone = bad ? 'text-status-red' : risk ? 'text-status-amber' : met ? 'text-status-green' : reg ? 'text-heading' : 'text-fg-muted';
  const Shape = reg ? Landmark : Diamond;
  const dim = size === 'sm' ? 'size-3' : 'size-3.5';
  const title = `${reg ? `${planText.regulatory} milestone` : 'Milestone'}: ${milestone.title}, ${formatDate(milestone.date)}${met ? ' (met)' : ''}${risk ? `. ${planText.risk[risk]}` : ''}`;
  const tag = reg && !ghost;
  return (
    <span className={cx('pointer-events-auto relative inline-flex -translate-x-1/2', ghost && 'opacity-90')} title={title}>
      <span
        className={cx(
          'relative inline-flex items-center justify-center rounded-xs',
          ghost ? 'border border-dashed border-status-amber bg-surface' : 'bg-surface',
          size === 'sm' ? 'size-4' : 'size-[18px]',
        )}
      >
        <Shape aria-hidden className={cx(dim, ghost ? 'text-status-amber' : tone, !ghost && !reg && 'fill-current')} strokeWidth={2.2} />
        {!ghost && (bad || risk) ? (
          <span className="absolute -top-1 -right-1.5 inline-flex rounded-pill bg-surface">
            {bad ? <OctagonX aria-hidden className="size-2.5 text-status-red" strokeWidth={2.6} /> : <TriangleAlert aria-hidden className="size-2.5 text-status-amber" strokeWidth={2.6} />}
          </span>
        ) : null}
        {!ghost && met ? (
          <span className="absolute -top-1 -right-1.5 inline-flex rounded-pill bg-surface">
            <CircleCheck aria-hidden className="size-2.5 text-status-green" strokeWidth={2.6} />
          </span>
        ) : null}
      </span>
      {tag || showTitle ? (
        <span className={cx('absolute top-1/2 flex -translate-y-1/2 items-center gap-1 whitespace-nowrap', flip ? 'right-full mr-1.5 flex-row-reverse' : 'left-full ml-1.5')}>
          {tag ? <span className="rounded-xs border border-accent-line bg-accent-soft px-0.5 text-[8.5px] leading-[12px] font-bold tracking-wider text-heading">{planText.regulatoryShort}</span> : null}
          {showTitle ? (
            <span className={cx('max-w-[180px] truncate text-[11px]', ghost ? 'text-status-amber-fg italic' : 'text-fg-muted')}>
              {ghost ? `moves to ${formatDate(milestone.date, { withYear: false })}` : milestone.title}
            </span>
          ) : null}
        </span>
      ) : null}
      <span className="sr-only">{title}</span>
    </span>
  );
}
