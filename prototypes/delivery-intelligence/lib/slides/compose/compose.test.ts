/**
 * Slide builders and packs (docs/SLIDES_PLAN.md section 10, "Unit: compose").
 * Every kind builds for every scope it accepts, across every deliverable,
 * outcome, PM node and the portfolio, and every spec satisfies the contract.
 */
import { describe, expect, it } from 'vitest';
import { CATALOGUE_LIST, PACKS } from '../catalogue';
import { scopeKey } from '../extract';
import type { PackId, PackOptions, SlideScope, SlideSpec } from '../types';
import { buildDeck, buildPack, buildPackDeck, buildSlides, defaultPackFor, availableKinds } from './packs';
import { specProblems, syntheticContext } from './test-helpers';

const ctx = syntheticContext();
const ctxDrafts = syntheticContext(true);
const { data } = ctx;

const scopesOf = (kind: SlideScope['kind']): SlideScope[] => {
  switch (kind) {
    case 'portfolio':
      return [{ kind: 'portfolio' }];
    case 'pm-node':
      return data.pmNodes.map((n) => ({ kind: 'pm-node', pmNodeId: n.id }));
    case 'deliverable':
      return data.deliverables.map((d) => ({ kind: 'deliverable', deliverableId: d.id }));
    case 'outcome':
      return data.outcomes.map((o) => ({ kind: 'outcome', outcomeId: o.id }));
  }
};

describe('every slide kind for every accepted scope', () => {
  for (const entry of CATALOGUE_LIST) {
    it(`${entry.kind} builds valid specs`, () => {
      const problems: string[] = [];
      for (const scopeKind of entry.scopes) {
        for (const scope of scopesOf(scopeKind)) {
          for (const c of [ctx, ctxDrafts]) {
            const specs = buildSlides(scope, [entry.kind], c);
            expect(specs.length).toBeGreaterThan(0);
            for (const s of specs) {
              expect(s.kind).toBe(entry.kind);
              expect(s.id.startsWith(`${entry.kind}:${scopeKey(scope)}`)).toBe(true);
              expect(s.asOf).toBe('2027-03-08');
              problems.push(...specProblems(s, data));
            }
          }
        }
      }
      expect(problems).toEqual([]);
    });
  }

  it('refuses a kind the scope does not accept', () => {
    expect(() => buildSlides({ kind: 'portfolio' }, ['td-verdict'], ctx)).toThrow(/does not accept/);
    expect(() => buildSlides({ kind: 'deliverable', deliverableId: 'nope' }, ['td-verdict'], ctx)).toThrow(/No deliverable/);
  });

  it('availableKinds lists the catalogue kinds for a scope', () => {
    expect(availableKinds({ kind: 'outcome', outcomeId: 'oc-1001-2' })).toEqual(['cover', 'contents', 'how-to-read', 'decisions', 'record-index', 'outcome-summary', 'outcome-criteria', 'outcome-work', 'outcome-evidence']);
  });
});

