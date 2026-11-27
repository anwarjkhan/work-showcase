'use client';

import { Cpu, Database, Palette, PlugZap, Server, Ban } from 'lucide-react';
import type { ReactNode } from 'react';
import { ProvenanceBadge, ProvenanceBadges } from '@/components/shell';
import { Card, DataTable, Section, StatTile, type Column } from '@/components/ui';
import { terms } from '@/lib/config/terminology';
import { useEngineResult, usePortfolioData } from '@/lib/store';
import type { Provenance } from '@/lib/types';

interface RegisterRow {
  id: string;
  area: string;
  what: string;
  kinds: Provenance[];
}

const REGISTER: RegisterRow[] = [
  { id: 'portfolio', area: 'Portfolio', what: 'Counts, three measures and evidence-based status are calculated from the records. Reported status is as held in the data.', kinds: ['computed', 'reported', 'sample'] },
  { id: 'hierarchy', area: 'Hierarchy explorer', what: 'The tree is built from the records; levels and owners are sample data.', kinds: ['sample', 'reported'] },
  { id: 'deliverable', area: 'Deliverable detail', what: 'Measures, findings and readiness reasons are computed. Status drafts come from a scripted agent.', kinds: ['computed', 'scripted-agent', 'sample'] },
  { id: 'plan', area: 'Plan', what: 'Forecast against plan is computed from dates and dependencies; the dates are sample data.', kinds: ['computed', 'sample'] },
  { id: 'global', area: 'Global', what: 'Hub size, health and arcs are computed; hubs and dependencies are sample data.', kinds: ['computed', 'sample'] },
  { id: 'lifecycle', area: 'Lifecycle', what: 'Stage placement and the human and agent share are computed from work items. Reviews shown are illustrative.', kinds: ['computed', 'sample'] },
  { id: 'workflow', area: 'PDLC workflow', what: 'Stage agents are scripted. Test evidence arrives through a simulated control; nothing is executed.', kinds: ['scripted-agent', 'simulated', 'computed'] },
  { id: 'agents', area: 'Agent centre', what: `Nine deterministic agents, not a language model. Approving a change updates in-app data only, standing in for a ${terms.systems['work-tracker']} write.`, kinds: ['scripted-agent', 'computed'] },
  { id: 'blueprint', area: 'Template blueprint', what: 'The target template is a proposal. Estate numbers are round placeholders.', kinds: ['planned', 'sample'] },
  { id: 'evidence-placeholder', area: 'Pilot evidence: measures', what: 'Every pilot figure is a placeholder to be replaced by measured values.', kinds: ['planned'] },
  { id: 'evidence-baseline', area: 'Pilot evidence: day-zero baseline', what: 'Findings per rule, from the engine on the current data.', kinds: ['computed', 'sample'] },
  { id: 'live', area: 'Live connections', what: `Not built. No ${terms.systems['work-tracker']}, ${terms.systems['portfolio-system']} or model calls.`, kinds: ['planned'] },
];

const columns: Column<RegisterRow>[] = [
  { id: 'area', header: 'Screen or capability', accessor: (r) => r.area, cell: (r) => <span className="font-semibold text-fg">{r.area}</span>, minWidth: 200 },
  { id: 'kinds', header: 'What it is', cell: (r) => <ProvenanceBadges kinds={r.kinds} size="sm" />, sortable: false, minWidth: 280, demoLabel: true },
  { id: 'what', header: 'Detail', cell: (r) => <span className="text-fg-muted">{r.what}</span>, sortable: false, minWidth: 420 },
];

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-line bg-inset p-3 font-mono text-[12px] leading-relaxed text-fg">
      <code>{children}</code>
    </pre>
  );
}

function Step({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Card title={title} bodyClassName="flex flex-col gap-3" actions={<span className="text-accent [&>svg]:size-4">{icon}</span>}>
      {children}
    </Card>
  );
}

