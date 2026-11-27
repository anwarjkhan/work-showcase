/**
 * Core Four seats for the generated deliverables, and the deliberate gaps the
 * demo shows (rules R15 and R16). Every other deliverable has four different
 * people, all joined before work started.
 *
 * The gaps sit on deliverables whose evidence-based status is already Amber or
 * Red, or raise only medium findings, so the evidence-based RAG distribution and
 * the readiness distribution are unchanged by them:
 *   - td-1014 (T3, Amber): no In-Business Risk Lead (R15 high: T3 needs one), while in
 *     Risk, Control & Compliance Reviews. Work has started, so R16 too (medium).
 *   - td-1019 (T2, Amber) and td-1007 (T4, Amber): no UX Design Lead (R15 medium; R16 medium).
 *   - td-1005 (T2, Amber): its Tech Lead (a senior pod member, not the pod lead, so nobody
 *     seated on the hero or the walk-through) also holds the UX Design Lead seat (R15 medium);
 *     that person may not decide reviews until the seat is given to someone else.
 *   - td-1009 (T3, Amber): the In-Business Risk Lead joined after work started (R16 medium).
 *   - td-2005 (T2, Green): the UX Design Lead joined after work started (R16 medium: no RAG effect).
 */
import { STORY_LEVEL_TYPES } from '@/lib/engine/constants';
import { workStartedAt } from '@/lib/engine/core-team';
import type { CoreRole, CoreTeamSeat, IsoDate, TechDeliverable, WorkItem } from '@/lib/types';
import { addDays, daysBetween, minDate, TODAY } from './dates';

export const CORE_TEAM_GAPS: {
  missing: Record<string, CoreRole[]>;
  /** `role` is given to whoever holds `heldBy`; `personId`, when set, takes the `heldBy` seat first. */
  shared: Record<string, { role: CoreRole; heldBy: CoreRole; personId?: string }>;
  lateJoin: Record<string, CoreRole>;
} = {
  missing: { 'td-1014': ['risk-lead'], 'td-1019': ['ux-lead'], 'td-1007': ['ux-lead'] },
  shared: { 'td-1005': { role: 'ux-lead', heldBy: 'tech-lead', personId: 'p-xva-nyc-4' } },
  lateJoin: { 'td-1009': 'risk-lead', 'td-2005': 'ux-lead' },
};

/** Days before the start of the deliverable's work that each role joined (the Product Manager first). */
const JOIN_LEAD_DAYS: Record<CoreRole, number> = { 'product-manager': 21, 'tech-lead': 14, 'risk-lead': 10, 'ux-lead': 7 };
/** Days after the start of work that a deliberately late joiner arrived (capped before today). */
const LATE_JOIN_DAYS = 12;

/** A seat with a provisional join date; `settleCoreTeamDates` sets the real one once work items exist. */
export function provisionalSeat(personId: string, plannedStart: IsoDate): CoreTeamSeat {
  return { personId, joinedAt: plannedStart };
}

/** Removes or doubles up seats for the deliberate gaps. */
export function applyCoreTeamGaps(deliverableId: string, seats: Record<CoreRole, CoreTeamSeat>): Partial<Record<CoreRole, CoreTeamSeat>> {
  const out: Partial<Record<CoreRole, CoreTeamSeat>> = { ...seats };
  for (const role of CORE_TEAM_GAPS.missing[deliverableId] ?? []) delete out[role];
  const shared = CORE_TEAM_GAPS.shared[deliverableId];
  if (shared) {
    const seat = shared.personId ? { ...seats[shared.heldBy], personId: shared.personId } : seats[shared.heldBy];
    out[shared.heldBy] = { ...seat };
    out[shared.role] = { ...seat };
  }
  return out;
}

/**
 * Sets join dates from the work: every seat joins before the earliest record of
 * the deliverable (its planned start, or the creation of any of its items, or
 * the start of work), staggered by role; a deliberately late joiner arrives
 * after work had demonstrably started (the engine's `workStartedAt`).
 */
export function settleCoreTeamDates(deliverables: TechDeliverable[], workItems: WorkItem[]): void {
  const epicOf = new Map<string, string>();
  for (const d of deliverables) for (const k of d.epicKeys) epicOf.set(k, d.id);
  const items = new Map<string, WorkItem[]>();
  for (const w of workItems) {
    const owner = epicOf.get(w.key) ?? (w.epicKey ? epicOf.get(w.epicKey) : undefined);
    if (owner) items.set(owner, [...(items.get(owner) ?? []), w]);
  }
  for (const d of deliverables) {
    const own = items.get(d.id) ?? [];
    const started = workStartedAt(own.filter((w) => STORY_LEVEL_TYPES.has(w.type)));
    let anchor = d.plannedStart;
    for (const w of own) anchor = minDate(anchor, w.created.slice(0, 10));
    if (started) anchor = minDate(anchor, started.at.slice(0, 10));
    const late = CORE_TEAM_GAPS.lateJoin[d.id];
    for (const role of Object.keys(d.coreTeam) as CoreRole[]) {
      const seat = d.coreTeam[role];
      if (!seat) continue;
      let joinedAt = addDays(anchor, -JOIN_LEAD_DAYS[role]);
      if (role === late && started) {
        const startDay = started.at.slice(0, 10);
        joinedAt = addDays(startDay, Math.max(1, Math.min(LATE_JOIN_DAYS, daysBetween(startDay, TODAY) - 1)));
      }
      d.coreTeam[role] = { ...seat, joinedAt };
    }
  }
}
