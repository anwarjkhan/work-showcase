import type { Provenance } from '@/lib/types';
import { HERO_DELIVERABLE_ID, WORKFLOW_DELIVERABLE_ID } from './story';

export type RouteId =
  | 'portfolio'
  | 'hierarchy'
  | 'plan'
  | 'global'
  | 'lifecycle'
  | 'workflow'
  | 'roles'
  | 'agents'
  | 'deliverable'
  | 'blueprint'
  | 'evidence'
  | 'slides'
  | 'about';

export type NavGroup = 'portfolio' | 'delivery' | 'adoption' | 'build';

/** Icon keys; components/shell/nav-icons.tsx maps them to lucide icons. */
export type RouteIcon =
  | 'portfolio'
  | 'hierarchy'
  | 'plan'
  | 'global'
  | 'lifecycle'
  | 'workflow'
  | 'roles'
  | 'agents'
  | 'deliverable'
  | 'blueprint'
  | 'evidence'
  | 'slides'
  | 'about';

export interface RouteDefinition {
  id: RouteId;
  /** Next.js route pattern, e.g. "/deliverables/[id]". */
  pattern: string;
  /** Where the navigation link goes. Dynamic routes link to the demo story's deliverable. */
  navHref: string;
  title: string;
  /** Shorter label for the left navigation. */
  navLabel: string;
  description: string;
  group: NavGroup;
  icon: RouteIcon;
  /** Provenance badges shown in the top bar unless the page overrides them. */
  provenance: Provenance[];
  /** Deliverable that builds the screen (design section 6). */
  builtBy: string;
}

export const NAV_GROUP_LABELS: Record<NavGroup, string> = {
  portfolio: 'Portfolio',
  delivery: 'Delivery lifecycle',
  adoption: 'Adoption',
  build: 'This build',
};

