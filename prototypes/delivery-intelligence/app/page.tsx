import { routeMetadata } from '@/components/shell/metadata';
import { PortfolioScreen } from '@/components/portfolio/PortfolioScreen';

export const metadata = routeMetadata('portfolio');

export default function Page() {
  return <PortfolioScreen />;
}
