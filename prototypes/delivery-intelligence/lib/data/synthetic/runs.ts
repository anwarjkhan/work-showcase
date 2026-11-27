/**
 * PDLC runs for every deliverable, seeded with `createPdlcRun` and then
 * given a believable history: stage entry and exit times, forward moves, and
 * the evidence each stage left behind. Review decisions are recorded by the
 * holders of the core roles in the stage's order, an hour apart, ending with the
 * Product Manager's gate decision; the Product Manager moves the stage forward.
 * The workflow story is left at the very start, exactly as `createPdlcRun` makes it.
 */
import { createPdlcRun, PDLC_STAGES, PDLC_STAGE_IDS } from '@/lib/config/pdlc';
import { WORKFLOW_DELIVERABLE_ID } from '@/lib/config/story';
import { PENDING_RELEASE } from './catalogue';
import type { Evidence, IsoDateTime, PdlcMove, PdlcRun, PdlcStageState } from '@/lib/types';
import { addDays, dateAtFraction, minDate, stamp, TODAY } from './dates';
import type { Hierarchy } from './hierarchy';

const HOUR_MS = 3_600_000;

/** Approves every review of a stage in order, the last decision at `at` and each earlier one an hour before. */
function decideInOrder(deliverableId: string, state: PdlcStageState, at: IsoDateTime): void {
  const n = state.reviews.length;
  state.reviews.forEach((review, i) => {
    review.state = 'approved';
    const decidedAt = new Date(Date.parse(at) - (n - 1 - i) * HOUR_MS).toISOString();
    review.decisions = review.reviewerId
      ? [{ id: `rd-${deliverableId}-${state.stageId}-${review.roleId}`, stageId: state.stageId, roleId: review.roleId, decision: 'approved', reviewerId: review.reviewerId, decidedAt, reason: null }]
      : [];
  });
}

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
        decideInOrder(d.id, state, exit);
        const pm = d.coreTeam['product-manager']?.personId;
        moves.push({
          id: `mv-${d.id}-${i + 1}`,
          from: def.id,
          to: PDLC_STAGE_IDS[i + 1] as PdlcRun['currentStage'],
          direction: 'forward',
          at: exit,
          by: pm ? { kind: 'human', personId: pm } : { kind: 'system' },
          reason: null,
        });
      } else if (i === current) {
        state.enteredAt = i === 0 ? startedAt : boundary(i - 1);
        const n = state.workProducts.length;
        const complete = Math.min(n, Math.floor(spec.progress * n + (spec.progress >= 1 ? 0 : 0.2)));
        state.workProducts.forEach((wp, j) => {
          wp.state = j < complete ? 'complete' : j === complete ? 'drafted' : 'missing';
        });
        const reviewTime = stamp(addDays(TODAY, -1), 18, 0);
        if (current === 4 && spec.progress >= 1 && !PENDING_RELEASE.has(d.id)) {
          // Completed final-stage work: every review approved by its role holder, in order.
          state.status = 'approved';
          state.workProducts.forEach((wp) => (wp.state = 'complete'));
          decideInOrder(d.id, state, reviewTime);
        } else if (current >= 1 && spec.progress >= 0.3) {
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
          { id: 'mv-td-1012-back', from: 'build-test-validate', to: 'risk-control-compliance', direction: 'back', at: stamp(addDays(base, 12), 11, 0), by: { kind: 'human', personId: d.coreTeam['tech-lead']?.personId ?? d.ownerId }, reason: 'Segregation-of-duties evidence for the mapping approvals was incomplete.' },
          { id: 'mv-td-1012-fwd', from: 'risk-control-compliance', to: 'build-test-validate', direction: 'forward', at: stamp(addDays(base, 19), 14, 0), by: { kind: 'human', personId: d.coreTeam['product-manager']?.personId ?? d.ownerId }, reason: null },
        );
      }
    }

    run.moves = moves;
    const last = moves[moves.length - 1];
    run.updatedAt = last ? last.at : startedAt;
    return run;
  });
}
