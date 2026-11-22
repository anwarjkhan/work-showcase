'use client';
/** The options a pack understands, as plain form controls. Which ones show depends on the pack. */
import { useId } from 'react';
import { cx, FOCUS_RING } from '@/components/ui/cx';
import { PACKS } from '@/lib/slides';
import type { PackId, PackOptions } from '@/lib/slides';

/** The defaults the pack builders assume, written out so the form shows them. */
export const DEFAULT_OPTIONS: Required<PackOptions> = { includeOutcomeSummaries: false, includeAgentNarrative: true, appendVerdicts: 'none', topN: 0 };

/** Form state to builder options: `topN` 0 means no cap. */
export function toPackOptions(o: PackOptions, packId: PackId): PackOptions {
  const out: PackOptions = {};
  if (packId === 'deliverable') out.includeOutcomeSummaries = o.includeOutcomeSummaries ?? false;
  if (packId === 'deliverable' || packId === 'portfolio') out.includeAgentNarrative = o.includeAgentNarrative !== false;
  if (packId === 'project' || packId === 'programme') out.appendVerdicts = o.appendVerdicts ?? 'none';
  if ((packId === 'project' || packId === 'programme' || packId === 'portfolio') && o.topN) out.topN = o.topN;
  return out;
}

const fieldClass = cx('h-8 rounded-md border border-line-strong bg-surface px-2 text-[13px] text-fg', FOCUS_RING);

function Check({ label, hint, checked, onChange, testId }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; testId?: string }) {
  const id = useId();
  return (
    <div className="flex items-start gap-2.5">
      <input id={id} data-testid={testId} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className={cx('mt-0.5 size-4 shrink-0 accent-[var(--di-accent)]', FOCUS_RING)} />
      <label htmlFor={id} className="text-[13px] text-fg">
        {label}
        {hint ? <span className="block text-xs text-fg-muted">{hint}</span> : null}
      </label>
    </div>
  );
}

export function PackOptionsForm({ packId, value, onChange }: { packId: PackId; value: PackOptions; onChange: (next: PackOptions) => void }) {
  const verdictId = useId();
  const topId = useId();
  const v = { ...DEFAULT_OPTIONS, ...value };
  const set = (patch: PackOptions) => onChange({ ...value, ...patch });
  const showNarrative = packId === 'deliverable' || packId === 'portfolio';
  const showVerdicts = packId === 'project' || packId === 'programme';
  const showTop = showVerdicts || packId === 'portfolio';
  if (!showNarrative && !showVerdicts && !showTop) {
    return <p className="text-[13px] text-fg-muted">The {PACKS[packId].title.toLowerCase()} has no options.</p>;
  }
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
      <legend className="sr-only">{PACKS[packId].title} options</legend>
      {packId === 'deliverable' ? (
        <Check testId="opt-outcome-summaries" label="Add an outcome summary slide for each outcome" checked={v.includeOutcomeSummaries} onChange={(x) => set({ includeOutcomeSummaries: x })} />
      ) : null}
      {showNarrative ? (
        <Check
          testId="opt-narrative"
          label="Include the scripted agent narrative"
          hint="Shown on the slide as a scripted agent draft. Leave it out to keep the pack to recorded facts."
          checked={v.includeAgentNarrative}
          onChange={(x) => set({ includeAgentNarrative: x })}
        />
      ) : null}
      {showVerdicts ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={verdictId} className="text-[13px] text-fg">Append a verdict slide for</label>
          <select id={verdictId} data-testid="opt-verdicts" value={v.appendVerdicts} onChange={(e) => set({ appendVerdicts: e.target.value as PackOptions['appendVerdicts'] })} className={fieldClass}>
            <option value="none">No deliverables</option>
            <option value="disagreeing">Deliverables whose evidence disagrees with the reported status</option>
            <option value="all">Every deliverable</option>
          </select>
        </div>
      ) : null}
      {showTop ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={topId} className="text-[13px] text-fg">Table rows per table</label>
          <select id={topId} data-testid="opt-topn" value={v.topN} onChange={(e) => set({ topN: Number(e.target.value) })} className={fieldClass}>
            <option value={0}>All rows</option>
            {[5, 10, 20].map((n) => (
              <option key={n} value={n}>{`Top ${n}`}</option>
            ))}
          </select>
        </div>
      ) : null}
    </fieldset>
  );
}
