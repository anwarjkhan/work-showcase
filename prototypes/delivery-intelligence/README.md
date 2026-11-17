# Delivery Intelligence

A working, visual prototype of evidence-based delivery reporting over a simplified delivery hierarchy, with governed AI agents. One presenter can drive it in about eight minutes, with a built-in guided demo mode. Everything runs in the browser over synthetic data.

Read [`DESIGN.md`](DESIGN.md) for the specification and [`CONTRACTS.md`](CONTRACTS.md) for how the code is organised and extended.

## 1. Problem

Delivery status is reported by people, one level at a time, and it drifts from what the records show. A deliverable can be reported Green while a test is failing, control evidence is missing and a dependency from another hub is late. Three different questions get answered by one number:

- How much of the planned work is closed?
- How much of what was promised has the business accepted?
- Is there verified evidence that it can be released?

The prototype shows what it looks like when those three are computed separately from the underlying records and always shown side by side, and when agents do the checking and drafting while a named person stays accountable for every change.

## 2. Approach

**What it is.** A static Next.js application with a synthetic portfolio, a rules engine, a set of scripted agents and eleven screens. It is meant to be imported into another environment and continued.

**What it is not.**

- Synthetic data only. Every name, figure and date is invented. No employer names, logos, internal tools or internal templates appear anywhere.
- No live connections. It does not call Jira, a portfolio system or any model.
- The agents are deterministic scripts that compute over the data and are labelled `Scripted agent`. Nothing here is a model output.
- No persistence. A page refresh returns to the seeded state. Approvals change in-app data only, standing in for a Jira write.
- No money and no headcount.

**The model it demonstrates.**

1. *A simplified delivery hierarchy with a book-of-record boundary.* Investment Request, then Initiative, Programme or Project (moderate and high activity-risk requests only; low risk takes the standalone route), then Technology Deliverable, then Outcome. The portfolio system is the book of record down to and including Outcome, and owns reported RAG at deliverable level and above. Jira holds the work below: Epic, story-level items and sub-tasks.
2. *One deliverable to many Epics.* Each Epic carries a Deliverable ID and belongs to exactly one deliverable. Story-level items carry an Outcome ID, and an outcome can draw work from several Epics of the same deliverable.
3. *Five lifecycle stages.* Ideation and Requirements; Design and Specifications; Risk, Control and Compliance Reviews; Build, Test and Validate; Delivery and Launch. Moves are allowed forward and back between neighbours. Each stage has an agent assist, a named human review and evidence it should leave behind. The reviews are illustrative and set in `lib/config/pdlc.ts`; they are not presented as any organisation's official gates.
4. *Three separate measures.* Work completion (closed points over total points), accepted outcomes (every mandatory acceptance criterion accepted by a named human, plus a business acceptance evidence record) and delivery readiness (`ready`, `not ready` or `unknown`, never a percentage). None is derived from another: 100% work completion does not make an outcome accepted, and accepted outcomes do not make a deliverable ready. Evidence-based RAG is computed from fourteen rules and is always shown beside the reported RAG, never in place of it.
5. *Governed agents.* An agent can never approve, accept an outcome or set readiness. Approval needs a named human who is not the item's assignee. The autonomy ceiling follows the work item's risk tier (T1 may auto-apply specifically allowed changes, T2 and T3 propose only, T4 is advisory only). Every run, proposal, approval and refusal is written to the audit trail. Reported RAG can never be changed by an agent or an approval.

**Architecture.**

```
app/ and components/   routes and client screens (Next.js App Router, static export)
lib/store              one in-memory store: reset, approvals, audit trail, demo clock
lib/engine             rollups, rule checks, evidence-based RAG, plan maths (pure functions)
lib/agents             agent definitions, runner, proposals, autonomy rules, ModelProvider seam
lib/data               DataSource interface: SyntheticSource now, a Jira source later
lib/config             terminology, thresholds, demo clock, estate figures, demo script
```

Stack: Next.js 16 (static export), React 19, TypeScript (strict), Tailwind 4, `d3-geo`, `d3-scale`, `d3-shape`, `topojson-client`, `world-atlas`, `motion` and `lucide-react`. Charts are hand-built SVG. All versions are pinned in `package-lock.json`.

