import { routeMetadata } from '@/components/shell/metadata';
import { GlobalScreen } from '@/components/global/GlobalScreen';

export const metadata = routeMetadata('global');

export default function Page() {
  return <GlobalScreen />;
}
