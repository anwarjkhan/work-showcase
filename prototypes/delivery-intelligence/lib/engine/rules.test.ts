import { describe, expect, it } from 'vitest';
import { RULE_SEVERITY } from '@/lib/config/thresholds';
import { terms } from '@/lib/config/terminology';
import type { Finding, PortfolioData, RuleId } from '@/lib/types';
import { computeAll, titleSimilarity } from './index';
import {
  CLOCK,
  baseline,
  change,
  criterion,
  deliverable,
  dependency,
  epic,
  evidence,
  item,
  milestone,
  openStory,
  outcome,
  raid,
  story,
} from './test-fixtures';

function findings(data: PortfolioData, ruleId: RuleId): Finding[] {
  return computeAll(data, CLOCK).findings.filter((f) => f.ruleId === ruleId);
}

/** Baseline plus a second deliverable that provides to td-1. */
function withProvider(fn: (d: PortfolioData) => void): PortfolioData {
  return change(baseline(), (d) => {
    d.deliverables.push(deliverable({ id: 'td-p', ref: 'TD-P', reportedRag: 'amber' }));
    fn(d);
  });
}

describe('every finding', () => {
  it('carries the configured severity, a deliverable, provenance and resolvable references', () => {
    const data = change(baseline(), (d) => {
      d.workItems.push(openStory('S-9', 'E-1', null, { due: '2027-03-01' }));
    });
    const all = computeAll(data, CLOCK).findings;
    expect(all.length).toBeGreaterThan(0);
    for (const f of all) {
      expect(f.severity).toBe(RULE_SEVERITY[f.ruleId]);
      expect(f.provenance).toBe('computed');
      expect(f.detectedAt).toBe(CLOCK.now);
      expect(f.deliverableId).toBe('td-1');
      expect(f.evidence.length).toBeGreaterThan(0);
    }
    expect(new Set(all.map((f) => f.id)).size).toBe(all.length);
  });
});

describe('R1 milestone due soon with too little linked work closed', () => {
  it('hits: due in 9 days with 38% of linked work closed', () => {
    const data = change(baseline(), (d) => {
      d.workItems.push(openStory('S-4', 'E-1', 'oc-1', { points: 8 }));
      d.milestones.push(milestone('ms-1', 'td-1', { date: '2027-03-17', title: 'Quarter-end run', workItemKeys: ['S-1', 'S-4'] }));
    });
    const [f] = findings(data, 'R1');
    expect(f).toBeDefined();
    expect(f!.subject).toEqual({ kind: 'milestone', id: 'ms-1' });
    expect(f!.message).toBe('Milestone “Quarter-end run” is due in 9 days (17 Mar 2027) with 38% of linked work closed (5 of 13 points); 1 item still open.');
    expect(f!.evidence).toContainEqual({ kind: 'work-item', id: 'S-4' });
  });

  it('uses all of the deliverable’s work when the milestone links none', () => {
    const data = change(baseline(), (d) => {
      d.workItems.push(openStory('S-4', 'E-1', 'oc-1', { points: 30 }));
      d.milestones.push(milestone('ms-1', 'td-1', { date: '2027-03-10' }));
    });
    expect(findings(data, 'R1')).toHaveLength(1);
  });

  it('misses: enough work closed, due outside the window, or already met', () => {
    const enough = change(baseline(), (d) => {
      d.milestones.push(milestone('ms-1', 'td-1', { date: '2027-03-17' }));
    });
    const far = change(baseline(), (d) => {
      d.workItems.push(openStory('S-4', 'E-1', 'oc-1', { points: 30 }));
      d.milestones.push(milestone('ms-1', 'td-1', { date: '2027-03-23' }));
    });
    const met = change(baseline(), (d) => {
      d.workItems.push(openStory('S-4', 'E-1', 'oc-1', { points: 30 }));
      d.milestones.push(milestone('ms-1', 'td-1', { date: '2027-03-17', status: 'met' }));
    });
    for (const data of [enough, far, met]) expect(findings(data, 'R1')).toEqual([]);
  });
});

