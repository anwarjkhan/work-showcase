'use client';

import { scaleSqrt } from 'd3-scale';
import { arc as d3arc, pie } from 'd3-shape';
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useElementSize } from '@/components/charts';
import { cx } from '@/components/ui';
import { formatDate } from '@/lib/config/clock';
import { terms } from '@/lib/config/terminology';
import type { EvidenceRagStatus } from '@/lib/types';
import { arcPath, createMapFrame, placeLabels, projectPoint, separateMarkers } from './geo';
import { METRIC_LABEL, type ArcTone, type DependencyView, type GlobalModel, type HubMetric, type HubView } from './model';

const STATUS_VAR: Record<EvidenceRagStatus, string> = {
  red: 'var(--di-status-red)',
  amber: 'var(--di-status-amber)',
  green: 'var(--di-status-green)',
  unknown: 'var(--di-status-unknown)',
};

/** Arc styling: late and at-risk differ from on-track in weight and dash pattern, not only colour. */
export const ARC_STYLE: Record<ArcTone, { stroke: string; width: number; dash?: string; opacity: number; label: string }> = {
  late: { stroke: 'var(--di-status-red)', width: 3, opacity: 0.95, label: 'Late or blocked' },
  'at-risk': { stroke: 'var(--di-status-amber)', width: 2, dash: '7 4', opacity: 0.9, label: 'At risk' },
  'on-track': { stroke: 'var(--di-map-arc)', width: 1.4, opacity: 0.55, label: 'On track' },
  delivered: { stroke: 'var(--di-chart-axis)', width: 1, dash: '1.5 3.5', opacity: 0.55, label: 'Delivered' },
};

export const metricValue = (h: HubView, metric: HubMetric) =>
  metric === 'deliverables' ? h.deliverableIds.length : metric === 'openWork' ? h.openWork : h.people;

export interface WorldMapProps {
  model: GlobalModel;
  arcs: DependencyView[];
  metric: HubMetric;
  selectedHubId: string | null;
  onSelectHub: (hubId: string | null) => void;
  /** Dependency to emphasise (hero view or a selected dependency); everything else dims. */
  focusDependencyId: string | null;
  /** Hubs to keep bright while the rest dims (hero view). Null when nothing is dimmed. */
  focusHubIds: Set<string> | null;
}

/** Inner status shape drawn on the marker, so health never relies on colour alone. */
function StatusShape({ status, r }: { status: EvidenceRagStatus; r: number }) {
  const s = Math.max(2.6, r * 0.5);
  const fill = 'var(--di-surface)';
  if (status === 'green') {
    return <path d={`M${-s * 0.8},${0} L${-s * 0.2},${s * 0.6} L${s * 0.85},${-s * 0.6}`} fill="none" stroke={fill} strokeWidth={Math.max(1.4, s * 0.38)} strokeLinecap="round" strokeLinejoin="round" />;
  }
  if (status === 'amber') {
    return <path d={`M0,${-s * 0.95} L${s * 0.95},${s * 0.75} L${-s * 0.95},${s * 0.75} Z`} fill={fill} />;
  }
  if (status === 'red') {
    const k = s * 0.8;
    const pts = Array.from({ length: 8 }, (_, i) => {
      const a = (Math.PI / 8) * (2 * i + 1);
      return `${(Math.cos(a) * k).toFixed(2)},${(Math.sin(a) * k).toFixed(2)}`;
    }).join(' ');
    return <polygon points={pts} fill={fill} />;
  }
  return (
    <text textAnchor="middle" dominantBaseline="central" fontSize={s * 2} fontWeight={700} fill={fill}>
      ?
    </text>
  );
}

const ringArc = d3arc<{ startAngle: number; endAngle: number }>();
const ringPie = pie<{ status: EvidenceRagStatus; n: number }>()
  .value((d) => d.n)
  .sort(null)
  .padAngle(0.08);

