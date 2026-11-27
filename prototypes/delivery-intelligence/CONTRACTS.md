# Contracts for deliverables D2 to D16

Read with `DESIGN.md` (sections 4 to 6). This file says how to plug into the foundation built in D1. Paths are relative to this folder.

## 1. Ownership

- You own only the files listed for your deliverable in `DESIGN.md` section 6. Everything else is read-only for you.
- D1 owns, and you must not edit: `package.json` and lockfile, all root config files, `app/layout.tsx`, `app/theme.css`, `app/globals.css`, `components/shell/*`, `lib/types.ts`, `lib/config/*` (except `blueprint.ts` for D11 and `demo-script.ts` for D14), `lib/store/*` (except `actions.ts` for D5), `lib/data/source.ts`, `scripts/*`.
- Need a new type, label or dependency? Do not add it. Define a local type in your own folder, or raise it with the lead.
- New components go in your own folder: `components/<area>/`. Shared primitives come from D4 in `components/ui/*` and `components/charts/*`.

## 2. Stubs and who replaces them

| File | Stub today | Replaced by | Contract to keep |
|---|---|---|---|
| `lib/data/synthetic/index.ts` | 3 hand-written deliverables | D2 (whole folder) | `export const DEFAULT_SEED: number` and `export function createSyntheticPortfolio(seed?: number): PortfolioData`. Use the ids in `lib/config/story.ts`. Set `meta.sourceKind: 'synthetic'`. Seed `pdlcRuns` (helper: `createPdlcRun` in `lib/config/pdlc.ts`). |
| `lib/engine/index.ts` | empty-but-valid result | D3 | `export function computeAll(data: PortfolioData, clock: DemoClock): EngineResult`, pure. Export other helpers (plan windows, PDLC transition checks) from here too. |
| `lib/store/actions.ts` | every action returns `{ ok: false }` | D5 | Keep the `DemoActions` interface and `createDemoActions(store)`. Mutate only through `DemoStoreApi`. |
| `components/demo/index.tsx` | `DemoControl`, `DemoOverlay` render nothing | D14 | Keep both named exports, no props. `DemoControl` sits in the top bar (about 36px high, up to 320px wide); `DemoOverlay` is rendered once at the end of the shell, use `position: fixed`. |
| `app/**/page.tsx` | `RoutePlaceholder` | screen owner (see `builtBy` in `lib/config/routes.ts`) | Keep the page pattern in section 6. |
| `e2e/smoke.spec.ts` | one smoke test | D14 | Free to rewrite. |

## 3. Types

All shared types are in `lib/types.ts`. Key conventions:

- Ids are strings. Work items use their Jira key as id (`EntityRef { kind: 'work-item', id: 'CCR-101' }`).
- Dates: `IsoDate` = `"2027-03-08"`, `IsoDateTime` = full ISO with `Z`. Use helpers in `lib/config/clock.ts` (`daysBetween`, `addDays`, `formatDate`). Never use `new Date()` for business logic; the clock is `DEMO_CLOCK` (2027-03-08).
- Enumerations are kebab-case unions (`'not-ready'`, `'test-result'`). Turn them into words with `terms` (section 5), never by string manipulation.
- Measures that may not be computable are `Computable<T>`: check `m.computable` before reading `m.value`; otherwise show `terms.measures.notComputable` and `m.detail`.
- `Dependency`: `from` provides, `to` receives (needs it by `needBy`).
- `Outcome.reportedStatus` stands in for the design's `reportedOnTrack`: on track means `'on-track'` or `'complete'`.
- `TechDeliverable.coreTeam` holds the deliverable's Core Four: `Partial<Record<CoreRole, { personId, joinedAt }>>` for `'product-manager' | 'tech-lead' | 'risk-lead' | 'ux-lead'` (a missing key is a gap, flagged by rule R15; a late `joinedAt` by R16). Every PDLC review (`ReviewRoleId` = `CoreRole`) is decided only by the holder of that role, in the stage's order, the Product Manager's gate decision last at every stage (`checkReviewDecision` in `lib/agents/governance.ts`); one person may not hold two core roles on a deliverable. Each outcome's `acceptanceOwnerId` is its deliverable's Product Manager. `PortfolioData.pdlcRuns` holds each deliverable's workflow state. D5 keeps `TechDeliverable.pdlcStage` in step with `PdlcRun.currentStage`.
- `EditableFields` lists every field an approved proposal may change. Reported RAG is deliberately absent.

## 4. Reading state

There is one client-side store, mounted in `app/layout.tsx`. All hooks are in `@/lib/store` and work only in client components (`'use client'`).

