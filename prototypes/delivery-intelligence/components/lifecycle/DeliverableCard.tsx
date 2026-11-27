'use client';

import { CheckCircle2, CircleDashed, Hourglass, Undo2, Undo, GitBranch, GitCompareArrows, UserRoundX } from 'lucide-react';
import Link from 'next/link';
import { hrefs } from '@/lib/config/routes';
import { stageDefinition } from '@/lib/config/pdlc';
import { terms } from '@/lib/config/terminology';
import { Badge, cx, RagPill, ReadinessPill } from '@/components/ui';
import { FOCUS_RING } from '@/components/ui/cx';
import { useDeliverableMeasures, useDeliverableRag } from '@/lib/store';
import type { CardModel, StageReviewSummary } from './stage-model';

function ReviewBadge({ state, progress }: { state: StageReviewSummary; progress: CardModel['reviewProgress'] }) {
  const common = { size: 'sm' as const, title: `${progress.done} of ${progress.total} reviews done in this stage` };
  const text = state === 'returned' ? 'Review returned' : progress.text;
  switch (state) {
    case 'pending':
      return <Badge {...common} tone="amber" icon={<Hourglass />}>{text}</Badge>;
    case 'approved':
      return <Badge {...common} tone="green" icon={<CheckCircle2 />}>{text}</Badge>;
    case 'returned':
      return <Badge {...common} tone="red" icon={<Undo2 />}>{text}</Badge>;
    default:
      return <Badge {...common} tone="neutral" icon={<CircleDashed />}>{text}</Badge>;
  }
}

/** Small marker for a deliverable whose Core Four has a gap (data-testid `core-gap`). */
function GapMarker({ gap }: { gap: NonNullable<CardModel['coreGap']> }) {
  const parts: string[] = [];
  if (gap.missing.length > 0) parts.push(`${gap.missing.map((r) => terms.coreRoles[r]).join(' and ')} not named`);
  if (gap.shared.length > 0) parts.push('one person holds two roles');
  if (gap.lateJoin) parts.push('a seat was filled after work started');
  const short = gap.missing.length > 0 ? `${terms.coreTeam.name} gap` : gap.shared.length > 0 ? `${terms.coreTeam.name}: two roles` : `${terms.coreTeam.name} joined late`;
  return (
    <Badge size="sm" tone="amber" icon={<UserRoundX />} title={`${terms.coreTeam.name}: ${parts.join('; ')}`} data-testid="core-gap">
      {short}
    </Badge>
  );
}

export function DeliverableCard({ model, compact }: { model: CardModel; compact: boolean }) {
  const { deliverable: d } = model;
  const measures = useDeliverableMeasures(d.id);
  const rag = useDeliverableRag(d.id);
  const wc = measures?.workCompletion;
  const ao = measures?.acceptedOutcomes;

  return (
    <li
      data-testid="lifecycle-card"
      data-deliverable={d.id}
      className={cx(
        'flex min-w-0 flex-col rounded-md border bg-surface',
        model.movedBack ? 'border-status-amber-line' : 'border-line',
        compact ? 'gap-1.5 p-2' : 'gap-2 p-2.5',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-mono text-[10.5px] text-fg-subtle">{d.ref}</div>
          <Link
            href={hrefs.workflow(d.id)}
            title={`Open workflow: ${d.title}`}
            className={cx(
              'block rounded-xs text-[12.5px] leading-snug font-semibold text-title hover:text-accent hover:underline',
              compact ? 'line-clamp-1' : 'line-clamp-2',
              FOCUS_RING,
            )}
          >
            {d.title}
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {rag ? (
          <span className="inline-flex flex-wrap items-center gap-1" title={`${terms.ragKinds.reported} / ${terms.ragKinds.evidence}`}>
            <RagPill status={rag.reported} size="sm" />
            <span aria-hidden className="text-fg-subtle">/</span>
            <RagPill status={rag.evidence} size="sm" />
          </span>
        ) : null}
        {rag?.disagrees ? <Badge size="sm" tone="amber" icon={<GitCompareArrows />}>Disagreement</Badge> : null}
        <Badge size="sm" tone="neutral">{terms.riskTiers[d.riskTier].split(' ')[0]}</Badge>
        {model.standalone ? (
          <Badge size="sm" tone="accent" icon={<GitBranch />} title={terms.routes.standalone}>Standalone</Badge>
        ) : null}
      </div>

      {!compact ? (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-fg-muted" aria-label="Three measures">
          <span title={terms.measures.workCompletion}>
            Work {wc?.computable ? `${wc.value.percent}%` : 'n/c'}
          </span>
          <span aria-hidden className="text-line-strong">|</span>
          <span title={terms.measures.acceptedOutcomes}>
            Outcomes {ao?.computable ? `${ao.value.acceptedCount}/${ao.value.totalCount}` : 'n/c'}
          </span>
          <span aria-hidden className="text-line-strong">|</span>
          {measures ? <ReadinessPill state={measures.readiness.state} size="sm" /> : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5">
        <ReviewBadge state={model.review} progress={model.reviewProgress} />
        {model.coreGap ? <GapMarker gap={model.coreGap} /> : null}
      </div>

      {model.movedBack ? (
        <p className="flex items-start gap-1.5 rounded-sm bg-status-amber-soft px-2 py-1 text-[11px] leading-snug text-status-amber-fg">
          <Undo aria-hidden className="mt-0.5 size-3 shrink-0" />
          <span>
            Moved back from {stageDefinition(model.movedBack.fromStage).shortName}: {model.movedBack.reason}
          </span>
        </p>
      ) : null}

      {!compact ? (
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <Link href={hrefs.workflow(d.id)} className={cx('rounded-xs font-medium text-accent hover:underline', FOCUS_RING)}>
            Open workflow
          </Link>
          <Link href={hrefs.deliverable(d.id)} className={cx('rounded-xs text-fg-muted hover:text-accent hover:underline', FOCUS_RING)}>
            Detail
          </Link>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="text-fg-muted">
            {wc?.computable ? `${wc.value.percent}%` : 'n/c'} · {ao?.computable ? `${ao.value.acceptedCount}/${ao.value.totalCount}` : 'n/c'}
            {measures ? ` · ${terms.readiness[measures.readiness.state]}` : ''}
          </span>
          <Link href={hrefs.deliverable(d.id)} className={cx('rounded-xs text-fg-muted hover:text-accent hover:underline', FOCUS_RING)}>
            Detail
          </Link>
        </div>
      )}
    </li>
  );
}
