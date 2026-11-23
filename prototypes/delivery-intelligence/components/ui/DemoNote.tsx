import type { ElementType, HTMLAttributes } from 'react';

type DemoNoteProps = HTMLAttributes<HTMLElement> & {
  /** Element to render; defaults to `span`. Use the element the note already was (`p`, `div`). */
  as?: ElementType;
  'data-testid'?: string;
};

/**
 * Wraps an explanatory demo note, disclaimer or keyboard-hint line. The labels
 * toggle in the top bar hides everything with this class (`[data-labels="off"]`
 * in app/globals.css). Do not use it for content: figures, status, section
 * descriptions and the sidebar "Synthetic data" line must stay visible.
 *
 *   <DemoNote as="p" className="text-xs text-fg-muted">Nothing is executed.</DemoNote>
 */
export function DemoNote({ as: Tag = 'span', className, children, ...rest }: DemoNoteProps) {
  return (
    <Tag {...rest} className={className ? `di-demo-note ${className}` : 'di-demo-note'}>
      {children}
    </Tag>
  );
}
