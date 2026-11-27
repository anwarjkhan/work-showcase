'use client';

import { ArrowLeftRight, Bot, Eye, HandHelping, ShieldCheck, Zap, type LucideIcon } from 'lucide-react';
import { BarChart, Legend, StackedBar, chartColor } from '@/components/charts';
import { ProvenanceBadge, ProvenanceBadges } from '@/components/shell';
import { DemoNote, Badge, Card, DataTable, Section, StatTile, cx, type Column } from '@/components/ui';
import {
  AUTOMATION_RULES,
  CAPABILITIES,
  CURRENT_HIERARCHY,
  GOVERNANCE_TYPES,
  MAPPING_ROWS,
  NEW_FIELDS,
  ROLLOUT_PLACEHOLDER_NOTE,
  TEMPLATE_PROFILES,
  TIER_ORDER,
  WORKFLOWS,
  type CapabilityRow,
  type NewField,
} from '@/lib/config/blueprint';
import { ESTATE } from '@/lib/config/estate';
import { RISK_TIER_POLICIES } from '@/lib/config/risk-tiers';
import { terms } from '@/lib/config/terminology';
import type { AutonomyCeiling, TemplateId } from '@/lib/types';
import { SupportMark } from './Support';

const TEMPLATE_ORDER: TemplateId[] = ['rapid', 'advanced', 'target'];
const AUTONOMY_ICON: Record<AutonomyCeiling, LucideIcon> = { 'auto-apply': Zap, 'propose-only': HandHelping, 'advisory-only': Eye };

