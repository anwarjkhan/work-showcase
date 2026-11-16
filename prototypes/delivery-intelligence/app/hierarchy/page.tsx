import { routeMetadata } from '@/components/shell/metadata';
import { HierarchyScreen } from '@/components/hierarchy/HierarchyScreen';

export const metadata = routeMetadata('hierarchy');

export default function Page() {
  return <HierarchyScreen />;
}
