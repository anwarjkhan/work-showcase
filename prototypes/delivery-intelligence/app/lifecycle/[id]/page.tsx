import { routeMetadata } from '@/components/shell/metadata';
import { WorkflowScreen } from '@/components/workflow/WorkflowScreen';
import { deliverableStaticParams } from '@/lib/data/source';

export const metadata = routeMetadata('workflow');

// Only the ids generated at build time exist; anything else is a 404.
export const dynamicParams = false;

export function generateStaticParams(): Array<{ id: string }> {
  return deliverableStaticParams();
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WorkflowScreen id={id} />;
}
