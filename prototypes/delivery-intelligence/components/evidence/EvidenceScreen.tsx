'use client';

import { Ban, CalendarCheck, CheckCircle2, ClipboardList, FileLock2, KeyRound, ShieldCheck, Timer, UserCheck, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { BarChart, DualBar, chartColor } from '@/components/charts';
import { ProvenanceBadge } from '@/components/shell';
import { DemoNote, Badge, Card, DataTable, EmptyState, Section, SeverityBadge, StatTile, cx, type Column } from '@/components/ui';
import { RULE_DESCRIPTIONS, RULE_SEVERITY } from '@/lib/config/thresholds';
import { terms } from '@/lib/config/terminology';
import { useEngineResult } from '@/lib/store';
import type { RuleId, Severity } from '@/lib/types';
import { PLACEHOLDER_ACCEPTED, PLACEHOLDER_EFFORT, PLACEHOLDER_EXCEPTIONS, PLACEHOLDER_USERS, PLACEHOLDER_WEEKS } from './placeholders';

const RULES = Object.keys(RULE_DESCRIPTIONS) as RuleId[];
const weeks = (values: number[]) => values.map((v, i) => ({ label: PLACEHOLDER_WEEKS[i] ?? `W${i + 1}`, value: v, color: chartColor(0) }));

/** Card for a placeholder figure: dashed outline, PLACEHOLDER label and the planned badge. */
function PlaceholderCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <Card
      title={title}
      description={description}
      className="border-dashed"
      actions={<Badge size="sm" tone="amber" dashed>Placeholder</Badge>}
      footerLabel
      footer={
        <>
          <ProvenanceBadge kind="planned" size="sm" />
          <DemoNote>Placeholder figures, not measured.</DemoNote>
        </>
      }
    >
      {children}
    </Card>
  );
}

