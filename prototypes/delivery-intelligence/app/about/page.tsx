import { routeMetadata } from '@/components/shell/metadata';
import { AboutScreen } from '@/components/about/AboutScreen';

export const metadata = routeMetadata('about');

export default function Page() {
  return <AboutScreen />;
}
