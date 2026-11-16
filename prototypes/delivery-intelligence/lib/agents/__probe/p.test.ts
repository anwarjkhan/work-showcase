import { test } from 'vitest';
import { createSyntheticPortfolio } from '@/lib/data/synthetic';
test('p', () => {
  const d = createSyntheticPortfolio();
  const depRaid = new Set(d.dependencies.map(x=>x.raidKey)); const depItem = new Set(d.dependencies.map(x=>x.workItemKey));
  console.log('RAIDdep', JSON.stringify(d.raid.filter(r=>r.kind==='dependency').map(r=>[r.key,r.deliverableId,r.title,depRaid.has(r.key)])));
  console.log('blocked', JSON.stringify(d.workItems.filter(w=>w.status==='Blocked').map(w=>[w.key,w.summary,depItem.has(w.key)])));
  const refs = d.deliverables.map(x=>x.ref);
  console.log('mentions', JSON.stringify(d.workItems.filter(w=>refs.some(r=>w.summary.includes(r))||/from|depend|upstream|feed/i.test(w.summary)).map(w=>[w.key,w.summary]).slice(0,40)));
  console.log('labels', JSON.stringify([...new Set(d.workItems.flatMap(w=>w.labels))]));
  console.log('deps', JSON.stringify(d.dependencies.slice(0,5)));
});
