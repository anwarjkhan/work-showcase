# Delivery Intelligence — Design

**Status:** built. All 16 deliverables are complete; section 9 lists where the build differs from this design.
**Working title:** "Delivery Intelligence" (set in the terminology file, changeable).
**Location:** `prototypes/delivery-intelligence/` in this repository. All paths below are relative to that folder unless they start with `/`.

---

## 1. Purpose

A working, visual prototype that a single presenter can drive in about eight minutes to win **authority to run a pilot**. It has to show three things:

1. A firm grasp of the **PM Simplification hierarchy**: what sits in the portfolio system as book of record, what sits in Jira, and how they join.
2. A firm grasp of the **five-stage AI-first PDLC model**, and where agents and humans work within it.
3. That **agents can do visible, governed work** across delivery data: find problems, draft outputs, and propose changes that a named human approves.

Audience order: own management, divisional leadership, wider technology leadership, central team.

### Boundaries

- Synthetic data only. No employer names, logos, internal tool names, internal template names or internal figures anywhere in the repository.
- No live connections. No Jira calls, no model calls. Interfaces are left ready for both.
- No financial or budget figures.
- Nothing on screen may present scripted or sample output as a real result. Every screen carries a provenance label.

---

## 2. Decisions already agreed

| Topic | Decision |
|---|---|
| Hierarchy | Investment Request → Initiative / Programme / Project (moderate and high activity risk only) → Technology Deliverable → Outcome |
| Book of record | The portfolio system owns everything down to Outcome, including RAG at deliverable level and above |
| Jira mapping | A Technology Deliverable maps to **one or more Epics**. Each Epic carries a Deliverable ID and belongs to exactly one deliverable. The blueprint also shows a dedicated "Tech Deliverable" issue type at Epic level as the target option |
| Outcomes in Jira | Story-level items carry an **Outcome ID** field. An outcome can draw work from several Epics of the same deliverable |
| Three measures | **Work completion**, **accepted outcomes** and **delivery readiness** are computed and shown separately. None is derived from another (section 5) |
| PDLC workflow | Each deliverable has an interactive run through the five stages, with agent assists, human reviews and recorded evidence (section 5) |
| Jira hierarchy | Theme → Initiative → Epic → story level (Story, New Feature, Task, Bug, Improvement, RAID, Production Issue, Spike) → Sub-task |
| Activity risk | Low / Moderate / High. Low takes the standalone deliverable route |
| Pod fields | Work items carry pod, assignee type (human or agent), agent identifier and named human reviewer |
| PDLC stages | Ideation & Requirements → Design & Specifications → Risk, Control & Compliance Reviews → Build, Test & Validate → Delivery & Launch, with two-way movement between neighbours. No named gates are invented |
| Agents | Deterministic engine that computes over the data, labelled as such. A provider interface is left for an approved model |
| Write-back | Approving a proposed change updates the in-app data only, standing in for a Jira write |
| Plan view | Year, quarter (default), month and two-week sprint zoom |
| Geography | Delivery hubs on six continents |
| Styling | Corporate navy and blue palette in one theme file; no brand marks. Dark and light themes |
| Stack | Next.js, TypeScript, Tailwind |
| Presenter | Solo, so a guided demo mode is included |

### Decisions made while writing this design (please check)

1. **The repository is not empty, so nothing is overwritten.** It already has a folder convention, sharing guidelines and `PDLC_Jira_Cloud_Configuration_Matrix.xlsx`. The application goes in `prototypes/delivery-intelligence/`, which is what `prototypes/README.md` asks for. Existing files stay.
2. **The configuration matrix feeds the blueprint screen.** Its 14 work types, 8 workflows and field catalogue are the "target template" content, adjusted for the Epic-per-deliverable decision.
3. **Two risk scales, kept separate.** Activity risk (Low / Moderate / High) decides the route through the hierarchy. The matrix's work-item risk tiers (T1 Low to T4 Critical / Regulated) set the **agent autonomy ceiling**, so the Agent centre uses them.
4. **Fully static.** The application has no server code, so it runs with `npm run dev` on localhost and can also be exported as static files for internal hosting.
5. **Fonts are bundled** as npm packages, so the build does not fetch anything from the internet.
6. **The demo clock is fixed** at 8 March 2027, so every screen shows the same thing on every run.

