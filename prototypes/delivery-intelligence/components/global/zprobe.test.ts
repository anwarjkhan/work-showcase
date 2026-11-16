import { it } from 'vitest';
import { createSyntheticPortfolio } from '@/lib/data/synthetic';
import { computeAll } from '@/lib/engine';
import { DEMO_CLOCK } from '@/lib/config/clock';
it('probe', () => {
  const d = createSyntheticPortfolio();
  const r = computeAll(d, DEMO_CLOCK);
  console.log(JSON.stringify({
    deps: d.dependencies.map((x) => [x.id, x.fromDeliverableId, x.toDeliverableId, x.fromHubId, x.toHubId, x.status, x.critical, x.needBy]),
    dels: d.deliverables.map((x) => [x.id, x.ref, x.hubIds, x.podId, r.deliverableRag[x.id]?.evidence, x.reportedRag, r.deliverableRag[x.id]?.disagrees]),
    pods: d.pods.map((p) => [p.id, p.hubId, p.memberIds.length, p.agentIdentityIds.length]),
    people: d.people.length, wi: d.workItems.length, wiHub: d.workItems.filter(w=>w.hubId).length,
  }));
});
