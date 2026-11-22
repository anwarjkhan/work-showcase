/**
 * Building blocks shared by slide builders: the status pair and measures
 * blocks, status cells, finding references, severity tones and the scripted
 * agent draft as a document block with numbered citations.
 */
import { daysBetween } from '@/lib/config/clock';
import { terms } from '@/lib/config/terminology';
import type { EntityRef, EvidenceRag, EvidenceRagStatus, RagStatus, Severity, StatusDraft } from '@/lib/types';
import { citationsFor, date, ragWord, recordInfo, type Citation, type SlideEnv } from '../../extract';
import type { Block, Cell, DocumentSection, MeasureView, ReadinessView, TimelineRow, Tone } from '../../types';
import { shorten, TIMELINE_ROWS_ALONE, TIMELINE_ROWS_WITH_TOP, timelineLabelLines, toned } from '../kit';

/** Label every scripted-agent document carries on the slide. */
export const DRAFT_LABEL = 'Scripted agent draft';

export function ragPair(reported: RagStatus, evidence: EvidenceRagStatus, reason?: string): Block {
  const block: Block = {
    type: 'rag-pair',
    reported,
    reportedText: `${terms.ragKinds.reported}: ${ragWord(reported)}`,
    evidence,
    evidenceText: `${terms.ragKinds.evidence}: ${ragWord(evidence)}`,
    disagree: evidence !== 'unknown' && evidence !== reported,
  };
  return reason ? { ...block, reason } : block;
}

/** Reason text beside the status pair is kept short so the pair stays one band high; slides list reasons in full. */
const PAIR_REASON_MAX = 110;
export const ragPairOf = (rag: EvidenceRag, reason?: string): Block => {
  const text = reason ?? rag.reasons[0]?.message;
  return ragPair(rag.reported, rag.evidence, text ? shorten(text, PAIR_REASON_MAX) : undefined);
};

export const measures = (v: { work: MeasureView; accepted: MeasureView; readiness: ReadinessView }): Block => ({ type: 'measures', work: v.work, accepted: v.accepted, readiness: v.readiness });

export const ragCell = (s: EvidenceRagStatus): Cell => toned(ragWord(s), s);

export const readinessCell = (v: ReadinessView | null): Cell => (v ? toned(v.stateText, v.tone) : toned(terms.readiness.unknown, 'unknown'));

const SEVERITY_TONE: Record<Severity, Tone> = { critical: 'red', high: 'amber', medium: 'neutral', low: 'neutral' };
export const severityCell = (s: Severity): Cell => toned(terms.severity[s], SEVERITY_TONE[s]);

/** Refs behind engine reasons: finding refs are replaced by the finding's subject and evidence records. */
export function expandRefs(env: SlideEnv, refs: readonly EntityRef[]): EntityRef[] {
  const out: EntityRef[] = [];
  for (const r of refs) {
    if (r.kind !== 'finding') {
      out.push(r);
      continue;
    }
    const f = env.result.findings.find((x) => x.id === r.id);
    if (f) out.push(f.subject, ...f.evidence);
  }
  return out;
}

/** Short labels of the citable records among refs ("CCR-301, TD-1016"). */
export function refLabels(env: SlideEnv, refs: readonly EntityRef[]): string {
  return citationsFor(env, refs)
    .map((c) => c.label)
    .join(', ');
}

/** A draft as a document block, its citations (in citation order) and the numbered list for notes. */
export function draftDocument(env: SlideEnv, draft: StatusDraft): { block: Block; citations: Citation[]; numbered: string } {
  const citations = citationsFor(
    env,
    draft.sections.flatMap((s) => s.sentences.flatMap((x) => x.citations)),
  );
  const indexOf = new Map(citations.map((c, i) => [`${c.ref.kind}:${c.ref.id}`, i + 1]));
  const sections: DocumentSection[] = draft.sections.map((s) => ({
    heading: s.heading,
    sentences: s.sentences.map((x) => ({
      text: x.text,
      cites: [...new Set(x.citations.map((r) => indexOf.get(`${r.kind}:${r.id}`)).filter((n): n is number => n !== undefined))],
    })),
  }));
  const numbered = citations
    .map((c, i) => {
      const info = recordInfo(env, c.ref);
      return `[${i + 1}] ${c.label} (${c.system})${info ? ` ${info.description}` : ''}`;
    })
    .join('\n');
  return { block: { type: 'document', sections, label: DRAFT_LABEL }, citations, numbered: `Citations:\n${numbered}` };
}

