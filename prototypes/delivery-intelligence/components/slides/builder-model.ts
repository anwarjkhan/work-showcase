/**
 * Pure helpers for the builder route: URL hash parsing and the entity lists.
 * Hash forms: `#scope=deliverable:td-1001`, `#scope=pm-node:<id>&pack=programme`, `#basket`.
 */
import { PACK_IDS, parseScopeKey, scopeKey } from '@/lib/slides';
import type { PackId, SlideScope } from '@/lib/slides';
import type { PortfolioData } from '@/lib/types';
import type { PickerOption } from './EntityPicker';

export type ScopeType = 'portfolio' | 'programme' | 'project' | 'deliverable' | 'outcome';
export type BuildMode = 'pack' | 'pick' | 'basket';

export const SCOPE_TYPES: { id: ScopeType; label: string; noun: string }[] = [
  { id: 'portfolio', label: 'Portfolio', noun: 'portfolio' },
  { id: 'programme', label: 'Programme', noun: 'programmes and initiatives' },
  { id: 'project', label: 'Project', noun: 'projects' },
  { id: 'deliverable', label: 'Deliverable', noun: 'deliverables' },
  { id: 'outcome', label: 'Outcome', noun: 'outcomes' },
];

export interface HashTarget {
  basket: boolean;
  scope: SlideScope | null;
  pack: PackId | null;
}

export function parseHash(hash: string): HashTarget {
  const text = hash.replace(/^#/, '');
  const target: HashTarget = { basket: false, scope: null, pack: null };
  for (const part of text.split('&')) {
    const eq = part.indexOf('=');
    const key = eq < 0 ? part : part.slice(0, eq);
    let value = eq < 0 ? '' : part.slice(eq + 1);
    try {
      value = decodeURIComponent(value);
    } catch {
      /* keep raw */
    }
    if (key === 'basket') target.basket = true;
    else if (key === 'scope') target.scope = parseScopeKey(value);
    else if (key === 'pack' && (PACK_IDS as readonly string[]).includes(value)) target.pack = value as PackId;
  }
  return target;
}

export function scopeTypeOf(scope: SlideScope, data: PortfolioData): ScopeType {
  if (scope.kind === 'pm-node') {
    const level = data.pmNodes.find((n) => n.id === scope.pmNodeId)?.level;
    return level === 'project' ? 'project' : 'programme';
  }
  return scope.kind;
}

/** Entities of a scope type, with refs and titles, in reference order. */
export function entityOptions(data: PortfolioData, type: ScopeType): PickerOption[] {
  const byRef = (a: PickerOption, b: PickerOption) => (a.ref ?? '').localeCompare(b.ref ?? '', 'en', { numeric: true });
  switch (type) {
    case 'portfolio':
      return [{ key: 'portfolio', label: 'The whole portfolio' }];
    case 'programme':
    case 'project': {
      const wanted = type === 'project' ? ['project'] : ['programme', 'initiative'];
      return data.pmNodes
        .filter((n) => wanted.includes(n.level))
        .map((n) => ({ key: scopeKey({ kind: 'pm-node', pmNodeId: n.id }), ref: n.ref, label: n.title }))
        .sort(byRef);
    }
    case 'deliverable':
      return data.deliverables
        .map((d) => ({ key: scopeKey({ kind: 'deliverable', deliverableId: d.id }), ref: d.ref, label: d.title }))
        .sort(byRef);
    case 'outcome': {
      const refOf = new Map(data.deliverables.map((d) => [d.id, d.ref]));
      return data.outcomes
        .map((o) => ({ key: scopeKey({ kind: 'outcome', outcomeId: o.id }), ref: o.ref, label: o.title, detail: refOf.get(o.deliverableId) }))
        .sort(byRef);
    }
  }
}
