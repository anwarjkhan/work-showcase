import { describe, expect, it } from 'vitest';
import { buildContext } from './context';
import { barSpan, computeAll, computePlanExtras, datePosition, dependencyKnockOn, forecastEnd, planTimeline, planWindow, stepWindow, windowDays } from './index';
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
  const START = '2027-01-04'; // 63 days before the clock
  /** `n` closed items of `points` each, resolved inside the 42-day lookback. */
  const closedRecent = (n: number, points: number) =>
    Array.from({ length: n }, (_, i) => story(`R${i}`, 'E', null, { points, resolved: '2027-02-15T09:00:00.000Z' }));
  const open = (points: number) => [openStory('C', 'E', null, { points })];

  it('projects remaining points at the recent rate when every gate passes', () => {
    const f = forecastEnd([...closedRecent(7, 3), ...open(10)], '2027-03-20', CLOCK, START);
    expect(f).toMatchObject({ method: 'throughput', dailyRate: 0.5, forecastEnd: '2027-03-28', slipDays: 8, atRisk: false });
    expect(f.explanation).toContain('10 points remain');
  });

  it('gate 1: too early when work started fewer than 28 days ago', () => {
    const f = forecastEnd([...closedRecent(7, 3), ...open(10)], '2027-03-20', CLOCK, '2027-02-20');
    expect(f).toMatchObject({ method: 'planned-fallback', forecastEnd: '2027-03-20', slipDays: 0, atRisk: false });
    expect(f.explanation).toBe('Too early to forecast from throughput: work started 16 days ago; showing the planned end (20 Mar 2027).');
  });

  it('gate 1 says when work has not started yet', () => {
    expect(forecastEnd([...closedRecent(7, 3), ...open(10)], '2027-06-30', CLOCK, '2027-04-05').explanation).toBe(
      'Too early to forecast from throughput: work has not started (planned start 5 Apr 2027); showing the planned end (30 Jun 2027).',
    );
  });

  it('gate 2 rounds the share down so a value just under 25% never reads as 25%', () => {
    // 49 of 200 points closed = 24.5%
    const items = [...closedRecent(7, 7), ...open(151)];
    expect(forecastEnd(items, '2027-06-30', CLOCK, START).explanation).toContain('24% of work closed');
  });

  it('gate 1 uses the earliest item created when no start date is given', () => {
    const items = [...closedRecent(7, 3), ...open(10)].map((i) => ({ ...i, created: '2027-03-01T09:00:00.000Z' }));
    expect(forecastEnd(items, '2027-03-20', CLOCK).explanation).toContain('work started 7 days ago');
  });

  it('gate 2: too early under 25% of work closed', () => {
    const f = forecastEnd([...closedRecent(5, 1), ...open(120)], '2027-06-30', CLOCK, START);
    expect(f).toMatchObject({ method: 'planned-fallback', forecastEnd: '2027-06-30', slipDays: 0 });
    expect(f.explanation).toBe('Too early to forecast from throughput: 4% of work closed; showing the planned end (30 Jun 2027).');
  });

  it('gate 3: too little recent throughput under 5 items closed in the lookback', () => {
    const f = forecastEnd([...closedRecent(4, 10), ...open(10)], '2027-03-20', CLOCK, START);
    expect(f.method).toBe('planned-fallback');
    expect(f.explanation).toBe('Too little recent throughput to forecast: 4 items closed in the last 42 days; showing the planned end (20 Mar 2027).');
  });

  it('passes each gate at exactly its threshold', () => {
    // started 28 days ago, 25% closed, 5 items in the lookback
    const f = forecastEnd([...closedRecent(5, 2), ...open(30)], '2027-06-30', CLOCK, '2027-02-08');
    expect(f.method).toBe('throughput');
  });

  it('caps implausible projections: over 120 days of slip shows the planned end, flagged at risk', () => {
    // 10 of 40 points closed recently: 1.7 a week against 30 remaining -> 126 days out, 126 days late
    const f = forecastEnd([...closedRecent(5, 2), ...open(30)], '2027-03-08', CLOCK, START);
    expect(f).toMatchObject({ method: 'planned-fallback', forecastEnd: '2027-03-08', slipDays: 0, atRisk: true, dailyRate: 0 });
    expect(f.explanation).toBe(
      'Recent throughput (1.7 points a week against 30 remaining points) is too low to give a reliable date; at risk of slipping well beyond the planned end, which is shown (8 Mar 2027).',
    );
    const justInside = forecastEnd([...closedRecent(5, 2), ...open(30)], '2027-03-14', CLOCK, START);
    expect(justInside).toMatchObject({ method: 'throughput', slipDays: 120, atRisk: false });
  });

  it('falls back to the planned end when nothing closed recently or there is no estimated work', () => {
    const old = story('B', 'E', null, { points: 30, resolved: '2027-01-10T09:00:00.000Z' });
    expect(forecastEnd([old, ...open(10)], '2027-03-20', CLOCK, START)).toMatchObject({ method: 'planned-fallback', forecastEnd: '2027-03-20', slipDays: 0 });
    expect(forecastEnd([], '2027-03-20', CLOCK).method).toBe('planned-fallback');
  });

  it('uses the last resolution date when all work is closed, whatever the gates', () => {
    const a = story('A', 'E', null, { points: 21, resolved: '2027-02-15T09:00:00.000Z' });
    const b = story('B', 'E', null, { points: 8, resolved: '2027-01-10T09:00:00.000Z' });
    expect(forecastEnd([a, b], '2027-03-20', CLOCK, '2027-03-01')).toMatchObject({ method: 'complete', forecastEnd: '2027-02-15', slipDays: -33 });
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
      for (const k of [5, 6]) d.workItems.push(story(`S-${k}`, 'E-2', 'oc-2', { points: 0, resolved: '2027-03-03T09:00:00.000Z' })); // 5 recent closes
    });
    const r = computeAll(data, CLOCK);
    const td1 = r.plan.spans.find((s) => s.entity.id === 'td-1')!;
    expect(td1.lateDependencyIds).toEqual(['dep-1']);
    expect(td1.forecastEnd).toBe('2027-03-25'); // 26 points in 42 days -> 10 more in ceil(16.2) = 17 days
    expect(r.plan.spans.find((s) => s.entity.id === 'td-s')!.parentId).toBe('ir-1');
    expect(r.plan.spans.find((s) => s.entity.id === 'pm-1')!.lateDependencyIds).toEqual(['dep-1']);
    expect(r.plan.lateDependencyIds).toEqual(['dep-1']);
  });

  it('rolls gated forecasts up: an implausible deliverable projection never reaches parent rows', () => {
    const data = change(baseline(), (d) => {
      d.deliverables[0]!.plannedEnd = '2027-03-31';
      // 34% closed (200 points long ago, 10 recently over 5 items), 400 open: projection is years out
      d.workItems = d.workItems.filter((w) => w.type === 'epic');
      d.workItems.push(story('S-old', 'E-1', 'oc-1', { points: 200, resolved: '2027-01-15T09:00:00.000Z' }));
      for (let i = 0; i < 5; i++) d.workItems.push(story(`S-${i}`, 'E-1', 'oc-1', { points: 2, resolved: '2027-03-01T09:00:00.000Z' }));
      d.workItems.push(openStory('S-9', 'E-2', 'oc-2', { points: 400 }));
    });
    const r = computeAll(data, CLOCK);
    for (const span of r.plan.spans) expect(span.slipDays).toBeLessThanOrEqual(120);
    expect(r.plan.spans.find((s) => s.entity.id === 'td-1')).toMatchObject({ forecastEnd: '2027-03-31', slipDays: 0 });
    expect(r.plan.spans.find((s) => s.entity.id === 'ir-1')!.slipDays).toBeLessThanOrEqual(0);
    const extras = computePlanExtras(data, CLOCK).forecasts.get('td-1')!;
    expect(extras).toMatchObject({ atRisk: true, method: 'planned-fallback' });
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
