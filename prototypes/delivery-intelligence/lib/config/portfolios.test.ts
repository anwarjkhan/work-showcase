import { describe, expect, it } from 'vitest';
import { LOADED_PORTFOLIO, PORTFOLIOS } from './portfolios';

describe('portfolios config', () => {
  it('has exactly one loaded entry, and it is the exported one', () => {
    const loaded = PORTFOLIOS.filter((p) => p.status === 'loaded');
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toBe(LOADED_PORTFOLIO);
  });

  it('has unique ids and an All portfolios roll-up that is not loaded', () => {
    expect(new Set(PORTFOLIOS.map((p) => p.id)).size).toBe(PORTFOLIOS.length);
    const rollups = PORTFOLIOS.filter((p) => p.rollup);
    expect(rollups).toHaveLength(1);
    expect(rollups[0]?.status).toBe('not-loaded');
  });

  it('gives not-loaded entries only placeholder estate figures, never status', () => {
    const notLoaded = PORTFOLIOS.filter((p) => p.status === 'not-loaded');
    expect(notLoaded.length).toBeGreaterThanOrEqual(4);
    for (const p of notLoaded) {
      const allowed = ['id', 'name', 'description', 'ownerFunction', 'status', 'rollup', 'estate'];
      expect(Object.keys(p).filter((k) => !allowed.includes(k))).toEqual([]);
      expect(Object.keys(p.estate).sort()).toEqual(['activeEpics', 'projects']);
      expect(p.estate.projects % 10).toBe(0);
      expect(p.estate.activeEpics % 100).toBe(0);
    }
  });
});
