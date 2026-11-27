'use client';

import { Check, ShieldCheck, Undo2, UserRoundX, UsersRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PRESENTER_PERSON_ID } from '@/lib/config/story';
import { terms } from '@/lib/config/terminology';
import { DemoNote, Avatar, Badge, Button, cx } from '@/components/ui';
import { FOCUS_RING } from '@/components/ui/cx';
import { usePortfolioIndex } from '@/lib/store';
import type { ReviewView, StageView } from '@/lib/agents/workflow';
import { BeatHeader, ReviewStateBadge } from './bits';
import { NEXT_RING, useWorkflow } from './context';
import { formatStamp } from './model';

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Beat 2: the Core Four's confirmations, each row decided only by the person holding that role, the Product Manager's gate last. */
export function ReviewPanel() {
  const { view } = useWorkflow();
  const cur = view.stages.find((s) => s.current)!;
  const done = cur.reviews.filter((r) => r.state === 'approved').length;
  return (
    <div className="flex min-h-0 flex-col gap-3 overflow-y-auto p-4" data-testid="review-panel">
      <BeatHeader
        index={2}
        icon={<UsersRound />}
        title="The Core Four review"
        aside={
          <span className="text-[11px] text-fg-subtle tabular-nums" data-testid="review-progress">
            {done} of {cur.reviews.length} done
          </span>
        }
      />
      <ActingAs />
      <ul className="flex flex-col gap-2">
        {cur.reviews.map((r) => (
          <ReviewRow key={r.roleId} stage={cur} review={r} />
        ))}
      </ul>
      <DemoNote as="p" className="mt-auto text-[11.5px] leading-snug text-fg-subtle">
        Illustrative, set in configuration, not official gates. Only a role&apos;s holder decides it; an agent never approves.
      </DemoNote>
    </div>
  );
}

