'use client';

import { Bot, FileCheck2, UserCheck } from 'lucide-react';
import { Avatar, Badge, cx, EmptyState } from '@/components/ui';
import { agentsForStage } from '@/lib/agents/catalogue';
import type { PdlcStageDefinition } from '@/lib/config/pdlc';
import { terms } from '@/lib/config/terminology';
import { DeliverableCard } from './DeliverableCard';
import type { CardModel, StageView } from './stage-model';

function Label({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="di-eyebrow flex items-center gap-1.5 [&>svg]:size-3">
      {icon}
      {children}
    </div>
  );
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

export function StageColumn({
  def,
  view,
  visible,
  compact,
}: {
  def: PdlcStageDefinition;
  view: StageView;
  visible: CardModel[];
  compact: boolean;
}) {
  const agents = agentsForStage(def.id);
  const { figures } = view;
  const total = figures.share.human + figures.share.agent;
  const humanShare = total === 0 ? 0 : figures.share.human / total;

  return (
    <section
      aria-labelledby={`stage-${def.id}`}
      data-testid={`stage-${def.id}`}
      className="di-card flex min-w-0 flex-col"
    >
      <header className="flex flex-col gap-3 border-b border-line p-3.5">
        <div>
          <div className="di-eyebrow">Stage {def.order}</div>
          <h3 id={`stage-${def.id}`} className="font-display text-[14px] leading-snug font-semibold text-title">
            {def.name}
          </h3>
          <p className="mt-1 text-[12px] leading-snug text-fg-muted">{def.summary}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label icon={<Bot aria-hidden />}>Agents assist</Label>
          <ul className="flex flex-col gap-1.5">
            {agents.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Avatar kind="agent" name={a.name} size="xs" />
                <span className="min-w-0 flex-1 basis-24 text-[12px] leading-tight text-fg">{a.name}</span>
                <Badge size="sm" tone="neutral" className="ml-7 xl:ml-0">{terms.agentModes[a.mode]}</Badge>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-1">
          <Label icon={<UserCheck aria-hidden />}>A named human reviews</Label>
          <ul className="text-[12px] text-fg">
            {def.reviews.map((r, i) => (
              <li key={r}>
                {i > 0 ? 'Then ' : ''}
                {i > 0 ? terms.reviewRoles[r].toLowerCase() : terms.reviewRoles[r]}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-1">
          <Label icon={<FileCheck2 aria-hidden />}>Evidence recorded</Label>
          <ul className="text-[12px] text-fg">
            {def.evidenceLeft.map((k) => (
              <li key={k}>{terms.evidenceKinds[k]}</li>
            ))}
          </ul>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 border-b border-line bg-surface-2 p-3.5 text-[12px]">
        <div>
          <dt className="text-fg-subtle">Deliverables</dt>
          <dd className="font-display text-lg font-semibold text-title" data-testid="stage-count">{figures.deliverables}</dd>
        </div>
        <div>
          <dt className="text-fg-subtle">Reviews pending</dt>
          <dd className="font-display text-lg font-semibold text-title">{figures.reviewsPending}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-fg-subtle">Evidence held / required</dt>
          <dd className="font-medium text-fg">
            {figures.evidenceRequired === 0 ? 'None required' : `${figures.evidenceHeld} of ${figures.evidenceRequired}`}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-fg-subtle">Work items: human and agent</dt>
          <dd className="mt-1">
            {total === 0 ? (
              <span className="text-fg-muted">No work items</span>
            ) : (
              <>
                <div
                  role="img"
                  aria-label={`${pct(humanShare)} human, ${pct(1 - humanShare)} agent, ${total} work items`}
                  className="flex h-2 overflow-hidden rounded-pill bg-inset"
                >
                  <span className="bg-accent" style={{ width: `${humanShare * 100}%` }} />
                  <span className="bg-prov-scripted" style={{ width: `${(1 - humanShare) * 100}%` }} />
                </div>
                <div className="mt-1 flex justify-between text-[11px] text-fg-muted">
                  <span>Human {pct(humanShare)}</span>
                  <span>Agent {pct(1 - humanShare)}</span>
                </div>
              </>
            )}
          </dd>
        </div>
      </dl>

      <div className="min-h-0 flex-1 p-2.5">
        {visible.length === 0 ? (
          <EmptyState
            variant="inline"
            title={view.cards.length === 0 ? 'No deliverables here' : 'None match the filters'}
          />
        ) : (
          <ul
            tabIndex={0}
            aria-label={`Deliverables in ${def.name}`}
            className={cx('flex max-h-[520px] flex-col overflow-y-auto pr-0.5 focus-visible:outline-none focus-visible:shadow-focus', compact ? 'gap-1.5' : 'gap-2')}
          >
            {visible.map((c) => (
              <DeliverableCard key={c.deliverable.id} model={c} compact={compact} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
