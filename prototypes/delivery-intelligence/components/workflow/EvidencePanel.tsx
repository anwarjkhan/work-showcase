'use client';

import { Check, CheckCheck, FileCheck2, FlaskConical, PenLine, X } from 'lucide-react';
import { useState } from 'react';
import type { StageView } from '@/lib/agents/workflow';
import { daysBetween } from '@/lib/config/clock';
import { terms } from '@/lib/config/terminology';
import { ProvenanceBadge } from '@/components/shell';
import { Badge, Button, cx } from '@/components/ui';
import { FOCUS_RING } from '@/components/ui/cx';
import { usePortfolioIndex } from '@/lib/store';
import type { EvidenceKind, Outcome } from '@/lib/types';
import { BeatHeader, HeldBadge, ResultBadge } from './bits';
import { useTarget, useWorkflow } from './context';
import { formatStamp, heldState, SYSTEM_FED_KINDS } from './model';

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export function EvidencePanel() {
  const { view, measures } = useWorkflow();
  const cur = view.stages.find((s) => s.current)!;
  const rd = measures.readiness;
  const hasAcceptance = cur.definition.evidenceLeft.includes('business-acceptance');

  return (
    <div className="flex min-h-0 flex-col gap-3 overflow-y-auto p-4" data-testid="evidence-panel">
      <BeatHeader index={3} icon={<FileCheck2 />} title="Evidence recorded" aside={<ProvenanceBadge kind="computed" size="sm" />} />

      <div className="flex flex-col gap-1.5 rounded-md border border-line bg-surface-2 p-2.5" data-testid="readiness-required">
        <div className="text-[11.5px] text-fg-muted">
          {terms.measures.readiness} for {terms.riskTiers[rd.riskTier]} needs:
        </div>
        <ul className="flex flex-wrap gap-1">
          {rd.requiredEvidence.map((k) => {
            const st = heldState(measures, k);
            return (
              <li key={k}>
                <Badge
                  size="sm"
                  tone={st === 'passing' ? 'green' : st === 'failing' ? 'red' : st === 'stale' || st === 'pending' ? 'amber' : 'unknown'}
                  icon={st === 'passing' ? <Check /> : st === 'failing' ? <X /> : undefined}
                  dashed={st === 'missing'}
                  title={`${terms.evidenceKinds[k]}: ${terms.evidenceHeld[st]}`}
                >
                  {terms.evidenceKinds[k]}
                  <span className="sr-only">: {terms.evidenceHeld[st]}</span>
                </Badge>
              </li>
            );
          })}
        </ul>
        {rd.blockingDependencyIds.length > 0 ? <p className="text-[11.5px] text-status-red-fg">{rd.blockingDependencyIds.length} open critical dependency blocks readiness.</p> : null}
      </div>

      {cur.simulatedSteps.map((s) => (
        <SimulateWork key={s.id} step={s} />
      ))}

      <ul className="flex flex-col gap-2">
        {cur.evidence
          .filter((e) => !(hasAcceptance && e.kind === 'business-acceptance'))
          .map((e) => (
            <EvidenceRow key={e.kind} item={e} />
          ))}
      </ul>

      {hasAcceptance ? <AcceptanceBlock /> : null}
    </div>
  );
}