## 3. Demonstration

Run it (section 4) and press **Start guided demo** in the top bar. The demo walks the eleven steps below. A slim bar docked at the bottom of the screen shows the point to make, what to do on the screen, and the time against the indicative time for the step. It collapses to a pill (Escape) and a step list lets you jump to any step. The script is data, in [`lib/config/demo-script.ts`](lib/config/demo-script.ts).

The story is carried by two synthetic deliverables:

- **TD-1001, "Counterparty exposure — stress scenario reconciliation"**, three Epics across two hubs, four outcomes. Reported Green; evidence-based Red. 82% work completion, 1 of 4 outcomes accepted, not ready: the reconciliation test is failing, control evidence is missing, a market-data dependency from a hub on another continent is nine days late, and the linked risk has had no update for 23 days.
- **TD-2001, "Limit-monitoring dashboard filters"**, a standalone low-risk deliverable that starts at Ideation and Requirements and is walked through the lifecycle.

| Step | Screen | Route | Point to make |
|---|---|---|---|
| 1 | Portfolio | `/` | Every number is computed from the underlying records, and in several places reported status and the evidence disagree. |
| 2 | Hierarchy | `/hierarchy` | The portfolio system owns everything down to Outcome; Jira owns the work below it; one deliverable can have several Epics. |
| 3 | Deliverable detail | `/deliverables/td-1001` | TD-1001 is reported Green with 82% of the work done, yet 1 of 4 outcomes is accepted and it is not ready to release. |
| 4 | Global | `/global#hero` | The market-data dependency for TD-1001 comes from a hub on another continent and is nine days late. |
| 5 | Plan | `/plan` | The late dependency pushes the forecast for TD-1001 past what the quarter has committed to. |
| 6 | Lifecycle | `/lifecycle` | The same portfolio sits across five lifecycle stages, with an agent assist and a named human review at each one. |
| 7 | PDLC workflow | `/lifecycle/td-2001` | TD-2001 moves forward only when a named person approves each review, and a failed test sends it back. |
| 8 | Agent centre | `/agents#run-raid-quality` | The agent only proposes; a named person approves, and the findings count drops everywhere the moment they do. |
| 9 | Deliverable detail | `/deliverables/td-1001#status` | The weekly status for TD-1001 is drafted from the records, and every sentence carries a citation you can open. |
| 10 | Blueprint | `/blueprint` | The target template makes the model repeatable: a Deliverable ID on every Epic and an Outcome ID on every story. |
| 11 | Pilot evidence | `/evidence` | What would be measured against a baseline, and the ask: authority to run the pilot. |

Indicative total: eight minutes. Starting the demo offers to reset first, so every run starts from the same state. **Reset demo** in the top bar ends the guided run and restores the seeded data.

Keyboard in the guided demo: Right, Page Down or N for next; Left, Page Up or P for previous; Escape collapses or expands the bar. Those plain keys act only when focus is on the page body or inside the demo bar, so the tree, tab and timeline widgets keep their arrow keys; from inside a widget use Alt+Right and Alt+Left. Nothing fires while focus is in a text field, select or text area. The state (running, step, collapsed) survives navigation and a reload in `sessionStorage`.

### Screen-by-screen guide

