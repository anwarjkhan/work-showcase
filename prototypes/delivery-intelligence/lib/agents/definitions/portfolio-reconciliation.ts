/**
 * Portfolio reconciliation (read only). Compares the book of record with the
 * work tracker for every deliverable in scope:
 *   per Epic        Deliverable ID, start date, target date, owner
 *   per deliverable listed Epics exist; reported RAG against evidence-based RAG;
 *                   reported forecast end against the engine's forecast
 *   per outcome     reported status against recorded acceptance
 * and reports matches and mismatches. It changes nothing.
 */
import { AGENT_CATALOGUE } from '@/lib/agents/catalogue';
import { terms } from '@/lib/config/terminology';
import { deliverableForecasts } from '@/lib/engine';
import type { AgentRunOutput, DraftSentence, EntityRef } from '@/lib/types';
import { AgentKit, date, plural, quote, ref } from '../kit';
import type { ScriptedAgent, ScriptedAgentInput } from '../types';

const meta = AGENT_CATALOGUE['portfolio-reconciliation'];

export const portfolioReconciliationAgent: ScriptedAgent = {
  id: meta.id,
  name: meta.name,
  purpose: meta.purpose,
  stages: meta.stages,
  mode: meta.mode,
  output: meta.output,
  scopes: ['portfolio', 'deliverable'],
  acceptsProgramme: true,
  provenance: 'scripted-agent',
  run(input: ScriptedAgentInput): AgentRunOutput {
    const kit = new AgentKit(input);
    const ds = kit.deliverables;
    const PS = terms.systems['portfolio-system'];
    const WT = terms.systems['work-tracker'];
    if (ds.length === 0) {
      kit.step('blocked', 'No deliverable', `Nothing matches ${kit.scopeLabel}.`);
      return kit.output('No deliverable in scope.');
    }
    const ids = new Set(ds.map((d) => d.id));
    const epicKeys = ds.flatMap((d) => kit.epics(d.id));
    const outcomes = kit.data.outcomes.filter((o) => ids.has(o.deliverableId));
    kit.step('read', `Read ${plural(ds.length, 'deliverable')} and ${plural(outcomes.length, 'outcome')} from ${PS}`, 'Book-of-record fields: Epics listed, owner, planned dates, reported RAG, forecast, outcome status.', ds.slice(0, 25).map((d) => ref.deliverable(d.id)));
    kit.step('read', `Read ${plural(epicKeys.length, 'Epic')} from ${WT}`, `${terms.hierarchy.deliverableIdField}, start, target and owner on each.`, epicKeys.slice(0, 25).map(ref.item));

    const fields = epicKeys.length * 4 + ds.reduce((n, d) => n + d.epicKeys.length, 0) + ds.length * 2 + outcomes.length;
    kit.step('compute', `Compared ${plural(fields, 'field')} between ${PS} and ${WT}`, '4 per Epic, 1 per listed Epic, RAG and forecast per deliverable, status per outcome.', []);

    const mismatches: { text: string; refs: EntityRef[]; kind: string }[] = [];
    // Epic fields and missing Epics: the engine's R8 and R14 findings, re-stated.
    for (const f of kit.engineFindings((x) => x.ruleId === 'R8' || x.ruleId === 'R14')) {
      mismatches.push({ text: f.message, refs: [...f.evidence], kind: f.ruleId === 'R8' ? 'Epic fields' : terms.hierarchy.deliverableIdField });
      kit.finding(f.ruleId, f.severity, f.subject, f.deliverableId, f.message, f.evidence);
    }
    // Reported RAG against evidence.
    for (const d of ds) {
      const rag = kit.results.deliverableRag[d.id];
      if (rag?.disagrees) {
        mismatches.push({
          text: `${d.ref} is reported ${terms.rag[rag.reported]} in ${PS}; the records in ${WT} and the evidence register support ${terms.rag[rag.evidence]}.`,
          refs: [ref.deliverable(d.id), ...rag.reasons.flatMap((r) => r.refs)],
          kind: 'Reported status',
        });
      }
    }
    // Forecast end.
    const forecasts = deliverableForecasts(kit.ctx);
    for (const d of ds) {
      const f = forecasts.get(d.id);
      if (!f || !d.reportedForecastEnd || f.method === 'planned-fallback') continue;
      const gap = Math.round((Date.parse(f.forecastEnd) - Date.parse(d.reportedForecastEnd)) / 86_400_000);
      if (gap > 7) {
        mismatches.push({
          text: `${d.ref} reports a forecast end of ${date(d.reportedForecastEnd)} in ${PS}; throughput in ${WT} points to ${date(f.forecastEnd)}, ${gap} days later.`,
          refs: [ref.deliverable(d.id), ...kit.epics(d.id).map(ref.item)],
          kind: 'Forecast',
        });
      }
    }
    // Outcome status against acceptance (R11).
    for (const f of kit.engineFindings((x) => x.ruleId === 'R11')) {
      mismatches.push({ text: f.message, refs: [...f.evidence], kind: 'Outcome status' });
      kit.finding('R11', f.severity, f.subject, f.deliverableId, f.message, f.evidence);
    }
    kit.step('check', `Found ${plural(mismatches.length, 'mismatch', 'mismatches')}`, Object.entries(countBy(mismatches.map((m) => m.kind))).map(([k, n]) => `${k}: ${n}`).join('; ') || 'None.', mismatches.flatMap((m) => m.refs).slice(0, 25));

    const anchor = ref.deliverable(ds[0]!.id);
    kit.section('Summary', [
      kit.sentence(`Compared ${plural(fields, 'field')} for ${plural(ds.length, 'deliverable')}, ${plural(epicKeys.length, 'Epic')} and ${plural(outcomes.length, 'outcome')}; ${plural(mismatches.length, 'mismatch', 'mismatches')} found.`, ds.map((d) => ref.deliverable(d.id)), anchor),
      kit.sentence(`${PS} remains the book of record; this report changes nothing in either system.`, [anchor]),
    ]);
    const kinds = [...new Set(mismatches.map((m) => m.kind))];
    for (const k of kinds) {
      const list = mismatches.filter((m) => m.kind === k);
      const sentences: DraftSentence[] = list.slice(0, 8).map((m) => kit.sentence(m.text, m.refs, anchor));
      if (list.length > 8) sentences.push(kit.sentence(`${list.length - 8} more ${k.toLowerCase()} mismatches are listed in the findings.`, list.slice(8).flatMap((m) => m.refs).slice(0, 12), anchor));
      kit.section(k, sentences);
    }
    if (mismatches.length === 0) kit.section('Matches', [kit.sentence(`Every compared field agrees between ${PS} and ${WT}.`, ds.map((d) => ref.deliverable(d.id)))]);

    return kit.output(`${plural(mismatches.length, 'mismatch', 'mismatches')} across ${plural(fields, 'compared field')} in ${kit.scopeLabel}.`, {
      kind: 'reconciliation-report',
      deliverableId: ds.length === 1 ? ds[0]!.id : null,
      title: `Reconciliation: ${PS} against ${WT}, ${ds.length === 1 ? `${ds[0]!.ref} ${quote(ds[0]!.title)}` : kit.scopeLabel}`,
      agentId: 'portfolio-reconciliation',
      sections: kit.sections,
      provenance: 'scripted-agent',
    });
  },
};

function countBy(list: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of list) out[x] = (out[x] ?? 0) + 1;
  return out;
}