describe('R2 Epic closed while children remain open', () => {
  it('hits', () => {
    const data = change(baseline(), (d) => {
      d.workItems[0] = epic('E-1', 'td-1', { status: 'Done', statusCategory: 'done' });
      d.workItems.push(openStory('S-4', 'E-1', 'oc-1'));
    });
    const [f] = findings(data, 'R2');
    expect(f!.subject).toEqual({ kind: 'work-item', id: 'E-1' });
    expect(f!.message).toBe(`${terms.hierarchy.epic} E-1 “Item E-1” is closed in ${terms.systems['work-tracker']} while 1 child item is still open.`);
  });

  it('misses: closed Epic with all children closed', () => {
    const data = change(baseline(), (d) => {
      d.workItems[0] = epic('E-1', 'td-1', { status: 'Done', statusCategory: 'done' });
    });
    expect(findings(data, 'R2')).toEqual([]);
  });
});

describe('R3 due date passed and item not closed', () => {
  it('hits', () => {
    const data = change(baseline(), (d) => {
      d.workItems.push(openStory('S-4', 'E-1', 'oc-1', { due: '2027-02-27', summary: 'Market-data extract', statusCategory: 'in-progress' }));
    });
    const [f] = findings(data, 'R3');
    expect(f!.message).toBe('S-4 “Market-data extract” was due on 27 Feb 2027 (9 days ago) and is still in progress.');
    expect(f!.deliverableId).toBe('td-1');
  });

  it('misses: due today or later, or closed', () => {
    const data = change(baseline(), (d) => {
      d.workItems.push(openStory('S-4', 'E-1', 'oc-1', { due: '2027-03-08' }));
      d.workItems.push(story('S-5', 'E-1', 'oc-1', { due: '2027-02-01' }));
    });
    expect(findings(data, 'R3')).toEqual([]);
  });
});

describe('R4 RAID item with no owner, no mitigation date, or no recent update', () => {
  it('hits on each gap and names them all', () => {
    const data = change(baseline(), (d) => {
      d.raid.push(raid('r-1', 'td-1', { ownerId: null }));
      d.raid.push(raid('r-2', 'td-1', { mitigationDue: null, title: 'Second' }));
      d.raid.push(raid('r-3', 'td-1', { updated: '2027-02-13T09:00:00.000Z', title: 'Late market data', severity: 'high' }));
      d.raid.push(raid('r-4', 'td-1', { ownerId: null, mitigationDue: null, title: 'Fourth' }));
    });
    const fs = findings(data, 'R4');
    expect(fs.map((f) => f.subject.id).sort()).toEqual(['r-1', 'r-2', 'r-3', 'r-4']);
    expect(fs.find((f) => f.subject.id === 'r-3')!.message).toBe('Risk R-3 “Late market data” (High) has no update for 23 days.');
    expect(fs.find((f) => f.subject.id === 'r-4')!.message).toContain('has no owner and no mitigation date.');
  });

  it('misses: owned, dated and updated within 14 days, or closed', () => {
    const data = change(baseline(), (d) => {
      d.raid.push(raid('r-1', 'td-1'));
      d.raid.push(raid('r-2', 'td-1', { status: 'closed', ownerId: null, title: 'Other' }));
    });
    expect(findings(data, 'R4')).toEqual([]);
  });
});

