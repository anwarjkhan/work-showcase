import { describe, expect, it } from 'vitest';
import { DEMO_CLOCK } from '@/lib/config/clock';
import { CROSS_CUTTING_AGENTS, PDLC_STAGES } from '@/lib/config/pdlc';
import { HERO_DELIVERABLE_ID, WORKFLOW_DELIVERABLE_ID } from '@/lib/config/story';
import { createSyntheticPortfolio } from '@/lib/data/synthetic';
import { computeAll } from '@/lib/engine';
import { baseline, CLOCK, change, evidence } from '@/lib/engine/test-fixtures';
import type { AgentId, AgentRunOutput, PortfolioData } from '@/lib/types';
import { AGENT_CATALOGUE, AGENT_IDS, agentsForStage, crossCuttingAgents } from './catalogue';
import { playbackAt, playbackDuration } from './playback';
import { scriptedProvider } from './provider';
import { unresolvedRefs } from './refs';
import { AGENT_LIST, runAgent } from './registry';
import type { AgentRunScope } from './types';

const portfolio = createSyntheticPortfolio();
const withResults = { data: portfolio, results: computeAll(portfolio, DEMO_CLOCK) };

function run(agentId: AgentId, scope: AgentRunScope, data: PortfolioData = portfolio, clock = DEMO_CLOCK): AgentRunOutput {
  const r = runAgent(agentId, scope, { data, results: computeAll(data, clock), clock });
  if (!r.ok) throw new Error(r.reason);
  return r.output;
}

/** The scope each agent is demonstrated on. */
const DEFAULT_SCOPE: Record<AgentId, AgentRunScope> = {
  'requirements-structuring': { kind: 'pdlc-stage', deliverableId: WORKFLOW_DELIVERABLE_ID, stageId: 'ideation-requirements' },
  'outcome-mapping': { kind: 'portfolio' },
  'control-evidence-check': { kind: 'deliverable', deliverableId: HERO_DELIVERABLE_ID },
  'release-readiness': { kind: 'deliverable', deliverableId: HERO_DELIVERABLE_ID },
  'raid-quality': { kind: 'portfolio' },
  'dependency-discovery': { kind: 'portfolio' },
  'portfolio-reconciliation': { kind: 'portfolio' },
  'status-reporting': { kind: 'deliverable', deliverableId: HERO_DELIVERABLE_ID },
  'executive-briefing': { kind: 'portfolio' },
};

const allSentences = (o: AgentRunOutput) => o.draft?.sections.flatMap((s) => s.sentences) ?? [];
const text = (o: AgentRunOutput) => allSentences(o).map((s) => s.text).join('\n');

describe('agent catalogue', () => {
  it('lists nine agents consistent with the PDLC config', () => {
    expect(AGENT_IDS).toHaveLength(9);
    expect(AGENT_LIST.map((a) => a.id)).toEqual(AGENT_IDS);
    for (const stage of PDLC_STAGES) expect(agentsForStage(stage.id).map((a) => a.id)).toEqual(stage.agentAssist);
    expect(crossCuttingAgents().map((a) => a.id)).toEqual(CROSS_CUTTING_AGENTS);
    for (const a of AGENT_LIST) {
      const meta = AGENT_CATALOGUE[a.id];
      expect(a.mode).toBe(meta.mode);
      expect(a.stages).toEqual(meta.stages);
      expect(a.provenance).toBe('scripted-agent');
    }
  });
});

