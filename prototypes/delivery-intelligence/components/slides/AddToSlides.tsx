'use client';
import { Check, Presentation } from 'lucide-react';
import { IconButton, type ButtonSize } from '@/components/ui';
import { CATALOGUE, scopeKey } from '@/lib/slides';
import type { SlideKind, SlideScope } from '@/lib/slides';
import { addToBasket, itemId, useBasket } from './basket';

export interface AddToSlidesProps {
  kind: SlideKind;
  scope: SlideScope;
  /** What the button names for assistive technology; defaults to the catalogue title of the slide. */
  label?: string;
  size?: ButtonSize;
  /** Use -1 inside tree rows, whose own arrow-key handling owns focus. */
  tabIndex?: number;
}

/**
 * Small icon button that adds one slide to the basket and announces
 * "Added to slides (n)". Shows a check once that slide is already in the basket.
 *
 *   <AddToSlides kind="td-verdict" scope={{ kind: 'deliverable', deliverableId }} />
 */
export function AddToSlides({ kind, scope, label, size = 'sm', tabIndex }: AddToSlidesProps) {
  const { items } = useBasket();
  const added = items.some((i) => i.id === itemId(kind, scope));
  const name = label ?? `the ${CATALOGUE[kind].title} slide`;
  return (
    <IconButton
      label={added ? `In slides: ${name}` : `Add ${name} to slides`}
      icon={added ? <Check className="text-status-green" /> : <Presentation />}
      variant="secondary"
      size={size}
      tabIndex={tabIndex}
      data-testid="add-to-slides"
      data-slide-kind={kind}
      data-slide-scope={scopeKey(scope)}
      data-added={added || undefined}
      onClick={(e) => {
        e.stopPropagation();
        addToBasket(kind, scope);
      }}
    />
  );
}
