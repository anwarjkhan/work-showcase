/**
 * Extract layer: pure functions from (data, engine result, store extras) to
 * facts for the four scope kinds. See docs/SLIDES_PLAN.md section 3.
 */
export { extrasFrom, slideEnv, type ExtractExtras, type SlideContext, type SlideEnv } from './common';
export * from './format';
export * from './scope';
export { deliverableFacts, verdictSentence, type CoreSeatLine, type DeliverableFacts, type DependencyLine, type OutcomeLine } from './deliverable';
export { outcomeFacts, type CriterionLine, type EvidenceLine, type OutcomeFacts } from './outcome';
export { deliverableLine, nodeFacts, type ChildNodeLine, type NodeDeliverableLine, type NodeFacts } from './node';
export { CONTINENT_LABEL, portfolioFacts, quarterOf, type PortfolioFacts, type ProgrammeLine, type QuarterFacts, type RegionLine, type RuleLine } from './portfolio';
