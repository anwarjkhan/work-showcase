/**
 * Map geometry for the Global screen. Pure functions, no DOM.
 *
 * The world outline is the 110m `world-atlas` TopoJSON, imported as JSON so it
 * is bundled with the app: nothing is fetched at run time. Antarctica is left
 * out and the projection is fitted to the inhabited continents only, so no
 * space is spent on the poles.
 */
import { geoGraticule, geoNaturalEarth1, geoPath, type GeoProjection } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry, MultiLineString } from 'geojson';
import { feature, mesh } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import worldTopology from 'world-atlas/countries-110m.json';

type CountryProps = { name: string };
type WorldTopology = Topology<{ countries: GeometryCollection<CountryProps>; land: GeometryCollection }>;

const ANTARCTICA_ID = '010';

const topology = worldTopology as unknown as WorldTopology;

/** Countries without Antarctica (computed once per module load). */
export const COUNTRIES: FeatureCollection<Geometry, CountryProps> = (() => {
  const all = feature(topology, topology.objects.countries) as FeatureCollection<Geometry, CountryProps>;
  return { type: 'FeatureCollection', features: all.features.filter((f) => String(f.id) !== ANTARCTICA_ID) };
})();

/** Internal borders between countries, drawn as one faint mesh. */
export const BORDERS: MultiLineString = mesh(topology, topology.objects.countries, (a, b) => a !== b);

/** Single land feature (with Antarctica; used for on-land checks). */
export const LAND = feature(topology, topology.objects.land) as Feature<Geometry> | FeatureCollection<Geometry>;

const GRATICULE = geoGraticule().step([20, 20])();

export interface MapFrame {
  projection: GeoProjection;
  width: number;
  height: number;
  /** SVG path strings, precomputed for the frame. */
  sphere: string;
  graticule: string;
  land: string;
  borders: string;
}

/** Ratio of map height to width for the cropped Natural Earth frame. */
export const MAP_ASPECT = 0.5;

/**
 * Natural Earth projection fitted to the container width with the inhabited
 * continents filling the frame. `height` follows from the width.
 */
export function createProjection(width: number, pad = { x: 12, y: 14 }): { projection: GeoProjection; height: number } {
  const innerWidth = Math.max(10, width - pad.x * 2);
  const projection = geoNaturalEarth1().fitWidth(innerWidth, COUNTRIES);
  const [tx, ty] = projection.translate();
  projection.translate([tx + pad.x, ty + pad.y]);
  const [[, y0], [, y1]] = geoPath(projection).bounds(COUNTRIES);
  return { projection, height: Math.ceil(y1 - y0 + pad.y * 2) };
}

export function createMapFrame(width: number): MapFrame {
  const { projection, height } = createProjection(width);
  const path = geoPath(projection);
  return {
    projection,
    width,
    height,
    sphere: path({ type: 'Sphere' }) ?? '',
    graticule: path(GRATICULE) ?? '',
    land: path(COUNTRIES) ?? '',
    borders: path(BORDERS) ?? '',
  };
}

/** Projects [longitude, latitude] to screen [x, y]; null if outside the projection. */
export function projectPoint(projection: GeoProjection, longitude: number, latitude: number): [number, number] | null {
  const p = projection([longitude, latitude]);
  return p ? [p[0], p[1]] : null;
}

// ---------------------------------------------------------------------------
// Arcs
// ---------------------------------------------------------------------------

export interface ArcGeometry {
  d: string;
  /** Point on the curve at its middle, for day-count labels. */
  mid: [number, number];
}

/**
 * A gently curved arc from `a` to `b` (quadratic Bezier bowing upwards),
 * trimmed so it starts and ends at the edge of the hub markers.
 */
export function arcPath(a: [number, number], b: [number, number], trimStart: number, trimEnd: number, bend = 0.2): ArcGeometry {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  const p0: [number, number] = [a[0] + ux * trimStart, a[1] + uy * trimStart];
  const p1: [number, number] = [b[0] - ux * trimEnd, b[1] - uy * trimEnd];
  // Normal that points up the screen, so every arc bows the same way.
  let nx = -uy;
  let ny = ux;
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  const lift = Math.min(dist * bend, 160);
  const c: [number, number] = [(a[0] + b[0]) / 2 + nx * lift, (a[1] + b[1]) / 2 + ny * lift];
  const mid: [number, number] = [0.25 * p0[0] + 0.5 * c[0] + 0.25 * p1[0], 0.25 * p0[1] + 0.5 * c[1] + 0.25 * p1[1]];
  const f = (n: number) => n.toFixed(1);
  return { d: `M${f(p0[0])},${f(p0[1])} Q${f(c[0])},${f(c[1])} ${f(p1[0])},${f(p1[1])}`, mid };
}

