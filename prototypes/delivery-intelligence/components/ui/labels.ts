/**
 * Generic interface wording that is not a status, readiness or measure label
 * (those always come from `terms` in `@/lib/config/terminology`).
 */
export const uiText = {
  close: 'Close',
  disagreement: 'Disagreement',
  sortBy: 'Sort by',
  noData: 'No data',
  baseline: 'Baseline',
  assisted: 'Assisted',
  step: {
    pending: 'Pending',
    running: 'Running',
    done: 'Done',
    failed: 'Failed',
  },
  agent: 'Agent',
  person: 'Person',
  expand: 'Expand',
  collapse: 'Collapse',
} as const;
