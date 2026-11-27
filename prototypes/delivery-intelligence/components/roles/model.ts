/**
 * Pure derivation for the By role screen: for each of the Core Four, what is
 * waiting on that role, what is coming up, and where a seat is empty or held
 * twice. Everything comes from `describeWorkflow` per deliverable and the
 * engine's findings; nothing is hard-coded, so it follows the data.
 */
import { describeWorkflow } from '@/lib/agents/workflow';
import { CORE_ROLES } from '@/lib/config/pdlc';
import { terms } from '@/lib/config/terminology';
import type { CoreRole, EngineResult, Finding, PdlcStageId, PortfolioData, ReviewState } from '@/lib/types';

export interface RoleReviewItem {
  deliverableId: string;
  ref: string;
  title: string;
  stageId: PdlcStageId;
  stageName: string;
  roleId: CoreRole;
  personId: string | null;
  personName: string | null;
  gate: boolean;
  /** "Confirm: obligations named" / "Decide: go / no-go decision on the stage gate". */
  what: string;
  state: ReviewState;
  /** How many of the stage's reviews are done, and how many there are. */
  done: number;
  total: number;
  /** Who this one is queued behind (coming up only): the review that decides before it. */
  behind: string | null;
}

export interface RoleGapItem {
  deliverableId: string;
  ref: string;
  title: string;
  kind: 'not-named' | 'two-roles' | 'late';
  /** One plain sentence. */
  text: string;
  /** The person involved (for the person filter), if any. */
  personId: string | null;
}

export interface RoleBoard {
  roleId: CoreRole;
  waiting: RoleReviewItem[];
  comingUp: RoleReviewItem[];
  gaps: RoleGapItem[];
  /** People who hold this role on at least one deliverable, with how many items wait on each. */
  people: { id: string; name: string; deliverables: number; waiting: number }[];
}

export function buildRoleBoards(data: PortfolioData, results: EngineResult): Record<CoreRole, RoleBoard> {
  const boards = Object.fromEntries(CORE_ROLES.map((r) => [r, { roleId: r, waiting: [], comingUp: [], gaps: [], people: [] } as RoleBoard])) as Record<CoreRole, RoleBoard>;
  const roster = new Map<string, { id: string; name: string; deliverables: number; waiting: number }>();
  const key = (role: CoreRole, pid: string) => `${role}:${pid}`;
  const r16 = new Map<string, Finding[]>();
  for (const f of results.findings) if (f.ruleId === 'R16' && f.deliverableId) r16.set(f.deliverableId, [...(r16.get(f.deliverableId) ?? []), f]);
  const deliverables = [...data.deliverables].sort((a, b) => a.ref.localeCompare(b.ref, 'en', { numeric: true }));

  for (const d of deliverables) {
    const view = describeWorkflow(data, results, d.id);
    if (!view) continue;
    for (const seat of view.coreTeam) {
      if (seat.personId) {
        const k = key(seat.roleId, seat.personId);
        const row = roster.get(k) ?? { id: seat.personId, name: seat.personName ?? seat.personId, deliverables: 0, waiting: 0 };
        row.deliverables += 1;
        roster.set(k, row);
      }
    }
    // Seat gaps.
    for (const seat of view.coreTeam) {
      if (!seat.personId) {
        boards[seat.roleId].gaps.push({ deliverableId: d.id, ref: d.ref, title: d.title, kind: 'not-named', personId: null, text: `${d.ref} has no ${terms.coreRoles[seat.roleId]} named, so nobody can decide that role's reviews.` });
      } else if (seat.shared) {
        const other = view.coreTeam.filter((s) => s.personId === seat.personId && s.roleId !== seat.roleId).map((s) => terms.coreRoles[s.roleId]);
        boards[seat.roleId].gaps.push({
          deliverableId: d.id,
          ref: d.ref,
          title: d.title,
          kind: 'two-roles',
          personId: seat.personId,
          text: `${seat.personName} holds the ${terms.coreRoles[seat.roleId]} and the ${other.join(' and ')} roles on ${d.ref}; one person may not hold two, so neither review can be decided until a seat is given to someone else.`,
        });
      }
    }
    // R16: work started before the Core Four was complete. The finding names the seats that joined late (as person records) and the ones still unfilled.
    for (const f of r16.get(d.id) ?? []) {
      const latePeople = new Set(f.evidence.filter((e) => e.kind === 'person').map((e) => e.id));
      for (const seat of view.coreTeam) {
        if (seat.personId ? latePeople.has(seat.personId) : true) {
          boards[seat.roleId].gaps.push({ deliverableId: d.id, ref: d.ref, title: d.title, kind: 'late', personId: seat.personId, text: f.message });
        }
      }
    }
    // Reviews of the current stage.
    const cur = view.stages.find((s) => s.current);
    if (!cur) continue;
    const done = cur.reviews.filter((r) => r.state === 'approved').length;
    cur.reviews.forEach((r, i) => {
      if (r.state === 'approved') return;
      const item: RoleReviewItem = {
        deliverableId: d.id,
        ref: d.ref,
        title: d.title,
        stageId: cur.definition.id,
        stageName: cur.definition.name,
        roleId: r.roleId,
        personId: r.personId,
        personName: r.personName,
        gate: r.gate,
        what: r.gate ? `Decide the gate: ${r.confirmed.charAt(0).toLowerCase()}${r.confirmed.slice(1)}` : `Confirm: ${r.confirmed.charAt(0).toLowerCase()}${r.confirmed.slice(1)}`,
        state: r.state,
        done,
        total: cur.reviews.length,
        behind: r.next ? null : (cur.reviews.slice(0, i).filter((x) => x.state !== 'approved').map((x) => `${x.roleShort}`).join(' and ') || null),
      };
      if (r.next && !r.holderBlocked) {
        boards[r.roleId].waiting.push(item);
        if (r.personId) {
          const row = roster.get(key(r.roleId, r.personId));
          if (row) row.waiting += 1;
        }
      } else if (!r.next && !r.holderBlocked) boards[r.roleId].comingUp.push(item);
    });
  }
  for (const role of CORE_ROLES) {
    boards[role].people = [...roster.entries()]
      .filter(([k]) => k.startsWith(`${role}:`))
      .map(([, v]) => v)
      .sort((a, b) => b.waiting - a.waiting || a.name.localeCompare(b.name, 'en'));
  }
  return boards;
}

/** Narrows a board to one person in the role (items for that person, and gaps that involve them or an empty seat). */
export function forPerson(board: RoleBoard, personId: string | null): RoleBoard {
  if (!personId) return board;
  return {
    ...board,
    waiting: board.waiting.filter((i) => i.personId === personId),
    comingUp: board.comingUp.filter((i) => i.personId === personId),
    gaps: board.gaps.filter((g) => g.personId === personId),
  };
}

/** The workflow link that opens a deliverable with the persona preselected. */
export function workflowHref(base: string, personId: string | null): string {
  return personId ? `${base}#act-as=${encodeURIComponent(personId)}` : base;
}

/** Parses `#role=risk-lead&person=p-1` (also accepts a lone `#risk-lead`). */
export function parseRolesHash(hash: string): { role: CoreRole | null; person: string | null } {
  const body = hash.replace(/^#/, '');
  const params = new Map(body.split('&').filter(Boolean).map((kv) => kv.split('=') as [string, string | undefined]));
  const role = params.get('role') ?? (CORE_ROLES.includes(body as CoreRole) ? body : null);
  return {
    role: role && (CORE_ROLES as readonly string[]).includes(role) ? (role as CoreRole) : null,
    person: params.get('person') ? decodeURIComponent(params.get('person')!) : null,
  };
}
