# lib/agents: scripted agents and governance (D5)

For the Agent centre (`/agents`) and PDLC workflow (`/lifecycle/[id]`) screens. Everything here is deterministic. It computes over the store's data and engine result, and makes no model or network call. Label all output `Scripted agent` and simulated evidence `Simulated evidence`.

```ts
import { AGENT_CATALOGUE, AGENT_IDS, agentsForStage, playbackAt, resolveRef, describeWorkflow, runScopeOf, runFindings, GOVERNANCE_RULES, ceilingFor } from '@/lib/agents';
import { useDemoActions, useActingAs, useAgentRun, useProposals, useLatestDraft, useAuditTrail } from '@/lib/store';
```

## 1. List agents

- `AGENT_CATALOGUE[id]` has `name`, `purpose`, `stages` (empty means cross-cutting), `mode` (`read-only` | `propose-change` | `draft`), `output`, `scopes` and `icon` (a `lucide-react` component name). Order: `AGENT_IDS`.
- `agentsForStage(stageId)` and `crossCuttingAgents()` give the per-stage and cross-cutting lists.
- Labels: `terms.agentModes[mode]`, `terms.autonomy[ceilingFor(tier)]`. To get the autonomy ceiling per tier, use `RISK_TIER_POLICIES` (`lib/config/risk-tiers.ts`). `GOVERNANCE_RULES` holds the five rules as sentences.
- Scopes: `{ kind: 'deliverable', deliverableId }`, `{ kind: 'pdlc-stage', deliverableId, stageId }`, `{ kind: 'portfolio' }` and also `{ kind: 'programme', pmNodeId }`. The shared `AgentScope` type has no programme variant, so a programme run's stored `run.scope` reads `{ kind: 'portfolio' }`. Always read a run's scope with `runScopeOf(run)`.

## 2. Start a run and play its steps

```ts
const actions = useDemoActions();
const me = useActingAs();
const r = actions.startAgentRun('raid-quality', { kind: 'portfolio' }, me);
if (!r.ok) return showReason(r.reason);
const run = useAgentRun(r.value.runId);      // completed at once; results are computed up front
```

- Each step has `kind` (`read`, `compute`, `check`, `propose`, `draft`, `note`, `blocked`), `label`, `detail`, `refs` and a suggested `durationMs`.
- To play the steps, your screen owns the timer. Call `playbackAt(run, elapsedMs, speed?)` each frame. It returns `steps[i].playState` (`pending`, `running` or `done`), `activeIndex`, `progress` and `done`. Under reduced motion, call `playbackAt(run, Infinity)`. `playbackDuration(run)` gives the total time.
- `run.summary` is the one-line result. `runFindings(run)` lists the findings the agent raised; they are stored on the run, since `DemoState` has no other place for them.
- Citations and step refs are `EntityRef`s. `resolveRef(state, ref)` returns `{ record, label }` or `null`, and the store state works as its argument.

## 3. Proposals and drafts

- `useProposals()` filtered by `runId`. Each proposal has `title`, `rationale`, `beforeText`, `afterText`, `evidence` (refs), `riskTier`, `ceiling`, `assigneeId` and `status`:
  - `pending`: show Approve and Reject.
  - `auto-applied`: a T1 change on the allowed list in `risk-tiers.ts` (Outcome ID and mitigation date), already applied.
  - `advisory`: T4. Show it as advice with **no** approve control; approving is refused anyway.
  - `approved`, `rejected`: `decision` holds the `Approval`.
  - `superseded`: a rerun of the same agent replaced it.
- Drafts: `useLatestDraft(deliverableId | null, kind?)` or `s.drafts.find(d => d.id === run.draftId)`. Kinds are `weekly-status`, `executive-brief`, `requirements` (title starts "Scripted draft"), `readiness-checklist` and `reconciliation-report`. A draft has sections of sentences, each with one or more `citations` that resolve.

```ts
actions.approveProposal(id, me, 'optional note');   // applies the patch; the engine re-runs; audited
actions.rejectProposal(id, me, 'optional note');    // changes no data; audited
```

## 4. Drive the PDLC workflow

