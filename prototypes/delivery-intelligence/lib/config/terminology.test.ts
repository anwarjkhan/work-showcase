import { describe, expect, it } from 'vitest';
import localOverride from '@local/terminology';
import { baseTerminology, mergeTerminology, terms } from './terminology';
import fallback from './terminology.local.fallback';

describe('terminology', () => {
  it('ships an empty fallback, so without a local file the labels are the base labels', () => {
    expect(fallback).toEqual({});
    expect(mergeTerminology(baseTerminology, fallback)).toEqual(baseTerminology);
  });

  it('applies whichever override the alias resolves to (local file when present, else the fallback)', () => {
    expect(terms).toEqual(mergeTerminology(baseTerminology, localOverride));
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
