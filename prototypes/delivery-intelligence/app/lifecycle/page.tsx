import { routeMetadata } from '@/components/shell/metadata';
import { LifecycleScreen } from '@/components/lifecycle/LifecycleScreen';

export const metadata = routeMetadata('lifecycle');

export default function Page() {
  return <LifecycleScreen />;
}
