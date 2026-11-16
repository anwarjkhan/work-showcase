import fs from 'node:fs';
import { it } from 'vitest';
import { DEMO_CLOCK } from '@/lib/config/clock';
import { computeAll } from '@/lib/engine';
import { forecastEnd } from '@/lib/engine/forecast';
import { createSyntheticPortfolio } from './synthetic';
it('d', () => {
  const d = createSyntheticPortfolio(); computeAll(d, DEMO_CLOCK);
  const rows = d.deliverables.map((x) => {
    const items = d.workItems.filter((w) => w.epicKey && x.epicKeys.includes(w.epicKey) && w.type !== 'sub-task');
    const f = forecastEnd(items, x.plannedEnd, DEMO_CLOCK, x.plannedStart);
    return `${x.id} ${x.pdlcStage.slice(0,5)} end=${x.plannedEnd} ${f.method} slip=${f.slipDays} rem=${f.remainingPoints} recent=${f.recentClosedPoints}`;
  });
  fs.writeFileSync('/tmp/claude-0/f.txt', rows.join('\n'));
});
