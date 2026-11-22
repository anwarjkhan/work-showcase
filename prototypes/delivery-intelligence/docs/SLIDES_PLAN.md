# Slide extraction: build plan

**Status:** built. Section 14 lists where the build differs from this plan.
**Builder:** an Opus 5.5 coding agent working in the internal copy of this repository.
**Read first:** `../DESIGN.md`, `../CONTRACTS.md`, `../README.md` and `../lib/agents/README.md`. This plan adds one capability to the existing application. It changes no existing behaviour.

---

## 1. Goal

Let a user turn what the application already knows into editable PowerPoint slides, in two ways:

1. **Single slides.** From any screen, add one view to a slide basket: for example a deliverable's verdict, an outcome's acceptance criteria or the portfolio's status disagreements.
2. **End-to-end packs.** One click produces a complete, ordered deck for a chosen scope:

| Scope | Example | Typical reader |
|---|---|---|
| Outcome | OC-1001-2 | Delivery lead, acceptance owner |
| Technology Deliverable | TD-1001 | Programme manager, steering forum |
| Project | PJ-CCR-01 | Project board |
| Programme | Counterparty Credit Risk Modernisation | Programme board, Director |
| Portfolio | The whole book | Managing Director |

Every slide is built from the same data and engine results the screens show, so a slide and its screen never disagree.

### Not in scope

- Live connections to PTS, Jira or a model. Slides are built from whatever `DataSource` the app uses; that is synthetic until the Jira and PTS adapters exist.
- Screenshots of screens. Slides use native PowerPoint tables, charts, shapes and text so people can edit them. Screen captures are an optional later addition (section 11).
- A server. Everything runs in the browser, as the rest of the app does, and also from a Node command for batch use.
- Loading the firm's corporate `.potx` template. See section 7.

---

## 2. Design principles

1. **Three layers, kept apart.** *Extract* facts from the data and engine. *Compose* those facts into slide specifications. *Render* the specifications to `.pptx`. Each layer is pure and tested on its own.
2. **One slide specification, two renderers.** The same `SlideSpec` drives the PowerPoint file and an HTML preview inside the app, so what people preview is what they get.
3. **The app's rules carry into the slides.** Reported status always sits beside evidence-based status. The three measures stay separate. Readiness is never a percentage. A measure that cannot be computed says so. Agent output is labelled as scripted. Every slide carries its provenance.
4. **Deterministic.** The same state and clock always produce byte-identical specifications, so packs can be compared week to week.
5. **Built for real data later.** Extractors read only `PortfolioData`, `EngineResult` and the store's runs and drafts. When the Jira and PTS adapters replace synthetic data, packs work unchanged, and the footer switches from "Prototype · synthetic data" to the source systems and extraction time from `meta`.

---

## 3. Architecture

```
lib/slides/
  types.ts           SlideSpec, Block, PackDefinition, SlideKind, SlideScope
  catalogue.ts       every slide kind: id, title, scopes it accepts, builder
  extract/           pure functions: (data, result, state, scope) -> facts
    portfolio.ts
    node.ts          initiative, programme and project (PmNode)
    deliverable.ts
    outcome.ts
    common.ts        provenance, citations, record labels, formatting
  compose/
    slides/*.ts      one builder per slide kind: facts -> SlideSpec[]
    packs.ts         pack definitions per scope, ordering, toggles
    paginate.ts      split long tables and lists over continuation slides
  render/
    theme.ts         colours, fonts, sizes, master layout, footer rule
    pptx.ts          SlideSpec[] -> .pptx (PptxGenJS)
    html.tsx         SlideSpec -> React preview (screen and builder)
  index.ts           buildSlides(scope, kinds), buildPack(scope, options), exportPptx(specs)
scripts/slides.mjs   Node command: npm run slides -- --scope deliverable:td-1001
components/slides/   basket, "Add to slides" button, export-pack button, builder screen
app/slides/page.tsx  the slide builder route
```

### Key types (`lib/slides/types.ts`)

