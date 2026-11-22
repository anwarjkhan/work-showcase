/**
 * Determinism (docs/SLIDES_PLAN.md section 10): the same state and clock give
 * deeply equal specifications, and the TD-1001 deliverable pack is pinned by a
 * JSON snapshot so week-to-week changes are visible in review.
 */
import { describe, expect, it } from 'vitest';
import { PACK_IDS } from '../catalogue';
import type { PackId, SlideScope } from '../types';
import { buildPackDeck } from './packs';
import { syntheticContext } from './test-helpers';

const SCOPES: Record<PackId, SlideScope> = {
  outcome: { kind: 'outcome', outcomeId: 'oc-1001-2' },
  deliverable: { kind: 'deliverable', deliverableId: 'td-1001' },
  project: { kind: 'pm-node', pmNodeId: 'pm-ccr-exposure' },
  programme: { kind: 'pm-node', pmNodeId: 'pm-ccr' },
  portfolio: { kind: 'portfolio' },
};

describe('determinism', () => {
  it('two independent runs give deeply equal decks for every pack', () => {
    const a = syntheticContext(true);
    const b = syntheticContext(true);
    for (const id of PACK_IDS) {
      const options = { includeOutcomeSummaries: true, appendVerdicts: 'all' as const };
      expect(buildPackDeck(id, SCOPES[id], options, a)).toEqual(buildPackDeck(id, SCOPES[id], options, b));
    }
  });

  it('the TD-1001 deliverable pack matches its JSON snapshot', async () => {
    const deck = buildPackDeck('deliverable', SCOPES.deliverable, {}, syntheticContext());
    await expect(`${JSON.stringify(deck, null, 2)}\n`).toMatchFileSnapshot('__snapshots__/td-1001-deliverable-pack.json');
  });
});
