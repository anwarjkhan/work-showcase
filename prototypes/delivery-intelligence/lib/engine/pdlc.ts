/**
 * PDLC workflow transition checks, as pure functions returning a result with a
 * reason the UI can show. Rules (design section 5):
 *   forward  only to the next stage, and only when every review the current stage
 *            requires is approved (the Core Four confirmations, then the Product
 *            Manager's gate decision)
 *   back     only to the previous stage, always allowed, but a reason is required
 *   other    moves to a non-neighbouring stage (or the same stage) are refused
 * Store actions (D5) perform the move; these functions only decide.
 */
import { neighbourStage, PDLC_STAGE_IDS, reviewConfirmation, stageDefinition } from '@/lib/config/pdlc';
import { terms } from '@/lib/config/terminology';
import type { EvidenceKind, PdlcRun, PdlcStageId, ReadinessAssessment, ReviewRoleId, ReviewState } from '@/lib/types';
import { evidenceKindLabel, listPhrases, lowerFirst } from './messages';

export type TransitionCode =
  | 'ok'
  | 'review-not-approved'
  | 'reason-required'
  | 'no-next-stage'
  | 'no-previous-stage'
  | 'not-neighbour'
  | 'same-stage';

export interface TransitionCheck {
  allowed: boolean;
  direction: 'forward' | 'back' | null;
  from: PdlcStageId;
  /** Target stage, or null when there is none in that direction. */
  to: PdlcStageId | null;
  code: TransitionCode;
  /** Sentence for the UI: why it is allowed or refused. */
  reason: string;
  /** Reviews still to approve before moving forward. */
  outstandingReviews: { roleId: ReviewRoleId; state: ReviewState; reviewerId: string | null }[];
}

const stageName = (id: PdlcStageId) => stageDefinition(id).name;

/** Reviews of `stageId` that are not yet approved (config roles missing from the run count as not requested). */
export function outstandingReviews(run: PdlcRun, stageId: PdlcStageId): TransitionCheck['outstandingReviews'] {
  const stage = run.stages[stageId];
  return stageDefinition(stageId).reviews
    .map((roleId) => {
      const r = stage?.reviews.find((x) => x.roleId === roleId);
      return { roleId, state: r?.state ?? ('not-requested' as ReviewState), reviewerId: r?.reviewerId ?? null };
    })
    .filter((r) => r.state !== 'approved');
}

export function canMoveForward(run: PdlcRun): TransitionCheck {
  const from = run.currentStage;
  const to = neighbourStage(from, 'forward');
  if (!to) {
    return { allowed: false, direction: 'forward', from, to: null, code: 'no-next-stage', reason: `${stageName(from)} is the last stage.`, outstandingReviews: [] };
  }
  const outstanding = outstandingReviews(run, from);
  if (outstanding.length > 0) {
    const parts = outstanding.map((r) => `the ${terms.coreRoles[r.roleId]} to ${reviewConfirmation(from, r.roleId).confirms} (${lowerFirst(reviewStateLabel(r.state))})`);
    return {
      allowed: false,
      direction: 'forward',
      from,
      to,
      code: 'review-not-approved',
      reason: `Moving to ${stageName(to)} needs ${listPhrases(parts)}.`,
      outstandingReviews: outstanding,
    };
  }
  return { allowed: true, direction: 'forward', from, to, code: 'ok', reason: `All ${stageName(from)} reviews are approved.`, outstandingReviews: [] };
}

export function canMoveBack(run: PdlcRun, reason: string | null | undefined): TransitionCheck {
  const from = run.currentStage;
  const to = neighbourStage(from, 'back');
  if (!to) {
    return { allowed: false, direction: 'back', from, to: null, code: 'no-previous-stage', reason: `${stageName(from)} is the first stage.`, outstandingReviews: [] };
  }
  if (!reason || reason.trim().length === 0) {
    return { allowed: false, direction: 'back', from, to, code: 'reason-required', reason: `Moving back to ${stageName(to)} needs a reason to be recorded.`, outstandingReviews: [] };
  }
  return { allowed: true, direction: 'back', from, to, code: 'ok', reason: `Moving back to ${stageName(to)}: ${reason.trim()}`, outstandingReviews: [] };
}

/** Checks a move to any stage: neighbours are delegated to the rules above, anything else is refused. */
export function checkStageMove(run: PdlcRun, to: PdlcStageId, reason?: string | null): TransitionCheck {
  const from = run.currentStage;
  if (to === from) {
    return { allowed: false, direction: null, from, to, code: 'same-stage', reason: `The deliverable is already in ${stageName(from)}.`, outstandingReviews: [] };
  }
  if (neighbourStage(from, 'forward') === to) return canMoveForward(run);
  if (neighbourStage(from, 'back') === to) return canMoveBack(run, reason);
  const forward = PDLC_STAGE_IDS.indexOf(to) > PDLC_STAGE_IDS.indexOf(from);
  return {
    allowed: false,
    direction: forward ? 'forward' : 'back',
    from,
    to,
    code: 'not-neighbour',
    reason: `Moves are allowed only between neighbouring stages; ${stageName(to)} is not next to ${stageName(from)}.`,
    outstandingReviews: [],
  };
}

/**
 * Whether to offer a move back because required evidence is failing (for example a
 * failed test). Offered when a failing kind is left by the current stage or an earlier one.
 */
export function moveBackSuggestion(run: PdlcRun, readiness: ReadinessAssessment): { offer: boolean; to: PdlcStageId | null; reason: string } {
  const to = neighbourStage(run.currentStage, 'back');
  const currentIndex = PDLC_STAGE_IDS.indexOf(run.currentStage);
  const relevant: EvidenceKind[] = readiness.failing.filter((kind) => {
    const producer = PDLC_STAGE_IDS.findIndex((id) => stageDefinition(id).evidenceLeft.includes(kind));
    return producer !== -1 && producer <= currentIndex;
  });
  if (!to || relevant.length === 0) return { offer: false, to, reason: '' };
  return {
    offer: true,
    to,
    reason: `Required evidence is failing (${listPhrases(relevant.map((k) => evidenceKindLabel(k)))}); move back to ${stageName(to)} to address it.`,
  };
}

function reviewStateLabel(state: ReviewState): string {
  switch (state) {
    case 'approved':
      return 'Approved';
    case 'pending':
      return 'Pending';
    case 'returned':
      return 'Returned';
    case 'not-requested':
      return 'Not requested';
  }
}
