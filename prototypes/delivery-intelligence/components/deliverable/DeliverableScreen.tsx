'use client';

/**
 * Deliverable detail (D13), `/deliverables/[id]`.
 *
 * Supported URL hashes (used by the guided demo):
 *   #status      scrolls to and focuses the drafted weekly status section
 *   #evidence    opens the Evidence tab, scrolls to it and focuses the tab
 *   #outcomes, #work, #raid, #milestones, #pod   open that tab the same way
 *   #why         scrolls to "Why the evidence says ..."
 *
 * Everything is read from the store, so it follows approvals, workflow actions
 * and Reset demo as they happen.
 */
import { CalendarDays, FileCheck2, Network, SquareKanban, Target, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageMeta } from '@/components/shell';
import { EmptyState, SectionHeading, TabPanel, Tabs } from '@/components/ui';
import { terms } from '@/lib/config/terminology';
import { useClock, useEngineResult, usePortfolioData } from '@/lib/store';
import { EvidenceTab } from './EvidenceTab';
import { MilestonesTab } from './MilestonesTab';
import { OutcomesTab } from './OutcomesTab';
import { PodTab } from './PodTab';
import { RaidTab } from './RaidTab';
import { RecordsProvider } from './records';
import { StatusReport } from './StatusReport';
import { DeliverableSwitcher, VerdictHeader } from './VerdictHeader';
import { WhyEvidence } from './WhyEvidence';
import { WorkTab } from './WorkTab';
import { buildDeliverableModel } from './model';

const TAB_IDS = ['outcomes', 'work', 'evidence', 'raid', 'milestones', 'pod'] as const;
type TabId = (typeof TAB_IDS)[number];

export function DeliverableScreen({ id }: { id: string }) {
  const data = usePortfolioData();
  const result = useEngineResult();
  const clock = useClock();
  const model = useMemo(() => buildDeliverableModel(data, result, clock, id), [data, result, clock, id]);
  const [tab, setTab] = useState<TabId>('outcomes');
  const present = model !== null;

  const applyHash = useCallback(() => {
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    const go = (fn: () => void) => window.setTimeout(fn, 60);
    if ((TAB_IDS as readonly string[]).includes(hash)) {
      setTab(hash as TabId);
      go(() => {
        const wrap = document.getElementById('detail');
        wrap?.scrollIntoView({ block: 'start' });
        wrap?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus({ preventScroll: true });
      });
    } else if (hash === 'status' || hash === 'why') {
      go(() => {
        const el = document.getElementById(hash === 'status' ? 'status' : 'why-evidence-wrap');
        el?.scrollIntoView({ block: 'start' });
        el?.focus({ preventScroll: true });
      });
    }
  }, []);

  useEffect(() => {
    if (!present) return;
    const first = window.setTimeout(applyHash, 0);
    window.addEventListener('hashchange', applyHash);
    return () => {
      window.clearTimeout(first);
      window.removeEventListener('hashchange', applyHash);
    };
  }, [present, applyHash, id]);

  const d = model?.deliverable;
  if (!model || !d) {
    return <EmptyState title="Deliverable not found" description={`No deliverable has the id ${id} in the current data.`} />;
  }

  const tabs = [
    { id: 'outcomes', label: terms.hierarchy.outcome + 's', count: model.outcomes.length, icon: <Target /> },
    { id: 'work', label: 'Work', count: model.work.length, icon: <SquareKanban /> },
    { id: 'evidence', label: 'Evidence register', count: model.evidence.length, icon: <FileCheck2 /> },
    { id: 'raid', label: 'RAID and dependencies', count: model.raid.length + model.dependencies.length, icon: <Network /> },
    { id: 'milestones', label: 'Milestones', count: model.milestones.length, icon: <CalendarDays /> },
    { id: 'pod', label: 'Pod', count: model.members.length + model.agents.length, icon: <Users /> },
  ];

  return (
    <RecordsProvider deliverableId={id}>
      <PageMeta title={d.title} subtitle={`${d.ref} · ${terms.hierarchy.deliverable}`} provenance={['computed', 'reported', 'sample']} />
      <div className="flex min-w-0 flex-col gap-6" data-testid="deliverable-screen" data-deliverable={id}>
        <h2 className="sr-only">Verdict for {d.ref}</h2>
        <DeliverableSwitcher model={model} />
        <VerdictHeader model={model} />
        <div id="why-evidence-wrap" tabIndex={-1} className="scroll-mt-20 outline-none">
          <WhyEvidence model={model} />
        </div>

        <section id="detail" aria-labelledby="detail-heading" className="flex min-w-0 scroll-mt-20 flex-col gap-4">
          <SectionHeading id="detail-heading" title="The records behind the verdict" description="Outcomes, work, evidence, risks, dependencies, milestones and the pod. Click any row for the full record." />
          <Tabs ariaLabel="Deliverable sections" items={tabs} value={tab} onChange={(v) => setTab(v as TabId)}>
            <TabPanel id="outcomes">
              <OutcomesTab model={model} />
            </TabPanel>
            <TabPanel id="work">
              <WorkTab model={model} />
            </TabPanel>
            <TabPanel id="evidence">
              <EvidenceTab model={model} />
            </TabPanel>
            <TabPanel id="raid">
              <RaidTab model={model} />
            </TabPanel>
            <TabPanel id="milestones">
              <MilestonesTab model={model} />
            </TabPanel>
            <TabPanel id="pod">
              <PodTab model={model} />
            </TabPanel>
          </Tabs>
        </section>

        <StatusReport deliverableId={id} />
      </div>
    </RecordsProvider>
  );
}

