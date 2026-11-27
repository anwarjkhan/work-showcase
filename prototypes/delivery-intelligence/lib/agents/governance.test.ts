import { describe, expect, it } from 'vitest';
import { PRESENTER_PERSON_ID, WORKFLOW_DELIVERABLE_ID } from '@/lib/config/story';
import { createDemoActions } from '@/lib/store/actions';
import { createDemoStore } from '@/lib/store/store';
import type { ChangePatch, DemoState, ProposedChange } from '@/lib/types';
import { checkReviewDecision, GOVERNANCE_RULES } from './governance';
import { applyPatch } from './patches';
import { runFindings } from './registry';
import { describeWorkflow } from './workflow';

function setup() {
  const store = createDemoStore();
  const actions = createDemoActions(store);
  return { store, actions, s: () => store.getState() };
}

const agentIdentity = (s: DemoState) => s.data.agentIdentities[0]!.id;
const proposalsOf = (s: DemoState, runId: string) => s.proposals.filter((p) => p.runId === runId);

describe('autonomy ceiling by risk tier', () => {
  it('T4: advisory only, no approvable proposals, and approval is refused', () => {
    const { actions, s } = setup();
    const t4 = s().data.deliverables.find((d) => d.riskTier === 'T4' && d.id === 'td-1002')!;
    const r = actions.startAgentRun('outcome-mapping', { kind: 'deliverable', deliverableId: t4.id });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ps = proposalsOf(s(), r.value.runId);
    expect(ps.length).toBeGreaterThan(0);
    expect(ps.every((p) => p.status === 'advisory' && p.ceiling === 'advisory-only')).toBe(true);
    const before = s().data;
    const res = actions.approveProposal(ps[0]!.id, PRESENTER_PERSON_ID);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/advisory only/);
    expect(s().data).toBe(before);
    expect(s().audit.at(-1)?.action).toBe('governance.blocked');
  });

  it('T1: specifically allowed changes are auto-applied and audited', () => {
    const { actions, s } = setup();
    const r = actions.startAgentRun('outcome-mapping', { kind: 'deliverable', deliverableId: WORKFLOW_DELIVERABLE_ID });
    if (!r.ok) throw new Error(r.reason);
    const [p] = proposalsOf(s(), r.value.runId);
    expect(p?.status).toBe('auto-applied');
    expect(s().data.workItems.find((w) => w.key === 'LIM-13')?.outcomeId).toBe('oc-2001-1');
    expect(s().audit.some((a) => a.action === 'proposal.auto-applied')).toBe(true);
  });

  it('T1 changes that are not on the allowed list, and all T2 and T3 changes, are proposed only', () => {
    const { actions, s } = setup();
    const r1 = actions.runStageAgent(WORKFLOW_DELIVERABLE_ID);
    if (!r1.ok) throw new Error(r1.reason);
    expect(proposalsOf(s(), r1.value.runId).map((p) => p.status)).toEqual(['pending']);
    const r2 = actions.startAgentRun('raid-quality', { kind: 'portfolio' });
    if (!r2.ok) throw new Error(r2.reason);
    for (const p of proposalsOf(s(), r2.value.runId)) {
      if (p.riskTier === 'T2' || p.riskTier === 'T3') expect(p.status).toBe('pending');
      if (p.riskTier === 'T4') expect(p.status).toBe('advisory');
    }
  });
});

