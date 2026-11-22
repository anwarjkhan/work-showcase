/**
 * HTML drawing for each block type, used by the slide preview (html.tsx).
 *
 * Positions come from layout.ts, the same placement the PowerPoint renderer
 * uses. Colours are the slide's own light palette from theme.ts via inline
 * style, because the preview is a picture of the slide, not app chrome. Font
 * sizes are in container-width units so the preview scales with its box.
 */
import type { CSSProperties, ReactNode } from 'react';
import type { Block, Cell, MeasureView, Tone } from '@/lib/slides/types';
import { measuresStacked, ragChipWidth } from './layout';
import { CHART_PALETTE, COLOURS, FONTS, RENDER_TEXT, SLIDE_W, TONES, TYPE, css, isStatusTone, statusBesideLabel, tableRowHeight, tileValueSize, toneLabel, withGlyph, type Rect } from './theme';
import { TIMELINE_AXIS_H, TIMELINE_LABEL_LINE_H, TIMELINE_LABEL_W, TIMELINE_ROW_MAX_H, TIMELINE_ROW_MIN_H, placeRowLabels, timelineGeometry } from './timeline';

type BlockOf<T extends Block['type']> = Extract<Block, { type: T }>;

/** Font size in points, as a share of the slide's width (the preview root is an inline-size container). */
export const pt = (points: number): string => `${((points / (SLIDE_W * 72)) * 100).toFixed(4)}cqw`;
/** Length in inches, as a share of the slide's width. */
export const inch = (inches: number): string => `${((inches / SLIDE_W) * 100).toFixed(4)}cqw`;

const toneFg = (tone?: Tone) => (tone && isStatusTone(tone) ? css(TONES[tone].fg) : css(COLOURS.ink));

function Tile({ tone, children, style }: { tone?: Tone; children: ReactNode; style?: CSSProperties }) {
  const status = tone && isStatusTone(tone);
  return (
    <div
      style={{
        position: 'relative',
        flex: '1 1 0',
        minWidth: 0,
        background: css(COLOURS.card),
        border: `1px solid ${css(COLOURS.line)}`,
        borderRadius: inch(0.06),
        padding: `${inch(0.1)} ${inch(0.18)}`,
        overflow: 'hidden',
        ...style,
      }}
    >
      {status ? <span aria-hidden style={{ position: 'absolute', left: 0, top: inch(0.06), bottom: inch(0.06), width: inch(0.07), background: css(TONES[tone].mark) }} /> : null}
      {children}
    </div>
  );
}

/** Mirrors statTile in pptx-blocks.ts: status beside the label when it fits, else leading the caption. */
function TileBody({ label, tone, value, caption, innerW }: { label: string; tone?: Tone; value: string; caption?: string; innerW: number }) {
  const status = toneLabel(tone);
  const colour = toneFg(tone);
  const own = Boolean(status) && value.startsWith(TONES[tone!].glyph);
  const beside = Boolean(status) && !own && statusBesideLabel(label, status, innerW);
  const lead = status && !own && !beside ? status : '';
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: inch(0.1), fontSize: pt(TYPE.label), color: css(COLOURS.muted), height: inch(0.3), overflow: 'hidden' }}>
        <span>{label}</span>
        {beside ? <strong style={{ color: colour, whiteSpace: 'nowrap' }}>{status}</strong> : null}
      </div>
      <div style={{ fontFamily: FONTS.heading, fontWeight: 700, fontSize: pt(tileValueSize(value, innerW)), color: colour, height: inch(0.5), display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>{value}</div>
      {caption || lead ? (
        <div style={{ fontSize: pt(TYPE.caption), color: css(COLOURS.muted), lineHeight: 1.2 }}>
          {lead ? <strong style={{ color: colour }}>{caption ? `${lead} \u00B7 ` : lead}</strong> : null}
          {caption}
        </div>
      ) : null}
    </>
  );
}

const tileInner = (width: number, n: number, gap: number) => (width - gap * (n - 1)) / n - 0.36;

