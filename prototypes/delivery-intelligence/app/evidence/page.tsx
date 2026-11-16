import { routeMetadata } from '@/components/shell/metadata';
import { EvidenceScreen } from '@/components/evidence/EvidenceScreen';

export const metadata = routeMetadata('evidence');

export default function Page() {
  return <EvidenceScreen />;
}
