/**
 * Shared fixtures and spec checks for the slide extract and compose tests.
 * Not a test file itself; imported by *.test.ts under lib/slides.
 */
import { resolveRef, runAgent } from '@/lib/agents';
import { DEMO_CLOCK } from '@/lib/config/clock';
import { createSyntheticPortfolio } from '@/lib/data/synthetic';
import { computeAll } from '@/lib/engine';
import type { AgentId, PortfolioData, StatusDraft } from '@/lib/types';
import type { SlideContext } from '../extract';
import type { Block, SlideSpec } from '../types';
import { BULLETS_PER_SLIDE, CHART_MAX_CATEGORIES, LAYOUT_REGIONS, TABLE_ROWS_PER_SLIDE, TIMELINE_ROWS_PER_SLIDE, TIMELINE_ROWS_WITH_TOP, TITLE_MAX, TITLE_TARGET, cellText } from './kit';
import { regionWidth } from './columns';
import { DRAFT_LABEL } from './slides/shared';

export function syntheticContext(withDrafts = false): SlideContext {
  const data = createSyntheticPortfolio();
  const result = computeAll(data, DEMO_CLOCK);
  const ctx: SlideContext = { data, result, clock: DEMO_CLOCK };
  if (!withDrafts) return ctx;
  const draft = (agentId: AgentId, scope: Parameters<typeof runAgent>[1], n: number): StatusDraft => {
    const r = runAgent(agentId, scope, { data, results: result, clock: DEMO_CLOCK });
    if (!r.ok || !r.output.draft) throw new Error(`No draft from ${agentId}`);
    return { ...r.output.draft, id: `test-draft-${n}`, runId: `test-run-${n}`, generatedAt: DEMO_CLOCK.now };
  };
  return {
    ...ctx,
    drafts: [draft('status-reporting', { kind: 'deliverable', deliverableId: 'td-1001' }, 1), draft('executive-briefing', { kind: 'portfolio' }, 2)],
  };
}

/** Internal id shapes (same as lib/agents/wording.test.ts) and the banned word. */
export const ID_PATTERN = /\b(raid|td|oc|p|dep|ev|pm|ac|ai|ir|ms|hub|pod|pdlc|run|approval|audit|move|decision|spr)-[a-z0-9]/;
export const HERO_PATTERN = /\bhero/i;

/**
 * Data values that look like ids but are what the source shows, so they are not
 * leaks (as in lib/agents/wording.test.ts): the value a dangling Deliverable ID
 * field holds, and agent identity handles as shown on work items.
 */
export function withoutDataValues(text: string, data: PortfolioData): string {
  let out = text.replace(/Deliverable ID “[^”]*”/g, '');
  for (const a of data.agentIdentities) out = out.split(a.handle).join('');
  return out;
}

/** Strings that carry an internal id or the banned word. */
export function leaksIn(value: unknown, data: PortfolioData): string[] {
  return visibleStrings(value).filter((t) => ID_PATTERN.test(withoutDataValues(t, data)) || HERO_PATTERN.test(t));
}

/**
 * Every user-visible string in a value, skipping ids, scopes, citation refs and
 * stage ids, and the slide's `kind` (a catalogue id such as "td-verdict", which
 * renderers never show).
 */
export function visibleStrings(value: unknown, key = ''): string[] {
  if (['id', 'scope', 'ref', 'stageId', 'kind'].includes(key)) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap((v) => visibleStrings(v));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => visibleStrings(v, k));
  return [];
}