describe('an agent can never approve, accept or set readiness', () => {
  it('refuses an agent identity as approver, reviewer, acceptor or evidence recorder, and audits each refusal', () => {
    const { actions, s } = setup();
    const agent = agentIdentity(s());
    const r = actions.startAgentRun('raid-quality', { kind: 'portfolio' });
    if (!r.ok) throw new Error(r.reason);
    const pending = proposalsOf(s(), r.value.runId).find((p) => p.status === 'pending')!;
    const data = s().data;

    const results = [
      actions.approveProposal(pending.id, agent),
      actions.rejectProposal(pending.id, agent),
      actions.acceptCriterion('ac-oc-2001-1-1', agent),
      actions.approveReview(WORKFLOW_DELIVERABLE_ID, 'ideation-requirements', 'risk-lead', agent),
      actions.recordEvidence({ deliverableId: WORKFLOW_DELIVERABLE_ID, kind: 'test-result', result: 'pass', title: 'x', recordedById: agent, simulated: true }),
      actions.moveStage(WORKFLOW_DELIVERABLE_ID, 'forward', agent),
      actions.startAgentRun('status-reporting', { kind: 'portfolio' }, agent),
    ];
    for (const res of results) {
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.reason).toMatch(/Agents cannot/);
    }
    expect(s().data).toBe(data);
    const blocked = s().audit.filter((a) => a.action === 'governance.blocked');
    expect(blocked).toHaveLength(results.length);
    expect(blocked.every((a) => a.actor.kind === 'agent')).toBe(true);
  });

  it('has no action that sets readiness, and no patch can touch it', () => {
    const { actions, s } = setup();
    expect(Object.keys(actions).some((k) => /readiness/i.test(k))).toBe(false);
    const forged = { op: 'set-field', entity: 'deliverable', id: 'td-1001', field: 'readiness', before: null, after: 'ready' } as unknown as ChangePatch;
    expect(applyPatch(s().data, forged, s().clock.now).ok).toBe(false);
    // Agent output never carries anything but the four allowed patch kinds.
    for (const id of ['outcome-mapping', 'raid-quality', 'dependency-discovery', 'requirements-structuring'] as const) {
      const scope = id === 'requirements-structuring' ? { kind: 'deliverable' as const, deliverableId: WORKFLOW_DELIVERABLE_ID } : { kind: 'portfolio' as const };
      const r = actions.startAgentRun(id, scope);
      if (!r.ok) throw new Error(r.reason);
      for (const p of proposalsOf(s(), r.value.runId)) expect(['set-field', 'merge-raid', 'add-dependency', 'add-work-items']).toContain(p.patch.op);
    }
  });

  it('accepting a criterion needs the outcome’s named acceptance owner', () => {
    const { actions, s } = setup();
    const res = actions.acceptCriterion('ac-oc-2001-1-1', 'p-owner-1');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/acceptance owner/);
    expect(actions.acceptCriterion('ac-oc-2001-1-1', PRESENTER_PERSON_ID).ok).toBe(true);
    expect(s().data.criteria.find((c) => c.id === 'ac-oc-2001-1-1')?.acceptedById).toBe(PRESENTER_PERSON_ID);
    expect(s().audit.at(-1)?.action).toBe('criterion.accepted');
  });
});

describe('approval needs a named person who is not the item’s assignee', () => {
  it('refuses the assignee and accepts someone else', () => {
    const { actions, s } = setup();
    const r = actions.startAgentRun('outcome-mapping', { kind: 'portfolio' });
    if (!r.ok) throw new Error(r.reason);
    const p = proposalsOf(s(), r.value.runId).find((x) => x.status === 'pending' && x.assigneeId && s().data.people.some((pp) => pp.id === x.assigneeId)) as ProposedChange;
    expect(p).toBeDefined();
    const own = actions.approveProposal(p.id, p.assigneeId as string);
    expect(own.ok).toBe(false);
    if (!own.ok) expect(own.reason).toMatch(/assignee/);
    const nobody = actions.approveProposal(p.id, 'p-does-not-exist');
    expect(nobody.ok).toBe(false);
    expect(actions.approveProposal(p.id, PRESENTER_PERSON_ID).ok).toBe(true);
  });
});

describe('reported RAG is immutable', () => {
  it('refuses a patch on reported RAG and leaves it unchanged after approving everything', () => {
    const { actions, s } = setup();
    const forged = { op: 'set-field', entity: 'deliverable', id: 'td-1001', field: 'reportedRag', before: 'green', after: 'red' } as unknown as ChangePatch;
    const res = applyPatch(s().data, forged, s().clock.now);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/Reported RAG/);

    const ragBefore = [...s().data.deliverables, ...s().data.pmNodes].map((x) => [x.id, x.reportedRag]);
    for (const id of ['outcome-mapping', 'raid-quality', 'dependency-discovery'] as const) actions.startAgentRun(id, { kind: 'portfolio' });
    for (const p of s().proposals.filter((x) => x.status === 'pending')) actions.approveProposal(p.id, PRESENTER_PERSON_ID);
    expect(s().approvals.length).toBeGreaterThan(5);
    expect([...s().data.deliverables, ...s().data.pmNodes].map((x) => [x.id, x.reportedRag])).toEqual(ragBefore);
  });
});

