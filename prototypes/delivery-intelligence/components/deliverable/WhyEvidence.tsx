'use client';

import { ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { ProvenanceBadges } from '@/components/shell';
import { Button, EmptyState, SectionHeading, SeverityBadge, cx } from '@/components/ui';
import { terms } from '@/lib/config/terminology';
import { RULE_DESCRIPTIONS } from '@/lib/config/thresholds';
import type { DeliverableModel } from './model';
import { RecordChip } from './records';

const INITIAL = 6;

/** "Why the evidence says Red": the engine's findings, most severe first, each tied to the records it rests on. */
export function WhyEvidence({ model }: { model: DeliverableModel }) {
  const [all, setAll] = useState(false);
  const evidence = model.rag?.evidence ?? 'unknown';
  const findings = model.findings;
  const shown = all ? findings : findings.slice(0, INITIAL);
  const title = evidence === 'unknown' ? 'Why the evidence cannot yet say' : `Why the evidence says ${terms.rag[evidence]}`;

  return (
    <section aria-labelledby="why-evidence" className="flex min-w-0 flex-col gap-3" data-testid="why-evidence">
      <SectionHeading
        id="why-evidence"
        title={title}
        description={
          findings.length > 0
            ? `${findings.length} finding${findings.length === 1 ? '' : 's'} from the rules, most severe first. Every record is clickable.`
            : undefined
        }
        actions={<ProvenanceBadges kinds={['computed']} />}
      />
      {findings.length === 0 ? (
        <EmptyState
          variant="boxed"
          icon={<ShieldCheck />}
          title="No findings for this deliverable"
          description={model.rag?.reasons[0]?.message ?? 'None of the rules fired against the current records.'}
        />
      ) : (
        <>
          <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 xl:grid-cols-2" data-testid="findings-list">
            {shown.map((f) => (
              <li key={f.id} className={cx('di-card flex min-w-0 flex-col gap-2 px-4 py-3', f.severity === 'critical' && 'border-status-red-line')} data-finding={f.ruleId}>
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={f.severity} size="sm" />
                  <span className="font-mono text-xs font-semibold text-fg">{f.ruleId}</span>
                  <span className="min-w-0 truncate text-xs text-fg-muted">{RULE_DESCRIPTIONS[f.ruleId]}</span>
                </div>
                <p className="text-[13px] leading-snug text-fg">{f.message}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-fg-subtle">Rests on</span>
                  {f.evidence.map((e) => (
                    <RecordChip key={`${e.kind}:${e.id}`} to={e} />
                  ))}
                </div>
              </li>
            ))}
          </ul>
          {findings.length > INITIAL ? (
            <div>
              <Button size="sm" variant="ghost" icon={all ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />} onClick={() => setAll((v) => !v)}>
                {all ? 'Show fewer findings' : `Show all ${findings.length} findings`}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
