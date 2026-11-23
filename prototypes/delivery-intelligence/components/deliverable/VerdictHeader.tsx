'use client';

import { ArrowRight, ChevronLeft, ChevronRight, GitCompareArrows, Globe2, CalendarRange, Workflow } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ProvenanceBadges } from '@/components/shell';
import { AddToSlides } from '@/components/slides/AddToSlides';
import { ExportPack } from '@/components/slides/ExportPack';
import { DemoNote, AvatarLabel, Badge, IconButton, MeasureTriple, RagPill, ReadinessPill, cx } from '@/components/ui';
import { FOCUS_RING } from '@/components/ui/cx';
import { formatDate } from '@/lib/config/clock';
import { stageDefinition } from '@/lib/config/pdlc';
import { HERO_DELIVERABLE_ID } from '@/lib/config/story';
import { hrefs } from '@/lib/config/routes';
import { terms } from '@/lib/config/terminology';
import { useDemoState } from '@/lib/store';
import type { DeliverableModel } from './model';
import { RecordChip } from './records';

const linkClass = cx(
  'inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2.5 text-xs font-medium text-fg shadow-card transition-colors hover:border-accent-line hover:text-accent',
  FOCUS_RING,
);

/** Compact switcher: a select of every deliverable (grouped by programme) and previous / next within the programme. */
export function DeliverableSwitcher({ model }: { model: DeliverableModel }) {
  const router = useRouter();
  const data = useDemoState((s) => s.data);
  const { deliverable, siblings } = model;
  const at = siblings.findIndex((s) => s.id === deliverable.id);
  const prev = at > 0 ? siblings[at - 1] : undefined;
  const next = at >= 0 && at < siblings.length - 1 ? siblings[at + 1] : undefined;
  const groupName = model.programme ? model.programme.title : terms.routes.standalone;

  const groups = new Map<string, { label: string; items: typeof data.deliverables }>();
  for (const d of data.deliverables) {
    const pm = d.pmNodeId ? data.pmNodes.find((n) => n.id === d.pmNodeId) : null;
    let root = pm;
    while (root?.parentId) root = data.pmNodes.find((n) => n.id === root?.parentId) ?? root;
    const key = root?.id ?? 'standalone';
    const g = groups.get(key) ?? { label: root?.title ?? terms.routes.standalone, items: [] };
    g.items.push(d);
    groups.set(key, g);
  }

  return (
    <div className="flex items-center gap-1.5">
      <IconButton
        label={prev ? `Previous in ${groupName}: ${prev.ref}` : `First in ${groupName}`}
        icon={<ChevronLeft />}
        variant="secondary"
        size="sm"
        disabledReason={prev ? undefined : `${deliverable.ref} is the first deliverable in ${groupName}`}
        onClick={() => prev && router.push(hrefs.deliverable(prev.id))}
      />
      <label className="sr-only" htmlFor="deliverable-switcher">
        Switch deliverable
      </label>
      <select
        id="deliverable-switcher"
        value={deliverable.id}
        onChange={(e) => router.push(hrefs.deliverable(e.target.value))}
        className={cx('h-7 max-w-[22rem] rounded-md border border-line-strong bg-surface px-2 text-xs text-fg', FOCUS_RING)}
      >
        {[...groups.entries()].map(([key, g]) => (
          <optgroup key={key} label={g.label}>
            {g.items
              .slice()
              .sort((a, b) => a.ref.localeCompare(b.ref, 'en', { numeric: true }))
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.ref} · {d.title}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
      <IconButton
        label={next ? `Next in ${groupName}: ${next.ref}` : `Last in ${groupName}`}
        icon={<ChevronRight />}
        variant="secondary"
        size="sm"
        disabledReason={next ? undefined : `${deliverable.ref} is the last deliverable in ${groupName}`}
        onClick={() => next && router.push(hrefs.deliverable(next.id))}
      />
      <span className="ml-1 hidden text-xs text-fg-subtle tabular-nums min-[1500px]:inline">
        {at + 1} of {siblings.length} in {groupName}
      </span>
    </div>
  );
}

function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="di-eyebrow">{label}</span>
      <span className="min-w-0 text-[13px] text-fg">{children}</span>
    </div>
  );
}

/** One short explanation per measure, aligned under the triple. */
function MeasureExplanations({ model }: { model: DeliverableModel }) {
  const { measures, deliverable, epics } = model;
  const wc = measures.workCompletion;
  const ao = measures.acceptedOutcomes;
  const r = measures.readiness;
  const heldPassing = r.held.filter((h) => h.state === 'passing').length;
  const tier = terms.riskTiers[r.riskTier];
  const parts = [
    r.failing.length > 0 ? `${r.failing.length} failing` : null,
    r.missing.length > 0 ? `${r.missing.length} missing` : null,
    r.stale.length > 0 ? `${r.stale.length} stale` : null,
    r.blockingDependencyIds.length > 0 ? `${r.blockingDependencyIds.length} critical dependenc${r.blockingDependencyIds.length === 1 ? 'y' : 'ies'} open` : null,
  ].filter(Boolean);
  return (
    <div className="grid grid-cols-1 divide-y divide-line border-t border-line md:grid-cols-3 md:divide-x md:divide-y-0">
      <p className="p-4 text-xs leading-relaxed text-fg-muted">
        <strong className="font-semibold text-fg">How much of the planned work is closed.</strong>{' '}
        {wc.computable
          ? `Closed points over total points across all ${epics.length} ${epics.length === 1 ? 'Epic' : 'Epics'} of ${deliverable.ref}. It says nothing about whether the business has accepted anything.`
          : wc.detail}
      </p>
      <p className="p-4 text-xs leading-relaxed text-fg-muted">
        <strong className="font-semibold text-fg">How much the business has accepted.</strong>{' '}
        {ao.computable
          ? `An outcome counts only when a named human has accepted every mandatory criterion and a business acceptance record exists. Weight accepted: ${ao.value.acceptedWeight} of ${ao.value.totalWeight}.`
          : ao.detail}
      </p>
      <div className="flex items-start justify-between gap-3 p-4">
        <p className="text-xs leading-relaxed text-fg-muted">
          <strong className="font-semibold text-fg">Is there verified evidence it can be released.</strong>{' '}
          {tier} requires {r.requiredEvidence.length} kinds of evidence: {heldPassing} held and passing
          {parts.length > 0 ? `; ${parts.join(', ')}` : ''}. Never a percentage.
        </p>
        <AddToSlides kind="td-readiness" scope={{ kind: 'deliverable', deliverableId: deliverable.id }} label={`the readiness slide for ${deliverable.ref}`} />
      </div>
    </div>
  );
}

export function VerdictHeader({ model }: { model: DeliverableModel }) {
  const { deliverable: d, rag, measures, verdict, programmePath, owner, pod, hubs } = model;
  const ir = useDemoState((s) => s.data.investmentRequests.find((x) => x.id === d.investmentRequestId));
  const evidence = rag?.evidence ?? 'unknown';
  const stage = stageDefinition(d.pdlcStage);
  const standalone = programmePath.length === 0;

  return (
    <section aria-label="Verdict" className="flex min-w-0 flex-col gap-4" data-testid="verdict">
      <div className="di-card flex min-w-0 flex-col">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-line px-5 py-3.5">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
              <span className="font-mono text-[13px] font-semibold text-title">{d.ref}</span>
              <span aria-hidden className="text-line-strong">/</span>
              {ir ? (
                <span className="min-w-0 truncate">
                  {terms.hierarchy.investmentRequest} <span className="font-mono">{ir.ref}</span> · {ir.title}
                </span>
              ) : null}
              <span aria-hidden className="text-line-strong">/</span>
              {standalone ? (
                <Badge tone="accent" size="sm" data-testid="route-marker">
                  {terms.routes.standalone}
                </Badge>
              ) : (
                <span className="min-w-0 truncate" data-testid="programme-path">
                  {programmePath.map((n) => `${terms.pmNodeLevels[n.level]} ${n.title}`).join(' › ')}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1.5">
              <MetaItem label="Owner">{owner ? <AvatarLabel initials={owner.initials} name={owner.name} size="sm" /> : 'Not named'}</MetaItem>
              <MetaItem label="Pod">{pod?.name ?? 'No pod'}</MetaItem>
              <MetaItem label={hubs.length === 1 ? 'Hub' : 'Hubs'}>{hubs.map((h) => h.city).join(', ') || 'None'}</MetaItem>
              <MetaItem label={terms.app.lifecycleShort + ' stage'}>
                <Link href={hrefs.workflow(d.id)} className={cx('rounded-xs hover:text-accent', FOCUS_RING)}>
                  {stage.order}. {stage.name}
                </Link>
              </MetaItem>
              <MetaItem label="Risk tier">{terms.riskTiers[d.riskTier]}</MetaItem>
              <MetaItem label="Planned">
                {formatDate(d.plannedStart, { withYear: false })} to {formatDate(d.plannedEnd)}
              </MetaItem>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AddToSlides kind="td-verdict" scope={{ kind: 'deliverable', deliverableId: d.id }} label={`the verdict slide for ${d.ref}`} />
            <ExportPack text scope={{ kind: 'deliverable', deliverableId: d.id }} />
            <Link href={hrefs.workflow(d.id)} className={linkClass} data-testid="link-workflow">
              <Workflow aria-hidden className="size-3.5" />
              Workflow
            </Link>
            <Link href="/plan/" className={linkClass}>
              <CalendarRange aria-hidden className="size-3.5" />
              Plan
            </Link>
            {d.id === HERO_DELIVERABLE_ID ? (
              <Link href="/global/#hero" className={linkClass}>
                <Globe2 aria-hidden className="size-3.5" />
                Global map
              </Link>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-x-8 gap-y-3 px-5 py-4 lg:grid-cols-[auto_1fr] lg:items-center">
          <div className="flex items-stretch gap-3" data-testid="rag-pair">
            <div className="flex flex-col gap-1.5">
              <span className="di-eyebrow">{terms.ragKinds.reported}</span>
              <RagPill status={d.reportedRag} size="lg" className="px-3 text-[15px]" />
              <span className="text-[11px] text-fg-subtle">{terms.systems['portfolio-system']}, {formatDate(d.reportedAt, { withYear: false })}</span>
            </div>
            <div aria-hidden className="flex items-center text-fg-subtle">
              {verdict.disagrees ? <GitCompareArrows className="size-5 text-status-amber" /> : <ArrowRight className="size-4" />}
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="di-eyebrow">{terms.ragKinds.evidence}</span>
              <RagPill status={evidence} size="lg" className="px-3 text-[15px]" />
              <span className="text-[11px] text-fg-subtle">Computed from the records below</span>
            </div>
          </div>
          <div
            className={cx(
              'rounded-md border px-4 py-3',
              verdict.disagrees ? 'border-status-amber-line bg-status-amber-soft' : 'border-line bg-surface-2',
            )}
          >
            <p data-testid="verdict-sentence" className="font-display text-[16px] leading-snug font-medium text-fg">
              {verdict.sentence}
            </p>
            <DemoNote as="p" className="mt-1 text-[11px] text-fg-subtle">
              <ProvenanceBadges kinds={['computed']} size="sm" /> {verdict.disagrees ? 'The portfolio-system status is not changed by this view.' : null}
            </DemoNote>
          </div>
        </div>
      </div>

      <div className="di-card flex flex-col overflow-hidden">
        <MeasureTriple
          bare
          workCompletion={measures.workCompletion}
          acceptedOutcomes={measures.acceptedOutcomes}
          readiness={measures.readiness}
          plannedPercent={model.plannedPercent ?? undefined}
        />
        <MeasureExplanations model={model} />
        {measures.readiness.reasons.length > 0 || measures.readiness.state !== 'ready' ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line bg-surface-2 px-5 py-2.5 text-xs" data-testid="readiness-reasons">
            <span className="inline-flex items-center gap-2 font-semibold text-fg">
              <ReadinessPill state={measures.readiness.state} size="sm" /> because
            </span>
            {measures.readiness.reasons.map((reason) => (
              <span key={reason.code} className="inline-flex min-w-0 flex-wrap items-center gap-1.5 text-fg-muted">
                {reason.message}
                {reason.refs.slice(0, 2).map((ref) => (
                  <RecordChip key={`${ref.kind}:${ref.id}`} to={ref} />
                ))}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
