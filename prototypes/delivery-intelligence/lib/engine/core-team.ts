/**
 * The Core Four on a deliverable: who holds each core role, which roles are
 * missing, who holds more than one, and when work started. Pure helpers shared
 * by rules R15 and R16, the governance checks and the read models.
 */
import { CORE_ROLES } from '@/lib/config/pdlc';
import type { CoreRole, IsoDate, IsoDateTime, TechDeliverable, WorkItem } from '@/lib/types';
import { toMs } from './util';

export interface CoreSeatView {
  roleId: CoreRole;
  personId: string | null;
  joinedAt: IsoDate | null;
  /** True when the same person also holds another core role on this deliverable. */
  shared: boolean;
}

/** One row per core role, in `CORE_ROLES` order, gaps included. */
export function coreTeamSeats(d: Pick<TechDeliverable, 'coreTeam'>): CoreSeatView[] {
  const shared = new Set(sharedCoreSeats(d).map((s) => s.personId));
  return CORE_ROLES.map((roleId) => {
    const seat = d.coreTeam[roleId];
    const personId = seat?.personId || null;
    return { roleId, personId, joinedAt: personId ? (seat?.joinedAt ?? null) : null, shared: personId !== null && shared.has(personId) };
  });
}

/** Core roles with no named person. */
export function missingCoreRoles(d: Pick<TechDeliverable, 'coreTeam'>): CoreRole[] {
  return CORE_ROLES.filter((r) => !d.coreTeam[r]?.personId);
}

/** People who hold two or more core roles on the deliverable, with those roles in `CORE_ROLES` order. */
export function sharedCoreSeats(d: Pick<TechDeliverable, 'coreTeam'>): { personId: string; roles: CoreRole[] }[] {
  const byPerson = new Map<string, CoreRole[]>();
  for (const r of CORE_ROLES) {
    const id = d.coreTeam[r]?.personId;
    if (!id) continue;
    byPerson.set(id, [...(byPerson.get(id) ?? []), r]);
  }
  return [...byPerson.entries()].filter(([, roles]) => roles.length > 1).map(([personId, roles]) => ({ personId, roles }));
}

/** Core roles a person holds on the deliverable (usually none or one). */
export function rolesHeldBy(d: Pick<TechDeliverable, 'coreTeam'>, personId: string | null | undefined): CoreRole[] {
  if (!personId) return [];
  return CORE_ROLES.filter((r) => d.coreTeam[r]?.personId === personId);
}

/** The person holding a core role, or null. */
export function coreRoleHolder(d: Pick<TechDeliverable, 'coreTeam'>, roleId: CoreRole): string | null {
  return d.coreTeam[roleId]?.personId || null;
}

/**
 * When work on a deliverable demonstrably started (rule R16).
 *
 * The work tracker snapshot holds no status history, so the moment an item left
 * "to do" is not recorded. The engine uses the latest moment the move can have
 * happened: `resolved` for an item that is done (falling back to `updated`) and
 * `updated` for one in progress. Work counts as started no later than the
 * earliest of these across the deliverable's story-level items that are no
 * longer in "to do". Items still in "to do" are ignored, and so are Epics and
 * sub-tasks. Because the date is an upper bound, a finding is raised only when a
 * join is provably later than the start of work.
 */
export function workStartedAt(storyLevelItems: readonly WorkItem[]): { at: IsoDateTime; key: string } | null {
  let best: { at: IsoDateTime; key: string; ms: number } | null = null;
  for (const item of storyLevelItems) {
    if (item.statusCategory === 'to-do') continue;
    const at = item.statusCategory === 'done' ? (item.resolved ?? item.updated) : item.updated;
    const ms = toMs(at);
    if (!best || ms < best.ms || (ms === best.ms && item.key < best.key)) best = { at, key: item.key, ms };
  }
  return best ? { at: best.at, key: best.key } : null;
}

/** The latest join among the seats that are filled, or null when none is. */
export function latestJoin(d: Pick<TechDeliverable, 'coreTeam'>): { roleId: CoreRole; joinedAt: IsoDate } | null {
  let best: { roleId: CoreRole; joinedAt: IsoDate } | null = null;
  for (const seat of coreTeamSeats(d)) {
    if (!seat.personId || !seat.joinedAt) continue;
    if (!best || seat.joinedAt > best.joinedAt) best = { roleId: seat.roleId, joinedAt: seat.joinedAt };
  }
  return best;
}
