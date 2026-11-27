import { RolesScreen } from '@/components/roles/RolesScreen';
import { routeMetadata } from '@/components/shell/metadata';

export const metadata = routeMetadata('roles');

export default function Page() {
  return <RolesScreen />;
}
