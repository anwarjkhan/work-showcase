import type { ElementType, ReactNode } from 'react';
import { cx } from './cx';

type HeadingLevel = 2 | 3 | 4;

export interface CardProps {
  /** Small uppercase label above the title. */
  eyebrow?: ReactNode;
  title?: ReactNode;
  /** Supporting sentence under the title. */
  description?: ReactNode;
  /** Right side of the header: buttons, badges, a tab strip. */
  actions?: ReactNode;
  /** Bottom strip separated by a rule: totals, links, provenance. */
  footer?: ReactNode;
  /** The footer holds only provenance badges or demo notes: hide the whole strip when labels are off. */
  footerLabel?: boolean;
  children?: ReactNode;
  /** Heading level for the title. Pages start at h2 sections, so cards default to h3. */
  level?: HeadingLevel;
  /** `md` 20px, `sm` 16px, `none` for tables and charts that run edge to edge. */
  padding?: 'md' | 'sm' | 'none';
  /** Highlights the card with an accent outline (selected state). */
  selected?: boolean;
  className?: string;
  bodyClassName?: string;
  id?: string;
  'data-testid'?: string;
}

const PAD = { md: 'px-5', sm: 'px-4', none: '' } as const;
const PAD_Y = { md: 'py-5', sm: 'py-4', none: '' } as const;

/**
 * Thin outlined surface. The default container for everything on a screen.
 * No outer margin: space cards with `gap` on the parent.
 *
 *   <Card eyebrow="Readiness" title="Evidence held" actions={<Button size="sm">Export</Button>} footer={<ProvenanceBadge kind="computed" />}>
 *     ...
 *   </Card>
 */
export function Card({ eyebrow, title, description, actions, footer, footerLabel, children, level = 3, padding = 'md', selected, className, bodyClassName, id, 'data-testid': testId }: CardProps) {
  const hasHeader = Boolean(eyebrow || title || actions || description);
  const Heading = `h${level}` as ElementType;
  const px = PAD[padding === 'none' ? 'md' : padding];
  return (
    <section
      id={id}
      data-testid={testId}
      className={cx('di-card flex min-w-0 flex-col', selected && 'border-accent-line ring-1 ring-accent-line', className)}
    >
      {hasHeader ? (
        <header className={cx('flex items-start justify-between gap-4 pt-4', px, children ? 'pb-3' : 'pb-4')}>
          <div className="min-w-0">
            {eyebrow ? <div className="di-eyebrow mb-1">{eyebrow}</div> : null}
            {title ? <Heading className="font-display text-[15px] leading-snug font-semibold text-title">{title}</Heading> : null}
            {description ? <p className="mt-0.5 text-[13px] text-fg-muted">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      {children !== undefined && children !== null ? (
        <div className={cx('min-w-0 flex-1', PAD[padding], hasHeader ? (padding === 'none' ? '' : 'pb-5') : PAD_Y[padding], bodyClassName)}>{children}</div>
      ) : null}
      {footer ? (
        <footer className={cx('flex items-center gap-3 rounded-b-lg border-t border-line bg-surface-2 py-2.5 text-xs text-fg-muted', px, footerLabel && 'di-demo-label')}>{footer}</footer>
      ) : null}
    </section>
  );
}

export interface SectionHeadingProps {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Pages start with h2. Use 3 for a subsection. */
  level?: 2 | 3;
  id?: string;
  className?: string;
}

/**
 * Heading for a page section: bright-blue display title, optional eyebrow,
 * description and right-aligned actions.
 *
 *   <SectionHeading title="Health by programme" description="Reported against evidence-based" actions={<Tabs ... />} />
 */
export function SectionHeading({ title, eyebrow, description, actions, level = 2, id, className }: SectionHeadingProps) {
  const Heading = `h${level}` as ElementType;
  return (
    <div className={cx('flex items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        {eyebrow ? <div className="di-eyebrow mb-1">{eyebrow}</div> : null}
        <Heading id={id} className={cx('font-display font-semibold text-heading', level === 2 ? 'text-lg leading-tight' : 'text-[15px] leading-snug')}>
          {title}
        </Heading>
        {description ? <p className="mt-1 max-w-3xl text-[13px] text-fg-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export interface SectionProps extends SectionHeadingProps {
  children: ReactNode;
}

/**
 * A page section: heading then content, 16px apart. Stack sections with `gap-8` on the page.
 *
 *   <div className="flex flex-col gap-8">
 *     <Section title="Portfolio">...</Section>
 *     <Section title="Health by programme">...</Section>
 *   </div>
 */
export function Section({ children, id, ...heading }: SectionProps) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-4">
      <SectionHeading {...heading} id={id} />
      {children}
    </section>
  );
}