### Repository exposure — resolved 16 November 2026

- The repository is public by the owner's choice.
- `PDLC_Jira_Cloud_Configuration_Matrix.xlsx` was replaced with a cleaned copy: the portfolio system's short name became "Portfolio System", the technology domain list became generic, and the author name was removed from the file properties.
- The history was rewritten so the original file is no longer in any commit on `main`, and `main` was force-pushed.
- The blueprint screen takes its content from `lib/config/blueprint.ts`, written with generic names, so it does not depend on the spreadsheet.

---

## 3. The story the demo tells

One hero deliverable carries the narrative. All names are synthetic.

- **Deliverable:** "Counterparty exposure — stress scenario reconciliation", inside the programme "Counterparty Credit Risk Modernisation".
- **Shape:** three Epics across two hubs, four outcomes.
- **Reported:** Green in the portfolio system.
- **Work completion:** 82%.
- **Accepted outcomes:** 1 of 4. Two more are marked on track in the portfolio system with no acceptance recorded.
- **Delivery readiness:** Not ready. The reconciliation test is failing, control evidence is missing, a market-data dependency from a hub on another continent is nine days late, and the linked risk has had no update for 23 days.

A second deliverable carries the PDLC workflow walk-through: "Limit-monitoring dashboard filters", a standalone low-risk deliverable that starts at Ideation & Requirements with a thin Epic.

Guided demo steps:

| Step | Screen | Point made |
|---|---|---|
| 1 | Portfolio | The whole book at a glance; four deliverables where reported status and evidence disagree |
| 2 | Hierarchy | How the simplified model works, and which system owns each level |
| 3 | Deliverable detail | The hero deliverable: 82% of work done, 1 of 4 outcomes accepted, not ready, each traced to records |
| 4 | Global | The late dependency crosses hubs; where the work physically sits |
| 5 | Plan | The knock-on effect on the quarter's commitments |
| 6 | Lifecycle | The same portfolio through the five PDLC stages; where agents assist |
| 7 | PDLC workflow | Walk one deliverable through the stages: agent drafts, human reviews, a failed test sends it back, acceptance and readiness are recorded |
| 8 | Agent centre | Run an agent across the portfolio; review and approve its proposed changes; the evidence view updates |
| 9 | Deliverable detail | The drafted status report, every sentence cited |
| 10 | Blueprint | We own the templates; this is the target template that makes it repeatable |
| 11 | Pilot evidence | What we would measure, and the ask |

---

## 4. Screens

| Route | Screen | Content |
|---|---|---|
| `/` | Portfolio | Headline counts by hierarchy level; reported against evidence-based RAG; "status disagreements" list; health by programme; stage distribution; data freshness |
| `/hierarchy` | Hierarchy explorer | Expandable tree from Investment Request to story. A band marks the book-of-record boundary. Standalone deliverables shown as a distinct route. Activity risk shown on each request |
| `/plan` | Plan | Timeline with rows following the hierarchy. Zoom: year, quarter, month, sprint. Milestones, today line, forecast against plan, late dependencies |
| `/global` | Global | World map with delivery hubs sized by deliverable count and coloured by health. Arcs for cross-hub dependencies. Hub panel with pods and deliverables |
| `/lifecycle` | Lifecycle | Five PDLC stages as columns with two-way connectors. Deliverables placed by stage. Agents available per stage. Human review points. Human and agent share of work per stage. Each deliverable opens its workflow |
| `/lifecycle/[id]` | PDLC workflow | One deliverable's run through the five stages. Per stage: work products, agent assist, human review, evidence required and evidence held. Controls to run the stage agent, approve or return a review, record evidence, and move forward or back |
| `/agents` | Agent centre | Catalogue of agents with stage, mode and autonomy ceiling. Live run with visible steps. Approval queue with before and after. Audit trail |
| `/deliverables/[id]` | Deliverable detail | The three measures side by side. Epics, outcomes with acceptance criteria, work grouped by outcome, evidence register, RAID, dependencies, findings, pod, and the drafted status with citations |
| `/blueprint` | Template blueprint | Current rapid and advanced templates beside the target template. Issue types mapped to the hierarchy. New fields. Rollout across the project estate |
| `/evidence` | Pilot evidence | Baseline against assisted effort, exception counts, draft acceptance. All figures marked as placeholders until measured. The pilot ask |
| `/about` | About this build | What is computed, scripted, sample or planned. How to plug in real data and a model |