describe('approve and reject', () => {
  it('approving changes the data, re-runs the engine and appends an audit event', () => {
    const { actions, s } = setup();
    const r = actions.startAgentRun('outcome-mapping', { kind: 'portfolio' });
    if (!r.ok) throw new Error(r.reason);
    const p = proposalsOf(s(), r.value.runId).find((x) => x.status === 'pending' && x.patch.op === 'set-field' && x.assigneeId !== PRESENTER_PERSON_ID)!;
    expect(p.patch.op).toBe('set-field');
    if (p.patch.op !== 'set-field') return;
    const key = p.patch.id;
    const finding = (st: DemoState) => st.results.findings.find((f) => f.ruleId === 'R9' && f.subject.id === key);
    expect(finding(s())).toBeDefined();
    const before = s();
    const auditLength = before.audit.length;
    const res = actions.approveProposal(p.id, PRESENTER_PERSON_ID, 'Agreed');
    expect(res.ok).toBe(true);
    const after = s();
    expect(after.data).not.toBe(before.data);
    expect(after.results).not.toBe(before.results);
    expect(after.data.workItems.find((w) => w.key === key)?.outcomeId).toBe(p.patch.after);
    expect(finding(after)).toBeUndefined();
    expect(after.proposals.find((x) => x.id === p.id)?.status).toBe('approved');
    expect(after.approvals.at(-1)).toMatchObject({ proposalId: p.id, decision: 'approved', approverId: PRESENTER_PERSON_ID });
    expect(after.audit.length).toBe(auditLength + 1);
    expect(after.audit.at(-1)?.action).toBe('proposal.approved');
  });

  it('rejecting changes nothing but is logged', () => {
    const { actions, s } = setup();
    const r = actions.startAgentRun('raid-quality', { kind: 'portfolio' });
    if (!r.ok) throw new Error(r.reason);
    const p = proposalsOf(s(), r.value.runId).find((x) => x.status === 'pending')!;
    const before = s();
    expect(actions.rejectProposal(p.id, PRESENTER_PERSON_ID, 'Not now').ok).toBe(true);
    const after = s();
    expect(after.data).toBe(before.data);
    expect(after.results).toBe(before.results);
    expect(after.proposals.find((x) => x.id === p.id)?.status).toBe('rejected');
    expect(after.approvals.at(-1)?.decision).toBe('rejected');
    expect(after.audit.at(-1)?.action).toBe('proposal.rejected');
    // A decided proposal cannot be decided again.
    expect(actions.approveProposal(p.id, PRESENTER_PERSON_ID).ok).toBe(false);
  });

  it('a rerun supersedes the earlier pending proposal for the same change', () => {
    const { actions, s } = setup();
    actions.startAgentRun('raid-quality', { kind: 'portfolio' });
    const first = s().proposals.filter((p) => p.status === 'pending').length;
    actions.startAgentRun('raid-quality', { kind: 'portfolio' });
    expect(s().proposals.filter((p) => p.status === 'superseded')).toHaveLength(first);
    expect(s().proposals.filter((p) => p.status === 'pending')).toHaveLength(first);
  });
});

describe('runs and audit', () => {
  it('stores the run, its steps, findings, proposals and draft, and audits start and completion', () => {
    const { actions, s } = setup();
    const r = actions.startAgentRun('status-reporting', { kind: 'programme', pmNodeId: 'pm-ccr' });
    if (!r.ok) throw new Error(r.reason);
    const run = s().agentRuns.find((x) => x.id === r.value.runId)!;
    expect(run.status).toBe('completed');
    expect(run.providerId).toBe('scripted');
    expect(run.startedById).toBe(PRESENTER_PERSON_ID);
    expect(run.steps.length).toBeGreaterThan(2);
    expect(s().drafts.find((d) => d.id === run.draftId)?.title).toContain('PG-CCR');
    const actionsLogged = s().audit.map((a) => a.action);
    expect(actionsLogged[0]).toBe('agent-run.started');
    expect(actionsLogged).toContain('draft.created');
    expect(actionsLogged.at(-1)).toBe('agent-run.completed');
    const rq = actions.startAgentRun('raid-quality', { kind: 'portfolio' });
    if (!rq.ok) throw new Error(rq.reason);
    const rqRun = s().agentRuns.find((x) => x.id === rq.value.runId)!;
    expect(runFindings(rqRun).length).toBe(rqRun.findingIds.length);
    expect(s().audit.filter((a) => a.action === 'proposal.created')).toHaveLength(rqRun.proposalIds.length);
  });
});

describe('reset', () => {
  it('restores the seeded state exactly', () => {
    const { store, actions, s } = setup();
    const pristine = s();
    const fresh = JSON.stringify({ ...pristine, revision: 0 });
    actions.startAgentRun('raid-quality', { kind: 'portfolio' });
    for (const p of s().proposals.filter((x) => x.status === 'pending').slice(0, 3)) actions.approveProposal(p.id, PRESENTER_PERSON_ID);
    actions.runStageAgent(WORKFLOW_DELIVERABLE_ID);
    actions.acceptCriterion('ac-oc-2001-1-1', PRESENTER_PERSON_ID);
    actions.recordEvidence({ deliverableId: WORKFLOW_DELIVERABLE_ID, kind: 'test-result', result: 'fail', title: 'Run', recordedById: PRESENTER_PERSON_ID, simulated: true });
    expect(s().data).not.toBe(pristine.data);
    store.reset();
    const after = s();
    expect(after.data).toBe(after.seed);
    expect(after.data).toBe(pristine.seed);
    expect(after.results).toBe(pristine.results);
    expect(JSON.stringify({ ...after, revision: 0 })).toBe(fresh);
    // Replaying gives the same ids and timestamps.
    const r = actions.startAgentRun('raid-quality', { kind: 'portfolio' });
    expect(r.ok && r.value.runId).toBe('run-1');
  });
});

