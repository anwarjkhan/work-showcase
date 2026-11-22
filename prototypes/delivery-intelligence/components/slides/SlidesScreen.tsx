'use client';
/**
 * Slide builder, `/slides`.
 *
 * Choose a scope (type, then a record, with search), then either a pack or a
 * hand-picked list of slides, set options, check the live preview and export.
 * The same screen shows the basket's slides when opened with `#basket`.
 *
 * Hashes (read on load and on change): `#scope=deliverable:td-1001`,
 * `#scope=pm-node:<id>&pack=programme`, `#basket`.
 */
import { FileDown } from 'lucide-react';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { Badge, Button, Card, Chip, EmptyState, Section } from '@/components/ui';
import { cx, FOCUS_RING } from '@/components/ui/cx';
import { availableKinds, buildDeck, buildPackDeck, buildSlides, CATALOGUE, defaultPackFor, footerText, PACKS, packsFor, parseScopeKey, scopeKey, scopeLabel } from '@/lib/slides';
import type { DeckSpec, PackId, PackOptions, SlideKind, SlideScope } from '@/lib/slides';
import { DeckPreviewGrid } from '@/lib/slides/render/html';
import { moveInBasket, removeFromBasket, useBasket } from './basket';
import { entityOptions, parseHash, SCOPE_TYPES, scopeTypeOf, type BuildMode, type ScopeType } from './builder-model';
import { EntityPicker } from './EntityPicker';
import { ExportStatus } from './ExportStatus';
import { OrderList } from './OrderList';
import { PackOptionsForm, toPackOptions } from './PackOptionsForm';
import { useExport } from './useExport';
import { useSlideContext } from './useSlideContext';

const subscribeHash = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};
const readHash = () => window.location.hash;
const serverHash = () => '';

interface Choice {
  mode: BuildMode;
  scope: SlideScope;
  type: ScopeType;
  pack: PackId;
  picked: SlideKind[];
  problem: string | null;
}

const field = cx('h-9 rounded-md border border-line-strong bg-surface px-3 text-[13px] text-fg placeholder:text-fg-subtle', FOCUS_RING);

