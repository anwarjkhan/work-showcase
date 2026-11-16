import type { Metadata } from 'next';
import { routeById, type RouteId } from '@/lib/config/routes';

/** Page <title>/description from the route list. Use in server page files: `export const metadata = routeMetadata('plan');` */
export function routeMetadata(id: RouteId): Metadata {
  const route = routeById(id);
  return { title: route.title, description: route.description };
}
