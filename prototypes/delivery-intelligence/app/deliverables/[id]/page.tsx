// PLACEHOLDER — replaced by the screen deliverable that owns this route (see lib/config/routes.ts, builtBy).
// Pattern for dynamic routes in a static export: a server page lists every id in
// generateStaticParams (from the data source) and renders a client component.
import { routeMetadata } from '@/components/shell/metadata';
import { RoutePlaceholder } from '@/components/shell/RoutePlaceholder';
import { deliverableStaticParams } from '@/lib/data/source';

export const metadata = routeMetadata('deliverable');

// Only the ids generated at build time exist; anything else is a 404.
export const dynamicParams = false;

export function generateStaticParams(): Array<{ id: string }> {
  return deliverableStaticParams();
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RoutePlaceholder routeId="deliverable" entityId={id} />;
}
