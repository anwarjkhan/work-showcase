import {
  Bot,
  ChartGantt,
  Earth,
  FileSearch,
  FlaskConical,
  Info,
  LayoutDashboard,
  LayoutTemplate,
  Network,
  Presentation,
  Route,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import type { RouteIcon } from '@/lib/config/routes';

export const NAV_ICONS: Record<RouteIcon, LucideIcon> = {
  portfolio: LayoutDashboard,
  hierarchy: Network,
  deliverable: FileSearch,
  plan: ChartGantt,
  global: Earth,
  lifecycle: Workflow,
  workflow: Route,
  agents: Bot,
  blueprint: LayoutTemplate,
  evidence: FlaskConical,
  slides: Presentation,
  about: Info,
};