| Route | Screen | What it shows |
|---|---|---|
| `/` | Portfolio | Counts by hierarchy level, the three measures as portfolio figures, reported against evidence-based RAG, the list of status disagreements (each opens its deliverable), health by programme, stage distribution and data freshness. |
| `/hierarchy` | Hierarchy explorer | An expandable tree from Investment Request to story, a band marking the book-of-record boundary, standalone deliverables shown as a distinct route, activity risk per request. Full keyboard support. |
| `/deliverables/[id]` | Deliverable detail | Every deliverable has a page. The three measures side by side with the reasons behind readiness; Epics, outcomes with acceptance criteria and who accepted them, work by outcome, the evidence register, RAID, dependencies, findings, pod, and a drafted weekly status whose citations open the cited record. Hashes: `#status`, `#evidence`, `#outcomes`, `#work`, `#raid`, `#milestones`, `#pod`, `#why`. |
| `/plan` | Plan | A timeline following the hierarchy with year, quarter, month and sprint zoom, today line, milestones (regulatory ones distinct), forecast against plan and the knock-on effect of late dependencies. A side panel opens a deliverable. |
| `/global` | Global | A world map of 18 delivery hubs on six continents sized and coloured from the data, dependency arcs (late ones distinct), a hub panel, and a list view with the same information. `#hero` opens the focused dependency view. |
| `/lifecycle` | Lifecycle | The five stages as columns with two-way connectors, deliverables placed by stage, agents available per stage, review points, and the human and agent share of work per stage. |
| `/lifecycle/[id]` | PDLC workflow | One deliverable's run through the stages: run the stage agent, approve or return the review, simulate evidence arriving, accept criteria, move forward or back. Forward is disabled with the reason shown until the review is approved. The three measures update live. |
| `/agents` | Agent centre | A catalogue of nine scripted agents with stage, mode and autonomy ceiling; a run console that plays each step; an approval queue with before and after; governance refusals; an audit trail. Hashes such as `#run-raid-quality`, `#status-hero`, `#audit` preselect without running. |
| `/blueprint` | Template blueprint | The current templates beside the target template, issue types mapped to the hierarchy, the new fields, the many-Epics-to-one-deliverable pattern and rollout across the project estate. |
| `/evidence` | Pilot evidence | Baseline against assisted effort, exception counts and draft acceptance. Every figure is marked as a placeholder until measured. The pilot ask. |
| `/about` | About this build | What is computed, scripted, sample or planned, and how to plug in real data and a model. |

Every scripted, simulated, sample or placeholder element carries a provenance badge: `Sample data`, `Computed from data`, `Scripted agent`, `Portfolio system (reported)`, `Planned`, `Simulated evidence`.

## 4. Running locally

Requires Node 22.12 or later and npm.

```bash
npm install          # install the pinned versions from the lockfile
npm run dev          # development server on http://localhost:3000
npm run build        # static export to out/
npm start            # serve out/ on http://127.0.0.1:3000
```

Checks:

```bash
npm run typecheck    # Next route types, then tsc --noEmit (strict)
npm run lint         # ESLint
npm test             # Vitest: data, engine, agents, governance, store, config
npm run e2e          # builds, serves out/ on port 4173, runs the Playwright browser tests
```

- The application is fully static. It has no server code and makes no network request at build time or run time, to any host. The fonts are bundled from npm packages and the map geometry is embedded (`world-atlas`). The browser tests assert that no request leaves the machine.
- The browser tests use the Chromium that Playwright already has. Do not run `playwright install` on a restricted machine; if the browser is somewhere else, set `PW_CHROMIUM_PATH` to its executable (for example `/opt/pw-browsers/chromium`). They run at 1920 wide, and the route checks also run at 1366.
- The demo clock is fixed at 8 March 2027, so every screen shows the same thing on every run.

### What the browser tests cover (`e2e/`)

- Every route loads inside the shell with no console error, no failed request, no request leaving the machine and no horizontal overflow, at 1920 and 1366, including both dynamic routes for the two story deliverables and one other.
- Both themes on the portfolio screen, and the choice surviving a reload.
- The guided journey: start, all eleven steps by keyboard (and back), the keyboard rules, collapse, reload, reset.
- The main storyline (Green reported, Red by evidence, 82%, 1 of 4, Not ready) and a weekly status in which every sentence is cited, with a citation opening its record.
- Agent centre: run, approve, refusal as the item's assignee, and reset restoring the findings count, an empty queue and an empty audit trail.
- An approval in the Agent centre clearing a finding on a named deliverable's page, and reset bringing it back.
- The workflow walk-through to Ready, including the failing test and the move back, then reset.
- Plan zooms and side panel, the focused dependency view and list view on Global, and the three Epics under the main storyline deliverable on Hierarchy.

## 5. Project structure