export function AboutScreen() {
  const data = usePortfolioData();
  const result = useEngineResult();
  const epics = data.workItems.filter((w) => w.type === 'epic' || w.type === 'tech-deliverable').length;
  return (
    <div className="flex flex-col gap-8" data-testid="about-screen">
      <div className="di-card flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <p className="max-w-3xl font-display text-[17px] leading-snug text-title">
          An honest account of this build: what is calculated, what is scripted, what is sample data, and what is still only a plan.
        </p>
        <ProvenanceBadge kind="sample" />
      </div>

      <Section title="Live data volumes" description={`Read from the store now (${data.meta.sourceId}, seed ${data.meta.seed ?? 'none'}).`}>
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
          <StatTile label="Deliverables" value={data.deliverables.length} provenance="sample" />
          <StatTile label="Epics" value={epics} provenance="sample" />
          <StatTile label="Work items" value={data.workItems.length} provenance="sample" />
          <StatTile label="Evidence records" value={data.evidence.length} provenance="sample" />
          <StatTile label="Findings" value={result.findings.length} provenance="computed" />
        </div>
      </Section>

      <Section title="Register of what is real" description="For each screen and capability: computed from data, scripted agent, simulated, sample data, reported, or planned.">
        <DataTable<RegisterRow> ariaLabel="Provenance register" rows={REGISTER} getRowId={(r) => r.id} columns={columns} dense />
      </Section>

      <Section title="How it is built">
        <div className="grid gap-4 md:grid-cols-4">
          {[
            ['Static', 'A static export. Open it from any file host.'],
            ['No server', 'No server code and no database.'],
            ['No network', 'Nothing leaves the machine at build or run time; fonts and map are bundled.'],
            ['Deterministic clock', `The demo clock is fixed at ${data.meta.asOf}, so every run shows the same thing.`],
          ].map(([t, d]) => (
            <div key={t} className="di-card flex gap-3 p-4">
              <Server aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
              <div>
                <div className="text-[14px] font-semibold text-fg">{t}</div>
                <p className="mt-0.5 text-xs text-fg-muted">{d}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="di-card overflow-x-auto p-4">
          <ol className="flex min-w-[720px] items-center gap-2 text-xs">
            {['Data source', 'Store', 'Engine (pure rules)', 'Agents (scripted)', 'Screens'].map((s, i, a) => (
              <li key={s} className="flex flex-1 items-center gap-2">
                <span className="flex-1 rounded-md border border-line bg-surface-2 px-3 py-2 text-center font-medium text-fg">{s}</span>
                {i < a.length - 1 ? <span aria-hidden className="text-fg-subtle">→</span> : null}
              </li>
            ))}
          </ol>
        </div>
      </Section>

      <Section id="plugging-in" title="Plugging in" description="Four places to change after import. None needs a screen to be rewritten.">
        <div className="grid gap-4 xl:grid-cols-2">
          <Step icon={<Database aria-hidden />} title="Real data: DataSource">
            <p className="text-xs text-fg-muted">Screens read everything through one interface. Write a Jira source that loads read-only, then return it from <code className="font-mono">getDataSource()</code>.</p>
            <Code>{`interface DataSource {
  readonly id: string;
  readonly kind: 'synthetic' | 'stub' | 'jira';
  readonly label: string;
  load(): PortfolioData;   // deterministic snapshot
}
// JiraSourceOptions: baseUrl, epicJql,
// fields { deliverableId, outcomeId, podId, ... }`}</Code>
          </Step>
          <Step icon={<Cpu aria-hidden />} title="An approved model: ModelProvider">
            <p className="text-xs text-fg-muted">Agents ask a provider for text. The scripted provider is the only one today; implement the same interface against the approved model platform. Citations stay required.</p>
            <Code>{`interface ModelProvider {
  id: string; label: string;
  kind: 'scripted' | 'model';
  live: boolean;      // false: no external call
  generate(request): Promise<ModelResponse>;
}`}</Code>
          </Step>
          <Step icon={<PlugZap aria-hidden />} title="Internal names: terminology override">
            <p className="text-xs text-fg-muted">Every system, template and status label is read from one file. Copy the fallback to the git-ignored override and change any subset.</p>
            <Code>{`lib/config/terminology.local.fallback.ts
  → lib/config/terminology.local.ts`}</Code>
          </Step>
          <Step icon={<Palette aria-hidden />} title="Branding: theme file">
            <p className="text-xs text-fg-muted">All colours and fonts are variables in one file, for both light and dark. Set brand values and the logo there.</p>
            <Code>{`app/theme.css   (--di-* variables)`}</Code>
          </Step>
        </div>
      </Section>

      <Section title="What this build does not do">
        <Card bodyClassName="grid gap-3 md:grid-cols-2">
          {[
            `Connect to ${terms.systems['work-tracker']}, the ${terms.systems['portfolio-system']} or any model.`,
            'Authenticate users or enforce roles; the presenter acts as a named sample approver.',
            'Persist anything; a refresh returns to the seeded state.',
            'Generate code, execute tests or deploy anything. Test results arrive as simulated evidence.',
            'Show money or headcount.',
          ].map((t) => (
            <div key={t} className="flex items-start gap-2.5 text-[13px] text-fg">
              <Ban aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
              {t}
            </div>
          ))}
        </Card>
      </Section>
    </div>
  );
}