// ---------------------------------------------------------------------------
// Label placement
// ---------------------------------------------------------------------------

export interface LabelInput {
  id: string;
  x: number;
  y: number;
  /** Marker radius. */
  r: number;
  text: string;
  /** Lower is placed first. */
  priority: number;
}

export interface LabelPlacement {
  id: string;
  /** Text anchor point. */
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
  /** Leader line from the marker edge to the label, when the label sits away from the marker. */
  leader: { x1: number; y1: number; x2: number; y2: number } | null;
  /** True when it fits without colliding with labels placed before it. */
  fits: boolean;
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

/** Rough text width for 11.5px Inter, semibold. Good enough for collision checks. */
export const estimateTextWidth = (text: string, fontSize = 11.5) => text.length * fontSize * 0.6 + 4;

const DIRECTIONS: Array<{ dx: number; dy: number; anchor: LabelPlacement['anchor'] }> = [
  { dx: 1, dy: 0, anchor: 'start' },
  { dx: -1, dy: 0, anchor: 'end' },
  { dx: 0.72, dy: -0.72, anchor: 'start' },
  { dx: -0.72, dy: -0.72, anchor: 'end' },
  { dx: 0.72, dy: 0.72, anchor: 'start' },
  { dx: -0.72, dy: 0.72, anchor: 'end' },
  { dx: 0, dy: -1, anchor: 'middle' },
  { dx: 0, dy: 1, anchor: 'middle' },
];

/**
 * Greedy label placement: each label, in priority order, takes the first
 * candidate position (eight directions, three distances, the farther ones
 * with a leader line) that does not collide with markers, earlier labels or
 * the frame. Labels that cannot fit get their nearest position and `fits: false`,
 * so they can still be shown on demand (hover, focus, selection).
 */
export function placeLabels(items: LabelInput[], frame: { width: number; height: number }, fontSize = 11.5): Map<string, LabelPlacement> {
  const h = fontSize + 3;
  const markers: Box[] = items.map((i) => ({ x0: i.x - i.r - 1, y0: i.y - i.r - 1, x1: i.x + i.r + 1, y1: i.y + i.r + 1 }));
  const placed: Box[] = [];
  const out = new Map<string, LabelPlacement>();
  const ordered = [...items].sort((a, b) => a.priority - b.priority);

  for (const item of ordered) {
    const w = estimateTextWidth(item.text, fontSize);
    let first: { p: LabelPlacement; box: Box } | null = null;
    let chosen: { p: LabelPlacement; box: Box } | null = null;
    for (const gap of [4, 18, 34]) {
      for (const dir of DIRECTIONS) {
        const d = item.r + gap;
        const ax = item.x + dir.dx * d;
        const ay = item.y + dir.dy * d;
        const x0 = dir.anchor === 'start' ? ax : dir.anchor === 'end' ? ax - w : ax - w / 2;
        const y0 = dir.dy < -0.1 ? ay - h : dir.dy > 0.1 ? ay : ay - h / 2;
        const box = { x0, y0, x1: x0 + w, y1: y0 + h };
        const inFrame = box.x0 >= 2 && box.y0 >= 2 && box.x1 <= frame.width - 2 && box.y1 <= frame.height - 2;
        const leader =
          gap > 4
            ? { x1: item.x + dir.dx * (item.r + 1.5), y1: item.y + dir.dy * (item.r + 1.5), x2: item.x + dir.dx * (d - 2), y2: item.y + dir.dy * (d - 2) }
            : null;
        const p: LabelPlacement = { id: item.id, x: ax, y: y0 + h / 2, anchor: dir.anchor, leader, fits: true };
        if (!first && inFrame) first = { p: { ...p, fits: false }, box };
        if (!inFrame) continue;
        const ownIndex = items.indexOf(item);
        const hitsMarker = markers.some((m, i) => i !== ownIndex && overlaps(m, box));
        if (hitsMarker || placed.some((b) => overlaps(b, box))) continue;
        chosen = { p, box };
        break;
      }
      if (chosen) break;
    }
    if (chosen) {
      placed.push(chosen.box);
      out.set(item.id, chosen.p);
    } else if (first) {
      out.set(item.id, first.p);
    }
  }
  return out;
}