export function WorldMap({ model, arcs, metric, selectedHubId, onSelectHub, focusDependencyId, focusHubIds }: WorldMapProps) {
  const { ref, width } = useElementSize<HTMLDivElement>();
  const [hoverHubId, setHoverHubId] = useState<string | null>(null);
  const [focusHubId, setFocusHubId] = useState<string | null>(null);
  const [hoverDepId, setHoverDepId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const frame = useMemo(() => (width > 0 ? createMapFrame(width) : null), [width]);
  const scale = width > 0 ? Math.min(1.25, Math.max(0.72, width / 1150)) : 1;

  const truePoints = useMemo(() => {
    const map = new Map<string, [number, number]>();
    if (!frame) return map;
    for (const h of model.hubs) {
      const p = projectPoint(frame.projection, h.hub.longitude, h.hub.latitude);
      if (p) map.set(h.hub.id, p);
    }
    return map;
  }, [frame, model.hubs]);

  const radius = useMemo(() => {
    const max = Math.max(1, ...model.hubs.map((h) => metricValue(h, metric)));
    const s = scaleSqrt().domain([0, max]).range([4 * scale, 15 * scale]);
    return (h: HubView) => s(metricValue(h, metric));
  }, [model.hubs, metric, scale]);

  // Display positions: overlapping markers are nudged apart; a tether marks the true location.
  const points = useMemo(
    () =>
      separateMarkers(
        model.hubs.flatMap((h) => {
          const p = truePoints.get(h.hub.id);
          return p ? [{ id: h.hub.id, x: p[0], y: p[1], r: radius(h) + 5 }] : [];
        }),
        1,
      ),
    [model.hubs, truePoints, radius],
  );

  const labels = useMemo(() => {
    if (!frame) return new Map();
    const ranked = [...model.hubs].sort((a, b) => metricValue(b, metric) - metricValue(a, metric));
    return placeLabels(
      ranked.flatMap((h, i) => {
        const p = points.get(h.hub.id);
        return p ? [{ id: h.hub.id, x: p[0], y: p[1], r: radius(h) + 3.5, text: h.hub.name, priority: (focusHubIds?.has(h.hub.id) ? -100 : 0) + i }] : [];
      }),
      frame,
    );
  }, [frame, model.hubs, metric, points, radius, focusHubIds]);

  // Markers draw largest first so small hubs stay clickable on top.
  const drawOrder = useMemo(() => [...model.hubs].sort((a, b) => radius(b) - radius(a)), [model.hubs, radius]);
  const keyOrder = useMemo(() => [...model.hubs].sort((a, b) => a.hub.longitude - b.hub.longitude).map((h) => h.hub.id), [model.hubs]);

  const onHubKey = (e: KeyboardEvent<SVGGElement>, hubId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectHub(selectedHubId === hubId ? null : hubId);
      return;
    }
    if (e.key === 'Escape') {
      onSelectHub(null);
      return;
    }
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const idx = keyOrder.indexOf(hubId);
    const next = keyOrder[(idx + step + keyOrder.length) % keyOrder.length];
    svgRef.current?.querySelector<SVGGElement>(`[data-hub="${next}"]`)?.focus();
  };

  const activeHubId = focusHubId ?? hoverHubId;
  const dimHub = (id: string) => {
    if (focusHubIds) return !focusHubIds.has(id);
    if (selectedHubId) {
      if (id === selectedHubId) return false;
      return !arcs.some((a) => (a.dep.fromHubId === selectedHubId && a.dep.toHubId === id) || (a.dep.toHubId === selectedHubId && a.dep.fromHubId === id));
    }
    return false;
  };
  const dimArc = (a: DependencyView) => {
    if (focusDependencyId) return a.dep.id !== focusDependencyId;
    if (selectedHubId) return a.dep.fromHubId !== selectedHubId && a.dep.toHubId !== selectedHubId;
    return false;
  };

  const tooltipHub = activeHubId ? model.hubById.get(activeHubId) : undefined;
  const tooltipPoint = activeHubId ? points.get(activeHubId) : undefined;
  const hoverDep = hoverDepId ? arcs.find((a) => a.dep.id === hoverDepId) : undefined;

  const arcGeoms = arcs.flatMap((a) => {
    const p0 = points.get(a.dep.fromHubId);
    const p1 = points.get(a.dep.toHubId);
    const h0 = model.hubById.get(a.dep.fromHubId);
    const h1 = model.hubById.get(a.dep.toHubId);
    if (!p0 || !p1 || !h0 || !h1) return [];
    return [{ a, g: arcPath(p0, p1, radius(h0) + 2, radius(h1) + 4), len: Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) }];
  });
  // Late arcs on top, then at risk.
  const toneRank: Record<ArcTone, number> = { delivered: 0, 'on-track': 1, 'at-risk': 2, late: 3 };
  arcGeoms.sort((x, y) => toneRank[x.a.tone] - toneRank[y.a.tone] || Number(x.a.dep.id === focusDependencyId) - Number(y.a.dep.id === focusDependencyId));

  return (
    <div ref={ref} className="relative w-full overflow-hidden" style={{ height: frame?.height ?? undefined, minHeight: frame ? undefined : 320 }}>
      {frame ? (
        <svg
          ref={svgRef}
          width={frame.width}
          height={frame.height}
          viewBox={`0 0 ${frame.width} ${frame.height}`}
          className="block select-none"
          role="group"
          aria-label={`World map of ${model.hubs.length} delivery hubs and ${arcs.length} cross-hub dependencies. Use Tab or the arrow keys to move between hubs and Enter to open one.`}
          onClick={(e) => {
            if (e.target === e.currentTarget) onSelectHub(null);
          }}
        >
          <defs>
            <style>{`
              @keyframes di-global-pulse { 0% { transform: scale(1); opacity: .55 } 80%, 100% { transform: scale(2.1); opacity: 0 } }
              @keyframes di-global-flow { to { stroke-dashoffset: -20 } }
              .di-global-pulse { transform-box: fill-box; transform-origin: center; animation: di-global-pulse 2.4s var(--di-ease-standard) infinite; }
              .di-global-flow { animation: di-global-flow 1.1s linear infinite; }
              @media (prefers-reduced-motion: reduce) { .di-global-pulse, .di-global-flow { animation: none; } .di-global-pulse { opacity: 0; } }
            `}</style>
            {(Object.keys(ARC_STYLE) as ArcTone[]).map((tone) => (
              <marker key={tone} id={`di-arrow-${tone}`} viewBox="0 0 10 10" refX="7" refY="5" markerWidth={tone === 'late' ? 4.2 : 5.5} markerHeight={tone === 'late' ? 4.2 : 5.5} orient="auto-start-reverse" markerUnits="strokeWidth">
                <path d="M0,0 L10,5 L0,10 L2.5,5 Z" fill={ARC_STYLE[tone].stroke} />
              </marker>
            ))}
            <radialGradient id="di-global-glow" cx="50%" cy="45%" r="65%">
              <stop offset="0%" stopColor="var(--di-map-arc)" stopOpacity="0.07" />
              <stop offset="100%" stopColor="var(--di-map-arc)" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Base map */}
          <path d={frame.sphere} fill="var(--di-map-water)" pointerEvents="none" />
          <path d={frame.sphere} fill="url(#di-global-glow)" pointerEvents="none" />
          <path d={frame.graticule} fill="none" stroke="var(--di-map-graticule)" strokeWidth={1} pointerEvents="none" />
          <path d={frame.land} fill="var(--di-map-land)" stroke="var(--di-map-land-line)" strokeWidth={0.9} strokeLinejoin="round" pointerEvents="none" />
          <path d={frame.borders} fill="none" stroke="var(--di-map-land-line)" strokeWidth={0.5} pointerEvents="none" />
          <path d={frame.sphere} fill="none" stroke="var(--di-line)" strokeWidth={1} pointerEvents="none" />

          {/* Dependency arcs */}
          <g aria-hidden>
            {arcGeoms.map(({ a, g }) => {
              const st = ARC_STYLE[a.tone];
              const dim = dimArc(a);
              const emphasised = a.dep.id === focusDependencyId || a.dep.id === hoverDepId;
              const w = st.width * (emphasised ? 1.35 : 1) * Math.min(1.15, scale);
              return (
                <g
                  key={a.dep.id}
                  style={{ opacity: dim ? 0.08 : 1, transition: 'opacity var(--di-duration-slow) var(--di-ease-standard)' }}
                  onMouseEnter={() => setHoverDepId(a.dep.id)}
                  onMouseLeave={() => setHoverDepId((cur) => (cur === a.dep.id ? null : cur))}
                >
                  <path d={g.d} fill="none" stroke="transparent" strokeWidth={12} className="cursor-default" />
                  {emphasised ? <path d={g.d} fill="none" stroke={st.stroke} strokeOpacity={0.18} strokeWidth={w + 6} strokeLinecap="round" pointerEvents="none" /> : null}
                  <path
                    d={g.d}
                    fill="none"
                    stroke={st.stroke}
                    strokeOpacity={st.opacity}
                    strokeWidth={w}
                    strokeDasharray={st.dash}
                    strokeLinecap="round"
                    markerEnd={`url(#di-arrow-${a.tone})`}
                    pointerEvents="none"
                  />
                  {a.tone === 'late' || a.tone === 'at-risk' ? (
                    <path
                      d={g.d}
                      fill="none"
                      stroke="var(--di-surface)"
                      strokeOpacity={0.85}
                      strokeWidth={Math.max(1, w * 0.45)}
                      strokeDasharray="2 18"
                      strokeLinecap="round"
                      className="di-global-flow"
                      pointerEvents="none"
                    />
                  ) : null}
                </g>
              );
            })}
          </g>

          {/* True locations of nudged markers */}
          <g pointerEvents="none" aria-hidden>
            {model.hubs.map((h) => {
              const t = truePoints.get(h.hub.id);
              const p = points.get(h.hub.id);
              if (!t || !p || Math.hypot(p[0] - t[0], p[1] - t[1]) < 2) return null;
              return (
                <g key={h.hub.id} style={{ opacity: dimHub(h.hub.id) ? 0.3 : 1 }}>
                  <line x1={t[0]} y1={t[1]} x2={p[0]} y2={p[1]} stroke="var(--di-fg-subtle)" strokeWidth={0.9} />
                  <circle cx={t[0]} cy={t[1]} r={2.2} fill="var(--di-fg-muted)" stroke="var(--di-surface)" strokeWidth={0.8} />
                </g>
              );
            })}
          </g>

          {/* Hub markers */}
          <g>
            {drawOrder.map((h) => {
              const p = points.get(h.hub.id);
              if (!p) return null;
              const r = radius(h);
              const selected = h.hub.id === selectedHubId;
              const dim = dimHub(h.hub.id);
              const mix = (['red', 'amber', 'green', 'unknown'] as const).map((status) => ({ status, n: h.ragMix[status] })).filter((m) => m.n > 0);
              const slices = ringPie(mix);
              const ringR = r + 3.2;
              const metricText = `${metricValue(h, metric)} ${METRIC_LABEL[metric].toLowerCase()}`;
              return (
                <g
                  key={h.hub.id}
                  data-hub={h.hub.id}
                  transform={`translate(${p[0].toFixed(1)},${p[1].toFixed(1)})`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected}
                  aria-label={`${h.hub.name}, ${h.hub.country}. ${metricText}. Health ${terms.rag[h.health]}.${h.attention ? ' Needs attention.' : ''}`}
                  className="cursor-pointer outline-none"
                  style={{ opacity: dim ? 0.28 : 1, transition: 'opacity var(--di-duration-slow) var(--di-ease-standard)' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectHub(selected ? null : h.hub.id);
                  }}
                  onKeyDown={(e) => onHubKey(e, h.hub.id)}
                  onMouseEnter={() => setHoverHubId(h.hub.id)}
                  onMouseLeave={() => setHoverHubId((cur) => (cur === h.hub.id ? null : cur))}
                  onFocus={() => setFocusHubId(h.hub.id)}
                  onBlur={() => setFocusHubId((cur) => (cur === h.hub.id ? null : cur))}
                >
                  {h.attention ? (
                    <>
                      <circle r={r} fill="none" stroke={STATUS_VAR[h.health === 'unknown' ? 'amber' : h.health]} strokeWidth={1.5} className="di-global-pulse" pointerEvents="none" />
                      <circle r={ringR + 3.5} fill="none" stroke={STATUS_VAR[h.health === 'unknown' ? 'amber' : h.health]} strokeOpacity={0.55} strokeWidth={1} strokeDasharray="2 2.5" pointerEvents="none" />
                    </>
                  ) : null}
                  <circle r={ringR + 2} fill="var(--di-surface)" fillOpacity={0.7} />
                  {slices.map((s) => (
                    <path key={s.data.status} d={ringArc({ ...s, innerRadius: ringR - 1, outerRadius: ringR + 1.2 } as never) ?? ''} fill={STATUS_VAR[s.data.status]} />
                  ))}
                  <circle r={r} fill={STATUS_VAR[h.health]} stroke="var(--di-surface)" strokeWidth={1.2} />
                  <StatusShape status={h.health} r={r} />
                  {selected || focusHubId === h.hub.id ? (
                    <circle r={ringR + 5.5} fill="none" stroke="var(--di-accent)" strokeWidth={2.2} pointerEvents="none" />
                  ) : null}
                </g>
              );
            })}
          </g>

          {/* Day counts on late arcs, and on any arc being emphasised */}
          <g pointerEvents="none">
            {arcGeoms
              .filter(({ a, len }) => !dimArc(a) && a.lateDays > 0 && ((a.tone === 'late' && len > 90) || a.dep.id === hoverDepId || a.dep.id === focusDependencyId || (selectedHubId && (a.dep.fromHubId === selectedHubId || a.dep.toHubId === selectedHubId))))
              .map(({ a, g }) => {
                const text = a.tone === 'late' ? `${a.lateDays} days late` : `${a.lateDays} days past need-by`;
                const w = text.length * 6.3 + 14;
                const tone = a.tone === 'late' ? 'red' : 'amber';
                // Slide the pill along the arc away from hub markers and their labels.
                const clearance = (pt: [number, number]) =>
                  Math.min(...[...points.values()].map((hp) => Math.max(Math.abs(hp[0] - pt[0]) - w / 2, Math.abs(hp[1] - pt[1]) - 10) ));
                const pos = [0.5, 0.4, 0.6, 0.3, 0.7].map((t) => g.at(t)).reduce((best, pt) => (clearance(pt) > clearance(best) + 6 ? pt : best));
                return (
                  <g key={a.dep.id} transform={`translate(${pos[0].toFixed(1)},${pos[1].toFixed(1)})`}>
                    <rect x={-w / 2} y={-10} width={w} height={20} rx={10} fill={`var(--di-status-${tone}-soft)`} stroke={`var(--di-status-${tone})`} strokeWidth={1} />
                    <rect x={-w / 2} y={-10} width={w} height={20} rx={10} fill="var(--di-surface)" fillOpacity={0.55} />
                    <text textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700} fill={`var(--di-status-${tone}-fg)`} fontFamily="var(--di-font-sans)">
                      {text}
                    </text>
                  </g>
                );
              })}
          </g>
          {/* Labels: placed to avoid collisions; the rest appear on hover, focus or selection */}
          <g pointerEvents="none">
            {model.hubs.map((h) => {
              const l = labels.get(h.hub.id);
              if (!l) return null;
              const active = h.hub.id === activeHubId || h.hub.id === selectedHubId || Boolean(focusHubIds?.has(h.hub.id));
              if (!l.fits && !active) return null;
              const dim = dimHub(h.hub.id);
              return (
                <g key={h.hub.id} style={{ opacity: dim ? 0.3 : 1, transition: 'opacity var(--di-duration-slow) var(--di-ease-standard)' }}>
                  {l.leader ? <line {...l.leader} stroke="var(--di-fg-subtle)" strokeWidth={0.8} /> : null}
                  <text
                    x={l.x}
                    y={l.y}
                    textAnchor={l.anchor}
                    dominantBaseline="central"
                    fontSize={11.5}
                    fontWeight={active ? 700 : 600}
                    fill={active ? 'var(--di-title)' : 'var(--di-fg)'}
                    stroke="var(--di-map-water)"
                    strokeWidth={3.2}
                    strokeOpacity={0.9}
                    paintOrder="stroke"
                    fontFamily="var(--di-font-sans)"
                  >
                    {h.hub.name}
                  </text>
                </g>
              );
            })}
          </g>

        </svg>
      ) : null}

      {/* Hover / focus card for a hub */}
      {tooltipHub && tooltipPoint && frame ? (
        <div
          className="pointer-events-none absolute z-10 w-56 rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-raised"
          style={{
            left: Math.min(Math.max(tooltipPoint[0] - 112, 4), frame.width - 228),
            top: tooltipPoint[1] > frame.height * 0.55 ? tooltipPoint[1] - radius(tooltipHub) - 108 : tooltipPoint[1] + radius(tooltipHub) + 14,
          }}
          role="presentation"
        >
          <div className="font-display text-[13px] font-semibold text-title">{tooltipHub.hub.name}</div>
          <div className="text-fg-subtle">
            {tooltipHub.hub.country}
            {tooltipHub.utcOffset ? ` · ${tooltipHub.utcOffset}` : ''}
          </div>
          <dl className="mt-1.5 grid grid-cols-3 gap-1 tabular-nums">
            <div>
              <dt className="text-fg-subtle">Deliv.</dt>
              <dd className="font-semibold text-fg">{tooltipHub.deliverableIds.length}</dd>
            </div>
            <div>
              <dt className="text-fg-subtle">Open</dt>
              <dd className="font-semibold text-fg">{tooltipHub.openWork}</dd>
            </div>
            <div>
              <dt className="text-fg-subtle">People</dt>
              <dd className="font-semibold text-fg">{tooltipHub.people}</dd>
            </div>
          </dl>
          <div className="mt-1.5 text-fg-muted">
            Health {terms.rag[tooltipHub.health]}
            {tooltipHub.attention ? ` · ${tooltipHub.disagreementIds.length} disagreeing, ${tooltipHub.lateDependencyIds.length} late dep.` : ''}
          </div>
        </div>
      ) : null}

      {/* Hover card for an arc */}
      {hoverDep && frame ? (
        <div className={cx('pointer-events-none absolute top-3 right-3 z-10 w-72 rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-raised')} role="presentation">
          <div className="font-semibold text-title">{hoverDep.dep.title}</div>
          <div className="mt-0.5 text-fg-muted">
            {model.hubById.get(hoverDep.dep.fromHubId)?.hub.name} → {model.hubById.get(hoverDep.dep.toHubId)?.hub.name} · {terms.dependencyStatus[hoverDep.dep.status]}
          </div>
          <div className="mt-0.5 text-fg-subtle tabular-nums">
            Need by {formatDate(hoverDep.dep.needBy)}
            {hoverDep.lateDays > 0 ? ` · ${hoverDep.lateDays} days late` : ''}
          </div>
        </div>
      ) : null}
    </div>
  );
}