```ts
type SlideScope =
  | { kind: 'portfolio' }
  | { kind: 'pm-node'; pmNodeId: string }         // initiative, programme or project
  | { kind: 'deliverable'; deliverableId: string }
  | { kind: 'outcome'; outcomeId: string };

interface SlideSpec {
  id: string;                 // stable: `${kind}:${scope key}:${page}`
  kind: SlideKind;            // from the catalogue
  scope: SlideScope;
  title: string;              // a statement where the data supports one
  subtitle?: string;          // scope path, e.g. "IR-2027-001 › Counterparty Credit Risk Modernisation"
  layout: LayoutId;           // see section 6
  blocks: Block[];
  notes: string;              // speaker notes: talk track plus record keys cited
  citations: EntityRef[];     // records the slide rests on
  provenance: ProvenanceKind[];
  asOf: IsoDate;              // engine computedFor
  page?: { index: number; of: number }; // continuation slides
}

type Block =
  | { type: 'kpis'; items: { label: string; value: string; caption?: string; tone?: Tone }[] }
  | { type: 'rag-pair'; reported: Rag; evidence: Rag; reason?: string }
  | { type: 'measures'; work: MeasureView; accepted: MeasureView; readiness: ReadinessView }
  | { type: 'table'; columns: Column[]; rows: Cell[][]; maxRows: number }
  | { type: 'bar' | 'stacked-bar'; categories: string[]; series: Series[]; unit?: string }
  | { type: 'stage-rail'; stages: StageView[] }
  | { type: 'timeline'; window: { start: IsoDate; end: IsoDate }; rows: TimelineRow[] }
  | { type: 'bullets'; items: string[] }
  | { type: 'text'; text: string; emphasis?: 'statement' | 'body' | 'caption' }
  | { type: 'callout'; tone: Tone; text: string };
```

`Tone` uses the semantic statuses (red, amber, green, unknown), not colours. Every status the renderer draws carries its word as well as its colour.

### Where the facts come from

| Need | Source in the app |
|---|---|
| Measures per deliverable and outcome | `EngineResult.deliverables`, `EngineResult.outcomes` |
| Evidence-based status and reasons | `EngineResult.deliverableRag`, `EngineResult.pmNodeRag` |
| Roll-ups for projects, programmes and requests | `computeHierarchyRollups`, `rollupMeasures` |
| Disagreements | `statusDisagreements` |
| Findings | `EngineResult.findings` |
| Plan, forecasts and knock-on | `EngineResult.plan`, `computePlanExtras`, `forecastEnd` |
| Portfolio totals | `EngineResult.portfolio` |
| Records (outcomes, criteria, evidence, RAID, dependencies, milestones, pods) | `PortfolioData` via `indexPortfolio` |
| PDLC state | `PortfolioData.pdlcRuns`, `describeWorkflow()` |
| Status narrative | the latest `StatusDraft` for the scope, or a fresh scripted run |
| Labels and system names | `terms` from `lib/config/terminology` |
| Record names in text | the human key or ref, never an internal id (same rule as `lib/agents/wording.test.ts`) |

Extractors call existing engine helpers. They never recompute a measure.

---

## 4. Slide catalogue

Each kind is one entry in `lib/slides/catalogue.ts`, with the scopes it accepts. A kind can appear as a single slide or inside a pack.

### Common

| Id | Slide | Content |
|---|---|---|
| `cover` | Cover | Scope name and path, as-at date, data source, prototype marker when synthetic |
| `contents` | Contents | Section titles of the pack |
| `how-to-read` | How to read these measures | Work completion, accepted outcomes and readiness defined; reported against evidence-based; what "not computable" means |
| `decisions` | Decisions and next steps | Editable placeholders; prefilled from the highest-severity findings where they name an action |
| `record-index` | Records cited | Appendix table of every record key cited in the pack, with its system (PTS or Jira) |

### Portfolio

| Id | Slide | Content |
|---|---|---|
| `portfolio-headline` | Status disagreements | The disagreement count and sentence, beside the three portfolio measures |
| `portfolio-rag` | Reported against evidence | Two aligned stacked bars and counts |
| `portfolio-disagreements` | Where reported status and evidence disagree | Table: deliverable, programme, RAG pair, top reason, work %, accepted, readiness |
| `portfolio-programmes` | Health by programme | Table: programme, RAG pair, rolled-up measures |
| `portfolio-stages` | Work across the lifecycle | Deliverables per PDLC stage; human and agent share of work |
| `portfolio-findings` | Data-quality findings | Findings per rule, most severe first |
| `portfolio-quarter` | This quarter's commitments | Due, forecast to slip, regulatory milestones at risk, knock-on list |
| `portfolio-hubs` | Where the work sits | Work and health per region; late cross-hub dependencies |
| `portfolio-brief` | Executive brief | The executive-briefing agent's draft, labelled scripted |

### Programme, project or initiative

| Id | Slide | Content |
|---|---|---|
| `node-overview` | Overview | Path, child counts, rolled-up RAG pair and measures, standalone or formal route |
| `node-deliverables` | Deliverables | Table of every deliverable beneath it: RAG pair, three measures, stage, forecast end |
| `node-plan` | Plan and milestones | Simplified timeline of child deliverables, milestones, regulatory flags, knock-on |
| `node-risks` | Risks, issues and dependencies | RAID and dependencies across children; top findings |
| `node-disagreements` | Disagreements | Children reported differently from their evidence |

