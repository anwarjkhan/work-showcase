/**
 * Portfolio list for the switcher (a visual stub: the prototype holds one real,
 * synthetic portfolio). Not-loaded entries carry only round PLACEHOLDER estate
 * figures, in the style of `ESTATE`. They never carry RAG, readiness, findings
 * or any figure that could pass as computed delivery status. Replace the names
 * and figures after import (design section 17).
 */

export type PortfolioId = 'risk-finance' | 'markets' | 'shared-data' | 'treasury' | 'all';
export type PortfolioStatus = 'loaded' | 'not-loaded';

export interface PortfolioEstate {
  /** Projects on the standard templates. Placeholder. */
  projects: number;
  /** Active Epics. Placeholder. */
  activeEpics: number;
}

interface PortfolioBase {
  id: PortfolioId;
  name: string;
  description: string;
  /** Owning function, as a label. */
  ownerFunction: string;
  /** True for the roll-up across all portfolios. */
  rollup?: boolean;
}

export interface LoadedPortfolio extends PortfolioBase {
  status: 'loaded';
}

export interface NotLoadedPortfolio extends PortfolioBase {
  status: 'not-loaded';
  /** Round placeholder estate figures; not computed from any records. */
  estate: PortfolioEstate;
}

export type Portfolio = LoadedPortfolio | NotLoadedPortfolio;

export const PORTFOLIOS: readonly Portfolio[] = [
  {
    id: 'risk-finance',
    name: 'Risk & Finance Technology',
    description: 'Risk, capital and finance technology programmes: the synthetic book this prototype computes over.',
    ownerFunction: 'Risk & Finance Technology',
    status: 'loaded',
  },
  {
    id: 'markets',
    name: 'Markets Technology',
    description: 'Trading, pricing and market-data platforms for the markets business.',
    ownerFunction: 'Markets Technology',
    status: 'not-loaded',
    estate: { projects: 120, activeEpics: 900 },
  },
  {
    id: 'shared-data',
    name: 'Shared Data & Platforms',
    description: 'Data, cloud and engineering platforms used across business lines.',
    ownerFunction: 'Platform Engineering',
    status: 'not-loaded',
    estate: { projects: 80, activeEpics: 600 },
  },
  {
    id: 'treasury',
    name: 'Treasury & Liquidity Technology',
    description: 'Funding, liquidity and balance-sheet technology programmes.',
    ownerFunction: 'Treasury Technology',
    status: 'not-loaded',
    estate: { projects: 60, activeEpics: 400 },
  },
  {
    id: 'all',
    name: 'All portfolios',
    description: 'The same screens aggregated across every portfolio, each programme tagged with its portfolio.',
    ownerFunction: 'Technology leadership',
    status: 'not-loaded',
    rollup: true,
    estate: { projects: 400, activeEpics: 3000 },
  },
];

/** The one portfolio whose records the prototype holds. */
export const LOADED_PORTFOLIO = PORTFOLIOS.find((p) => p.status === 'loaded') as LoadedPortfolio;

/** Where the connection plan lives. */
export const CONNECTION_PLAN_HREF = '/about/#plugging-in';