describe('all nine agents on the synthetic portfolio', () => {
  for (const agentId of AGENT_IDS) {
    it(`${agentId} returns steps and the output its mode requires`, () => {
      const o = run(agentId, DEFAULT_SCOPE[agentId]);
      expect(o.steps.length).toBeGreaterThanOrEqual(3);
      expect(o.summary.length).toBeGreaterThan(0);
      for (const s of o.steps) {
        expect(s.label.length).toBeGreaterThan(0);
        expect(s.durationMs).toBeGreaterThan(0);
        expect(unresolvedRefs(withResults, s.refs)).toEqual([]);
      }
      const mode = AGENT_CATALOGUE[agentId].mode;
      if (mode === 'draft') expect(o.draft).not.toBeNull();
      if (mode === 'propose-change') expect(o.proposals.length).toBeGreaterThan(0);
      if (mode === 'read-only') {
        expect(o.proposals).toEqual([]);
        expect(o.findings.length + allSentences(o).length).toBeGreaterThan(0);
      }
      for (const p of o.proposals) {
        expect(p.beforeText).not.toBe(p.afterText);
        expect(p.rationale.length).toBeGreaterThan(20);
        expect(p.evidence.length).toBeGreaterThan(0);
        expect(unresolvedRefs(portfolio, p.evidence)).toEqual([]);
      }
      for (const f of o.findings) expect(f.provenance).toBe('scripted-agent');
    });
  }

  it('is deterministic: the same input gives the same output', () => {
    for (const agentId of AGENT_IDS) expect(run(agentId, DEFAULT_SCOPE[agentId])).toEqual(run(agentId, DEFAULT_SCOPE[agentId]));
  });

  it('accepts deliverable, programme and portfolio scopes where they make sense, and refuses others with a reason', () => {
    expect(run('status-reporting', { kind: 'programme', pmNodeId: 'pm-ccr' }).draft?.title).toContain('PG-CCR');
    expect(run('status-reporting', { kind: 'portfolio' }).draft?.deliverableId).toBeNull();
    expect(run('executive-briefing', { kind: 'programme', pmNodeId: 'pm-ccr' }).draft).not.toBeNull();
    const refused = runAgent('executive-briefing', { kind: 'deliverable', deliverableId: HERO_DELIVERABLE_ID }, { data: portfolio, results: computeAll(portfolio, DEMO_CLOCK), clock: DEMO_CLOCK });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.reason).toMatch(/runs on/);
    const missing = runAgent('status-reporting', { kind: 'deliverable', deliverableId: 'td-nope' }, { data: portfolio, results: computeAll(portfolio, DEMO_CLOCK), clock: DEMO_CLOCK });
    expect(missing.ok).toBe(false);
  });
});

describe('drafts: every sentence carries a citation that resolves', () => {
  const cases: [AgentId, AgentRunScope][] = [
    ...AGENT_IDS.map((id) => [id, DEFAULT_SCOPE[id]] as [AgentId, AgentRunScope]),
    ['status-reporting', { kind: 'portfolio' }],
    ['status-reporting', { kind: 'programme', pmNodeId: 'pm-ccr' }],
    ['status-reporting', { kind: 'deliverable', deliverableId: WORKFLOW_DELIVERABLE_ID }],
    ['executive-briefing', { kind: 'programme', pmNodeId: 'pm-frtb' }],
    ['release-readiness', { kind: 'portfolio' }],
    ['control-evidence-check', { kind: 'portfolio' }],
    ['portfolio-reconciliation', { kind: 'deliverable', deliverableId: HERO_DELIVERABLE_ID }],
  ];
  for (const [agentId, scope] of cases) {
    it(`${agentId} on ${scope.kind}`, () => {
      const o = run(agentId, scope);
      for (const s of allSentences(o)) {
        expect(s.citations.length, s.text).toBeGreaterThan(0);
        expect(unresolvedRefs(portfolio, s.citations), s.text).toEqual([]);
      }
    });
  }
  for (const d of portfolio.deliverables) {
    it(`status report for ${d.ref}`, () => {
      const o = run('status-reporting', { kind: 'deliverable', deliverableId: d.id });
      expect(o.draft?.sections.map((s) => s.heading)).toEqual(['Headline', 'Progress', 'Milestones', 'Risks and issues', 'Dependencies', 'Decisions needed', 'Next period']);
      for (const s of allSentences(o)) expect(unresolvedRefs(portfolio, s.citations), s.text).toEqual([]);
    });
  }
});

describe('status reporting content', () => {
  it('states plainly that the evidence does not support the hero deliverable’s reported Green, with the three measures separate', () => {
    const o = run('status-reporting', { kind: 'deliverable', deliverableId: HERO_DELIVERABLE_ID });
    const t = text(o);
    expect(t).toMatch(/does not support the reported Green/);
    expect(t).toMatch(/Work completion is 82%/);
    expect(t).toMatch(/1 of 4 outcomes accepted/);
    expect(t).toMatch(/Delivery readiness is Not ready/);
    expect(t).toMatch(/9 days late/);
  });

  it('says the evidence supports the reported status on a clean fixture, and disagrees once a required test fails', () => {
    const clean = baseline();
    const ok = run('status-reporting', { kind: 'deliverable', deliverableId: 'td-1' }, clean, CLOCK);
    expect(text(ok)).toMatch(/evidence supports the reported Green/);
    const failing = change(clean, (d) => {
      d.evidence.push(evidence('ev-test-2', 'td-1', 'test-result', { workItemKey: 'S-2', result: 'fail', observedAt: '2027-03-06T10:00:00.000Z', source: 'test-harness', recordedById: null }));
    });
    const bad = run('status-reporting', { kind: 'deliverable', deliverableId: 'td-1' }, failing, CLOCK);
    expect(text(bad)).toMatch(/does not support the reported Green/);
    for (const s of allSentences(bad)) expect(unresolvedRefs(failing, s.citations)).toEqual([]);
  });
});