### Technology Deliverable

| Id | Slide | Content |
|---|---|---|
| `td-verdict` | Verdict | RAG pair, the verdict sentence, the three measures |
| `td-readiness` | Readiness evidence | Required kinds for its risk tier against held, failing, missing and stale |
| `td-outcomes` | Outcomes | Weight, due, reported status beside acceptance, work %, gaps flagged |
| `td-findings` | Why the evidence says this | Findings, most severe first, with record keys |
| `td-plan` | Plan | Planned against forecast, milestones, dependency knock-on |
| `td-raid` | Risks, issues and dependencies | RAID with age and owner; inbound and outbound dependencies with days late |
| `td-pdlc` | Lifecycle position | Stage rail with reviews, reviewers and evidence per stage; any moves back |
| `td-pod` | Pod | People and agent identities; human and agent share of work |
| `td-jira-map` | How it maps to Jira | Portfolio record above the boundary; its Epics, Deliverable ID and Outcome ID below |
| `td-status` | Weekly status | The status-reporting agent's draft, every sentence with numbered citations; citations listed in notes |

### Outcome

| Id | Slide | Content |
|---|---|---|
| `outcome-summary` | Outcome | Reported status beside acceptance state, weight, due date, owner, work completion |
| `outcome-criteria` | Acceptance | Criteria with mandatory flag, state, who accepted and when; business acceptance record |
| `outcome-work` | Work carrying this outcome | Story-level items by Epic; open items; missing reviewer flags |
| `outcome-evidence` | Evidence | Evidence linked to the outcome, result, date and staleness |

---

## 5. Packs

Defined in `lib/slides/compose/packs.ts` as ordered lists of kinds with options.

| Pack | Slides, in order | Options |
|---|---|---|
| Outcome | cover, outcome-summary, outcome-criteria, outcome-work, outcome-evidence, how-to-read, record-index | |
| Technology Deliverable | cover, contents, td-verdict, td-readiness, td-outcomes, td-findings, td-plan, td-raid, td-pdlc, td-pod, td-jira-map, td-status, decisions, how-to-read, record-index | Include an outcome summary per outcome; include or omit the status draft |
| Project | cover, contents, node-overview, node-deliverables, node-disagreements, node-plan, node-risks, decisions, how-to-read, record-index | Append the td-verdict slide for each deliverable |
| Programme | as Project, plus a projects table on node-overview | Append verdicts for disagreeing deliverables only, or for all |
| Portfolio | cover, contents, portfolio-headline, portfolio-rag, portfolio-disagreements, portfolio-programmes, portfolio-quarter, portfolio-stages, portfolio-hubs, portfolio-findings, portfolio-brief, decisions, how-to-read, record-index | Omit the agent brief; limit tables to the top N rows |

An investment-request pack can follow the Programme pattern later.

---

## 6. Layout and rendering

### Library

Use **PptxGenJS 4.0.1** in the browser and in Node. It writes native tables, charts, shapes and speaker notes, and saves through a download in the browser or a buffer in Node. Its dependencies are `jszip`, `image-size` and a stub package named `https`.

Before starting, check that the internal package mirror approves these. If it does not, the fallback is to write the Office Open XML parts directly with `jszip`, which is more work and should be raised before building.

Pin the exact version. The renderer must never pass a URL to the library, so no network request is possible.

### Layouts

Fixed 16:9 layouts in `render/theme.ts`, each a set of named regions in inches:
`title-only`, `statement`, `kpis-over-table`, `two-column`, `table`, `chart-and-table`, `rail`, `timeline`, `document` (for status and brief drafts).

Each slide builder picks a layout and fills its regions. The renderer never places content outside a region.

### Text fitting

PowerPoint does not measure text for us, so the composer enforces limits:
- **Tables:** at most 10 body rows per slide. Longer tables continue on further slides titled "(continued, 2 of 3)", repeating the header row.
- **Cells and bullets:** set character limits per column. Longer text is shortened with an ellipsis, and the full text goes into the speaker notes.
- **Titles:** at most 70 characters. Statement titles are generated from the data, for example "TD-1001 is reported Green; the evidence says Red".
- **Fonts:** body no smaller than 12 pt, table text no smaller than 11 pt, titles 24 to 28 pt.

### Theme and master

