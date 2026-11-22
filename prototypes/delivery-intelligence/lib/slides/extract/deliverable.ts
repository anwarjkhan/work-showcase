/**
 * Facts for one technology deliverable: status pair and verdict, the three
 * measures, outcomes, findings, plan and knock-on, RAID and dependencies,
 * lifecycle position, pod and the Jira mapping. Every figure is read from the
 * engine result or an engine helper.
 */
import { describeWorkflow, type WorkflowView } from '@/lib/agents';
import { stageDefinition } from '@/lib/config/pdlc';
import { dependencyLateDays, isDependencyOpen, isDependencyTroubled, type Forecast, type KnockOn } from '@/lib/engine';
import type {
  AgentIdentity,
  DeliverableMeasures,
  Dependency,
  Evidence,
  EvidenceRag,
  Finding,
  InvestmentRequest,
  Milestone,
  Outcome,
  OutcomeMeasures,
  Person,
  PmNode,
  Pod,
  RaidItem,
  StatusDraft,
  TechDeliverable,
  WorkItem,
} from '@/lib/types';
import type { MeasureView, ReadinessView } from '../types';
import type { SlideEnv } from './common';
import { acceptedView, ragWord, readinessView, reportedOnTrack, workView } from './format';
import { nodeChain } from './scope';

export interface OutcomeLine {
  outcome: Outcome;
  measures: OutcomeMeasures | undefined;
  accepted: boolean;
  /** Findings whose subject is this outcome. */
  findings: Finding[];
  /** Short gap phrases, e.g. "Reported on track, not accepted". */
  gaps: string[];
}

export interface DependencyLine {
  dependency: Dependency;
  direction: 'inbound' | 'outbound';
  /** The deliverable on the other end. */
  other: TechDeliverable | undefined;
  lateDays: number;
  troubled: boolean;
  open: boolean;
}

export interface DeliverableFacts {
  deliverable: TechDeliverable;
  request: InvestmentRequest | undefined;
  /** PM node chain above it, top first (empty on the standalone route). */
  nodes: PmNode[];
  measures: DeliverableMeasures;
  rag: EvidenceRag;
  views: { work: MeasureView; accepted: MeasureView; readiness: ReadinessView };
  /** "TD-1001 is reported Green; the evidence says Red". */
  verdict: string;
  findings: Finding[];
  outcomes: OutcomeLine[];
  forecast: Forecast | undefined;
  /** Late or blocked inputs into this deliverable and their knock-on. */
  knockOnInto: KnockOn[];
  raid: RaidItem[];
  dependencies: DependencyLine[];
  milestones: Milestone[];
  evidence: Evidence[];
  workflow: WorkflowView | null;
  stageName: string;
  pod: Pod | undefined;
  members: Person[];
  agents: AgentIdentity[];
  /** Items below Epic level by assignee type (a count, not a measure). */
  workShare: { human: number; agent: number };
  epics: { key: string; item: WorkItem | undefined; storyCount: number; mappedCount: number }[];
  statusDraft: StatusDraft | null;
}

/** The verdict statement for a status pair. */
export function verdictSentence(ref: string, rag: EvidenceRag): string {
  if (rag.evidence === 'unknown') return `${ref} is reported ${ragWord(rag.reported)}; evidence is too thin to judge`;
  if (rag.disagrees) return `${ref} is reported ${ragWord(rag.reported)}; the evidence says ${ragWord(rag.evidence)}`;
  return `${ref} is ${ragWord(rag.reported)}, as reported and on evidence`;
}

const cache = new WeakMap<SlideEnv['result'], Map<string, DeliverableFacts>>();

export function deliverableFacts(env: SlideEnv, deliverableId: string): DeliverableFacts {
  let perResult = cache.get(env.result);
  if (!perResult) {
    perResult = new Map();
    cache.set(env.result, perResult);
  }
  // Drafts can change without the result changing, so they are not cached.
  const key = `${deliverableId}`;
  const hit = perResult.get(key);
  if (hit && hit.deliverable === env.idx.deliverables.get(deliverableId)) {
    return { ...hit, statusDraft: env.extras.statusDrafts.get(deliverableId) ?? null };
  }
  const facts = build(env, deliverableId);
  perResult.set(key, facts);
  return facts;
}