describe('statement titles and wording rules', () => {
  const one = (scope: SlideScope, kind: Parameters<typeof buildSlides>[1][number], c = ctx) => buildSlides(scope, [kind], c)[0] as SlideSpec;
  const td = { kind: 'deliverable', deliverableId: 'td-1001' } as const;

  it('the verdict is a statement with both statuses and the three measures', () => {
    const s = one(td, 'td-verdict');
    expect(s.title).toBe('TD-1001 is reported Green; the evidence says Red');
    const pair = s.blocks.find((b) => b.block.type === 'rag-pair')?.block;
    expect(pair).toMatchObject({ reported: 'green', evidence: 'red', disagree: true, reportedText: 'Reported: Green', evidenceText: 'Evidence-based: Red' });
    const m = s.blocks.find((b) => b.block.type === 'measures')?.block;
    expect(m).toMatchObject({ work: { value: '82%' }, accepted: { value: '1 of 4' }, readiness: { stateText: 'Not ready' } });
    expect(s.provenance).toEqual(['computed', 'reported', 'sample']);
  });

  it('notes read "<say>\\n\\nRecords: KEY, KEY…"', () => {
    const s = one(td, 'td-verdict');
    expect(s.notes).toMatch(/^TD-1001 is reported Green; the evidence says Red\..*\n\nRecords: TD-1001, /s);
    expect(s.citations[0]).toEqual({ ref: { kind: 'deliverable', id: 'td-1001' }, label: 'TD-1001', system: 'Portfolio system' });
    expect(s.citations.some((c) => c.system === 'Jira')).toBe(true);
  });

  it('the verdict keeps three reasons on the slide and the rest in notes', () => {
    const s = one(td, 'td-verdict');
    const list = s.blocks.find((b) => b.block.type === 'bullets')?.block;
    expect(list?.type === 'bullets' ? list.items.length : 0).toBe(3);
    expect(s.notes).toContain('Further reasons:\n- 2 high findings (R11');
  });

  it('the plan labels one milestone per 10 days on a row, lists all in notes and fills Epic bars', () => {
    const s = one(td, 'td-plan');
    const tl = s.blocks.find((b) => b.block.type === 'timeline')?.block;
    if (tl?.type !== 'timeline') throw new Error('no timeline');
    const row = tl.rows[0];
    expect(row?.milestones?.map((m) => m.label)).toEqual(['Needs input from TD-1016', 'Quarter-end stress run']);
    expect(s.notes).toContain('- TD-1001: 26 Mar 2027 Needs input from TD-1003');
    expect(s.notes).toContain('- TD-1001: 31 Mar 2027 Reconciliation sign-off to the risk committee');
    expect(s.notes).toContain('- TD-1001: 19 Mar 2027 Quarter-end stress run (regulatory)');
    expect(tl.rows.slice(1).every((r) => typeof r.completion === 'number')).toBe(true);
  });

  it('table columns are wide enough for short headers and values', () => {
    const s = one(td, 'td-raid');
    const left = s.blocks.find((b) => b.region === 'left')?.block;
    if (left?.type !== 'table') throw new Error('no table');
    const w = Object.fromEntries(left.columns.map((c) => [c.header, c.width]));
    expect(w.Kind).toBeGreaterThanOrEqual('Assumption'.length * 0.095);
    expect(w.Severity).toBeGreaterThanOrEqual('Severity'.length * 0.11);
    expect(w.Age).toBeGreaterThanOrEqual(3 * 0.11);
  });

  it('OC-1001-2 summary says reported on track but not accepted', () => {
    expect(one({ kind: 'outcome', outcomeId: 'oc-1001-2' }, 'outcome-summary').title).toBe('OC-1001-2 is reported on track but not accepted');
  });

  it('without a draft, td-status and portfolio-brief say how to generate one and invent nothing', () => {
    for (const s of [one(td, 'td-status'), one({ kind: 'portfolio' }, 'portfolio-brief')]) {
      expect(s.layout).toBe('statement');
      expect(s.blocks.some((b) => b.block.type === 'document')).toBe(false);
      const callout = s.blocks[0]?.block;
      expect(callout?.type).toBe('callout');
      expect(callout && 'text' in callout ? callout.text : '').toMatch(/has been generated .*yet\. In the app, .*run the/);
      expect(s.provenance).not.toContain('scripted-agent');
    }
  });

  it('with a draft, the narrative is a labelled scripted document with numbered citations', () => {
    for (const s of [one(td, 'td-status', ctxDrafts), one({ kind: 'portfolio' }, 'portfolio-brief', ctxDrafts)]) {
      const doc = s.blocks[0]?.block;
      expect(doc?.type).toBe('document');
      if (doc?.type !== 'document') continue;
      expect(doc.label).toBe('Scripted agent draft');
      expect(s.provenance).toContain('scripted-agent');
      const cites = doc.sections.flatMap((x) => x.sentences.flatMap((y) => y.cites));
      expect(cites.length).toBeGreaterThan(0);
      for (const n of cites) expect(n >= 1 && n <= s.citations.length).toBe(true);
      expect(s.notes).toContain('Citations:\n[1] ');
    }
  });

  it('a measure that cannot be computed says so in words with its reason', () => {
    const problems: string[] = [];
    for (const d of data.deliverables) {
      const m = one({ kind: 'deliverable', deliverableId: d.id }, 'td-verdict').blocks.find((b) => b.block.type === 'measures')?.block;
      if (m?.type !== 'measures') continue;
      for (const v of [m.work, m.accepted]) if (!v.computable && (v.value !== 'Not computable' || v.caption.length < 5)) problems.push(d.ref);
    }
    expect(problems).toEqual([]);
  });

  it('decisions are prefilled from the most severe findings that imply an action', () => {
    const s = one(td, 'decisions');
    const items = s.blocks[0]?.block.type === 'bullets' ? s.blocks[0].block.items.map((i) => i.text) : [];
    expect(items[0]).toMatch(/^\[Decision needed\] Agree recovery for the late critical dependency into TD-1001/);
    expect(items.at(-1)).toMatch(/^\[Next step\]/);
    expect(items.length).toBeLessThanOrEqual(8);
  });
});