```
app/                    routes (page.tsx per route), theme.css (all colours and fonts), globals.css
components/shell/       frame: navigation, top bar, theme switch, reset, provenance badge
components/ui/          shared primitives (see components/ui/README.md)
components/charts/      hand-built SVG charts
components/<screen>/    portfolio, hierarchy, deliverable, plan, global, lifecycle, workflow,
                        agents, blueprint, evidence, about
components/demo/        guided demo: top-bar control, docked overlay, state in sessionStorage
lib/config/             terminology.ts, story.ts, pdlc.ts, risk-tiers.ts, thresholds.ts, estate.ts,
                        blueprint.ts, routes.ts, clock.ts, demo-script.ts
lib/data/               source.ts (DataSource), synthetic/ (seeded generator)
lib/engine/             measures, readiness, rules R1 to R14, evidence-based RAG, plan maths
lib/agents/             nine scripted agents, governance, playback, ModelProvider (see its README)
lib/store/              store, selector hooks, actions, indexes
e2e/                    Playwright browser tests
scripts/                next wrapper (telemetry off, network guard), static file server
```

## 6. Extending it

[`CONTRACTS.md`](CONTRACTS.md) says how a screen plugs into the store, actions, terminology and theme. [`DESIGN.md`](DESIGN.md) section 8 lists the steps after import. In short:

1. **Internal names.** Copy `lib/config/terminology.local.fallback.ts` to `lib/config/terminology.local.ts` (git-ignored) and override only the labels you need: systems, templates, levels, statuses. Every label in the interface comes from `terms`, so nothing else changes. Restart the dev server after creating the file.
2. **Brand.** Set colours, fonts and the logo in `app/theme.css`. All colours are variables there; components use theme tokens only.
3. **Estate numbers.** Set the real figures in `lib/config/estate.ts` (blueprint rollout) and the template content in `lib/config/blueprint.ts`. Replace the placeholders on the Pilot evidence screen with the measured baseline.
4. **Real data.** Implement `JiraSource` against the `DataSource` interface in `lib/data/source.ts` (read-only first; the intended options are sketched there), and select it in `getDataSource()`. Screens read through the store and the engine, so they do not change.
5. **A model.** Implement a `ModelProvider` (see `lib/agents/provider.ts`) against the approved platform. It would take over the wording only; facts and citations stay computed. Return it from `activeProvider()` behind a configuration flag.
6. **Thresholds, rules and tiers.** `lib/config/thresholds.ts` (rule thresholds and severities), `risk-tiers.ts` (required evidence and autonomy per tier) and `pdlc.ts` (stages, reviews, evidence).
7. **The demo.** Edit `lib/config/demo-script.ts`. Text may use the tokens `{heroRef}`, `{heroTitle}`, `{flowRef}` and `{flowTitle}`, filled from the data; ids of the two story deliverables are in `lib/config/story.ts`.

## 7. Limitations

- Synthetic data. The numbers, names and dates carry no real information, and the portfolio is generated by a seeded script.
- Agents are scripted and deterministic. They show the shape of governed agent work, not model quality. Changing the data changes their output; nothing is learned.
- Approvals update the in-app store only. There is no write-back, no authentication and no role enforcement: the presenter acts as a named sample approver and can switch persona to show a refusal.
- No persistence. Reload returns to the seeded state; the guided-demo position is the only thing kept, per browser tab.
- Test results arrive through a labelled "simulate evidence arriving" control. Nothing is executed.
- The review roles and evidence requirements are illustrative, not an organisation's gates.
- The Pilot evidence figures are placeholders. The blueprint's estate numbers are round synthetic figures.
- Designed for a 1920-wide screen and checked at 1366. It is not built for phones or tablets.
- Next steps are the list in section 6: a read-only Jira source, an approved model provider, internal terminology and measured pilot figures.

## 8. Sharing status

Synthetic data and generic names only. It has not yet been reviewed for sharing: the owner should check it for ownership, confidentiality and employer-policy issues before it goes beyond the owner, and should search the whole folder for any internal name before import. See [`docs/sharing-guidelines.md`](../../docs/sharing-guidelines.md) in the repository root.
