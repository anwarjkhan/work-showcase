/**
 * Outcome slides: summary (reported status beside acceptance), acceptance
 * criteria, the work carrying the outcome and its evidence.
 */
import { terms } from '@/lib/config/terminology';
import type { EntityRef } from '@/lib/types';
import { date, outcomeFacts, outcomeStatusTone, outcomeStatusWord, personName, plural, reportedOnTrack, type OutcomeFacts } from '../../extract';
import type { Cell } from '../../types';
import { at, bullets, col, makeSlide, table, toned, type BuildInput, type SlideBuilder } from '../kit';

function factsOf(input: BuildInput): OutcomeFacts {
  if (input.scope.kind !== 'outcome') throw new Error('This slide needs an outcome scope.');
  return outcomeFacts(input.env, input.scope.outcomeId);
}

const oRef = (f: OutcomeFacts): EntityRef => ({ kind: 'outcome', id: f.outcome.id });
const acceptanceCell = (accepted: boolean): Cell => toned(accepted ? 'Accepted' : 'Not accepted', accepted ? 'green' : 'red');

export const outcomeSummary: SlideBuilder = (input) => {
  const f = factsOf(input);
  const o = f.outcome;
  const a = f.measures.acceptance;
  const status = outcomeStatusWord(o.reportedStatus).toLowerCase();
  const title = a.accepted
    ? `${o.ref} is reported ${status} and accepted`
    : reportedOnTrack(o.reportedStatus)
      ? `${o.ref} is reported ${status} but not accepted`
      : `${o.ref} is reported ${status} and not accepted`;
  const reasons = a.accepted
    ? [`Accepted: ${a.mandatoryAccepted} of ${a.mandatoryCount} mandatory criteria accepted and a business acceptance record is held.`]
    : a.reasons.map((r) => r.message);
  return [
    makeSlide(input, {
      kind: 'outcome-summary',
      title,
      layout: 'kpis-over-table',
      blocks: [
        at('top', {
          type: 'kpis',
          items: [
            { label: terms.ragKinds.reported, value: outcomeStatusWord(o.reportedStatus), caption: terms.systems['portfolio-system'], tone: outcomeStatusTone(o.reportedStatus) },
            { label: 'Acceptance', value: a.accepted ? 'Accepted' : 'Not accepted', caption: `${a.mandatoryAccepted} of ${a.mandatoryCount} mandatory criteria`, tone: a.accepted ? 'green' : 'red' },
            { label: 'Weight', value: `${f.weight.own} of ${f.weight.total}`, caption: `Across ${f.deliverable?.ref ?? 'the deliverable'}` },
            { label: 'Due', value: date(o.dueDate), tone: !a.accepted && o.dueDate < input.env.asOf ? 'amber' : 'neutral' },
            { label: 'Acceptance owner', value: f.owner?.name ?? 'Not named' },
            { label: f.work.label, value: f.work.value, caption: f.work.caption },
          ],
        }),
        at('main', bullets(reasons.map((t) => ({ text: t, tone: a.accepted ? ('green' as const) : ('red' as const) })))),
      ],
      say: `${title}. Work completion of ${f.work.value} does not accept an outcome: only a named person accepting every mandatory criterion, with a business acceptance record, does.`,
      refs: [oRef(f), ...(f.deliverable ? [{ kind: 'deliverable' as const, id: f.deliverable.id }] : []), ...a.reasons.flatMap((r) => r.refs), ...f.businessAcceptance.map((e) => ({ kind: 'evidence' as const, id: e.id }))],
      provenance: ['computed', 'reported'],
    }),
  ];
};

export const outcomeCriteria: SlideBuilder = (input) => {
  const f = factsOf(input);
  const o = f.outcome;
  const a = f.measures.acceptance;
  const ba = f.businessAcceptance[0];
  const rows: Cell[][] = f.criteria.map((c) => [
    String(c.number),
    c.criterion.text,
    c.criterion.mandatory ? 'Yes' : 'No',
    toned(terms.criterionStates[c.criterion.state], c.criterion.state === 'accepted' ? 'green' : c.criterion.state === 'rejected' ? 'red' : 'neutral'),
    c.acceptedBy?.name ?? (c.rejectedBy ? `Rejected by ${c.rejectedBy.name}` : '—'),
    c.criterion.acceptedAt ? date(c.criterion.acceptedAt) : '—',
  ]);
  return [
    makeSlide(input, {
      kind: 'outcome-criteria',
      title: `${o.ref}: ${a.mandatoryAccepted} of ${a.mandatoryCount} mandatory criteria accepted${ba ? '' : ', no business acceptance'}`,
      layout: 'kpis-over-table',
      blocks: [
        at('top', {
          type: 'kpis',
          items: [
            { label: 'Mandatory accepted', value: `${a.mandatoryAccepted} of ${a.mandatoryCount}`, tone: a.mandatoryAccepted === a.mandatoryCount ? 'green' : 'red' },
            { label: terms.evidenceKinds['business-acceptance'], value: ba ? ba.sourceRef || 'Held' : 'None held', caption: ba ? `${terms.evidenceResults[ba.result]} · ${date(ba.observedAt)}` : undefined, tone: ba ? 'green' : 'red' },
            { label: 'Acceptance owner', value: f.owner?.name ?? 'Not named' },
            { label: 'Outcome', value: a.accepted ? 'Accepted' : 'Not accepted', tone: a.accepted ? 'green' : 'red' },
          ],
        }),
        at('main', table([col('#', 1, { align: 'right' }), col('Criterion', 9, { maxChars: 80 }), col('Mandatory', 2), col('State', 2), col('Accepted by', 3), col('When', 2)], rows, `No acceptance criteria are recorded for ${o.ref}.`)),
      ],
      say: `Only ${f.owner?.name ?? 'the named acceptance owner'} can accept these criteria. ${o.ref} counts as accepted once every mandatory criterion is accepted and a business acceptance record is held.`,
      refs: [oRef(f), ...f.criteria.map((c) => ({ kind: 'criterion' as const, id: c.criterion.id })), ...f.businessAcceptance.map((e) => ({ kind: 'evidence' as const, id: e.id }))],
      provenance: ['computed', 'reported'],
    }),
  ];
};

