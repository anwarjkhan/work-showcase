import { describe, expect, it } from 'vitest';
import { routeForPath, ROUTES } from '@/lib/config/routes';
import { createDemoStore } from './store';

describe('demo store', () => {
  it('seeds data and an engine result from the data source', () => {
    const store = createDemoStore();
    const s = store.getState();
    expect(s.data).toBe(s.seed);
    expect(s.data.deliverables.length).toBeGreaterThan(0);
    for (const d of s.data.deliverables) expect(s.results.deliverables[d.id]).toBeDefined();
  });

  it('re-runs the engine when data changes and notifies subscribers', () => {
    const store = createDemoStore();
    let calls = 0;
    store.subscribe(() => calls++);
    const before = store.getState().results;
    store.updateData((d) => ({ ...d, outcomes: d.outcomes.slice(1) }));
    expect(store.getState().results).not.toBe(before);
    expect(calls).toBe(1);
  });

  it('reset restores the seeded state exactly, including ids and timestamps', () => {
    const store = createDemoStore();
    const pristine = store.getState();
    const firstId = store.nextId('x');
    const firstAt = store.now();
    store.updateData((d) => ({ ...d, deliverables: [] }));
    store.appendAudit({ actor: { kind: 'system' }, action: 'demo.reset', subject: { kind: 'deliverable', id: 'td-1001' }, summary: 's', refs: [], details: {} });
    expect(store.getState().audit).toHaveLength(1);

    store.reset();
    const after = store.getState();
    expect(after.data).toBe(pristine.seed);
    expect(after.results).toBe(pristine.results);
    expect(after.audit).toEqual([]);
    expect(after.agentRuns).toEqual([]);
    expect(after.proposals).toEqual([]);
    expect(after.revision).toBeGreaterThan(pristine.revision);
    expect(store.nextId('x')).toBe(firstId);
    expect(store.now()).toBe(firstAt);
  });
});

describe('routes', () => {
  it('lists the twelve routes (the eleven of the design plus the slide builder) and matches paths with or without a trailing slash', () => {
    expect(ROUTES).toHaveLength(12);
    expect(routeForPath('/')?.id).toBe('portfolio');
    expect(routeForPath('/plan/')?.id).toBe('plan');
    expect(routeForPath('/lifecycle')?.id).toBe('lifecycle');
    expect(routeForPath('/lifecycle/td-2001/')?.id).toBe('workflow');
    expect(routeForPath('/deliverables/td-1001')?.id).toBe('deliverable');
    expect(routeForPath('/nope')).toBeNull();
  });
});
