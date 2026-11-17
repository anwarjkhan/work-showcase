import { AgentsScreen } from '@/components/agents/AgentsScreen';
import { routeMetadata } from '@/components/shell/metadata';

export const metadata = routeMetadata('agents');

export default function Page() {
  return <AgentsScreen />;
}
