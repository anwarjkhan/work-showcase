/**
 * Synthetic portfolio generator (deliverable D2).
 *
 * `createSyntheticPortfolio(seed)` is deterministic: the same seed always gives
 * deeply equal data. There is no `Math.random` and no wall-clock time; every
 * date derives from the demo clock (8 March 2027).
 *
 * Layout of this folder:
 *   random.ts     seeded random helper
 *   dates.ts      date and sprint helpers
 *   reference.ts  hubs, people, pods, agent identities, sprints
 *   catalogue.ts  hand-written investment requests, programmes and deliverables
 *   hierarchy.ts  book-of-record records built from the catalogue
 *   outcomes.ts   outcomes and acceptance criteria
 *   workitems.ts  Epics, story-level items and sub-tasks
 *   evidence.ts   evidence records that follow each deliverable's PDLC stage
 *   raid.ts       RAID items, dependencies and milestones
 *   story.ts      the pinned hero and workflow-story records
 *   core-team.ts  Core Four join dates and the deliberate gaps (rules R15, R16)
 *   runs.ts       PDLC runs
 */
import { DEMO_CLOCK } from '@/lib/config/clock';
import { HERO_DELIVERABLE_ID, WORKFLOW_DELIVERABLE_ID } from '@/lib/config/story';
import type { PortfolioData } from '@/lib/types';
import { settleCoreTeamDates } from './core-team';
import { buildEvidence } from './evidence';
import { buildHierarchy } from './hierarchy';
import { buildOutcomes, finalizeAcceptance } from './outcomes';
import { buildRaidAndDependencies } from './raid';
import { Rng } from './random';
import { buildReference } from './reference';
import { buildPdlcRuns } from './runs';
import { buildStoryRecords } from './story';
import { buildWorkItems } from './workitems';

export const DEFAULT_SEED = 20270308;

export function createSyntheticPortfolio(seed: number = DEFAULT_SEED): PortfolioData {
  const root = new Rng(seed);
  const ref = buildReference(root);
  const hierarchy = buildHierarchy(root, ref);
  const outcomePlan = buildOutcomes(root, hierarchy);
  const story = buildStoryRecords(ref);
  const generated = buildWorkItems(root, hierarchy, ref, outcomePlan);
  const acceptance = finalizeAcceptance(root, outcomePlan, hierarchy, generated.items);
  const workItems = [...story.workItems, ...generated.items];
  settleCoreTeamDates(hierarchy.deliverables, workItems);
  const evidence = [...story.evidence, ...buildEvidence(root, hierarchy, outcomePlan, acceptance, generated.items)];
  const raidPlan = buildRaidAndDependencies(root, hierarchy, ref, outcomePlan, workItems);
  const raid = [...story.raid, ...raidPlan.raid];

  return {
    meta: {
      sourceId: 'synthetic',
      sourceKind: 'synthetic',
      seed,
      generatedAt: DEMO_CLOCK.now,
      asOf: DEMO_CLOCK.today,
      freshness: [
        { system: 'portfolio-system', lastSyncedAt: '2027-03-07T22:00:00.000Z', recordCount: hierarchy.deliverables.length + hierarchy.pmNodes.length + hierarchy.investmentRequests.length },
        { system: 'work-tracker', lastSyncedAt: '2027-03-08T06:00:00.000Z', recordCount: workItems.length + raid.length },
        { system: 'test-harness', lastSyncedAt: '2027-03-08T06:30:00.000Z', recordCount: evidence.filter((e) => e.source === 'test-harness').length },
        { system: 'document-store', lastSyncedAt: '2027-03-07T20:00:00.000Z', recordCount: evidence.filter((e) => e.source === 'document-store').length },
        { system: 'control-register', lastSyncedAt: '2027-03-07T18:00:00.000Z', recordCount: evidence.filter((e) => e.source === 'control-register').length },
        { system: 'release-tool', lastSyncedAt: '2027-03-07T18:30:00.000Z', recordCount: evidence.filter((e) => e.source === 'release-tool').length },
      ],
      heroDeliverableId: HERO_DELIVERABLE_ID,
      workflowDeliverableId: WORKFLOW_DELIVERABLE_ID,
    },
    investmentRequests: hierarchy.investmentRequests,
    pmNodes: hierarchy.pmNodes,
    deliverables: hierarchy.deliverables,
    outcomes: [...story.outcomes, ...outcomePlan.outcomes],
    criteria: [...story.criteria, ...outcomePlan.criteria],
    workItems,
    evidence,
    raid,
    dependencies: raidPlan.dependencies,
    milestones: [...story.milestones, ...raidPlan.milestones],
    hubs: ref.hubs,
    pods: ref.pods,
    people: ref.people,
    agentIdentities: ref.agentIdentities,
    sprints: ref.sprints,
    pdlcRuns: buildPdlcRuns(hierarchy, evidence),
  };
}
