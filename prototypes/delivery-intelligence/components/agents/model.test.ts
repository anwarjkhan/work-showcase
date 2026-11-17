import { describe, expect, it } from 'vitest';
import { createDemoActions, createDemoStore } from '@/lib/store';
import { HERO_DELIVERABLE_ID } from '@/lib/config/story';
import { beforeAfterRows, defaultScope, eligibleForApproval, findingDiff, parseHash, personaOptions, presets, snapshot } from './model';

describe('agent centre model', () => {
  const store = createDemoStore();
  const data = store.getState().data;

  it('reads deep-link hashes without running anything', () => {
    expect(parseHash('#run-raid-quality', data)).toEqual({ agentId: 'raid-quality', scope: { kind: 'portfolio' } });
    expect(parseHash('#status-hero', data)).toEqual({ agentId: 'status-reporting', scope: { kind: 'deliverable', deliverableId: HERO_DELIVERABLE_ID } });
    expect(parseHash('#audit', data)).toEqual({ tab: 'audit' });
    expect(parseHash('#nope', data)).toBeNull();
    expect(store.getState().agentRuns).toHaveLength(0);
  });

  it('presets name real records and never say "hero"', () => {
    for (const p of presets(data)) expect(p.label.toLowerCase()).not.toContain('hero');
    expect(defaultScope('executive-briefing', data)).toEqual({ kind: 'portfolio' });
  });

  it('splits labelled before/after text into one field row', () => {
    expect(beforeAfterRows('Owner: none', 'Owner: Jane Doe')).toEqual([{ field: 'Owner', before: 'none', after: 'Jane Doe' }]);
    expect(beforeAfterRows('A open', 'A closed')[0]?.field).toBeNull();
  });

  it('computes the effect of an approval and excludes the assignee from eligibility', () => {
    const s = createDemoStore();
    const a = createDemoActions(s);
    const r = a.startAgentRun('raid-quality', { kind: 'portfolio' });
    expect(r.ok).toBe(true);
    const pending = s.getState().proposals.filter((p) => p.status === 'pending');
    const owned = pending.find((p) => p.assigneeId);
    expect(owned).toBeDefined();
    expect(eligibleForApproval(s.getState().data, pending, owned!.assigneeId!).some((p) => p.id === owned!.id)).toBe(false);
    expect(personaOptions(s.getState().data, s.getState().proposals, 'p-presenter', 'raid-quality').some((p) => p.id === owned!.assigneeId)).toBe(true);
    const target = pending[0]!;
    const before = snapshot(s.getState().results, target.deliverableId);
    expect(a.approveProposal(target.id, 'p-presenter').ok).toBe(true);
    const after = snapshot(s.getState().results, target.deliverableId);
    expect(after.portfolioFindings).toBeLessThan(before.portfolioFindings);
    expect(findingDiff(before, after).cleared.length).toBeGreaterThan(0);
  });
});
