'use client';

import { useMemo, useState } from 'react';
import { ProvenanceBadges } from '@/components/shell';
import { Card, Section } from '@/components/ui';
import { terms } from '@/lib/config/terminology';
import { usePortfolioData } from '@/lib/store';
import { ExplorerTree } from './ExplorerTree';
import { ModelDiagram } from './ModelDiagram';
import { buildTreeModel, type ExplorerView } from './model';

/** Hierarchy explorer: the model diagram on top, the real portfolio as an expandable tree below. */
export function HierarchyScreen() {
  const data = usePortfolioData();
  const model = useMemo(() => buildTreeModel(data), [data]);
  const [view, setView] = useState<ExplorerView>('all');
  const c = model.counts;
  const perEpic = c.deliverables > 0 ? (c.epics / c.deliverables).toFixed(1) : '0';

  return (
    <div className="flex flex-col gap-8">
      <Section
        title="How work moves through the hierarchy"
        description={`${c.requests} investment requests: ${c.formal} deliverables take the formal route, ${c.standalone} the standalone route. ${c.deliverables} deliverables map to ${c.epics} Epics (${perEpic} each), joined to ${c.stories + c.subTasks} work items by two fields.`}
      >
        <Card padding="sm" footer={<ProvenanceBadges kinds={['computed', 'sample']} size="sm" />}>
          <ModelDiagram model={model} view={view} onView={setView} />
        </Card>
      </Section>
      <Section
        title="Explore the portfolio"
        description={`Every level from ${terms.hierarchy.investmentRequest.toLowerCase()} down to story-level items. Rows above the boundary belong to the ${terms.systems['portfolio-system'].toLowerCase()} and are read-only here; rows below are ${terms.systems['work-tracker']}.`}
      >
        <ExplorerTree view={view} onViewChange={setView} />
      </Section>
    </div>
  );
}
