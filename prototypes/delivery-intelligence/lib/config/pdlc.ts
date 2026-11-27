import type {
  AgentId,
  CoreRole,
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

/** What a role confirms at one review. */
export interface ReviewConfirmation {
  /** Verb phrase that follows "to", e.g. "confirm risk and controls" ("Waiting on … to confirm risk and controls."). */
  confirms: string;
  /** Short outcome phrase for chips and tables, e.g. "Risk and controls confirmed for the second line". */
  confirmed: string;
}

/** The Core Four, in display order. Labels are in `terms.coreRoles`. */
export const CORE_ROLES: readonly CoreRole[] = ['product-manager', 'tech-lead', 'risk-lead', 'ux-lead'] as const;

/** The role that owns the process and takes the go / no-go decision at every stage gate. */
export const GATE_ROLE: CoreRole = 'product-manager';

/** One line on what each core role brings (for tooltips and the pod view). */
export const CORE_ROLE_SUMMARY: Record<CoreRole, string> = {
  'product-manager': 'Business. Owns the process and takes the go / no-go decision at every stage gate.',
  'tech-lead': 'Technology. Owns the architecture, feasibility and the technical truth of the work.',
  'risk-lead': 'First line of defence. Names the obligations and confirms risk and controls for the second line, with a named audit trail.',
  'ux-lead': 'Design and research. Owns the user journey, accessibility and prototypes.',
};

const GATE: ReviewConfirmation = { confirms: 'approve the stage gate', confirmed: 'Go / no-go decision on the stage gate' };

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
  /**
   * Human reviews, in the order they must happen, each decided by the holder of that
   * core role. The Product Manager's gate decision is always last. Forward movement
   * needs all approved.
   */
  reviews: ReviewRoleId[];
  /** What each reviewing role confirms in this stage, for the UI and refusal sentences. */
  confirms: Partial<Record<ReviewRoleId, ReviewConfirmation>>;
  /**
   * Evidence a review looks at, so it should be held and passing before the review is
   * decided (a guide for the screen's next step; the store does not enforce it).
   */
  evidenceBefore: Partial<Record<ReviewRoleId, EvidenceKind>>;
  /** Evidence the stage should leave behind. */
  evidenceLeft: EvidenceKind[];
}

/**
 * The five PDLC stages (design section 5). Each stage's reviews are decided by
 * the deliverable's Core Four: the specialist confirmations first, then the
 * Product Manager's gate decision. Movement is allowed forward and back between
 * neighbours only.
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
    reviews: ['risk-lead', 'ux-lead', 'product-manager'],
    confirms: {
      'risk-lead': { confirms: 'name the obligations that apply', confirmed: 'Obligations named' },
      'ux-lead': { confirms: 'confirm the user context', confirmed: 'User context confirmed' },
      'product-manager': GATE,
    },
    evidenceBefore: {},
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
    reviews: ['tech-lead', 'ux-lead', 'product-manager'],
    confirms: {
      'tech-lead': { confirms: 'validate the architecture', confirmed: 'Architecture validated' },
      'ux-lead': { confirms: 'review the prototype', confirmed: 'Prototype reviewed' },
      'product-manager': GATE,
    },
    evidenceBefore: {},
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
    reviews: ['risk-lead', 'product-manager'],
    confirms: {
      'risk-lead': { confirms: 'confirm risk and controls', confirmed: 'Risk and controls confirmed for the second line' },
      'product-manager': GATE,
    },
    evidenceBefore: {},
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
    reviews: ['tech-lead', 'product-manager'],
    confirms: {
      'tech-lead': { confirms: 'confirm the technical validation', confirmed: 'Technical validation confirmed' },
      'product-manager': GATE,
    },
    evidenceBefore: { 'tech-lead': 'test-result' },
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
    reviews: ['tech-lead', 'product-manager'],
    confirms: {
      'tech-lead': { confirms: 'confirm the release checklist', confirmed: 'Release checklist confirmed' },
      'product-manager': GATE,
    },
    evidenceBefore: { 'tech-lead': 'release-checklist', 'product-manager': 'business-acceptance' },
    evidenceLeft: ['business-acceptance', 'release-checklist'],
  },
] as const;

export const PDLC_STAGE_IDS: PdlcStageId[] = PDLC_STAGES.map((s) => s.id);

/** What `roleId` confirms in `stageId` (falls back to a generic phrase for a role the stage does not list). */
export function reviewConfirmation(stageId: PdlcStageId, roleId: ReviewRoleId): ReviewConfirmation {
  return stageDefinition(stageId).confirms[roleId] ?? (roleId === GATE_ROLE ? GATE : { confirms: 'confirm the stage', confirmed: 'Stage confirmed' });
}

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
 * Stages before it are marked approved (each review approved by the holder of
 * that core role when there is one, in the stage's order, the Product Manager
 * last), the current stage is in progress, later ones not started. Used by data
 * sources to seed runs; the synthetic source hand-tunes the result.
 */
export function createPdlcRun(
  deliverable: Pick<TechDeliverable, 'id' | 'coreTeam'>,
  currentStage: PdlcStageId,
  startedAt: IsoDateTime,
): PdlcRun {
  const currentIndex = PDLC_STAGE_IDS.indexOf(currentStage);
  const stages = {} as Record<PdlcStageId, PdlcStageState>;
  PDLC_STAGES.forEach((def, index) => {
    const done = index < currentIndex;
    const reviews: PdlcReviewState[] = def.reviews.map((roleId) => {
      const reviewerId = deliverable.coreTeam[roleId]?.personId ?? null;
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
