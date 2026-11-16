import { describe, expect, it } from 'vitest';
import { buildContext } from './context';
import { barSpan, computeAll, datePosition, dependencyKnockOn, forecastEnd, planTimeline, planWindow, stepWindow, windowDays } from './index';
import { CLOCK, baseline, change, deliverable, dependency, milestone, openStory, story } from './test-fixtures';

const sprints = baseline().sprints; // 26 two-week sprints from Mon 4 Jan 2027

describe('plan windows per zoom', () => {
  it('year: the calendar year with quarter ticks', () => {
    const w = planWindow('year', CLOCK, sprints);
    expect([w.start, w.end]).toEqual(['2027-01-01', '2027-12-31']);
    expect(w.ticks.map((t) => t.label)).toEqual(['Q1 2027', 'Q2 2027', 'Q3 2027', 'Q4 2027']);
    expect(w.ticks.map((t) => [t.start, t.end])).toEqual([
      ['2027-01-01', '2027-03-31'],
      ['2027-04-01', '2027-06-30'],
      ['2027-07-01', '2027-09-30'],
      ['2027-10-01', '2027-12-31'],
    ]);
    expect(w.ticks.filter((t) => t.current).map((t) => t.label)).toEqual(['Q1 2027']);
  });

  it('quarter: the calendar quarter with month ticks', () => {
    const w = planWindow('quarter', CLOCK, sprints);
    expect([w.start, w.end]).toEqual(['2027-01-01', '2027-03-31']);
    expect(w.ticks.map((t) => t.label)).toEqual(['Jan', 'Feb', 'Mar']);
    expect(w.ticks[1]).toMatchObject({ start: '2027-02-01', end: '2027-02-28', current: false });
    expect(w.ticks[2]!.current).toBe(true);
  });

  it('month: the calendar month with the sprints overlapping it, clipped', () => {
    const w = planWindow('month', CLOCK, sprints);
    expect([w.start, w.end]).toEqual(['2027-03-01', '2027-03-31']);
    expect(w.ticks.map((t) => [t.label, t.start, t.end, t.current])).toEqual([
      ['S05', '2027-03-01', '2027-03-14', true],
      ['S06', '2027-03-15', '2027-03-28', false],
      ['S07', '2027-03-29', '2027-03-31', false],
    ]);
  });

  it('sprint: one two-week sprint with day ticks', () => {
    const w = planWindow('sprint', CLOCK, sprints);
    expect([w.start, w.end]).toEqual(['2027-03-01', '2027-03-14']);
    expect(w.ticks).toHaveLength(14);
    expect(w.ticks[0]!.label).toBe('Mon 1');
    expect(w.ticks.filter((t) => t.current).map((t) => t.label)).toEqual(['Mon 8']);
  });

  it('sprint: falls back to two-week blocks from ISO week 1 when the data has no sprints', () => {
    const w = planWindow('sprint', CLOCK, []);
    expect([w.start, w.end]).toEqual(['2027-03-01', '2027-03-14']);
    expect(planWindow('month', CLOCK, []).ticks[0]!.label).toBe('w/c 1 Mar');
  });

  it('steps windows forward and back', () => {
    expect(stepWindow(planWindow('quarter', CLOCK), 1)).toBe('2027-04-01');
    expect(stepWindow(planWindow('quarter', CLOCK), -1)).toBe('2026-10-01');
    expect(stepWindow(planWindow('month', CLOCK), -3)).toBe('2026-12-01');
    expect(stepWindow(planWindow('year', CLOCK), 1)).toBe('2028-01-01');
    expect(stepWindow(planWindow('sprint', CLOCK, sprints), 1, sprints)).toBe('2027-03-15');
    expect(planWindow('quarter', CLOCK, sprints, '2027-04-01').ticks.map((t) => t.label)).toEqual(['Apr', 'May', 'Jun']);
  });

  it('builds a continuous timeline of whole windows for scrolling', () => {
    const t = planTimeline('quarter', '2027-02-10', '2027-08-01', CLOCK, sprints);
    expect([t.start, t.end]).toEqual(['2027-01-01', '2027-09-30']);
    expect(t.ticks).toHaveLength(9);
  });
});

describe('bar spans', () => {
  const quarter = planWindow('quarter', CLOCK, sprints); // 90 days

  it('places a bar inside the window as fractions of whole days', () => {
    const b = barSpan(quarter, '2027-01-01', '2027-01-30');
    expect(b).toEqual({ visible: true, left: 0, width: 30 / 90, clippedStart: false, clippedEnd: false });
    expect(datePosition(quarter, '2027-03-08')).toBeCloseTo(66 / 90);
  });

  it('clips bars that run past either edge', () => {
    const b = barSpan(quarter, '2026-12-01', '2027-06-30');
    expect(b).toMatchObject({ visible: true, left: 0, width: 1, clippedStart: true, clippedEnd: true });
  });

  it('hides bars wholly outside the window', () => {
    expect(barSpan(quarter, '2027-04-01', '2027-05-01').visible).toBe(false);
  });

  it('works at every zoom', () => {
    for (const zoom of ['year', 'quarter', 'month', 'sprint'] as const) {
      const w = planWindow(zoom, CLOCK, sprints);
      const b = barSpan(w, w.start, w.end);
      expect(b).toMatchObject({ visible: true, left: 0, width: 1 });
      expect(barSpan(w, CLOCK.today, CLOCK.today).width).toBeCloseTo(1 / windowDays(w));
    }
  });
});

