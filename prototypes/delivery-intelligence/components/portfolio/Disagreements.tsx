import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { ProvenanceBadge } from '@/components/shell';
import { Card, RagPair, ReadinessPill } from '@/components/ui';
import { hrefs } from '@/lib/config/routes';
import { terms } from '@/lib/config/terminology';
import type { DeliverableMeasures } from '@/lib/types';
import type { DisagreementRow, PortfolioView } from './model';

export function MeasuresCompact({ m }: { m: DeliverableMeasures | undefined }) {
  if (!m) return null;
  const wc = m.workCompletion;
  const ao = m.acceptedOutcomes;
  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex items-center gap-3 text-xs text-fg-muted tabular-nums">
        <span title={terms.measures.workCompletion}>
          <span className="font-semibold text-fg">{wc.computable ? `${wc.value.percent}%` : '–'}</span> work
        </span>
        <span title={terms.measures.acceptedOutcomes}>
          <span className="font-semibold text-fg">{ao.computable ? `${ao.value.acceptedCount}/${ao.value.totalCount}` : '–'}</span> accepted
        </span>
      </div>
      <ReadinessPill state={m.readiness.state} size="sm" />
    </div>
  );
}

const COLS = 'grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_150px_28px] 2xl:grid-cols-[minmax(0,1.3fr)_250px_minmax(0,1.6fr)_170px_28px]';

function Row({ r }: { r: DisagreementRow }) {
  return (
    <li>
      <Link
        href={hrefs.deliverable(r.id)}
        data-testid="disagreement-row"
        data-deliverable-id={r.id}
        className={`${COLS} group items-center gap-x-5 gap-y-2 px-5 py-3 transition-colors hover:bg-hover focus-visible:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent`}
      >
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold text-title group-hover:text-accent">{r.title}</div>
          <div className="mt-0.5 truncate text-xs text-fg-muted">
            <span className="font-mono">{r.ref}</span> · {r.programme}
          </div>
        </div>
        <div className="col-start-2 row-start-1 2xl:col-start-auto 2xl:row-start-auto">
          <RagPair reported={r.reported} evidence={r.evidence} disagrees size="sm" />
        </div>
        <p className="col-span-2 col-start-1 row-start-2 line-clamp-2 text-[13px] leading-snug text-fg-muted 2xl:col-span-1 2xl:col-start-auto 2xl:row-start-auto">
          {r.reason}
        </p>
        <div className="col-start-3 row-span-2 row-start-1 2xl:col-start-auto 2xl:row-span-1 2xl:row-start-auto">
          <MeasuresCompact m={r.measures} />
        </div>
        <ArrowUpRight aria-hidden className="col-start-4 row-span-2 row-start-1 size-4 text-fg-subtle group-hover:text-accent 2xl:col-start-auto 2xl:row-span-1 2xl:row-start-auto" />
      </Link>
    </li>
  );
}

export function Disagreements({ view }: { view: PortfolioView }) {
  return (
    <Card
      title="Where reported status and the evidence disagree"
      description="Widest gap first. Each row opens the deliverable with its evidence."
      padding="none"
      level={2}
      actions={<ProvenanceBadge kind="computed" size="sm" />}
    >
      {view.disagreements.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-fg-muted">No disagreements: reported and evidence-based status match everywhere the evidence is sufficient.</p>
      ) : (
        <ul className="divide-y divide-line border-t border-line" aria-label="Status disagreements">
          {view.disagreements.map((r) => (
            <Row key={r.id} r={r} />
          ))}
        </ul>
      )}
    </Card>
  );
}