/** All routes of design section 4 plus the slide builder, in navigation order. */
export const ROUTES: readonly RouteDefinition[] = [
  {
    id: 'portfolio',
    pattern: '/',
    navHref: '/',
    title: 'Portfolio',
    navLabel: 'Portfolio',
    description: 'The whole book at a glance: reported status against evidence-based status, and where they disagree.',
    group: 'portfolio',
    icon: 'portfolio',
    provenance: ['computed', 'reported', 'sample'],
    builtBy: 'D6',
  },
  {
    id: 'hierarchy',
    pattern: '/hierarchy',
    navHref: '/hierarchy',
    title: 'Hierarchy explorer',
    navLabel: 'Hierarchy',
    description: 'From investment request to story, with the book-of-record boundary marked.',
    group: 'portfolio',
    icon: 'hierarchy',
    provenance: ['sample', 'reported'],
    builtBy: 'D7',
  },
  {
    id: 'deliverable',
    pattern: '/deliverables/[id]',
    navHref: `/deliverables/${HERO_DELIVERABLE_ID}`,
    title: 'Deliverable detail',
    navLabel: 'Deliverable detail',
    description: 'The three measures side by side, each traced to the records behind it.',
    group: 'portfolio',
    icon: 'deliverable',
    provenance: ['computed', 'reported', 'sample'],
    builtBy: 'D13',
  },
  {
    id: 'plan',
    pattern: '/plan',
    navHref: '/plan',
    title: 'Plan',
    navLabel: 'Plan',
    description: 'Timeline by hierarchy with forecast against plan and late dependencies.',
    group: 'portfolio',
    icon: 'plan',
    provenance: ['computed', 'sample'],
    builtBy: 'D8',
  },
  {
    id: 'global',
    pattern: '/global',
    navHref: '/global',
    title: 'Global delivery',
    navLabel: 'Global',
    description: 'Delivery hubs on six continents and the dependencies that cross them.',
    group: 'portfolio',
    icon: 'global',
    provenance: ['computed', 'sample'],
    builtBy: 'D9',
  },
  {
    id: 'lifecycle',
    pattern: '/lifecycle',
    navHref: '/lifecycle',
    title: 'Lifecycle',
    navLabel: 'Lifecycle',
    description: 'The portfolio through the five PDLC stages, and where agents assist.',
    group: 'delivery',
    icon: 'lifecycle',
    provenance: ['computed', 'sample'],
    builtBy: 'D10',
  },
  {
    id: 'workflow',
    pattern: '/lifecycle/[id]',
    navHref: `/lifecycle/${WORKFLOW_DELIVERABLE_ID}`,
    title: 'PDLC workflow',
    navLabel: 'PDLC workflow',
    description: 'One deliverable through the stages: agent drafts, human reviews, evidence recorded.',
    group: 'delivery',
    icon: 'workflow',
    provenance: ['scripted-agent', 'simulated', 'computed'],
    builtBy: 'D16',
  },
  {
    id: 'roles',
    pattern: '/roles',
    navHref: '/roles',
    title: 'By role',
    navLabel: 'By role',
    description: 'What each of the Core Four has waiting, what is coming up, and where a seat is empty or held twice.',
    group: 'delivery',
    icon: 'roles',
    provenance: ['computed', 'sample'],
    builtBy: 'D17',
  },
  {
    id: 'agents',
    pattern: '/agents',
    navHref: '/agents',
    title: 'Agent centre',
    navLabel: 'Agent centre',
    description: 'Run governed agents, review their proposed changes, and follow the audit trail.',
    group: 'delivery',
    icon: 'agents',
    provenance: ['scripted-agent', 'computed'],
    builtBy: 'D12',
  },
  {
    id: 'slides',
    pattern: '/slides',
    navHref: '/slides',
    title: 'Slide builder',
    navLabel: 'Slides',
    description: 'Turn any scope into editable PowerPoint: one slide, a hand-picked set or a complete pack.',
    group: 'portfolio',
    icon: 'slides',
    provenance: ['computed', 'sample'],
    builtBy: 'S6',
  },
  {
    id: 'blueprint',
    pattern: '/blueprint',
    navHref: '/blueprint',
    title: 'Template blueprint',
    navLabel: 'Blueprint',
    description: 'Current templates beside the target template that makes this repeatable.',
    group: 'adoption',
    icon: 'blueprint',
    provenance: ['planned', 'sample'],
    builtBy: 'D11',
  },
  {
    id: 'evidence',
    pattern: '/evidence',
    navHref: '/evidence',
    title: 'Pilot evidence',
    navLabel: 'Pilot evidence',
    description: 'What the pilot would measure, and the ask.',
    group: 'adoption',
    icon: 'evidence',
    provenance: ['planned'],
    builtBy: 'D11',
  },
  {
    id: 'about',
    pattern: '/about',
    navHref: '/about',
    title: 'About this build',
    navLabel: 'About',
    description: 'What is computed, scripted, sample or planned, and how to plug in real data and a model.',
    group: 'build',
    icon: 'about',
    provenance: ['sample'],
    builtBy: 'D11',
  },
];

export function routeById(id: RouteId): RouteDefinition {
  const route = ROUTES.find((r) => r.id === id);
  if (!route) throw new Error(`Unknown route: ${id}`);
  return route;
}

/** Matches a pathname (with or without trailing slash) to its route definition. */
export function routeForPath(pathname: string): RouteDefinition | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  for (const route of ROUTES) {
    const pattern = new RegExp(`^${route.pattern.replace(/\[[^\]]+\]/g, '[^/]+')}$`);
    if (pattern.test(path || '/')) return route;
  }
  return null;
}

/** Link builders for dynamic routes. Use these rather than string concatenation. */
export const hrefs = {
  deliverable: (id: string) => `/deliverables/${encodeURIComponent(id)}/`,
  workflow: (id: string) => `/lifecycle/${encodeURIComponent(id)}/`,
};
