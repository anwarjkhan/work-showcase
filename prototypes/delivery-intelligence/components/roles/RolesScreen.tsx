'use client';

import { ArrowRight, CheckCircle2, CircleDashed, Hourglass, ShieldCheck, UserRoundX, UsersRound, Clock3 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Avatar, Badge, cx, DemoNote, EmptyState, Section, Tabs, type TabItem } from '@/components/ui';
import { FOCUS_RING, TRANSITION } from '@/components/ui/cx';
import { CORE_ROLES, GATE_ROLE } from '@/lib/config/pdlc';
import { hrefs } from '@/lib/config/routes';
import { terms } from '@/lib/config/terminology';
import { useEngineResult, usePortfolioData, usePortfolioIndex } from '@/lib/store';
import type { CoreRole, ReviewState } from '@/lib/types';
import { buildRoleBoards, forPerson, parseRolesHash, workflowHref, type RoleGapItem, type RoleReviewItem } from './model';

const LINK_BUTTON = 'inline-flex h-7 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-xs font-medium';
const LINK_PRIMARY = 'border-transparent bg-accent text-on-accent shadow-card hover:bg-accent-strong';
const LINK_SECONDARY = 'border-line-strong bg-surface text-fg shadow-card hover:border-accent-line hover:text-accent';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "By role": what each of the Core Four has waiting, coming up, and the seat gaps. */
export function RolesScreen() {
  const data = usePortfolioData();
  const results = useEngineResult();
  const idx = usePortfolioIndex();
  const boards = useMemo(() => buildRoleBoards(data, results), [data, results]);
  const [role, setRole] = useState<CoreRole>(GATE_ROLE);
  const [person, setPerson] = useState<string | null>(null);

  // `#role=risk-lead` and `#person=<id>` (read on arrival and when the hash changes).
  useEffect(() => {
    const apply = () => {
      const h = parseRolesHash(window.location.hash);
      if (h.role) setRole(h.role);
      if (h.person) {
        setPerson(h.person);
        // A person alone selects the role they hold, when it is not named too.
        if (!h.role) {
          const first = CORE_ROLES.find((r) => boards[r].people.some((p) => p.id === h.person));
          if (first) setRole(first);
        }
      } else if (h.role) setPerson(null);
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, [boards]);

  const choose = useCallback((nextRole: CoreRole, nextPerson: string | null) => {
    setRole(nextRole);
    setPerson(nextPerson);
    const hash = `#role=${nextRole}${nextPerson ? `&person=${encodeURIComponent(nextPerson)}` : ''}`;
    try {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
    } catch {
      // The view still switches without a shareable hash.
    }
  }, []);

  const board = boards[role];
  const validPerson = person && board.people.some((p) => p.id === person) ? person : null;
  const view = forPerson(board, validPerson);
  const personRow = board.people.find((p) => p.id === validPerson);
  const tabs: TabItem[] = CORE_ROLES.map((r) => ({ id: r, label: terms.coreRoles[r], count: boards[r].waiting.length }));
  const total = data.deliverables.length;

  return (
    <div className="flex flex-col gap-8" data-testid="roles-screen" data-role={role} data-person={validPerson ?? ''}>
      <Section
        title="The Core Four, role by role"
        description={`Every deliverable names a ${terms.coreRoles['product-manager']}, ${terms.coreRoles['tech-lead']}, ${terms.coreRoles['risk-lead']} and ${terms.coreRoles['ux-lead']}. Pick a role to see what waits on it across ${total} deliverables.`}
      >
        <ul className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Confirmations waiting, by role" data-testid="role-counts">
          {CORE_ROLES.map((r) => (
            <RoleCount key={r} roleId={r} selected={r === role} onSelect={() => choose(r, null)} waiting={boards[r].waiting.length} comingUp={boards[r].comingUp.length} gaps={boards[r].gaps.length} />
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Tabs ariaLabel="Core Four role" variant="segmented" items={tabs} value={role} onChange={(id) => choose(id as CoreRole, board.people.some((p) => p.id === validPerson) ? validPerson : null)} />
          <label className="flex items-center gap-2 text-xs text-fg-muted">
            Person in the role
            <select
              data-testid="role-person"
              value={validPerson ?? ''}
              onChange={(e) => choose(role, e.target.value || null)}
              className={cx('h-7 rounded-md border border-line-strong bg-surface px-2 text-xs text-fg', FOCUS_RING)}
            >
              <option value="">Everyone in the role</option>
              {board.people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {plural(p.deliverables, 'deliverable')}
                  {p.waiting > 0 ? ` · ${p.waiting} waiting` : ''}
                </option>
              ))}
            </select>
          </label>
          <p className="text-[13px] text-fg-muted" aria-live="polite" data-testid="role-summary">
            {validPerson && personRow ? `${personRow.name} as ${terms.coreRoles[role]}: ` : `${terms.coreRoles[role]}s: `}
            <strong className="font-semibold text-title">{plural(view.waiting.length, role === GATE_ROLE ? 'gate' : 'confirmation')} waiting</strong>
            {`, ${view.comingUp.length} coming up, ${plural(view.gaps.length, 'seat gap')}.`}
          </p>
        </div>
      </Section>

      <Section
        title="Waiting on you"
        description={`Reviews where ${validPerson && personRow ? personRow.name : `a ${terms.coreRoles[role]}`} is the next to decide. Open the workflow with the persona already switched.`}
      >
        {view.waiting.length === 0 ? (
          <EmptyState variant="inline" title="Nothing is waiting" description={`No deliverable is waiting on ${validPerson && personRow ? personRow.name : `a ${terms.coreRoles[role]}`} right now.`} />
        ) : (
          <ul className="flex flex-col gap-2" data-testid="role-waiting" aria-label="Waiting on you">
            {view.waiting.map((item) => (
              <ReviewRow key={`${item.deliverableId}:${item.roleId}`} item={item} idx={idx} primary />
            ))}
          </ul>
        )}
      </Section>

      <Section title="Coming up" description={`This role's reviews in the current stage that are not next yet: they wait on an earlier confirmation in the same stage.`}>
        {view.comingUp.length === 0 ? (
          <EmptyState variant="inline" title="Nothing queued behind another review" description="No review of this role is waiting on an earlier confirmation." />
        ) : (
          <ul className="flex flex-col gap-2" data-testid="role-coming" aria-label="Coming up">
            {view.comingUp.map((item) => (
              <ReviewRow key={`${item.deliverableId}:${item.roleId}`} item={item} idx={idx} />
            ))}
          </ul>
        )}
      </Section>

      <Section title="Seat gaps" description={`Deliverables where the ${terms.coreRoles[role]} seat is not named or held twice, and findings about work that started before the ${terms.coreTeam.name} was complete (rule R16).`}>
        {view.gaps.length === 0 ? (
          <EmptyState variant="inline" title="No seat gaps for this role" description={`Every deliverable has a distinct ${terms.coreRoles[role]} named${validPerson ? ' for this person' : ''}.`} />
        ) : (
          <ul className="flex flex-col gap-2" data-testid="role-gaps" aria-label="Seat gaps">
            {view.gaps.map((g, i) => (
              <GapRow key={`${g.deliverableId}:${g.kind}:${i}`} gap={g} />
            ))}
          </ul>
        )}
      </Section>

      <DemoNote as="p" className="text-xs text-fg-subtle">
        The Core Four, their seats and the reviews are sample data held in this prototype. The lists are computed from it on the demo clock and update as reviews are decided.
      </DemoNote>
    </div>
  );
}

function RoleCount({ roleId, selected, onSelect, waiting, comingUp, gaps }: { roleId: CoreRole; selected: boolean; onSelect: () => void; waiting: number; comingUp: number; gaps: number }) {
  const gate = roleId === GATE_ROLE;
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        data-testid={`role-count-${roleId}`}
        data-waiting={waiting}
        className={cx('di-card flex w-full min-w-0 flex-col gap-1 px-4 py-3 text-left hover:border-accent-line', selected && 'border-accent-line bg-accent-soft ring-1 ring-accent-line', TRANSITION, FOCUS_RING)}
      >
        <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-fg-muted">
          {gate ? <ShieldCheck aria-hidden className="size-3.5 text-accent" /> : <UsersRound aria-hidden className="size-3.5 text-fg-subtle" />}
          {terms.coreRoles[roleId]}
        </span>
        <span className="flex items-baseline gap-2">
          <span className="font-display text-[26px] leading-none font-semibold text-title tabular-nums" data-testid={`role-count-value-${roleId}`}>
            {waiting}
          </span>
          <span className="text-[12.5px] text-fg-muted">{gate ? (waiting === 1 ? 'gate waiting' : 'gates waiting') : waiting === 1 ? 'confirmation waiting' : 'confirmations waiting'}</span>
        </span>
        <span className="text-[11.5px] text-fg-subtle">
          {comingUp} coming up · {plural(gaps, 'seat gap')}
        </span>
      </button>
    </li>
  );
}

const STATE_BADGE: Record<ReviewState, { label: string; tone: 'amber' | 'neutral' | 'red' | 'green'; icon: React.ReactNode }> = {
  pending: { label: 'Pending', tone: 'amber', icon: <Hourglass /> },
  'not-requested': { label: 'Not requested yet', tone: 'neutral', icon: <CircleDashed /> },
  returned: { label: 'Returned', tone: 'red', icon: <Hourglass /> },
  approved: { label: 'Approved', tone: 'green', icon: <CheckCircle2 /> },
};

function ReviewRow({ item, idx, primary }: { item: RoleReviewItem; idx: ReturnType<typeof usePortfolioIndex>; primary?: boolean }) {
  const p = item.personId ? idx.people.get(item.personId) : undefined;
  const badge = STATE_BADGE[item.state];
  const href = workflowHref(hrefs.workflow(item.deliverableId), item.personId);
  return (
    <li
      className="di-card grid min-w-0 grid-cols-[minmax(0,1.5fr)_minmax(0,1.3fr)_minmax(0,1fr)_230px] items-center gap-x-4 gap-y-1 px-4 py-2.5 max-xl:grid-cols-[minmax(0,1fr)_auto]"
      data-testid="role-item"
      data-deliverable={item.deliverableId}
      data-role={item.roleId}
      data-person={item.personId ?? ''}
    >
      <div className="min-w-0">
        <div className="font-mono text-[10.5px] text-fg-subtle">{item.ref}</div>
        <Link href={hrefs.deliverable(item.deliverableId)} className={cx('block truncate rounded-xs text-[13px] font-semibold text-title hover:text-accent hover:underline', FOCUS_RING)} title={item.title}>
          {item.title}
        </Link>
      </div>
      <div className="min-w-0 text-[12.5px] leading-snug max-xl:col-span-2 max-xl:row-start-2">
        <div className="font-medium text-fg">{item.what}</div>
        <div className="text-fg-muted">
          {item.stageName} · {item.done} of {item.total} done
          {item.behind ? ` · after ${item.behind}` : ''}
        </div>
      </div>
      <div className="flex min-w-0 items-center gap-2 max-xl:col-span-2 max-xl:row-start-3">
        {p ? <Avatar initials={p.initials} name={p.name} size="sm" /> : null}
        <span className="min-w-0 truncate text-[12px] text-fg-muted">{p?.name ?? terms.coreTeam.missing}</span>
        <Badge size="sm" tone={badge.tone} icon={badge.icon}>
          {badge.label}
        </Badge>
      </div>
      <Link
        href={href}
        data-testid="open-workflow-as"
        className={cx(LINK_BUTTON, primary ? LINK_PRIMARY : LINK_SECONDARY, TRANSITION, FOCUS_RING, 'max-xl:col-start-2 max-xl:row-start-1')}
      >
        Open workflow{p ? ` as ${p.name}` : ''}
        <ArrowRight aria-hidden className="size-3.5" />
      </Link>
    </li>
  );
}

const GAP_BADGE: Record<RoleGapItem['kind'], { label: string; icon: React.ReactNode }> = {
  'not-named': { label: terms.coreTeam.missing, icon: <UserRoundX /> },
  'two-roles': { label: 'Holds two roles', icon: <UsersRound /> },
  late: { label: 'Work started first', icon: <Clock3 /> },
};

function GapRow({ gap }: { gap: RoleGapItem }) {
  const b = GAP_BADGE[gap.kind];
  return (
    <li className="di-card flex min-w-0 items-start gap-4 px-4 py-2.5" data-testid="role-gap" data-kind={gap.kind} data-deliverable={gap.deliverableId}>
      <Badge size="sm" tone={gap.kind === 'not-named' ? 'red' : 'amber'} icon={b.icon} className="mt-0.5">
        {b.label}
      </Badge>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] leading-snug text-fg">
          <span className="mr-2 font-mono text-[10.5px] text-fg-subtle">{gap.ref}</span>
          {gap.text}
        </div>
      </div>
      <Link href={`${hrefs.deliverable(gap.deliverableId)}#pod`} className={cx('shrink-0 rounded-xs text-xs font-medium text-accent hover:underline', FOCUS_RING)}>
        Open the pod
      </Link>
    </li>
  );
}