```tsx
'use client';
import { useDeliverable, useDeliverableMeasures, useDeliverableRag, useFindings } from '@/lib/store';

export function MeasuresRow({ id }: { id: string }) {
  const deliverable = useDeliverable(id);           // TechDeliverable | undefined
  const measures = useDeliverableMeasures(id);      // workCompletion, acceptedOutcomes, readiness
  const rag = useDeliverableRag(id);                // reported vs evidence, reasons
  const findings = useFindings({ deliverableId: id });
  if (!deliverable || !measures) return null;
  // ...
}
```

| Hook | Returns |
|---|---|
| `usePortfolioData()` | current `PortfolioData` (after approvals and workflow actions) |
| `usePortfolioIndex()` | `Map` lookups by id (`deliverables`, `people`, `workItems` by key, `outcomesByDeliverable`, `criteriaByOutcome`, `workItemsByEpic`, `evidenceByDeliverable`, `pdlcRunsByDeliverable`, ...) |
| `useEngineResult()` | full `EngineResult` (`portfolio`, `plan`, `findings`, per-id records) |
| `useDeliverable(id)`, `useDeliverableMeasures(id)`, `useDeliverableRag(id)`, `useOutcomeMeasures(id)`, `usePdlcRun(deliverableId)` | one record, or `undefined` |
| `useFindings({ deliverableId?, ruleId?, severity? })` | filtered findings |
| `useAgentRuns()`, `useAgentRun(runId)`, `useProposals()`, `useProposalsByStatus(status)`, `useApprovals()` | agent and governance records |
| `useStatusDrafts()`, `useLatestDraft(deliverableId \| null, kind?)` | drafts with cited sentences |
| `useAuditTrail()` | audit events, oldest first |
| `useClock()`, `useActingAs()`, `useRevision()` | demo clock, presenter's person id, change counter |
| `useDemoState(selector, isEqual?)` | any custom slice. If the selector builds a new array or object, pass `shallowEqual` or derive with `useMemo` |

Outside React (engine, agents, tests), use `indexPortfolio(data)` from `@/lib/store/indexes` and `createDemoStore()` from `@/lib/store/store`.

## 5. Dispatching actions

```tsx
const actions = useDemoActions();
const actingAs = useActingAs();
const result = actions.approveProposal(proposalId, actingAs);
if (!result.ok) showReason(result.reason);   // governance refusals are results, not exceptions
```

Actions: `startAgentRun`, `approveProposal`, `rejectProposal`, `runStageAgent`, `approveReview` and `returnReview` (by the core role holder; `describeWorkflow(data, results, id, actingAs).nextReview` gives the one-click step and whether to switch persona first), `recordEvidence` (`simulated: true` for "Simulate evidence arriving"), `acceptCriterion`, `rejectCriterion`, `moveStage`, `setActingAs`. Signatures and rules are in `lib/store/actions.ts`. Reset is `useResetDemo()`; the shell already has the button.

For D5: write through `DemoStoreApi` only. `setState`/`updateData` re-run the engine when `data` changes. Use `store.nextId(prefix)` and `store.now()` for ids and timestamps (deterministic, reset by `reset()`), and `store.appendAudit({...})` for every action.

## 6. Pages

The top bar renders the page title as the page's `<h1>`. Start your content with `<h2>` sections, and do not add outer padding: the shell supplies the gutter and a maximum width.

Static route (`app/plan/page.tsx`):

```tsx
import { routeMetadata } from '@/components/shell/metadata';
import { PlanScreen } from '@/components/plan/PlanScreen';   // 'use client'

export const metadata = routeMetadata('plan');
export default function Page() {
  return <PlanScreen />;
}
```

Dynamic route (`app/deliverables/[id]/page.tsx`, the same for `app/lifecycle/[id]/page.tsx`). The page stays a server component so `generateStaticParams` works with the static export:

```tsx
import { routeMetadata } from '@/components/shell/metadata';
import { deliverableStaticParams } from '@/lib/data/source';
import { DeliverableScreen } from '@/components/deliverable/DeliverableScreen';   // 'use client'

export const metadata = routeMetadata('deliverable');
export const dynamicParams = false;
export function generateStaticParams() {
  return deliverableStaticParams();
}
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DeliverableScreen id={id} />;
}
```

- Links: use `next/link`, and `hrefs.deliverable(id)` and `hrefs.workflow(id)` from `@/lib/config/routes`.
- To refine the top bar, call `usePageMeta({ title?, subtitle?, provenance? })` or render `<PageMeta ... />` from `@/components/shell`. By default the top bar shows the route's title and provenance from `lib/config/routes.ts`.

## 7. Terminology and provenance

