import { createElement } from 'react';
import { FileText, GitCompare, ListTree, Presentation, Rocket, ShieldCheck, Target, TriangleAlert, Waypoints, type LucideIcon } from 'lucide-react';
import type { AgentIconName } from '@/lib/agents';
import { AGENT_CATALOGUE } from '@/lib/agents';
import type { AgentId } from '@/lib/types';

const ICONS: Record<AgentIconName, LucideIcon> = { ListTree, Target, ShieldCheck, Rocket, TriangleAlert, Waypoints, GitCompare, FileText, Presentation };

/** The catalogue icon for an agent, as a lucide component. */
export function agentIcon(id: AgentId): LucideIcon {
  return ICONS[AGENT_CATALOGUE[id].icon];
}

export function AgentGlyph({ id, size = 'md' }: { id: AgentId; size?: 'sm' | 'md' }) {
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-md border border-prov-scripted/30 bg-prov-scripted-soft text-prov-scripted ${size === 'sm' ? 'size-6' : 'size-8'}`}
    >
      {createElement(ICONS[AGENT_CATALOGUE[id].icon], { className: size === 'sm' ? 'size-3.5' : 'size-4', strokeWidth: 2 })}
    </span>
  );
}