Cross-cutting: left navigation, top bar with provenance badge, theme switch, guided-demo control and "Reset demo".

Provenance labels used everywhere: `Sample data`, `Computed from data`, `Scripted agent`, `Portfolio system (reported)`, `Planned`.

---

## 5. Architecture

```
app/ (routes, client components)
   │
lib/store        in-memory state, reset, approvals, audit trail
   │
lib/engine       rollups, checks, evidence-based RAG, plan maths
lib/agents       agent definitions, runner, proposals, autonomy rules
   │
lib/data         DataSource interface → SyntheticSource (seeded generator)
                                      → JiraSource (interface only, not built)
lib/config       terminology, theme tokens, demo clock, estate numbers
```

- **Stack:** Next.js (App Router, static export), React, TypeScript in strict mode, Tailwind. Exact versions are pinned in the lockfile at scaffold time, choosing versions that build together.
- **Libraries, kept few for the internal package mirror:** `d3-geo`, `d3-scale`, `d3-shape`, `topojson-client`, `world-atlas` (embedded map geometry), `motion`, `lucide-react`, bundled font packages. Charts are hand-built SVG components, not a chart library.
- **Tests:** Vitest for logic, Playwright for the browser journey.
- **State:** one client-side store seeded from the data source. Approvals change the store and append to the audit trail. Reset restores the seed.
- **Terminology:** every label for a system, template or tool is read from `lib/config/terminology.ts`. An optional `terminology.local.ts`, ignored by git, overrides it inside the firm.
- **Theme:** all colours and fonts are CSS variables in `app/theme.css`. Brand values are set there after import.

### Domain model (`lib/types.ts`)

| Type | Key fields |
|---|---|
| `InvestmentRequest` | ref, title, objective, owner, activityRisk, route (`formal` or `standalone`) |
| `PmNode` | level (`initiative`, `programme`, `project`), parentId, investmentRequestId, reportedRag |
| `TechDeliverable` | ref, title, pmNodeId or null, investmentRequestId, epicKeys (one or more), template, reportedRag, pdlcStage, riskTier, hubIds, podId, plannedStart, plannedEnd |
| `Outcome` | deliverableId, title, weight, dueDate, reportedOnTrack, acceptanceOwnerId |
| `AcceptanceCriterion` | outcomeId, text, mandatory, state (`open`, `accepted`, `rejected`), acceptedById, acceptedAt |
| `WorkItem` | key, type, summary, status, statusCategory, deliverableId (on Epics), epicKey, outcomeId, parentKey, assignee (`human` or `agent`), reviewerId, podId, hubId, sprintId, points, created, updated, due |
| `Evidence` | kind (`requirements sign-off`, `design review`, `control assessment`, `test result`, `business acceptance`, `release checklist`), deliverableId, outcomeId, workItemKey, result (`pass`, `fail`, `pending`), source, observedAt, recordedById, provenance |
| `PdlcRun`, `PdlcStageState` | per deliverable: current stage, per-stage state, review decisions, moves forward and back |
| `ReadinessAssessment` | state (`ready`, `not ready`, `unknown`), required evidence, held evidence, reasons |
| `RaidItem` | key, kind, deliverableId, ownerId, severity, status, updated, mitigationDue |
| `Dependency` | fromDeliverableId, toDeliverableId, fromHubId, toHubId, needBy, committed, status |
| `Milestone` | deliverableId, title, date, regulatory flag |
| `Hub`, `Pod`, `Person`, `AgentIdentity`, `Sprint` | reference data |
| `Finding` | ruleId, severity, entity reference, message, evidence references |
| `AgentRun`, `AgentStep`, `ProposedChange`, `Approval`, `AuditEvent`, `StatusDraft` | agent and governance records |

### Synthetic portfolio

