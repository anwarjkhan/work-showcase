// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DemoNote } from '@/components/ui';
import { ProvenanceBadge, ProvenanceBadges } from './ProvenanceBadge';
import { LABELS_STORAGE_KEY, THEME_INIT_SCRIPT } from './theme-script';

afterEach(cleanup);

describe('demo label classes', () => {
  it('ProvenanceBadge and ProvenanceBadges carry di-demo-label', () => {
    const { container } = render(
      <>
        <ProvenanceBadge kind="computed" />
        <ProvenanceBadges kinds={['sample', 'simulated']} />
      </>,
    );
    const labelled = container.querySelectorAll('.di-demo-label');
    // one badge, one badge row, two badges inside the row
    expect(labelled.length).toBe(4);
    expect(container.querySelector('[data-provenance="computed"]')?.classList.contains('di-demo-label')).toBe(true);
  });

  it('DemoNote renders its children with di-demo-note, keeping element, class and attributes', () => {
    const { container } = render(
      <DemoNote as="p" className="text-xs" data-testid="n">
        Nothing is executed.
      </DemoNote>,
    );
    const el = container.querySelector('p');
    expect(el?.textContent).toBe('Nothing is executed.');
    expect(el?.classList.contains('di-demo-note')).toBe(true);
    expect(el?.classList.contains('text-xs')).toBe(true);
    expect(el?.getAttribute('data-testid')).toBe('n');
    expect(render(<DemoNote>x</DemoNote>).container.querySelector('span.di-demo-note')).not.toBeNull();
  });
});

describe('pre-paint script', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-labels');
    document.documentElement.removeAttribute('data-theme');
    window.matchMedia = ((q: string) => ({ matches: false, media: q })) as unknown as typeof window.matchMedia;
  });
  const run = () => new Function(THEME_INIT_SCRIPT)();

  it('defaults data-labels to on', () => {
    run();
    expect(document.documentElement.getAttribute('data-labels')).toBe('on');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
  it('applies a stored off value and ignores anything else', () => {
    localStorage.setItem(LABELS_STORAGE_KEY, 'off');
    run();
    expect(document.documentElement.getAttribute('data-labels')).toBe('off');
    localStorage.setItem(LABELS_STORAGE_KEY, 'bogus');
    run();
    expect(document.documentElement.getAttribute('data-labels')).toBe('on');
  });
  it('falls back to on when storage throws', () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error('blocked');
    };
    try {
      run();
    } finally {
      Storage.prototype.getItem = original;
    }
    expect(document.documentElement.getAttribute('data-labels')).toBe('on');
  });
});
