'use client';

import { CheckCircle2, CircleDashed, CircleDot, Clock3, FileWarning, Hourglass, Undo2, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { terms } from '@/lib/config/terminology';
import { Badge } from '@/components/ui';
import type { EvidenceHeldState, EvidenceResult, ReviewState, WorkProductState } from '@/lib/types';

export function ResultBadge({ result }: { result: EvidenceResult | 'missing' }) {
  if (result === 'missing') return <Badge size="sm" tone="unknown" icon={<CircleDashed />}>{terms.evidenceHeld.missing}</Badge>;
  if (result === 'pass') return <Badge size="sm" tone="green" icon={<CheckCircle2 />}>{terms.evidenceResults.pass}</Badge>;
  if (result === 'fail') return <Badge size="sm" tone="red" icon={<XCircle />}>{terms.evidenceResults.fail}</Badge>;
  return <Badge size="sm" tone="amber" icon={<Hourglass />}>{terms.evidenceResults.pending}</Badge>;
}

export function HeldBadge({ state }: { state: EvidenceHeldState }) {
  const map: Record<EvidenceHeldState, { tone: 'green' | 'red' | 'amber' | 'unknown'; icon: ReactNode }> = {
    passing: { tone: 'green', icon: <CheckCircle2 /> },
    failing: { tone: 'red', icon: <XCircle /> },
    pending: { tone: 'amber', icon: <Hourglass /> },
    stale: { tone: 'amber', icon: <Clock3 /> },
    missing: { tone: 'unknown', icon: <CircleDashed /> },
  };
  return (
    <Badge size="sm" tone={map[state].tone} icon={map[state].icon}>
      {terms.evidenceHeld[state]}
    </Badge>
  );
}

const REVIEW_LABEL: Record<ReviewState, string> = {
  'not-requested': 'Not requested',
  pending: 'Pending',
  approved: 'Approved',
  returned: 'Returned',
};

export function ReviewStateBadge({ state }: { state: ReviewState }) {
  switch (state) {
    case 'approved':
      return <Badge size="sm" tone="green" icon={<CheckCircle2 />}>{REVIEW_LABEL[state]}</Badge>;
    case 'pending':
      return <Badge size="sm" tone="amber" icon={<Hourglass />}>{REVIEW_LABEL[state]}</Badge>;
    case 'returned':
      return <Badge size="sm" tone="red" icon={<Undo2 />}>{REVIEW_LABEL[state]}</Badge>;
    default:
      return <Badge size="sm" tone="neutral" icon={<CircleDashed />}>{REVIEW_LABEL[state]}</Badge>;
  }
}

const WP_LABEL: Record<WorkProductState, string> = { missing: 'Missing', drafted: 'Drafted', complete: 'Complete' };

export function WorkProductChip({ label, state }: { label: string; state: WorkProductState }) {
  const icon = state === 'complete' ? <CheckCircle2 /> : state === 'drafted' ? <CircleDot /> : <FileWarning />;
  return (
    <Badge size="sm" tone={state === 'complete' ? 'green' : state === 'drafted' ? 'accent' : 'neutral'} icon={icon} title={`${label}: ${WP_LABEL[state]}`}>
      {label}
      <span className="sr-only">: {WP_LABEL[state]}</span>
    </Badge>
  );
}

/** Small uppercase header for each of the three beats. */
export function BeatHeader({ index, icon, title, aside }: { index: number; icon: ReactNode; title: string; aside?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-[13px] font-semibold text-title">
        <span className="inline-flex size-5 items-center justify-center rounded-full bg-accent-soft text-[10.5px] font-bold text-accent">{index}</span>
        <span className="inline-flex text-accent [&>svg]:size-4" aria-hidden>
          {icon}
        </span>
        {title}
      </h3>
      {aside ? <div className="flex shrink-0 items-center gap-1.5">{aside}</div> : null}
    </div>
  );
}