Generated by a seeded generator, so it is reproducible and large enough to look real:
6 investment requests, 4 programmes, about 26 deliverables (6 standalone) mapped to about 45 Epics, about 70 outcomes with about 200 acceptance criteria, about 900 work items, about 300 evidence records, 18 hubs, 12 pods, about 40 RAID items, about 30 dependencies, 26 sprints across 2027. Programme themes use industry terms: counterparty credit risk, FRTB, stress testing, price risk controls, finance ledger, shared data platform. Hero-story records are hand-written and pinned.

### Engine rules

Three measures, computed independently and always shown together:

| Measure | Question it answers | How it is computed | Form |
|---|---|---|---|
| Work completion | How much of the planned work is closed? | Closed points ÷ total points, across all Epics of the deliverable. Per outcome: the same, for items carrying that Outcome ID | Percentage |
| Accepted outcomes | How much has the business accepted? | An outcome is accepted only when every mandatory acceptance criterion is accepted by a named human and a `business acceptance` evidence record exists. Deliverable figure = accepted outcome weight ÷ total weight | Count and percentage |
| Delivery readiness | Is there verified evidence it can be released? | Required evidence kinds are set per risk tier in config. `ready` if every required kind is held and passing; `not ready` if any is failing or a critical dependency is open; `unknown` if any is missing or stale | Three states, never a percentage |

- 100% work completion does not make an outcome accepted. Accepted outcomes do not make a deliverable ready.
- Evidence is stale when the linked work changed after the evidence was observed.
- An agent can never record acceptance or set readiness; it can only report what is held and what is missing.
- Zero weights or no linked work return "not computable", not zero.

PDLC workflow (per deliverable):

- Five stages in order, with moves allowed forward and back between neighbours.
- Each stage defines its work products, the agent that assists, one human review, and the evidence it should leave behind:

| Stage | Agent assist | Human review | Evidence left |
|---|---|---|---|
| Ideation & Requirements | Requirements structuring | Requirements owner | Requirements sign-off |
| Design & Specifications | Outcome mapping | Design reviewer | Design review |
| Risk, Control & Compliance Reviews | Control evidence check | Control owner | Control assessment |
| Build, Test & Validate | Release readiness | Independent validator | Test results |
| Delivery & Launch | Release readiness | Business owner, then release owner | Business acceptance, release checklist |

- Moving forward needs the stage's review approved. A returned review, or failing evidence found later, moves the deliverable back with the reason recorded.
- Test results in the prototype arrive through a "Simulate evidence arriving" control, labelled as simulated. Nothing is executed.
- The reviews are illustrative and set in config. They are not presented as the firm's official gates.

Checks (each produces `Finding` records; thresholds live in config):

| Rule | Condition |
|---|---|
| R1 | Milestone due within 14 days and under 60% of linked work closed |
| R2 | Epic closed while children remain open |
| R3 | Due date passed and item not closed |
| R4 | RAID item with no owner, no mitigation date, or no update in 14 days |
| R5 | Reported Green while a critical dependency is blocked or late |
| R6 | Dependency committed date falls after the receiver's need-by date |
| R7 | Likely duplicate RAID items |
| R8 | Portfolio-system fields disagree with the Jira Epic (dates, owner, deliverable ID) |
| R9 | Story-level item with no Outcome ID |
| R10 | Agent-assigned item with no named human reviewer |
| R11 | Outcome not accepted, and either reported complete, or reported on track while past its due date or with all linked work closed |
| R12 | Evidence older than the latest change to the work it covers |
| R13 | A required test result is failing |
| R14 | Epic with no Deliverable ID, or a Deliverable ID that does not exist |

Evidence-based RAG: Red if any critical finding or a missed committed date; Amber if any high finding or stale data; Green otherwise; Unknown if there is too little data. It is always shown beside the reported RAG and never replaces it.

### Agents

All are deterministic and labelled `Scripted agent`. Each implements `AgentDefinition.run(state) → { steps, findings, proposals, draft }`.

