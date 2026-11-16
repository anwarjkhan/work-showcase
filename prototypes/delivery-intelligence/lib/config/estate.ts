import type { TemplateId } from '@/lib/types';

/**
 * Round, synthetic estate figures for the blueprint rollout view. Replace with
 * the real numbers after import inside the firm (design section 8). No money
 * or headcount here, by design.
 */
export const ESTATE = {
  /** Jira projects in scope of the template rollout. */
  projects: 400,
  projectsByTemplate: {
    rapid: 240,
    advanced: 120,
    target: 0,
  } satisfies Record<TemplateId, number>,
  /** Projects on neither standard template. */
  projectsOnOtherTemplates: 40,
  activeEpics: 3000,
  storyLevelItemsPerYear: 120000,
  deliverablesInPortfolioSystem: 600,
  deliveryHubs: 18,
  /** Planned rollout waves for the target template. */
  rolloutWaves: [
    { id: 'pilot', label: 'Pilot', projects: 10, quarter: 'Q2 2027' },
    { id: 'wave-1', label: 'Wave 1', projects: 60, quarter: 'Q3 2027' },
    { id: 'wave-2', label: 'Wave 2', projects: 150, quarter: 'Q4 2027' },
    { id: 'wave-3', label: 'Wave 3', projects: 180, quarter: 'Q1 2028' },
  ],
} as const;
