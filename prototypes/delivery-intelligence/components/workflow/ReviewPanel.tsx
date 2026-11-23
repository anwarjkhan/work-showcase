'use client';

import { Check, Undo2, UserCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PRESENTER_PERSON_ID } from '@/lib/config/story';
import { terms } from '@/lib/config/terminology';
import { DemoNote, AvatarLabel, Button, cx } from '@/components/ui';
import { FOCUS_RING } from '@/components/ui/cx';
import { usePortfolioIndex } from '@/lib/store';
import type { StageView } from '@/lib/agents/workflow';
import { BeatHeader, ReviewStateBadge } from './bits';
import { NEXT_RING, useWorkflow } from './context';
import { formatStamp } from './model';

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export function ReviewPanel() {
  const { view } = useWorkflow();
  const cur = view.stages.find((s) => s.current)!;
  return (
    <div className="flex min-h-0 flex-col gap-3 overflow-y-auto p-4" data-testid="review-panel">
      <BeatHeader index={2} icon={<UserCheck />} title="A named human reviews" />
      <ActingAs />
      <ul className="flex flex-col gap-3">
        {cur.reviews.map((r) => (
          <ReviewRow key={r.roleId} stage={cur} review={r} />
        ))}
      </ul>
      <DemoNote as="p" className="mt-auto text-[11.5px] leading-snug text-fg-subtle">
        Reviews are illustrative and set in configuration, not official gates. Moving forward needs every review of this stage approved by its named reviewer; an agent can never approve.
      </DemoNote>
    </div>
  );
}

function ActingAs() {
  const { deliverable: d, outcomes, actingAs, actions, next, person } = useWorkflow();
  const idx = usePortfolioIndex();
  const options = useMemo(() => {
    const ids = new Set<string>([PRESENTER_PERSON_ID, ...Object.values(d.reviewers).filter((x): x is string => !!x), ...outcomes.map((o) => o.acceptanceOwnerId), d.ownerId]);
    for (const m of idx.pods.get(d.podId)?.memberIds.slice(0, 6) ?? []) ids.add(m);
    ids.add(actingAs);
    return [...ids].map((pid) => idx.people.get(pid)).filter((p): p is NonNullable<typeof p> => !!p);
  }, [d, outcomes, idx, actingAs]);
  const rolesOf = (pid: string) => {
    const roles = Object.entries(d.reviewers)
      .filter(([, v]) => v === pid)
      .map(([k]) => terms.reviewRoles[k as keyof typeof terms.reviewRoles]);
    if (outcomes.some((o) => o.acceptanceOwnerId === pid)) roles.push('Acceptance owner');
    return roles;
  };
  const me = person(actingAs);
  const highlighted = next?.target.startsWith('act-as:') ?? false;
  const myRoles = rolesOf(actingAs);
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-line bg-surface-2 p-2.5">
      <label className="flex items-center gap-2 text-[12px] text-fg-muted">
        <span className="shrink-0">Acting as</span>
        <select
          value={actingAs}
          data-testid="acting-as"
          data-target={next?.target.startsWith('act-as:') ? next.target : 'act-as'}
          {...(highlighted ? { 'data-next': 'true' } : {})}
          onChange={(e) => actions.setActingAs(e.target.value)}
          className={cx('h-7 min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-2 text-[12.5px] font-medium text-fg', FOCUS_RING, highlighted && NEXT_RING)}
        >
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {rolesOf(p.id).length > 0 ? rolesOf(p.id).length > 2 ? `${rolesOf(p.id).length} roles here` : rolesOf(p.id).join(', ') : p.title}
            </option>
          ))}
        </select>
      </label>
      <p className="text-[11px] leading-snug text-fg-subtle">
        {me ? `${me.title}. ` : ''}
        {myRoles.length > 0 ? `Named here as ${myRoles.length > 3 ? `${myRoles.length} roles` : myRoles.map(lower).join(', ')}.` : 'Holds no named role on this deliverable; switch to them to see a refusal.'}
      </p>
    </div>
  );
}

function ReviewRow({ stage, review }: { stage: StageView; review: StageView['reviews'][number] }) {
  const { id, deliverable, actions, act, actingAs, person, personName, next } = useWorkflow();
  const [returning, setReturning] = useState(false);
  const [reason, setReason] = useState('');
  const def = stage.definition;
  const p = person(review.reviewerId);
  const role = lower(terms.reviewRoles[review.roleId]);
  const target = `approve-review:${review.roleId}`;
  const on = next?.target === target;

  let blocked: string | undefined;
  if (review.state !== 'approved' && !review.next) {
    const earlier = def.reviews.slice(0, def.reviews.indexOf(review.roleId)).map((r) => lower(terms.reviewRoles[r]));
    blocked = `The ${earlier.join(' and ')} review must be approved first.`;
  } else {
    const failing = stage.evidence.find((e) => e.latest && e.latest.result === 'fail');
    if (failing?.latest) blocked = `The ${role} review cannot be approved while the ${lower(terms.evidenceKinds[failing.kind])} (${failing.latest.sourceRef}) is failing.`;
  }
  const notNamed = review.reviewerId && review.reviewerId !== actingAs;
  const decisions = review.decisions.slice(-2);

  return (
    <li className="flex flex-col gap-2 rounded-md border border-line p-2.5" data-testid={`review-${review.roleId}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-semibold text-fg">{terms.reviewRoles[review.roleId]}</span>
        <ReviewStateBadge state={review.state} />
      </div>
      {p ? <AvatarLabel initials={p.initials} name={p.name} detail={`Named ${role} for ${deliverable.ref}`} size="sm" /> : <span className="text-[12px] text-status-amber-fg">No named reviewer recorded.</span>}
      {decisions.length > 0 ? (
        <ul className="flex flex-col gap-0.5">
          {decisions.map((dec) => (
            <li key={dec.id} className={cx('text-[11.5px] leading-snug', dec.decision === 'approved' ? 'text-status-green-fg' : 'text-status-red-fg')}>
              {dec.decision === 'approved' ? 'Approved' : 'Returned'} by {personName(dec.reviewerId)}, {formatStamp(dec.decidedAt)}
              {dec.reason ? <span className="text-fg-muted">: {dec.reason}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {review.state !== 'approved' ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="primary"
              icon={<Check />}
              disabledReason={blocked}
              onClick={() => act(() => actions.approveReview(id, def.id, review.roleId, actingAs))}
              data-target={target}
              {...(on ? { 'data-next': 'true' } : {})}
              className={cx(on && NEXT_RING)}
            >
              Approve
            </Button>
            <Button size="sm" variant="secondary" icon={<Undo2 />} onClick={() => setReturning((v) => !v)} aria-expanded={returning}>
              Return
            </Button>
          </div>
          {notNamed && !blocked ? (
            <p className="text-[11px] leading-snug text-status-amber-fg">
              You are acting as {personName(actingAs)}; the named {role} is {personName(review.reviewerId)}. Approving will be refused and logged.
            </p>
          ) : null}
          {returning ? (
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
        </>
      ) : null}
    </li>
  );
}