describe('packs', () => {
  const scopes: Record<PackId, SlideScope[]> = {
    outcome: [{ kind: 'outcome', outcomeId: 'oc-1001-2' }],
    deliverable: [{ kind: 'deliverable', deliverableId: 'td-1001' }, { kind: 'deliverable', deliverableId: 'td-2001' }],
    project: [{ kind: 'pm-node', pmNodeId: 'pm-ccr-exposure' }],
    programme: [{ kind: 'pm-node', pmNodeId: 'pm-ccr' }, { kind: 'pm-node', pmNodeId: 'pm-ledger-init' }],
    portfolio: [{ kind: 'portfolio' }],
  };
  const optionSets: PackOptions[] = [
    {},
    { includeAgentNarrative: false },
    { includeAgentNarrative: true },
    { includeOutcomeSummaries: true },
    { appendVerdicts: 'none' },
    { appendVerdicts: 'disagreeing' },
    { appendVerdicts: 'all' },
    { topN: 3 },
  ];

  for (const [packId, list] of Object.entries(scopes) as [PackId, SlideScope[]][]) {
    it(`${packId} pack builds with every option`, () => {
      for (const scope of list) {
        for (const options of optionSets) {
          for (const c of [ctx, ctxDrafts]) {
            const slides = buildPack(packId, scope, options, c);
            const problems = slides.flatMap((s) => specProblems(s, data));
            expect(problems).toEqual([]);
            expect(new Set(slides.map((s) => s.id)).size).toBe(slides.length);
            // Pack order follows the definition (continuations and appended slides aside).
            const kinds = slides.filter((s) => !s.page || s.page.index === 1).map((s) => s.kind);
            const defined = PACKS[packId].kinds.filter((k) => kinds.includes(k));
            expect(kinds.filter((k) => PACKS[packId].kinds.includes(k) && k !== 'td-verdict')).toEqual(defined.filter((k) => k !== 'td-verdict'));
            expect(slides[0]?.kind).toBe('cover');
            expect(slides.at(-1)?.kind).toBe('record-index');
            if (options.topN) for (const s of slides) if (s.kind !== 'record-index') for (const b of s.blocks) if (b.block.type === 'table') expect(b.block.rows.length).toBeLessThanOrEqual(options.topN);
          }
        }
      }
    });
  }

  it('applies the deliverable options', () => {
    const td = { kind: 'deliverable', deliverableId: 'td-1001' } as const;
    const base = buildPack('deliverable', td, {}, ctx).map((s) => s.kind);
    expect(base).toContain('td-status');
    expect(buildPack('deliverable', td, { includeAgentNarrative: false }, ctx).map((s) => s.kind)).not.toContain('td-status');
    const withSummaries = buildPack('deliverable', td, { includeOutcomeSummaries: true }, ctx);
    const summaries = withSummaries.filter((s) => s.kind === 'outcome-summary');
    expect(summaries.map((s) => s.scope)).toEqual(['oc-1001-1', 'oc-1001-2', 'oc-1001-3', 'oc-1001-4'].map((outcomeId) => ({ kind: 'outcome', outcomeId })));
    expect(withSummaries.findIndex((s) => s.kind === 'outcome-summary')).toBe(withSummaries.findIndex((s) => s.kind === 'td-outcomes') + 1);
  });

  it('applies appended verdicts for project and programme packs', () => {
    const pg = { kind: 'pm-node', pmNodeId: 'pm-ccr' } as const;
    const count = (o: PackOptions) => buildPack('programme', pg, o, ctx).filter((s) => s.kind === 'td-verdict').length;
    expect(count({})).toBe(0);
    expect(count({ appendVerdicts: 'disagreeing' })).toBe(ctx.result.portfolio.disagreementDeliverableIds.filter((id) => ['td-1001', 'td-1002', 'td-1003', 'td-1004', 'td-1005', 'td-1006'].includes(id)).length);
    expect(count({ appendVerdicts: 'all' })).toBe(6);
    const slides = buildPack('programme', pg, { appendVerdicts: 'all' }, ctx);
    expect(slides[slides.findIndex((s) => s.kind === 'decisions') - 1]?.kind).toBe('td-verdict');
  });

  it('matches PM node levels: projects take the project pack, programmes and initiatives the programme pack', () => {
    expect(() => buildPack('project', { kind: 'pm-node', pmNodeId: 'pm-ccr' }, {}, ctx)).toThrow(/does not accept/);
    expect(() => buildPack('programme', { kind: 'pm-node', pmNodeId: 'pm-ccr-exposure' }, {}, ctx)).toThrow(/does not accept/);
    expect(defaultPackFor({ kind: 'pm-node', pmNodeId: 'pm-ccr-exposure' }, ctx)).toBe('project');
    expect(defaultPackFor({ kind: 'pm-node', pmNodeId: 'pm-ledger-init' }, ctx)).toBe('programme');
    expect(defaultPackFor({ kind: 'portfolio' }, ctx)).toBe('portfolio');
  });

  it('the programme overview carries a projects table', () => {
    const s = buildPack('programme', { kind: 'pm-node', pmNodeId: 'pm-ccr' }, {}, ctx).find((x) => x.kind === 'node-overview');
    const t = s?.blocks.find((b) => b.block.type === 'table')?.block;
    expect(t?.type === 'table' ? t.columns[0]?.header : '').toBe('Project');
  });

  it('contents lists the pack sections and the record index covers every citation', () => {
    const slides = buildPack('deliverable', { kind: 'deliverable', deliverableId: 'td-1001' }, {}, ctx);
    const contents = slides.find((s) => s.kind === 'contents');
    const items = contents?.blocks.flatMap((b) => (b.block.type === 'bullets' ? b.block.items.map((i) => i.text) : [])) ?? [];
    expect(items[0]).toBe('1. Verdict');
    expect(items.at(-1)).toBe('13. Records cited');
    const key = (r: { kind: string; id: string }) => `${r.kind}:${r.id}`;
    const indexed = new Set(slides.filter((s) => s.kind === 'record-index').flatMap((s) => s.citations.map((c) => key(c.ref))));
    const cited = new Set(slides.filter((s) => s.kind !== 'record-index').flatMap((s) => s.citations.map((c) => key(c.ref))));
    expect([...cited].filter((k) => !indexed.has(k))).toEqual([]);
    const rows = slides.filter((s) => s.kind === 'record-index').reduce((n, s) => n + (s.blocks[0]?.block.type === 'table' ? s.blocks[0].block.rows.length : 0), 0);
    expect(rows).toBe(cited.size);
  });

  it('decks carry the file name and footer of section 9', () => {
    const deck = buildPackDeck('deliverable', { kind: 'deliverable', deliverableId: 'td-1001' }, {}, ctx);
    expect(deck.fileName).toBe('TD-1001-deliverable-pack-2027-03-08.pptx');
    expect(deck.footer.text).toBe('Prototype · synthetic data · as at 8 Mar 2027');
    expect(deck.title).toBe('TD-1001 Counterparty exposure — stress scenario reconciliation · Technology Deliverable pack');
    expect(buildPackDeck('programme', { kind: 'pm-node', pmNodeId: 'pm-ccr' }, {}, ctx).fileName).toBe('PG-CCR-programme-pack-2027-03-08.pptx');
    expect(buildPackDeck('portfolio', { kind: 'portfolio' }, {}, ctx).fileName).toBe('Portfolio-portfolio-pack-2027-03-08.pptx');
    const real = { ...ctx, data: { ...ctx.data, meta: { ...ctx.data.meta, sourceKind: 'jira' as const } } };
    const basket = buildDeck(buildSlides({ kind: 'outcome', outcomeId: 'oc-1001-2' }, ['outcome-summary'], ctx), real);
    expect(basket.footer.text).toBe('Source: Portfolio system and Jira · extracted 8 Mar 2027');
    expect(basket.fileName).toBe('OC-1001-2-slides-2027-03-08.pptx');
  });

  it('marks non-synthetic data without the sample provenance', () => {
    const real = { ...ctx, data: { ...ctx.data, meta: { ...ctx.data.meta, sourceKind: 'jira' as const } } };
    const s = buildSlides({ kind: 'deliverable', deliverableId: 'td-1001' }, ['td-verdict'], real)[0];
    expect(s?.provenance).toEqual(['computed', 'reported']);
  });
});