`describeWorkflow(data, results, deliverableId)` returns, per stage, the definition, state, `current`, `agentId`, reviews (with `next` on the one to decide), and the evidence it leaves with the latest record of each kind. It also returns `forward` (from the engine's `canMoveForward`: `allowed` plus a `reason` to show on a disabled button), `back`, and `backSuggestion` (`offer`, `to`, `reason`), which appears when required evidence is failing.

| Action | Notes |
|---|---|
| `runStageAgent(id, stageId?, by?)` | Current stage only. Runs that stage's agent, marks its work product `drafted`, and sets the reviews to `pending` |
| `approveReview(id, stageId, roleId, reviewerId)` | Current stage only, by the person in `deliverable.reviewers[roleId]`, with reviews taken in order. Refused while the stage's evidence is failing. Once every review is approved, the stage is `approved` and its drafted work products become `complete` |
| `returnReview(id, stageId, roleId, reviewerId, reason)` | Records the reason and moves the deliverable back one stage (if there is one) |
| `recordEvidence({ deliverableId, kind, result, title, recordedById, simulated, outcomeId?, workItemKey? })` | With `simulated: true`, the provenance is `simulated` (use this for "Simulate evidence arriving"). A passing `business-acceptance` needs the outcome's acceptance owner and every mandatory criterion accepted first. If the deliverable has only one outcome, it is filled in automatically |
| `acceptCriterion(criterionId, personId)` / `rejectCriterion(..., reason)` | Only by the outcome's `acceptanceOwnerId` |
| `simulateWorkClosed(id, actorId, { share? })` | A **simulated** demo step. Closes open story-level items (and their sub-tasks) in key order: all of them, or the first `share` (0 to 1, rounded up), so two clicks of `0.5` then all show progress. Allowed from Build, Test & Validate onwards, by a named person. Audited as `evidence.simulated` with `details.simulation = 'work-closed'`. Closing work changes `updated` and `resolved`, so evidence already held for that work goes **stale** under the engine's rule (correct, and worth showing): close work **before** recording test evidence. `describeWorkflow(...).stages[3].simulatedSteps[0]` gives `{ enabled, reason, openItems }` for the button. Badge it `Simulated evidence` |
| `moveStage(id, 'forward' \| 'back', by, reason?)` | Uses the engine's transition checks. Back needs a reason and resets the target stage's reviews to `pending`, so they must be approved again. `TechDeliverable.pdlcStage` follows the run |

Failing evidence does not move the deliverable on its own. The screen offers the move back (`backSuggestion`), and the presenter confirms it with `moveStage(..., 'back', ..., reason)`.

## 5. Refusals

Every action returns `{ ok: false, reason }` with a sentence you can show as it is. Governance refusals are also written to the audit trail as `governance.blocked`. Typical refusals:

- An agent identity as actor: "Agents cannot approve a change; only a named person can."
- A non-person: "Only a named person can …"
- An assignee approving their own item: "<name> is the assignee of <key> and cannot approve a change to their own item."
- A T4 proposal: "T4 Critical / Regulated items are advisory only; there is nothing to approve."
- The wrong reviewer: "The design reviewer review of TD-… is assigned to <name>; <other> cannot approve it."
- Moving forward with reviews open: the engine's "Moving to … needs the … review (pending) approved first."
- Moving back with no reason: "Moving back to … needs a reason to be recorded."
- Failing evidence: "The independent validator review cannot be approved while the test result (SIM-…) is failing."
- Business acceptance too early: "Accept the 2 open mandatory criteria of OC-2001-1 before recording business acceptance."

No action sets readiness, because the engine computes it. No patch can touch reported RAG.

## 6. Worked example: `WORKFLOW_DELIVERABLE_ID` (TD-2001, T1) from the first stage to ready

The presenter (`p-presenter`) holds every review role and the acceptance owner role for TD-2001. The measures are given as work / accepted / readiness, and `lib/agents/workflow.test.ts` checks them.

```ts
const TD = WORKFLOW_DELIVERABLE_ID, me = PRESENTER_PERSON_ID;
// Start: 0/8 points, 0/1 outcomes, unknown. Moving forward is refused: the requirements owner review is outstanding.
// simulateWorkClosed is refused here: "Work can be closed only from Build, Test & Validate onwards; ..." 
const { runId } = actions.runStageAgent(TD).value;             // Requirements structuring: draft + 1 pending proposal (4 stories)
actions.approveProposal(proposalOf(runId).id, me);             // stories added: 0/18, 0/1, unknown
actions.approveReview(TD, 'ideation-requirements', 'requirements-owner', me);
actions.recordEvidence({ deliverableId: TD, kind: 'requirements-sign-off', result: 'pass', title: 'Requirements signed off', recordedById: me, simulated: false });
actions.moveStage(TD, 'forward', me);                          // Design & Specifications
actions.runStageAgent(TD);                                     // Outcome mapping: LIM-13 to OC-2001-1, auto-applied (T1)
actions.approveReview(TD, 'design-specifications', 'design-reviewer', me);
actions.moveStage(TD, 'forward', me);                          // Risk, Control & Compliance
actions.runStageAgent(TD);                                     // Control evidence check (read-only report)
actions.approveReview(TD, 'risk-control-compliance', 'control-owner', me);
actions.moveStage(TD, 'forward', me);                          // Build, Test & Validate
actions.runStageAgent(TD);                                     // Release readiness checklist
actions.simulateWorkClosed(TD, me, { share: 0.5 });            // simulated: 4 items closed, 11/18 points (61%), 0/1, unknown
actions.simulateWorkClosed(TD, me);                            // simulated: the rest, 18/18 (100%), 0/1, unknown
actions.recordEvidence({ deliverableId: TD, kind: 'test-result', result: 'fail', title: 'Filter regression suite', recordedById: me, simulated: true });
//   18/18, 0/1, not-ready. The validator approval is refused. describeWorkflow(...).backSuggestion.offer === true
actions.moveStage(TD, 'back', me, 'Regression suite failed; control mapping must cover the saved default.');
actions.approveReview(TD, 'risk-control-compliance', 'control-owner', me);   // needed again after the move back
actions.moveStage(TD, 'forward', me);
actions.recordEvidence({ deliverableId: TD, kind: 'test-result', result: 'pass', title: 'Filter regression suite (rerun)', recordedById: me, simulated: true });
//   readiness: unknown (business acceptance and release checklist still missing)
actions.approveReview(TD, 'build-test-validate', 'independent-validator', me);
actions.moveStage(TD, 'forward', me);                          // Delivery & Launch
actions.acceptCriterion('ac-oc-2001-1-1', me);
actions.acceptCriterion('ac-oc-2001-1-2', me);                 // still 0/1: no business-acceptance record yet
actions.recordEvidence({ deliverableId: TD, kind: 'business-acceptance', result: 'pass', title: 'Desk heads accept the filters', outcomeId: 'oc-2001-1', recordedById: me, simulated: false });
//   1/1 outcomes accepted; readiness still unknown (release checklist missing)
actions.approveReview(TD, 'delivery-launch', 'business-owner', me);
actions.recordEvidence({ deliverableId: TD, kind: 'release-checklist', result: 'pass', title: 'Release checklist complete', recordedById: me, simulated: false });
actions.approveReview(TD, 'delivery-launch', 'release-owner', me);
// Ready: 18/18 points (100%), 1/1 outcomes accepted (100%), ready.
```

Stages 1 to 3 stay at 0/18 work, 0/1 outcomes and readiness unknown. Each measure moves only when its own evidence does. Closed work never accepts an outcome, and accepted outcomes never make the deliverable ready.

## Files

`catalogue.ts` (metadata only), `definitions/*` (the nine agents), `kit.ts` and `facts.ts` (shared wording and facts), `registry.ts` (`runAgent`, scope checks), `governance.ts` (rules G1 to G5), `patches.ts` (the only code that writes proposal changes), `playback.ts`, `provider.ts` (`scriptedProvider`, where an approved model plugs in), `refs.ts`, `workflow.ts`. The store actions are in `lib/store/actions.ts`.
