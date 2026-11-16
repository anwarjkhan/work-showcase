'use client';

import { ShieldAlert, X } from 'lucide-react';
import { IconButton } from '@/components/ui';
import { AgentPanel } from './AgentPanel';
import { useWorkflow } from './context';
import { EvidencePanel } from './EvidencePanel';
import { MoveBar } from './MoveBar';
import { ReviewPanel } from './ReviewPanel';
import { WorkProductChip } from './bits';

/** The current stage: agent assists, a named human reviews, evidence recorded, then move. */
export function StageWorkspace() {
  const { view, notice, clearNotice } = useWorkflow();
  const cur = view.stages.find((s) => s.current)!;
  const def = cur.definition;

  return (
    <section aria-labelledby="wf-stage-title" className="di-card flex min-w-0 flex-col" data-testid="stage-workspace" data-stage={def.id}>
      <header className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-line px-4 py-2.5">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="di-eyebrow shrink-0">Stage {def.order} of 5</span>
          <h3 id="wf-stage-title" className="shrink-0 font-display text-[16px] font-semibold text-title">
            {def.name}
          </h3>
          <span className="hidden truncate text-[12.5px] text-fg-muted 2xl:inline">{def.summary}</span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-fg-subtle">Work products</span>
          {def.workProducts.map((wp) => (
            <WorkProductChip key={wp.id} label={wp.label} state={cur.state.workProducts.find((x) => x.id === wp.id)?.state ?? 'missing'} />
          ))}
        </div>
      </header>

      {notice ? (
        <div role="alert" data-testid="workflow-notice" className="flex items-center gap-2 border-b border-status-red-line bg-status-red-soft px-4 py-2 text-[12.5px] text-status-red-fg">
          <ShieldAlert aria-hidden className="size-4 shrink-0" />
          <span className="font-semibold">Refused.</span>
          <span className="min-w-0 flex-1">{notice.text}</span>
          <IconButton label="Dismiss" icon={<X />} size="sm" onClick={clearNotice} />
        </div>
      ) : null}

      <div className="grid min-h-0 grid-cols-1 divide-y divide-line lg:h-[max(430px,calc(100dvh-532px))] lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.95fr)_minmax(0,1.15fr)] lg:divide-x lg:divide-y-0">
        <AgentPanel />
        <ReviewPanel />
        <EvidencePanel />
      </div>

      <MoveBar />
    </section>
  );
}
