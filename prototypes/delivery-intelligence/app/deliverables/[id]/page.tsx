import { routeMetadata } from '@/components/shell/metadata';
import { deliverableStaticParams } from '@/lib/data/source';
import { DeliverableScreen } from '@/components/deliverable/DeliverableScreen';

export const metadata = routeMetadata('deliverable');
export const dynamicParams = false;
export function generateStaticParams() {
  return deliverableStaticParams();
}
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DeliverableScreen id={id} />;
}
