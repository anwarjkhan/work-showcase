/**
 * The book-of-record side: investment requests, programme structure and
 * technology deliverables, built from the catalogue.
 */
import { HERO_DELIVERABLE_ID, PRESENTER_PERSON_ID, WORKFLOW_DELIVERABLE_ID } from '@/lib/config/story';
import type { CoreRole, InvestmentRequest, PmNode, RagStatus, TechDeliverable } from '@/lib/types';
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
import { applyCoreTeamGaps, provisionalSeat } from './core-team';
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

/** Pinned Core Four for the story deliverables (four different people each). */
const PINNED_CORE: Record<string, Record<CoreRole, string>> = {
  [HERO_DELIVERABLE_ID]: { 'product-manager': PRESENTER_PERSON_ID, 'tech-lead': 'p-risk-ldn-1', 'risk-lead': 'p-ctl-1', 'ux-lead': 'p-dsg-1' },
  [WORKFLOW_DELIVERABLE_ID]: { 'product-manager': PRESENTER_PERSON_ID, 'tech-lead': 'p-xva-nyc-1', 'risk-lead': 'p-ctl-1', 'ux-lead': 'p-dsg-1' },
};

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

    // Core Four. The six pool draws happen in their original order for every generated
    // deliverable, so the seeded stream (and the report dates drawn after it) is unchanged.
    // The Product Manager, Risk Lead and UX Design Lead come from their pools (limits work
    // is product-managed by the presenter, stress tooling by its head of tooling); the Tech
    // Lead is the pod's lead. Join dates are settled once work items exist (core-team.ts).
    let core: Record<CoreRole, string>;
    const pinned = PINNED_CORE[spec.id];
    if (pinned) core = pinned;
    else {
      dr.pick(cast.pools.analysis);
      const ux = dr.pick(cast.pools.ux);
      const risk = dr.pick(cast.pools.risk);
      dr.pick(cast.pools.validation);
      const product = spec.programme === 'limits' ? PRESENTER_PERSON_ID : spec.programme === 'stress' ? cast.owners.stress : dr.pick(cast.pools.product);
      dr.pick(cast.pools.release);
      core = { 'product-manager': product, 'tech-lead': podLead(spec.podId), 'risk-lead': risk, 'ux-lead': ux };
    }
    const coreTeam = applyCoreTeamGaps(spec.id, {
      'product-manager': provisionalSeat(core['product-manager'], spec.start),
      'tech-lead': provisionalSeat(core['tech-lead'], spec.start),
      'risk-lead': provisionalSeat(core['risk-lead'], spec.start),
      'ux-lead': provisionalSeat(core['ux-lead'], spec.start),
    });

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
      coreTeam,
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
