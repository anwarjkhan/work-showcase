# Interface primitives (D4)

Import from `@/components/ui` and `@/components/charts`. Everything reads colours from theme tokens, so it works in both themes. Each component has a usage example in its JSDoc. Provenance badges stay in `@/components/shell` (`ProvenanceBadge`).

## Page layout conventions

| Topic | Rule |
|---|---|
| Spacing scale | Sections on a page: `flex flex-col gap-8` (32px). Cards in a grid: `grid gap-4` (16px). Inside a card: `gap-3` or `gap-4`. Components never add outer margins. |
| Headings | Top bar owns `h1`. Page sections use `<Section>` or `<SectionHeading>` (h2, bright blue). Card titles are h3 (`level` prop for h4). Never skip a level. |
| Cards | `<Card>` for any grouped content. Tables and full-width charts use `padding="none"` or `DataTable` (which is its own framed card). Put provenance in the `footer` or `actions`. |
| Grids | `grid-cols-1 md:grid-cols-2 xl:grid-cols-4` for tiles. Check 1366 wide: 4 tiles in a row still fit. |
| Status | Always `RagPill`, `RagPair`, `ReadinessPill`, `SeverityBadge`; never colour a bare dot. Labels come from `terms`. |
| Measures | Always the three together with `MeasureTriple`; never a percentage for readiness. |
| Figures | Numbers align via tabular figures (built in). Use `fmt` from `@/components/charts` for formatting. |
| Disabled actions | Prefer `disabledReason` on `Button` so the reason is visible on hover and focus. |
| Charts | Charts fill their container's width; give the parent a width (grid cell, `w-24`). |

## Components (`components/ui`)

| Component | Key props |
|---|---|
| `Card` | `eyebrow`, `title`, `description`, `actions`, `footer`, `level` (2-4, default 3), `padding` (`md`/`sm`/`none`), `selected` |
| `Section` | `title`, `eyebrow`, `description`, `actions`, `id`; heading plus content, 16px apart |
| `SectionHeading` | same as `Section`, no children; `level` 2 or 3 |
| `StatTile` | `label`, `value`, `unit`, `delta {value, direction, sentiment, context}`, `caption`, `spark`, `provenance`, `icon`, `href`, `onClick` |
| `RagPill` | `status` (`red`/`amber`/`green`/`unknown`), `size` (`sm`/`md`/`lg`) |
| `RagPair` | `reported`, `evidence`, `disagrees?` (computed if omitted), `layout` (`inline`/`stacked`), `size` |
| `ReadinessPill` | `state` (`ready`/`not-ready`/`unknown`), `size` |
| `SeverityBadge` | `severity` (`critical`/`high`/`medium`/`low`), `size` |
| `Badge` | `tone` (`neutral`/`accent`/`red`/`amber`/`green`/`unknown`), `size`, `icon`, `dashed` |
| `Chip` | `selected`, `onClick`, `onRemove`, `icon` (toggle button for filters) |
| `MeasureTriple` | `workCompletion`, `acceptedOutcomes` (both `Computable`), `readiness` (`ReadinessAssessment`), `plannedPercent`, `compact`, `bare` |
| `ProgressBar` | `value` (0-100 or `null`), `target`, `targetLabel`, `tone`, `size`, `ariaLabel` (required) |
| `Tabs` + `TabPanel` | `items [{id,label,count,icon,disabledReason}]`, `value`, `onChange`, `variant` (`underline`/`segmented`), `ariaLabel`; panels as children |
| `Drawer` | `open`, `onClose`, `title`, `eyebrow`, `footer`, `width` (`md`/`lg`/`xl`) |
| `Tooltip` | `content`, `side`, `delay`; wraps one element |
| `DataTable<T>` | `columns [{id,header,cell,accessor,numeric,align,minWidth,sortable}]`, `rows`, `getRowId`, `onRowClick`, `selectedId`, `defaultSort`, `maxHeight`, `dense`, `stickyFirstColumn`, `empty`, `ariaLabel` |
| `EmptyState` | `title`, `description`, `icon`, `action`, `variant` (`boxed`/`inline`) |
| `Button` | `variant` (`primary`/`secondary`/`ghost`/`danger`), `size`, `icon`, `iconRight`, `loading`, `disabledReason` |
| `IconButton` | `label` (required), `icon`, `variant`, `size`, `disabledReason` |
| `Avatar` | person: `initials`, `name`; agent: `kind="agent"`, `name` (handle); `size` (`xs`-`lg`) |
| `AvatarLabel`, `AvatarStack` | avatar plus name and `detail`; overlapping avatars with `max` |
| `KeyValue` | `items [{label,value,hint,mono}]`, `layout` (`stacked`/`inline`), `columns` |
| `Timeline` | `steps [{id,title,state,description,meta,content}]` with `state` `pending`/`running`/`done`/`failed`; `showStateLabel` |
| `Disclosure` | `summary`, `trailing`, `defaultOpen` or `open`/`onOpenChange` |
| `Tree` + `TreeRow` | `Tree ariaLabel`; row: `level`, `label`, `icon`, `trailing`, `expandable`, `expanded`, `onToggle`, `selected`, `onSelect`. Arrow keys, Home/End, Enter |
| `Skeleton`, `SkeletonText` | `className`; `lines` |
| `StatusGlyph` | `status`; just the shape, for legends |
| `cx`, `TONE` | class joiner; per-tone class strings |

## Charts (`components/charts`)

| Component | Key props |
|---|---|
| `StackedBar` | `segments [{id,label,value,color,icon}]`, `size`, `legend`, `showShare`, `ariaLabel` |
| `Donut` | `segments`, `size`, `thickness`, `centerValue`, `centerLabel`, `legend` (`right`/`bottom`/`none`) |
| `Sparkline` | `values`, `height`, `color`, `fill`, `endPoint`, `ariaLabel` (fills container width) |
| `BarChart` | `data [{label,value,color}]`, `height`, `max`, `ticks`, `format`, `valueLabels`, `ariaLabel` |
| `DualBar` | `rows [{label,baseline,assisted,unit}]`, `scale` (`row`/`shared`), `lowerIsBetter`, `format` |
| `Legend` | `items [{label,color,icon,value,detail,shape}]`, `layout` (`row`/`column`) |
| `ragSegments(counts)` | RAG counts to segments with terminology labels and status shapes |
| `chartColor(i)`, `CHART_COLORS` | categorical colours `--di-chart-1..6` |
| `fmt` | `number`, `compact`, `percent`, `delta` |
| `useElementSize()` | `{ref, width, height}` for your own SVG |

`Gallery.tsx` renders everything in every state. It is not routed; to look at it, render `<Gallery />` from a client page you own and remove it afterwards. Do not import it in screens.
