/**
 * Wording (docs/SLIDES_PLAN.md sections 9 and 10): no user-visible string in
 * any spec carries an internal id or the word "hero". Every string is walked
 * except `id`, `scope`, `citations[].ref`, `stageId` and the slide `kind`.
 * A dangling Deliverable ID field value and agent handles are data, not ids.
 */
import { describe, expect, it } from 'vitest';
import { CATALOGUE_LIST } from '../catalogue';
import type { SlideScope, SlideSpec } from '../types';
import { buildPackDeck, buildSlides } from './packs';
import { leaksIn, syntheticContext, visibleStrings } from './test-helpers';

const base = syntheticContext();
const leaks = (specs: unknown[]) => leaksIn(specs, base.data);

describe('no internal ids or "hero" in user-visible text', () => {
  it('the walker skips only ids, scopes, citation refs and stage ids', () => {
    const strings = visibleStrings({ id: 'td-1001', scope: { kind: 'deliverable', deliverableId: 'td-1001' }, title: 'x', citations: [{ ref: { kind: 'deliverable', id: 'td-1001' }, label: 'TD-1001' }], stages: [{ stageId: 'build-test-validate', name: 'n' }] });
    expect(strings).toEqual(['x', 'TD-1001', 'n']);
    expect(visibleStrings({ kind: 'td-verdict', title: 'y' })).toEqual(['y']);
    expect(leaks([{ title: 'see td-1001' }])).toEqual(['see td-1001']);
    expect(leaks([{ notes: 'The hero deliverable' }])).toEqual(['The hero deliverable']);
    expect(leaks([{ notes: 'Assigned to agent-raid-02; Deliverable ID “td-1914” does not exist' }])).toEqual([]);
  });

  for (const withDrafts of [false, true]) {
    it(`in every slide kind for every scope${withDrafts ? ', with drafts' : ''}`, () => {
      const ctx = syntheticContext(withDrafts);
      const scopes: SlideScope[] = [
        { kind: 'portfolio' },
        ...ctx.data.pmNodes.map((n) => ({ kind: 'pm-node' as const, pmNodeId: n.id })),
        ...ctx.data.deliverables.map((d) => ({ kind: 'deliverable' as const, deliverableId: d.id })),
        ...ctx.data.outcomes.map((o) => ({ kind: 'outcome' as const, outcomeId: o.id })),
      ];
      const specs: SlideSpec[] = [];
      for (const scope of scopes) specs.push(...buildSlides(scope, CATALOGUE_LIST.filter((e) => e.scopes.includes(scope.kind)).map((e) => e.kind), ctx));
      expect(specs.length).toBeGreaterThan(1000);
      expect(leaks(specs)).toEqual([]);
    });
  }

  it('in deck titles, file names and footers', () => {
    const ctx = syntheticContext(true);
    const decks = [
      buildPackDeck('deliverable', { kind: 'deliverable', deliverableId: 'td-1001' }, { includeOutcomeSummaries: true }, ctx),
      buildPackDeck('programme', { kind: 'pm-node', pmNodeId: 'pm-ccr' }, { appendVerdicts: 'all' }, ctx),
      buildPackDeck('portfolio', { kind: 'portfolio' }, {}, ctx),
    ];
    expect(leaks(decks.map((d) => ({ title: d.title, fileName: d.fileName, footer: d.footer })))).toEqual([]);
    expect(leaks(decks.map((d) => d.slides))).toEqual([]);
  });
});