describe('forecast end against planned end', () => {
  const items = [
    story('A', 'E', null, { points: 21, resolved: '2027-02-15T09:00:00.000Z' }), // inside the 42-day lookback
    story('B', 'E', null, { points: 8, resolved: '2027-01-10T09:00:00.000Z' }), // outside it
    openStory('C', 'E', null, { points: 10 }),
  ];

  it('projects remaining points at the recent rate', () => {
    const f = forecastEnd(items, '2027-03-20', CLOCK);
    expect(f.method).toBe('throughput');
    expect(f.dailyRate).toBe(0.5); // 21 points / 42 days
    expect(f.forecastEnd).toBe('2027-03-28'); // today + ceil(10 / 0.5)
    expect(f.slipDays).toBe(8);
    expect(f.explanation).toContain('10 points remain');
  });

  it('falls back to the planned end when nothing closed recently or there is no estimated work', () => {
    const stalled = forecastEnd([items[1]!, items[2]!], '2027-03-20', CLOCK);
    expect(stalled).toMatchObject({ method: 'planned-fallback', forecastEnd: '2027-03-20', slipDays: 0 });
    expect(forecastEnd([], '2027-03-20', CLOCK).method).toBe('planned-fallback');
  });

  it('uses the last resolution date when all work is closed', () => {
    const f = forecastEnd([items[0]!, items[1]!], '2027-03-20', CLOCK);
    expect(f).toMatchObject({ method: 'complete', forecastEnd: '2027-02-15', slipDays: -33 });
  });
});

describe('plan model', () => {
  it('follows the hierarchy: request, programme, deliverable, Epics', () => {
    const r = computeAll(baseline(), CLOCK);
    expect(r.plan.spans.map((s) => [s.level, s.entity.id, s.parentId])).toEqual([
      ['investment-request', 'ir-1', null],
      ['pm-node', 'pm-1', 'ir-1'],
      ['deliverable', 'td-1', 'pm-1'],
      ['epic', 'E-1', 'td-1'],
      ['epic', 'E-2', 'td-1'],
    ]);
    expect(r.plan.today).toBe(CLOCK.today);
    expect(r.plan.start).toBe('2027-01-04');
  });

  it('places standalone deliverables directly under their request and carries slip and late dependencies', () => {
    const data = change(baseline(), (d) => {
      d.deliverables.push(deliverable({ id: 'td-s', pmNodeId: null, plannedEnd: '2027-03-20' }));
      d.dependencies.push(dependency('dep-1', 'td-s', 'td-1', { needBy: '2027-03-01', committed: '2027-03-10', status: 'late' }));
      d.workItems.push(openStory('S-4', 'E-1', 'oc-1', { points: 10 }));
      d.workItems.find((w) => w.key === 'S-1')!.points = 21;
    });
    const r = computeAll(data, CLOCK);
    const td1 = r.plan.spans.find((s) => s.entity.id === 'td-1')!;
    expect(td1.lateDependencyIds).toEqual(['dep-1']);
    expect(td1.forecastEnd).toBe('2027-03-25'); // 26 points in 42 days -> 10 more in ceil(16.2) = 17 days
    expect(r.plan.spans.find((s) => s.entity.id === 'td-s')!.parentId).toBe('ir-1');
    expect(r.plan.spans.find((s) => s.entity.id === 'pm-1')!.lateDependencyIds).toEqual(['dep-1']);
    expect(r.plan.lateDependencyIds).toEqual(['dep-1']);
  });

  it('works out the knock-on of a late dependency on the receiver', () => {
    const data = change(baseline(), (d) => {
      d.deliverables.push(deliverable({ id: 'td-p', ref: 'TD-P' }), deliverable({ id: 'td-r', ref: 'TD-R' }));
      d.dependencies.push(dependency('dep-1', 'td-p', 'td-1', { title: 'Feed', needBy: '2027-02-27', committed: '2027-03-08', status: 'late' }));
      d.dependencies.push(dependency('dep-2', 'td-1', 'td-r'));
      d.milestones.push(milestone('ms-early', 'td-1', { date: '2027-02-20' }), milestone('ms-late', 'td-1', { date: '2027-03-19', regulatory: true }));
    });
    const [k] = dependencyKnockOn(buildContext(data, CLOCK));
    expect(k).toMatchObject({
      dependencyId: 'dep-1',
      receiverId: 'td-1',
      lateDays: 9,
      receiverPlannedEnd: '2027-06-30',
      receiverEndWithDelay: '2027-07-09',
      affectedMilestones: [{ milestoneId: 'ms-late', date: '2027-03-19', shiftedTo: '2027-03-28', regulatory: true }],
      downstreamDependencyIds: ['dep-2'],
    });
    expect(k!.explanation).toBe('“Feed” is 9 days late for TD-1; passing the delay through moves its planned end from 30 Jun 2027 to 9 Jul 2027 and 1 milestone with it.');
  });
});
