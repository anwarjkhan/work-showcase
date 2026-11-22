/**
 * Building blocks shared by slide builders: the status pair and measures
 * blocks, status cells, finding references, severity tones and the scripted
 * agent draft as a document block with numbered citations.
 */
import { terms } from '@/lib/config/terminology';
import type { EntityRef, EvidenceRag, EvidenceRagStatus, RagStatus, Severity, StatusDraft } from '@/lib/types';
import { citationsFor, ragWord, recordInfo, type Citation, type SlideEnv } from '../../extract';
import type { Block, Cell, DocumentSection, MeasureView, ReadinessView, Tone } from '../../types';
import { toned } from '../kit';

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

export const ragPairOf = (rag: EvidenceRag, reason?: string): Block => ragPair(rag.reported, rag.evidence, reason ?? rag.reasons[0]?.message);

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
