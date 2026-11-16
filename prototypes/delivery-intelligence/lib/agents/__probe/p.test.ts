import { test } from 'vitest';
import { createSyntheticPortfolio } from '@/lib/data/synthetic';
import { computeAll } from '@/lib/engine';
import { DEMO_CLOCK } from '@/lib/config/clock';
import { AGENT_LIST, runAgent } from '@/lib/agents';
test('p', () => {
  const data = createSyntheticPortfolio(); const results = computeAll(data, DEMO_CLOCK);
  const scopes: any[] = [{kind:'deliverable', deliverableId:'td-1001'},{kind:'portfolio'},{kind:'pdlc-stage',deliverableId:'td-2001',stageId:'ideation-requirements'},{kind:'programme',pmNodeId:'pm-ccr'}];
  for (const a of AGENT_LIST) for (const sc of scopes) {
    const r = runAgent(a.id, sc, {data, results, clock: DEMO_CLOCK});
    if (!r.ok) { console.log(`## ${a.id} ${sc.kind}: REFUSED ${r.reason}`); continue; }
    const o = r.output;
    console.log(`## ${a.id} ${sc.kind}: ${o.summary} | steps ${o.steps.length} findings ${o.findings.length} proposals ${o.proposals.length}`);
    if (process.env.FULL === a.id + ':' + sc.kind) {
      for (const s of o.steps) console.log(`  [${s.kind}] ${s.label} — ${s.detail}`);
      for (const p of o.proposals.slice(0,6)) console.log(`  P ${p.title} | ${p.rationale} | ${p.beforeText} -> ${p.afterText} [${p.riskTier}]`);
      for (const f of o.findings.slice(0,5)) console.log(`  F ${f.ruleId} ${f.message}`);
      if (o.draft) { console.log(`  DRAFT ${o.draft.title}`); for (const sec of o.draft.sections) { console.log(`   ### ${sec.heading}`); for (const s of sec.sentences) console.log(`    - ${s.text} [${s.citations.map(c=>c.id).join(',')}]`); } }
    }
  }
});
