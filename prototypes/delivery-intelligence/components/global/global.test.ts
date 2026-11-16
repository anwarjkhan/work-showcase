import { geoContains } from 'd3-geo';
import { describe, expect, it } from 'vitest';
import { DEMO_CLOCK } from '@/lib/config/clock';
import { HERO_DELIVERABLE_ID } from '@/lib/config/story';
import { createSyntheticPortfolio } from '@/lib/data/synthetic';
import { computeAll } from '@/lib/engine';
import { arcPath, COUNTRIES, createMapFrame, createProjection, LAND, placeLabels, projectPoint } from './geo';
import { buildGlobalModel, utcOffsetLabel, visibleArcs, weightedHealth } from './model';

const CITIES = {
  newYork: [-74.006, 40.7128],
  saoPaulo: [-46.6333, -23.5505],
  london: [-0.1276, 51.5072],
  johannesburg: [28.0473, -26.2041],
  tokyo: [139.6503, 35.6762],
  sydney: [151.2093, -33.8688],
} as const;

describe('projection', () => {
  const { projection, height } = createProjection(1200);
  const at = (c: readonly [number, number]) => projectPoint(projection, c[0], c[1])!;

  it('places the Americas left of Europe, and Europe left of East Asia', () => {
    expect(at(CITIES.newYork)[0]).toBeLessThan(at(CITIES.london)[0]);
    expect(at(CITIES.london)[0]).toBeLessThan(at(CITIES.tokyo)[0]);
  });

  it('puts southern-hemisphere cities lower on screen', () => {
    expect(at(CITIES.saoPaulo)[1]).toBeGreaterThan(at(CITIES.newYork)[1]);
    expect(at(CITIES.johannesburg)[1]).toBeGreaterThan(at(CITIES.london)[1]);
    expect(at(CITIES.sydney)[1]).toBeGreaterThan(at(CITIES.tokyo)[1]);
  });

  it('crops the poles: the frame is wide and every city lies inside it', () => {
    expect(height / 1200).toBeGreaterThan(0.4);
    expect(height / 1200).toBeLessThan(0.56);
    for (const c of Object.values(CITIES)) {
      const [x, y] = at(c);
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(1200);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(height);
    }
  });

  it('builds the map from the embedded geometry, without Antarctica', () => {
    expect(COUNTRIES.features.length).toBeGreaterThan(150);
    expect(COUNTRIES.features.some((f) => String(f.id) === '010')).toBe(false);
    const frame = createMapFrame(900);
    expect(frame.land.length).toBeGreaterThan(1000);
    expect(frame.sphere.startsWith('M')).toBe(true);
  });
});

describe('hubs on the map', () => {
  const data = createSyntheticPortfolio();
  const results = computeAll(data, DEMO_CLOCK);
  const model = buildGlobalModel(data, results, DEMO_CLOCK);

  it('has all 18 hubs on six continents', () => {
    expect(model.hubs).toHaveLength(18);
    expect(model.totals.continents).toBe(6);
  });

  it('places mainland hubs on land (small island cities may fall outside the 110m outline)', () => {
    const islands = new Set(['hub-sgp', 'hub-hkg']);
    for (const h of model.hubs) {
      if (islands.has(h.hub.id)) continue;
      expect(geoContains(LAND, [h.hub.longitude, h.hub.latitude]), h.hub.name).toBe(true);
    }
  });

  it('finds the late hero dependency crossing continents', () => {
    const hero = model.heroDependency;
    expect(hero).not.toBeNull();
    expect(hero!.dep.toDeliverableId).toBe(HERO_DELIVERABLE_ID);
    expect(hero!.tone).toBe('late');
    expect(hero!.lateDays).toBe(9);
    expect(hero!.crossContinent).toBe(true);
    expect(visibleArcs(model, 'hero', null).map((d) => d.dep.id)).toContain(hero!.dep.id);
    expect(visibleArcs(model, 'late', null).every((d) => d.tone === 'late')).toBe(true);
  });

  it('counts each hub deliverable from the data', () => {
    for (const h of model.hubs) {
      expect(h.deliverableIds.length).toBe(data.deliverables.filter((d) => d.hubIds.includes(h.hub.id)).length);
    }
  });
});

describe('helpers', () => {
  it('weights health and leaves unknown out', () => {
    expect(weightedHealth([]).status).toBe('unknown');
    expect(weightedHealth([{ rag: 'unknown', weight: 1 }]).status).toBe('unknown');
    expect(weightedHealth([{ rag: 'green', weight: 1 }]).status).toBe('green');
    expect(weightedHealth([{ rag: 'red', weight: 2 }, { rag: 'green', weight: 1 }]).status).toBe('amber');
    expect(weightedHealth([{ rag: 'red', weight: 1 }]).status).toBe('red');
  });

  it('formats UTC offsets', () => {
    expect(utcOffsetLabel('Asia/Singapore', DEMO_CLOCK.now)).toBe('UTC+8');
    expect(utcOffsetLabel('America/New_York', DEMO_CLOCK.now)).toBe('UTC−5');
    expect(utcOffsetLabel('Asia/Kolkata', DEMO_CLOCK.now)).toBe('UTC+5:30');
  });

  it('places labels without overlaps where room allows', () => {
    const items = [
      { id: 'a', x: 100, y: 100, r: 6, text: 'London', priority: 0 },
      { id: 'b', x: 104, y: 102, r: 6, text: 'Dublin', priority: 1 },
    ];
    const out = placeLabels(items, { width: 400, height: 300 });
    expect(out.get('a')?.fits).toBe(true);
    expect(out.get('b')?.fits).toBe(true);
    expect(out.get('a')).not.toEqual(out.get('b'));
  });

  it('draws arcs that bow upwards', () => {
    const arc = arcPath([0, 100], [200, 100], 0, 0);
    expect(arc.mid[1]).toBeLessThan(100);
  });
});

describe('marker separation', () => {
  it('pushes overlapping markers apart and leaves distant ones in place', async () => {
    const { separateMarkers } = await import('./geo');
    const out = separateMarkers([
      { id: 'a', x: 100, y: 100, r: 10 },
      { id: 'b', x: 105, y: 100, r: 10 },
      { id: 'c', x: 400, y: 300, r: 10 },
    ]);
    const [ax, ay] = out.get('a')!;
    const [bx, by] = out.get('b')!;
    expect(Math.hypot(bx - ax, by - ay)).toBeGreaterThanOrEqual(20);
    expect(out.get('c')).toEqual([400, 300]);
  });
});
