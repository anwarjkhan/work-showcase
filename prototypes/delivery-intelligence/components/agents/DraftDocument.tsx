'use client';

import { Quote } from 'lucide-react';
import { ProvenanceBadge } from '@/components/shell';
import { formatDate } from '@/lib/config/clock';
import type { StatusDraft } from '@/lib/types';
import { useOpenRefs } from './RefPanel';

/**
 * A scripted draft rendered as a document. Every sentence ends with a numbered
 * citation marker; activating it opens the cited records in the side panel.
 */
export function DraftDocument({ draft }: { draft: StatusDraft }) {
  const open = useOpenRefs();
  let n = 0;
  const total = draft.sections.reduce((s, x) => s + x.sentences.length, 0);
  return (
    <article className="rounded-md border border-line bg-surface shadow-card" data-testid="draft-document" aria-label={draft.title}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <div className="di-eyebrow mb-1 flex items-center gap-1.5">
            <Quote aria-hidden className="size-3" /> Draft · {formatDate(draft.generatedAt)}
          </div>
          <h4 className="font-display text-[15px] leading-snug font-semibold text-title">{draft.title}</h4>
          <p className="mt-1 text-xs text-fg-muted tabular-nums">
            {total} sentences, each citing the records it rests on. Select a marker to open them.
          </p>
        </div>
        <ProvenanceBadge kind="scripted-agent" size="sm" />
      </header>
      <div className="flex flex-col gap-4 px-5 py-4">
        {draft.sections.map((section, si) => (
          <section key={`${section.heading}-${si}`} className="flex flex-col gap-1.5">
            <h5 className="text-[12px] font-semibold tracking-wide text-heading uppercase">{section.heading}</h5>
            <p className="text-[13.5px] leading-[1.7] text-fg">
              {section.sentences.map((s) => {
                n += 1;
                const num = n;
                return (
                  <span key={s.id}>
                    {s.text}
                    <button
                      type="button"
                      onClick={() => open({ refs: s.citations, title: `Citation ${num}`, quote: s.text })}
                      aria-label={`Citation ${num}: ${s.citations.length} record${s.citations.length === 1 ? '' : 's'}`}
                      data-testid="citation-marker"
                      className="ml-0.5 inline-flex h-4 min-w-4 -translate-y-1.5 items-center justify-center rounded-xs border border-accent-line bg-accent-soft px-1 align-baseline font-mono text-[9.5px] leading-none font-semibold text-accent transition-colors hover:bg-accent hover:text-on-accent focus-visible:shadow-focus focus-visible:outline-none"
                    >
                      {num}
                    </button>{' '}
                  </span>
                );
              })}
            </p>
          </section>
        ))}
      </div>
    </article>
  );
}
