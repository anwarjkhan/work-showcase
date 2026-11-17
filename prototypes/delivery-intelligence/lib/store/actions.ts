/**
 * Store actions (D5). Screens call them through `useDemoActions()` from
 * '@/lib/store'. Every action:
 *   - writes only through `DemoStoreApi` (setState / updateData re-run the engine);
 *   - returns `{ ok: true, value }` or `{ ok: false, reason }` with a sentence for
 *     the UI; governance refusals are results, never exceptions;
 *   - appends an audit event for what it did (governance refusals are audited
 *     too, as `governance.blocked`).
 * Rules (design section 5, enforced in lib/agents/governance.ts): agents never
 * approve, accept or set readiness; approvers are named people who are not the
 * item's assignee; the T1..T4 autonomy ceiling applies; reported RAG never changes.
 * There is deliberately no action that sets readiness: the engine computes it.
 *
 * See lib/agents/README.md for a worked example of the PDLC workflow.
 */
import {
  applyPatch,
  checkApproval,
  checkRejection,
  checkScope,
  getAgent,
  initialStatus,
  requirePerson,
  runAgent,
  stageAgentId,
  type AgentRunScope,
  type Check,
  type ScriptedAgentRun,
} from '@/lib/agents';
import { activeProvider } from '@/lib/agents/provider';
import { AGENT_WORK_PRODUCT, checkSimulateWorkClosed, EVIDENCE_WORK_PRODUCT, latestEvidence, producingStage, setWorkProduct, updateStage } from '@/lib/agents/workflow';
import { neighbourStage, stageDefinition } from '@/lib/config/pdlc';
import { terms } from '@/lib/config/terminology';
import { canMoveBack, canMoveForward } from '@/lib/engine';
import type {
  AcceptanceCriterion,
  ActionResult,
  Actor,
  AgentId,
  AgentScope,
  Approval,
  ChangePatch,
  EntityRef,
  Evidence,
  EvidenceKind,
  EvidenceResult,
  IsoDateTime,
  PdlcRun,
  PdlcStageId,
  PdlcStageState,
  PortfolioData,
  ProposedChange,
  ReviewRoleId,
  SourceSystemId,
  StatusDraft,
} from '@/lib/types';
import { indexPortfolio } from './indexes';
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
  /**
   * Runs an agent now (deterministic) and stores its run, findings, proposals and draft.
   * `scope` may also be `{ kind: 'programme', pmNodeId }` (see lib/agents/types.ts).
   * Proposals get their status from the autonomy ceiling: `pending`, `auto-applied` (T1
   * allowed changes, applied at once) or `advisory` (T4, nothing to approve).
   */
  startAgentRun(agentId: AgentId, scope: AgentScope | AgentRunScope, startedById?: string): ActionResult<{ runId: string }>;
  /** Applies the proposal's patch, re-runs the engine, records the approval and audit event. */
  approveProposal(proposalId: string, approverId: string, note?: string): ActionResult<{ approvalId: string }>;
  /** Changes no data; records the rejection and an audit event. */
  rejectProposal(proposalId: string, approverId: string, note?: string): ActionResult<{ approvalId: string }>;

  // --- PDLC workflow ----------------------------------------------------------
  /** Runs the agent that assists the deliverable's stage (defaults to, and must be, its current stage). */
  runStageAgent(deliverableId: string, stageId?: PdlcStageId, startedById?: string): ActionResult<{ runId: string }>;
  /** Approves one review of the current stage as the named reviewer, in order. Refused while the stage's evidence is failing. */
  approveReview(deliverableId: string, stageId: PdlcStageId, roleId: ReviewRoleId, reviewerId: string): ActionResult;
  /** Returns a review with a reason and moves the deliverable back one stage (when there is one). */
  returnReview(deliverableId: string, stageId: PdlcStageId, roleId: ReviewRoleId, reviewerId: string, reason: string): ActionResult;
  /** Records (or simulates) an evidence record. */
  recordEvidence(input: RecordEvidenceInput): ActionResult<{ evidenceId: string }>;
  /** Accepts an acceptance criterion as its outcome's named acceptance owner (never an agent). */
  acceptCriterion(criterionId: string, personId: string): ActionResult;
  /** Rejects an acceptance criterion with a reason, as the acceptance owner. */
  rejectCriterion(criterionId: string, personId: string, reason: string): ActionResult;
  /**
   * Simulated demo step: closes the deliverable's open story-level items (and their
   * sub-tasks), all of them or a `share` (0..1, rounded up, in key order). Allowed from
   * Build, Test & Validate onwards, by a named person. Closing work changes `updated`
   * and `resolved`, so evidence already held for that work can go stale (by design).
   */
  simulateWorkClosed(deliverableId: string, actorId: string, options?: { share?: number }): ActionResult<{ closedKeys: string[] }>;
  /** Moves to the neighbouring stage. Forward needs the stage's reviews approved; back needs a reason. */
  moveStage(deliverableId: string, direction: 'forward' | 'back', byPersonId: string, reason?: string): ActionResult<{ to: PdlcStageId }>;

  // --- Presenter --------------------------------------------------------------
  /** Changes which sample human the presenter acts as. */
  setActingAs(personId: string): void;
}