describe('R5 reported Green while a critical dependency is blocked or late', () => {
  it('hits for a late dependency', () => {
    const data = withProvider((d) => {
      d.dependencies.push(dependency('dep-1', 'td-p', 'td-1', { title: 'Market-data extract', needBy: '2027-02-27', committed: '2027-03-08', status: 'late' }));
    });
    const [f] = findings(data, 'R5');
    expect(f!.severity).toBe('critical');
    expect(f!.message).toBe(
      `TD-1 is reported ${terms.rag.green} in ${terms.systems['portfolio-system']}, but critical dependency “Market-data extract” from TD-P (Singapore) is 9 days late (needed by 27 Feb 2027, committed for 8 Mar 2027).`,
    );
  });

  it('hits for a blocked dependency', () => {
    const data = withProvider((d) => {
      d.dependencies.push(dependency('dep-1', 'td-p', 'td-1', { status: 'blocked' }));
    });
    expect(findings(data, 'R5')[0]!.message).toContain('is blocked');
  });

  it('misses: not reported Green, not critical, or on track', () => {
    const amber = withProvider((d) => {
      d.deliverables[0]!.reportedRag = 'amber';
      d.dependencies.push(dependency('dep-1', 'td-p', 'td-1', { status: 'blocked' }));
    });
    const nonCritical = withProvider((d) => {
      d.dependencies.push(dependency('dep-1', 'td-p', 'td-1', { status: 'blocked', critical: false }));
    });
    const onTrack = withProvider((d) => {
      d.dependencies.push(dependency('dep-1', 'td-p', 'td-1'));
    });
    for (const data of [amber, nonCritical, onTrack]) expect(findings(data, 'R5')).toEqual([]);
  });
});

describe('R6 committed date after need-by', () => {
  it('hits', () => {
    const data = withProvider((d) => {
      d.dependencies.push(dependency('dep-1', 'td-p', 'td-1', { title: 'Feed', needBy: '2027-04-01', committed: '2027-04-15' }));
    });
    const [f] = findings(data, 'R6');
    expect(f!.deliverableId).toBe('td-1');
    expect(f!.message).toBe('“Feed” is committed for 15 Apr 2027, 14 days after TD-1 needs it (1 Apr 2027); provider TD-P.');
  });

  it('misses: committed on or before need-by, or delivered', () => {
    const data = withProvider((d) => {
      d.dependencies.push(dependency('dep-1', 'td-p', 'td-1', { needBy: '2027-04-15', committed: '2027-04-15' }));
      d.dependencies.push(dependency('dep-2', 'td-p', 'td-1', { needBy: '2027-04-01', committed: '2027-04-15', status: 'delivered', deliveredOn: '2027-03-01' }));
    });
    expect(findings(data, 'R6')).toEqual([]);
  });
});

describe('R7 likely duplicate RAID items', () => {
  it('hits on overlapping titles, flagging the later item', () => {
    const data = change(baseline(), (d) => {
      d.raid.push(raid('r-1', 'td-1', { title: 'Stressed market data arrives late from partner hub' }));
      d.raid.push(raid('r-2', 'td-1', { title: 'Market data from partner hub arrives late', created: '2027-02-10T09:00:00.000Z' }));
    });
    const [f] = findings(data, 'R7');
    expect(f!.subject).toEqual({ kind: 'raid', id: 'r-2' });
    expect(f!.evidence).toContainEqual({ kind: 'raid', id: 'r-1' });
  });

  it('misses: different titles, or one item closed', () => {
    const different = change(baseline(), (d) => {
      d.raid.push(raid('r-1', 'td-1', { title: 'Stressed market data arrives late' }));
      d.raid.push(raid('r-2', 'td-1', { title: 'Validator capacity in March' }));
    });
    const closed = change(baseline(), (d) => {
      d.raid.push(raid('r-1', 'td-1', { title: 'Market data arrives late' }));
      d.raid.push(raid('r-2', 'td-1', { title: 'Market data arrives late', status: 'closed' }));
    });
    expect(findings(different, 'R7')).toEqual([]);
    expect(findings(closed, 'R7')).toEqual([]);
  });

  it('scores similarity as token Jaccard ignoring case and stop words', () => {
    expect(titleSimilarity('Market data late', 'market DATA is late')).toBe(1);
    expect(titleSimilarity('alpha beta', 'gamma delta')).toBe(0);
  });
});