function build(env: SlideEnv, deliverableId: string): DeliverableFacts {
  const { idx, eng, result, data } = env;
  const d = idx.deliverables.get(deliverableId);
  const measures = result.deliverables[deliverableId];
  const rag = result.deliverableRag[deliverableId];
  if (!d || !measures || !rag) throw new Error('No deliverable matches this slide scope.');

  const findings = result.findings.filter((f) => f.deliverableId === d.id);
  const outcomes: OutcomeLine[] = (idx.outcomesByDeliverable.get(d.id) ?? []).map((o) => {
    const om = result.outcomes[o.id];
    const accepted = om?.acceptance.accepted ?? false;
    const of = findings.filter((f) => f.subject.kind === 'outcome' && f.subject.id === o.id);
    const gaps: string[] = [];
    if (!accepted && reportedOnTrack(o.reportedStatus)) gaps.push('Reported on track, not accepted');
    if (!accepted && o.dueDate < env.asOf) gaps.push('Past due');
    if (om && !om.workCompletion.computable) gaps.push('No linked work');
    return { outcome: o, measures: om, accepted, findings: of, gaps };
  });

  const deps: DependencyLine[] = [];
  for (const dep of data.dependencies) {
    const inbound = dep.toDeliverableId === d.id;
    const outbound = dep.fromDeliverableId === d.id;
    if (!inbound && !outbound) continue;
    deps.push({
      dependency: dep,
      direction: inbound ? 'inbound' : 'outbound',
      other: idx.deliverables.get(inbound ? dep.fromDeliverableId : dep.toDeliverableId),
      lateDays: dependencyLateDays(dep, env.extras.clock),
      troubled: isDependencyTroubled(dep, env.extras.clock),
      open: isDependencyOpen(dep),
    });
  }

  const pod = idx.pods.get(d.podId);
  const below = eng.belowEpicByDeliverable.get(d.id) ?? [];
  const epics = (eng.epicsByDeliverable.get(d.id) ?? d.epicKeys).map((key) => {
    const stories = (eng.childrenOf.get(key) ?? []).filter((w) => w.epicKey === key && w.type !== 'sub-task');
    return { key, item: idx.workItems.get(key), storyCount: stories.length, mappedCount: stories.filter((w) => w.outcomeId !== null).length };
  });

  return {
    deliverable: d,
    request: idx.investmentRequests.get(d.investmentRequestId),
    nodes: nodeChain(env, d.pmNodeId),
    measures,
    rag,
    views: { work: workView(measures.workCompletion), accepted: acceptedView(measures.acceptedOutcomes), readiness: readinessView(measures.readiness) },
    verdict: verdictSentence(d.ref, rag),
    findings,
    outcomes,
    forecast: env.forecasts.get(d.id),
    knockOnInto: env.knockOn.filter((k) => k.receiverId === d.id),
    raid: (eng.raidByDeliverable.get(d.id) ?? []).slice(),
    dependencies: deps,
    milestones: (eng.milestonesByDeliverable.get(d.id) ?? []).slice().sort((a, b) => a.date.localeCompare(b.date)),
    evidence: (idx.evidenceByDeliverable.get(d.id) ?? []).slice(),
    workflow: describeWorkflow(data, result, d.id),
    stageName: stageDefinition(idx.pdlcRunsByDeliverable.get(d.id)?.currentStage ?? d.pdlcStage).name,
    pod,
    members: (pod?.memberIds ?? []).map((id) => idx.people.get(id)).filter((p): p is Person => p !== undefined),
    agents: (pod?.agentIdentityIds ?? []).map((id) => idx.agentIdentities.get(id)).filter((a): a is AgentIdentity => a !== undefined),
    workShare: { human: below.filter((w) => w.assigneeType === 'human').length, agent: below.filter((w) => w.assigneeType === 'agent').length },
    epics,
    statusDraft: env.extras.statusDrafts.get(d.id) ?? null,
  };
}
