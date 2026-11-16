'use client';

import { motion } from 'motion/react';
import { StatusGlyph, TONE } from '@/components/ui/status';
import { cx } from '@/components/ui/cx';
import { Card } from '@/components/ui';
import { terms } from '@/lib/config/terminology';
import type { EvidenceRagStatus, RagCounts } from '@/lib/types';

const ORDER: EvidenceRagStatus[] = ['red', 'amber', 'green', 'unknown'];

function Row({ label, counts, total, testId }: { label: string; counts: RagCounts; total: number; testId: string }) {
  return (
    <div data-testid={testId} className="grid grid-cols-[132px_minmax(0,1fr)_auto] items-center gap-4">
      <span className="text-[13px] font-medium text-fg">{label}</span>
      <div className="flex h-5 w-full gap-0.5 overflow-hidden rounded-pill bg-inset" role="img" aria-label={`${label}: ${ORDER.map((s) => `${counts[s]} ${terms.rag[s]}`).join(', ')}`}>
        {ORDER.map((s) =>
          counts[s] > 0 ? (
            <motion.div
              key={s}
              className={cx(TONE[s].fill, 'origin-left')}
              style={{ flexGrow: counts[s], flexBasis: 0 }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
            />
          ) : null,
        )}
      </div>
      <div className="grid grid-cols-4 gap-3">
        {ORDER.map((s) => (
          <span key={s} data-testid={`${testId}-${s}`} className="w-14 text-right font-display text-lg font-semibold text-title tabular-nums">
            {counts[s]}
            <span className="sr-only"> {terms.rag[s]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function RagDistribution({ reported, evidence, total }: { reported: RagCounts; evidence: RagCounts; total: number }) {
  return (
    <Card title="Reported against evidence-based status" description={`All ${total} deliverables on one scale: the gap between the bars is the finding.`} padding="sm" bodyClassName="flex flex-col gap-3">
      <div className="grid grid-cols-[132px_minmax(0,1fr)_auto] items-center gap-4" aria-hidden>
        <span />
        <span />
        <div className="grid grid-cols-4 gap-3">
          {ORDER.map((s) => (
            <span key={s} className="flex w-14 items-center justify-end gap-1 text-[11px] text-fg-muted">
              <StatusGlyph status={s} className="size-3" />
              {terms.rag[s]}
            </span>
          ))}
        </div>
      </div>
      <Row label={terms.ragKinds.reported} counts={reported} total={total} testId="rag-reported" />
      <Row label={terms.ragKinds.evidence} counts={evidence} total={total} testId="rag-evidence" />
    </Card>
  );
}
