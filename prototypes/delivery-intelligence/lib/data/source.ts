/**
 * Data-source contract. The app reads everything through a `DataSource`, so the
 * synthetic generator can later be swapped for a read-only Jira / portfolio
 * system source without touching screens.
 *
 * `load()` is synchronous on purpose: the prototype is a static export and the
 * store is seeded on first render. A live source would be fetched at build time
 * (or behind a loading boundary) and then served through the same interface.
 */
import type { PortfolioData } from '@/lib/types';
import { createSyntheticPortfolio, DEFAULT_SEED } from './synthetic';

export interface DataSource {
  /** Stable id, e.g. "synthetic". */
  readonly id: string;
  readonly kind: PortfolioData['meta']['sourceKind'];
  /** Human label for the About page and shell footer. */
  readonly label: string;
  /** Returns a complete snapshot. Must be deterministic for a given source. */
  load(): PortfolioData;
}

/**
 * Not built (design section 5). Shape of the future read-only Jira and portfolio
 * system source, kept here so the interface is visible.
 */
export interface JiraSourceOptions {
  /** Base URL of the work tracker's REST API. */
  baseUrl: string;
  /** JQL selecting the Epics in scope. */
  epicJql: string;
  /** Custom field ids for the Deliverable ID and Outcome ID fields. */
  fields: { deliverableId: string; outcomeId: string; podId?: string; assigneeType?: string; reviewerId?: string };
}

class SyntheticSource implements DataSource {
  readonly id = 'synthetic';
  readonly label = 'Synthetic portfolio (seeded)';
  private cache: PortfolioData | null = null;

  constructor(private readonly seed: number) {}

  get kind(): PortfolioData['meta']['sourceKind'] {
    return this.load().meta.sourceKind;
  }

  load(): PortfolioData {
    this.cache ??= createSyntheticPortfolio(this.seed);
    return this.cache;
  }
}

let current: DataSource | null = null;

/** The data source the app uses. Server pages (generateStaticParams) and the client store both call this. */
export function getDataSource(): DataSource {
  current ??= new SyntheticSource(DEFAULT_SEED);
  return current;
}

/** Ids for `generateStaticParams` of `/deliverables/[id]` and `/lifecycle/[id]`. */
export function deliverableStaticParams(): Array<{ id: string }> {
  return getDataSource()
    .load()
    .deliverables.map((d) => ({ id: d.id }));
}
