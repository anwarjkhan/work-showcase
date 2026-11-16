import { describe, expect, it } from 'vitest';
import { baseTerminology, mergeTerminology, terms } from './terminology';

describe('terminology', () => {
  it('falls back to the base labels when no local override exists', () => {
    // No terminology.local.ts is committed, so the alias resolves to the empty fallback.
    expect(terms).toEqual(baseTerminology);
  });

  it('overrides only the labels given, leaving the rest intact', () => {
    const merged = mergeTerminology(baseTerminology, {
      systems: { 'portfolio-system': 'Internal portfolio tool' },
      templates: { rapid: 'Quick-start template' },
    });
    expect(merged.systems['portfolio-system']).toBe('Internal portfolio tool');
    expect(merged.systems['work-tracker']).toBe(baseTerminology.systems['work-tracker']);
    expect(merged.templates.rapid).toBe('Quick-start template');
    expect(merged.templates.advanced).toBe(baseTerminology.templates.advanced);
    expect(merged.app).toBe(baseTerminology.app);
  });

  it('ignores unknown keys and non-string values', () => {
    const merged = mergeTerminology(baseTerminology, { nonsense: 'x', app: { name: 42 } } as never);
    expect(merged).toEqual(baseTerminology);
    expect('nonsense' in merged).toBe(false);
  });

  it('has a label for every provenance kind', () => {
    expect(Object.keys(terms.provenance).sort()).toEqual(['computed', 'planned', 'reported', 'sample', 'scripted-agent', 'simulated']);
  });
});