- Every label for a system, template, tool, level or status comes from `terms` in `@/lib/config/terminology`: for example `terms.systems['portfolio-system']`, `terms.templates.rapid`, `terms.readiness['not-ready']`, `terms.evidenceKinds['test-result']`, `terms.coreRoles['risk-lead']` (short forms in `terms.coreRolesShort`). Never type a system or template name in a component.
- Inside the firm, create the git-ignored `lib/config/terminology.local.ts` (template: `terminology.local.fallback.ts`). The build uses it automatically when it exists.
- Provenance: `<ProvenanceBadge kind="computed" />` or `<ProvenanceBadges kinds={['scripted-agent', 'simulated']} size="sm" />` from `@/components/shell`. Kinds: `sample`, `computed`, `scripted-agent`, `reported`, `planned`, `simulated`. Every figure that is scripted, simulated or a placeholder must carry its badge.
- Other config: `PDLC_STAGES` (each stage's `reviews` in order, with `confirms` and `evidenceBefore` per role), `CORE_ROLES`, `GATE_ROLE`, `reviewConfirmation` and `neighbourStage` (`pdlc.ts`), `RISK_TIER_POLICIES` (required evidence and autonomy per tier, in `risk-tiers.ts`), `RULE_THRESHOLDS`, `RULE_SEVERITY` and `CORE_TEAM_SEVERITY` (`thresholds.ts`; rules R1 to R16), `ESTATE` (`estate.ts`), `ROUTES` (`routes.ts`), `HERO_DELIVERABLE_ID` and `WORKFLOW_DELIVERABLE_ID` (`story.ts`).

## 8. Theme tokens

Use Tailwind utilities. They map to `--di-*` variables in `app/theme.css`. Tailwind's default palette is switched off, so `bg-blue-500` does not exist. Both themes come from the same tokens; never branch on the theme in code. For SVG, use `fill-*` and `stroke-*` utilities or `var(--di-…)`.

| Utility | Use for |
|---|---|
| `bg-canvas`, `bg-surface`, `bg-surface-2`, `bg-inset` | page background, cards, raised or alternate rows, wells and tracks |
| `border-line`, `border-line-strong` | thin card outlines and dividers, stronger separators and inputs |
| `text-fg`, `text-fg-muted`, `text-fg-subtle` | body text, secondary text, captions and axis labels |
| `text-title`, `text-heading` | page or hero titles; section headings (bright blue) |
| `bg-accent`, `text-accent`, `bg-accent-soft`, `border-accent-line`, `text-on-accent` | interactive elements, selection and links. Never use these for status |
| `{bg,text,border}-status-{red,amber,green,unknown}` plus `-soft`, `-fg`, `-line` | RAG, readiness and severity. Base colour for marks, `-soft` for fills, `-fg` for text on `-soft`. Always add text or shape as well |
| `text-prov-*`, `bg-prov-*-soft` | provenance (already handled by the badge) |
| `chart-1` to `chart-6`, `chart-grid`, `chart-axis` | categorical series and chart furniture |
| `map-water`, `map-land`, `map-land-line`, `map-graticule`, `map-arc` | the Global map |
| `bg-hover`, `bg-selected`, `bg-overlay` | row hover, selected row, drawer or modal scrim |
| `font-sans`, `font-display`, `font-mono` | body, headings and large figures, ids and keys |
| `rounded-xs` to `rounded-2xl`, `rounded-pill`; `shadow-card`, `shadow-raised`, `shadow-overlay`, `shadow-focus` | shape and elevation |
| `.di-card`, `.di-eyebrow`, `.di-skeleton` | thin outlined card, small uppercase label, loading block |

Layout variables: `--di-nav-width`, `--di-topbar-height`, `--di-gutter`, `--di-content-max`. Motion: `--di-ease-standard`, `--di-ease-emphasis`, `--di-duration-{fast,base,slow}`. Reduced motion is honoured globally. Design for 1920 wide and check at 1366.

## 9. Commands

| Command | Does |
|---|---|
| `npm install` | install the pinned versions from the lockfile |
| `npm run dev` | dev server on http://localhost:3000, with no outbound network |
| `npm run build` | static export to `out/` |
| `npm start` | serve `out/` on http://127.0.0.1:3000 |
| `npm run typecheck` | generate Next route types, then `tsc --noEmit` (strict) |
| `npm run lint` | ESLint (Next core-web-vitals and TypeScript rules) |
| `npm test` | Vitest (`**/*.test.ts(x)`, Node environment; add `// @vitest-environment jsdom` per file for DOM tests) |
| `npm run e2e` | build, serve `out/` on port 4173, run Playwright in `e2e/` (Chromium, 1920×1080) |

Never run `playwright install`. If Playwright cannot find a browser, set `PW_CHROMIUM_PATH`.
