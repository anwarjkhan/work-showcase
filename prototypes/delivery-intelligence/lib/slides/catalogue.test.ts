/**
 * Catalogue and pack definitions (docs/SLIDES_PLAN.md sections 4, 5 and 12, S1).
 */
import { describe, expect, it } from 'vitest';
import { CATALOGUE, CATALOGUE_LIST, PACKS, PACK_IDS, kindsForScopeKind, packAcceptsScope } from './catalogue';
import { BUILDERS } from './compose/slides';
import type { SlideKind } from './types';

const ALL_KINDS: SlideKind[] = [
  'cover', 'contents', 'how-to-read', 'decisions', 'record-index',
  'portfolio-headline', 'portfolio-rag', 'portfolio-disagreements', 'portfolio-programmes', 'portfolio-stages', 'portfolio-findings', 'portfolio-quarter', 'portfolio-hubs', 'portfolio-brief',
  'node-overview', 'node-deliverables', 'node-plan', 'node-risks', 'node-disagreements',
  'td-verdict', 'td-readiness', 'td-outcomes', 'td-findings', 'td-plan', 'td-raid', 'td-pdlc', 'td-pod', 'td-jira-map', 'td-status',
  'outcome-summary', 'outcome-criteria', 'outcome-work', 'outcome-evidence',
];

describe('catalogue', () => {
  it('registers every kind in section 4 once, with a title, a description, scopes and a builder', () => {
    expect(CATALOGUE_LIST.map((e) => e.kind).sort()).toEqual([...ALL_KINDS].sort());
    for (const k of ALL_KINDS) {
      const e = CATALOGUE[k];
      expect(e.title.length).toBeGreaterThan(2);
      expect(e.description.length).toBeGreaterThan(10);
      expect(e.scopes.length).toBeGreaterThan(0);
      expect(typeof BUILDERS[k]).toBe('function');
    }
  });

  it('gives each scope its own kinds plus the common ones', () => {
    expect(kindsForScopeKind('deliverable').filter((k) => k.startsWith('td-')).length).toBe(10);
    expect(kindsForScopeKind('portfolio').filter((k) => k.startsWith('portfolio-')).length).toBe(9);
    expect(kindsForScopeKind('pm-node').filter((k) => k.startsWith('node-')).length).toBe(5);
    expect(kindsForScopeKind('outcome').filter((k) => k.startsWith('outcome-')).length).toBe(4);
    for (const s of ['portfolio', 'pm-node', 'deliverable', 'outcome'] as const) expect(kindsForScopeKind(s).slice(0, 5)).toEqual(['cover', 'contents', 'how-to-read', 'decisions', 'record-index']);
  });

  it('defines the five packs of section 5 with kinds their scopes accept', () => {
    expect(PACK_IDS).toEqual(['outcome', 'deliverable', 'project', 'programme', 'portfolio']);
    for (const id of PACK_IDS) {
      const p = PACKS[id];
      for (const k of p.kinds) expect(p.scopes.some((s) => CATALOGUE[k].scopes.includes(s))).toBe(true);
    }
    expect(PACKS.deliverable.kinds.length).toBe(15);
    expect(PACKS.portfolio.kinds.length).toBe(14);
    expect(PACKS.project.kinds).toEqual(PACKS.programme.kinds);
  });

  it('matches PM node levels to packs', () => {
    const node = { kind: 'pm-node', pmNodeId: 'x' } as const;
    expect(packAcceptsScope('project', node, 'project')).toBe(true);
    expect(packAcceptsScope('project', node, 'programme')).toBe(false);
    expect(packAcceptsScope('programme', node, 'programme')).toBe(true);
    expect(packAcceptsScope('programme', node, 'initiative')).toBe(true);
    expect(packAcceptsScope('programme', node)).toBe(false);
    expect(packAcceptsScope('deliverable', { kind: 'portfolio' })).toBe(false);
  });
});
