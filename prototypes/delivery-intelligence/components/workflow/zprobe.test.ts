import { it } from 'vitest';
import { createDemoStore } from '@/lib/store/store';
it('probe', () => {
  const s = createDemoStore().getState();
  const d = s.data;
  const td = d.deliverables.find((x) => x.id === 'td-2001')!;
  console.log(JSON.stringify({ td, run: d.pdlcRuns.find(r=>r.deliverableId==='td-2001'), outcomes: d.outcomes.filter(o=>o.deliverableId==='td-2001'), crit: d.criteria.filter(c=>c.outcomeId.startsWith('oc-2001')), ev: d.evidence.filter(e=>e.deliverableId==='td-2001'), items: d.workItems.filter(w=>td.epicKeys.includes(w.key)||td.epicKeys.includes(w.epicKey??'')).map(w=>[w.key,w.type,w.summary,w.points,w.statusCategory,w.outcomeId]), people: d.people.filter(p=>Object.values(td.reviewers).includes(p.id)||p.id==='p-presenter'), m: s.results.deliverables['td-2001'], ir: d.investmentRequests.find(i=>i.id===td.investmentRequestId), pod: d.pods.find(p=>p.id===td.podId)?.name }, null, 1));
  console.log(JSON.stringify(d.deliverables.map(x=>[x.id,x.ref,x.pdlcStage,x.riskTier, s.results.deliverables[x.id].readiness.state, x.title])));
  console.log(d.people.length, JSON.stringify(d.people.slice(0,6)));
});
