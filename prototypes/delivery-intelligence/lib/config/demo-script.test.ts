import { describe, expect, it } from 'vitest';
import { createSyntheticPortfolio } from '@/lib/data/synthetic';
import { DEMO_STEPS, DEMO_TOTAL_SECONDS, demoHref, formatDuration, resolveDemoStep, type DemoTokens } from './demo-script';
import { routeForPath } from './routes';
import { HERO_DELIVERABLE_ID, WORKFLOW_DELIVERABLE_ID } from './story';

const data = createSyntheticPortfolio();
const byId = (id: string) => data.deliverables.find((d) => d.id === id)!;
const tokens: DemoTokens = {
  heroRef: byId(HERO_DELIVERABLE_ID).ref,
  heroTitle: byId(HERO_DELIVERABLE_ID).title,
  flowRef: byId(WORKFLOW_DELIVERABLE_ID).ref,
  flowTitle: byId(WORKFLOW_DELIVERABLE_ID).title,
};

describe('demo script', () => {
  it('has the eleven steps of the design, numbered in order', () => {
    expect(DEMO_STEPS.map((s) => s.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it('runs for about eight minutes', () => {
    expect(DEMO_TOTAL_SECONDS).toBeGreaterThanOrEqual(450);
    expect(DEMO_TOTAL_SECONDS).toBeLessThanOrEqual(510);
  });

  it('points every step at a known route, with two or three prompts', () => {
    for (const step of DEMO_STEPS) {
      expect(routeForPath(demoHref(step.route).split('#')[0]!), step.route).not.toBeNull();
      expect(step.prompts.length).toBeGreaterThanOrEqual(2);
      expect(step.prompts.length).toBeLessThanOrEqual(3);
      expect(step.point.length).toBeGreaterThan(20);
    }
  });

  it('never shows the internal word "hero", and fills every token from the data', () => {
    for (const step of DEMO_STEPS) {
      const r = resolveDemoStep(step, tokens);
      const text = [r.title, r.screen, r.point, ...r.prompts].join(' ');
      expect(text.toLowerCase()).not.toContain('hero');
      expect(text).not.toMatch(/[{}]/);
    }
    expect(resolveDemoStep(DEMO_STEPS[2]!, tokens).point).toContain(tokens.heroTitle);
    expect(resolveDemoStep(DEMO_STEPS[6]!, tokens).point).toContain(tokens.flowRef);
  });

  it('keeps hashes and adds the trailing slash the static export serves', () => {
    expect(demoHref('/')).toBe('/');
    expect(demoHref('/global#hero')).toBe('/global/#hero');
    expect(demoHref(`/deliverables/${HERO_DELIVERABLE_ID}#status`)).toBe(`/deliverables/${HERO_DELIVERABLE_ID}/#status`);
  });

  it('formats durations as minutes and seconds', () => {
    expect(formatDuration(75)).toBe('1:15');
    expect(formatDuration(480)).toBe('8:00');
  });
});