function Kpis({ b, rect }: { b: BlockOf<'kpis'>; rect: Rect }) {
  const innerW = tileInner(rect.w, b.items.length, 0.2);
  return (
    <div style={{ display: 'flex', gap: inch(0.2), height: '100%' }}>
      {b.items.map((item, i) => (
        <Tile key={i} tone={item.tone}>
          <TileBody label={item.label} tone={item.tone} value={item.value} caption={item.caption} innerW={innerW} />
        </Tile>
      ))}
    </div>
  );
}

function measureParts(m: MeasureView) {
  return m.computable ? { value: m.value, tone: undefined } : { value: withGlyph(m.value, 'unknown'), tone: 'unknown' as const };
}

function Measures({ b, rect }: { b: BlockOf<'measures'>; rect: Rect }) {
  const stacked = measuresStacked(rect.w);
  const innerW = stacked ? rect.w - 0.36 : tileInner(rect.w, 3, 0.2);
  const work = measureParts(b.work);
  const accepted = measureParts(b.accepted);
  const readiness = withGlyph(b.readiness.stateText, b.readiness.tone);
  return (
    <div style={{ display: 'flex', flexDirection: stacked ? 'column' : 'row', gap: inch(stacked ? 0.15 : 0.2), height: '100%' }}>
      <Tile tone={work.tone}>
        <TileBody label={b.work.label} tone={work.tone} value={work.value} caption={b.work.caption} innerW={innerW} />
      </Tile>
      <Tile tone={accepted.tone}>
        <TileBody label={b.accepted.label} tone={accepted.tone} value={accepted.value} caption={b.accepted.caption} innerW={innerW} />
      </Tile>
      <Tile tone={b.readiness.tone}>
        <TileBody label={b.readiness.label} tone={b.readiness.tone} value={readiness} caption={b.readiness.caption} innerW={innerW} />
      </Tile>
    </div>
  );
}

function Chip({ label, text, tone, width }: { label: string; text: string; tone: Tone; width: string }) {
  const t = TONES[tone];
  return (
    <div style={{ width, flex: '0 0 auto' }}>
      <div style={{ fontSize: pt(TYPE.label), color: css(COLOURS.muted), height: inch(0.3) }}>{label}</div>
      <div style={{ background: css(t.soft), border: `1px solid ${css(t.line)}`, borderRadius: inch(0.08), color: css(t.fg), fontWeight: 700, fontSize: pt(16), height: inch(0.48), display: 'flex', alignItems: 'center', padding: `0 ${inch(0.14)}` }}>
        {withGlyph(text, tone)}
      </div>
    </div>
  );
}

function RagPair({ b, rect }: { b: BlockOf<'rag-pair'>; rect: Rect }) {
  const chipW = ragChipWidth(rect.w);
  const side = rect.w >= 9;
  const note =
    b.disagree || b.reason ? (
      <div style={{ fontSize: pt(TYPE.body), marginTop: side ? inch(0.05) : inch(0.1) }}>
        {b.disagree ? <div style={{ fontWeight: 700, color: css(COLOURS.redFg) }}>{`≠ ${RENDER_TEXT.disagree}`}</div> : null}
        {b.reason ? <div style={{ fontSize: pt(TYPE.caption), color: css(COLOURS.muted) }}>{b.reason}</div> : null}
      </div>
    ) : null;
  return (
    <div style={{ display: 'flex', flexDirection: side ? 'row' : 'column', gap: inch(side ? 0.3 : 0) }}>
      <div style={{ display: 'flex', gap: inch(0.25) }}>
        <Chip label={RENDER_TEXT.reported} text={b.reportedText} tone={b.reported} width={inch(chipW)} />
        <Chip label={RENDER_TEXT.evidence} text={b.evidenceText} tone={b.evidence} width={inch(chipW)} />
      </div>
      {note}
    </div>
  );
}

