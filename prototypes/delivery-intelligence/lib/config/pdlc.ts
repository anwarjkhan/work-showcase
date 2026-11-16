import type {
  AgentId,
  EvidenceKind,
  IsoDateTime,
  PdlcReviewState,
  PdlcRun,
  PdlcStageId,
  PdlcStageState,
  ReviewRoleId,
  TechDeliverable,
} from '@/lib/types';

export interface WorkProductDefinition {
  id: string;
  label: string;
}

export interface PdlcStageDefinition {
  id: PdlcStageId;
  /** 1..5 */
  order: number;
  name: string;
  /** For narrow columns and chips. */
  shortName: string;
  summary: string;
  workProducts: WorkProductDefinition[];
  /** Agents that assist in this stage (catalogue ids; implementations in lib/agents). */
  agentAssist: AgentId[];
  /** Human reviews, in the order they must happen. Forward movement needs all approved. */
  reviews: ReviewRoleId[];
  /** Evidence the stage should leave behind. */
  evidenceLeft: EvidenceKind[];
}

/**
 * The five PDLC stages (design section 5). Reviews are illustrative and set
 * here; they are not presented as the firm's official gates. Movement is
 * allowed forward and back between neighbours only.
 */
export const PDLC_STAGES: readonly PdlcStageDefinition[] = [
  {
    id: 'ideation-requirements',
    order: 1,
    name: 'Ideation & Requirements',
    shortName: 'Requirements',
    summary: 'Shape the problem, the outcomes and testable acceptance criteria.',
    workProducts: [
      { id: 'problem-statement', label: 'Problem statement' },
      { id: 'outcomes', label: 'Outcomes with owners' },
      { id: 'stories', label: 'Stories with acceptance criteria' },
    ],
    agentAssist: ['requirements-structuring'],
    reviews: ['requirements-owner'],
    evidenceLeft: ['requirements-sign-off'],
  },
  {
    id: 'design-specifications',
    order: 2,
    name: 'Design & Specifications',
    shortName: 'Design',
    summary: 'Design the solution and map every item of work to an outcome.',
    workProducts: [
      { id: 'solution-design', label: 'Solution design' },
      { id: 'outcome-map', label: 'Work mapped to outcomes' },
      { id: 'test-approach', label: 'Test approach' },
    ],
    agentAssist: ['outcome-mapping'],
    reviews: ['design-reviewer'],
    evidenceLeft: ['design-review'],
  },
  {
    id: 'risk-control-compliance',
    order: 3,
    name: 'Risk, Control & Compliance Reviews',
    shortName: 'Risk & control',
    summary: 'Confirm the controls and evidence the risk tier requires.',
    workProducts: [
      { id: 'control-mapping', label: 'Control mapping' },
      { id: 'risk-assessment', label: 'Risk assessment' },
    ],
    agentAssist: ['control-evidence-check'],
    reviews: ['control-owner'],
    evidenceLeft: ['control-assessment'],
  },
  {
    id: 'build-test-validate',
    order: 4,
    name: 'Build, Test & Validate',
    shortName: 'Build & test',
    summary: 'Build, test and independently validate against the criteria.',
    workProducts: [
      { id: 'build', label: 'Built increment' },
      { id: 'test-results', label: 'Test results' },
      { id: 'validation-report', label: 'Validation report' },
    ],
    agentAssist: ['release-readiness'],
    reviews: ['independent-validator'],
    evidenceLeft: ['test-result'],
  },
  {
    id: 'delivery-launch',
    order: 5,
    name: 'Delivery & Launch',
    shortName: 'Launch',
    summary: 'Business acceptance, release checklist and launch.',
    workProducts: [
      { id: 'acceptance', label: 'Business acceptance' },
      { id: 'release-checklist', label: 'Release checklist' },
      { id: 'launch-note', label: 'Launch note' },
    ],
    agentAssist: ['release-readiness'],
    reviews: ['business-owner', 'release-owner'],
    evidenceLeft: ['business-acceptance', 'release-checklist'],
  },
] as const;

export const PDLC_STAGE_IDS: PdlcStageId[] = PDLC_STAGES.map((s) => s.id);

export function stageDefinition(id: PdlcStageId): PdlcStageDefinition {
  const stage = PDLC_STAGES.find((s) => s.id === id);
  if (!stage) throw new Error(`Unknown PDLC stage: ${id}`);
  return stage;
}

/** The neighbouring stage in a direction, or null at either end. */
export function neighbourStage(id: PdlcStageId, direction: 'forward' | 'back'): PdlcStageId | null {
  const index = PDLC_STAGE_IDS.indexOf(id);
  const next = PDLC_STAGE_IDS[index + (direction === 'forward' ? 1 : -1)];
  return next ?? null;
}

/** Agents that are not tied to a stage (design section 5 "Cross-cutting"). */
export const CROSS_CUTTING_AGENTS: AgentId[] = [
  'raid-quality',
  'dependency-discovery',
  'portfolio-reconciliation',
  'status-reporting',
  'executive-briefing',
];

/**
 * Builds a fresh PdlcRun for a deliverable positioned at `currentStage`.
 * Stages before it are marked approved (their reviews approved by the named
 * reviewers when known), the current stage is in progress, later ones not
 * started. Used by data sources to seed runs; D2 may hand-tune the result.
 */
export function createPdlcRun(
  deliverable: Pick<TechDeliverable, 'id' | 'reviewers'>,
  currentStage: PdlcStageId,
  startedAt: IsoDateTime,
): PdlcRun {
  const currentIndex = PDLC_STAGE_IDS.indexOf(currentStage);
  const stages = {} as Record<PdlcStageId, PdlcStageState>;
  PDLC_STAGES.forEach((def, index) => {
    const done = index < currentIndex;
    const reviews: PdlcReviewState[] = def.reviews.map((roleId) => {
      const reviewerId = deliverable.reviewers[roleId] ?? null;
      return {
        roleId,
        state: done ? 'approved' : 'not-requested',
        reviewerId,
        decisions:
          done && reviewerId
            ? [
                {
                  id: `rd-${deliverable.id}-${def.id}-${roleId}`,
                  stageId: def.id,
                  roleId,
                  decision: 'approved',
                  reviewerId,
                  decidedAt: startedAt,
                  reason: null,
                },
              ]
            : [],
      };
    });
    stages[def.id] = {
      stageId: def.id,
      status: done ? 'approved' : index === currentIndex ? 'in-progress' : 'not-started',
      workProducts: def.workProducts.map((wp) => ({ id: wp.id, state: done ? 'complete' : 'missing', ref: null })),
      reviews,
      agentRunIds: [],
      evidenceIds: [],
      enteredAt: index <= currentIndex ? startedAt : null,
      exitedAt: done ? startedAt : null,
    };
  });
  return {
    id: `pdlc-${deliverable.id}`,
    deliverableId: deliverable.id,
    currentStage,
    stages,
    moves: [],
    startedAt,
    updatedAt: startedAt,
  };
}
