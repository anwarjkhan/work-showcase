/**
 * Applies an approved (or auto-applied) proposal's patch to the portfolio data.
 * Pure: returns new data, never mutates. Only the fields in `EditableFields`
 * (lib/types.ts) can change; anything else, and in particular the reported RAG
 * held in the portfolio system, is refused.
 */
import { terms } from '@/lib/config/terminology';
import type { ChangePatch, EditableEntityKind, IsoDateTime, PortfolioData } from '@/lib/types';

export type PatchResult = { ok: true; data: PortfolioData } | { ok: false; reason: string };

/** Runtime whitelist mirroring `EditableFields`. */
export const EDITABLE_FIELDS: Record<EditableEntityKind, readonly string[]> = {
  'work-item': ['outcomeId', 'reviewerId', 'due', 'deliverableId', 'assigneeType', 'assigneeId'],
  raid: ['ownerId', 'mitigationDue', 'status', 'severity'],
  dependency: ['committed', 'status', 'critical', 'raidKey'],
  milestone: ['outcomeIds', 'workItemKeys'],
};

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1 } as const;

export function isEditable(entity: string, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(EDITABLE_FIELDS, entity) && EDITABLE_FIELDS[entity as EditableEntityKind].includes(field);
}

/**
 * Applies `patch` at time `at` (used for timestamps of changed RAID items and
 * new work items). Field edits on work items do not touch `updated`, so a
 * mapping change never makes evidence stale.
 */
export function applyPatch(data: PortfolioData, patch: ChangePatch, at: IsoDateTime): PatchResult {
  const result = applyUnchecked(data, patch, at);
  if (!result.ok) return result;
  // Defence in depth: the book-of-record RAG can never move.
  const before = new Map([...data.deliverables, ...data.pmNodes].map((x) => [x.id, x.reportedRag]));
  for (const x of [...result.data.deliverables, ...result.data.pmNodes]) {
    if (before.get(x.id) !== x.reportedRag) return { ok: false, reason: `Reported RAG in ${terms.systems['portfolio-system']} cannot be changed by any agent or approval.` };
  }
  return result;
}

function applyUnchecked(data: PortfolioData, patch: ChangePatch, at: IsoDateTime): PatchResult {
  switch (patch.op) {
    case 'set-field': {
      const { entity, id } = patch;
      const field: string = patch.field;
      if (field === 'reportedRag' || !isEditable(entity, field)) {
        return { ok: false, reason: field === 'reportedRag' ? `Reported RAG in ${terms.systems['portfolio-system']} cannot be changed by any agent or approval.` : `${field} on ${entity} is not a field an approved change may set.` };
      }
      const list = listFor(data, entity);
      const index = list.findIndex((x) => (entity === 'work-item' ? (x as { key: string }).key : (x as { id: string }).id) === id);
      if (index < 0) return { ok: false, reason: `${id} no longer exists.` };
      const current = list[index] as unknown as Record<string, unknown>;
      if (!same(current[field], patch.before)) return { ok: false, reason: `${id} has changed since the proposal was made; run the agent again.` };
      const next = list.slice();
      const updated: Record<string, unknown> = { ...current, [field]: patch.after };
      if (entity === 'raid') updated.updated = at;
      next[index] = updated as never;
      return { ok: true, data: withList(data, entity, next) };
    }
    case 'merge-raid': {
      const keep = data.raid.find((r) => r.id === patch.keepId);
      const dup = data.raid.find((r) => r.id === patch.duplicateId);
      if (!keep || !dup) return { ok: false, reason: 'One of the RAID items no longer exists.' };
      if (dup.status === 'closed') return { ok: false, reason: `${dup.key} is already closed.` };
      const severity = SEVERITY_RANK[dup.severity] > SEVERITY_RANK[keep.severity] ? dup.severity : keep.severity;
      const raid = data.raid.map((r) => {
        if (r.id === dup.id) return { ...r, status: 'closed' as const, updated: at, description: `${r.description}${r.description ? ' ' : ''}Closed as a duplicate of ${keep.key}.`.trim() };
        if (r.id === keep.id) return { ...r, severity, updated: at };
        return r;
      });
      return { ok: true, data: { ...data, raid } };
    }
    case 'add-dependency': {
      const dep = patch.dependency;
      if (data.dependencies.some((d) => d.id === dep.id)) return { ok: false, reason: `Dependency ${dep.id} is already recorded.` };
      const ids = new Set(data.deliverables.map((d) => d.id));
      if (!ids.has(dep.fromDeliverableId) || !ids.has(dep.toDeliverableId)) return { ok: false, reason: 'The dependency names a deliverable that does not exist.' };
      return { ok: true, data: { ...data, dependencies: [...data.dependencies, { ...dep, origin: 'agent-proposed' }] } };
    }
    case 'add-work-items': {
      if (!data.workItems.some((w) => w.key === patch.epicKey)) return { ok: false, reason: `Epic ${patch.epicKey} no longer exists.` };
      const keys = new Set(data.workItems.map((w) => w.key));
      const clash = patch.items.find((w) => keys.has(w.key));
      if (clash) return { ok: false, reason: `${clash.key} already exists; run the agent again for fresh keys.` };
      const criterionIds = new Set(data.criteria.map((c) => c.id));
      if (patch.criteria.some((c) => criterionIds.has(c.id))) return { ok: false, reason: 'The drafted criteria already exist; run the agent again.' };
      const items = patch.items.map((w) => ({ ...w, epicKey: patch.epicKey, created: at, updated: at }));
      return { ok: true, data: { ...data, workItems: [...data.workItems, ...items], criteria: [...data.criteria, ...patch.criteria] } };
    }
    default:
      return { ok: false, reason: 'Unknown change.' };
  }
}

type Lists = { 'work-item': PortfolioData['workItems']; raid: PortfolioData['raid']; dependency: PortfolioData['dependencies']; milestone: PortfolioData['milestones'] };

function listFor<K extends EditableEntityKind>(data: PortfolioData, entity: K): Lists[K] {
  const map: Lists = { 'work-item': data.workItems, raid: data.raid, dependency: data.dependencies, milestone: data.milestones };
  return map[entity];
}

function withList(data: PortfolioData, entity: EditableEntityKind, list: unknown[]): PortfolioData {
  switch (entity) {
    case 'work-item':
      return { ...data, workItems: list as PortfolioData['workItems'] };
    case 'raid':
      return { ...data, raid: list as PortfolioData['raid'] };
    case 'dependency':
      return { ...data, dependencies: list as PortfolioData['dependencies'] };
    case 'milestone':
      return { ...data, milestones: list as PortfolioData['milestones'] };
  }
}