- Colours come from the light-theme values in `app/theme.css`, copied into `theme.ts` as hex, with a test that the two stay in step.
- Status colours are always paired with their word and shape.
- Fonts default to Arial for body and headings, because recipients may not have the app's web fonts. Both are set in `theme.ts`.
- One slide master carries the footer: source and as-at date on the left, slide number on the right. With synthetic data the footer reads "Prototype · synthetic data · as at 8 Mar 2027". The renderer adds it to every slide; builders cannot remove it.
- A logo slot is left empty, for brand assets to be added inside the firm.

### Speaker notes

Every slide gets notes: one or two sentences to say, then "Records:" and the record keys cited. Status and brief slides list their numbered citations in full.

---

## 7. The corporate template

PptxGenJS cannot open an existing `.potx` or `.pptx` template. Options, in order of effort:

1. **Match the brand in `theme.ts`** (colours, fonts, footer, logo), which is the default in this plan. This looks close but is not the official master.
2. **Paste into the corporate template.** Open the generated deck, select all slides, and paste into a file built on the corporate template using "Use destination theme". Fonts and colours that use theme slots follow the template. To make this work, `theme.ts` should map colours to PowerPoint theme slots where PptxGenJS allows it.
3. **Later: a template-based renderer.** A small internal service using a library that fills a real template, for example python-pptx. It would need a server and an approval of its own, so it is out of scope here.

Decide which of these the first internal showing needs before building section 6.

---

## 8. User interface

1. **"Add to slides"** is a small icon button, built once in `components/slides/AddToSlides.tsx` with `kind` and `scope` props. It goes on:
   - portfolio: headline band, RAG card, disagreements list, programme table, stage card, findings card;
   - hierarchy: each programme, project and deliverable row;
   - deliverable detail: verdict header, readiness row, each tab, status section;
   - outcome rows on the Outcomes tab;
   - plan summary strip; global region strip; lifecycle board.

   When pressed it adds the slide to the basket and says "Added to slides (4)".
2. **The slide basket** is a top-bar control showing a count, with a drawer that lists collected slides as small previews. In the drawer people can reorder by drag or arrow buttons, remove slides, name the deck, and export it. The basket persists in session storage, like the guided demo, and is cleared by Reset demo.
3. **"Export pack"** buttons sit on the deliverable detail header, on each outcome row, on programme and project rows in the hierarchy explorer, and on the portfolio screen. Each opens a small dialog with the pack's options and an Export button.
4. **The slide builder** (`/slides`, a new route in the navigation):
   - choose a scope type and an entity, with search;
   - choose a pack or tick individual slide kinds the scope accepts;
   - see a live grid of previews rendered by `render/html.tsx`;
   - reorder, set options, then export.

   It also accepts `#scope=deliverable:td-1001` style hashes so other screens and the guided demo can link to it.
5. **Feedback:** export shows progress for large packs. When it finishes it shows a confirmation with the file name and slide count. If it fails, it shows the reason.

The guided demo can gain one optional step showing the builder exporting the TD-1001 pack.

---

## 9. Guardrails (enforced in code and tests)

- Reported and evidence-based status appear together wherever either appears.
- The three measures are never merged or averaged. Readiness is never shown as a percentage.
- "Not computable" is shown in words with its reason, never as 0.
- Agent drafts are labelled "Scripted agent draft" on the slide.
- The Pilot evidence screen's placeholder figures can never be exported. Their kinds are not in the catalogue.
- No user-visible text contains an internal id or the word "hero".
- The provenance footer is on every slide and cannot be turned off.
- Exported files are named `<scope ref>-<pack>-<as-at date>.pptx`, for example `TD-1001-deliverable-pack-2027-03-08.pptx`.

---

## 10. Testing

| Level | What | How |
|---|---|---|
| Unit: extract | Each extractor on the synthetic portfolio | TD-1001 facts give 82%, 1 of 4, not ready, reported Green, evidence Red. OC-1001-2 is reported on track and not accepted. Programme roll-ups equal `computeHierarchyRollups` |
| Unit: compose | Every slide kind for every scope it accepts | Specs validate against the types. Long tables paginate with repeated headers. Character limits hold. Notes and citations are present |
| Unit: determinism | Same state gives deeply equal specs | Snapshot of the TD-1001 pack specification |
| Unit: wording | No internal ids, no "hero", provenance footer present | Reuse the pattern in `lib/agents/wording.test.ts` |
| File structure | Generated `.pptx` in Node | Open with `jszip`. Check slide count, a notes part per slide, footer text on every slide, valid XML in every part, and no external relationships (no URLs) |
| Visual | Look at the slides | Where LibreOffice is available, convert to PDF headless and render pages to images for review. Otherwise open in PowerPoint and check each layout once |
| End to end | Playwright | Export the TD-1001 pack from the deliverable page and capture the download. Add three slides from three screens to the basket, reorder, export, and check the count and order. Exercise the builder route |