function TableBlock({ b, rect }: { b: BlockOf<'table'>; rect: Rect }) {
  const total = b.columns.reduce((s, c) => s + Math.max(0.1, c.width), 0);
  const rowH = inch(tableRowHeight(rect.h, Math.max(1, b.rows.length) + 1));
  const border = `1px solid ${css(COLOURS.line)}`;
  const cellStyle = (align?: string): CSSProperties => ({ border, padding: `0 ${inch(0.08)}`, textAlign: (align ?? 'left') as CSSProperties['textAlign'], height: rowH, verticalAlign: 'middle' });
  const renderCell = (cell: Cell | undefined, ci: number, zebra: string) => {
    const align = b.columns[ci]?.align;
    if (cell === undefined || typeof cell === 'string') return <td key={ci} style={{ ...cellStyle(align), background: zebra }}>{cell ?? ''}</td>;
    const status = cell.tone && isStatusTone(cell.tone) ? TONES[cell.tone] : undefined;
    return (
      <td key={ci} style={{ ...cellStyle(align), background: status ? css(status.soft) : zebra, color: status ? css(status.fg) : cell.tone === 'accent' ? css(COLOURS.heading) : undefined, fontWeight: cell.bold || status ? 700 : 400 }}>
        {withGlyph(cell.text, cell.tone)}
      </td>
    );
  };
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: pt(TYPE.table), color: css(COLOURS.body) }}>
      <colgroup>
        {b.columns.map((c, i) => (
          <col key={i} style={{ width: `${(Math.max(0.1, c.width) / total) * 100}%` }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {b.columns.map((c, i) => (
            <th key={i} scope="col" style={{ ...cellStyle(c.align), background: css(COLOURS.navy), color: css(COLOURS.paper), fontWeight: 700 }}>
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {b.rows.length === 0 ? (
          <tr>
            <td colSpan={b.columns.length} style={{ ...cellStyle(), fontStyle: 'italic', color: css(COLOURS.muted) }}>
              {b.emptyText ?? RENDER_TEXT.noRows}
            </td>
          </tr>
        ) : (
          b.rows.map((row, ri) => <tr key={ri}>{b.columns.map((_, ci) => renderCell(row[ci], ci, css(ri % 2 ? COLOURS.card : COLOURS.paper)))}</tr>)
        )}
      </tbody>
    </table>
  );
}

/** Simple SVG bars in inch-based units (1 unit = 0.01 in), so text sizes match points. */
function Chart({ b, rect }: { b: BlockOf<'bar' | 'stacked-bar'>; rect: Rect }) {
  const W = rect.w * 100;
  const H = rect.h * 100;
  const fs = (p: number) => (p / 72) * 100;
  const stacked = b.type === 'stacked-bar';
  let next = 0;
  const colours = b.series.map((s) => (s.tone && isStatusTone(s.tone) ? TONES[s.tone].mark : s.tone === 'accent' ? COLOURS.accent : CHART_PALETTE[next++ % CHART_PALETTE.length]!));
  const totals = b.categories.map((_, ci) => (stacked ? b.series.reduce((s, x) => s + (x.values[ci] ?? 0), 0) : Math.max(0, ...b.series.map((x) => x.values[ci] ?? 0))));
  const max = Math.max(1, ...totals);
  const legendH = 40;
  const plotTop = 10;
  const plotBottom = H - legendH - (b.horizontal ? 10 : 45);
  const labelW = b.horizontal ? 140 : 0;
  const plotLeft = labelW + 10;
  const plotRight = W - 30;
  const n = b.categories.length;
  const band = ((b.horizontal ? plotBottom - plotTop : plotRight - plotLeft) / Math.max(1, n));
  const barThick = band * 0.62;
  const perSeries = stacked ? barThick : barThick / Math.max(1, b.series.length);
  const scale = (v: number) => (v / max) * (b.horizontal ? plotRight - plotLeft - 30 : plotBottom - plotTop - 25);
  const bars: ReactNode[] = [];
  b.categories.forEach((cat, ci) => {
    let offset = 0;
    b.series.forEach((s, si) => {
      const v = s.values[ci] ?? 0;
      const len = scale(v);
      const pos = (b.horizontal ? plotTop : plotLeft) + ci * band + (band - barThick) / 2 + (stacked ? 0 : si * perSeries);
      const x = b.horizontal ? plotLeft + offset : pos;
      const y = b.horizontal ? pos : plotBottom - offset - len;
      const w = b.horizontal ? len : perSeries;
      const h = b.horizontal ? perSeries : len;
      bars.push(<rect key={`${ci}-${si}`} x={x} y={y} width={Math.max(0, w)} height={Math.max(0, h)} fill={css(colours[si]!)} />);
      if (v !== 0) {
        const lx = stacked ? x + w / 2 : b.horizontal ? x + w + 6 : x + w / 2;
        const ly = stacked ? y + h / 2 : b.horizontal ? y + h / 2 : y - 6;
        bars.push(
          <text key={`l${ci}-${si}`} x={lx} y={ly} fontSize={fs(TYPE.chartDataLabel)} fontWeight={700} fill={css(COLOURS.body)} textAnchor={stacked || !b.horizontal ? 'middle' : 'start'} dominantBaseline={stacked || b.horizontal ? 'central' : 'auto'}>
            {v}
          </text>,
        );
      }
      if (stacked) offset += len;
    });
    const cx = b.horizontal ? labelW : plotLeft + ci * band + band / 2;
    const cy = b.horizontal ? plotTop + ci * band + band / 2 : plotBottom + 22;
    bars.push(
      <text key={`c${ci}`} x={cx} y={cy} fontSize={fs(TYPE.chartLabel)} fill={css(COLOURS.body)} textAnchor={b.horizontal ? 'end' : 'middle'} dominantBaseline="central">
        {cat}
      </text>,
    );
  });
  const legendItemW = Math.min(180, W / Math.max(1, b.series.length));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" role="img" aria-label={`Chart: ${b.series.map((s) => s.name).join(', ')} by ${b.categories.join(', ')}`} style={{ display: 'block', fontFamily: FONTS.body }}>
      <line x1={plotLeft} y1={b.horizontal ? plotTop : plotBottom} x2={b.horizontal ? plotLeft : plotRight} y2={plotBottom} stroke={css(COLOURS.axis)} />
      {bars}
      {b.series.map((s, si) => (
        <g key={si} transform={`translate(${si * legendItemW + 10}, ${H - legendH / 2})`}>
          <rect x={0} y={-8} width={16} height={16} fill={css(colours[si]!)} />
          <text x={22} y={0} fontSize={fs(TYPE.chartLabel)} fill={css(COLOURS.body)} dominantBaseline="central">
            {s.name}
          </text>
        </g>
      ))}
      {b.unit ? (
        <text x={W - 4} y={plotTop + 4} fontSize={fs(TYPE.chartLabel)} fill={css(COLOURS.muted)} textAnchor="end" dominantBaseline="hanging">
          {b.unit}
        </text>
      ) : null}
    </svg>
  );
}

function StageRail({ b }: { b: BlockOf<'stage-rail'> }) {
  return (
    <ol style={{ display: 'flex', gap: inch(0.28), height: '100%', listStyle: 'none', margin: 0, padding: 0 }}>
      {b.stages.map((s, i) => {
        const current = s.state === 'current';
        const done = s.state === 'done';
        return (
          <li
            key={s.stageId}
            aria-current={current ? 'step' : undefined}
            style={{
              flex: '1 1 0',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              background: css(current ? COLOURS.navy : done ? COLOURS.card : COLOURS.paper),
              color: css(current ? COLOURS.paper : done ? COLOURS.body : COLOURS.muted),
              border: `${current ? 2 : 1}px ${s.state === 'not-started' ? 'dashed' : 'solid'} ${css(current ? COLOURS.accent : done ? COLOURS.lineStrong : COLOURS.line)}`,
              borderRadius: inch(0.08),
              padding: inch(0.08),
              fontSize: pt(TYPE.caption),
              overflow: 'hidden',
            }}
          >
            <strong style={{ fontSize: pt(TYPE.label) }}>{`${i + 1}. ${s.name}`}</strong>
            <span style={{ fontWeight: current ? 700 : 400 }}>{current ? RENDER_TEXT.stageCurrent : done ? RENDER_TEXT.stageDone : RENDER_TEXT.stageNotStarted}</span>
            <span style={{ color: current ? '#DCE6FA' : css(COLOURS.muted) }}>{s.detail}</span>
            {s.movedBackFrom ? (
              <span style={{ marginTop: 'auto', background: css(COLOURS.amberSoft), border: `1px solid ${css(COLOURS.amberLine)}`, color: css(COLOURS.amberFg), fontWeight: 700, borderRadius: inch(0.05), padding: `${inch(0.03)} ${inch(0.07)}` }}>
                {`◄ ${RENDER_TEXT.movedBackFrom} ${s.movedBackFrom}`}
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/** Timeline in SVG, using exactly the PowerPoint renderer's geometry. */
function Timeline({ b, rect }: { b: BlockOf<'timeline'>; rect: Rect }) {
  const g = timelineGeometry(b);
  const u = (inches: number) => inches * 100;
  const fs = (p: number) => (p / 72) * 100;
  const plotX = TIMELINE_LABEL_W;
  const plotW = rect.w - TIMELINE_LABEL_W - 0.1;
  const xAt = (f: number) => u(plotX + f * plotW);
  const top = TIMELINE_AXIS_H;
  const rowsH = rect.h - TIMELINE_AXIS_H - 0.28;
  const rowH = Math.max(TIMELINE_ROW_MIN_H, Math.min(TIMELINE_ROW_MAX_H, rowsH / Math.max(1, g.rows.length)));
  const bottom = top + rowH * g.rows.length;
  return (
    <svg viewBox={`0 0 ${u(rect.w)} ${u(rect.h)}`} width="100%" height="100%" role="img" aria-label={`Timeline: ${b.rows.map((r) => r.label).join(', ')}`} style={{ display: 'block', fontFamily: FONTS.body }}>
      <line x1={u(plotX)} x2={u(plotX + plotW)} y1={u(top)} y2={u(top)} stroke={css(COLOURS.axis)} />
      {g.ticks.map((t) => (
        <g key={t.date}>
          <line x1={xAt(t.at)} x2={xAt(t.at)} y1={u(top)} y2={u(bottom)} stroke={css(COLOURS.grid)} />
          <text x={xAt(t.at) + 4} y={u(top) - 6} fontSize={fs(TYPE.table)} fill={css(COLOURS.muted)}>
            {t.label}
          </text>
        </g>
      ))}
      {g.rows.map((rg, i) => {
        const y = top + i * rowH;
        const t = TONES[rg.row.tone ?? 'accent'];
        const barY = y + 0.08;
        const barH = 0.24;
        const x0 = xAt(rg.start);
        const x1 = xAt(rg.end);
        const endX = rg.projectedEnd !== undefined ? xAt(rg.projectedEnd) : x1;
        return (
          <g key={i}>
            {i > 0 ? <line x1={0} x2={u(rect.w)} y1={u(y)} y2={u(y)} stroke={css(COLOURS.line)} /> : null}
            <text x={0} y={u(barY + barH / 2)} fontSize={fs(TYPE.caption)} fontWeight={700} fill={css(COLOURS.ink)} dominantBaseline="central">
              {rg.row.label}
            </text>
            <rect x={x0} y={u(barY)} width={Math.max(4, x1 - x0)} height={u(barH)} fill={css(t.soft)} stroke={css(t.mark)} />
            {rg.completion > 0 ? <rect x={x0} y={u(barY)} width={Math.max(2, (x1 - x0) * rg.completion)} height={u(barH)} fill={css(t.mark)} /> : null}
            {rg.projectedEnd !== undefined ? <rect x={x1} y={u(barY + 0.03)} width={Math.max(3, endX - x1)} height={u(barH - 0.06)} fill={css(COLOURS.amberSoft)} stroke={css(COLOURS.amber)} strokeDasharray="6 4" /> : null}
            {rg.earlyEnd !== undefined ? <line x1={xAt(rg.earlyEnd)} x2={xAt(rg.earlyEnd)} y1={u(barY - 0.04)} y2={u(barY + barH + 0.04)} stroke={css(COLOURS.green)} strokeWidth={3} /> : null}
            {rg.milestones.map((ms, mi) => {
              const mx = xAt(ms.at);
              const my = u(barY + barH / 2);
              const mt = ms.tone && isStatusTone(ms.tone) ? TONES[ms.tone] : undefined;
              return <polygon key={mi} points={`${mx},${my - 10} ${mx + 10},${my} ${mx},${my + 10} ${mx - 10},${my}`} fill={css(mt ? mt.mark : ms.regulatory ? COLOURS.navy : COLOURS.paper)} stroke={css(COLOURS.navy)} />;
            })}
            {(() => {
              // Same label placement as the PowerPoint renderer (placeRowLabels).
              const endIn = rg.projectedEnd !== undefined ? plotX + rg.projectedEnd * plotW : plotX + rg.end * plotW;
              const noteOnBar = Boolean(rg.row.note) && rect.w - endIn - 0.12 >= 1.6;
              const labels: { anchor: number; text: string; priority?: boolean; node: ReactNode }[] = rg.milestones.map((ms) => {
                const mt = ms.tone && isStatusTone(ms.tone) ? TONES[ms.tone] : undefined;
                const label = mt ? withGlyph(ms.label, ms.tone) : ms.label;
                return {
                  anchor: plotX + ms.at * plotW - 0.1,
                  text: `${ms.regulatory ? `${RENDER_TEXT.regulatory} ` : ''}${label}`,
                  node: (
                    <>
                      {ms.regulatory ? <tspan fontWeight={700} fill={css(COLOURS.redFg)}>{`${RENDER_TEXT.regulatory} `}</tspan> : null}
                      <tspan fill={css(mt ? mt.fg : COLOURS.body)}>{label}</tspan>
                    </>
                  ),
                };
              });
              if (rg.row.note && !noteOnBar) labels.push({ anchor: endIn - 0.1, priority: true, text: rg.row.note, node: <tspan fontWeight={700} fill={css(COLOURS.amberFg)}>{rg.row.note}</tspan> });
              const labelTop = barY + barH + 0.03;
              const lines = Math.max(1, Math.floor((rowH - (labelTop - y) - 0.02) / TIMELINE_LABEL_LINE_H));
              const spots = placeRowLabels(labels, plotX, rect.w, Math.min(2, lines));
              return (
                <>
                  {labels.map((l, li) => {
                    const spot = spots[li];
                    if (!spot) return null;
                    return (
                      <text key={li} x={u(spot.x)} y={u(labelTop + (spot.line + 0.5) * TIMELINE_LABEL_LINE_H)} fontSize={fs(TYPE.table)} dominantBaseline="central">
                        {l.node}
                      </text>
                    );
                  })}
                  {rg.row.note && noteOnBar ? (
                    <text x={endX + 10} y={u(barY + barH / 2)} fontSize={fs(TYPE.table)} fontWeight={700} fill={css(COLOURS.amberFg)} dominantBaseline="central">
                      {rg.row.note}
                    </text>
                  ) : null}
                </>
              );
            })()}
          </g>
        );
      })}
      {g.today !== null ? (
        <g>
          <line x1={xAt(g.today)} x2={xAt(g.today)} y1={u(top - 0.05)} y2={u(bottom + 0.05)} stroke={css(COLOURS.accent)} strokeWidth={2} strokeDasharray="6 4" />
          <text x={xAt(g.today)} y={u(bottom + 0.18)} fontSize={fs(TYPE.table)} fontWeight={700} fill={css(COLOURS.heading)} textAnchor="middle" dominantBaseline="central">
            {RENDER_TEXT.today}
          </text>
        </g>
      ) : null}
    </svg>
  );
}

function Bullets({ b }: { b: BlockOf<'bullets'> }) {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: pt(TYPE.bullet) }}>
      {b.items.map((item, i) => {
        const tone = item.tone && isStatusTone(item.tone) ? TONES[item.tone] : undefined;
        return (
          <li key={i} style={{ display: 'flex', gap: inch(0.12), marginBottom: pt(6), color: tone ? css(tone.fg) : css(COLOURS.body) }}>
            <span aria-hidden style={{ color: tone ? css(tone.mark) : css(COLOURS.body), width: inch(0.14), flex: '0 0 auto' }}>
              {tone ? tone.glyph : '•'}
            </span>
            <span>{item.text}</span>
          </li>
        );
      })}
    </ul>
  );
}

function TextBlock({ b }: { b: BlockOf<'text'> }) {
  const style: CSSProperties =
    b.emphasis === 'statement'
      ? { fontFamily: FONTS.heading, fontSize: pt(TYPE.statement), fontWeight: 700, color: css(COLOURS.ink), lineHeight: 1.2 }
      : b.emphasis === 'body'
        ? { fontSize: pt(TYPE.body), color: css(COLOURS.body) }
        : { fontSize: pt(TYPE.caption), color: css(COLOURS.muted) };
  return <p style={{ margin: 0, ...style }}>{b.text}</p>;
}

function Callout({ b }: { b: BlockOf<'callout'> }) {
  const t = TONES[b.tone];
  return (
    <div style={{ height: '100%', background: css(t.soft), border: `1px solid ${css(t.line)}`, borderLeft: `${inch(0.08)} solid ${css(t.mark)}`, padding: `${inch(0.14)} ${inch(0.17)}`, fontSize: pt(TYPE.body), boxSizing: 'border-box' }}>
      {b.title ? <strong style={{ display: 'block', color: css(t.fg) }}>{withGlyph(b.title, b.tone)}</strong> : null}
      <span style={{ color: css(COLOURS.body) }}>{b.text}</span>
    </div>
  );
}

function DocumentBlock({ b }: { b: BlockOf<'document'> }) {
  return (
    <div style={{ fontSize: pt(TYPE.documentBody), color: css(COLOURS.body), height: '100%', overflow: 'hidden' }}>
      <span style={{ display: 'inline-block', background: css(COLOURS.scriptedSoft), border: `1px solid ${css(COLOURS.scripted)}`, color: css(COLOURS.scripted), fontWeight: 700, fontSize: pt(TYPE.caption), borderRadius: inch(0.06), padding: `${inch(0.03)} ${inch(0.11)}`, marginBottom: inch(0.12) }}>
        {b.label}
      </span>
      {b.sections.map((s, i) => (
        <div key={i} style={{ marginTop: i ? pt(8) : 0 }}>
          <div style={{ fontWeight: 700, fontSize: pt(TYPE.documentHeading), color: css(COLOURS.heading) }}>{s.heading}</div>
          <p style={{ margin: 0 }}>
            {s.sentences.map((x, j) => (
              <span key={j}>
                {x.text}
                {x.cites.length ? <sup style={{ color: css(COLOURS.heading) }}>{x.cites.map((n) => `[${n}]`).join('')}</sup> : null}{' '}
              </span>
            ))}
          </p>
        </div>
      ))}
    </div>
  );
}

export function HtmlBlock({ block, rect }: { block: Block; rect: Rect }) {
  switch (block.type) {
    case 'kpis':
      return <Kpis b={block} rect={rect} />;
    case 'rag-pair':
      return <RagPair b={block} rect={rect} />;
    case 'measures':
      return <Measures b={block} rect={rect} />;
    case 'table':
      return <TableBlock b={block} rect={rect} />;
    case 'bar':
    case 'stacked-bar':
      return <Chart b={block} rect={rect} />;
    case 'stage-rail':
      return <StageRail b={block} />;
    case 'timeline':
      return <Timeline b={block} rect={rect} />;
    case 'bullets':
      return <Bullets b={block} />;
    case 'text':
      return <TextBlock b={block} />;
    case 'callout':
      return <Callout b={block} />;
    case 'document':
      return <DocumentBlock b={block} />;
  }
}