describe('R8 portfolio-system fields disagree with the Jira Epic', () => {
  it('hits on dates, owner and Deliverable ID', () => {
    const data = change(baseline(), (d) => {
      d.deliverables.push(deliverable({ id: 'td-2', ref: 'TD-2', epicKeys: ['E-5'] }));
      d.workItems[0] = epic('E-1', 'td-1', { targetDate: '2027-07-15', ownerId: 'p-eng' });
      d.workItems.push(epic('E-5', 'td-1')); // listed under td-2 in the book of record
    });
    const fs = findings(data, 'R8');
    const e1 = fs.find((f) => f.subject.id === 'E-1')!;
    expect(e1.message).toBe(
      `${terms.systems['portfolio-system']} and ${terms.systems['work-tracker']} disagree on Epic E-1 “Item E-1”: target 15 Jul 2027 in ${terms.systems['work-tracker']} is after the planned end 30 Jun 2027 in ${terms.systems['portfolio-system']} and owner is Eli Engineer in ${terms.systems['work-tracker']} but Olive Owner in ${terms.systems['portfolio-system']}.`,
    );
    const e5 = fs.find((f) => f.subject.id === 'E-5')!;
    expect(e5.message).toContain('Deliverable ID is TD-1 in');
    expect(e5.deliverableId).toBe('td-2');
  });

  it('hits when the book of record lists an Epic the work tracker does not have', () => {
    const data = change(baseline(), (d) => {
      d.deliverables[0]!.epicKeys.push('E-404');
    });
    expect(findings(data, 'R8').map((f) => f.id)).toEqual(['f-R8-deliverable-td-1-E-404']);
  });

  it('misses: Epic dates inside the planned window and same owner', () => {
    const data = change(baseline(), (d) => {
      d.workItems[0] = epic('E-1', 'td-1', { startDate: '2027-02-01', targetDate: '2027-04-30' });
    });
    expect(findings(data, 'R8')).toEqual([]);
  });
});

describe('R9 story-level item with no Outcome ID', () => {
  it('hits on a missing or unknown Outcome ID', () => {
    const data = change(baseline(), (d) => {
      d.workItems.push(openStory('S-4', 'E-1', null), openStory('S-5', 'E-1', 'oc-nope'));
    });
    const fs = findings(data, 'R9');
    expect(fs.map((f) => f.subject.id)).toEqual(['S-4', 'S-5']);
    expect(fs[0]!.message).toBe(`Story S-4 “Item S-4” has no ${terms.hierarchy.outcomeIdField}, so it counts towards no outcome.`);
  });

  it('misses: mapped items, RAID-type items and Epics', () => {
    const data = change(baseline(), (d) => {
      d.workItems.push(openStory('S-4', 'E-1', null, { type: 'raid' }));
    });
    expect(findings(data, 'R9')).toEqual([]);
  });
});

describe('R10 agent-assigned item with no named human reviewer', () => {
  it('hits', () => {
    const data = change(baseline(), (d) => {
      d.workItems.push(openStory('S-4', 'E-1', 'oc-1', { assigneeType: 'agent', assigneeId: 'ai-1', reviewerId: null }));
      d.workItems.push(openStory('S-5', 'E-1', 'oc-1', { assigneeType: 'agent', assigneeId: 'ai-1', reviewerId: 'ai-1' }));
    });
    const fs = findings(data, 'R10');
    expect(fs.map((f) => f.subject.id)).toEqual(['S-4', 'S-5']);
    expect(fs[0]!.message).toBe('S-4 “Item S-4” is assigned to agent agent-status-01 with no named human reviewer.');
  });

  it('misses: agent item with a named reviewer, human item without one', () => {
    const data = change(baseline(), (d) => {
      d.workItems.push(openStory('S-4', 'E-1', 'oc-1', { assigneeType: 'agent', assigneeId: 'ai-1', reviewerId: 'p-eng' }));
      d.workItems.push(openStory('S-5', 'E-1', 'oc-1', { reviewerId: null }));
    });
    expect(findings(data, 'R10')).toEqual([]);
  });
});

