import { describe, expect, it } from 'vitest';
import { DEMO_CLOCK } from '@/lib/config/clock';
import { HERO_DELIVERABLE_ID } from '@/lib/config/story';
import { createSyntheticPortfolio } from '@/lib/data/synthetic';
import { computeAll, computePlanExtras, planWindow } from '@/lib/engine';
import type { Sprint } from '@/lib/types';
import {
  ancestorsOf,
  buildPlanIndex,
  buildRows,
  canvasWidth,
  defaultExpanded,
  filterDeliverables,
  headerTiers,
  MIN_CANVAS,
  NO_FILTERS,
  rowOffsets,
  slipShort,
  slipText,
  spanGeometry,
  sprintBand,
  storySpan,
  windowKnockOns,
  windowSummary,
  windowTitle,
  zoomAnchor,
} from './layout';

const clock = DEMO_CLOCK;
const data = createSyntheticPortfolio();
const result = computeAll(data, clock);
const { forecasts, knockOn } = computePlanExtras(data, clock);
const index = buildPlanIndex({ data, result, forecasts, knockOn, clock });
const all = new Set(index.deliverables.keys());
const q1 = planWindow('quarter', clock, data.sprints);

const sprints: Sprint[] = [
  { id: 's1', name: '2027 S01', index: 1, start: '2027-01-04', end: '2027-01-17' },
  { id: 's2', name: '2027 S02', index: 2, start: '2027-01-18', end: '2027-01-31' },
];

describe('spanGeometry', () => {
  const w = { start: '2027-01-01', end: '2027-01-10' };
  it('places an inclusive span as fractions of the window', () => {
    expect(spanGeometry(w, '2027-01-01', '2027-01-10')).toEqual({ left: 0, width: 1, visible: true, clippedStart: false, clippedEnd: false });
    const g = spanGeometry(w, '2027-01-03', '2027-01-04');
    expect(g.left).toBeCloseTo(0.2);
    expect(g.width).toBeCloseTo(0.2);
  });
  it('keeps unclipped positions outside the window and flags the clip', () => {
    const g = spanGeometry(w, '2026-12-27', '2027-01-15');
    expect(g.left).toBeCloseTo(-0.5);
    expect(g.width).toBeCloseTo(2);
    expect(g.clippedStart && g.clippedEnd && g.visible).toBe(true);
  });
  it('reports bars wholly outside as not visible', () => {
    expect(spanGeometry(w, '2027-02-01', '2027-02-05').visible).toBe(false);
  });
  it('accepts reversed dates', () => {
    expect(spanGeometry(w, '2027-01-04', '2027-01-03').width).toBeCloseTo(0.2);
  });
});

describe('rows and offsets', () => {
  it('expands from investment request to deliverables by default, with the hero open', () => {
    const expanded = defaultExpanded(index);
    const rows = buildRows(index, { expanded, visibleDeliverables: all, zoom: 'quarter', sprintId: null });
    expect(rows[0]?.kind).toBe('rollup');
    expect(rows.filter((r) => r.kind === 'deliverable')).toHaveLength(index.deliverables.size);
    expect(rows.some((r) => r.kind === 'outcome' && r.deliverableId === HERO_DELIVERABLE_ID)).toBe(true);
    expect(rows.some((r) => r.kind === 'milestones' && r.deliverableId === HERO_DELIVERABLE_ID)).toBe(true);
    expect(rows.some((r) => r.kind === 'story')).toBe(false);
  });
  it('collapsed rollups hide their children', () => {
    const rows = buildRows(index, { expanded: new Set(), visibleDeliverables: all, zoom: 'quarter', sprintId: null });
    expect(rows.every((r) => r.kind === 'rollup' && r.level === 'investment-request')).toBe(true);
    expect(rows).toHaveLength(data.investmentRequests.length);
  });
  it('lists the sprint\'s story-level work under outcomes at sprint zoom', () => {
    const expanded = defaultExpanded(index);
    const sprint = data.sprints.find((s) => s.start <= clock.today && s.end >= clock.today);
    const rows = buildRows(index, { expanded, visibleDeliverables: all, zoom: 'sprint', sprintId: sprint?.id ?? null });
    const stories = rows.filter((r) => r.kind === 'story');
    expect(stories.length).toBeGreaterThan(0);
    const hero = index.deliverables.get(HERO_DELIVERABLE_ID);
    for (const r of stories) expect(hero?.stories.find((s) => s.key === r.id)?.sprintId).toBe(sprint?.id);
  });
  it('stacks row offsets', () => {
    const { top, total } = rowOffsets([
      { key: 'a', height: 40 },
      { key: 'b', height: 30 },
    ]);
    expect(top.get('b')).toBe(40);
    expect(total).toBe(70);
  });
  it('finds rollup ancestors of a deliverable', () => {
    const anc = ancestorsOf(index, HERO_DELIVERABLE_ID);
    expect(anc[anc.length - 1]).toBe(data.deliverables.find((d) => d.id === HERO_DELIVERABLE_ID)?.investmentRequestId);
  });
});