const ok = <T>(value: T): ActionResult<T> => ({ ok: true, value });
const done: ActionResult = { ok: true, value: undefined };
const fail = (reason: string): ActionResult<never> => ({ ok: false, reason });

function patchKey(p: ChangePatch): string {
  switch (p.op) {
    case 'set-field':
      return `${p.entity}:${p.id}:${p.field}`;
    case 'merge-raid':
      return `merge:${p.duplicateId}`;
    case 'add-dependency':
      return `dep:${p.dependency.id}`;
    case 'add-work-items':
      return `items:${p.epicKey}`;
  }
}

export function createDemoActions(store: DemoStoreApi): DemoActions {
  const data = () => store.getState().data;

  const actorFor = (id: string | null | undefined): Actor => {
    if (!id) return { kind: 'system' };
    const idx = indexPortfolio(data());
    const identity = idx.agentIdentities.get(id);
    if (identity) return { kind: 'agent', agentId: identity.agentId, identityId: identity.id };
    const byAgentId = data().agentIdentities.find((a) => a.agentId === id);
    if (byAgentId) return { kind: 'agent', agentId: byAgentId.agentId, identityId: null };
    return idx.people.has(id) ? { kind: 'human', personId: id } : { kind: 'system' };
  };

  /** Audits a governance refusal and returns it. */
  const blocked = (check: Extract<Check, { ok: false }>, actorId: string | null | undefined, subject: EntityRef): ActionResult<never> => {
    store.appendAudit({ actor: actorFor(actorId), action: 'governance.blocked', subject, summary: check.reason, refs: [subject], details: { code: check.code } });
    return fail(check.reason);
  };

  const runOf = (deliverableId: string): PdlcRun | undefined => data().pdlcRuns.find((r) => r.deliverableId === deliverableId);

  const withRun = (d: PortfolioData, run: PdlcRun): PortfolioData => ({
    ...d,
    pdlcRuns: d.pdlcRuns.map((r) => (r.deliverableId === run.deliverableId ? run : r)),
    // Keep the deliverable's recorded stage in step with the run.
    deliverables: d.deliverables.map((x) => (x.id === run.deliverableId && x.pdlcStage !== run.currentStage ? { ...x, pdlcStage: run.currentStage } : x)),
  });

  const personName = (id: string | null | undefined) => {
    if (!id) return 'nobody';
    const idx = indexPortfolio(data());
    return idx.people.get(id)?.name ?? idx.agentIdentities.get(id)?.handle ?? data().agentIdentities.find((a) => a.agentId === id)?.handle ?? 'an unknown person';
  };
  const deliverableRef = (id: string) => indexPortfolio(data()).deliverables.get(id)?.ref ?? 'the deliverable';

  // ---------------------------------------------------------------------------
  // Agent runs
  // ---------------------------------------------------------------------------

  function startRun(
    agentId: AgentId,
    scope: AgentRunScope,
    startedById: string | undefined,
    alsoChange?: (d: PortfolioData, run: ScriptedAgentRun, draft: StatusDraft | null) => PortfolioData,
  ): ActionResult<{ runId: string }> {
    const state = store.getState();
    const by = startedById ?? state.actingAsPersonId;
    const agent = getAgent(agentId);
    if (!agent) return fail('That agent does not exist.');
    const who = requirePerson(state.data, by, 'start an agent run');
    if (!who.ok) return blocked(who, by, { kind: 'agent-run', id: agentId });
    const scopeProblem = checkScope(agent, scope, state.data);
    if (scopeProblem) return fail(scopeProblem);

    const runId = store.nextId('run');
    const startedAt = store.now();
    const storedScope: AgentScope = scope.kind === 'programme' ? { kind: 'portfolio' } : scope;
    const runRef: EntityRef = { kind: 'agent-run', id: runId };
    const agentActor: Actor = { kind: 'agent', agentId, identityId: null };
    store.appendAudit({ at: startedAt, actor: { kind: 'human', personId: by }, action: 'agent-run.started', subject: runRef, summary: `${personName(by)} started ${agent.name}.`, refs: [runRef], details: { agentId, scope: scope.kind } });

    const result = runAgent(agentId, scope, { data: state.data, results: state.results, clock: state.clock });
    const completedAt = store.now();
    const base = { id: runId, agentId, scope: storedScope, runScope: scope, startedById: by, startedAt, completedAt, providerId: activeProvider().id, provenance: 'scripted-agent' as const };
    if (!result.ok) {
      const failed: ScriptedAgentRun = { ...base, status: 'failed', steps: [], findingIds: [], proposalIds: [], draftId: null, summary: result.reason, findings: [] };
      store.setState((s) => ({ ...s, agentRuns: [...s.agentRuns, failed] }));
      store.appendAudit({ at: completedAt, actor: agentActor, action: 'agent-run.failed', subject: runRef, summary: result.reason, refs: [runRef], details: { agentId } });
      return fail(result.reason);
    }

    const out = result.output;
    const steps = out.steps.map((s, i) => ({ ...s, id: `${runId}-s${i + 1}`, runId, index: i, status: 'done' as const }));
    const findings = out.findings.map((f, i) => ({ ...f, id: `${runId}-f${i + 1}`, detectedAt: completedAt, agentRunId: runId }));
    let nextData = state.data;
    const proposals: ProposedChange[] = out.proposals.map((spec, i) => {
      let status = initialStatus(spec);
      if (status === 'auto-applied') {
        const applied = applyPatch(nextData, spec.patch, completedAt);
        if (applied.ok) nextData = applied.data;
        else status = 'pending';
      }
      return { ...spec, id: `${runId}-p${i + 1}`, runId, status, createdAt: completedAt, decision: null };
    });
    const draft: StatusDraft | null = out.draft ? { ...out.draft, id: `${runId}-draft`, runId, generatedAt: completedAt } : null;
    const run: ScriptedAgentRun = {
      ...base,
      status: 'completed',
      steps,
      findingIds: findings.map((f) => f.id),
      proposalIds: proposals.map((p) => p.id),
      draftId: draft?.id ?? null,
      summary: out.summary,
      findings,
    };
    if (alsoChange) nextData = alsoChange(nextData, run, draft);
    const fresh = new Set(proposals.map((p) => `${p.agentId}|${patchKey(p.patch)}`));
    store.setState((s) => ({
      ...s,
      data: nextData,
      agentRuns: [...s.agentRuns, run],
      // A rerun supersedes the same agent's still-pending proposal for the same change.
      proposals: [...s.proposals.map((p) => (p.status === 'pending' && fresh.has(`${p.agentId}|${patchKey(p.patch)}`) ? { ...p, status: 'superseded' as const } : p)), ...proposals],
      drafts: draft ? [...s.drafts, draft] : s.drafts,
    }));

    for (const p of proposals) {
      const pRef: EntityRef = { kind: 'proposal', id: p.id };
      store.appendAudit({ at: completedAt, actor: agentActor, action: 'proposal.created', subject: pRef, summary: `${agent.name} proposed: ${p.title} (${p.status === 'advisory' ? 'advisory only' : p.status === 'auto-applied' ? 'auto-applied' : 'awaiting approval'}).`, refs: [pRef, p.target, runRef], details: { status: p.status, riskTier: p.riskTier, ceiling: p.ceiling } });
      if (p.status === 'auto-applied') {
        store.appendAudit({ at: completedAt, actor: agentActor, action: 'proposal.auto-applied', subject: pRef, summary: `Auto-applied under the ${p.riskTier} ceiling: ${p.title}.`, refs: [pRef, p.target], details: { before: p.beforeText, after: p.afterText } });
      }
    }
    if (findings.length > 0) {
      store.appendAudit({ at: completedAt, actor: agentActor, action: 'finding.raised', subject: runRef, summary: `${agent.name} raised ${findings.length} finding${findings.length === 1 ? '' : 's'}.`, refs: [runRef], details: { count: findings.length } });
    }
    if (draft) {
      const dRef: EntityRef = { kind: 'status-draft', id: draft.id };
      store.appendAudit({ at: completedAt, actor: agentActor, action: 'draft.created', subject: dRef, summary: `${agent.name} drafted ${draft.title}.`, refs: [dRef, runRef], details: { kind: draft.kind } });
    }
    store.appendAudit({ at: completedAt, actor: agentActor, action: 'agent-run.completed', subject: runRef, summary: out.summary, refs: [runRef], details: { steps: steps.length, proposals: proposals.length, findings: findings.length, draft: draft !== null } });
    return ok({ runId });
  }

  // ---------------------------------------------------------------------------
  // PDLC helpers
  // ---------------------------------------------------------------------------

  /** Moves a run to a neighbouring stage (checks already done). */
  function performMove(d: PortfolioData, run: PdlcRun, to: PdlcStageId, direction: 'forward' | 'back', by: Actor, reason: string | null, at: IsoDateTime): PortfolioData {
    const from = run.currentStage;
    let next: PdlcRun = updateStage(run, from, (s) => ({ ...s, status: direction === 'back' ? 'returned' : s.status, exitedAt: at }));
    next = updateStage(next, to, (s) => ({
      ...s,
      status: 'in-progress',
      enteredAt: at,
      exitedAt: null,
      // Coming back means the stage is reworked, so its reviews are needed again.
      reviews: direction === 'back' ? s.reviews.map((r) => (r.state === 'approved' || r.state === 'returned' ? { ...r, state: 'pending' as const } : r)) : s.reviews,
    }));
    next = { ...next, currentStage: to, updatedAt: at, moves: [...next.moves, { id: store.nextId('move'), from, to, direction, at, by, reason }] };
    return withRun(d, next);
  }

  function reviewChecks(deliverableId: string, stageId: PdlcStageId, roleId: ReviewRoleId, reviewerId: string, verb: 'approve' | 'return'): ActionResult<{ run: PdlcRun }> {
    const d = indexPortfolio(data()).deliverables.get(deliverableId);
    const run = runOf(deliverableId);
    if (!d || !run) return fail('That deliverable has no PDLC workflow.');
    const subject: EntityRef = { kind: 'pdlc-run', id: run.id };
    const who = requirePerson(data(), reviewerId, `${verb} a PDLC review`);
    if (!who.ok) return blocked(who, reviewerId, subject);
    const stage = stageDefinition(stageId);
    if (run.currentStage !== stageId) return fail(`${d.ref} is in ${stageDefinition(run.currentStage).name}; only that stage's reviews can be decided now.`);
    if (!stage.reviews.includes(roleId)) return fail(`${stage.name} has no ${terms.reviewRoles[roleId].toLowerCase()} review.`);
    const review = run.stages[stageId].reviews.find((r) => r.roleId === roleId);
    const named = d.reviewers[roleId] ?? review?.reviewerId ?? null;
    if (named && named !== reviewerId) {
      return blocked(
        { ok: false, code: 'not-named-reviewer', reason: `The ${terms.reviewRoles[roleId].toLowerCase()} review of ${d.ref} is assigned to ${personName(named)}; ${personName(reviewerId)} cannot ${verb} it.` },
        reviewerId,
        subject,
      );
    }
    const order = stage.reviews.indexOf(roleId);
    const earlier = stage.reviews.slice(0, order).filter((r) => run.stages[stageId].reviews.find((x) => x.roleId === r)?.state !== 'approved');
    if (earlier.length > 0) return fail(`The ${earlier.map((r) => terms.reviewRoles[r].toLowerCase()).join(' and ')} review must be approved first.`);
    return ok({ run });
  }

  function setReview(run: PdlcRun, stageId: PdlcStageId, roleId: ReviewRoleId, reviewerId: string, decision: 'approved' | 'returned', reason: string | null, at: IsoDateTime): PdlcRun {
    return updateStage(run, stageId, (s) => {
      const reviews = s.reviews.some((r) => r.roleId === roleId) ? s.reviews : [...s.reviews, { roleId, state: 'not-requested' as const, reviewerId, decisions: [] }];
      const nextReviews = reviews.map((r) =>
        r.roleId === roleId
          ? { ...r, state: decision, reviewerId, decisions: [...r.decisions, { id: store.nextId('decision'), stageId, roleId, decision, reviewerId, decidedAt: at, reason }] }
          : r,
      );
      const allApproved = stageDefinition(stageId).reviews.every((role) => nextReviews.find((r) => r.roleId === role)?.state === 'approved');
      let next: typeof s = { ...s, reviews: nextReviews, status: decision === 'returned' ? 'returned' : allApproved ? 'approved' : 'in-review' };
      if (allApproved) next = { ...next, workProducts: next.workProducts.map((wp) => (wp.state === 'drafted' ? { ...wp, state: 'complete' as const } : wp)) };
      return next;
    });
  }

  // ---------------------------------------------------------------------------
  // The actions
  // ---------------------------------------------------------------------------

  return {
    startAgentRun: (agentId, scope, startedById) => startRun(agentId, scope as AgentRunScope, startedById),

    approveProposal(proposalId, approverId, note) {
      const s = store.getState();
      const p = s.proposals.find((x) => x.id === proposalId);
      if (!p) return fail('That proposal no longer exists.');
      const subject: EntityRef = { kind: 'proposal', id: p.id };
      const check = checkApproval(s.data, p, approverId);
      if (!check.ok) return blocked(check, approverId, subject);
      const at = store.now();
      const applied = applyPatch(s.data, p.patch, at);
      if (!applied.ok) return fail(applied.reason);
      let nextData = applied.data;
      if (p.patch.op === 'add-work-items' && p.deliverableId) {
        const run = nextData.pdlcRuns.find((r) => r.deliverableId === p.deliverableId);
        if (run) nextData = withRun(nextData, updateStage(run, 'ideation-requirements', (st) => setWorkProduct(st, 'stories', 'complete', subject)));
      }
      const approval: Approval = { id: store.nextId('approval'), proposalId, decision: 'approved', approverId, decidedAt: at, note: note ?? null };
      store.setState((st) => ({
        ...st,
        data: nextData,
        proposals: st.proposals.map((x) => (x.id === p.id ? { ...x, status: 'approved' as const, decision: approval } : x)),
        approvals: [...st.approvals, approval],
      }));
      store.appendAudit({
        at,
        actor: { kind: 'human', personId: approverId },
        action: 'proposal.approved',
        subject,
        summary: `${personName(approverId)} approved: ${p.title}.`,
        refs: [subject, p.target, { kind: 'approval', id: approval.id }],
        details: { before: p.beforeText, after: p.afterText, note: note ?? null },
      });
      return ok({ approvalId: approval.id });
    },

    rejectProposal(proposalId, approverId, note) {
      const s = store.getState();
      const p = s.proposals.find((x) => x.id === proposalId);
      if (!p) return fail('That proposal no longer exists.');
      const subject: EntityRef = { kind: 'proposal', id: p.id };
      const check = checkRejection(s.data, p, approverId);
      if (!check.ok) return blocked(check, approverId, subject);
      const at = store.now();
      const approval: Approval = { id: store.nextId('approval'), proposalId, decision: 'rejected', approverId, decidedAt: at, note: note ?? null };
      store.setState((st) => ({
        ...st,
        proposals: st.proposals.map((x) => (x.id === p.id ? { ...x, status: 'rejected' as const, decision: approval } : x)),
        approvals: [...st.approvals, approval],
      }));
      store.appendAudit({ at, actor: { kind: 'human', personId: approverId }, action: 'proposal.rejected', subject, summary: `${personName(approverId)} rejected: ${p.title}.`, refs: [subject, p.target, { kind: 'approval', id: approval.id }], details: { note: note ?? null } });
      return ok({ approvalId: approval.id });
    },

    runStageAgent(deliverableId, stageId, startedById) {
      const run = runOf(deliverableId);
      const d = indexPortfolio(data()).deliverables.get(deliverableId);
      if (!run || !d) return fail('That deliverable has no PDLC workflow.');
      const stage = stageId ?? run.currentStage;
      if (stage !== run.currentStage) return fail(`${d.ref} is in ${stageDefinition(run.currentStage).name}; run that stage's agent instead.`);
      const agentId = stageAgentId(stage);
      if (!agentId) return fail(`${stageDefinition(stage).name} has no assisting agent.`);
      const result = startRun(agentId, { kind: 'pdlc-stage', deliverableId, stageId: stage }, startedById, (current, agentRun, draft) => {
        const live = current.pdlcRuns.find((r) => r.deliverableId === deliverableId);
        if (!live) return current;
        const wp = AGENT_WORK_PRODUCT[stage]?.[agentId];
        const at = agentRun.completedAt ?? agentRun.startedAt;
        const next = updateStage(live, stage, (st) => {
          let s2: PdlcStageState = { ...st, agentRunIds: [...st.agentRunIds, agentRun.id], status: st.status === 'approved' ? st.status : 'in-review' };
          s2 = { ...s2, reviews: s2.reviews.map((r) => (r.state === 'not-requested' || r.state === 'returned' ? { ...r, state: 'pending' as const } : r)) };
          if (wp) s2 = setWorkProduct(s2, wp, 'drafted', draft ? { kind: 'status-draft', id: draft.id } : { kind: 'agent-run', id: agentRun.id });
          return s2;
        });
        return withRun(current, { ...next, updatedAt: at });
      });
      if (!result.ok) return result;
      const by = startedById ?? store.getState().actingAsPersonId;
      store.appendAudit({
        actor: { kind: 'human', personId: by },
        action: 'pdlc.stage-agent-run',
        subject: { kind: 'pdlc-run', id: run.id },
        summary: `${getAgent(agentId)?.name ?? 'The stage agent'} ran for ${d.ref} in ${stageDefinition(stage).name}; reviews requested.`,
        refs: [{ kind: 'pdlc-run', id: run.id }, { kind: 'agent-run', id: result.value.runId }],
        details: { stageId: stage, agentId },
      });
      return result;
    },

    approveReview(deliverableId, stageId, roleId, reviewerId) {
      const checked = reviewChecks(deliverableId, stageId, roleId, reviewerId, 'approve');
      if (!checked.ok) return checked;
      const { run } = checked.value;
      const review = run.stages[stageId].reviews.find((r) => r.roleId === roleId);
      if (review?.state === 'approved') return fail(`The ${terms.reviewRoles[roleId].toLowerCase()} review is already approved.`);
      const failing = stageDefinition(stageId)
        .evidenceLeft.map((k) => latestEvidence(data(), deliverableId, k))
        .find((e): e is Evidence => e !== null && e.result === 'fail');
      if (failing) {
        return fail(`The ${terms.reviewRoles[roleId].toLowerCase()} review cannot be approved while the ${terms.evidenceKinds[failing.kind].toLowerCase()} (${failing.sourceRef}) is failing.`);
      }
      const at = store.now();
      const next = setReview(run, stageId, roleId, reviewerId, 'approved', null, at);
      store.updateData((d) => withRun(d, { ...next, updatedAt: at }));
      const stageDone = next.stages[stageId].status === 'approved';
      store.appendAudit({
        at,
        actor: { kind: 'human', personId: reviewerId },
        action: 'pdlc.review-approved',
        subject: { kind: 'pdlc-run', id: run.id },
        summary: `${personName(reviewerId)} approved the ${terms.reviewRoles[roleId].toLowerCase()} review of ${stageDefinition(stageId).name}${stageDone ? '; the stage can move forward' : ''}.`,
        refs: [{ kind: 'pdlc-run', id: run.id }, { kind: 'deliverable', id: deliverableId }],
        details: { stageId, roleId },
      });
      return done;
    },

    returnReview(deliverableId, stageId, roleId, reviewerId, reason) {
      if (!reason || reason.trim().length === 0) return fail('Returning a review needs a reason.');
      const checked = reviewChecks(deliverableId, stageId, roleId, reviewerId, 'return');
      if (!checked.ok) return checked;
      const { run } = checked.value;
      const at = store.now();
      let next = setReview(run, stageId, roleId, reviewerId, 'returned', reason.trim(), at);
      next = { ...next, updatedAt: at };
      const to = neighbourStage(stageId, 'back');
      const why = `Returned by the ${terms.reviewRoles[roleId].toLowerCase()} review: ${reason.trim()}`;
      store.updateData((d) => {
        const withReview = withRun(d, next);
        return to ? performMove(withReview, next, to, 'back', { kind: 'human', personId: reviewerId }, why, at) : withReview;
      });
      store.appendAudit({ at, actor: { kind: 'human', personId: reviewerId }, action: 'pdlc.review-returned', subject: { kind: 'pdlc-run', id: run.id }, summary: `${personName(reviewerId)} returned the ${terms.reviewRoles[roleId].toLowerCase()} review: ${reason.trim()}`, refs: [{ kind: 'pdlc-run', id: run.id }], details: { stageId, roleId, reason: reason.trim() } });
      if (to) {
        store.appendAudit({ at, actor: { kind: 'human', personId: reviewerId }, action: 'pdlc.moved-back', subject: { kind: 'pdlc-run', id: run.id }, summary: `Moved back to ${stageDefinition(to).name}. ${why}`, refs: [{ kind: 'pdlc-run', id: run.id }, { kind: 'deliverable', id: deliverableId }], details: { from: stageId, to, reason: why } });
      }
      return done;
    },

    recordEvidence(input) {
      const idx = indexPortfolio(data());
      const d = idx.deliverables.get(input.deliverableId);
      if (!d) return fail('That deliverable does not exist.');
      const subject: EntityRef = { kind: 'deliverable', id: d.id };
      const who = requirePerson(data(), input.recordedById, 'record evidence');
      if (!who.ok) return blocked(who, input.recordedById, subject);
      if (!input.title || input.title.trim().length === 0) return fail('Evidence needs a title.');
      const outcomes = idx.outcomesByDeliverable.get(d.id) ?? [];
      let outcomeId = input.outcomeId ?? null;
      if (outcomeId && !outcomes.some((o) => o.id === outcomeId)) return fail(`${idx.outcomes.get(outcomeId)?.ref ?? 'That outcome'} is not an outcome of ${d.ref}.`);
      if (!outcomeId && input.kind === 'business-acceptance' && outcomes.length === 1) outcomeId = outcomes[0]!.id;
      if (input.workItemKey && !idx.workItems.has(input.workItemKey)) return fail(`${input.workItemKey} does not exist.`);

      // Business acceptance follows the engine's acceptance definition: the owner records it, after the criteria.
      if (input.kind === 'business-acceptance' && input.result === 'pass' && outcomeId) {
        const outcome = idx.outcomes.get(outcomeId)!;
        if (outcome.acceptanceOwnerId !== input.recordedById) {
          return blocked({ ok: false, code: 'not-acceptance-owner', reason: `Business acceptance for ${outcome.ref} must be recorded by its acceptance owner, ${personName(outcome.acceptanceOwnerId)}.` }, input.recordedById, { kind: 'outcome', id: outcome.id });
        }
        const open = (idx.criteriaByOutcome.get(outcome.id) ?? []).filter((c) => c.mandatory && c.state !== 'accepted');
        if (open.length > 0) return fail(`Accept the ${open.length} open mandatory criteri${open.length === 1 ? 'on' : 'a'} of ${outcome.ref} before recording business acceptance.`);
      }

      const run = runOf(d.id);
      const stageId = input.stageId ?? (run && stageDefinition(run.currentStage).evidenceLeft.includes(input.kind) ? run.currentStage : producingStage(input.kind));
      const at = store.now();
      const id = store.nextId('ev');
      const evidence: Evidence = {
        id,
        kind: input.kind,
        title: input.title.trim(),
        deliverableId: d.id,
        outcomeId,
        workItemKey: input.workItemKey ?? null,
        stageId,
        result: input.result,
        source: input.source ?? (input.kind === 'test-result' ? 'test-harness' : 'in-app'),
        sourceRef: input.sourceRef ?? `${input.simulated ? 'SIM' : 'REC'}-${id.replace(/\D/g, '')}`,
        observedAt: at,
        recordedById: input.recordedById,
        provenance: input.simulated ? 'simulated' : 'sample',
      };
      store.updateData((current) => {
        let next: PortfolioData = { ...current, evidence: [...current.evidence, evidence] };
        const live = next.pdlcRuns.find((r) => r.deliverableId === d.id);
        if (live && stageId) {
          const wp = EVIDENCE_WORK_PRODUCT[input.kind];
          const updated = updateStage(live, stageId, (st) => {
            const s2 = { ...st, evidenceIds: [...st.evidenceIds, id] };
            return wp && input.result === 'pass' ? setWorkProduct(s2, wp, 'complete', { kind: 'evidence', id }) : s2;
          });
          next = withRun(next, { ...updated, updatedAt: at });
        }
        return next;
      });
      store.appendAudit({
        at,
        actor: { kind: 'human', personId: input.recordedById },
        action: input.simulated ? 'evidence.simulated' : 'evidence.recorded',
        subject: { kind: 'evidence', id },
        summary: `${input.simulated ? 'Simulated' : 'Recorded'} ${terms.evidenceKinds[input.kind].toLowerCase()} for ${d.ref}: ${terms.evidenceResults[input.result].toLowerCase()}.`,
        refs: [{ kind: 'evidence', id }, subject],
        details: { kind: input.kind, result: input.result, simulated: input.simulated },
      });
      return ok({ evidenceId: id });
    },

    acceptCriterion(criterionId, personId) {
      return decideCriterion(criterionId, personId, 'accepted', null);
    },

    rejectCriterion(criterionId, personId, reason) {
      if (!reason || reason.trim().length === 0) return fail('Rejecting a criterion needs a reason.');
      return decideCriterion(criterionId, personId, 'rejected', reason.trim());
    },

    simulateWorkClosed(deliverableId, actorId, options) {
      const d = indexPortfolio(data()).deliverables.get(deliverableId);
      if (!d) return fail('That deliverable does not exist.');
      const subject: EntityRef = { kind: 'deliverable', id: d.id };
      const who = requirePerson(data(), actorId, 'close work');
      if (!who.ok) return blocked(who, actorId, subject);
      const check = checkSimulateWorkClosed(data(), deliverableId);
      if (!check.enabled) return fail(check.reason);
      const share = options?.share ?? 1;
      if (!(share > 0 && share <= 1)) return fail('The share of work to close must be more than 0 and at most 1.');
      const chosen = new Set(check.openItems.slice(0, Math.max(1, Math.ceil(check.openItems.length * share))));
      // Sub-tasks under the chosen items close with them.
      for (const w of data().workItems) if (w.parentKey && chosen.has(w.parentKey) && w.statusCategory !== 'done') chosen.add(w.key);
      const at = store.now();
      const closedKeys = [...chosen];
      store.updateData((current) => {
        let next: PortfolioData = {
          ...current,
          workItems: current.workItems.map((w) => (chosen.has(w.key) ? { ...w, status: 'Done', statusCategory: 'done' as const, resolved: at, updated: at } : w)),
        };
        const remaining = checkSimulateWorkClosed(next, deliverableId).openItems.length;
        const live = next.pdlcRuns.find((r) => r.deliverableId === deliverableId);
        if (live && remaining === 0) next = withRun(next, updateStage(live, 'build-test-validate', (st) => setWorkProduct(st, 'build', 'complete', subject)));
        return next;
      });
      const remaining = checkSimulateWorkClosed(data(), deliverableId).openItems.length;
      store.appendAudit({
        at,
        actor: { kind: 'human', personId: actorId },
        // The shared AuditAction union has no work action; simulated steps are logged as evidence.simulated.
        action: 'evidence.simulated',
        subject,
        summary: `Simulated: ${personName(actorId)} closed ${closedKeys.length} work item${closedKeys.length === 1 ? '' : 's'} of ${d.ref}; ${remaining} story-level item${remaining === 1 ? '' : 's'} still open.`,
        refs: [subject, ...closedKeys.slice(0, 20).map((k) => ({ kind: 'work-item' as const, id: k }))],
        details: { simulated: true, simulation: 'work-closed', closed: closedKeys.length, remaining, share },
      });
      return ok({ closedKeys });
    },

    moveStage(deliverableId, direction, byPersonId, reason) {
      const run = runOf(deliverableId);
      if (!run) return fail('That deliverable has no PDLC workflow.');
      const subject: EntityRef = { kind: 'pdlc-run', id: run.id };
      const who = requirePerson(data(), byPersonId, 'move a deliverable between stages');
      if (!who.ok) return blocked(who, byPersonId, subject);
      const check = direction === 'forward' ? canMoveForward(run) : canMoveBack(run, reason);
      if (!check.allowed || !check.to) return fail(check.reason);
      const to = check.to;
      const at = store.now();
      const why = direction === 'back' ? (reason ?? '').trim() : null;
      store.updateData((d) => performMove(d, run, to, direction, { kind: 'human', personId: byPersonId }, why, at));
      store.appendAudit({
        at,
        actor: { kind: 'human', personId: byPersonId },
        action: direction === 'forward' ? 'pdlc.moved-forward' : 'pdlc.moved-back',
        subject,
        summary: `${personName(byPersonId)} moved ${deliverableRef(deliverableId)} ${direction === 'forward' ? 'forward' : 'back'} to ${stageDefinition(to).name}${why ? `: ${why}` : ''}.`,
        refs: [subject, { kind: 'deliverable', id: deliverableId }],
        details: { from: run.currentStage, to, reason: why },
      });
      return ok({ to });
    },

    setActingAs: (personId) => store.setState((s) => (s.actingAsPersonId === personId ? s : { ...s, actingAsPersonId: personId })),
  };

  function decideCriterion(criterionId: string, personId: string, state: 'accepted' | 'rejected', reason: string | null): ActionResult {
    const idx = indexPortfolio(data());
    const c = idx.criteria.get(criterionId);
    if (!c) return fail('That acceptance criterion does not exist.');
    const subject: EntityRef = { kind: 'criterion', id: c.id };
    const verb = state === 'accepted' ? 'accept' : 'reject';
    const who = requirePerson(data(), personId, `${verb} an acceptance criterion`);
    if (!who.ok) return blocked(who, personId, subject);
    const outcome = idx.outcomes.get(c.outcomeId);
    if (!outcome) return fail('The criterion belongs to an outcome that does not exist.');
    if (outcome.acceptanceOwnerId !== personId) {
      return blocked({ ok: false, code: 'not-acceptance-owner', reason: `Only ${outcome.ref}'s acceptance owner, ${personName(outcome.acceptanceOwnerId)}, can ${verb} its criteria.` }, personId, subject);
    }
    if (c.state === state) return fail(`The criterion is already ${state}.`);
    const at = store.now();
    const next: AcceptanceCriterion =
      state === 'accepted'
        ? { ...c, state, acceptedById: personId, acceptedAt: at, rejectedById: null, rejectionReason: null }
        : { ...c, state, acceptedById: null, acceptedAt: null, rejectedById: personId, rejectionReason: reason };
    store.updateData((d) => ({ ...d, criteria: d.criteria.map((x) => (x.id === c.id ? next : x)) }));
    store.appendAudit({
      at,
      actor: { kind: 'human', personId },
      action: state === 'accepted' ? 'criterion.accepted' : 'criterion.rejected',
      subject,
      summary: `${personName(personId)} ${state} a criterion of ${outcome.ref}${reason ? `: ${reason}` : ''}.`,
      refs: [subject, { kind: 'outcome', id: outcome.id }],
      details: { outcomeId: outcome.id, reason },
    });
    return done;
  }
}
