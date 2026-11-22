/**
 * Slide extraction: public entry point (docs/SLIDES_PLAN.md section 3).
 *
 *   const ctx: SlideContext = { data, result, drafts, clock };   // from the store
 *   buildSlides({ kind: 'deliverable', deliverableId }, ['td-verdict'], ctx);
 *   buildPack('deliverable', scope, { includeAgentNarrative: true }, ctx);
 *   buildPackDeck('deliverable', scope, {}, ctx);   // DeckSpec for the renderers
 *
 * Specs are plain JSON and deterministic for the same state and clock.
 * Rendering (PowerPoint and HTML preview) lives in lib/slides/render.
 */
export type * from './types';
export { CATALOGUE, CATALOGUE_LIST, PACKS, PACK_IDS, catalogueEntry, kindsForScopeKind, packAcceptsScope, packForNodeLevel } from './catalogue';
export type { SlideContext, ExtractExtras } from './extract';
export { scopeKey, parseScopeKey } from './extract';
export {
  availableKinds,
  buildDeck,
  buildPack,
  buildPackDeck,
  buildSlides,
  defaultPackFor,
  footerText,
  packsFor,
  planPack,
  safeFileName,
  scopeLabel,
  type DeckOptions,
} from './compose/packs';
export { LAYOUT_REGIONS, TITLE_MAX, TABLE_ROWS_PER_SLIDE, BULLETS_PER_SLIDE, TIMELINE_ROWS_PER_SLIDE, CHART_MAX_CATEGORIES } from './compose/kit';
export { DRAFT_LABEL } from './compose/slides/shared';
