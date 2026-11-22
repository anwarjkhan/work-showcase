/**
 * Builds slides, packs and decks (docs/SLIDES_PLAN.md sections 5 and 9).
 *
 * Order of work: build every requested slide except the record index, apply
 * the pack's row cap, paginate and fit text, then build the record index from
 * the citations of everything else. Packs apply their options here: outcome
 * summaries and the agent narrative for the deliverable pack, appended
 * verdicts for project and programme packs, the agent brief for the portfolio
 * pack, and `topN` for all.
 */
import { formatDate } from '@/lib/config/clock';
import { terms } from '@/lib/config/terminology';
import type { PmNodeLevel, PortfolioData } from '@/lib/types';
import { catalogueEntry, kindsForScopeKind, PACKS, packAcceptsScope, packForNodeLevel, PACK_IDS } from '../catalogue';
import { assertScope, scopeName, scopeRef, slideEnv, type SlideContext, type SlideEnv } from '../extract';
import type { DeckSpec, PackId, PackOptions, SlideKind, SlideScope, SlideSpec } from '../types';
import type { BuildInput } from './kit';
import { capTables, paginate } from './paginate';
import { BUILDERS } from './slides';

interface PlannedSlide {
  kind: SlideKind;
  scope: SlideScope;
}

/** Kinds that accept a scope, in catalogue order. */
export function availableKinds(scope: SlideScope): SlideKind[] {
  return kindsForScopeKind(scope.kind);
}

function nodeLevel(data: PortfolioData, scope: SlideScope): PmNodeLevel | undefined {
  return scope.kind === 'pm-node' ? data.pmNodes.find((n) => n.id === scope.pmNodeId)?.level : undefined;
}

/** The pack a scope opens with: project nodes use the project pack; programmes and initiatives the programme pack. */
export function defaultPackFor(scope: SlideScope, ctx: Pick<SlideContext, 'data'>): PackId {
  switch (scope.kind) {
    case 'portfolio':
      return 'portfolio';
    case 'deliverable':
      return 'deliverable';
    case 'outcome':
      return 'outcome';
    case 'pm-node':
      return packForNodeLevel(nodeLevel(ctx.data, scope) ?? 'programme');
  }
}

/** Packs that accept a scope (one per scope in this build). */
export function packsFor(scope: SlideScope, ctx: Pick<SlideContext, 'data'>): PackId[] {
  return PACK_IDS.filter((id) => packAcceptsScope(id, scope, nodeLevel(ctx.data, scope)));
}

/** Human name of a scope, e.g. "TD-1001 Counterparty exposure — stress scenario reconciliation". */
export function scopeLabel(scope: SlideScope, ctx: SlideContext): string {
  return scopeName(slideEnv(ctx), scope);
}

function sectionsOf(planned: PlannedSlide[]): string[] {
  const out: string[] = [];
  for (const p of planned) {
    if (p.kind === 'cover' || p.kind === 'contents') continue;
    const title = p.kind === 'outcome-summary' && p.scope.kind === 'outcome' && planned[0]?.scope.kind === 'deliverable' ? 'Outcome summaries' : p.kind === 'td-verdict' && p.scope.kind === 'deliverable' && planned[0]?.scope.kind === 'pm-node' ? 'Verdicts by deliverable' : catalogueEntry(p.kind).title;
    if (!out.includes(title)) out.push(title);
  }
  return out;
}

function build(env: SlideEnv, planned: PlannedSlide[], options: PackOptions, pack: { id: PackId | null; title: string }): SlideSpec[] {
  for (const p of planned) {
    assertScope(env, p.scope);
    if (!catalogueEntry(p.kind).scopes.includes(p.scope.kind)) throw new Error(`The “${catalogueEntry(p.kind).title}” slide does not accept this scope.`);
  }
  const sections = sectionsOf(planned);
  const built: (SlideSpec[] | null)[] = planned.map(() => null);
  const input = (p: PlannedSlide, slides: readonly SlideSpec[]): BuildInput => ({ env, scope: p.scope, options, pack: { ...pack, sections, slides } });
  const finish = (specs: SlideSpec[]) => specs.flatMap((s) => paginate(capTables(s, options.topN)));

  planned.forEach((p, i) => {
    if (p.kind !== 'record-index') built[i] = finish(BUILDERS[p.kind](input(p, [])));
  });
  const others = built.flatMap((b) => b ?? []);
  planned.forEach((p, i) => {
    // The record index is built last, from every other slide's citations.
    if (p.kind === 'record-index') built[i] = BUILDERS[p.kind](input(p, others)).flatMap((s) => paginate(s));
  });
  return built.flatMap((b) => b ?? []);
}