describe('changing the input changes the output', () => {
  const mutated = change(portfolio, (d) => {
    const ev = d.evidence.find((e) => e.id === 'ev-1001-tr');
    if (ev) ev.result = 'pass';
    const raid = d.raid.find((r) => r.id === 'raid-1001-2');
    if (raid) {
      raid.ownerId = null;
      raid.mitigationDue = null;
    }
    const item = d.workItems.find((w) => w.key === 'CCR-106');
    if (item) item.outcomeId = null;
    const blocked = d.workItems.find((w) => w.key === 'CCR-207');
    if (blocked) blocked.summary = `${blocked.summary} using the TD-1012 cut-over runbook`;
    const epic = d.workItems.find((w) => w.key === 'CCR-200');
    if (epic) epic.ownerId = 'p-owner-2';
    const outcome = d.outcomes.find((o) => o.id === 'oc-2001-1');
    if (outcome) outcome.title = 'Desk heads can sort limit breaches by age and severity';
    const dep = d.dependencies.find((x) => x.id === 'dep-01');
    if (dep) dep.status = 'delivered';
    if (dep) dep.deliveredOn = '2027-03-05';
  });
  for (const agentId of AGENT_IDS) {
    it(agentId, () => {
      const before = run(agentId, DEFAULT_SCOPE[agentId]);
      const after = run(agentId, DEFAULT_SCOPE[agentId], mutated);
      expect(JSON.stringify(after)).not.toBe(JSON.stringify(before));
    });
  }

  it('in specific, explainable ways', () => {
    expect(text(run('status-reporting', DEFAULT_SCOPE['status-reporting'], mutated))).not.toMatch(/9 days late/);
    expect(run('outcome-mapping', DEFAULT_SCOPE['outcome-mapping'], mutated).proposals.some((p) => p.target.id === 'CCR-106')).toBe(true);
    expect(run('raid-quality', DEFAULT_SCOPE['raid-quality'], mutated).proposals.some((p) => p.target.id === 'raid-1001-2')).toBe(true);
    expect(run('dependency-discovery', DEFAULT_SCOPE['dependency-discovery'], mutated).proposals.some((p) => p.patch.op === 'add-dependency' && p.patch.dependency.fromDeliverableId === 'td-1012')).toBe(true);
    expect(text(run('requirements-structuring', DEFAULT_SCOPE['requirements-structuring'], mutated))).toMatch(/sort limit breaches by age and severity/);
  });
});

describe('requirements structuring', () => {
  it('drafts credible stories with criteria for the thin workflow Epic, labelled as a scripted draft', () => {
    const o = run('requirements-structuring', DEFAULT_SCOPE['requirements-structuring']);
    expect(o.draft?.title).toMatch(/^Scripted draft/);
    expect(text(o)).toMatch(/As a desk head/);
    const p = o.proposals[0];
    expect(p?.patch.op).toBe('add-work-items');
    if (p?.patch.op !== 'add-work-items') return;
    expect(p.patch.epicKey).toBe('LIM-10');
    expect(p.patch.items.length).toBeGreaterThanOrEqual(3);
    expect(p.patch.criteria.every((c) => !c.mandatory)).toBe(true);
    for (const w of p.patch.items) expect(w.outcomeId).toBe('oc-2001-1');
  });
});

describe('playback and provider', () => {
  it('reveals steps progressively from their durations', () => {
    const o = run('status-reporting', DEFAULT_SCOPE['status-reporting']);
    const runLike = { steps: o.steps.map((s, i) => ({ ...s, id: `s${i}`, runId: 'r', index: i, status: 'done' as const })) };
    const total = playbackDuration(runLike);
    expect(playbackAt(runLike, 0).activeIndex).toBe(0);
    expect(playbackAt(runLike, 0).doneCount).toBe(0);
    expect(playbackAt(runLike, total / 2).done).toBe(false);
    expect(playbackAt(runLike, total).done).toBe(true);
    expect(playbackAt(runLike, Infinity).doneCount).toBe(runLike.steps.length);
    expect(playbackDuration(runLike, 2)).toBeCloseTo(total / 2);
  });

  it('has only the scripted provider, which never calls out', async () => {
    expect(scriptedProvider.kind).toBe('scripted');
    expect(scriptedProvider.live).toBe(false);
    const r = await scriptedProvider.generate({ agentId: 'status-reporting', purpose: 'test', messages: [{ role: 'user', content: 'Hello' }], context: [{ kind: 'deliverable', id: HERO_DELIVERABLE_ID }] });
    expect(r.text).toBe('Hello');
    expect(r.provenance).toBe('scripted-agent');
  });
});