// --- Timeline milestones ---------------------------------------------------------

type TimelineMilestone = NonNullable<TimelineRow['milestones']>[number];

/** Days within which two milestones on one row would overlap their labels. */
const MILESTONE_GAP_DAYS = 10;
const TONE_RANK: Partial<Record<Tone, number>> = { red: 3, amber: 2, green: 1 };
/** Plot width of a full-width timeline (content width less the row-label column), inches. */
const TIMELINE_PLOT_W = 12.33 - 2.3;
/** About 11 pt Arial per character, plus the glyph and "REG" prefix the renderer adds. */
const LABEL_IN_PER_CHAR = 0.0825;
const LABEL_GAP_IN = 0.12;
/** Milestone labels longer than this are shortened on the slide (the notes keep them whole). */
const MILESTONE_LABEL_MAX = 30;

const labelWidth = (text: string, regulatory: boolean): number => (text.length + (regulatory ? 4 : 0) + 2) * LABEL_IN_PER_CHAR + 0.08;

/**
 * Milestones to label on one timeline row. Most important first (regulatory,
 * then the worse tone, then the earlier date), a milestone is kept only when no
 * kept one is within 10 days and its label finds room on one of the two label
 * lines the renderer gives the row (after the row's knock-on note). Kept labels are shortened to 30
 * characters; every milestone still goes to the notes.
 */
export function thinMilestones(row: TimelineRow, window: { start: string; end: string }, labelLines: number, plotW = TIMELINE_PLOT_W): TimelineMilestone[] {
  const span = Math.max(1, daysBetween(window.start, window.end));
  const xAt = (d: string) => (daysBetween(window.start, d) / span) * plotW;
  const lines: { x: number; end: number }[][] = Array.from({ length: Math.max(1, labelLines) }, () => []);
  const place = (anchor: number, w: number): boolean => {
    const x = Math.max(0, Math.min(anchor, plotW - w));
    for (const line of lines) {
      if (line.every((t) => x + w + LABEL_GAP_IN <= t.x || x >= t.end + LABEL_GAP_IN)) {
        line.push({ x, end: x + w });
        return true;
      }
    }
    return false;
  };
  // The renderer draws the knock-on note on the bar line when 1.6 in remain after the bar; otherwise it takes a label spot first.
  const noteX = xAt(row.projectedEnd ?? row.plannedEnd);
  if (row.note && plotW - noteX < 1.6) place(noteX, labelWidth(row.note, false));
  const ranked = (row.milestones ?? [])
    .map((m) => ({ ...m, label: shortenLabel(m.label) }))
    .sort((a, b) => Number(b.regulatory) - Number(a.regulatory) || (TONE_RANK[b.tone ?? 'neutral'] ?? 0) - (TONE_RANK[a.tone ?? 'neutral'] ?? 0) || a.date.localeCompare(b.date) || a.label.localeCompare(b.label));
  const kept: TimelineMilestone[] = [];
  for (const m of ranked) {
    if (kept.some((k) => Math.abs(daysBetween(k.date, m.date)) < MILESTONE_GAP_DAYS)) continue;
    if (place(xAt(m.date) - 0.1, labelWidth(m.label, m.regulatory))) kept.push(m);
  }
  return kept.sort((a, b) => a.date.localeCompare(b.date));
}

const shortenLabel = (t: string): string => (t.length <= MILESTONE_LABEL_MAX ? t : `${t.slice(0, MILESTONE_LABEL_MAX - 1).trimEnd()}…`);

/** Thins every row's milestones for the slide and lists all of them, with dates, for the notes. */
export function fitTimelineRows(rows: TimelineRow[], window: { start: string; end: string }, hasTop = true): { rows: TimelineRow[]; notes: string[] } {
  const perPage = Math.min(rows.length, hasTop ? TIMELINE_ROWS_WITH_TOP : TIMELINE_ROWS_ALONE);
  const labelLines = timelineLabelLines(perPage, hasTop);
  const lines: string[] = [];
  for (const r of rows) for (const m of r.milestones ?? []) lines.push(`- ${r.label}: ${date(m.date)} ${m.label}${m.regulatory ? ' (regulatory)' : ''}`);
  const fitted = rows.map((r) => (r.milestones && r.milestones.length > 0 ? { ...r, milestones: thinMilestones(r, window, labelLines) } : r));
  return { rows: fitted, notes: lines.length > 0 ? [`Milestones:\n${lines.join('\n')}`] : [] };
}