/** Builds the given kinds for one scope, in the order given. Throws when a kind does not accept the scope. */
export function buildSlides(scope: SlideScope, kinds: readonly SlideKind[], ctx: SlideContext, options: PackOptions = {}): SlideSpec[] {
  const env = slideEnv(ctx);
  return build(env, kinds.map((kind) => ({ kind, scope })), options, { id: null, title: terms.app.name });
}

/** The ordered slides of a pack after its options are applied. */
export function planPack(packId: PackId, scope: SlideScope, options: PackOptions, ctx: SlideContext): PlannedSlide[] {
  const env = slideEnv(ctx);
  assertScope(env, scope);
  if (!packAcceptsScope(packId, scope, nodeLevel(ctx.data, scope))) throw new Error(`The ${PACKS[packId].title.toLowerCase()} does not accept this scope.`);
  const narrative = options.includeAgentNarrative !== false;
  const planned: PlannedSlide[] = [];
  for (const kind of PACKS[packId].kinds) {
    if (!narrative && (kind === 'td-status' || kind === 'portfolio-brief')) continue;
    if (kind === 'decisions' && scope.kind === 'pm-node' && options.appendVerdicts && options.appendVerdicts !== 'none') {
      const rollup = env.rollups.pmNodes[scope.pmNodeId];
      const under = new Set(rollup?.deliverableIds ?? []);
      const ids = options.appendVerdicts === 'all' ? (rollup?.deliverableIds ?? []) : env.disagreements.filter((id) => under.has(id));
      for (const deliverableId of ids) planned.push({ kind: 'td-verdict', scope: { kind: 'deliverable', deliverableId } });
    }
    planned.push({ kind, scope });
    if (kind === 'td-outcomes' && scope.kind === 'deliverable' && options.includeOutcomeSummaries) {
      for (const o of env.idx.outcomesByDeliverable.get(scope.deliverableId) ?? []) planned.push({ kind: 'outcome-summary', scope: { kind: 'outcome', outcomeId: o.id } });
    }
  }
  return planned;
}

/** Builds a pack for a scope. Throws when the pack does not accept the scope (e.g. a programme node with the project pack). */
export function buildPack(packId: PackId, scope: SlideScope, options: PackOptions, ctx: SlideContext): SlideSpec[] {
  const planned = planPack(packId, scope, options, ctx);
  return build(slideEnv(ctx), planned, options, { id: packId, title: PACKS[packId].title });
}

/** Footer text from data meta: the prototype marker for synthetic data, otherwise the source systems and extraction date. */
export function footerText(ctx: SlideContext): string {
  const meta = ctx.data.meta;
  if (meta.sourceKind === 'synthetic') return `Prototype · synthetic data · as at ${formatDate(ctx.result.computedFor)}`;
  return `Source: ${terms.systems['portfolio-system']} and ${terms.systems['work-tracker']} · extracted ${formatDate(meta.generatedAt)}`;
}

/** A file name safe on every platform: letters, digits, dot, hyphen and underscore only. */
export function safeFileName(name: string): string {
  return name
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-(?=\.pptx$)/g, '');
}

export interface DeckOptions {
  /** Deck title; defaults to the scope name and pack title. */
  title?: string;
  /** Scope for the file name; defaults to the first slide's scope. */
  scope?: SlideScope;
  /** Pack, for the file name ("<ref>-<pack>-pack-<date>.pptx"); without one the name uses "slides". */
  packId?: PackId;
}

/** Wraps slides (a pack, or a basket of single slides) into what the renderers receive. */
export function buildDeck(slides: SlideSpec[], ctx: SlideContext, options: DeckOptions = {}): DeckSpec {
  const env = slideEnv(ctx);
  const scope = options.scope ?? slides[0]?.scope ?? { kind: 'portfolio' };
  const ref = scopeRef(env, scope);
  const part = options.packId ? `${options.packId}-pack` : 'slides';
  return {
    title: options.title ?? `${scopeName(env, scope)} · ${options.packId ? PACKS[options.packId].title : 'Slides'}`,
    fileName: safeFileName(`${ref}-${part}-${env.asOf}.pptx`),
    footer: { text: footerText(ctx) },
    slides,
  };
}

/** Builds a pack and wraps it as a deck in one call. */
export function buildPackDeck(packId: PackId, scope: SlideScope, options: PackOptions, ctx: SlideContext): DeckSpec {
  return buildDeck(buildPack(packId, scope, options, ctx), ctx, { scope, packId });
}