export const outcomeWork: SlideBuilder = (input) => {
  const f = factsOf(input);
  const { env } = input;
  const o = f.outcome;
  const assignee = (type: 'human' | 'agent', id: string | null) => (type === 'agent' ? (id ? env.idx.agentIdentities.get(id)?.handle ?? 'Agent' : 'Agent') : personName(env, id));
  const missing = new Set(f.missingReviewer.map((w) => w.key));
  const rows: Cell[][] = f.items.map((w) => [
    w.epicKey ?? '—',
    w.key,
    w.summary,
    toned(w.status, w.statusCategory === 'done' ? 'green' : w.statusCategory === 'in-progress' ? 'accent' : 'neutral'),
    assignee(w.assigneeType, w.assigneeId),
    missing.has(w.key) ? toned('Missing', 'red') : w.reviewerId ? personName(env, w.reviewerId) : '—',
    w.points === null ? '—' : String(w.points),
  ]);
  return [
    makeSlide(input, {
      kind: 'outcome-work',
      title: `${plural(f.items.length, 'item carries', 'items carry')} ${o.ref}: ${f.openItems.length} open, ${f.missingReviewer.length} missing a reviewer`,
      layout: 'kpis-over-table',
      blocks: [
        at('top', {
          type: 'kpis',
          items: [
            { label: f.work.label, value: f.work.value, caption: f.work.caption },
            { label: 'Open items', value: String(f.openItems.length) },
            { label: 'Agent items without reviewer', value: String(f.missingReviewer.length), tone: f.missingReviewer.length > 0 ? 'red' : 'green' },
          ],
        }),
        at('main', table([col(terms.hierarchy.epic, 2), col('Item', 2), col('Summary', 7, { maxChars: 56 }), col('Status', 2), col('Assignee', 3, { maxChars: 22 }), col('Reviewer', 3, { maxChars: 22 }), col('Points', 1, { align: 'right' })], rows, `No story-level item carries the ${terms.hierarchy.outcomeIdField} ${o.ref}.`)),
      ],
      say: `These are the story-level items whose ${terms.hierarchy.outcomeIdField} is ${o.ref}. Agent-assigned items need a named human reviewer.`,
      refs: [oRef(f), ...f.items.map((w) => ({ kind: 'work-item' as const, id: w.key }))],
      provenance: ['computed'],
    }),
  ];
};

export const outcomeEvidence: SlideBuilder = (input) => {
  const f = factsOf(input);
  const o = f.outcome;
  const stale = f.evidence.filter((e) => e.stale).length;
  const simulated = f.evidence.some((e) => e.evidence.provenance === 'simulated');
  const rows: Cell[][] = f.evidence.map((l) => [
    l.evidence.sourceRef || '—',
    terms.evidenceKinds[l.evidence.kind],
    l.evidence.title,
    toned(terms.evidenceResults[l.evidence.result], l.evidence.result === 'pass' ? 'green' : l.evidence.result === 'fail' ? 'red' : 'unknown'),
    date(l.evidence.observedAt),
    l.stale ? toned(`Stale: ${l.changedItemKey ?? 'work'} changed ${l.workChangedAt ? date(l.workChangedAt) : ''}`.trim(), 'amber') : 'Current',
    terms.systems[l.evidence.source],
  ]);
  return [
    makeSlide(input, {
      kind: 'outcome-evidence',
      title: f.evidence.length === 0 ? `No evidence is linked to ${o.ref}` : `${plural(f.evidence.length, 'evidence record')} for ${o.ref}; ${stale} stale`,
      layout: 'table',
      blocks: [at('main', table([col('Record', 2, { maxChars: 16 }), col('Kind', 3), col('Title', 5, { maxChars: 44 }), col('Result', 2), col('Observed', 2), col('Staleness', 4, { maxChars: 36 }), col('System', 2)], rows, `No evidence records name ${o.ref}.`))],
      say: `Evidence goes stale when the work it covers changes after it was observed. ${stale > 0 ? `${plural(stale, 'record')} here ${stale === 1 ? 'is' : 'are'} stale.` : 'None here is stale.'}`,
      refs: [oRef(f), ...f.evidence.map((e) => ({ kind: 'evidence' as const, id: e.evidence.id }))],
      provenance: simulated ? ['computed', 'simulated'] : ['computed'],
    }),
  ];
};
