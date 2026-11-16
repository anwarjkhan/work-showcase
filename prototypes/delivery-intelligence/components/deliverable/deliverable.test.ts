import { describe, expect, it } from 'vitest';
import { HERO_DELIVERABLE_ID, WORKFLOW_DELIVERABLE_ID } from '@/lib/config/story';
import { createDemoStore } from '@/lib/store/store';
import { createDemoActions } from '@/lib/store/actions';
import { resolveRef } from '@/lib/agents';
import { buildDeliverableModel, siblingsOf } from './model';
import { draftAsText, numberCitations } from './StatusReport';

const build = (id: string) => {
  const s = createDemoStore().getState();
  return { s, m: buildDeliverableModel(s.data, s.results, s.clock, id) };
};

describe('deliverable detail model', () => {
  it('hero: 82%, 1 of 4, not ready, reported Green vs evidence Red from the engine', () => {
    const { m } = build(HERO_DELIVERABLE_ID);
    expect(m).not.toBeNull();
    const wc = m!.measures.workCompletion;
    expect(wc.computable && wc.value.percent).toBe(82);
    const ao = m!.measures.acceptedOutcomes;
    expect(ao.computable && [ao.value.acceptedCount, ao.value.totalCount]).toEqual([1, 4]);
    expect(m!.measures.readiness.state).toBe('not-ready');
    expect(m!.deliverable.reportedRag).toBe('green');
    expect(m!.rag?.evidence).toBe('red');
    expect(m!.verdict.disagrees).toBe(true);
    expect(m!.verdict.sentence).toMatch(/Reported Green.*evidence says Red/);
    expect(m!.verdict.sentence).toMatch(/23 days/);
    expect(m!.outcomes.filter((o) => o.gap)).toHaveLength(2);
  });

  it('builds a model for every deliverable, including thin ones', () => {
    const s = createDemoStore().getState();
    for (const d of s.data.deliverables) {
      const m = buildDeliverableModel(s.data, s.results, s.clock, d.id);
      expect(m, d.id).not.toBeNull();
      expect(m!.verdict.sentence.length).toBeGreaterThan(10);
      expect(siblingsOf(s.data, d).some((x) => x.id === d.id)).toBe(true);
    }
    expect(build(WORKFLOW_DELIVERABLE_ID).m!.programmePath).toHaveLength(0);
  });

  it('status draft: every sentence is cited and resolves; text export carries markers', () => {
    const store = createDemoStore();
    const actions = createDemoActions(store);
    const r = actions.startAgentRun('status-reporting', { kind: 'deliverable', deliverableId: HERO_DELIVERABLE_ID }, 'p-presenter');
    expect(r.ok).toBe(true);
    const s = store.getState();
    const draft = s.drafts.at(-1)!;
    for (const sec of draft.sections) for (const se of sec.sentences) {
      expect(se.citations.length).toBeGreaterThan(0);
      for (const c of se.citations) expect(resolveRef(s, c)).not.toBeNull();
    }
    const { order } = numberCitations(draft);
    const text = draftAsText(draft, (x) => resolveRef(s, x)?.label ?? x.id);
    expect(text).toContain('[1]');
    expect(text).toContain(`[${order.length}]`);
  });
});
