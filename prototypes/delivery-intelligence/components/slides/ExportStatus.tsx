'use client';
import { CircleAlert, CircleCheck, LoaderCircle } from 'lucide-react';
import type { ExportState } from './useExport';

/** Result line for an export: a polite live region, so the outcome is announced. */
export function ExportStatus({ state }: { state: ExportState }) {
  return (
    <div role="status" aria-live="polite" data-testid="export-status" data-phase={state.phase} className="text-[13px]">
      {state.phase === 'busy' ? (
        <p className="flex items-center gap-2 text-fg-muted">
          <LoaderCircle aria-hidden className="size-4 animate-spin" /> Generating the file…
        </p>
      ) : null}
      {state.phase === 'done' ? (
        <div className="flex flex-col gap-1">
          <p className="flex items-center gap-2 font-medium text-status-green-fg">
            <CircleCheck aria-hidden className="size-4 shrink-0" />
            <span data-testid="export-done">{`Saved ${state.fileName} · ${state.slideCount} slides`}</span>
          </p>
          {state.warnings.length > 0 ? (
            <ul className="m-0 list-none p-0 text-xs text-fg-subtle" aria-label="Export notes">
              {state.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {state.phase === 'failed' ? (
        <p className="flex items-start gap-2 font-medium text-status-red-fg" role="alert">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{`The file was not saved: ${state.reason}`}</span>
        </p>
      ) : null}
    </div>
  );
}
