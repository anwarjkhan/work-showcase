import { Avatar, Badge, Card } from '@/components/ui';
import { crossCuttingAgents } from '@/lib/agents/catalogue';
import { terms } from '@/lib/config/terminology';

export function CrossCuttingBand() {
  const agents = crossCuttingAgents();
  return (
    <Card
      level={3}
      eyebrow="Across all five stages"
      title="Cross-cutting agents"
      description="Not tied to one stage. They read across the portfolio and any change they propose waits for a named human."
      padding="sm"
    >
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {agents.map((a) => (
          <li key={a.id} className="flex min-w-0 flex-col gap-1.5 rounded-md border border-line bg-surface-2 p-3">
            <div className="flex items-center gap-2">
              <Avatar kind="agent" name={a.name} size="xs" />
              <span className="min-w-0 flex-1 text-[12.5px] font-semibold text-fg">{a.name}</span>
            </div>
            <Badge size="sm" tone="neutral" className="self-start">{terms.agentModes[a.mode]}</Badge>
            <p className="text-[11.5px] leading-snug text-fg-muted">{a.purpose}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