The existing suites (unit, type check, lint, build, browser tests) must still pass.

---

## 11. Optional later additions

- **Screen images.** A slide kind that embeds a capture of a screen, such as the global map or the plan timeline, for where a native chart would lose too much. Capture happens in the Node command with Playwright, because the browser app cannot screenshot itself. Mark such images "picture of the application".
- **Scheduled packs.** Run `npm run slides` weekly against the live data source and save packs for comparison.
- **Template-based renderer** (section 7, option 3).
- **PDF export** of the same specifications through the HTML preview and the browser's print to PDF in the Node command.

---

## 12. Deliverables

| # | Deliverable | Files | Acceptance |
|---|---|---|---|
| S1 | Slide model and catalogue | `lib/slides/types.ts`, `catalogue.ts` | Every kind in section 4 is registered with its scopes. Types cover every block in section 3 |
| S2 | Extractors | `lib/slides/extract/*` | Facts for all four scope types. Unit tests in section 10 pass. No measure recomputed |
| S3 | Slide builders, packs and pagination | `lib/slides/compose/*` | Every kind builds for every accepted scope. Five packs per section 5. Pagination and limits per section 6 |
| S4 | PowerPoint renderer and theme | `lib/slides/render/theme.ts`, `pptx.ts`, `scripts/slides.mjs` | File-structure tests pass. Footer on every slide. Notes on every slide. `npm run slides -- --scope <scope> [--pack <pack>]` writes a file |
| S5 | HTML preview | `lib/slides/render/html.tsx` | Renders every layout from the same spec, in both app themes |
| S6 | Interface | `components/slides/*`, `app/slides/page.tsx`; small additions to the screens in section 8; navigation entry | All controls in section 8 work by keyboard. Basket survives navigation. Reset clears it |
| S7 | Tests and documentation | `lib/slides/**/*.test.ts`, `e2e/slides.spec.ts`, a section in `README.md` | Section 10 complete. README explains packs, single slides and the Node command |

**Order:** S1 first. Then S2, S4 and S5 together, since they share only the types. Then S3. Then S6. Then S7.

**Shared files this touches:** `package.json` and the lockfile (the new dependency and the `slides` script), the shell's top bar (the basket control), `lib/config/routes.ts` (the new route), and the screens listed in section 8 (one button each). Keep each change minimal.

**Done means:** type check, lint, all unit tests, build and browser tests pass. The TD-1001, programme and portfolio packs have been opened in PowerPoint and read slide by slide.

---

## 13. Questions for the owner before building

1. Which packs come first? The recommendation is the Technology Deliverable and Programme packs, because they serve the next MD conversation.
2. Must the first showing use the official corporate template (section 7, option 3), or is a matched look acceptable?
3. Should agent-drafted narrative (weekly status, executive brief) go into packs by default, or only when chosen?
4. Is PptxGenJS approved on the internal mirror?
5. Should packs show internal system and template names? They will, automatically, if `lib/config/terminology.local.ts` is in place.

---

## 14. Where the build differs from this plan

- **Timelines** hold 6 rows under a row of headline figures and 10 on a slide of their own, not 12; longer timelines continue on further slides.
- **Titles** aim at 55 characters on first pages (70 is the hard cap), because 70 does not fit one line at 26 pt.
- **Column widths** are set in inches by `compose/columns.ts` so headers never break mid-word. To fit, the deliverable RAID slide lists open and mitigating items only (closed ones go to the notes), and the project and programme risk slide puts its top findings in the notes.
- **Roll-up readiness** ("8 of 26 ready") is a neutral count, not a status colour; a single deliverable's readiness keeps its state.
- **Verdicts appended to project and programme packs** are off by default (an export option).
- **The records-cited appendix** is never capped by the top-N option.
- **New terminology groups** for slide words: `outcomeStatus`, `acceptance`, `raidStatus`, `pdlcStageStatus`, `reviewStates`, `milestones`.
- **The Node command** takes a project or programme as `pm-node:<record id>`, for example `npm run slides -- --scope pm-node:pm-ccr`; `programme:`, `project:` and `initiative:` prefixes are also accepted.
- **The deliverable tabs** share one "Add to slides" button that follows the active tab; the Work and Evidence tabs have no slide kind.
- **`jszip`** is declared as a pinned development dependency because the browser tests open exported files with it.
- **Checked in LibreOffice, not PowerPoint.** Open the deliverable, programme and portfolio packs in PowerPoint once inside the firm.