describe('R11 outcome reported on track or complete with no acceptance recorded', () => {
  const pm = terms.systems['portfolio-system'];
  /** Baseline with oc-1 no longer accepted (its business-acceptance record removed). */
  const unaccepted = (fn: (d: PortfolioData) => void = () => {}) =>
    change(baseline(), (d) => {
      d.evidence = d.evidence.filter((e) => e.id !== 'ev-ba-1');
      fn(d);
    });

  it('hits (a): reported complete and not accepted', () => {
    const data = unaccepted((d) => {
      d.outcomes[0]!.reportedStatus = 'complete';
      d.workItems.push(openStory('S-4', 'E-1', 'oc-1'));
    });
    const [f] = findings(data, 'R11');
    expect(f!.subject).toEqual({ kind: 'outcome', id: 'oc-1' });
    expect(f!.message).toBe(`Outcome “Outcome oc-1” (TD-1) is reported complete in ${pm} with no acceptance recorded: no business acceptance record is held.`);
  });

  it('hits (b1): reported on track, past its due date, work still open', () => {
    const data = unaccepted((d) => {
      d.outcomes[0]!.dueDate = '2027-02-24';
      d.workItems.push(openStory('S-4', 'E-1', 'oc-1'));
      d.criteria[0] = criterion('c-1', 'oc-1', { state: 'open', acceptedById: null, acceptedAt: null });
    });
    const [f] = findings(data, 'R11');
    expect(f!.message).toBe(
      `Outcome “Outcome oc-1” (TD-1) is reported on track in ${pm}, due 12 days ago, with no acceptance recorded: its mandatory criterion is not accepted and no business acceptance record is held.`,
    );
  });

  it('hits (b2): reported on track, not yet due, all linked work closed', () => {
    const [f] = findings(unaccepted(), 'R11');
    expect(f!.message).toBe(
      `Outcome “Outcome oc-1” (TD-1) is reported on track in ${pm} with all linked work closed (2 items) and no acceptance recorded: no business acceptance record is held.`,
    );
    expect(f!.evidence).toContainEqual({ kind: 'work-item', id: 'S-1' });
  });

  it('misses: on track, not yet due, with open work (the normal case)', () => {
    const data = unaccepted((d) => {
      d.workItems.push(openStory('S-4', 'E-1', 'oc-1'));
    });
    expect(findings(data, 'R11')).toEqual([]);
  });

  it('misses: on track, not yet due, with no linked work', () => {
    const data = change(baseline(), (d) => {
      d.outcomes.push(outcome('oc-3', 'td-1'));
    });
    expect(findings(data, 'R11')).toEqual([]);
  });

  it('misses: due today is not yet overdue', () => {
    const data = unaccepted((d) => {
      d.outcomes[0]!.dueDate = '2027-03-08';
      d.workItems.push(openStory('S-4', 'E-1', 'oc-1'));
    });
    expect(findings(data, 'R11')).toEqual([]);
  });

  it('misses: accepted outcomes under every condition', () => {
    const data = change(baseline(), (d) => {
      d.outcomes[0]!.reportedStatus = 'complete';
      d.outcomes[1]!.dueDate = '2027-02-01';
    });
    expect(findings(baseline(), 'R11')).toEqual([]);
    expect(findings(data, 'R11')).toEqual([]);
  });

  it('misses: reported at risk or off track, even when overdue with all work closed', () => {
    const data = unaccepted((d) => {
      d.outcomes[0]!.reportedStatus = 'at-risk';
      d.outcomes[0]!.dueDate = '2027-02-01';
    });
    expect(findings(data, 'R11')).toEqual([]);
  });
});

describe('R12 evidence older than the latest change to the work it covers', () => {
  it('hits', () => {
    const data = change(baseline(), (d) => {
      d.evidence = d.evidence.filter((e) => e.kind !== 'business-acceptance');
      d.workItems.find((w) => w.key === 'S-2')!.updated = '2027-03-07T09:00:00.000Z';
    });
    const [f] = findings(data, 'R12');
    expect(f!.subject).toEqual({ kind: 'evidence', id: 'ev-test' });
    expect(f!.message).toBe(
      'Test result “Evidence ev-test” was observed on 5 Mar 2027, but S-2 changed on 7 Mar 2027 (2 days later), so it no longer covers the current work.',
    );
  });

  it('misses: evidence observed after the last change, and superseded records', () => {
    const data = change(baseline(), (d) => {
      d.evidence.unshift(evidence('ev-old', 'td-1', 'test-result', { workItemKey: 'S-2', observedAt: '2027-02-01T09:00:00.000Z' }));
    });
    expect(findings(data, 'R12')).toEqual([]);
  });
});

