import { Card, RagPair } from '@/components/ui';
import { cx } from '@/components/ui/cx';
import { READINESS_ICON, READINESS_TONE, SEVERITY_TONE, StatusGlyph, TONE } from '@/components/ui/status';
import { SeverityBadge } from '@/components/ui';
import { terms } from '@/lib/config/terminology';
import type { EvidenceRagStatus, ReadinessState } from '@/lib/types';
import type { PortfolioView, ProgrammeRow } from './model';

function Tile({ label, value, caption, testId }: { label: string; value: number; caption?: string; testId: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 p-4">
      <div className="di-eyebrow truncate">{label}</div>
      <div data-testid={testId} className="font-display text-[30px] leading-none font-semibold text-title tabular-nums">{value}</div>
      <div className="min-h-4 truncate text-xs text-fg-muted">{caption}</div>
    </div>
  );
}

export function HierarchyCounts({ view }: { view: PortfolioView }) {
  const c = view.summary.counts;
  return (
    <div className="di-card grid grid-cols-2 divide-x divide-y divide-line md:grid-cols-5 md:divide-y-0 [&>*:nth-child(2n+1)]:border-l-0">
      <Tile testId="count-requests" label={`${terms.hierarchy.investmentRequest}s`} value={c.investmentRequests} />
      <Tile
        testId="count-nodes"
        label="Programmes and projects"
        value={c.initiatives + c.programmes + c.projects}
        caption={`${c.initiatives} initiatives · ${c.programmes} programmes · ${c.projects} projects`}
      />
      <Tile testId="count-deliverables" label={`${terms.hierarchy.deliverableShort}s`} value={c.deliverables} caption={`${c.standaloneDeliverables} standalone`} />
      <Tile testId="count-epics" label={`${terms.hierarchy.epic}s`} value={c.epics} caption={`${c.workItems} work items`} />
      <Tile testId="count-outcomes" label={`${terms.hierarchy.outcome}s`} value={c.outcomes} />
    </div>
  );
}

function MiniRag({ counts }: { counts: Record<EvidenceRagStatus, number> }) {
  const order: EvidenceRagStatus[] = ['red', 'amber', 'green', 'unknown'];
  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-2 w-24 gap-px overflow-hidden rounded-pill bg-inset" aria-hidden>
        {order.map((s) => (counts[s] > 0 ? <div key={s} className={TONE[s].fill} style={{ flexGrow: counts[s], flexBasis: 0 }} /> : null))}
      </div>
      <div className="flex gap-2 text-[11px] text-fg-muted tabular-nums">
        {order.map((s) => (counts[s] > 0 ? (
          <span key={s} className="inline-flex items-center gap-0.5">
            <StatusGlyph status={s} className="size-2.5" />
            {counts[s]}
            <span className="sr-only"> {terms.rag[s]}</span>
          </span>
        ) : null))}
      </div>
    </div>
  );
}

function ReadinessCounts({ counts }: { counts: Record<ReadinessState, number> }) {
  return (
    <div className="flex items-center gap-2.5 text-xs tabular-nums">
      {(['ready', 'not-ready', 'unknown'] as const).map((k) => {
        const Icon = READINESS_ICON[k];
        return (
          <span key={k} title={terms.readiness[k]} className={cx('inline-flex items-center gap-1', counts[k] > 0 ? TONE[READINESS_TONE[k]].text : 'text-fg-subtle')}>
            <Icon aria-hidden className={cx('size-3.5', counts[k] > 0 && TONE[READINESS_TONE[k]].icon)} strokeWidth={2.2} />
            <span className="font-semibold">{counts[k]}</span>
            <span className="sr-only"> {terms.readiness[k]}</span>
          </span>
        );
      })}
    </div>
  );
}

