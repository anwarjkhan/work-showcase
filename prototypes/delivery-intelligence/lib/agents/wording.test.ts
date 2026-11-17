/**
 * Every user-visible sentence from lib/agents and the store actions names
 * records by their human key, ref, title or name, never by internal id.
 * Ids stay in the structured `target` / `refs` fields.
 */
import { describe, expect, it } from 'vitest';
import { DEMO_CLOCK } from '@/lib/config/clock';
import { HERO_DELIVERABLE_ID, PRESENTER_PERSON_ID as ME, WORKFLOW_DELIVERABLE_ID as TD } from '@/lib/config/story';
import { createSyntheticPortfolio } from '@/lib/data/synthetic';
import { computeAll } from '@/lib/engine';
import { createDemoActions } from '@/lib/store/actions';
import { createDemoStore } from '@/lib/store/store';
import type { ActionResult, AgentRunOutput } from '@/lib/types';
import { AGENT_IDS } from './catalogue';
import { runAgent } from './registry';
import type { AgentRunScope } from './types';

const ID_PATTERN = /\b(raid|td|oc|p|dep|ev|pm|ac|ai|ir|ms|hub|pod|pdlc|run|approval|audit|move|decision|spr)-[a-z0-9]/;

function texts(o: AgentRunOutput): string[] {
  return [
    o.summary,
    ...o.steps.flatMap((s) => [s.label, s.detail]),
    ...o.proposals.flatMap((p) => [p.title, p.rationale, p.beforeText, p.afterText]),
    ...o.findings.map((f) => f.message),
    ...(o.draft ? [o.draft.title, ...o.draft.sections.flatMap((s) => [s.heading, ...s.sentences.map((x) => x.text)])] : []),
  ];
}

/** A dangling Deliverable ID field is reported with the value the field holds; that value is data, not an internal id leak. */
const FIELD_VALUE = /Deliverable ID “[^”]*”/g;
const leaks = (list: string[]) => list.filter((t) => ID_PATTERN.test(t.replace(FIELD_VALUE, '')));

describe('no internal ids in user-visible text', () => {
  const data = createSyntheticPortfolio();
  const results = computeAll(data, DEMO_CLOCK);
  const scopes: AgentRunScope[] = [
    { kind: 'portfolio' },
    { kind: 'programme', pmNodeId: 'pm-ccr' },
    { kind: 'deliverable', deliverableId: HERO_DELIVERABLE_ID },
    { kind: 'deliverable', deliverableId: TD },
    { kind: 'pdlc-stage', deliverableId: TD, stageId: 'ideation-requirements' },
  ];

  it('in agent steps, proposals, findings and drafts', () => {
    const found: string[] = [];
    for (const id of AGENT_IDS) {
      for (const scope of scopes) {
        const r = runAgent(id, scope, { data, results, clock: DEMO_CLOCK });
        found.push(...(r.ok ? leaks(texts(r.output)) : leaks([r.reason])));
      }
    }
    expect(found).toEqual([]);
  });

  it('in audit summaries and refusal reasons', () => {
    const store = createDemoStore();
    const a = createDemoActions(store);
    const s = () => store.getState();
    const reasons: string[] = [];
    const note = (r: ActionResult<unknown>) => {
      if (!r.ok) reasons.push(r.reason);
    };
    const agent = s().data.agentIdentities[0]!.id;

    for (const id of AGENT_IDS) note(a.startAgentRun(id, id === 'requirements-structuring' ? { kind: 'deliverable', deliverableId: TD } : { kind: 'portfolio' }));
    const pending = s().proposals.filter((p) => p.status === 'pending');
    const owned = pending.find((p) => p.assigneeId && s().data.people.some((x) => x.id === p.assigneeId));
    if (owned) note(a.approveProposal(owned.id, owned.assigneeId as string));
    note(a.approveProposal(pending[0]!.id, agent));
    const advisory = s().proposals.find((p) => p.status === 'advisory');
    if (advisory) note(a.approveProposal(advisory.id, ME));
    for (const p of pending.slice(0, 4)) note(a.approveProposal(p.id, ME));
    note(a.rejectProposal(pending[5]!.id, ME, 'Not now'));
    note(a.approveProposal(pending[5]!.id, ME));
    note(a.acceptCriterion('ac-oc-2001-1-1', 'p-owner-1'));
    note(a.acceptCriterion('ac-oc-2001-1-1', agent));
    note(a.approveReview(TD, 'ideation-requirements', 'requirements-owner', 'p-owner-1'));
    note(a.approveReview(TD, 'design-specifications', 'design-reviewer', ME));
    note(a.moveStage(TD, 'forward', ME));
    note(a.simulateWorkClosed(TD, ME));
    note(a.recordEvidence({ deliverableId: TD, kind: 'business-acceptance', result: 'pass', title: 'x', outcomeId: 'oc-2001-1', recordedById: ME, simulated: false }));
    note(a.recordEvidence({ deliverableId: TD, kind: 'business-acceptance', result: 'pass', title: 'x', outcomeId: 'oc-1001-1', recordedById: ME, simulated: false }));
    note(a.runStageAgent(TD));
    note(a.approveReview(TD, 'ideation-requirements', 'requirements-owner', ME));
    note(a.moveStage(TD, 'forward', ME));
    note(a.returnReview(TD, 'design-specifications', 'design-reviewer', ME, 'Outcome map incomplete.'));
    note(a.moveStage(TD, 'back', ME));
    note(a.startAgentRun('status-reporting', { kind: 'deliverable', deliverableId: 'td-nope' }));
    note(a.startAgentRun('executive-briefing', { kind: 'deliverable', deliverableId: HERO_DELIVERABLE_ID }));

    expect(reasons.length).toBeGreaterThan(8);
    expect(leaks(reasons)).toEqual([]);
    expect(leaks(s().audit.map((e) => e.summary))).toEqual([]);
    expect(s().audit.some((e) => e.action === 'governance.blocked')).toBe(true);
  });
});