function ActingAs() {
  const { deliverable: d, view, outcomes, actingAs, actions, next, person } = useWorkflow();
  const idx = usePortfolioIndex();
  const core = view.coreTeam;
  const options = useMemo(() => {
    const coreIds = core.map((s) => s.personId).filter((x): x is string => !!x);
    const coreSet = new Set(coreIds);
    const others = new Set<string>([PRESENTER_PERSON_ID, ...outcomes.map((o) => o.acceptanceOwnerId), d.ownerId, actingAs]);
    for (const m of idx.pods.get(d.podId)?.memberIds.slice(0, 5) ?? []) others.add(m);
    const lookup = (ids: Iterable<string>) => [...ids].map((pid) => idx.people.get(pid)).filter((p): p is NonNullable<typeof p> => !!p);
    return { core: lookup(new Set(coreIds)), others: lookup([...others].filter((x) => !coreSet.has(x))) };
  }, [core, d, outcomes, idx, actingAs]);
  const rolesOf = (pid: string) => core.filter((s) => s.personId === pid).map((s) => s.roleShort);
  const label = (pid: string, title: string, name: string) => {
    const roles = rolesOf(pid);
    return `${name} · ${roles.length > 0 ? roles.join(' + ') : title}`;
  };
  const me = person(actingAs);
  const myRoles = core.filter((s) => s.personId === actingAs).map((s) => s.roleLabel);
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-line bg-surface-2 p-2.5">
      <label className="flex items-center gap-2 text-[12px] text-fg-muted">
        <span className="shrink-0">Acting as</span>
        <select
          value={actingAs}
          data-testid="acting-as"
          data-target="act-as"
          onChange={(e) => actions.setActingAs(e.target.value)}
          className={cx('h-7 min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-2 text-[12.5px] font-medium text-fg', FOCUS_RING)}
        >
          <optgroup label={terms.coreTeam.name}>
            {options.core.map((p) => (
              <option key={p.id} value={p.id}>
                {label(p.id, p.title, p.name)}
              </option>
            ))}
          </optgroup>
          {options.others.length > 0 ? (
            <optgroup label="Others">
              {options.others.map((p) => (
                <option key={p.id} value={p.id}>
                  {label(p.id, p.title, p.name)}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
      </label>
      <p className="text-[11px] leading-snug text-fg-subtle" data-testid="acting-as-note">
        {me ? `${me.title}. ` : ''}
        {myRoles.length > 0 ? `Holds ${myRoles.join(' and ')} on ${d.ref}.` : `Holds no ${terms.coreTeam.name} role on ${d.ref}; switch to a holder to decide a review.`}
        {next?.actAs ? ' The highlighted button switches to the right person for you.' : ''}
      </p>
    </div>
  );
}

function ReviewRow({ stage, review }: { stage: StageView; review: ReviewView }) {
  const { id, view, actions, act, actorFor, actingAs, person, personName, next } = useWorkflow();
  const [returning, setReturning] = useState(false);
  const [reason, setReason] = useState('');
  const def = stage.definition;
  const p = person(review.personId);
  const seat = view.coreTeam.find((s) => s.roleId === review.roleId);
  const target = `approve-review:${review.roleId}`;
  const on = next?.target === target;
  const approved = review.state === 'approved';
  const holderActing = review.personId !== null && review.personId === actingAs;
  const lastDecision = review.decisions.at(-1);

  const failing = stage.evidence.find((e) => e.latest && e.latest.result === 'fail');
  const evidenceBlock = failing?.latest ? `The ${review.roleLabel} review cannot be approved while the ${lower(terms.evidenceKinds[failing.kind])} (${failing.latest.sourceRef}) is failing.` : undefined;
  const decideLabel = review.gate ? 'Approve the gate' : 'Confirm';
  const label = review.next && !holderActing && !review.holderBlocked ? review.actionLabel : decideLabel;
  // Active for the next review (the highlighted control switches persona), and for the holder acting out of order, so the refusal can be shown.
  const showButton = !approved && !review.holderBlocked && (review.next || holderActing);
  const waiting = !approved && !review.holderBlocked && !review.next && !review.canDecide;

  return (
    <li
      className={cx(
        'flex flex-col gap-1.5 rounded-md border p-2.5',
        review.gate ? 'border-accent-line border-l-[3px] border-l-accent bg-accent-soft' : 'border-line bg-surface',
        review.next && !approved && 'shadow-card',
      )}
      data-testid={`review-${review.roleId}`}
      data-gate={review.gate || undefined}
      data-state={review.state}
    >
      <div className="flex items-start gap-2.5">
        {p ? <Avatar initials={p.initials} name={p.name} size="md" /> : (
          <span aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-dashed border-status-amber-line bg-status-amber-soft text-status-amber-fg">
            <UserRoundX className="size-4" />
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-title">
            {review.gate ? <ShieldCheck aria-hidden className="size-3.5 shrink-0 text-accent" /> : null}
            {review.gate ? `Gate · ${review.roleLabel}` : review.roleLabel}
          </span>
          <span className={cx('flex min-w-0 items-center gap-1.5 text-[12px]', p ? 'text-fg-muted' : 'font-medium text-status-amber-fg')}>
            <span className="truncate" data-testid={`review-holder-${review.roleId}`}>{p ? p.name : terms.coreTeam.missing}</span>
            {seat?.shared ? <Badge size="sm" tone="amber">{terms.coreTeam.twoRoles}</Badge> : null}
          </span>
        </div>
        <ReviewStateBadge state={review.state} />
      </div>
      <p className="text-[11.5px] leading-snug text-fg-muted">
        <span className="text-fg-subtle">{review.gate ? 'Decides' : 'Confirms'}:</span> {review.confirmed}
        {review.evidenceBefore ? <span className="text-fg-subtle"> · looks at the {lower(terms.evidenceKinds[review.evidenceBefore])}</span> : null}
      </p>
      {approved && lastDecision ? (
        <p className="text-[11.5px] leading-snug text-status-green-fg">
          Approved by {personName(lastDecision.reviewerId)}, {formatStamp(lastDecision.decidedAt)}
        </p>
      ) : null}
      {review.state === 'returned' && lastDecision ? (
        <p className="text-[11.5px] leading-snug text-status-red-fg">
          Returned by {personName(lastDecision.reviewerId)}, {formatStamp(lastDecision.decidedAt)}
          {lastDecision.reason ? <span className="text-fg-muted">: {lastDecision.reason}</span> : null}
        </p>
      ) : null}
      {review.holderBlocked && !approved ? (
        <p className="text-[11.5px] leading-snug font-medium text-status-amber-fg" data-testid={`review-blocked-${review.roleId}`}>
          {review.holderBlocked}
        </p>
      ) : null}
      {waiting ? (
        <p className="line-clamp-2 text-[11.5px] leading-snug text-fg-muted" title={review.decideReason} data-testid={`review-reason-${review.roleId}`}>
          {review.decideReason}
        </p>
      ) : null}
      {showButton ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={on ? 'primary' : 'secondary'}
            icon={<Check />}
            disabledReason={evidenceBlock}
            onClick={() => act(() => actions.approveReview(id, def.id, review.roleId, actorFor(target)))}
            data-target={target}
            {...(on ? { 'data-next': 'true' } : {})}
            className={cx(on && NEXT_RING)}
          >
            {label}
          </Button>
          {review.next && holderActing ? (
            <Button size="sm" variant="ghost" icon={<Undo2 />} onClick={() => setReturning((v) => !v)} aria-expanded={returning}>
              Return
            </Button>
          ) : null}
        </div>
      ) : null}
      {returning && review.personId ? (
        <form
          className="flex flex-col gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            const r = act(() => actions.returnReview(id, def.id, review.roleId, actingAs, reason));
            if (r.ok) setReturning(false);
          }}
        >
          <label className="text-[11.5px] text-fg-muted" htmlFor={`ret-${review.roleId}`}>
            Reason for returning (required; recorded with the move back)
          </label>
          <textarea
            id={`ret-${review.roleId}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className={cx('w-full resize-none rounded-md border border-line-strong bg-surface px-2 py-1.5 text-[12.5px] text-fg', FOCUS_RING)}
          />
          <div className="flex gap-2">
            <Button size="sm" type="submit" variant="danger" disabledReason={reason.trim() ? undefined : 'Returning a review needs a reason.'}>
              Return with reason
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setReturning(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </li>
  );
}