function ProgrammeLine({ p }: { p: ProgrammeRow }) {
  const wc = p.rollup.workCompletion;
  const ao = p.rollup.acceptedOutcomes;
  return (
    <tr data-testid="programme-row" data-programme-id={p.id} className="border-t border-line align-middle">
      <td className="max-w-0 py-2.5 pr-3 pl-5">
        <div className="truncate text-[13px] font-semibold text-title">{p.title}</div>
        <div className="text-xs text-fg-muted tabular-nums">{p.rollup.deliverableIds.length} deliverables</div>
      </td>
      <td className="py-2.5 pr-3">
        {p.reported && p.evidence ? <RagPair reported={p.reported} evidence={p.evidence} size="sm" /> : <span className="text-xs text-fg-subtle">No programme status</span>}
      </td>
      <td className="py-2.5 pr-3"><MiniRag counts={p.ragCounts} /></td>
      <td className="py-2.5 pr-3 text-right text-[13px] font-semibold text-fg tabular-nums">{wc.computable ? `${wc.value.percent}%` : '–'}</td>
      <td className="py-2.5 pr-3 text-right text-[13px] font-semibold text-fg tabular-nums">
        {ao.computable ? `${ao.value.acceptedCount}/${ao.value.totalCount}` : '–'}
      </td>
      <td className="py-2.5 pr-5"><ReadinessCounts counts={p.rollup.readiness} /></td>
    </tr>
  );
}

export function ProgrammeHealth({ view }: { view: PortfolioView }) {
  const th = 'pb-2 pr-3 text-[11px] font-semibold tracking-wide text-fg-subtle uppercase';
  return (
    <Card title="Health by programme" description="Reported against evidence-based status, with the three measures rolled up from deliverables." padding="none">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] table-fixed border-separate border-spacing-0 text-left">
          <caption className="sr-only">Health by programme</caption>
          <colgroup>
            <col className="w-[24%]" /><col className="w-[31%]" /><col className="w-[14%]" /><col className="w-[8%]" /><col className="w-[10%]" /><col className="w-[13%]" />
          </colgroup>
          <thead>
            <tr>
              <th className={`${th} pl-5 text-left`}>Programme</th>
              <th className={th}>Status</th>
              <th className={th}>Evidence mix</th>
              <th className={`${th} text-right`}>Work</th>
              <th className={`${th} text-right`}>Accepted</th>
              <th className={`${th} pr-5`}>Readiness</th>
            </tr>
          </thead>
          <tbody>{view.programmes.map((p) => <ProgrammeLine key={p.id} p={p} />)}</tbody>
        </table>
      </div>
    </Card>
  );
}

export function StageDistribution({ view }: { view: PortfolioView }) {
  const max = Math.max(1, ...view.stages.map((s) => s.count));
  return (
    <Card title="Across the five lifecycle stages" description="Deliverables by current PDLC stage." padding="sm" bodyClassName="flex flex-col gap-2.5">
      {view.stages.map((s, i) => (
        <div key={s.id} data-testid={`stage-${s.id}`} className="grid grid-cols-[110px_minmax(0,1fr)_28px] items-center gap-3 text-[13px]">
          <span className="truncate text-fg-muted"><span className="mr-1.5 text-fg-subtle tabular-nums">{i + 1}</span>{s.name}</span>
          <div className="h-3 rounded-pill bg-inset" aria-hidden>
            <div className="h-full rounded-pill bg-accent" style={{ width: `${(s.count / max) * 100}%` }} />
          </div>
          <span className="text-right font-semibold text-title tabular-nums">{s.count}</span>
        </div>
      ))}
    </Card>
  );
}

export function TopFindings({ view }: { view: PortfolioView }) {
  const shown = view.rules.slice(0, 6);
  return (
    <Card title="Top findings by rule" description={`${view.findingsTotal} findings across ${view.rules.length} rules, most severe first.`} padding="sm" bodyClassName="flex flex-col gap-2">
      {shown.length === 0 ? <p className="text-sm text-fg-muted">No findings.</p> : null}
      {shown.map((r) => (
        <div key={r.ruleId} data-testid={`rule-${r.ruleId}`} className="grid grid-cols-[34px_minmax(0,1fr)_auto_28px] items-center gap-3 text-[13px]">
          <span className="font-mono text-xs text-fg-muted">{r.ruleId}</span>
          <span className="truncate text-fg" title={r.description}>{r.description}</span>
          <SeverityBadge severity={r.topSeverity} size="sm" />
          <span className={cx('text-right font-semibold tabular-nums', TONE[SEVERITY_TONE[r.topSeverity]].text)}>{r.count}</span>
        </div>
      ))}
    </Card>
  );
}