| Agent | PDLC stage | Mode | Output |
|---|---|---|---|
| Requirements structuring | Ideation & Requirements | Draft | Proposed stories with acceptance criteria for a thin Epic |
| Outcome mapping | Design & Specifications | Propose change | Outcome ID suggestions for unmapped items |
| Control evidence check | Risk, Control & Compliance Reviews | Read only | Missing fields and evidence for the item's risk tier |
| Release readiness | Build, Test & Validate / Delivery & Launch | Read only | Readiness checklist with exceptions |
| RAID quality | Cross-cutting | Propose change | Owner, date and duplicate fixes |
| Dependency discovery | Cross-cutting | Propose change | Candidate dependencies with evidence |
| Portfolio reconciliation | Cross-cutting | Read only | Book-of-record against Jira discrepancy report |
| Status reporting | Cross-cutting | Draft | Weekly status with a citation per sentence |
| Executive briefing | Cross-cutting | Draft | Decision-focused portfolio brief |

Governance rules enforced in code and tested:
- An agent can never approve, accept an outcome, or set readiness. Approval needs a named human who is not the item's assignee.
- Autonomy ceiling by risk tier: T1 may auto-apply specifically allowed changes; T2 and T3 propose only; T4 is advisory only, with no proposed changes.
- Every run, proposal, approval and rejection appends to the audit trail.
- Reported RAG in the portfolio system can never be changed by an agent or an approval.

---

## 6. Deliverables

Each deliverable is built by one subagent. "Model" is the cheapest that should do it well. Files listed are owned by that deliverable; no two deliverables in the same wave share a file.

### Wave 1

