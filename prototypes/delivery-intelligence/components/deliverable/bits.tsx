'use client';

import { CircleAlert, CircleCheck, CircleDashed, CircleX, Clock3, TriangleAlert } from 'lucide-react';
import { Avatar, Badge, type BadgeTone } from '@/components/ui';
import { terms } from '@/lib/config/terminology';
import { usePortfolioIndex } from '@/lib/store';
import type { EvidenceHeldState, WorkItem } from '@/lib/types';

const HELD: Record<EvidenceHeldState, { tone: BadgeTone; icon: React.ReactNode }> = {
  passing: { tone: 'green', icon: <CircleCheck /> },
  failing: { tone: 'red', icon: <CircleX /> },
  stale: { tone: 'amber', icon: <Clock3 /> },
  pending: { tone: 'neutral', icon: <CircleDashed /> },
  missing: { tone: 'unknown', icon: <CircleAlert /> },
};

/** Held state of a required evidence kind: text, shape and colour. */
export function HeldBadge({ state, size = 'sm' }: { state: EvidenceHeldState; size?: 'sm' | 'md' }) {
  const h = HELD[state];
  return (
    <Badge tone={h.tone} size={size} icon={h.icon} dashed={state === 'missing'}>
      {terms.evidenceHeld[state]}
    </Badge>
  );
}

/** A flag with a warning shape and words, never colour alone. */
export function Flag({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <Badge tone="amber" size="sm" icon={<TriangleAlert />} title={title}>
      {children}
    </Badge>
  );
}

export function PersonCell({ id, fallback = 'Nobody named' }: { id: string | null; fallback?: string }) {
  const idx = usePortfolioIndex();
  const p = id ? idx.people.get(id) : undefined;
  if (!p) return <span className="text-fg-subtle">{fallback}</span>;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <Avatar initials={p.initials} name={p.name} size="xs" />
      <span>{p.name}</span>
    </span>
  );
}

/** Assignee of a work item: a person's avatar, or an agent's identity badge. */
export function AssigneeCell({ item }: { item: WorkItem }) {
  const idx = usePortfolioIndex();
  if (item.assigneeType === 'agent') {
    const a = item.assigneeId ? idx.agentIdentities.get(item.assigneeId) : undefined;
    const handle = a?.handle ?? 'agent';
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <Avatar kind="agent" name={handle} size="xs" />
        <span className="font-mono text-xs">{handle}</span>
      </span>
    );
  }
  return <PersonCell id={item.assigneeId} fallback="Unassigned" />;
}

export const pluralise = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