export function EvidenceScreen() {
  const result = useEngineResult();
  const findings = result.findings;
  const counts = new Map<RuleId, number>();
  for (const f of findings) counts.set(f.ruleId, (counts.get(f.ruleId) ?? 0) + 1);
  const rows = RULES.map((id) => ({ id, count: counts.get(id) ?? 0 }));
  const maxCount = Math.max(1, ...rows.map((r) => r.count));
  const deliverablesAffected = new Set(findings.map((f) => f.deliverableId).filter(Boolean)).size;
  const bySeverity = result.portfolio.findingsBySeverity;

  const columns: Column<{ id: RuleId; count: number }>[] = [
    { id: 'rule', header: 'Rule', cell: (r) => <span className="font-mono text-xs font-semibold text-fg">{r.id}</span>, accessor: (r) => Number(r.id.slice(1)), minWidth: 60 },
    { id: 'desc', header: 'Check', cell: (r) => <span className="text-fg-muted">{RULE_DESCRIPTIONS[r.id]}</span>, minWidth: 360 },
    { id: 'sev', header: 'Severity', cell: (r) => <SeverityBadge severity={RULE_SEVERITY[r.id] as Severity} size="sm" />, accessor: (r) => RULE_SEVERITY[r.id], minWidth: 110 },
    {
      id: 'bar',
      header: 'Findings',
      accessor: (r) => r.count,
      cell: (r) => (
        <div className="flex items-center gap-3">
          <div className="h-2 w-40 overflow-hidden rounded-pill bg-inset" aria-hidden>
            <div className="h-full rounded-pill bg-accent" style={{ width: `${(r.count / maxCount) * 100}%` }} />
          </div>
          <span className="w-8 font-semibold tabular-nums text-fg">{r.count}</span>
        </div>
      ),
      minWidth: 240,
    },
  ];

  return (
    <div className="flex flex-col gap-8" data-testid="evidence-screen">
      <div className="di-card flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <p className="max-w-3xl font-display text-[17px] leading-snug text-title">
          This is what we will measure, and this is the ask. Nothing below the baseline is a measured result yet.
        </p>
        <ProvenanceBadge kind="planned" />
      </div>

      <Section title="What the pilot measures" description="Four measures, each with a chart that shows what the result would look like. Every figure here is a placeholder.">
        <div className="grid gap-4 lg:grid-cols-2">
          <PlaceholderCard title="Minutes per report" description="Baseline against assisted, per weekly status report and per governance pack">
            <DualBar rows={PLACEHOLDER_EFFORT} scale="row" format={(n) => String(Math.round(n))} />
          </PlaceholderCard>
          <PlaceholderCard title="Exception counts over time" description="Open data-quality exceptions per pilot week">
            <BarChart data={weeks(PLACEHOLDER_EXCEPTIONS)} height={200} ariaLabel="Placeholder: open exceptions per week" />
          </PlaceholderCard>
          <PlaceholderCard title="Drafts accepted without edits" description="Share of agent drafts a programme manager accepted unchanged">
            <BarChart data={weeks(PLACEHOLDER_ACCEPTED)} height={200} max={100} format={(n) => `${n}%`} ariaLabel="Placeholder: share of drafts accepted without edits" />
          </PlaceholderCard>
          <PlaceholderCard title="Weekly users" description="Programme managers using the tool each week">
            <BarChart data={weeks(PLACEHOLDER_USERS)} height={200} max={6} ticks={3} ariaLabel="Placeholder: weekly users" />
          </PlaceholderCard>
        </div>
      </Section>

      <Section
        title="Day-zero data-quality baseline"
        description="Real output: the checks run on the data in this build today. It shows what the pilot would find on day one."
        actions={<ProvenanceBadge kind="computed" />}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Findings" value={findings.length} provenance="computed" caption="Across all 14 rules" />
          <StatTile label="Deliverables affected" value={deliverablesAffected} provenance="computed" caption={`of ${result.portfolio.counts.deliverables}`} />
          <StatTile label="Critical" value={bySeverity.critical} provenance="computed" caption={`${bySeverity.high} high`} />
          <StatTile label="Medium and low" value={bySeverity.medium + bySeverity.low} provenance="computed" />
        </div>
        {findings.length === 0 ? (
          <EmptyState title="No findings computed" description="The engine returned no findings for the current data." />
        ) : (
          <DataTable ariaLabel="Findings per rule" rows={rows} getRowId={(r) => r.id} columns={columns} dense />
        )}
      </Section>

      <Section title="How the baseline will be gathered" description="The placeholders above are replaced by measured figures from this routine.">
        <ol className="grid gap-4 md:grid-cols-3">
          {[
            { icon: UserCheck, title: 'Three or more programme managers', body: 'Volunteers from different programmes, agreed with the sponsor.' },
            { icon: Timer, title: 'Time two reporting cycles', body: 'Minutes per weekly status report and per governance pack, as they work today.' },
            { icon: ClipboardList, title: 'Compare with assisted weeks', body: 'The same people, the same reports, with drafts prepared for them to review.' },
          ].map((s, i) => (
            <li key={s.title} className="di-card flex gap-3 p-4">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-accent-line bg-accent-soft text-accent">
                <s.icon aria-hidden className="size-4.5" />
              </span>
              <div>
                <div className="di-eyebrow">Step {i + 1}</div>
                <div className="text-[14px] font-semibold text-fg">{s.title}</div>
                <p className="mt-0.5 text-xs text-fg-muted">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Pilot shape" description="Eight weeks, three to five programme managers, read-only, draft-only." actions={<ProvenanceBadge kind="planned" />}>
        <Card padding="sm">
          <div className="grid grid-cols-8 gap-1.5" role="list" aria-label="Pilot weeks">
            {PLACEHOLDER_WEEKS.map((w, i) => (
              <div
                key={w}
                role="listitem"
                className={cx(
                  'flex flex-col gap-0.5 rounded-md border px-2 py-2 text-xs',
                  i < 2 ? 'border-line bg-surface-2' : i < 7 ? 'border-accent-line bg-accent-soft' : 'border-line-strong bg-inset',
                )}
              >
                <span className="font-semibold text-fg">{w}</span>
                <span className="text-fg-muted">{i < 2 ? 'Connect, read-only' : i < 7 ? 'Assisted reporting' : 'Review and decide'}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-fg-muted">
            <span className="flex items-center gap-1.5"><ShieldCheck aria-hidden className="size-3.5 text-accent" /> Read-only access to {terms.systems['work-tracker']}</span>
            <span className="flex items-center gap-1.5"><FileLock2 aria-hidden className="size-3.5 text-accent" /> Drafts only; people send and approve</span>
          </div>
        </Card>
      </Section>

      <Section title="The ask" description="Four things, and four things we are not asking for.">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card selected title="What we ask for" bodyClassName="flex flex-col gap-3">
            {([
              [KeyRound, `Read-only ${terms.systems['work-tracker']} access`, 'For a named set of programmes.'],
              [ShieldCheck, 'Use of an approved model', 'If one exists; otherwise the scripted agents are used.'],
              [UserCheck, 'A named sponsor', 'Who agrees the thresholds before we start.'],
              [CalendarCheck, 'A decision date', 'At the end of the eight weeks.'],
            ] as Array<[LucideIcon, string, string]>).map(([Icon, t, d]) => (
              <div key={t} className="flex items-start gap-3">
                <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-status-green" />
                <Icon aria-hidden className="sr-only" />
                <div>
                  <div className="text-[13px] font-semibold text-fg">{t}</div>
                  <div className="text-xs text-fg-muted">{d}</div>
                </div>
              </div>
            ))}
          </Card>
          <Card title="What we are not asking for" bodyClassName="flex flex-col gap-3">
            {[
              ['Write-back', `Nothing is written to ${terms.systems['work-tracker']} or the ${terms.systems['portfolio-system']}.`],
              ['A production system', 'The pilot runs read-only, outside production workflows.'],
              ['Budget', 'No funding request.'],
              ['Headcount', 'No new roles; the pilot uses existing programme managers.'],
            ].map(([t, d]) => (
              <div key={t} className="flex items-start gap-3">
                <Ban aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
                <div>
                  <div className="text-[13px] font-semibold text-fg">Not: {t}</div>
                  <div className="text-xs text-fg-muted">{d}</div>
                </div>
              </div>
            ))}
          </Card>
        </div>
      </Section>

      <Section title="Decision criteria" description="Agree thresholds with the sponsor before starting. Then the outcome follows from the measures.">
        <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
          <Card title="Thresholds to agree" bodyClassName="flex flex-col gap-2">
            {['Minutes per weekly status report and per governance pack', 'Open exceptions over time', 'Share of drafts accepted without edits', 'Weekly users'].map((m) => (
              <div key={m} className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface-2 px-3 py-2 text-[13px]">
                <span className="text-fg">{m}</span>
                <Badge size="sm" tone="amber" dashed>Threshold to be agreed</Badge>
              </div>
            ))}
          </Card>
          <div className="grid gap-3">
            {[
              ['Scale', 'Thresholds met: extend to more programmes and begin the template rollout.'],
              ['Adapt', 'Partly met: change the drafts, rules or template, and run a second round.'],
              ['Stop', 'Not met: stop, keep the baseline and the data-quality findings.'],
            ].map(([t, d]) => (
              <div key={t} className="di-card px-4 py-3">
                <div className="font-display text-[15px] font-semibold text-title">{t}</div>
                <div className="text-xs text-fg-muted">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </Section>
    </div>
  );
}
