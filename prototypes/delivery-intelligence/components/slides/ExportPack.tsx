'use client';
import { FileDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, IconButton } from '@/components/ui';
import { buildPackDeck, defaultPackFor, PACKS, scopeLabel } from '@/lib/slides';
import type { DeckSpec, PackId, PackOptions, SlideScope } from '@/lib/slides';
import { DeckPreviewGrid } from '@/lib/slides/render/html';
import { Dialog } from './Dialog';
import { ExportStatus } from './ExportStatus';
import { PackOptionsForm, toPackOptions } from './PackOptionsForm';
import { SlideViewer } from './SlideViewer';
import { useExport } from './useExport';
import { useSlideContext } from './useSlideContext';

export interface ExportPackProps {
  scope: SlideScope;
  /** Defaults to the scope's own pack (`defaultPackFor`). */
  packId?: PackId;
  /** Names the button for assistive technology and in the dialog. */
  label?: string;
  /** Text button with the pack name instead of an icon button. */
  text?: boolean;
  /** Use -1 inside tree rows, whose own arrow-key handling owns focus. */
  tabIndex?: number;
}

/** Pack for scopes whose pack does not depend on data; programme and project nodes are resolved in the dialog. */
const KIND_PACK = { portfolio: 'portfolio', deliverable: 'deliverable', outcome: 'outcome' } as const;

/**
 * "Export pack" button. Opens a small dialog with the pack's options and an
 * Export button; the dialog reports the saved file name and slide count.
 * The store is read only while the dialog is open, so the button is cheap.
 */
export function ExportPack({ scope, packId, label, text, tabIndex }: ExportPackProps) {
  const [open, setOpen] = useState(false);
  const known = packId ?? (scope.kind === 'pm-node' ? undefined : KIND_PACK[scope.kind]);
  const name = label ?? (known ? PACKS[known].title : 'pack');
  const onOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(true);
  };
  return (
    <>
      {text ? (
        <Button size="sm" variant="secondary" icon={<FileDown />} tabIndex={tabIndex} data-testid="export-pack" data-pack={known} onClick={onOpen}>
          Export pack
        </Button>
      ) : (
        <IconButton label={`Export ${name}`} icon={<FileDown />} variant="secondary" size="sm" tabIndex={tabIndex} data-testid="export-pack" data-pack={known} onClick={onOpen} />
      )}
      {open ? <PackDialog scope={scope} packId={packId} label={label} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function PackDialog({ scope, packId, label, onClose }: { scope: SlideScope; packId?: PackId; label?: string; onClose: () => void }) {
  const ctx = useSlideContext();
  const [options, setOptions] = useState<PackOptions>({});
  const exp = useExport();
  const pack = packId ?? defaultPackFor(scope, ctx);
  const [viewing, setViewing] = useState<number | null>(null);
  // Built live, so the preview follows the options (and the store) as they change.
  const preview = useMemo<{ deck?: DeckSpec; error?: string }>(() => {
    try {
      return { deck: buildPackDeck(pack, scope, toPackOptions(options, pack), ctx) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'The preview could not be built.' };
    }
  }, [pack, scope, options, ctx]);
  let subject = '';
  try {
    subject = scopeLabel(scope, ctx);
  } catch {
    subject = '';
  }
  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={label ?? PACKS[pack].title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button
            variant="primary"
            icon={<FileDown />}
            loading={exp.state.phase === 'busy'}
            data-testid="export-pack-go"
            data-autofocus
            onClick={() => exp.run(() => preview.deck ?? buildPackDeck(pack, scope, toPackOptions(options, pack), ctx))}
          >
            Export .pptx
          </Button>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-[240px_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          {subject ? <p className="text-[13px] text-fg-muted">{subject}</p> : null}
          <PackOptionsForm packId={pack} value={options} onChange={setOptions} />
          <ExportStatus state={exp.state} />
        </div>
        <div className="flex min-w-0 flex-col gap-2" data-testid="pack-preview">
          <p className="di-eyebrow">
            {preview.deck ? `Preview · ${preview.deck.slides.length} ${preview.deck.slides.length === 1 ? 'slide' : 'slides'}` : 'Preview'}
          </p>
          {preview.deck ? (
            <>
              <DeckPreviewGrid deck={preview.deck} minThumbWidth={170} onOpen={setViewing} />
              <SlideViewer deck={preview.deck} index={viewing} onIndex={setViewing} />
            </>
          ) : (
            <p role="alert" className="text-[13px] text-status-red-fg">{preview.error}</p>
          )}
        </div>
      </div>
    </Dialog>
  );
}