export function BlueprintScreen() {
  const portfolio = terms.systems['portfolio-system'];
  const tracker = terms.systems['work-tracker'];
  return (
    <div className="flex flex-col gap-8" data-testid="blueprint-screen">
      <div className="di-card flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <p className="max-w-3xl font-display text-[17px] leading-snug text-title">
          We own the {tracker} templates for a large project estate, so we can make the new model real. This is the target template.
        </p>
        <ProvenanceBadges kinds={['planned', 'sample']} />
      </div>

      <Section title="Three templates side by side" description="What each is for, how deep it goes, and which new-model capabilities it can support.">
        <div className="grid gap-4 lg:grid-cols-3">
          {TEMPLATE_ORDER.map((id) => {
            const p = TEMPLATE_PROFILES.find((t) => t.id === id)!;
            const isTarget = id === 'target';
            return (
              <Card
                key={id}
                title={terms.templates[id]}
                description={p.purpose}
                selected={isTarget}
                actions={isTarget ? <ProvenanceBadge kind="planned" size="sm" /> : <Badge size="sm">In use today</Badge>}
                bodyClassName="flex flex-col gap-4"
              >
                <div>
                  <div className="di-eyebrow mb-1.5">Hierarchy</div>
                  <ol className="flex flex-wrap items-center gap-1 text-xs">
                    {p.hierarchy.map((h, i) => (
                      <li key={h} className="flex items-center gap-1">
                        {i > 0 ? <span aria-hidden className="text-fg-subtle">›</span> : null}
                        <span className="rounded-xs border border-line bg-surface-2 px-1.5 py-0.5 text-fg">{h}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div>
                  <div className="di-eyebrow mb-1.5">Issue types ({p.issueTypes.length + p.extraWorkTypes.length})</div>
                  <div className="flex flex-wrap gap-1">
                    {p.issueTypes.map((t) => (
                      <Badge key={t} size="sm" tone={t === 'tech-deliverable' ? 'accent' : 'neutral'}>
                        {terms.workItemTypes[t]}
                      </Badge>
                    ))}
                    {p.extraWorkTypes.map((t) => (
                      <Badge key={t} size="sm" tone="accent" dashed>
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="di-eyebrow mb-1.5">Workflow depth</div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-2xl font-semibold tabular-nums text-title">{p.workflowCount}</span>
                    <span className="text-[13px] text-fg-muted">{p.workflowCount === 1 ? 'workflow' : 'workflows'}: {p.workflowDepth}</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
        <CapabilityMatrix />
      </Section>

      <Section title="The current hierarchy, and what the target adds" description={`${tracker} today runs Theme, Initiative, Epic, a story level and Sub-task. The target adds a dedicated Tech Deliverable type at Epic level, shown as the target option alongside plain Epics.`}>
        <HierarchyDiagram />
      </Section>

      <Section
        title={`How ${portfolio} levels map to ${tracker} issue types`}
        description={`The ${portfolio} is the book of record down to the outcome. ${tracker} holds the work. Two fields join them.`}
      >
        <MappingDiagram />
      </Section>

      <Section title="New fields" description={`${NEW_FIELDS.length} fields, with their purpose, which issue types carry them and who or what keeps them current. The first nine join and trace the work; the rest name the ${terms.coreTeam.name} and record their decisions.`}>
        <DataTable<NewField>
          ariaLabel="New fields in the target template"
          rows={NEW_FIELDS}
          getRowId={(r) => r.id}
          dense
          columns={fieldColumns}
        />
      </Section>

      <Section title="Governance work types, workflows and automation" description="What a target template adds so that governance work lives next to delivery work.">
        <div className="grid gap-4 xl:grid-cols-3">
          <Card title="Further work types" level={3} description="Candidates; each is optional per project." bodyClassName="flex flex-col gap-2.5">
            {GOVERNANCE_TYPES.map((g) => (
              <div key={g.id} className="flex flex-col">
                <span className="text-[13px] font-semibold text-fg">{g.name}</span>
                <span className="text-xs text-fg-muted">{g.purpose}</span>
              </div>
            ))}
          </Card>
          <Card title="Automation rules" level={3} description="Written generically; no system is overwritten." bodyClassName="flex flex-col gap-3">
            {AUTOMATION_RULES.map((r) => (
              <div key={r.id} className="text-xs leading-snug">
                <span className="font-semibold text-accent">When</span> <span className="text-fg">{r.when}.</span>{' '}
                <span className="font-semibold text-accent">Then</span> <span className="text-fg-muted">{r.then}</span>
              </div>
            ))}
          </Card>
          <Card title="Eight reusable workflows" level={3} description="Status routes; a marked step needs evidence or a named person." padding="sm" bodyClassName="flex flex-col gap-3">
            {WORKFLOWS.map((w) => (
              <div key={w.id} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-semibold text-fg">{w.name}</span>
                  <span className="truncate text-[11px] text-fg-subtle">{w.appliesTo}</span>
                </div>
                <ol className="flex flex-wrap items-center gap-1 text-[11px]">
                  {w.route.map((s, i) => (
                    <li key={s} className="flex items-center gap-1">
                      {i > 0 ? <span aria-hidden className="text-fg-subtle">→</span> : null}
                      <span className="rounded-xs bg-inset px-1.5 py-0.5 text-fg-muted">{s}</span>
                    </li>
                  ))}
                </ol>
                {w.gate ? (
                  <span className="flex items-center gap-1 text-[11px] text-fg-muted">
                    <ShieldCheck aria-hidden className="size-3 text-accent" />
                    {w.gate}
                  </span>
                ) : null}
              </div>
            ))}
          </Card>
        </div>
      </Section>

      <Section title="Agent autonomy ceiling by risk tier" description="The work-item risk tier, kept separate from activity risk, sets how far an agent may act.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {TIER_ORDER.map((tier) => {
            const pol = RISK_TIER_POLICIES[tier];
            const Icon = AUTONOMY_ICON[pol.autonomy];
            return (
              <Card key={tier} eyebrow={terms.riskTiers[tier]} title={terms.autonomy[pol.autonomy]} level={3} bodyClassName="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-fg">
                  <span className="inline-flex size-8 items-center justify-center rounded-md border border-accent-line bg-accent-soft text-accent">
                    <Icon aria-hidden className="size-4" />
                  </span>
                  <span className="text-xs text-fg-muted">{pol.description}</span>
                </div>
                <div className="text-xs text-fg-muted">
                  <span className="font-semibold tabular-nums text-fg">{pol.requiredEvidence.length}</span> evidence kinds required for readiness
                </div>
              </Card>
            );
          })}
        </div>
        <div className="flex items-center gap-2 text-xs text-fg-muted">
          <Bot aria-hidden className="size-3.5" /> Ceilings come from <code className="font-mono">lib/config/risk-tiers.ts</code>.
        </div>
      </Section>

      <Section title="Rollout across the estate" description="Projects by template today, and the planned waves for the target template." actions={<ProvenanceBadges kinds={['planned', 'sample']} />}>
        <RolloutCharts />
      </Section>
    </div>
  );
}

const fieldColumns: Column<NewField>[] = [
  { id: 'name', header: 'Field', cell: (r) => <span className="font-semibold text-fg">{r.name}</span>, accessor: (r) => r.name, minWidth: 160 },
  { id: 'purpose', header: 'Purpose', cell: (r) => <span className="text-fg-muted">{r.purpose}</span>, minWidth: 260 },
  { id: 'type', header: 'Type', cell: (r) => <span className="font-mono text-xs text-fg-muted">{r.fieldType}</span>, minWidth: 130 },
  {
    id: 'carried',
    header: 'Carried by',
    cell: (r) => (
      <span className="flex flex-wrap gap-1">
        {r.carriedBy.map((c) => (
          <Badge key={c} size="sm">{c}</Badge>
        ))}
      </span>
    ),
    minWidth: 150,
  },
  { id: 'maintained', header: 'Maintained by', cell: (r) => <span className="text-fg-muted">{r.maintainedBy}</span>, minWidth: 240 },
];

function CapabilityMatrix() {
  const columns: Column<CapabilityRow>[] = [
    {
      id: 'cap',
      header: 'Capability',
      cell: (r) => (
        <div>
          <div className="font-medium text-fg">{r.label}</div>
          <div className="text-xs text-fg-muted">{r.detail}</div>
        </div>
      ),
      minWidth: 280,
    },
    ...TEMPLATE_ORDER.map<Column<CapabilityRow>>((id) => ({
      id,
      header: terms.templates[id],
      cell: (r) => <SupportMark support={r.support[id]} />,
      minWidth: 120,
    })),
  ];
  return <DataTable<CapabilityRow> ariaLabel="Capability matrix by template" rows={CAPABILITIES} getRowId={(r) => r.id} columns={columns} dense />;
}

function HierarchyDiagram() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Current hierarchy" description={`In ${terms.systems['work-tracker']} today`} bodyClassName="flex flex-col gap-2">
        {CURRENT_HIERARCHY.map((band, i) => (
          <div key={band.id} className="flex items-start gap-3" style={{ paddingLeft: Math.min(i, 3) * 12 }}>
            <div className="w-24 shrink-0 pt-1 text-[13px] font-semibold text-fg">{band.label}</div>
            <div className="flex flex-wrap gap-1">
              {band.types.map((t) => (
                <Badge key={t} size="sm">{terms.workItemTypes[t]}</Badge>
              ))}
            </div>
          </div>
        ))}
      </Card>
      <Card selected title="Target additions" description="At Epic level, one deliverable can have many Epics" footerLabel footer={<ProvenanceBadge kind="planned" size="sm" />}>
        <div className="flex flex-col items-center gap-3">
          <div className="flex w-full items-center justify-center gap-2 rounded-md border border-accent-line bg-accent-soft px-3 py-2 text-[13px] font-semibold text-accent">
            {terms.workItemTypes['tech-deliverable']}
            <span className="font-mono text-[11px] font-normal">carries Deliverable ID</span>
          </div>
          <div aria-hidden className="h-4 w-px bg-line-strong" />
          <div className="grid w-full grid-cols-3 gap-2">
            {['Epic A', 'Epic B', 'Epic C'].map((e) => (
              <div key={e} className="rounded-md border border-line bg-surface-2 px-2 py-1.5 text-center text-xs text-fg">
                {e}
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-fg-muted">
            Many Epics to one deliverable, each Epic carrying the same Deliverable ID. Plain Epics stay valid; the Tech Deliverable type is the target option.
          </p>
        </div>
      </Card>
    </div>
  );
}

function MappingDiagram() {
  return (
    <div className="di-card overflow-x-auto p-5">
      <div className="min-w-[760px]">
        <div className="mb-3 grid grid-cols-[1fr_200px_1fr] gap-4 text-center">
          <div className="di-eyebrow">{terms.systems['portfolio-system']} · {terms.bookOfRecord}</div>
          <div className="di-eyebrow">Joined by</div>
          <div className="di-eyebrow">{terms.systems['work-tracker']}</div>
        </div>
        <div className="relative flex flex-col gap-3">
          <div aria-hidden className="absolute inset-y-[-6px] left-1/2 w-0 -translate-x-1/2 border-l-2 border-dashed border-accent-line" />
          {MAPPING_ROWS.map((row) => (
            <div key={row.id} className="relative grid grid-cols-[1fr_200px_1fr] items-center gap-4">
              <div className={cx('rounded-md border px-3 py-2', row.join ? 'border-line-strong bg-surface-2' : 'border-line bg-surface')}>
                <div className="text-[13px] font-semibold text-fg">{row.portfolioLabel}</div>
                <div className="text-xs text-fg-muted">{row.portfolioNote}</div>
              </div>
              <div className="flex justify-center">
                {row.join ? (
                  <span className="relative z-10 inline-flex items-center gap-1.5 rounded-pill border border-accent-line bg-accent-soft px-3 py-1 text-xs font-semibold text-accent shadow-card">
                    <ArrowLeftRight aria-hidden className="size-3.5" />
                    {row.join}
                  </span>
                ) : (
                  <span className="relative z-10 rounded-pill bg-canvas px-2 text-[11px] text-fg-subtle">no join</span>
                )}
              </div>
              <div className={cx('rounded-md border px-3 py-2', row.join ? 'border-line-strong bg-surface-2' : 'border-line bg-surface')}>
                <div className="flex flex-wrap gap-1">
                  {row.trackerLabel.map((t) => (
                    <Badge key={t} size="sm" tone={t === 'Tech Deliverable' ? 'accent' : 'neutral'}>{t}</Badge>
                  ))}
                </div>
                <div className="mt-1 text-xs text-fg-muted">{row.trackerNote}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs text-fg-muted">
          <span className="flex items-center gap-2">
            <span aria-hidden className="h-0 w-6 border-t-2 border-dashed border-accent-line" /> {terms.bookOfRecordBoundary}
          </span>
          <span>Reads flow from the tracker to the portfolio view. The portfolio record is never overwritten from {terms.systems['work-tracker']}.</span>
        </div>
      </div>
    </div>
  );
}

function RolloutCharts() {
  const p = ESTATE.projectsByTemplate;
  const segments = [
    { id: 'rapid', label: terms.templates.rapid, value: p.rapid, color: chartColor(0) },
    { id: 'advanced', label: terms.templates.advanced, value: p.advanced, color: chartColor(1) },
    { id: 'target', label: terms.templates.target, value: p.target, color: chartColor(2) },
    { id: 'other', label: 'Other templates', value: ESTATE.projectsOnOtherTemplates, color: chartColor(5) },
  ];
  const waves = ESTATE.rolloutWaves.map((w) => ({ label: `${w.label} ${w.quarter}`, value: w.projects, color: chartColor(2) }));
  const cumulative = ESTATE.rolloutWaves.map((_, i) => ESTATE.rolloutWaves.slice(0, i + 1).reduce((sum, w) => sum + w.projects, 0));
  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
      <Card title="Projects by template today" bodyClassName="flex flex-col gap-4" footerLabel footer={<DemoNote>{ROLLOUT_PLACEHOLDER_NOTE}</DemoNote>}>
        <StatTile label="Projects in scope" value={ESTATE.projects} provenance="sample" caption="Placeholder" />
        <StackedBar segments={segments} size="lg" ariaLabel="Projects by template today" />
      </Card>
      <Card title="Planned waves to the target template" description="Projects moving per wave (placeholder)" footerLabel footer={<ProvenanceBadge kind="planned" size="sm" />}>
        <BarChart data={waves} height={220} ariaLabel="Projects per rollout wave, placeholder" />
        <Legend
          className="mt-2"
          items={[{ label: `Cumulative on target template: ${cumulative.join(', ')} of ${ESTATE.projects}`, color: chartColor(2) }]}
        />
      </Card>
    </div>
  );
}