export function SlidesScreen() {
  const ctx = useSlideContext();
  const { data } = ctx;
  const basket = useBasket();
  const hash = useSyncExternalStore(subscribeHash, readHash, serverHash);
  const exp = useExport();

  const [choice, setChoice] = useState<Choice>({ mode: 'pack', scope: { kind: 'portfolio' }, type: 'portfolio', pack: 'portfolio', picked: [], problem: null });
  const [applied, setApplied] = useState<string | null>(null);
  const [options, setOptions] = useState<PackOptions>({});
  const [name, setName] = useState('');

  // Apply the URL hash on load and whenever it changes (derived during render, as the agent screen does).
  if (applied !== hash) {
    setApplied(hash);
    const t = parseHash(hash);
    if (t.basket) {
      setChoice((c) => ({ ...c, mode: 'basket', problem: null }));
    } else if (t.scope) {
      const exists =
        t.scope.kind === 'portfolio' ||
        (t.scope.kind === 'pm-node' && data.pmNodes.some((n) => n.id === (t.scope as { pmNodeId: string }).pmNodeId)) ||
        (t.scope.kind === 'deliverable' && data.deliverables.some((d) => d.id === (t.scope as { deliverableId: string }).deliverableId)) ||
        (t.scope.kind === 'outcome' && data.outcomes.some((o) => o.id === (t.scope as { outcomeId: string }).outcomeId));
      if (exists) {
        const accepted = packsFor(t.scope, ctx);
        const pack = t.pack && accepted.includes(t.pack) ? t.pack : defaultPackFor(t.scope, ctx);
        setChoice({ mode: 'pack', scope: t.scope, type: scopeTypeOf(t.scope, data), pack, picked: [], problem: t.pack && !accepted.includes(t.pack) ? `The ${PACKS[t.pack].title.toLowerCase()} does not take this scope; showing the ${PACKS[pack].title.toLowerCase()}.` : null });
      } else {
        setChoice((c) => ({ ...c, problem: `Nothing in the current data matches “${scopeKey(t.scope as SlideScope)}”.` }));
      }
    }
  }

  const types = SCOPE_TYPES;
  const options_ = useMemo(() => entityOptions(data, choice.type), [data, choice.type]);
  const chosenKey = scopeKey(choice.scope);
  const packs = packsFor(choice.scope, ctx);
  const kinds = availableKinds(choice.scope);

  const selectType = (type: ScopeType) => {
    if (type === choice.type) return;
    const first = entityOptions(data, type)[0];
    const next = type === 'portfolio' ? ({ kind: 'portfolio' } as SlideScope) : null;
    setChoice((c) => ({ ...c, type, scope: next ?? c.scope, picked: [], problem: null, mode: c.mode === 'basket' ? 'pack' : c.mode }));
    if (!next && first) selectEntity(first.key, type);
  };
  const selectEntity = (key: string, type: ScopeType = choice.type) => {
    const scope = parseScopeKey(key);
    if (!scope) return;
    setChoice((c) => ({ ...c, type, scope, pack: defaultPackFor(scope, ctx), picked: [], problem: null, mode: c.mode === 'basket' ? 'pack' : c.mode }));
  };

  const built = useMemo<{ deck: DeckSpec | null; error: string | null }>(() => {
    try {
      let deck: DeckSpec;
      if (choice.mode === 'basket') {
        const slides = basket.items.flatMap((i) => buildSlides(i.scope, [i.kind], ctx));
        deck = buildDeck(slides, ctx);
      } else if (choice.mode === 'pick') {
        deck = buildDeck(buildSlides(choice.scope, choice.picked, ctx), ctx, { scope: choice.scope });
      } else {
        deck = buildPackDeck(choice.pack, choice.scope, toPackOptions(options, choice.pack), ctx);
      }
      return { deck: name.trim() ? { ...deck, title: name.trim() } : deck, error: null };
    } catch (e) {
      return { deck: null, error: e instanceof Error ? e.message : 'The slides could not be built.' };
    }
  }, [choice, options, basket.items, ctx, name]);
  const deck = built.deck;
  const empty = !deck || deck.slides.length === 0;

  const togglePick = (kind: SlideKind) =>
    setChoice((c) => ({ ...c, picked: c.picked.includes(kind) ? c.picked.filter((k) => k !== kind) : [...c.picked, kind] }));
  const movePick = (id: string, delta: -1 | 1) =>
    setChoice((c) => {
      const from = c.picked.indexOf(id as SlideKind);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= c.picked.length) return c;
      const next = [...c.picked];
      const [k] = next.splice(from, 1);
      if (k) next.splice(to, 0, k);
      return { ...c, picked: next };
    });

  const modeChips: { id: BuildMode; label: string; extra?: string }[] = [
    { id: 'pack', label: 'Pack' },
    { id: 'pick', label: 'Pick slides' },
    { id: 'basket', label: 'Basket', extra: String(basket.items.length) },
  ];

  return (
    <div className="flex flex-col gap-8" data-testid="slides-screen">
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <Section title="What to build" description="Slides are built from the same data and results the screens show, as editable PowerPoint.">
          <div className="flex min-w-0 flex-col gap-4">
            <div role="group" aria-label="Build from" className="flex flex-wrap items-center gap-1.5">
              {modeChips.map((m) => (
                <Chip key={m.id} selected={choice.mode === m.id} onClick={() => setChoice((c) => ({ ...c, mode: m.id }))} data-testid={`mode-${m.id}`}>
                  {m.label}
                  {m.extra ? <span className="ml-1 text-fg-subtle tabular-nums">{m.extra}</span> : null}
                </Chip>
              ))}
            </div>

            {choice.problem ? (
              <p role="alert" data-testid="builder-problem" className="rounded-md border border-status-amber-line bg-status-amber-soft px-3 py-2 text-[13px] text-status-amber-fg">
                {choice.problem}
              </p>
            ) : null}

            {choice.mode === 'basket' ? (
              <Card padding="sm" level={3} title="Slides in your basket" description="Collected with the slides button on each screen. Order here is the order in the file.">
                {basket.items.length === 0 ? (
                  <p className="text-[13px] text-fg-muted">The basket is empty. Add slides from the screens, or choose a pack.</p>
                ) : (
                  <OrderList
                    label="Basket order"
                    items={basket.items.map((i) => ({ id: i.id, label: `${CATALOGUE[i.kind].title} · ${scopeLabel(i.scope, ctx)}` }))}
                    onMove={moveInBasket}
                    onRemove={removeFromBasket}
                  />
                )}
              </Card>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <div role="group" aria-label="Scope type" className="flex flex-wrap items-center gap-1.5">
                    {types.map((t) => (
                      <Chip key={t.id} selected={choice.type === t.id} onClick={() => selectType(t.id)} data-testid={`scope-type-${t.id}`}>
                        {t.label}
                      </Chip>
                    ))}
                  </div>
                  {choice.type !== 'portfolio' ? (
                    <EntityPicker options={options_} value={chosenKey} onChange={(k) => selectEntity(k)} label={types.find((t) => t.id === choice.type)?.noun ?? 'records'} />
                  ) : null}
                </div>

                {choice.mode === 'pack' ? (
                  <div className="flex flex-col gap-3">
                    <div role="group" aria-label="Pack" className="flex flex-wrap gap-1.5">
                      {packs.map((p) => (
                        <Chip key={p} selected={choice.pack === p} onClick={() => setChoice((c) => ({ ...c, pack: p }))} data-testid={`pack-${p}`}>
                          {PACKS[p].title}
                        </Chip>
                      ))}
                    </div>
                    <PackOptionsForm packId={choice.pack} value={options} onChange={setOptions} />
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <ul aria-label="Slides this scope can show" className="m-0 flex list-none flex-col gap-1 p-0" data-testid="kind-list">
                      {kinds.map((k) => {
                        const on = choice.picked.includes(k);
                        return (
                          <li key={k}>
                            <label className="flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 hover:bg-hover">
                              <input type="checkbox" checked={on} onChange={() => togglePick(k)} data-testid={`pick-${k}`} className={cx('mt-0.5 size-4 shrink-0 accent-[var(--di-accent)]', FOCUS_RING)} />
                              <span className="text-[13px] text-fg">
                                {CATALOGUE[k].title}
                                <span className="block text-xs text-fg-muted">{CATALOGUE[k].description}</span>
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                    {choice.picked.length > 1 ? (
                      <div className="flex flex-col gap-1.5">
                        <span className="di-eyebrow">Order in the file</span>
                        <OrderList
                          label="Picked slide order"
                          items={choice.picked.map((k) => ({ id: k, label: CATALOGUE[k].title }))}
                          onMove={movePick}
                          onRemove={(id) => togglePick(id as SlideKind)}
                        />
                      </div>
                    ) : null}
                  </div>
                )}
              </>
            )}

            <div className="flex flex-col gap-1">
              <label htmlFor="deck-name" className="di-eyebrow">Deck name (optional)</label>
              <input id="deck-name" data-testid="deck-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={deck?.title ?? 'Deck name'} className={field} />
            </div>
          </div>
        </Section>

        <Section
          title="Preview"
          description={deck ? `${deck.slides.length} ${deck.slides.length === 1 ? 'slide' : 'slides'} · ${deck.fileName}` : undefined}
          actions={
            <div className="flex items-center gap-3">
              <Badge tone="neutral" size="sm">Editable in PowerPoint</Badge>
              <Button
                variant="primary"
                icon={<FileDown />}
                disabled={empty}
                loading={exp.state.phase === 'busy'}
                data-testid="builder-export"
                onClick={() => deck && exp.run(() => deck)}
              >
                Export .pptx
              </Button>
            </div>
          }
        >
          <div className="flex min-w-0 flex-col gap-4">
            <ExportStatus state={exp.state} />
            {built.error ? (
              <p role="alert" data-testid="builder-error" className="rounded-md border border-status-red-line bg-status-red-soft px-3 py-2 text-[13px] text-status-red-fg">{built.error}</p>
            ) : null}
            {deck && deck.slides.length > 0 ? (
              <>
                <p className="text-xs text-fg-muted" data-testid="builder-footer-text">
                  Every slide is printed with: {footerText(ctx)}
                </p>
                <div data-testid="deck-preview">
                  <DeckPreviewGrid deck={deck} />
                </div>
              </>
            ) : !built.error ? (
              <EmptyState title="Nothing to preview yet" description={choice.mode === 'pick' ? 'Tick one or more slides on the left.' : choice.mode === 'basket' ? 'Add slides to the basket from any screen.' : 'Choose a scope and a pack.'} />
            ) : null}
          </div>
        </Section>
      </div>
    </div>
  );
}