describe('R13 a required test result is failing', () => {
  it('hits', () => {
    const data = change(baseline(), (d) => {
      d.evidence[1]!.result = 'fail';
    });
    const [f] = findings(data, 'R13');
    expect(f!.severity).toBe('critical');
    expect(f!.message).toContain(`${terms.systems['test-harness']} REF-ev-test`);
  });

  it('misses: passing, and failing then passing on rerun', () => {
    const rerun = change(baseline(), (d) => {
      d.evidence[1]!.result = 'fail';
      d.evidence.push(evidence('ev-test-2', 'td-1', 'test-result', { workItemKey: 'S-2', observedAt: '2027-03-06T09:00:00.000Z' }));
    });
    expect(findings(baseline(), 'R13')).toEqual([]);
    expect(findings(rerun, 'R13')).toEqual([]);
  });
});

describe('R14 Epic with no Deliverable ID, or one that does not exist', () => {
  it('hits on missing and dangling Deliverable IDs', () => {
    const data = change(baseline(), (d) => {
      d.workItems[0] = epic('E-1', null);
      d.workItems.push(epic('E-7', 'TD-404'));
    });
    const fs = findings(data, 'R14');
    expect(fs.map((f) => f.subject.id)).toEqual(['E-1', 'E-7']);
    expect(fs[0]!.deliverableId).toBe('td-1'); // still listed by the book of record
    expect(fs[0]!.message).toBe(
      `Epic E-1 “Item E-1” has no ${terms.hierarchy.deliverableIdField} in ${terms.systems['work-tracker']}; ${terms.systems['portfolio-system']} lists it under TD-1.`,
    );
    expect(fs[1]!.message).toContain('“TD-404”, which does not exist');
  });

  it('misses: Deliverable ID given as id or ref', () => {
    const data = change(baseline(), (d) => {
      d.workItems[1] = epic('E-2', 'TD-1');
    });
    expect(findings(data, 'R14')).toEqual([]);
    expect(findings(data, 'R8')).toEqual([]);
  });
});

describe('R15 Core Four incomplete', () => {
  it('hits high: a T3 deliverable with no In-Business Risk Lead (raised by config)', () => {
    const data = change(baseline(), (d) => {
      d.deliverables[0]!.riskTier = 'T3';
      delete d.deliverables[0]!.coreTeam['risk-lead'];
    });
    const fs = findings(data, 'R15');
    expect(fs).toHaveLength(1);
    expect(fs[0]).toMatchObject({ severity: 'high', subject: { kind: 'deliverable', id: 'td-1' }, deliverableId: 'td-1' });
    expect(fs[0]!.message).toBe(`TD-1 has no ${terms.coreRoles['risk-lead']} named in its Core Four; ${terms.riskTiers.T3} work needs that role filled before it moves on.`);
    expect(fs[0]!.evidence).toContainEqual({ kind: 'person', id: 'p-accept' });
  });

  it('hits medium: a missing risk lead on T1, or a missing UX Design Lead on T3; lists every missing role', () => {
    const t1 = change(baseline(), (d) => {
      delete d.deliverables[0]!.coreTeam['risk-lead'];
    });
    expect(findings(t1, 'R15').map((f) => f.severity)).toEqual(['medium']);
    const t3 = change(baseline(), (d) => {
      d.deliverables[0]!.riskTier = 'T3';
      delete d.deliverables[0]!.coreTeam['ux-lead'];
      delete d.deliverables[0]!.coreTeam['tech-lead'];
    });
    const [f] = findings(t3, 'R15');
    expect(f!.severity).toBe('medium');
    expect(f!.message).toBe('TD-1 has no Tech Lead and UX Design Lead named in its Core Four.');
  });

  it('hits medium: one person holding two core roles, as its own finding', () => {
    const data = change(baseline(), (d) => {
      d.deliverables[0]!.coreTeam['ux-lead'] = { personId: 'p-owner', joinedAt: '2026-12-01' };
    });
    const fs = findings(data, 'R15');
    expect(fs).toHaveLength(1);
    expect(fs[0]).toMatchObject({ severity: 'medium', id: 'f-R15-deliverable-td-1-shared-p-owner' });
    expect(fs[0]!.message).toBe('Olive Owner holds both the Tech Lead and UX Design Lead roles on TD-1; each core role needs a different person.');
    expect(fs[0]!.evidence).toContainEqual({ kind: 'person', id: 'p-owner' });
  });

  it('misses: four different people in the four seats', () => {
    expect(findings(baseline(), 'R15')).toEqual([]);
  });
});

