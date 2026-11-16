import { it } from 'vitest';
import { createDemoStore } from '@/lib/store/store';
it('probe', () => {
  const s = createDemoStore().getState();
  const id = 'td-1001';
  const d = s.data.deliverables.find(x => x.id === id)!;
  console.log(JSON.stringify(d, null, 1));
  console.log(JSON.stringify(s.results.deliverables[id], null, 1).slice(0, 6000));
  console.log(JSON.stringify(s.results.deliverableRag[id], null, 1));
  console.log(JSON.stringify(s.results.findings.filter(f => f.deliverableId === id).map(f => [f.ruleId, f.severity, f.message, f.evidence.length])));
  console.log(s.data.outcomes.filter(o => o.deliverableId === id).map(o => [o.id, o.ref, o.title, o.weight, o.reportedStatus]));
  console.log(s.data.workItems.filter(w => w.deliverableId === id || w.epicKey && d.epicKeys.includes(w.epicKey)).length);
  console.log(s.data.deliverables.map(d => [d.id, d.ref, d.pmNodeId, s.results.deliverables[d.id].workCompletion.computable, s.results.deliverables[d.id].acceptedOutcomes.computable, d.epicKeys.length].join(' ')).join('\n'));
  console.log(JSON.stringify(s.data.pods.find(p => p.id === d.podId)));
});
