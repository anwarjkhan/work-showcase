/**
 * STUB — implemented by deliverable D5 (Agents and governance), which owns this file.
 *
 * The `DemoActions` interface is the contract screens code against today; D5
 * fills in `createDemoActions`. Rules D5 must enforce (design section 5):
 * every action appends an audit event; agents never approve, accept or set
 * readiness; approvers are named humans who are not the item's assignee;
 * the T1..T4 autonomy ceiling applies; reported RAG is never changed.
 *
 * Until D5 lands every action returns `{ ok: false, reason }` and changes
 * nothing (except `setActingAs`, which is trivial and already works).
 * Use `useDemoActions()` from '@/lib/store' in components.
 */
import type {
  ActionResult,
  AgentId,
  AgentScope,
  EvidenceKind,
  EvidenceResult,
  PdlcStageId,
  ReviewRoleId,
  SourceSystemId,
} from '@/lib/types';
import type { DemoStoreApi } from './store';

export interface RecordEvidenceInput {
  deliverableId: string;
  kind: EvidenceKind;
  result: EvidenceResult;
  title: string;
  outcomeId?: string | null;
  workItemKey?: string | null;
  stageId?: PdlcStageId | null;
  source?: SourceSystemId;
  sourceRef?: string;
  /** Named human recording it. */
  recordedById: string;
  /** True for the "Simulate evidence arriving" control: provenance becomes `simulated`. */
  simulated: boolean;
}

export interface DemoActions {
  // --- Agent centre ---------------------------------------------------------
  /** Runs an agent now (deterministic) and stores its run, findings, proposals and draft. */
  startAgentRun(agentId: AgentId, scope: AgentScope, startedById?: string): ActionResult<{ runId: string }>;
  /** Applies the proposal's patch, re-runs the engine, records the approval and audit event. */
  approveProposal(proposalId: string, approverId: string, note?: string): ActionResult<{ approvalId: string }>;
  /** Changes no data; records the rejection and an audit event. */
  rejectProposal(proposalId: string, approverId: string, note?: string): ActionResult<{ approvalId: string }>;

  // --- PDLC workflow ----------------------------------------------------------
  /** Runs the agent that assists the deliverable's stage (defaults to its current stage). */
  runStageAgent(deliverableId: string, stageId?: PdlcStageId, startedById?: string): ActionResult<{ runId: string }>;
  /** Approves one review of a stage as the named reviewer. */
  approveReview(deliverableId: string, stageId: PdlcStageId, roleId: ReviewRoleId, reviewerId: string): ActionResult;
  /** Returns a review with a reason; moves the deliverable back where the rules say so. */
  returnReview(deliverableId: string, stageId: PdlcStageId, roleId: ReviewRoleId, reviewerId: string, reason: string): ActionResult;
  /** Records (or simulates) an evidence record. */
  recordEvidence(input: RecordEvidenceInput): ActionResult<{ evidenceId: string }>;
  /** Accepts an acceptance criterion as a named human (never an agent). */
  acceptCriterion(criterionId: string, personId: string): ActionResult;
  /** Rejects an acceptance criterion with a reason. */
  rejectCriterion(criterionId: string, personId: string, reason: string): ActionResult;
  /** Moves to the neighbouring stage. Forward needs the stage's reviews approved; back needs a reason. */
  moveStage(deliverableId: string, direction: 'forward' | 'back', byPersonId: string, reason?: string): ActionResult<{ to: PdlcStageId }>;

  // --- Presenter --------------------------------------------------------------
  /** Changes which sample human the presenter acts as. */
  setActingAs(personId: string): void;
}

const notYet = (name: string): ActionResult<never> => ({ ok: false, reason: `${name} is not available yet (store actions are built in D5).` });

export function createDemoActions(store: DemoStoreApi): DemoActions {
  return {
    startAgentRun: () => notYet('Running an agent'),
    approveProposal: () => notYet('Approving a proposal'),
    rejectProposal: () => notYet('Rejecting a proposal'),
    runStageAgent: () => notYet('Running the stage agent'),
    approveReview: () => notYet('Approving a review'),
    returnReview: () => notYet('Returning a review'),
    recordEvidence: () => notYet('Recording evidence'),
    acceptCriterion: () => notYet('Accepting a criterion'),
    rejectCriterion: () => notYet('Rejecting a criterion'),
    moveStage: () => notYet('Moving stage'),
    setActingAs: (personId) => store.setState((s) => (s.actingAsPersonId === personId ? s : { ...s, actingAsPersonId: personId })),
  };
}
