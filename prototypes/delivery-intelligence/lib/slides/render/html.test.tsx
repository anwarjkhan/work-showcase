// @vitest-environment jsdom
/**
 * HTML preview: every layout and block from the fixture deck renders, each
 * slide is labelled with its title, status is drawn with glyph and word, and
 * the preview keeps the fixed 16:9 box without fixed pixel widths by default.
 */
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FIXTURE_DECK } from './fixtures';
import { DeckPreviewGrid, SlidePreview } from './html';

afterEach(cleanup);

describe('SlidePreview', () => {
  it('renders every fixture slide with an accessible label', () => {
    render(<DeckPreviewGrid deck={FIXTURE_DECK} />);
    const slides = screen.getAllByRole('group');
    expect(slides).toHaveLength(FIXTURE_DECK.slides.length);
    FIXTURE_DECK.slides.forEach((spec, i) => {
      expect(slides[i]!.getAttribute('aria-label')).toBe(`Slide ${i + 1}: ${spec.title}`);
      expect(within(slides[i]!).getByText(FIXTURE_DECK.footer.text)).toBeTruthy();
    });
  });

  it('draws status with glyph and word and keeps measures separate', () => {
    render(<SlidePreview spec={FIXTURE_DECK.slides[2]!} footer={FIXTURE_DECK.footer} number={3} />);
    const slide = screen.getByRole('group');
    expect(within(slide).getByText('● Green')).toBeTruthy();
    expect(within(slide).getByText('■ Red')).toBeTruthy();
    expect(within(slide).getByText('■ Not ready')).toBeTruthy();
    expect(within(slide).getByText('82%')).toBeTruthy();
    expect(within(slide).getByText('1 of 4')).toBeTruthy();
    expect(slide.textContent).not.toMatch(/Not ready\s*\d+%/);
  });

  it('renders tables with header cells, charts and timelines as labelled images', () => {
    render(<DeckPreviewGrid deck={FIXTURE_DECK} />);
    expect(screen.getAllByRole('columnheader').length).toBeGreaterThan(8);
    expect(screen.getAllByRole('img', { name: /^Chart:/ })).toHaveLength(2);
    expect(screen.getAllByRole('img', { name: /^Timeline:/ })).toHaveLength(2);
    expect(screen.getAllByText('REG', { exact: false }).length).toBeGreaterThan(0);
  });

  it('fills its container by default and never exceeds it when scaled', () => {
    const { container, rerender } = render(<SlidePreview spec={FIXTURE_DECK.slides[0]!} footer={FIXTURE_DECK.footer} />);
    const outer = container.firstElementChild as HTMLElement;
    expect(outer.style.width).toBe('100%');
    rerender(<SlidePreview spec={FIXTURE_DECK.slides[0]!} footer={FIXTURE_DECK.footer} scale={0.5} />);
    expect(outer.style.width).toBe('480px');
    expect(outer.style.maxWidth).toBe('100%');
  });
});
