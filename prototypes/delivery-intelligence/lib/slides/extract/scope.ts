/**
 * Scope helpers: stable keys, human names, the hierarchy path shown as a
 * slide subtitle, and the ref used in file names. Names use refs and titles,
 * never internal ids.
 */
import { terms } from '@/lib/config/terminology';
import type { EntityRef, PmNode } from '@/lib/types';
import type { SlideScope } from '../types';
import type { SlideEnv } from './common';

/** Stable key, e.g. "deliverable:td-1001" (the same form as the builder's `#scope=` hash). */
export function scopeKey(scope: SlideScope): string {
  switch (scope.kind) {
    case 'portfolio':
      return 'portfolio';
    case 'pm-node':
      return `pm-node:${scope.pmNodeId}`;
    case 'deliverable':
      return `deliverable:${scope.deliverableId}`;
    case 'outcome':
      return `outcome:${scope.outcomeId}`;
  }
}

/** Parses a scope key back into a scope (null when malformed). */
export function parseScopeKey(key: string): SlideScope | null {
  if (key === 'portfolio') return { kind: 'portfolio' };
  const at = key.indexOf(':');
  if (at < 0) return null;
  const kind = key.slice(0, at);
  const id = key.slice(at + 1);
  if (!id) return null;
  if (kind === 'pm-node') return { kind, pmNodeId: id };
  if (kind === 'deliverable') return { kind, deliverableId: id };
  if (kind === 'outcome') return { kind, outcomeId: id };
  return null;
}

/** Throws a readable error when the scope's record does not exist. */
export function assertScope(env: SlideEnv, scope: SlideScope): void {
  const missing = (what: string) => new Error(`No ${what} matches this slide scope.`);
  if (scope.kind === 'pm-node' && !env.idx.pmNodes.has(scope.pmNodeId)) throw missing('programme, project or initiative');
  if (scope.kind === 'deliverable' && !env.idx.deliverables.has(scope.deliverableId)) throw missing('deliverable');
  if (scope.kind === 'outcome' && !env.idx.outcomes.has(scope.outcomeId)) throw missing('outcome');
}

/** Ancestors of a PM node, top first, the node itself last. */
export function nodeChain(env: SlideEnv, nodeId: string | null): PmNode[] {
  const chain: PmNode[] = [];
  const seen = new Set<string>();
  let id = nodeId;
  while (id && !seen.has(id)) {
    seen.add(id);
    const n = env.idx.pmNodes.get(id);
    if (!n) break;
    chain.unshift(n);
    id = n.parentId;
  }
  return chain;
}

/** The ref used in file names and short labels: "TD-1001", "PG-CCR", "OC-1001-2" or "Portfolio". */
export function scopeRef(env: SlideEnv, scope: SlideScope): string {
  switch (scope.kind) {
    case 'portfolio':
      return 'Portfolio';
    case 'pm-node':
      return env.idx.pmNodes.get(scope.pmNodeId)?.ref ?? terms.hierarchy.programme;
    case 'deliverable':
      return env.idx.deliverables.get(scope.deliverableId)?.ref ?? terms.hierarchy.deliverableShort;
    case 'outcome':
      return env.idx.outcomes.get(scope.outcomeId)?.ref ?? terms.hierarchy.outcome;
  }
}

/** Human name: "TD-1001 Counterparty exposure …", "PG-CCR Counterparty Credit Risk Modernisation", "Portfolio". */
export function scopeName(env: SlideEnv, scope: SlideScope): string {
  switch (scope.kind) {
    case 'portfolio':
      return 'Portfolio';
    case 'pm-node': {
      const n = env.idx.pmNodes.get(scope.pmNodeId);
      return n ? `${n.ref} ${n.title}` : scopeRef(env, scope);
    }
    case 'deliverable': {
      const d = env.idx.deliverables.get(scope.deliverableId);
      return d ? `${d.ref} ${d.title}` : scopeRef(env, scope);
    }
    case 'outcome': {
      const o = env.idx.outcomes.get(scope.outcomeId);
      return o ? `${o.ref} ${o.title}` : scopeRef(env, scope);
    }
  }
}

/** Path above and including the scope: "IR-2027-001 › Counterparty Credit Risk Modernisation › TD-1001". */
export function scopePath(env: SlideEnv, scope: SlideScope): string {
  const parts: string[] = [];
  const addDeliverable = (deliverableId: string) => {
    const d = env.idx.deliverables.get(deliverableId);
    if (!d) return;
    const ir = env.idx.investmentRequests.get(d.investmentRequestId);
    if (ir) parts.push(ir.ref);
    if (d.pmNodeId) for (const n of nodeChain(env, d.pmNodeId)) parts.push(n.title);
    else parts.push(terms.routes.standalone);
    parts.push(d.ref);
  };
  switch (scope.kind) {
    case 'portfolio':
      return 'The whole portfolio';
    case 'pm-node': {
      const chain = nodeChain(env, scope.pmNodeId);
      const ir = chain[0] ? env.idx.investmentRequests.get(chain[0].investmentRequestId) : undefined;
      if (ir) parts.push(ir.ref);
      for (const n of chain) parts.push(n.title);
      break;
    }
    case 'deliverable':
      addDeliverable(scope.deliverableId);
      break;
    case 'outcome': {
      const o = env.idx.outcomes.get(scope.outcomeId);
      if (o) {
        addDeliverable(o.deliverableId);
        parts.push(o.ref);
      }
      break;
    }
  }
  return parts.join(' › ');
}

/** The record a scope is about, for citations (none for the portfolio). */
export function scopeRecord(scope: SlideScope): EntityRef | null {
  switch (scope.kind) {
    case 'portfolio':
      return null;
    case 'pm-node':
      return { kind: 'pm-node', id: scope.pmNodeId };
    case 'deliverable':
      return { kind: 'deliverable', id: scope.deliverableId };
    case 'outcome':
      return { kind: 'outcome', id: scope.outcomeId };
  }
}
