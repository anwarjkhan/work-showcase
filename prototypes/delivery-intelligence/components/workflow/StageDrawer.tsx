'use client';

import { AGENT_CATALOGUE } from '@/lib/agents/catalogue';
import { stageDefinition } from '@/lib/config/pdlc';
import { terms } from '@/lib/config/terminology';
import { ProvenanceBadge } from '@/components/shell';
import { AvatarLabel, Badge, cx, Drawer } from '@/components/ui';
import { useAgentRuns } from '@/lib/store';
import type { PdlcStageId } from '@/lib/types';
import { useWorkflow } from './context';
import { formatStamp } from './model';
import { ResultBadge, ReviewStateBadge, WorkProductChip } from './bits';

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Collapsed summary of any stage: work products, agent runs, review decisions, evidence and moves. */
export function StageDrawer({ stageId, onClose }: { stageId: PdlcStageId; onClose: () => void }) {
  const { view, person, personName } = useWorkflow();
  const runs = useAgentRuns();
  const stage = view.stages.find((s) => s.definition.id === stageId)!;
  const def = stage.definition;
  const stageRuns = runs.filter((r) => stage.state.agentRunIds.includes(r.id));
  const moves = view.run.moves.filter((m) => m.from === stageId || m.to === stageId);

  return (
    <Drawer open onClose={onClose} eyebrow={`Stage ${def.order} of 5${stage.current ? ' · current' : ''}`} title={def.name} width="md">
      <div className="flex flex-col gap-5 text-[13px]">
        <p className="text-fg-muted">{def.summary}</p>

        <section className="flex flex-col gap-2">
          <h3 className="di-eyebrow">Work products</h3>
          <div className="flex flex-wrap gap-1.5">
            {def.workProducts.map((wp) => (
              <WorkProductChip key={wp.id} label={wp.label} state={stage.state.workProducts.find((x) => x.id === wp.id)?.state ?? 'missing'} />
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="di-eyebrow">Agent assists</h3>
          {stage.agentId ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <AvatarLabel kind="agent" name={AGENT_CATALOGUE[stage.agentId].name} detail={terms.agentModes[AGENT_CATALOGUE[stage.agentId].mode]} size="sm" />
                <ProvenanceBadge kind="scripted-agent" size="sm" />
              </div>
              {stageRuns.length === 0 ? (
                <p className="text-fg-muted">Not run for this deliverable in this session.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {stageRuns.map((r) => (
                    <li key={r.id} className="text-fg">
                      <span className="text-fg-subtle tabular-nums">{formatStamp(r.completedAt ?? r.startedAt)} · </span>
                      {r.summary}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-fg-muted">No assisting agent.</p>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="di-eyebrow">The Core Four review</h3>
          <ul className="flex flex-col gap-3">
            {stage.reviews.map((r) => {
              const p = person(r.personId);
              return (
                <li key={r.roleId} className={cx('flex flex-col gap-1.5', r.gate && 'rounded-md border border-accent-line bg-accent-soft p-2')}>
                  <div className="flex items-center justify-between gap-2">
                    {p ? (
                      <AvatarLabel initials={p.initials} name={p.name} detail={r.gate ? `Gate · ${r.roleLabel}` : `${r.roleLabel}: ${lower(r.confirmed)}`} size="sm" />
                    ) : (
                      <span>
                        {r.roleLabel}: {terms.coreTeam.missing.toLowerCase()}
                      </span>
                    )}
                    <ReviewStateBadge state={r.state} />
                  </div>
                  {r.decisions.map((d) => (
                    <p key={d.id} className="text-[12px] text-fg-muted">
                      {d.decision === 'approved' ? 'Approved' : 'Returned'} by {personName(d.reviewerId)}, {formatStamp(d.decidedAt)}
                      {d.reason ? `: ${d.reason}` : ''}
                    </p>
                  ))}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="di-eyebrow">Evidence recorded</h3>
          <ul className="flex flex-col gap-2">
            {stage.evidence.map((e) => (
              <li key={e.kind} className="flex flex-col gap-1 rounded-md border border-line p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-fg">{terms.evidenceKinds[e.kind]}</span>
                  <ResultBadge result={e.result} />
                </div>
                {e.latest ? (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-fg-muted">
                    <span>{e.latest.title}</span>
                    <span>· {terms.systems[e.latest.source]} {e.latest.sourceRef}</span>
                    <span>· {formatStamp(e.latest.observedAt)}</span>
                    <ProvenanceBadge kind={e.latest.provenance} size="sm" />
                  </div>
                ) : (
                  <p className="text-[12px] text-fg-muted">No record yet.</p>
                )}
              </li>
            ))}
          </ul>
        </section>

        {moves.length > 0 ? (
          <section className="flex flex-col gap-2">
            <h3 className="di-eyebrow">Moves</h3>
            <ul className="flex flex-col gap-1.5">
              {moves.map((m) => (
                <li key={m.id} className="flex items-start gap-2">
                  <Badge size="sm" tone={m.direction === 'back' ? 'amber' : 'accent'}>
                    {m.direction === 'back' ? 'Back' : 'Forward'}
                  </Badge>
                  <span className="text-fg">
                    {stageDefinition(m.from).shortName} to {stageDefinition(m.to).shortName}, {formatStamp(m.at)}
                    {m.by.kind === 'human' ? ` by ${personName(m.by.personId)}` : ''}
                    {m.reason ? <span className="block text-[12px] text-fg-muted">{m.reason}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </Drawer>
  );
}
