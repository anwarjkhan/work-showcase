import { GitCompareArrows } from 'lucide-react';
import type { ReactNode } from 'react';
import { terms } from '@/lib/config/terminology';
import type { EvidenceRagStatus, RagStatus, ReadinessState, Severity } from '@/lib/types';
import { BADGE_SIZE } from './Badge';
import { cx } from './cx';
import { uiText } from './labels';
import { RAG_ICON, READINESS_ICON, READINESS_TONE, SEVERITY_ICON, SEVERITY_TONE, TONE } from './status';

type PillSize = 'sm' | 'md' | 'lg';

function Pill({ tone, Icon, size, label, className, title }: {
  tone: keyof typeof TONE;
  Icon: typeof RAG_ICON.red;
  size: PillSize;
  label: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cx(
        'inline-flex shrink-0 items-center whitespace-nowrap rounded-pill border font-semibold tracking-[0.01em]',
        BADGE_SIZE[size],
        TONE[tone].pill,
        className,
      )}
    >
      <Icon aria-hidden className={cx('shrink-0', TONE[tone].icon, size === 'sm' ? 'size-3' : 'size-3.5')} strokeWidth={2.4} />
      {label}
    </span>
  );
}

export interface RagPillProps {
  status: EvidenceRagStatus;
  size?: PillSize;
  /** Override the visible text (rare). Defaults to the terminology label. */
  label?: string;
  className?: string;
}

/**
 * RAG status: text plus a distinct shape (check circle, triangle, octagon, question circle) plus colour.
 *
 *   <RagPill status={deliverable.reportedRag} />
 */
export function RagPill({ status, size = 'md', label, className }: RagPillProps) {
  return <Pill tone={status} Icon={RAG_ICON[status]} size={size} label={label ?? terms.rag[status]} className={className} />;
}

export interface RagPairProps {
  reported: RagStatus;
  evidence: EvidenceRagStatus;
  /** Defaults to: they differ and evidence is not unknown (same rule as the engine). */
  disagrees?: boolean;
  /** `inline` puts both on one row (tables); `stacked` shows labelled rows (cards). */
  layout?: 'inline' | 'stacked';
  size?: PillSize;
  className?: string;
}

/**
 * Reported RAG beside evidence-based RAG, flagging disagreement with an outlined
 * container, an icon and the word "Disagreement".
 *
 *   <RagPair reported={rag.reported} evidence={rag.evidence} disagrees={rag.disagrees} />
 */
export function RagPair({ reported, evidence, disagrees, layout = 'inline', size = 'md', className }: RagPairProps) {
  const differs = disagrees ?? (evidence !== 'unknown' && evidence !== reported);
  const flag = differs ? (
    <span className={cx('inline-flex items-center gap-1 text-[11px] font-semibold', TONE.amber.text)}>
      <GitCompareArrows aria-hidden className="size-3.5 text-status-amber" strokeWidth={2.2} />
      {uiText.disagreement}
    </span>
  ) : null;

  if (layout === 'stacked') {
    return (
      <div
        data-disagrees={differs || undefined}
        className={cx(
          'flex flex-col gap-2 rounded-md border p-3',
          differs ? 'border-status-amber-line bg-status-amber-soft' : 'border-line bg-surface-2',
          className,
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-fg-muted">{terms.ragKinds.reported}</span>
          <RagPill status={reported} size={size} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-fg-muted">{terms.ragKinds.evidence}</span>
          <RagPill status={evidence} size={size} />
        </div>
        {flag}
      </div>
    );
  }

  return (
    <span
      data-disagrees={differs || undefined}
      className={cx(
        'inline-flex items-center gap-2 rounded-pill border py-0.5 pr-2.5 pl-1',
        differs ? 'border-status-amber-line bg-status-amber-soft' : 'border-line bg-transparent',
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        <span className="sr-only">{terms.ragKinds.reported}: </span>
        <RagPill status={reported} size={size} />
      </span>
      <span aria-hidden className="text-fg-subtle">/</span>
      <span className="inline-flex items-center gap-1.5">
        <span className="sr-only">{terms.ragKinds.evidence}: </span>
        <RagPill status={evidence} size={size} />
      </span>
      {flag}
    </span>
  );
}

/**
 * Delivery readiness: ready / not ready / unknown, never a percentage.
 *
 *   <ReadinessPill state={measures.readiness.state} />
 */
export function ReadinessPill({ state, size = 'md', className }: { state: ReadinessState; size?: PillSize; className?: string }) {
  return <Pill tone={READINESS_TONE[state]} Icon={READINESS_ICON[state]} size={size} label={terms.readiness[state]} className={className} />;
}

/**
 * Severity of a finding or RAID item.
 *
 *   <SeverityBadge severity={finding.severity} />
 */
export function SeverityBadge({ severity, size = 'md', className }: { severity: Severity; size?: PillSize; className?: string }) {
  return <Pill tone={SEVERITY_TONE[severity]} Icon={SEVERITY_ICON[severity]} size={size} label={terms.severity[severity]} className={className} />;
}
