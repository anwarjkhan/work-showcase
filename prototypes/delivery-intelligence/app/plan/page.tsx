import { routeMetadata } from '@/components/shell/metadata';
import { PlanScreen } from '@/components/plan/PlanScreen';

export const metadata = routeMetadata('plan');

export default function Page() {
  return <PlanScreen />;
}
