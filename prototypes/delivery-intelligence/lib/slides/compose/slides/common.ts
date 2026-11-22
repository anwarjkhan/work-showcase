/**
 * Common slides for every scope: cover, contents, how to read the measures,
 * decisions and next steps, and the index of records cited (built last from
 * the other slides' citations).
 */
import { formatDate } from '@/lib/config/clock';
import { terms } from '@/lib/config/terminology';
import type { EntityRef, Finding, RuleId } from '@/lib/types';
import { catalogueEntry, PACKS } from '../../catalogue';
import { recordInfo, scopeName, scopePath, scopeRecord, scopeRef, type Citation, type SlideEnv } from '../../extract';
import type { SlideScope } from '../../types';
import { at, bullets, callout, col, makeSlide, table, text, type SlideBuilder } from '../kit';
import { DRAFT_LABEL } from './shared';

const pts = () => terms.systems['portfolio-system'];
const jira = () => terms.systems['work-tracker'];

export const cover: SlideBuilder = (input) => {
  const { env, scope } = input;
  const meta = env.extras.meta;
  const asOf = formatDate(env.asOf);
  const source = env.synthetic ? `${terms.app.demoNotice}.` : `${pts()} and ${jira()}, extracted ${formatDate(meta.generatedAt)}.`;
  const record = scopeRecord(scope);
  const name = scopeName(env, scope);
  // A name too long for a title moves into the body; the title keeps the ref.
  const title = name.length <= 70 ? name : scopeRef(env, scope);
  const blocks = [...(title !== name ? [at('main', text(name, 'statement'))] : []), at('main', text(scopePath(env, scope), 'body')), at('main', text(`As at ${asOf}`, 'body')), at('main', text(`Data source: ${source}`, 'caption'))];
  if (env.synthetic) blocks.push(at('main', callout('accent', 'Prototype · synthetic data. Figures are generated for demonstration and describe no real work.', 'Prototype')));
  return [
    makeSlide(input, {
      kind: 'cover',
      title,
      subtitle: input.pack?.title ?? terms.app.name,
      layout: 'cover',
      blocks,
      say: `This deck covers ${scopeName(env, scope)} as at ${asOf}. Every figure is computed from the same records the application shows.`,
      refs: record ? [record] : [],
      provenance: ['computed'],
    }),
  ];
};

/** Section titles of the scope's default pack, for a contents slide built outside a pack. */
function defaultSections(scope: SlideScope): string[] {
  const id = scope.kind === 'portfolio' ? 'portfolio' : scope.kind === 'deliverable' ? 'deliverable' : scope.kind === 'outcome' ? 'outcome' : 'programme';
  return PACKS[id].kinds.filter((k) => k !== 'cover' && k !== 'contents').map((k) => catalogueEntry(k).title);
}

export const contents: SlideBuilder = (input) => {
  const sections = input.pack?.sections ?? defaultSections(input.scope);
  const numbered = sections.map((s, i) => `${i + 1}. ${s}`);
  const half = Math.ceil(numbered.length / 2);
  const blocks =
    numbered.length <= 16
      ? [at('left', bullets(numbered.slice(0, half))), at('right', bullets(numbered.slice(half)))]
      : [at('left', bullets(numbered))];
  return [
    makeSlide(input, {
      kind: 'contents',
      title: 'Contents',
      layout: 'two-column',
      blocks,
      say: `${sections.length} sections follow, from the headline to the records cited.`,
      refs: [],
      provenance: ['computed'],
    }),
  ];
};

export const howToRead: SlideBuilder = (input) => {
  const m = terms.measures;
  return [
    makeSlide(input, {
      kind: 'how-to-read',
      title: 'How to read these measures: three answers, kept separate',
      layout: 'two-column',
      blocks: [
        at(
          'left',
          bullets([
            `${m.workCompletion}: story points closed out of points estimated, across the Epics in ${jira()}.`,
            `${m.acceptedOutcomes}: outcomes a named person has accepted, with a business acceptance record, counted and weighted.`,
            `${m.readiness}: ${terms.readiness.ready}, ${terms.readiness['not-ready']} or ${terms.readiness.unknown}, from the evidence the risk tier requires. Never a percentage.`,
            'The three move independently: closed work does not accept an outcome, and accepted outcomes do not make a deliverable ready.',
          ]),
        ),
        at(
          'right',
          bullets([
            `${terms.ragKinds.reported}: the status recorded in ${pts()}, the book of record. Never changed here.`,
            `${terms.ragKinds.evidence}: computed from findings and dates. ${terms.rag.red} for critical findings or missed dates, ${terms.rag.amber} for high findings or stale reports.`,
            `${m.notComputable}: there is not enough data to compute the measure, for example no estimated work. It is never shown as zero; the reason is given.`,
            `${DRAFT_LABEL}: text from a deterministic scripted agent, not a person or a language model. Each sentence cites its records.`,
          ]),
        ),
      ],
      say: 'Three measures answer three different questions, and reported status always sits beside the status the evidence supports.',
      refs: [],
      provenance: ['computed'],
    }),
  ];
};

// --- Decisions -------------------------------------------------------------------

