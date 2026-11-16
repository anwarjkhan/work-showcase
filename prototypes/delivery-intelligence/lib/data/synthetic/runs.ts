/**
 * PDLC runs for every deliverable, seeded with `createPdlcRun` and then
 * given a believable history: stage entry and exit times, forward moves, and
 * the evidence each stage left behind. The workflow story is left at the very
 * start, exactly as `createPdlcRun` makes it.
 */
import { createPdlcRun, PDLC_STAGES, PDLC_STAGE_IDS } from '@/lib/config/pdlc';
import { WORKFLOW_DELIVERABLE_ID } from '@/lib/config/story';
import type { Evidence, PdlcMove, PdlcRun } from '@/lib/types';
import { addDays, dateAtFraction, minDate, stamp, TODAY } from './dates';
import type { Hierarchy } from './hierarchy';

export function buildPdlcRuns(hierarchy: Hierarchy, evidence: Evidence[]): PdlcRun[] {
  return hierarchy.deliverables.map((d) => {
    const spec = hierarchy.specs.get(d.id);
    const startDate = minDate(d.plannedStart, addDays(TODAY, -7));
    const startedAt = stamp(startDate, 9, 0);
    const run = createPdlcRun(d, d.pdlcStage, startedAt);
    if (d.id === WORKFLOW_DELIVERABLE_ID || !spec) return run;

    const current = PDLC_STAGE_IDS.indexOf(d.pdlcStage);
    const boundary = (i: number): string => stamp(dateAtFraction(startDate, addDays(TODAY, -1), (i + 1) / (current + 1)), 15, 0);
    const moves: PdlcMove[] = [];

    PDLC_STAGES.forEach((def, i) => {
      const state = run.stages[def.id];
      if (i < current) {
        const exit = boundary(i);
        state.enteredAt = i === 0 ? startedAt : boundary(i - 1);
        state.exitedAt = exit;
        for (const review of state.reviews) for (const decision of review.decisions) decision.decidedAt = exit;
        const lastRole = def.reviews[def.reviews.length - 1];
        const reviewer = lastRole ? d.reviewers[lastRole] : undefined;
        moves.push({
          id: `mv-${d.id}-${i + 1}`,
          from: def.id,
          to: PDLC_STAGE_IDS[i + 1] as PdlcRun['currentStage'],
          direction: 'forward',
          at: exit,
          by: reviewer ? { kind: 'human', personId: reviewer } : { kind: 'system' },
          reason: null,
        });
      } else if (i === current) {
        state.enteredAt = i === 0 ? startedAt : boundary(i - 1);
        const n = state.workProducts.length;
        const complete = Math.min(n, Math.floor(spec.progress * n + (spec.progress >= 1 ? 0 : 0.2)));
        state.workProducts.forEach((wp, j) => {
          wp.state = j < complete ? 'complete' : j === complete ? 'drafted' : 'missing';
        });
        if (d.id === 'td-1014') {
          state.status = 'in-review';
          for (const review of state.reviews) review.state = 'pending';
        }
      }
      state.evidenceIds = evidence.filter((e) => e.deliverableId === d.id && e.stageId === def.id).map((e) => e.id);
    });

    // One deliverable was returned from build to the control review and has since re-entered build.
    if (d.id === 'td-1012') {
      const forward = moves[moves.length - 1];
      if (forward) {
        const base = forward.at.slice(0, 10);
        moves.push(
          { id: 'mv-td-1012-back', from: 'build-test-validate', to: 'risk-control-compliance', direction: 'back', at: stamp(addDays(base, 12), 11, 0), by: { kind: 'human', personId: d.reviewers['independent-validator'] ?? d.ownerId }, reason: 'Segregation-of-duties evidence for the mapping approvals was incomplete.' },
          { id: 'mv-td-1012-fwd', from: 'risk-control-compliance', to: 'build-test-validate', direction: 'forward', at: stamp(addDays(base, 19), 14, 0), by: { kind: 'human', personId: d.reviewers['control-owner'] ?? d.ownerId }, reason: null },
        );
      }
    }

    run.moves = moves;
    const last = moves[moves.length - 1];
    run.updatedAt = last ? last.at : startedAt;
    return run;
  });
}
