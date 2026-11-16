import { GitCompareArrows } from 'lucide-react';
import type { ReactNode } from 'react';
import { ProgressBar } from '@/components/ui';
import { READINESS_ICON, READINESS_TONE, TONE } from '@/components/ui/status';
import { cx } from '@/components/ui/cx';
import { terms } from '@/lib/config/terminology';
import type { ReadinessState } from '@/lib/types';
import type { PortfolioView } from './model';

const READINESS_ORDER: ReadinessState[] = ['ready', 'not-ready', 'unknown'];

function MeasureCell({ label, children, testId }: { label: string; children: ReactNode; testId: string }) {
  return (
    <div data-testid={testId} className="flex min-w-0 flex-col gap-2.5 p-5">
      <div className="di-eyebrow">{label}</div>
      {children}
    </div>
  );
}

const FIGURE = 'font-display text-[34px] leading-none font-semibold tracking-tight text-title tabular-nums';

export function Headline({ view }: { view: PortfolioView }) {
  const { summary } = view;
  const wc = summary.workCompletion;
  const ao = summary.acceptedOutcomes;
  const readinessTotal = READINESS_ORDER.reduce((s, k) => s + summary.readiness[k], 0);
  return (
    <div className="di-card grid grid-cols-1 overflow-hidden xl:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] 2xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="flex items-center gap-4 2xl:gap-6 border-b border-line bg-status-amber-soft/40 p-6 xl:border-r xl:border-b-0">
        <div className="flex flex-col items-start">
          <div className="di-eyebrow flex items-center gap-1.5">
            <GitCompareArrows aria-hidden className="size-3.5 text-status-amber" strokeWidth={2.2} />
            Status disagreements
          </div>
          <div data-testid="disagreement-count" className="font-display text-[72px] 2xl:text-[88px] leading-[0.95] font-semibold tracking-tight text-title tabular-nums">
            {view.disagreementCount}
          </div>
        </div>
        <div className="min-w-0">
          <p data-testid="headline-sentence" className="font-display text-lg 2xl:text-xl leading-snug font-semibold text-title">
            {view.headline}
          </p>
          <p className="mt-2 text-[13px] text-fg-muted">
            {terms.ragKinds.reported} status is the portfolio system&rsquo;s; {terms.ragKinds.evidence.toLowerCase()} status is computed from the records.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 divide-y divide-line md:grid-cols-[1fr_1fr_1.3fr] md:divide-x md:divide-y-0">
        <MeasureCell label={terms.measures.workCompletion} testId="measure-work">
          {wc.computable ? (
            <>
              <div className={FIGURE}>
                <span data-testid="work-percent">{wc.value.percent}</span>
                <span className="ml-0.5 text-[0.5em] font-medium text-fg-muted">%</span>
              </div>
              <ProgressBar value={wc.value.percent} ariaLabel={terms.measures.workCompletion} />
              <p className="text-xs text-fg-muted tabular-nums">
                {wc.value.closedPoints} of {wc.value.totalPoints} points closed
              </p>
            </>
          ) : (
            <p className="text-sm text-fg-muted">{terms.measures.notComputable}: {wc.detail}</p>
          )}
        </MeasureCell>
        <MeasureCell label={terms.measures.acceptedOutcomes} testId="measure-accepted">
          {ao.computable ? (
            <>
              <div className={FIGURE}>
                <span data-testid="accepted-count">{ao.value.acceptedCount}</span>
                <span className="ml-1 text-[0.5em] font-medium text-fg-muted">of {ao.value.totalCount}</span>
              </div>
              <ProgressBar value={ao.value.percent} ariaLabel={terms.measures.acceptedOutcomes} />
              <p className="text-xs text-fg-muted tabular-nums">{ao.value.percent}% of outcome weight accepted</p>
            </>
          ) : (
            <p className="text-sm text-fg-muted">{terms.measures.notComputable}: {ao.detail}</p>
          )}
        </MeasureCell>
        <MeasureCell label={terms.measures.readiness} testId="measure-readiness">
          <div className="flex items-end gap-3 2xl:gap-4">
            {READINESS_ORDER.map((k) => {
              const Icon = READINESS_ICON[k];
              const tone = TONE[READINESS_TONE[k]];
              return (
                <div key={k} className="flex flex-col gap-1">
                  <span data-testid={`readiness-${k}`} className={cx('font-display text-[30px] 2xl:text-[34px] leading-none font-semibold tabular-nums', tone.text)}>
                    {summary.readiness[k]}
                  </span>
                  <span className="flex items-center gap-1 text-xs whitespace-nowrap text-fg-muted">
                    <Icon aria-hidden className={cx('size-3.5', tone.icon)} strokeWidth={2.2} />
                    {terms.readiness[k]}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-pill bg-inset" aria-hidden>
            {READINESS_ORDER.map((k) => (
              <div key={k} className={TONE[READINESS_TONE[k]].fill} style={{ flexGrow: summary.readiness[k], flexBasis: 0 }} />
            ))}
          </div>
          <p className="text-xs text-fg-muted">of {readinessTotal} deliverables, a state not a percentage</p>
        </MeasureCell>
      </div>
    </div>
  );
}
