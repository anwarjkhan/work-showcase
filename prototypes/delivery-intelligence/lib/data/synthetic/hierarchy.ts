/**
 * The book-of-record side: investment requests, programme structure and
 * technology deliverables, built from the catalogue.
 */
import { HERO_DELIVERABLE_ID, PRESENTER_PERSON_ID, WORKFLOW_DELIVERABLE_ID } from '@/lib/config/story';
import type { InvestmentRequest, PmNode, RagStatus, ReviewRoleId, TechDeliverable } from '@/lib/types';
import {
  DELIVERABLES,
  INVESTMENT_REQUESTS,
  KEY_START,
  PM_NODES,
  PROJECT_KEYS,
  type DeliverableSpec,
} from './catalogue';
import { addDays, maxDate, minDate } from './dates';
import type { Rng } from './random';
import type { Cast, ProgrammeKey, Reference } from './reference';

/** Hands out Jira keys per project. Epics are allocated first, then children continue the sequence. */
export class KeyAllocator {
  private counters: Record<ProgrammeKey, number> = { ...KEY_START };

  next(programme: ProgrammeKey): string {
    const n = this.counters[programme];
    this.counters[programme] = n + 1;
    return `${PROJECT_KEYS[programme]}-${n}`;
  }

  /** Skips ahead so generated keys cannot collide with hand-written ones. */
  reserve(programme: ProgrammeKey, atLeast: number): void {
    this.counters[programme] = Math.max(this.counters[programme], atLeast);
  }
}

const PINNED_EPIC_KEYS: Record<string, string[]> = {
  [HERO_DELIVERABLE_ID]: ['CCR-100', 'CCR-200', 'CCR-300'],
  [WORKFLOW_DELIVERABLE_ID]: ['LIM-10'],
};

const REVIEW_ROLES: ReviewRoleId[] = ['requirements-owner', 'design-reviewer', 'control-owner', 'independent-validator', 'business-owner', 'release-owner'];

export interface Hierarchy {
  investmentRequests: InvestmentRequest[];
  pmNodes: PmNode[];
  deliverables: TechDeliverable[];
  /** The spec each deliverable was built from, by deliverable id. */
  specs: Map<string, DeliverableSpec>;
  keys: KeyAllocator;
}

const RAG_ORDER: Record<RagStatus, number> = { green: 0, amber: 1, red: 2 };

export function buildHierarchy(root: Rng, ref: Reference): Hierarchy {
  const rng = root.fork('hierarchy');
  const cast: Cast = ref.cast;
  const keys = new KeyAllocator();
  keys.reserve('ccr', 400);

  const podLead = (podId: string): string => ref.pods.find((p) => p.id === podId)?.leadId ?? PRESENTER_PERSON_ID;

  const investmentRequests: InvestmentRequest[] = INVESTMENT_REQUESTS.map((spec) => ({
    id: spec.id,
    ref: spec.ref,
    title: spec.title,
    objective: spec.objective,
    ownerId: cast.owners[spec.programme],
    activityRisk: spec.activityRisk,
    route: spec.activityRisk === 'low' ? 'standalone' : 'formal',
    theme: spec.theme,
    status: spec.status,
    approvedOn: spec.approvedOn,
  }));
  const irByProgramme = new Map(INVESTMENT_REQUESTS.map((ir) => [ir.programme, ir.id]));

  const specs = new Map<string, DeliverableSpec>();
  const deliverables: TechDeliverable[] = DELIVERABLES.map((spec) => {
    specs.set(spec.id, spec);
    const dr = rng.fork(spec.id);
    const epicKeys = PINNED_EPIC_KEYS[spec.id] ?? spec.epics.map(() => keys.next(spec.programme));

    const reviewers: Partial<Record<ReviewRoleId, string>> = {};
    for (const role of REVIEW_ROLES) {
      let holder: string;
      if (spec.id === WORKFLOW_DELIVERABLE_ID) holder = PRESENTER_PERSON_ID;
      else if (spec.id === HERO_DELIVERABLE_ID) {
        holder = { 'requirements-owner': 'p-owner-1', 'design-reviewer': 'p-owner-1', 'control-owner': 'p-ctl-1', 'independent-validator': 'p-val-1', 'business-owner': PRESENTER_PERSON_ID, 'release-owner': 'p-owner-1' }[role];
      } else if (role === 'business-owner' && spec.programme === 'limits') holder = PRESENTER_PERSON_ID;
      else if (role === 'business-owner' && spec.programme === 'stress') holder = cast.owners.stress;
      else holder = dr.pick(cast.pools[role]);
      reviewers[role] = holder;
    }

    return {
      id: spec.id,
      ref: `TD-${spec.n}`,
      title: spec.title,
      summary: spec.summary,
      pmNodeId: spec.pmNodeId,
      investmentRequestId: irByProgramme.get(spec.programme) as string,
      epicKeys,
      template: spec.template,
      reportedRag: spec.rag,
      reportedAt: spec.id === HERO_DELIVERABLE_ID || spec.id === WORKFLOW_DELIVERABLE_ID ? '2027-03-01' : addDays('2027-03-01', dr.int(0, 5)),
      reportedCommentary: spec.commentary,
      pdlcStage: spec.stage,
      riskTier: spec.tier,
      hubIds: spec.hubs,
      podId: spec.podId,
      ownerId: spec.ownerId ?? podLead(spec.podId),
      reviewers,
      plannedStart: spec.start,
      plannedEnd: spec.end,
      reportedForecastEnd: spec.forecast ?? null,
    };
  });

  // Programme structure: dates roll up from deliverables, RAG from the worst child unless set.
  const childrenOf = new Map<string, string[]>();
  for (const node of PM_NODES) if (node.parentId) childrenOf.set(node.parentId, [...(childrenOf.get(node.parentId) ?? []), node.id]);

  const spanOf = (nodeId: string): { start: string; end: string; rag: RagStatus } | null => {
    let start: string | null = null;
    let end: string | null = null;
    let rag: RagStatus = 'green';
    const visit = (id: string): void => {
      for (const d of deliverables.filter((x) => x.pmNodeId === id)) {
        start = start === null ? d.plannedStart : minDate(start, d.plannedStart);
        end = end === null ? d.plannedEnd : maxDate(end, d.plannedEnd);
        if (RAG_ORDER[d.reportedRag] > RAG_ORDER[rag]) rag = d.reportedRag;
      }
      for (const child of childrenOf.get(id) ?? []) visit(child);
    };
    visit(nodeId);
    return start === null || end === null ? null : { start, end, rag };
  };

  const pmNodes: PmNode[] = PM_NODES.map((spec) => {
    const span = spanOf(spec.id);
    const firstDeliverable = deliverables.find((d) => d.pmNodeId === spec.id);
    return {
      id: spec.id,
      ref: spec.ref,
      title: spec.title,
      level: spec.level,
      parentId: spec.parentId,
      investmentRequestId: irByProgramme.get(spec.programme) as string,
      ownerId: spec.level === 'project' && firstDeliverable ? firstDeliverable.ownerId : cast.owners[spec.programme],
      reportedRag: spec.rag ?? span?.rag ?? 'green',
      reportedAt: '2027-03-03',
      plannedStart: span?.start ?? '2027-01-04',
      plannedEnd: span?.end ?? '2027-12-17',
    };
  });

  return { investmentRequests, pmNodes, deliverables, specs, keys };
}