describe('filters', () => {
  it('keeps only deliverables under a programme, and drops empty rollups', () => {
    const programme = index.programmes[0];
    const visible = filterDeliverables(index, { ...NO_FILTERS, programmeId: programme?.id ?? null }, () => false);
    for (const id of visible) expect(index.deliverables.get(id)?.programmeIds).toContain(programme?.id);
    const rows = buildRows(index, { expanded: defaultExpanded(index), visibleDeliverables: visible, zoom: 'quarter', sprintId: null });
    expect(rows.filter((r) => r.kind === 'rollup' && r.level === 'investment-request')).toHaveLength(1);
  });
  it('filters to disagreements and to regulatory deliverables', () => {
    const dis = filterDeliverables(index, { ...NO_FILTERS, disagreementOnly: true }, (id) => result.deliverableRag[id]?.disagrees ?? false);
    expect([...dis].every((id) => result.deliverableRag[id]?.disagrees)).toBe(true);
    const reg = filterDeliverables(index, { ...NO_FILTERS, regulatoryOnly: true }, () => false);
    expect([...reg].every((id) => index.deliverables.get(id)?.milestones.some((m) => m.regulatory))).toBe(true);
  });
});

describe('window summary', () => {
  it('counts the hero knock-on in the default quarter', () => {
    const s = windowSummary(index, q1, all, clock);
    const hero = index.deliverables.get(HERO_DELIVERABLE_ID);
    expect(s.commitments).toBe(s.deliverablesDue.length + s.milestonesDue.length);
    expect(s.deliverablesDue).toContain(HERO_DELIVERABLE_ID);
    expect(hero?.projectedSlipDays).toBeGreaterThan(0);
    expect(s.slippingDeliverables).toContain(HERO_DELIVERABLE_ID);
    expect(s.leavingWindow).toContain(HERO_DELIVERABLE_ID);
    const heroDep = hero?.knockOns[0]?.dependencyId;
    expect(s.lateDependencies).toContain(heroDep);
    expect(windowKnockOns(index, s, q1)[0]?.receiverId).toBe(HERO_DELIVERABLE_ID);
    const regIds = hero?.milestones.filter((m) => m.regulatory).map((m) => m.id) ?? [];
    expect(regIds.some((id) => s.regulatoryAtRisk.includes(id))).toBe(true);
  });
  it('is empty for a window with nothing visible', () => {
    const s = windowSummary(index, q1, new Set(), clock);
    expect(s.commitments).toBe(0);
    expect(s.lateDependencies).toEqual([]);
  });
});

describe('header and helpers', () => {
  it('builds contiguous sprint bands from the data', () => {
    const band = sprintBand('2027-01-10', '2027-01-20', sprints, '2027-01-19');
    expect(band.map((t) => t.label)).toEqual(['S01', 'S02']);
    expect(band[1]?.current).toBe(true);
  });
  it('gives tiers per zoom, covering the neighbouring windows', () => {
    const t = headerTiers(q1, clock, data.sprints);
    expect(t.top.map((x) => x.label)).toEqual(expect.arrayContaining(['Dec', 'Jan', 'Feb', 'Mar', 'Apr']));
    expect(t.bottomKind).toBe('sprint');
    expect(t.bottom.some((x) => x.current)).toBe(true);
    const m = headerTiers(planWindow('month', clock, data.sprints), clock, data.sprints);
    expect(m.bottomKind).toBe('day');
    expect(m.top.some((x) => x.current)).toBe(true);
  });
  it('titles windows', () => {
    expect(windowTitle(q1, clock, data.sprints)).toBe('Q1 2027');
    expect(windowTitle(planWindow('year', clock, data.sprints), clock, data.sprints)).toBe('2027');
    expect(windowTitle(planWindow('month', clock, data.sprints), clock, data.sprints)).toBe('March 2027');
  });
  it('keeps today in view across zooms when it is in the window', () => {
    expect(zoomAnchor(q1, clock.today)).toBe(clock.today);
    expect(zoomAnchor({ start: '2027-04-01', end: '2027-06-30' }, clock.today)).toBe('2027-04-01');
  });
  it('enforces a minimum canvas width', () => {
    expect(canvasWidth('month', 300)).toBe(MIN_CANVAS.month);
    expect(canvasWidth('quarter', 2000)).toBe(2000);
  });
  it('clamps story spans to the sprint', () => {
    const item = { created: '2026-12-01T00:00:00Z', resolved: null, due: null } as unknown as Parameters<typeof storySpan>[0];
    expect(storySpan(item, sprints[0]!)).toEqual({ start: '2027-01-04', end: '2027-01-17' });
    const done = { created: '2027-01-06T00:00:00Z', resolved: '2027-01-09T10:00:00Z', due: null } as unknown as Parameters<typeof storySpan>[0];
    expect(storySpan(done, sprints[0]!)).toEqual({ start: '2027-01-06', end: '2027-01-09' });
  });
  it('formats slip', () => {
    expect(slipText(9)).toBe('+9 days');
    expect(slipText(-1)).toBe('−1 day');
    expect(slipText(0)).toBe('On plan');
    expect(slipShort(1214)).toBe('+1,214d');
  });
});
