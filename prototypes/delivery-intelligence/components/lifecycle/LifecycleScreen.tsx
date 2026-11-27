'use client';

import { ArrowRight, Footprints, Info } from 'lucide-react';
import Link from 'next/link';
import { Fragment, useMemo, useState } from 'react';
import { ProvenanceBadges } from '@/components/shell';
import { AddToSlides } from '@/components/slides/AddToSlides';
import { DemoNote, Badge, Card, Chip, cx, Section } from '@/components/ui';
import { FOCUS_RING } from '@/components/ui/cx';
import { PDLC_STAGES } from '@/lib/config/pdlc';
import { hrefs } from '@/lib/config/routes';
import { WORKFLOW_DELIVERABLE_ID } from '@/lib/config/story';
import { terms } from '@/lib/config/terminology';
import { useEngineResult, usePortfolioData, usePortfolioIndex } from '@/lib/store';
import type { RiskTier } from '@/lib/types';
import { Connector } from './Connector';
import { CrossCuttingBand } from './CrossCuttingBand';
import { StageColumn } from './StageColumn';
import { buildLifecycleView, STANDALONE_FILTER } from './stage-model';

const TIERS: RiskTier[] = ['T1', 'T2', 'T3', 'T4'];

export function LifecycleScreen() {
  const data = usePortfolioData();
  const index = usePortfolioIndex();
  const results = useEngineResult();
  const [programme, setProgramme] = useState('all');
  const [tiers, setTiers] = useState<RiskTier[]>([]);
  const [disagreeOnly, setDisagreeOnly] = useState(false);
  const [compact, setCompact] = useState(false);

  const views = useMemo(() => buildLifecycleView(data, index, results), [data, index, results]);

  const programmes = useMemo(() => {
    const seen = new Map<string, string>();
    for (const v of views) for (const c of v.cards) if (c.programmeId && c.programme) seen.set(c.programmeId, c.programme);
    return [...seen.entries()];
  }, [views]);

  const visibleByStage = views.map((v) =>
    v.cards.filter((c) => {
      if (programme === STANDALONE_FILTER && !c.standalone) return false;
      if (programme !== 'all' && programme !== STANDALONE_FILTER && c.programmeId !== programme) return false;
      if (tiers.length > 0 && !tiers.includes(c.deliverable.riskTier)) return false;
      if (disagreeOnly && !results.deliverableRag[c.deliverable.id]?.disagrees) return false;
      return true;
    }),
  );
  const shown = visibleByStage.reduce((n, l) => n + l.length, 0);
  const total = views.reduce((n, v) => n + v.cards.length, 0);
  const filtered = programme !== 'all' || tiers.length > 0 || disagreeOnly;

  return (
    <div className="flex flex-col gap-8">
      <Section
        title={terms.app.lifecycleModel}
        description="Agents assist, the Core Four review (the Product Manager decides each gate), evidence is recorded. Work moves forward and back between neighbouring stages; it is iterative, not a waterfall."
        actions={
          <>
            <AddToSlides kind="portfolio-stages" scope={{ kind: 'portfolio' }} label="the lifecycle board" />
            <ProvenanceBadges kinds={['computed', 'scripted-agent', 'sample']} size="sm" />
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Link
            href={hrefs.workflow(WORKFLOW_DELIVERABLE_ID)}
            data-testid="walkthrough-link"
            className={cx(
              'group flex items-center justify-between gap-4 rounded-lg border border-accent-line bg-accent-soft px-5 py-4 text-accent hover:bg-selected',
              FOCUS_RING,
            )}
          >
            <span className="flex items-center gap-3">
              <Footprints aria-hidden className="size-5" />
              <span>
                <span className="block font-display text-[15px] font-semibold">Walk a deliverable through the lifecycle</span>
                <span className="block text-[12.5px] text-fg-muted">
                  Run the stage agent, take the Core Four through their confirmations, record evidence and move between stages.
                </span>
              </span>
            </span>
            <ArrowRight aria-hidden className="size-5 transition-transform group-hover:translate-x-1" />
          </Link>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2" role="group" aria-label="Filters">
            <label className="flex items-center gap-2 text-xs text-fg-muted">
              Programme
              <select
                value={programme}
                onChange={(e) => setProgramme(e.target.value)}
                className={cx('h-7 rounded-md border border-line-strong bg-surface px-2 text-xs text-fg', FOCUS_RING)}
              >
                <option value="all">All</option>
                {programmes.map(([id, title]) => (
                  <option key={id} value={id}>{title}</option>
                ))}
                <option value={STANDALONE_FILTER}>{terms.routes.standalone}</option>
              </select>
            </label>
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Risk tier">
              <span className="text-xs text-fg-muted">Risk tier</span>
              {TIERS.map((t) => (
                <Chip
                  key={t}
                  selected={tiers.includes(t)}
                  onClick={() => setTiers((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))}
                  title={terms.riskTiers[t]}
                >
                  {t}
                </Chip>
              ))}
            </div>
            <Chip selected={disagreeOnly} onClick={() => setDisagreeOnly((v) => !v)}>Disagreements only</Chip>
            <Chip selected={compact} onClick={() => setCompact((v) => !v)}>Compact cards</Chip>
            <span className="ml-auto text-xs text-fg-muted" aria-live="polite" data-testid="shown-count">
              {shown} of {total} deliverables shown{filtered ? ' (filtered)' : ''}. Stage figures cover every deliverable.
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr)_32px)_minmax(0,1fr)] xl:gap-0">
            <StageGrid views={views} visibleByStage={visibleByStage} compact={compact} />
          </div>
        </div>
      </Section>

      <CrossCuttingBand />

      <DemoNote as="div">
        <Card
          padding="sm"
          title={undefined}
          footer={
            <span className="flex flex-wrap items-center gap-2">
              <Badge size="sm" tone="neutral" icon={<Info />}>Illustrative</Badge>
              Stages, the Core Four confirmations and evidence per stage are set in <code className="font-mono">lib/config/pdlc.ts</code>; the required
              evidence per risk tier in <code className="font-mono">lib/config/risk-tiers.ts</code>.
            </span>
          }
        >
          <p className="text-[13px] leading-relaxed text-fg-muted">
            The review points shown here are illustrative and configurable. They are not presented as official gates, and no
            named gate is invented. Placement, shares, pending reviews and evidence counts are computed from the sample data
            held in this prototype and update as stages move.
          </p>
        </Card>
      </DemoNote>
    </div>
  );
}

function StageGrid({
  views,
  visibleByStage,
  compact,
}: {
  views: ReturnType<typeof buildLifecycleView>;
  visibleByStage: ReturnType<typeof buildLifecycleView>[number]['cards'][];
  compact: boolean;
}) {
  return (
    <>
      {PDLC_STAGES.map((def, i) => {
        const next = PDLC_STAGES[i + 1];
        const view = views[i];
        if (!view) return null;
        return (
        <Fragment key={def.id}>
          <StageColumn def={def} view={view} visible={visibleByStage[i] ?? []} compact={compact} />
          {next ? <Connector from={def.name} to={next.name} /> : null}
        </Fragment>
        );
      })}
    </>
  );
}
