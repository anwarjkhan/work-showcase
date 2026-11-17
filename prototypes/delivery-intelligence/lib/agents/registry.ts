/**
 * The nine scripted agents, keyed by id, and the pure runner that executes one
 * against a snapshot. Store actions (lib/store/actions.ts) call `runAgent` and
 * store the result; screens normally use the actions, not this module.
 */
import { stageDefinition } from '@/lib/config/pdlc';
import type { AgentId, AgentRun, AgentRunOutput, DemoClock, EngineResult, PdlcStageId, PortfolioData } from '@/lib/types';
import { AGENT_IDS } from './catalogue';
import { controlEvidenceCheckAgent } from './definitions/control-evidence-check';
import { dependencyDiscoveryAgent } from './definitions/dependency-discovery';
import { executiveBriefingAgent } from './definitions/executive-briefing';
import { outcomeMappingAgent } from './definitions/outcome-mapping';
import { portfolioReconciliationAgent } from './definitions/portfolio-reconciliation';
import { raidQualityAgent } from './definitions/raid-quality';
import { releaseReadinessAgent } from './definitions/release-readiness';
import { requirementsStructuringAgent } from './definitions/requirements-structuring';
import { statusReportingAgent } from './definitions/status-reporting';
import type { AgentRunScope, ScriptedAgent, ScriptedAgentRun } from './types';

export const AGENTS: Record<AgentId, ScriptedAgent> = {
  'requirements-structuring': requirementsStructuringAgent,
  'outcome-mapping': outcomeMappingAgent,
  'control-evidence-check': controlEvidenceCheckAgent,
  'release-readiness': releaseReadinessAgent,
  'raid-quality': raidQualityAgent,
  'dependency-discovery': dependencyDiscoveryAgent,
  'portfolio-reconciliation': portfolioReconciliationAgent,
  'status-reporting': statusReportingAgent,
  'executive-briefing': executiveBriefingAgent,
};

/** All agents in catalogue order. */
export const AGENT_LIST: ScriptedAgent[] = AGENT_IDS.map((id) => AGENTS[id]);

export function getAgent(id: AgentId): ScriptedAgent | undefined {
  return AGENTS[id];
}

/** The agent that assists a PDLC stage (the first in config). */
export function stageAgentId(stageId: PdlcStageId): AgentId | null {
  return stageDefinition(stageId).agentAssist[0] ?? null;
}

export function acceptsScope(agent: ScriptedAgent, scope: AgentRunScope): boolean {
  return scope.kind === 'programme' ? agent.acceptsProgramme : agent.scopes.includes(scope.kind);
}

/** Checks the scope names real records and suits the agent; returns a refusal sentence when not. */
export function checkScope(agent: ScriptedAgent, scope: AgentRunScope, data: PortfolioData): string | null {
  if (!acceptsScope(agent, scope)) {
    const kinds = [...agent.scopes, ...(agent.acceptsProgramme ? ['programme'] : [])].map((k) => (k === 'pdlc-stage' ? 'a PDLC stage' : k === 'portfolio' ? 'the portfolio' : `a ${k}`));
    return `${agent.name} runs on ${kinds.join(' or ')}, not on ${scope.kind === 'pdlc-stage' ? 'a PDLC stage' : scope.kind === 'portfolio' ? 'the portfolio' : `a ${scope.kind}`}.`;
  }
  if ((scope.kind === 'deliverable' || scope.kind === 'pdlc-stage') && !data.deliverables.some((d) => d.id === scope.deliverableId)) {
    return 'That deliverable does not exist.';
  }
  if (scope.kind === 'programme' && !data.pmNodes.some((n) => n.id === scope.pmNodeId)) {
    return 'That programme does not exist.';
  }
  return null;
}

export type RunResult = { ok: true; output: AgentRunOutput } | { ok: false; reason: string };

/** Runs an agent on a snapshot. Pure and deterministic; refusals are returned, not thrown. */
export function runAgent(agentId: AgentId, scope: AgentRunScope, input: { data: PortfolioData; results: EngineResult; clock: DemoClock }): RunResult {
  const agent = getAgent(agentId);
  if (!agent) return { ok: false, reason: 'That agent does not exist.' };
  const problem = checkScope(agent, scope, input.data);
  if (problem) return { ok: false, reason: problem };
  try {
    return { ok: true, output: agent.run({ ...input, scope }) };
  } catch (error) {
    return { ok: false, reason: `${agent.name} could not complete: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/** The true scope of a stored run (programme runs store `{ kind: 'portfolio' }` in `scope`). */
export function runScopeOf(run: AgentRun): AgentRunScope {
  return (run as Partial<ScriptedAgentRun>).runScope ?? run.scope;
}

/** Findings the run raised (stored on the run; see ScriptedAgentRun). */
export function runFindings(run: AgentRun): ScriptedAgentRun['findings'] {
  return (run as Partial<ScriptedAgentRun>).findings ?? [];
}
