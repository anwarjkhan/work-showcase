import { routeMetadata } from '@/components/shell/metadata';
import { SlidesScreen } from '@/components/slides/SlidesScreen';

export const metadata = routeMetadata('slides');
export default function Page() {
  return <SlidesScreen />;
}