describe('Core Four review decisions (G6)', () => {
  const coreOf = (s: DemoState, id: string) => s.data.deliverables.find((d) => d.id === id)!.coreTeam;
  const nameOf = (s: DemoState, id: string) => s.data.people.find((p) => p.id === id)!.name;

  it('is stated as a rule', () => {
    expect(GOVERNANCE_RULES.find((r) => r.id === 'G6')?.text).toMatch(/Only the person holding a role decides that role's reviews, in order; the Product Manager takes the gate decision last at every stage/);
  });

  it('refuses everyone but the holder, in order, the Product Manager last', () => {
    const { s } = setup();
    const core = coreOf(s(), WORKFLOW_DELIVERABLE_ID);
    const risk = core['risk-lead']!.personId;
    expect(checkReviewDecision(s().data, WORKFLOW_DELIVERABLE_ID, 'ideation-requirements', 'risk-lead', risk)).toEqual({ ok: true });
    expect(checkReviewDecision(s().data, WORKFLOW_DELIVERABLE_ID, 'ideation-requirements', 'risk-lead', PRESENTER_PERSON_ID)).toMatchObject({ ok: false, code: 'not-role-holder' });
    expect(checkReviewDecision(s().data, WORKFLOW_DELIVERABLE_ID, 'ideation-requirements', 'product-manager', PRESENTER_PERSON_ID)).toMatchObject({
      ok: false,
      code: 'review-out-of-order',
      reason: expect.stringMatching(new RegExp(`^Waiting on the In-Business Risk Lead \\(${nameOf(s(), risk)}\\) to name the obligations that apply and the UX Design Lead`)),
    });
    expect(checkReviewDecision(s().data, WORKFLOW_DELIVERABLE_ID, 'ideation-requirements', 'risk-lead', s().data.agentIdentities[0]!.id)).toMatchObject({ ok: false, code: 'agent-actor' });
  });

  it('refuses a person holding two core roles on the deliverable, audits it, and the engine flags it', () => {
    const { actions, s } = setup();
    const core = coreOf(s(), 'td-1005');
    const both = core['tech-lead']!.personId;
    expect(core['ux-lead']!.personId).toBe(both);
    const run = s().data.pdlcRuns.find((r) => r.deliverableId === 'td-1005')!;
    const res = actions.approveReview('td-1005', run.currentStage, 'tech-lead', both);
    expect(res).toEqual({ ok: false, reason: `${nameOf(s(), both)} holds both the Tech Lead and UX Design Lead roles on TD-1005; one person may not hold two core roles, so they cannot decide its reviews until one seat is given to someone else.` });
    expect(s().audit.at(-1)).toMatchObject({ action: 'governance.blocked', details: { code: 'two-core-roles' } });
    expect(s().results.findings.some((f) => f.ruleId === 'R15' && f.deliverableId === 'td-1005' && f.message.includes('holds both'))).toBe(true);
    const step = describeWorkflow(s().data, s().results, 'td-1005', PRESENTER_PERSON_ID)!.nextReview!;
    expect(step).toMatchObject({ roleId: 'tech-lead', personId: both, blocked: expect.stringMatching(/two core roles/) });
  });

  it('refuses any decision on a review whose role is unfilled', () => {
    const { actions, s } = setup();
    expect(coreOf(s(), 'td-1014')['risk-lead']).toBeUndefined();
    const res = actions.approveReview('td-1014', 'risk-control-compliance', 'risk-lead', PRESENTER_PERSON_ID);
    expect(res).toEqual({ ok: false, reason: 'TD-1014 has no In-Business Risk Lead named, so this review cannot be decided until one joins the Core Four.' });
    const view = describeWorkflow(s().data, s().results, 'td-1014', PRESENTER_PERSON_ID)!;
    expect(view.coreTeamGaps.missing).toEqual(['risk-lead']);
    expect(view.nextReview).toMatchObject({ roleId: 'risk-lead', personId: null, personName: null, needsActAs: false, label: 'Confirm as In-Business Risk Lead' });
    expect(view.nextReview!.blocked).toMatch(/no In-Business Risk Lead named/);
  });
});
