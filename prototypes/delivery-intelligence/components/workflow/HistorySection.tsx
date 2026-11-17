'use client';

import { Server } from 'lucide-react';
import { useState } from 'react';
import { ProvenanceBadge } from '@/components/shell';
import { Avatar, Button, cx, EmptyState, Section } from '@/components/ui';
import type { HistoryItem } from './model';
import { formatStamp } from './model';

const DOT: Record<HistoryItem['tone'], string> = {
  neutral: 'bg-line-strong',
  green: 'bg-status-green',
  red: 'bg-status-red',
  amber: 'bg-status-amber',
  accent: 'bg-accent',
};

const KIND_LABEL: Record<HistoryItem['kind'], string> = {
  'move-forward': 'Stage move',
  'move-back': 'Moved back',
  'review-approved': 'Review',
  'review-returned': 'Review returned',
  evidence: 'Evidence',
  criterion: 'Acceptance',
  agent: 'Agent run',
  proposal: 'Proposal',
  blocked: 'Governance',
  work: 'Work',
};

/** This deliverable's workflow events, newest first, from its records and the audit trail. */
export function HistorySection({ items }: { items: HistoryItem[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, 14);
  return (
    <Section
      id="wf-history"
      title="Workflow history"
      description="Agent runs, reviews, evidence, acceptances and stage moves for this deliverable, newest first. Times are on the demo clock."
      actions={<ProvenanceBadge kind="computed" size="sm" />}
    >
      {items.length === 0 ? (
        <EmptyState variant="boxed" title="No workflow events yet" description="Run the stage agent to start the record." />
      ) : (
        <div className="di-card px-5 py-4">
          <ol className="flex flex-col" data-testid="workflow-history">
            {shown.map((h, i) => (
              <li key={h.id} className="relative flex gap-3 pb-3.5 last:pb-0">
                {i < shown.length - 1 ? <span aria-hidden className="absolute top-7 bottom-0 left-[11px] w-px bg-line" /> : null}
                <ActorMark item={h} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex min-w-0 items-start gap-2">
                    <span aria-hidden className={cx('mt-1.5 size-2 shrink-0 rounded-full', DOT[h.tone])} />
                    <span className="min-w-0 text-[13px] leading-snug text-fg">
                      <span className="mr-1.5 text-[10.5px] font-semibold tracking-wide text-fg-subtle uppercase">{KIND_LABEL[h.kind]}</span>
                      {h.title}
                    </span>
                    <span className="ml-auto flex shrink-0 items-center gap-2">
                      {h.provenance && h.provenance !== 'sample' ? <ProvenanceBadge kind={h.provenance} size="sm" /> : null}
                      <span className="text-[11.5px] text-fg-subtle tabular-nums">{formatStamp(h.at)}</span>
                    </span>
                  </div>
                  <div className="pl-4 text-[12px] text-fg-muted">
                    <span className="text-fg-subtle">{h.actor.name}</span>
                    {h.detail ? <span> · {h.detail}</span> : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
          {items.length > 14 ? (
            <div className="mt-3 border-t border-line pt-3">
              <Button size="sm" variant="ghost" onClick={() => setAll((v) => !v)}>
                {all ? 'Show fewer' : `Show all ${items.length} events`}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </Section>
  );
}

function ActorMark({ item }: { item: HistoryItem }) {
  const a = item.actor;
  if (a.kind === 'person') return <Avatar initials={a.initials} name={a.name} size="sm" />;
  if (a.kind === 'agent') return <Avatar kind="agent" name={a.name} size="sm" />;
  return (
    <span role="img" aria-label={a.name} title={a.name} className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-line-strong bg-surface-2 text-fg-subtle">
      <Server aria-hidden className="size-3.5" />
    </span>
  );
}