function EvidenceRow({ item }: { item: StageView['evidence'][number] }) {
  const { id, deliverable, measures, actions, act, actingAs, personName } = useWorkflow();
  const required = measures.readiness.requiredEvidence.includes(item.kind);
  const held = measures.readiness.held.find((h) => h.kind === item.kind);
  const e = item.latest;
  const systemFed = SYSTEM_FED_KINDS.includes(item.kind);
  const passT = useTarget(systemFed ? `simulate:${item.kind}:pass` : `record:${item.kind}`);
  const failT = useTarget(`simulate:${item.kind}:fail`);

  const record = (result: 'pass' | 'fail') =>
    act(() =>
      actions.recordEvidence({
        deliverableId: id,
        kind: item.kind,
        result,
        title: titleFor(item.kind, deliverable.ref, Boolean(e)),
        recordedById: actingAs,
        simulated: systemFed,
      }),
    );

  return (
    <li className="flex flex-col gap-1.5 rounded-md border border-line p-2.5" data-testid={`evidence-${item.kind}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-semibold text-fg">{terms.evidenceKinds[item.kind]}</span>
        <span className="flex items-center gap-1.5">
          {required ? (held ? <HeldBadge state={held.state} /> : <ResultBadge result={item.result} />) : <ResultBadge result={item.result} />}
        </span>
      </div>
      <div className="text-[11px] text-fg-subtle">{required ? `Required for ${terms.riskTiers[deliverable.riskTier]}` : `Not required for ${terms.riskTiers[deliverable.riskTier]}; recorded when the review asks for it`}</div>
      {e ? (
        <div className="flex flex-col gap-1 rounded-sm bg-surface-2 px-2 py-1.5 text-[11.5px]">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <ResultBadge result={e.result} />
            <span className="font-medium text-fg">{e.title}</span>
            <ProvenanceBadge kind={e.provenance} size="sm" />
          </div>
          <div className="text-fg-muted">
            {terms.systems[e.source]} <span className="font-mono">{e.sourceRef}</span> · {formatStamp(e.observedAt)}
            {e.recordedById ? ` · recorded by ${personName(e.recordedById)}` : ''}
          </div>
          {held?.state === 'stale' ? (
            <div className="text-status-amber-fg">
              Stale: the work it covers changed {held.workChangedAt ? formatStamp(held.workChangedAt) : 'after it was observed'}
              {held.workChangedAt ? ` (${Math.max(0, daysBetween(e.observedAt, held.workChangedAt))} days later)` : ''}.
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-1.5">
        {systemFed ? (
          <>
            <span className="inline-flex items-center gap-1 text-[11px] text-fg-muted">
              <FlaskConical aria-hidden className="size-3.5 text-prov-simulated" /> Simulate evidence arriving
            </span>
            <Button size="sm" variant="secondary" onClick={() => record('pass')} {...passT}>
              {e?.result === 'fail' ? 'Rerun: pass' : 'Pass'}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => record('fail')} {...failT}>
              Fail
            </Button>
            <span className="text-[10.5px] text-prov-simulated">Nothing is executed.</span>
          </>
        ) : (
          <>
            <Button size="sm" variant="secondary" icon={<PenLine />} onClick={() => record('pass')} {...passT}>
              Record {lower(terms.evidenceKinds[item.kind])}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => record('fail')}>
              Record as failed
            </Button>
            <span className="text-[10.5px] text-fg-subtle">as {personName(actingAs)}</span>
          </>
        )}
      </div>
    </li>
  );
}

function titleFor(kind: EvidenceKind, ref: string, again: boolean): string {
  switch (kind) {
    case 'test-result':
      return again ? `${ref} regression suite (rerun)` : `${ref} regression suite`;
    case 'requirements-sign-off':
      return 'Requirements signed off';
    case 'design-review':
      return 'Design review held';
    case 'control-assessment':
      return 'Control assessment completed';
    case 'release-checklist':
      return 'Release checklist complete';
    default:
      return terms.evidenceKinds[kind];
  }
}

function SimulateWork({ step }: { step: StageView['simulatedSteps'][number] }) {
  const { id, measures, actions, act, actingAs } = useWorkflow();
  const halfT = useTarget('simulate-work:half');
  const restT = useTarget('simulate-work:rest');
  const wc = measures.workCompletion;
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-prov-simulated/40 bg-prov-simulated-soft/40 p-2.5" data-testid="simulate-work">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-semibold text-fg">{step.label}</span>
        <ProvenanceBadge kind="simulated" size="sm" label="Simulated step" />
      </div>
      <p className="text-[11.5px] leading-snug text-fg-muted">
        {step.reason} {wc.computable ? `${terms.measures.workCompletion}: ${wc.value.closedPoints} of ${wc.value.totalPoints} points.` : ''}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="secondary" disabledReason={step.enabled ? undefined : step.reason} onClick={() => act(() => actions.simulateWorkClosed(id, actingAs, { share: 0.5 }))} {...halfT}>
          Close half
        </Button>
        <Button size="sm" variant="secondary" disabledReason={step.enabled ? undefined : step.reason} onClick={() => act(() => actions.simulateWorkClosed(id, actingAs))} {...restT}>
          Close the rest
        </Button>
      </div>
    </div>
  );
}

function AcceptanceBlock() {
  const { outcomes } = useWorkflow();
  return (
    <section className="flex flex-col gap-2" aria-label="Business acceptance">
      <div className="di-eyebrow">Acceptance criteria and business acceptance</div>
      {outcomes.length === 0 ? <p className="text-[12px] text-fg-muted">No outcomes recorded.</p> : outcomes.map((o) => <OutcomeAcceptanceCard key={o.id} outcome={o} />)}
    </section>
  );
}

function OutcomeAcceptanceCard({ outcome: o }: { outcome: Outcome }) {
  const { id, measures, actions, act, actingAs, personName, evidence } = useWorkflow();
  const idx = usePortfolioIndex();
  const criteria = idx.criteriaByOutcome.get(o.id) ?? [];
  const mandatory = criteria.filter((c) => c.mandatory);
  const optional = criteria.length - mandatory.length;
  const open = mandatory.filter((c) => c.state !== 'accepted');
  const acc = measures.acceptedOutcomes.computable ? measures.acceptedOutcomes.value.outcomes.find((x) => x.outcomeId === o.id) : undefined;
  const recordT = useTarget(`record-acceptance:${o.id}`);
  const ba = evidence.filter((e) => e.kind === 'business-acceptance' && e.outcomeId === o.id).at(-1);

  return (
    <div className="flex flex-col gap-2 rounded-md border border-line p-2.5" data-testid={`outcome-${o.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-mono text-[10.5px] text-fg-subtle">{o.ref}</div>
          <div className="text-[12.5px] leading-snug font-semibold text-fg">{o.title}</div>
          <div className="text-[11px] text-fg-subtle">Acceptance owner: {personName(o.acceptanceOwnerId)}</div>
        </div>
        {acc?.accepted ? (
          <Badge size="sm" tone="green" icon={<CheckCheck />}>
            Accepted
          </Badge>
        ) : (
          <Badge size="sm" tone="unknown">
            Not accepted
          </Badge>
        )}
      </div>
      <ul className="flex flex-col gap-1.5">
        {mandatory.map((c) => (
          <CriterionRow key={c.id} criterionId={c.id} />
        ))}
      </ul>
      {optional > 0 ? <p className="text-[11px] text-fg-subtle">Plus {optional} story criteria (not mandatory for acceptance).</p> : null}
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          size="sm"
          variant="secondary"
          icon={<PenLine />}
          disabledReason={open.length > 0 ? `Accept the ${open.length} open mandatory criteri${open.length === 1 ? 'on' : 'a'} of ${o.ref} before recording business acceptance.` : undefined}
          onClick={() =>
            act(() =>
              actions.recordEvidence({ deliverableId: id, kind: 'business-acceptance', result: 'pass', title: `${o.ref} accepted by ${personName(o.acceptanceOwnerId)}`, outcomeId: o.id, recordedById: actingAs, simulated: false }),
            )
          }
          {...recordT}
        >
          Record business acceptance
        </Button>
        {ba ? (
          <span className="text-[11px] text-fg-muted">
            Held: {terms.evidenceResults[ba.result].toLowerCase()}, {formatStamp(ba.observedAt)}
          </span>
        ) : (
          <span className="text-[11px] text-fg-subtle">Criteria alone do not accept the outcome.</span>
        )}
      </div>
    </div>
  );
}

function CriterionRow({ criterionId }: { criterionId: string }) {
  const { actions, act, actingAs, personName } = useWorkflow();
  const idx = usePortfolioIndex();
  const c = idx.criteria.get(criterionId)!;
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const acceptT = useTarget(`accept-criterion:${c.id}`);
  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-start gap-2">
        <span className="min-w-0 flex-1 text-[12px] leading-snug text-fg">{c.text}</span>
        {c.state === 'accepted' ? (
          <Badge size="sm" tone="green" icon={<Check />} title={c.acceptedAt ? `${personName(c.acceptedById)}, ${formatStamp(c.acceptedAt)}` : undefined}>
            {terms.criterionStates.accepted}
          </Badge>
        ) : (
          <span className="flex shrink-0 items-center gap-1">
            {c.state === 'rejected' ? <Badge size="sm" tone="red" icon={<X />}>{terms.criterionStates.rejected}</Badge> : null}
            <Button size="sm" variant="secondary" icon={<Check />} onClick={() => act(() => actions.acceptCriterion(c.id, actingAs))} {...acceptT}>
              Accept
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRejecting((v) => !v)} aria-expanded={rejecting}>
              Reject
            </Button>
          </span>
        )}
      </div>
      {c.state === 'accepted' && c.acceptedById ? <span className="text-[10.5px] text-fg-subtle">Accepted by {personName(c.acceptedById)}</span> : null}
      {c.state === 'rejected' && c.rejectionReason ? <span className="text-[10.5px] text-status-red-fg">Rejected: {c.rejectionReason}</span> : null}
      {rejecting ? (
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (act(() => actions.rejectCriterion(c.id, actingAs, reason)).ok) setRejecting(false);
          }}
        >
          <input
            aria-label="Reason for rejecting"
            placeholder="Reason (required)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={cx('h-7 min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-2 text-[12px] text-fg', FOCUS_RING)}
          />
          <Button size="sm" type="submit" variant="danger" disabledReason={reason.trim() ? undefined : 'Rejecting a criterion needs a reason.'}>
            Reject
          </Button>
        </form>
      ) : null}
    </li>
  );
}
