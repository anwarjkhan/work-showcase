import { routeMetadata } from '@/components/shell/metadata';
import { BlueprintScreen } from '@/components/blueprint/BlueprintScreen';

export const metadata = routeMetadata('blueprint');

export default function Page() {
  return <BlueprintScreen />;
}