describe('R16 work started before the Core Four was complete', () => {
  it('hits: the risk lead joined after the first story-level item was resolved', () => {
    const data = change(baseline(), (d) => {
      d.deliverables[0]!.coreTeam['risk-lead'] = { personId: 'p-risk', joinedAt: '2027-02-25' };
    });
    const fs = findings(data, 'R16');
    expect(fs).toHaveLength(1);
    expect(fs[0]).toMatchObject({ severity: RULE_SEVERITY.R16, subject: { kind: 'deliverable', id: 'td-1' } });
    expect(fs[0]!.message).toBe(
      'Work on TD-1 had started by 20 Feb 2027 (S-1 had moved out of to do) before its Core Four was complete: the In-Business Risk Lead (Rita Risk) joined on 25 Feb 2027.',
    );
    expect(fs[0]!.evidence).toEqual(expect.arrayContaining([{ kind: 'work-item', id: 'S-1' }, { kind: 'person', id: 'p-risk' }]));
  });

  it('hits: work in progress while a role is still unfilled (an in-progress item counts from its last update)', () => {
    const data = change(baseline(), (d) => {
      delete d.deliverables[0]!.coreTeam['ux-lead'];
      d.workItems.push(story('S-0', 'E-1', 'oc-1', { status: 'In Progress', statusCategory: 'in-progress', resolved: null, updated: '2027-02-10T09:00:00.000Z' }));
    });
    const [f] = findings(data, 'R16');
    expect(f!.message).toBe('Work on TD-1 had started by 10 Feb 2027 (S-0 had moved out of to do) before its Core Four was complete: the UX Design Lead role is still unfilled.');
  });

  it('misses: everyone joined on or before the day work started', () => {
    const data = change(baseline(), (d) => {
      d.deliverables[0]!.coreTeam['risk-lead'] = { personId: 'p-risk', joinedAt: '2027-02-20' };
    });
    expect(findings(data, 'R16')).toEqual([]);
    expect(findings(baseline(), 'R16')).toEqual([]);
  });

  it('misses: a late join or an empty seat while all work is still to do', () => {
    const data = change(baseline(), (d) => {
      d.deliverables[0]!.coreTeam['risk-lead'] = { personId: 'p-risk', joinedAt: '2027-03-05' };
      delete d.deliverables[0]!.coreTeam['ux-lead'];
      d.workItems = d.workItems.map((w) => (w.type === 'story' ? { ...w, status: 'To Do', statusCategory: 'to-do', resolved: null } : w));
    });
    expect(findings(data, 'R16')).toEqual([]);
    expect(findings(data, 'R15')).toHaveLength(1);
  });
});

describe('finding order', () => {
  it('sorts worst first, then by rule number', () => {
    const data = withProvider((d) => {
      d.workItems.push(openStory('S-4', 'E-1', null, { due: '2027-03-01' }));
      d.evidence[1]!.result = 'fail';
      d.dependencies.push(dependency('dep-1', 'td-p', 'td-1', { needBy: '2027-04-01', committed: '2027-04-15' }));
    });
    const ids = computeAll(data, CLOCK).findings.map((f) => f.ruleId);
    expect(ids).toEqual(['R5', 'R13', 'R6', 'R3', 'R9']); // committed after need-by counts as late for R5
  });

  it('ignores items outside any deliverable for deliverable attribution', () => {
    const data = change(baseline(), (d) => {
      d.workItems.push(item({ key: 'X-1', statusCategory: 'to-do', due: '2027-03-01', resolved: null }));
    });
    expect(findings(data, 'R3')[0]!.deliverableId).toBeNull();
  });
});