function blockProblems(b: Block, hasTop: boolean): string[] {
  const out: string[] = [];
  if (b.type === 'table') {
    if (b.rows.length > TABLE_ROWS_PER_SLIDE) out.push(`table has ${b.rows.length} rows`);
    for (const row of b.rows) {
      if (row.length !== b.columns.length) out.push('row width differs from columns');
      row.forEach((c, i) => {
        const max = b.columns[i]?.maxChars;
        if (max && cellText(c).length > max) out.push(`cell over ${max} chars`);
      });
    }
    // Fitted widths are inches: headers hold their longest word (0.11 in a character); short columns their longest value word (0.095).
    b.columns.forEach((c, i) => {
      const words = (t: string) => Math.max(0, ...t.split(/\s+/).map((w) => w.length));
      const header = words(c.header) * 0.11;
      const value = c.maxChars === undefined ? Math.max(0, ...b.rows.map((r) => (r[i] === undefined ? 0 : words(cellText(r[i] as never))))) * 0.095 : 0;
      if (c.width < Math.max(header, value)) out.push(`column "${c.header}" too narrow`);
    });
  }
  if (b.type === 'bullets' && b.items.length > BULLETS_PER_SLIDE) out.push(`${b.items.length} bullets`);
  if (b.type === 'timeline') {
    if (b.rows.length > TIMELINE_ROWS_PER_SLIDE) out.push(`${b.rows.length} timeline rows`);
    if (b.rows.length > TIMELINE_ROWS_WITH_TOP && hasTop) out.push(`${b.rows.length} timeline rows under headline figures`);
    if (b.window.start > b.window.end) out.push('timeline window reversed');
  }
  if ((b.type === 'bar' || b.type === 'stacked-bar') && b.categories.length > CHART_MAX_CATEGORIES) out.push('too many chart categories');
  if ((b.type === 'bar' || b.type === 'stacked-bar') && b.series.some((s) => s.values.length !== b.categories.length)) out.push('series length differs');
  if (b.type === 'measures') {
    if (b.readiness.stateText.includes('%') || b.readiness.caption.includes('%')) out.push('readiness shown as a percentage');
    for (const m of [b.work, b.accepted]) if (!m.computable && (m.value !== 'Not computable' || !m.caption)) out.push('not computable without words and reason');
  }
  if (b.type === 'document' && b.label !== DRAFT_LABEL) out.push('document without the scripted label');
  return out;
}

/** Problems with one spec against the contract and section 6/9 rules (empty when valid). */
export function specProblems(spec: SlideSpec, data: PortfolioData): string[] {
  const out: string[] = [];
  if (spec.title.length > TITLE_MAX) out.push(`title over ${TITLE_MAX}: ${spec.title}`);
  // Page 1 titles aim at one line; continuation suffixes may use the rest of the hard cap.
  if ((!spec.page || spec.page.index === 1) && spec.title.length > TITLE_TARGET) out.push(`title over ${TITLE_TARGET}: ${spec.title}`);
  if (!spec.title.trim()) out.push('empty title');
  const regions = LAYOUT_REGIONS[spec.layout];
  for (const p of spec.blocks) {
    if (!regions.includes(p.region)) out.push(`block ${p.block.type} in region ${p.region} of ${spec.layout}`);
    out.push(...blockProblems(p.block, spec.blocks.some((x) => x.region === 'top')));
    if (p.block.type === 'table') {
      const total = p.block.columns.reduce((s, c) => s + c.width, 0);
      if (total > regionWidth(spec.layout, p.region) + 0.05) out.push(`table columns need ${total.toFixed(2)} in, more than the region`);
    }
  }
  if (!spec.notes.includes('Records:') || spec.notes.trim().startsWith('Records:')) out.push('notes missing talk track or records line');
  for (const c of spec.citations) {
    if (!resolveRef(data, c.ref)) out.push(`citation does not resolve: ${c.ref.kind}`);
    if (!c.label || !c.system) out.push('citation without label or system');
  }
  if (spec.provenance.length === 0) out.push('no provenance');
  if (data.meta.sourceKind === 'synthetic' && !spec.provenance.includes('sample')) out.push('synthetic slide without sample provenance');
  if (spec.blocks.some((p) => p.block.type === 'document') && !spec.provenance.includes('scripted-agent')) out.push('draft without scripted-agent provenance');
  if (spec.blocks.some((p) => p.block.type === 'rag-pair') && !spec.provenance.includes('reported')) out.push('reported status without reported provenance');
  if (JSON.stringify(JSON.parse(JSON.stringify(spec))) !== JSON.stringify(spec)) out.push('not plain JSON');
  return out.map((p) => `${spec.id}: ${p}`);
}
