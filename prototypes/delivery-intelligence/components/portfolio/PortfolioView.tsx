'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { ProvenanceBadge } from '@/components/shell';
import { SectionHeading } from '@/components/ui';
import { daysBetween, formatDate } from '@/lib/config/clock';
import { terms, systemLabel } from '@/lib/config/terminology';
import { HierarchyCounts, ProgrammeHealth, StageDistribution, TopFindings } from './BookShape';
import { Disagreements } from './Disagreements';
import { Headline } from './Headline';
import type { PortfolioView as View } from './model';
import { RagDistribution } from './RagDistribution';

function Reveal({ children, i }: { children: ReactNode; i: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}>
      {children}
    </motion.div>
  );
}

function syncedText(iso: string, today: string): string {
  const d = daysBetween(iso, today);
  return d <= 0 ? 'synced today' : d === 1 ? 'synced 1 day ago' : `synced ${d} days ago`;
}

export function PortfolioView({ view }: { view: View }) {
  return (
    <div className="flex flex-col gap-8" data-testid="portfolio-screen">
      <section aria-label="Headline" className="flex flex-col gap-4">
        <h2 className="sr-only">Portfolio headline</h2>
        <Reveal i={0}><Headline view={view} /></Reveal>
        <Reveal i={1}>
          <RagDistribution reported={view.summary.reportedRag} evidence={view.summary.evidenceRag} total={view.total} />
        </Reveal>
      </section>

      <Reveal i={2}>
        <Disagreements view={view} />
      </Reveal>

      <Reveal i={3}>
        <section aria-labelledby="shape-h" className="flex flex-col gap-4">
          <SectionHeading id="shape-h" title="The shape of the book" description="What sits in the portfolio, how healthy each programme is, and where the work is in the lifecycle." />
          <HierarchyCounts view={view} />
          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <ProgrammeHealth view={view} />
            <div className="flex flex-col gap-4">
              <StageDistribution view={view} />
              <TopFindings view={view} />
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal i={4}>
        <footer aria-label="Data freshness and provenance" className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-4 text-xs text-fg-muted">
          <span>As of {formatDate(view.today)}</span>
          {view.freshness.map((f) => (
            <span key={f.system} className="tabular-nums">
              {systemLabel(f.system)}: {f.recordCount.toLocaleString('en-GB')} records, {syncedText(f.lastSyncedAt, view.today)}
            </span>
          ))}
          <span className="ml-auto flex items-center gap-2">
            <ProvenanceBadge kind={view.sourceKind === 'synthetic' ? 'sample' : 'reported'} size="sm" />
            <ProvenanceBadge kind="computed" size="sm" />
            <span className="sr-only">{terms.app.demoNotice}</span>
          </span>
        </footer>
      </Reveal>
    </div>
  );
}
