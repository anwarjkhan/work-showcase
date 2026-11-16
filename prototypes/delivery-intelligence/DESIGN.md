# Delivery Intelligence — Design

**Status:** design for review. Nothing below is built yet.
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
| Jira mapping | One **Epic per Technology Deliverable**. The blueprint also shows a dedicated "Tech Deliverable" issue type at Epic level as the target option |
| Outcomes in Jira | Story-level items carry an **Outcome ID** field. Outcome progress rolls up by that field |
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

### Two things to note about the existing repository

- `README.md` and `docs/sharing-guidelines.md` describe the repository as private. It is currently public.
- `PDLC_Jira_Cloud_Configuration_Matrix.xlsx` contains the portfolio system's real short name and a domain list. If the "no employer references" rule applies to the whole repository, that file needs a look. This build does not change it.

---

## 3. The story the demo tells

One hero deliverable carries the narrative. All names are synthetic.

- **Deliverable:** "Counterparty exposure — stress scenario reconciliation", inside the programme "Counterparty Credit Risk Modernisation".
- **Reported:** Green in the portfolio system.
- **Evidence says Red:** 82% of stories are closed, but a critical validation item is failing, a market-data dependency from a hub on another continent is nine days late, and the linked risk has had no update for 23 days.

Guided demo steps:

| Step | Screen | Point made |
|---|---|---|
| 1 | Portfolio | The whole book at a glance; four deliverables where reported status and evidence disagree |
| 2 | Hierarchy | How the simplified model works, and which system owns each level |
| 3 | Deliverable detail | The hero deliverable: why evidence says Red, traced to records |
| 4 | Global | The late dependency crosses hubs; where the work physically sits |
| 5 | Plan | The knock-on effect on the quarter's commitments |
| 6 | Lifecycle | The same portfolio through the five PDLC stages; where agents assist |
| 7 | Agent centre | Run an agent live; review and approve its proposed changes; the evidence view updates |
| 8 | Deliverable detail | The drafted status report, every sentence cited |
| 9 | Blueprint | We own the templates; this is the target template that makes it repeatable |
| 10 | Pilot evidence | What we would measure, and the ask |

---

## 4. Screens

| Route | Screen | Content |
|---|---|---|
| `/` | Portfolio | Headline counts by hierarchy level; reported against evidence-based RAG; "status disagreements" list; health by programme; stage distribution; data freshness |
| `/hierarchy` | Hierarchy explorer | Expandable tree from Investment Request to story. A band marks the book-of-record boundary. Standalone deliverables shown as a distinct route. Activity risk shown on each request |
| `/plan` | Plan | Timeline with rows following the hierarchy. Zoom: year, quarter, month, sprint. Milestones, today line, forecast against plan, late dependencies |
| `/global` | Global | World map with delivery hubs sized by deliverable count and coloured by health. Arcs for cross-hub dependencies. Hub panel with pods and deliverables |
| `/lifecycle` | Lifecycle | Five PDLC stages as columns with two-way connectors. Deliverables placed by stage. Agents available per stage. Human review points. Human and agent share of work per stage |
| `/agents` | Agent centre | Catalogue of agents with stage, mode and autonomy ceiling. Live run with visible steps. Approval queue with before and after. Audit trail |
| `/deliverables/[id]` | Deliverable detail | Outcomes with rollup, work by outcome, RAID, dependencies, findings, pod, and the drafted status with citations |
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
| `TechDeliverable` | ref, title, pmNodeId or null, investmentRequestId, epicKey, template, reportedRag, pdlcStage, riskTier, hubIds, podId, plannedStart, plannedEnd |
| `Outcome` | deliverableId, title, weight, dueDate, reportedOnTrack |
| `WorkItem` | key, type, summary, status, statusCategory, epicKey, outcomeId, parentKey, assignee (`human` or `agent`), reviewerId, podId, hubId, sprintId, points, created, updated, due |
| `RaidItem` | key, kind, deliverableId, ownerId, severity, status, updated, mitigationDue |
| `Dependency` | fromDeliverableId, toDeliverableId, fromHubId, toHubId, needBy, committed, status |
| `Milestone` | deliverableId, title, date, regulatory flag |
| `Hub`, `Pod`, `Person`, `AgentIdentity`, `Sprint` | reference data |
| `Finding` | ruleId, severity, entity reference, message, evidence references |
| `AgentRun`, `AgentStep`, `ProposedChange`, `Approval`, `AuditEvent`, `StatusDraft` | agent and governance records |

### Synthetic portfolio

Generated by a seeded generator, so it is reproducible and large enough to look real:
6 investment requests, 4 programmes, about 26 deliverables (6 standalone), about 70 outcomes, about 900 work items, 18 hubs, 12 pods, about 40 RAID items, about 30 dependencies, 26 sprints across 2027. Programme themes use industry terms: counterparty credit risk, FRTB, stress testing, price risk controls, finance ledger, shared data platform. Hero-story records are hand-written and pinned.

### Engine rules

