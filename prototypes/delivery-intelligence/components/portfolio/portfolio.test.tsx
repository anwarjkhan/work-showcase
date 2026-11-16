// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEMO_CLOCK } from '@/lib/config/clock';
import { HERO_DELIVERABLE_ID } from '@/lib/config/story';
import { createSyntheticPortfolio } from '@/lib/data/synthetic';
import { computeAll } from '@/lib/engine';
import { buildPortfolioView } from './model';
import { PortfolioView } from './PortfolioView';

vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

afterEach(cleanup);

const data = createSyntheticPortfolio();
const result = computeAll(data, DEMO_CLOCK);
const view = buildPortfolioView(data, result);
const text = (id: string) => screen.getByTestId(id).textContent;

describe('Portfolio screen', () => {
  it('shows exactly the engine figures', () => {
    render(<PortfolioView view={view} />);
    const p = result.portfolio;
    expect(text('disagreement-count')).toBe(String(p.disagreementDeliverableIds.length));
    expect(text('readiness-ready')).toBe(String(p.readiness.ready));
    expect(text('readiness-not-ready')).toBe(String(p.readiness['not-ready']));
    expect(text('readiness-unknown')).toBe(String(p.readiness.unknown));
    if (p.workCompletion.computable) expect(text('work-percent')).toBe(String(p.workCompletion.value.percent));
    if (p.acceptedOutcomes.computable) expect(text('accepted-count')).toBe(String(p.acceptedOutcomes.value.acceptedCount));
    for (const s of ['red', 'amber', 'green', 'unknown'] as const) {
      expect(text(`rag-reported-${s}`)).toContain(String(p.reportedRag[s]));
      expect(text(`rag-evidence-${s}`)).toContain(String(p.evidenceRag[s]));
    }
    expect(text('count-deliverables')).toBe(String(p.counts.deliverables));
    expect(text('count-epics')).toBe(String(p.counts.epics));
    expect(text('count-outcomes')).toBe(String(p.counts.outcomes));
    expect(text('count-requests')).toBe(String(p.counts.investmentRequests));
  });

  it('lists every disagreement in engine order, linking to the deliverable', () => {
    render(<PortfolioView view={view} />);
    const rows = screen.getAllByTestId('disagreement-row');
    expect(rows.map((r) => r.getAttribute('data-deliverable-id'))).toEqual(result.portfolio.disagreementDeliverableIds);
    for (const r of rows) expect(r.getAttribute('href')).toContain(r.getAttribute('data-deliverable-id'));
    expect(result.portfolio.disagreementDeliverableIds).toContain(HERO_DELIVERABLE_ID);
  });

  it('shows stage counts and one row per programme', () => {
    render(<PortfolioView view={view} />);
    for (const [stage, n] of Object.entries(result.portfolio.stageDistribution)) expect(text(`stage-${stage}`)).toContain(String(n));
    expect(screen.getAllByTestId('programme-row').length).toBeGreaterThanOrEqual(result.portfolio.programmeHealth.length);
  });
});
