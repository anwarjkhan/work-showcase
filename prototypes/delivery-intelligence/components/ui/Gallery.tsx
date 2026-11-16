'use client';

import { Bot, Download, Play, Plus, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { BarChart, Donut, DualBar, Legend, ragSegments, Sparkline, StackedBar, chartColor } from '../charts';
import type { AcceptedOutcomes, Computable, ReadinessAssessment, WorkCompletion } from '@/lib/types';
import { Avatar, AvatarLabel, AvatarStack } from './Avatar';
import { Badge, Chip } from './Badge';
import { Button, IconButton } from './Button';
import { Card, Section } from './Card';
import { DataTable, type Column } from './DataTable';
import { Disclosure, Tree, TreeRow } from './Disclosure';
import { Drawer } from './Drawer';
import { EmptyState } from './EmptyState';
import { KeyValue } from './KeyValue';
import { MeasureTriple } from './MeasureTriple';
import { ProgressBar } from './ProgressBar';
import { Skeleton, SkeletonText } from './Skeleton';
import { StatTile } from './StatTile';
import { RagPair, RagPill, ReadinessPill, SeverityBadge } from './StatusPills';
import { TabPanel, Tabs } from './Tabs';
import { Timeline } from './Timeline';
import { Tooltip } from './Tooltip';

/**
 * Private visual check for the primitives: every component in every state, both themes.
 * Not routed. To look at it, temporarily render `<Gallery />` from any client page you own,
 * then remove it again.
 */

const WORK: Computable<WorkCompletion> = {
  computable: true,
  value: { closedPoints: 82, totalPoints: 100, ratio: 0.82, percent: 82, itemCount: 40, closedItemCount: 30, unestimatedItemCount: 0, epicKeys: ['CCR-101'] },
};
const ACCEPTED: Computable<AcceptedOutcomes> = {
  computable: true,
  value: { acceptedCount: 1, totalCount: 4, acceptedWeight: 25, totalWeight: 100, ratio: 0.25, percent: 25, outcomes: [] },
};
const NOT_COMPUTABLE: Computable<AcceptedOutcomes> = { computable: false, reason: 'no-outcomes', detail: 'No outcomes are defined for this deliverable yet.' };
const READINESS: ReadinessAssessment = {
  deliverableId: 'D-1',
  state: 'not-ready',
  riskTier: 'T2',
  requiredEvidence: ['requirements-sign-off', 'design-review', 'control-assessment', 'test-result', 'business-acceptance'],
  held: [
    { kind: 'requirements-sign-off', state: 'passing', evidenceId: 'e1', observedAt: null, workChangedAt: null },
    { kind: 'design-review', state: 'passing', evidenceId: 'e2', observedAt: null, workChangedAt: null },
    { kind: 'test-result', state: 'failing', evidenceId: 'e3', observedAt: null, workChangedAt: null },
  ],
  missing: ['control-assessment', 'business-acceptance'],
  failing: ['test-result'],
  stale: [],
  blockingDependencyIds: [],
  reasons: [],
};

interface Row {
  id: string;
  title: string;
  rag: 'red' | 'amber' | 'green';
  evidence: 'red' | 'amber' | 'green' | 'unknown';
  pct: number;
  owner: string;
}
const ROWS: Row[] = [
  { id: 'a', title: 'Counterparty exposure: stress scenario reconciliation', rag: 'green', evidence: 'red', pct: 82, owner: 'Ana Byrne' },
  { id: 'b', title: 'Limit-monitoring dashboard filters', rag: 'amber', evidence: 'amber', pct: 34, owner: 'Kofi Mensah' },
  { id: 'c', title: 'Price risk control attestation', rag: 'green', evidence: 'green', pct: 96, owner: 'Lin Zhao' },
  { id: 'd', title: 'Shared data platform onboarding', rag: 'red', evidence: 'unknown', pct: 12, owner: 'Sam Ortiz' },
];
const COLUMNS: Column<Row>[] = [
  { id: 'title', header: 'Deliverable', accessor: (r) => r.title, minWidth: 280 },
  { id: 'rag', header: 'Reported / evidence', cell: (r) => <RagPair reported={r.rag} evidence={r.evidence} />, accessor: (r) => r.rag, minWidth: 300 },
  { id: 'pct', header: 'Work', accessor: (r) => r.pct, numeric: true, cell: (r) => `${r.pct}%` },
  { id: 'owner', header: 'Owner', accessor: (r) => r.owner, minWidth: 140 },
];

function Row({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="di-eyebrow">{title}</div>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

export function Gallery() {
  const [tab, setTab] = useState('overview');
  const [open, setOpen] = useState(false);
  const [chip, setChip] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ r: true });
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-8">
      <Section title="Status" eyebrow="Gallery" description="Status is always text plus a distinct shape, then colour.">
        <Card>
          <div className="flex flex-col gap-5">
            <Row title="RAG">
              <RagPill status="red" />
              <RagPill status="amber" />
              <RagPill status="green" />
              <RagPill status="unknown" />
              <RagPill status="green" size="sm" />
            </Row>
            <Row title="Reported beside evidence-based">
              <RagPair reported="green" evidence="red" />
              <RagPair reported="green" evidence="green" />
              <RagPair reported="amber" evidence="unknown" />
              <div className="w-72"><RagPair layout="stacked" reported="green" evidence="amber" /></div>
            </Row>
            <Row title="Readiness and severity">
              <ReadinessPill state="ready" />
              <ReadinessPill state="not-ready" />
              <ReadinessPill state="unknown" />
              <SeverityBadge severity="critical" />
              <SeverityBadge severity="high" />
              <SeverityBadge severity="medium" />
              <SeverityBadge severity="low" />
            </Row>
            <Row title="Badges and chips">
              <Badge>Neutral</Badge>
              <Badge tone="accent" icon={<Bot />}>Accent</Badge>
              <Badge tone="amber" dashed>Placeholder</Badge>
              <Chip selected={chip} onClick={() => setChip(!chip)}>Filter</Chip>
              <Chip onRemove={() => {}}>Removable</Chip>
            </Row>
          </div>
        </Card>
      </Section>

      <Section title="Measures and tiles">
        <MeasureTriple workCompletion={WORK} acceptedOutcomes={ACCEPTED} readiness={READINESS} plannedPercent={90} />
        <MeasureTriple compact workCompletion={{ computable: false, reason: 'no-linked-work', detail: 'No linked work yet.' }} acceptedOutcomes={NOT_COMPUTABLE} readiness={{ ...READINESS, state: 'unknown', failing: [], missing: ['test-result'] }} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Deliverables" value={26} delta={{ value: '+2', direction: 'up', sentiment: 'neutral', context: 'this quarter' }} spark={[18, 20, 19, 22, 24, 26]} provenance="computed" />
          <StatTile label="Status disagreements" value={4} caption="reported Green, evidence says otherwise" delta={{ value: '+1', direction: 'up', sentiment: 'bad' }} provenance="computed" />
          <StatTile label="Draft acceptance" value="68" unit="%" caption="Placeholder until measured" provenance="planned" />
          <StatTile label="Open critical findings" value={9} delta={{ value: '−3', direction: 'down', sentiment: 'good', context: 'vs last week' }} spark={[14, 13, 12, 12, 11, 9]} onClick={() => {}} />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card title="Progress" description="Marker shows plan today"><div className="flex flex-col gap-4">
            <ProgressBar value={82} target={90} targetLabel="Planned" ariaLabel="Work" />
            <ProgressBar value={40} tone="amber" size="sm" ariaLabel="Amber" />
            <ProgressBar value={null} ariaLabel="Not computable" />
          </div></Card>
          <Card title="Key values"><KeyValue layout="inline" items={[{ label: 'Risk tier', value: 'T2 Moderate' }, { label: 'Epic', value: 'CCR-101', mono: true }, { label: 'Owner', value: 'Ana Byrne', hint: 'Delivery lead' }]} /></Card>
          <Card title="Identities"><div className="flex flex-col gap-3">
            <AvatarLabel initials="AB" name="Ana Byrne" detail="Delivery lead" />
            <AvatarLabel kind="agent" name="agent-reqs-01" detail="Requirements structuring" />
            <AvatarStack items={[{ initials: 'AB', name: 'Ana Byrne' }, { kind: 'agent', name: 'agent-reqs-01' }, { initials: 'KM', name: 'Kofi Mensah' }, { initials: 'LZ', name: 'Lin Zhao' }]} max={3} />
            <div className="flex gap-2"><Avatar initials="SO" name="Sam Ortiz" size="lg" /><Avatar kind="agent" name="agent-raid-02" size="lg" /></div>
          </div></Card>
        </div>
      </Section>

      <Section title="Charts">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="Stacked bar" description="Reported RAG across 26 deliverables">
            <StackedBar segments={ragSegments({ red: 3, amber: 7, green: 15, unknown: 1 })} />
          </Card>
          <Card title="Donut"><Donut segments={ragSegments({ red: 4, amber: 8, green: 12, unknown: 2 })} centerValue={26} centerLabel="deliverables" /></Card>
          <Card title="Bar chart"><BarChart data={[{ label: 'Ideation', value: 4 }, { label: 'Design', value: 7 }, { label: 'Risk review', value: 5 }, { label: 'Build', value: 11 }, { label: 'Delivery', value: 3 }]} ariaLabel="Deliverables per stage" /></Card>
          <Card title="Baseline against assisted"><DualBar rows={[{ label: 'Weekly status draft', baseline: 6, assisted: 2.5, unit: 'h' }, { label: 'RAID triage', baseline: 4, assisted: 1.5, unit: 'h' }]} /></Card>
          <Card title="Sparkline and legend">
            <div className="flex flex-col gap-4">
              <Sparkline values={[3, 5, 4, 8, 7, 11, 10, 14]} height={48} />
              <Legend items={[{ label: 'Series A', color: chartColor(0), shape: 'line' }, { label: 'Series B', color: chartColor(1), shape: 'circle', value: 12 }]} />
              <StackedBar size="sm" legend={false} segments={[{ id: 'a', label: 'A', value: 5, color: chartColor(0) }, { id: 'b', label: 'B', value: 3, color: chartColor(1) }, { id: 'c', label: 'C', value: 2, color: chartColor(2) }]} />
            </div>
          </Card>
        </div>
      </Section>

      <Section title="Navigation, table and overlays">
        <Tabs ariaLabel="Gallery tabs" value={tab} onChange={setTab} items={[{ id: 'overview', label: 'Overview', count: 3 }, { id: 'evidence', label: 'Evidence' }, { id: 'locked', label: 'Locked', disabledReason: 'Complete the review first' }]}>
          <TabPanel id="overview">
            <DataTable ariaLabel="Deliverables" columns={COLUMNS} rows={ROWS} getRowId={(r) => r.id} defaultSort={{ columnId: 'pct', direction: 'desc' }} onRowClick={(r) => { setSelected(r.id); setOpen(true); }} selectedId={selected} maxHeight={320} />
          </TabPanel>
          <TabPanel id="evidence"><DataTable ariaLabel="Empty" columns={COLUMNS} rows={[]} getRowId={(r) => r.id} empty={<EmptyState variant="inline" title="No evidence yet" description="Simulate evidence arriving to see it here." />} /></TabPanel>
        </Tabs>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" icon={<Play />}>Run agent</Button>
          <Button icon={<Download />}>Export</Button>
          <Button variant="ghost" icon={<Plus />}>Add</Button>
          <Button variant="danger" icon={<Trash2 />}>Reject</Button>
          <Button disabledReason="Approve the review first">Move forward</Button>
          <Button loading>Running</Button>
          <IconButton label="Delete" icon={<Trash2 />} variant="secondary" />
          <Tooltip content="Explains the control"><Badge tone="accent">Hover me</Badge></Tooltip>
          <Button onClick={() => setOpen(true)}>Open drawer</Button>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card title="Timeline"><Timeline showStateLabel steps={[
            { id: '1', title: 'Read Epics and work items', state: 'done', meta: '0.3 s', description: 'Found 3 Epics, 41 items' },
            { id: '2', title: 'Check required evidence', state: 'failed', description: 'Test result failing' },
            { id: '3', title: 'Compile findings', state: 'running' },
            { id: '4', title: 'Draft status', state: 'pending' },
          ]} /></Card>
          <Card title="Tree and disclosure" padding="sm"><div className="flex flex-col gap-3">
            <Tree ariaLabel="Gallery tree">
              <TreeRow level={1} label="Investment request IR-01" expandable expanded={expanded.r} onToggle={() => setExpanded({ ...expanded, r: !expanded.r })} trailing={<RagPill status="green" size="sm" />} />
              {expanded.r ? <TreeRow level={2} label="Programme" expandable expanded={expanded.p} onToggle={() => setExpanded({ ...expanded, p: !expanded.p })} /> : null}
              {expanded.r && expanded.p ? <TreeRow level={3} label="Deliverable" /> : null}
            </Tree>
            <Disclosure summary="Evidence register" trailing={<Badge size="sm">6</Badge>}>Disclosure content.</Disclosure>
          </div></Card>
          <Card title="Empty and loading"><div className="flex flex-col gap-4"><EmptyState title="No findings" description="Every rule passed." /><SkeletonText /><Skeleton className="h-10 w-full" /></div></Card>
        </div>
      </Section>

      <Drawer open={open} onClose={() => setOpen(false)} eyebrow="Deliverable" title="Counterparty exposure" footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary">Open</Button></>}>
        <KeyValue columns={2} items={[{ label: 'Risk tier', value: 'T2 Moderate' }, { label: 'Epic', value: 'CCR-101', mono: true }]} />
      </Drawer>
    </div>
  );
}