**D1 — Foundation and contracts** · Model: opus
- Scaffold, pinned dependencies, theme, application shell, navigation, provenance badge, theme switch, all shared types, terminology and config, store skeleton, placeholder page per route.
- Files: `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `vitest.config.ts`, `playwright.config.ts`, `.gitignore`, `app/layout.tsx`, `app/theme.css`, `app/globals.css`, `app/**/page.tsx` (placeholders), `components/shell/*`, `lib/types.ts`, `lib/config/*`, `lib/store/*`, `lib/data/source.ts`
- Acceptance:
  - `npm install`, `npm run dev`, `npm run build`, `npm run typecheck`, `npm run lint` and `npm test` all succeed.
  - `npm run build` produces a static export.
  - All eleven routes render inside the shell with working navigation.
  - Dark and light themes both work; every colour comes from a variable in `app/theme.css`.
  - No network request leaves the machine at build or run time.
  - `lib/types.ts` contains every type in section 5.

### Wave 2 (parallel, after D1)

**D2 — Synthetic portfolio** · Model: sonnet
- Files: `lib/data/synthetic/*`, `lib/data/synthetic.test.ts`
- Acceptance:
  - Same seed gives identical data on every run.
  - Volumes match section 5 within 10%.
  - Referential integrity test passes: every id reference resolves.
  - Hero-story and workflow-story records exist exactly as in section 3.
  - At least eight deliverables have more than one Epic; every Epic belongs to exactly one deliverable.
  - At least one outcome draws work from two Epics.
  - Evidence and acceptance criteria exist for every deliverable, with a realistic mix of passing, failing, pending and stale.
  - At least four deliverables are reported Green with evidence that should compute Red or Amber.
  - Hubs cover six continents.
  - No employer, internal tool or internal template name appears.

**D3 — Engine** · Model: opus
- Files: `lib/engine/*`, `lib/engine/*.test.ts`
- Acceptance:
  - The three measures match section 5, including zero-weight and no-work cases returning "not computable".
  - Tests prove independence: 100% work completion with no acceptance gives 0 accepted outcomes; all outcomes accepted with a failing required test gives `not ready`; missing evidence gives `unknown`, never `ready`.
  - Work completion sums across all Epics of a deliverable.
  - PDLC workflow transitions are tested: forward needs an approved review, back records a reason, non-neighbour moves are refused.
  - Each of R1 to R14 has a passing test for a hit and a miss.
  - Evidence-based RAG has tests for Red, Amber, Green and Unknown.
  - Plan helpers return correct spans for year, quarter, month and sprint zoom.
  - All functions are pure and take the demo clock as a parameter.

**D4 — Interface primitives** · Model: sonnet
- Files: `components/ui/*`, `components/charts/*`
- Acceptance:
  - Provides: card, RAG pill, paired reported/evidence RAG, stat tile, tabs, drawer, tooltip, table, progress bar, stacked bar, donut, sparkline, legend, empty state.
  - Status is always text plus shape, never colour alone.
  - Keyboard focus is visible on every interactive element.
  - All components read colours from theme variables and work in both themes.
  - Motion respects the reduced-motion setting.

### Wave 3 (parallel, after wave 2)

**D5 — Agents and governance** · Model: opus
- Files: `lib/agents/*`, `lib/agents/*.test.ts`, `lib/store/actions.ts`
- Acceptance:
  - All nine agents in section 5 run against the synthetic portfolio and return steps, and findings, proposals or a draft as their mode requires.
  - Changing the input data changes the output (tested).
  - Every sentence in a status draft carries at least one evidence reference that resolves.
  - Governance rules in section 5 each have a passing test, including the T4 ceiling and "an agent cannot approve, accept or set readiness".
  - Store actions exist for the PDLC workflow: run stage agent, approve or return a review, record evidence, accept a criterion, move stage. Each appends an audit event.
  - Approving a proposal changes the store, re-runs the engine, and appends an audit event; rejecting changes nothing but is logged.
  - Reset restores the seeded state exactly.
  - A `ModelProvider` interface exists with the scripted provider as the only implementation.

**D6 — Portfolio screen** · Model: sonnet
- Files: `app/page.tsx`, `components/portfolio/*`
- Acceptance: shows everything listed for `/` in section 4; the three measures appear as separate portfolio figures; the disagreements list links to the right deliverable; counts equal engine output; readable at 1920 and 1366 wide.

**D7 — Hierarchy explorer** · Model: sonnet
- Files: `app/hierarchy/page.tsx`, `components/hierarchy/*`
- Acceptance: tree expands from Investment Request to story, with multiple Epics shown under a deliverable; the book-of-record boundary is visible and labelled from terminology; standalone deliverables are visually distinct; activity risk and route shown per request; expand and collapse work by keyboard.

**D8 — Plan** · Model: opus
- Files: `app/plan/page.tsx`, `components/plan/*`
- Acceptance: four zoom levels; rows expand through the hierarchy; today line at the demo clock; milestones and regulatory milestones distinct; forecast slip shown against plan; horizontal scroll stays inside the timeline; 26 deliverables render without visible lag.

**D9 — Global** · Model: opus
- Files: `app/global/page.tsx`, `components/global/*`
- Acceptance: map renders from embedded geometry with no network; 18 hubs placed correctly; hub size and colour follow the data; dependency arcs drawn with late ones distinct; selecting a hub opens its panel; a list view gives the same information without the map.

**D10 — Lifecycle** · Model: sonnet
- Files: `app/lifecycle/page.tsx`, `components/lifecycle/*`
- Acceptance: five stages in order with two-way connectors; deliverables placed by stage; agents listed per stage from the agent catalogue; human review points shown generically; human and agent share per stage computed from work items; each deliverable links to its workflow at `/lifecycle/[id]`.

**D11 — Blueprint, Pilot evidence, About** · Model: sonnet
- Files: `app/blueprint/page.tsx`, `app/evidence/page.tsx`, `app/about/page.tsx`, `components/blueprint/*`, `components/evidence/*`, `lib/config/blueprint.ts`
- Acceptance: blueprint shows the three templates side by side with issue types mapped to the hierarchy, the new fields (Deliverable ID on Epics, Outcome ID, acceptance and evidence references, pod, assignee type, agent identifier, reviewer), the many-Epics-to-one-deliverable pattern, and estate numbers read from config; every figure on Pilot evidence is marked as a placeholder; About lists what is computed, scripted, sample and planned, and how to plug in real data.

### Wave 4 (parallel, after wave 3)

**D12 — Agent centre** · Model: opus
- Files: `app/agents/page.tsx`, `components/agents/*`
- Acceptance: catalogue shows stage, mode and autonomy ceiling; running an agent plays its steps and ends with computed results; approval queue shows before and after per change; approve and reject work and update other screens; T4 items show advisory output with no approve control; audit trail lists every event; "Scripted agent" label always visible.

**D13 — Deliverable detail** · Model: sonnet
- Files: `app/deliverables/[id]/page.tsx`, `components/deliverable/*`
- Acceptance: every deliverable has a statically generated page; the three measures are shown side by side with the reasons behind readiness; shows Epics, outcomes with acceptance criteria and who accepted them, work grouped by outcome, an evidence register with result, source, date and staleness, RAID, dependencies, findings, pod with human and agent members; reported and evidence-based RAG side by side with the reasons; status draft shows citations that open the cited record; the hero deliverable matches section 3.

**D16 — PDLC workflow** · Model: opus
- Files: `app/lifecycle/[id]/page.tsx`, `components/workflow/*`
- Acceptance:
  - Every deliverable has a statically generated workflow page.
  - Shows the five stages with the current one marked, and per stage: work products, agent assist, review state, evidence required and held.
  - The presenter can run the stage agent and see its steps and draft; approve or return the review; simulate evidence arriving; accept acceptance criteria as the named owner; move forward or back.
  - Forward is disabled with the reason shown until the review is approved.
  - A failing test result blocks readiness and offers the move back; a passing rerun clears it.
  - The three measures update live as actions are taken and match the Deliverable detail screen.
  - The workflow-story deliverable can be walked from the first stage to `ready` in under two minutes.
  - Simulated evidence and scripted agent output are labelled as such.

### Wave 5 (after wave 4)

**D14 — Guided demo, browser tests, documentation** · Model: sonnet
- Files: `components/demo/*`, `lib/config/demo-script.ts`, `e2e/*`, `README.md`, `/prototypes/README.md`, `/README.md` (one table row)
- Acceptance:
  - Guided mode walks the eleven steps in section 3 with a prompt per step, forward and back, by keyboard.
  - Browser tests: every route loads with no console errors; the guided journey completes; approving a change in the Agent centre changes the hero deliverable's evidence view; the workflow-story deliverable is walked from the first stage to `ready`, including the failed test and the move back; reset restores everything.
  - `README.md` follows the repository's project documentation standard: problem, approach, demonstration, running locally, limitations, sharing status.

**D15 — Review and release** · Done by the lead, not a subagent
- Review every deliverable's diff against its acceptance criteria.
- Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run e2e`.
- Look at every screen in a browser in both themes at 1920 and 1366 wide.
- Search the whole folder for employer, internal tool and internal template names.
- Commit and push to `main`.

---

## 7. What this build does not do

- Connect to Jira, the portfolio system or any model.
- Authenticate users or enforce roles; the presenter acts as a named sample approver.
- Persist anything; a refresh returns to the seeded state.
- Generate code, execute tests or deploy anything. Test results arrive as simulated evidence.
- Show money or headcount.

## 8. After import inside the firm

1. Add `terminology.local.ts` with internal names.
2. Set brand colours, fonts and logo in `app/theme.css`.
3. Set the real estate numbers in `lib/config`.
4. Implement `JiraSource` against the Jira API, read-only first.
5. Implement a `ModelProvider` against the approved agent platform.
6. Replace the Pilot evidence placeholders with the measured baseline.

## 9. Where the build differs from this design

- **TypeScript 6, not the newest major**, because the lint tooling does not yet support it.
- **Rule R11 was refined.** It fires only when an unaccepted outcome is reported complete, or reported on track while past its due date or with all linked work closed. An outcome that is on track, not yet due and still has open work raises nothing.
- **Forecasts are gated.** A throughput forecast is shown only when the deliverable started at least 28 days ago, is at least 25% complete and closed at least five items in the last 42 days. Otherwise the planned end is shown with the reason. A projected slip over 120 days is flagged as at risk without a date.
- **A "simulate work closed" step was added** to the Build, Test & Validate stage, so the walk-through ends with all three measures complete. It is labelled as simulated.
- **Required evidence per risk tier is illustrative:** T1 needs requirements sign-off, test result, business acceptance and release checklist; T2 adds design review; T3 and T4 need all six kinds. Set in `lib/config/risk-tiers.ts`.
- **Evidence-based status for a parent** (project, programme, initiative, investment request) is its worst child's.
- **Any open critical incoming dependency makes a deliverable not ready**, even when it is on track.
- **Synthetic volumes:** 855 work items and 301 evidence records, against about 900 and about 300 in section 5.
- **A sixth provenance label, "Simulated evidence"**, was added to those in section 4.
- **The on-screen name for the hierarchy** is "Simplified delivery hierarchy", set in the terminology file.
- **Browser tests:** 43, covering every route at two widths, both themes, the guided journey, the main storyline, the agent centre with a governance refusal, the workflow walk-through and reset.