function findingsFor(env: SlideEnv, scope: SlideScope): Finding[] {
  const all = env.result.findings;
  switch (scope.kind) {
    case 'portfolio':
      return all;
    case 'deliverable':
      return all.filter((f) => f.deliverableId === scope.deliverableId);
    case 'outcome':
      return all.filter((f) => (f.subject.kind === 'outcome' && f.subject.id === scope.outcomeId) || f.evidence.some((r) => r.kind === 'outcome' && r.id === scope.outcomeId));
    case 'pm-node': {
      const ids = new Set(env.rollups.pmNodes[scope.pmNodeId]?.deliverableIds ?? []);
      return all.filter((f) => f.deliverableId !== null && ids.has(f.deliverableId));
    }
  }
}

/** An action sentence for a finding, or null when the rule implies no clear action. */
function actionFor(env: SlideEnv, f: Finding): string | null {
  const subject = recordInfo(env, f.subject)?.label ?? 'the record';
  const deliverable = f.deliverableId ? env.idx.deliverables.get(f.deliverableId)?.ref ?? subject : subject;
  const actions: Partial<Record<RuleId, string>> = {
    R1: `Re-plan or add capacity for the milestone at risk on ${deliverable}`,
    R3: `Agree a new due date for ${subject}, or close it`,
    R4: `Ask the owner to update ${subject} with an owner, mitigation date and current status`,
    R5: `Agree recovery for the late critical dependency into ${deliverable}, or re-report its status`,
    R6: `Agree a committed date for ${subject} that meets the need-by date`,
    R7: `Merge or close the duplicate RAID item ${subject}`,
    R8: `Reconcile ${subject} between ${pts()} and ${jira()}`,
    R10: `Name a human reviewer for ${subject}`,
    R11: `Ask the acceptance owner to accept ${subject}, or re-report its status`,
    R12: `Refresh the stale evidence ${subject} for ${deliverable}`,
    R13: `Decide whether to fix and repeat ${subject} on ${deliverable} before release`,
    R14: `Set a valid ${terms.hierarchy.deliverableIdField} on ${subject}`,
  };
  return actions[f.ruleId] ?? null;
}

export const decisions: SlideBuilder = (input) => {
  const { env, scope } = input;
  const seen = new Set<string>();
  const prefilled: { text: string; refs: EntityRef[]; severity: Finding['severity'] }[] = [];
  for (const f of findingsFor(env, scope)) {
    if (f.severity !== 'critical' && f.severity !== 'high') continue;
    const action = actionFor(env, f);
    if (!action || seen.has(action)) continue;
    seen.add(action);
    prefilled.push({ text: action, refs: [f.subject, ...f.evidence], severity: f.severity });
    if (prefilled.length >= 5) break;
  }
  const items = [
    ...prefilled.map((p) => ({ text: `[Decision needed] ${p.text}. Owner: [name]. By: [date].`, tone: p.severity === 'critical' ? ('red' as const) : ('amber' as const) })),
    { text: '[Decision needed] [Describe the decision]. Owner: [name]. By: [date].' },
    { text: '[Next step] [Describe the action]. Owner: [name]. By: [date].' },
  ].slice(0, 8);
  const record = scopeRecord(scope);
  return [
    makeSlide(input, {
      kind: 'decisions',
      title: scope.kind === 'portfolio' ? 'Decisions and next steps for the portfolio' : `Decisions and next steps for ${scopeRef(env, scope)}`,
      layout: 'title-only',
      blocks: [at('main', bullets(items))],
      say:
        prefilled.length > 0
          ? `Edit these before the meeting. The first ${prefilled.length === 1 ? 'item comes' : `${prefilled.length} items come`} from the most severe findings that name an action; the rest are blank placeholders.`
          : 'No critical or high finding names an action, so these are blank placeholders to fill in before the meeting.',
      refs: [...(record ? [record] : []), ...prefilled.flatMap((p) => p.refs)],
      provenance: ['computed'],
    }),
  ];
};

// --- Record index ------------------------------------------------------------------

export const recordIndex: SlideBuilder = (input) => {
  const { env, scope } = input;
  const cited: Citation[] = [];
  const seen = new Set<string>();
  const record = scopeRecord(scope);
  const fromSlides = (input.pack?.slides ?? []).filter((s) => s.kind !== 'record-index').flatMap((s) => s.citations);
  const pool = fromSlides.length > 0 ? fromSlides : record ? [{ ref: record, label: '', system: '' }] : [];
  for (const c of pool) {
    const k = `${c.ref.kind}:${c.ref.id}`;
    if (seen.has(k)) continue;
    const info = recordInfo(env, c.ref);
    if (!info) continue;
    seen.add(k);
    cited.push({ ref: c.ref, label: info.label, system: info.system });
  }
  const systemRank = (s: string) => (s === pts() ? 0 : s === jira() ? 1 : 2);
  cited.sort((a, b) => systemRank(a.system) - systemRank(b.system) || a.system.localeCompare(b.system) || a.label.localeCompare(b.label, 'en', { numeric: true }));
  const rows = cited.map((c) => {
    const info = recordInfo(env, c.ref);
    return [c.label, info?.type ?? '', c.system, info?.description ?? ''];
  });
  return [
    makeSlide(input, {
      kind: 'record-index',
      title: `Records cited: ${cited.length}`,
      layout: 'table',
      blocks: [at('main', table([col('Record', 3, { maxChars: 30 }), col('Type', 3), col('System', 3), col('Title', 9, { maxChars: 70 })], rows, 'No records are cited.'))],
      say: `Every record cited in this deck, by key, with the system it lives in: ${pts()} above the book-of-record boundary, ${jira()} below it.`,
      refs: [],
      citations: cited,
      provenance: ['computed'],
    }),
  ];
};