Rollups:
- Outcome completion = closed points ÷ total points for work items carrying that Outcome ID.
- Deliverable completion = weighted average of its outcomes.
- Completion never implies health; RAG is computed separately.

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
- An agent can never approve. Approval needs a named human who is not the item's assignee.
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
  - All ten routes render inside the shell with working navigation.
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
  - Hero-story records exist exactly as in section 3.
  - At least four deliverables are reported Green with evidence that should compute Red or Amber.
  - Hubs cover six continents.
  - No employer, internal tool or internal template name appears.

**D3 — Engine** · Model: opus
- Files: `lib/engine/*`, `lib/engine/*.test.ts`
- Acceptance:
  - Rollup formulas match section 5, including zero-weight and no-work cases returning "not computable".
  - Each of R1 to R10 has a passing test for a hit and a miss.
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
  - Governance rules in section 5 each have a passing test, including the T4 ceiling and "an agent cannot approve".
  - Approving a proposal changes the store, re-runs the engine, and appends an audit event; rejecting changes nothing but is logged.
  - Reset restores the seeded state exactly.
  - A `ModelProvider` interface exists with the scripted provider as the only implementation.

**D6 — Portfolio screen** · Model: sonnet
- Files: `app/page.tsx`, `components/portfolio/*`
- Acceptance: shows everything listed for `/` in section 4; the disagreements list links to the right deliverable; counts equal engine output; readable at 1920 and 1366 wide.

**D7 — Hierarchy explorer** · Model: sonnet
- Files: `app/hierarchy/page.tsx`, `components/hierarchy/*`
- Acceptance: tree expands from Investment Request to story; the book-of-record boundary is visible and labelled from terminology; standalone deliverables are visually distinct; activity risk and route shown per request; expand and collapse work by keyboard.

**D8 — Plan** · Model: opus
- Files: `app/plan/page.tsx`, `components/plan/*`
- Acceptance: four zoom levels; rows expand through the hierarchy; today line at the demo clock; milestones and regulatory milestones distinct; forecast slip shown against plan; horizontal scroll stays inside the timeline; 26 deliverables render without visible lag.

**D9 — Global** · Model: opus
- Files: `app/global/page.tsx`, `components/global/*`
- Acceptance: map renders from embedded geometry with no network; 18 hubs placed correctly; hub size and colour follow the data; dependency arcs drawn with late ones distinct; selecting a hub opens its panel; a list view gives the same information without the map.

**D10 — Lifecycle** · Model: sonnet
- Files: `app/lifecycle/page.tsx`, `components/lifecycle/*`
- Acceptance: five stages in order with two-way connectors; deliverables placed by stage; agents listed per stage from the agent catalogue; human review points shown generically; human and agent share per stage computed from work items.

**D11 — Blueprint, Pilot evidence, About** · Model: sonnet
- Files: `app/blueprint/page.tsx`, `app/evidence/page.tsx`, `app/about/page.tsx`, `components/blueprint/*`, `components/evidence/*`, `lib/config/blueprint.ts`
- Acceptance: blueprint shows the three templates side by side with issue types mapped to the hierarchy, the new fields (Deliverable ID, Outcome ID, pod, assignee type, agent identifier, reviewer) and estate numbers read from config; every figure on Pilot evidence is marked as a placeholder; About lists what is computed, scripted, sample and planned, and how to plug in real data.

### Wave 4 (parallel, after wave 3)

**D12 — Agent centre** · Model: opus
- Files: `app/agents/page.tsx`, `components/agents/*`
- Acceptance: catalogue shows stage, mode and autonomy ceiling; running an agent plays its steps and ends with computed results; approval queue shows before and after per change; approve and reject work and update other screens; T4 items show advisory output with no approve control; audit trail lists every event; "Scripted agent" label always visible.

**D13 — Deliverable detail** · Model: sonnet
- Files: `app/deliverables/[id]/page.tsx`, `components/deliverable/*`
- Acceptance: every deliverable has a statically generated page; shows outcomes with rollup, work grouped by outcome, RAID, dependencies, findings, pod with human and agent members; reported and evidence-based RAG side by side with the reasons; status draft shows citations that open the cited record; the hero deliverable matches section 3.

### Wave 5 (after wave 4)

**D14 — Guided demo, browser tests, documentation** · Model: sonnet
- Files: `components/demo/*`, `lib/config/demo-script.ts`, `e2e/*`, `README.md`, `/prototypes/README.md`, `/README.md` (one table row)
- Acceptance:
  - Guided mode walks the ten steps in section 3 with a prompt per step, forward and back, by keyboard.
  - Browser tests: every route loads with no console errors; the guided journey completes; approving a change in the Agent centre changes the hero deliverable's evidence view; reset restores it.
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
- Simulate code generation, test execution or deployment.
- Show money or headcount.

## 8. After import inside the firm

1. Add `terminology.local.ts` with internal names.
2. Set brand colours, fonts and logo in `app/theme.css`.
3. Set the real estate numbers in `lib/config`.
4. Implement `JiraSource` against the Jira API, read-only first.
5. Implement a `ModelProvider` against the approved agent platform.
6. Replace the Pilot evidence placeholders with the measured baseline.
