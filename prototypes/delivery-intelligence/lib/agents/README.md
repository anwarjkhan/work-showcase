# lib/agents: scripted agents and governance (D5)

For the Agent centre (`/agents`) and PDLC workflow (`/lifecycle/[id]`) screens. Everything here is deterministic. It computes over the store's data and engine result, and makes no model or network call. Label all output `Scripted agent` and simulated evidence `Simulated evidence`.

```ts
import { AGENT_CATALOGUE, AGENT_IDS, agentsForStage, playbackAt, resolveRef, describeWorkflow, runScopeOf, runFindings, GOVERNANCE_RULES, ceilingFor } from '@/lib/agents';
import { useDemoActions, useActingAs, useAgentRun, useProposals, useLatestDraft, useAuditTrail } from '@/lib/store';
```

## 1. List agents

- `AGENT_CATALOGUE[id]` has `name`, `purpose`, `stages` (empty means cross-cutting), `mode` (`read-only` | `propose-change` | `draft`), `output`, `scopes` and `icon` (a `lucide-react` component name). Order: `AGENT_IDS`.
- `agentsForStage(stageId)` and `crossCuttingAgents()` give the per-stage and cross-cutting lists.
- Labels: `terms.agentModes[mode]`, `terms.autonomy[ceilingFor(tier)]`. To get the autonomy ceiling per tier, use `RISK_TIER_POLICIES` (`lib/config/risk-tiers.ts`). `GOVERNANCE_RULES` holds the six rules (G1 to G6) as sentences.
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

### The Core Four

Every deliverable has four named roles, the Core Four, in `deliverable.coreTeam` (`{ personId, joinedAt }` per role; partial, so a gap shows as a missing key). Labels: `terms.coreRoles[role]` ("Product Manager", "Tech Lead", "In-Business Risk Lead", "UX Design Lead") and `terms.coreRolesShort[role]`; order and one-line summaries: `CORE_ROLES`, `CORE_ROLE_SUMMARY` in `lib/config/pdlc.ts`.

- The **Product Manager** owns the process and takes the go / no-go decision at **every** stage gate, always last.
- The **Tech Lead**, **In-Business Risk Lead** and **UX Design Lead** confirm in their specialism, before the gate. They never take the gate decision.
- Only the person holding a role on the deliverable decides that role's review. One person may not hold two core roles on a deliverable: they are refused until a seat is given to someone else (and rule R15 flags it). An empty seat means nobody can decide that review. Agents never decide.

Stage reviews, in order (`PDLC_STAGES[i].reviews`, with `confirms[role]` giving `{ confirms, confirmed }` phrases and `evidenceBefore[role]` the evidence the review looks at):

| Stage | Reviews, in order |
|---|---|
| Ideation & Requirements | In-Business Risk Lead (names the obligations), UX Design Lead (user context), Product Manager (gate) |
| Design & Specifications | Tech Lead (architecture), UX Design Lead (prototype), Product Manager (gate) |
| Risk, Control & Compliance Reviews | In-Business Risk Lead (risk and controls, for the second line), Product Manager (gate) |
| Build, Test & Validate | Tech Lead (technical validation; looks at the test result), Product Manager (gate) |
| Delivery & Launch | Tech Lead (release checklist), Product Manager (gate; looks at business acceptance) |

Business acceptance is the Product Manager's: each outcome's `acceptanceOwnerId` is its deliverable's Product Manager.

### The read model

`describeWorkflow(data, results, deliverableId, actingAs?)` returns:

- `coreTeam`: the four seats in role order (`roleId`, `roleLabel`, `roleShort`, `personId`, `personName`, `joinedAt`, `shared`), gaps included; `coreTeamGaps`: `{ missing, shared }`.
- Per stage: the definition, state, `current`, `agentId`, the evidence it leaves with the latest record of each kind, and `reviews`. Each review carries `role`/`roleId`, `roleLabel`, `roleShort`, `gate`, `personId` and `personName` (the holder now), `confirms` and `confirmed`, `state`, `decisions`, `next` (the one to decide), `evidenceBefore`, `canDecide` (whether `actingAs` may decide it now), `decideReason`, `holderBlocked` (set when even the holder cannot: an empty seat or a person in two seats) and `actionLabel` ("Confirm as In-Business Risk Lead (Jordan Ellis)", "Approve the gate as Product Manager (Anwar Khan)").
- `nextReview`: the next review on the current stage as a one-click step: `{ kind: 'confirm' | 'approve-gate', stageId, roleId, roleLabel, personId, personName, label, detail, needsActAs, blocked }`. When `needsActAs` is true, call `actions.setActingAs(personId)` and then `actions.approveReview(id, stageId, roleId, personId)`. `nextReviewStep(view)` derives it from a view.
- `forward` (from the engine's `canMoveForward`: `allowed` plus a `reason` naming who must still confirm), `back`, and `backSuggestion` (`offer`, `to`, `reason`), which appears when required evidence is failing.

| Action | Notes |
|---|---|
| `runStageAgent(id, stageId?, by?)` | Current stage only. Runs that stage's agent, marks its work product `drafted`, and sets the reviews to `pending` |
| `approveReview(id, stageId, roleId, personId)` | Current stage only, by the holder of `coreTeam[roleId]`, in the stage's order (the Product Manager last). Refused for anyone else, for a person holding two core roles there, for an empty seat, while an earlier review is outstanding ("Waiting on the In-Business Risk Lead (…) to confirm risk and controls."), and while the stage's evidence is failing. Once every review is approved, the stage is `approved` and its drafted work products become `complete` |
| `returnReview(id, stageId, roleId, personId, reason)` | By the role holder, in order. Records the reason and moves the deliverable back one stage (if there is one) |
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
- Not the role holder: "Only the In-Business Risk Lead of TD-2001, <name>, can confirm this review; <other> cannot."
- Out of order: "Waiting on the In-Business Risk Lead (<name>) to name the obligations that apply and the UX Design Lead (<name>) to confirm the user context."
- Two core roles: "<name> holds both the Tech Lead and UX Design Lead roles on TD-1005; one person may not hold two core roles, so they cannot decide its reviews until one seat is given to someone else."
- An empty seat: "TD-1014 has no In-Business Risk Lead named, so this review cannot be decided until one joins the Core Four."
- Moving forward with reviews open: the engine's "Moving to … needs the Tech Lead to confirm the technical validation (pending) and the Product Manager to approve the stage gate (pending)."
- Moving back with no reason: "Moving back to … needs a reason to be recorded."
- Failing evidence: "The Tech Lead review cannot be approved while the test result (SIM-…) is failing."
- Business acceptance too early: "Accept the 2 open mandatory criteria of OC-2001-1 before recording business acceptance."

No action sets readiness, because the engine computes it. No patch can touch reported RAG.

## 6. Worked example: `WORKFLOW_DELIVERABLE_ID` (TD-2001, T1) from the first stage to ready

TD-2001's Core Four are four different people: the presenter (`p-presenter`, Anwar Khan) is the Product Manager and the acceptance owner; the Tech Lead is `p-xva-nyc-1`, the In-Business Risk Lead `p-ctl-1` (Jordan Ellis) and the UX Design Lead `p-dsg-1`. The walk acts as each holder in turn, as the screen does by following `nextReview` (switch persona, then act). The measures are given as work / accepted / readiness, and `lib/agents/workflow.test.ts` checks them.

```ts
const TD = WORKFLOW_DELIVERABLE_ID, PM = PRESENTER_PERSON_ID, TL = 'p-xva-nyc-1', RL = 'p-ctl-1', UX = 'p-dsg-1';
// Start: 0/8 points, 0/1 outcomes, unknown. Moving forward is refused: the stage's three reviews are outstanding.
const { runId } = actions.runStageAgent(TD).value;             // Requirements structuring: draft + 1 pending proposal (stories)
actions.approveProposal(proposalOf(runId).id, PM);             // stories added: 0/18, 0/1, unknown
actions.approveReview(TD, 'ideation-requirements', 'product-manager', PM);  // refused: "Waiting on the In-Business Risk Lead (Jordan Ellis) ..."
actions.approveReview(TD, 'ideation-requirements', 'risk-lead', RL);        // "Confirm as In-Business Risk Lead (Jordan Ellis)"
actions.approveReview(TD, 'ideation-requirements', 'ux-lead', UX);          // "Confirm as UX Design Lead (...)"
actions.approveReview(TD, 'ideation-requirements', 'product-manager', PM);  // "Approve the gate as Product Manager (Anwar Khan)"
actions.recordEvidence({ deliverableId: TD, kind: 'requirements-sign-off', result: 'pass', title: 'Requirements signed off', recordedById: PM, simulated: false });
actions.moveStage(TD, 'forward', PM);                          // Design & Specifications
actions.runStageAgent(TD);                                     // Outcome mapping: LIM-13 to OC-2001-1, auto-applied (T1)
actions.approveReview(TD, 'design-specifications', 'tech-lead', TL);
actions.approveReview(TD, 'design-specifications', 'ux-lead', UX);
actions.approveReview(TD, 'design-specifications', 'product-manager', PM);
actions.moveStage(TD, 'forward', PM);                          // Risk, Control & Compliance
actions.runStageAgent(TD);                                     // Control evidence check (read-only report)
actions.approveReview(TD, 'risk-control-compliance', 'risk-lead', RL);
actions.approveReview(TD, 'risk-control-compliance', 'product-manager', PM);
actions.moveStage(TD, 'forward', PM);                          // Build, Test & Validate
actions.runStageAgent(TD);                                     // Release readiness checklist
actions.simulateWorkClosed(TD, TL, { share: 0.5 });            // simulated: half the items closed, 0/1, unknown
actions.simulateWorkClosed(TD, TL);                            // simulated: the rest, 18/18 (100%), 0/1, unknown
actions.recordEvidence({ deliverableId: TD, kind: 'test-result', result: 'fail', title: 'Filter regression suite', recordedById: TL, simulated: true });
//   18/18, 0/1, not-ready. The Tech Lead's confirmation is refused. describeWorkflow(...).backSuggestion.offer === true
actions.moveStage(TD, 'back', TL, 'Regression suite failed; control mapping must cover the saved default.');
actions.approveReview(TD, 'risk-control-compliance', 'risk-lead', RL);          // needed again after the move back
actions.approveReview(TD, 'risk-control-compliance', 'product-manager', PM);
actions.moveStage(TD, 'forward', PM);
actions.recordEvidence({ deliverableId: TD, kind: 'test-result', result: 'pass', title: 'Filter regression suite (rerun)', recordedById: TL, simulated: true });
//   readiness: unknown (business acceptance and release checklist still missing)
actions.approveReview(TD, 'build-test-validate', 'tech-lead', TL);
actions.approveReview(TD, 'build-test-validate', 'product-manager', PM);
actions.moveStage(TD, 'forward', PM);                          // Delivery & Launch
actions.runStageAgent(TD);
actions.acceptCriterion('ac-oc-2001-1-1', PM);
actions.acceptCriterion('ac-oc-2001-1-2', PM);                 // still 0/1: no business-acceptance record yet
actions.recordEvidence({ deliverableId: TD, kind: 'business-acceptance', result: 'pass', title: 'Desk heads accept the filters', outcomeId: 'oc-2001-1', recordedById: PM, simulated: false });
//   1/1 outcomes accepted; readiness still unknown (release checklist missing)
actions.recordEvidence({ deliverableId: TD, kind: 'release-checklist', result: 'pass', title: 'Release checklist complete', recordedById: TL, simulated: false });
//   readiness ready (it is computed from evidence); the stage's reviews still follow
actions.approveReview(TD, 'delivery-launch', 'tech-lead', TL);
actions.approveReview(TD, 'delivery-launch', 'product-manager', PM);
// Ready: 18/18 points (100%), 1/1 outcomes accepted (100%), ready; every stage closed by the Product Manager's gate.
```

Stages 1 to 3 stay at 0/18 work, 0/1 outcomes and readiness unknown. Each measure moves only when its own evidence does. Closed work never accepts an outcome, and accepted outcomes never make the deliverable ready.

## Files

`catalogue.ts` (metadata only), `definitions/*` (the nine agents), `kit.ts` and `facts.ts` (shared wording and facts), `registry.ts` (`runAgent`, scope checks), `governance.ts` (rules G1 to G6, including `checkReviewDecision` for the Core Four), `patches.ts` (the only code that writes proposal changes), `playback.ts`, `provider.ts` (`scriptedProvider`, where an approved model plugs in), `refs.ts`, `workflow.ts`. The store actions are in `lib/store/actions.ts`.
