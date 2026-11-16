/**
 * Types local to lib/agents. They extend the shared contracts in lib/types.ts
 * without changing them.
 *
 * Programme scope: the shared `AgentScope` has no programme variant, so agents
 * accept `AgentRunScope` (the shared union plus `{ kind: 'programme' }`). A
 * stored `AgentRun.scope` for a programme run reads `{ kind: 'portfolio' }`;
 * always read the true scope with `runScopeOf(run)` (lib/agents/runner.ts).
 */
import type { AgentDefinition, AgentRun, AgentRunInput, AgentRunOutput, AgentScope, Finding } from '@/lib/types';

export type ProgrammeScope = { kind: 'programme'; pmNodeId: string };

/** Every scope an agent can be pointed at: a deliverable (or one of its PDLC stages), a programme, or the portfolio. */
export type AgentRunScope = AgentScope | ProgrammeScope;

export type AgentScopeKind = AgentRunScope['kind'];

export type ScriptedAgentInput = Omit<AgentRunInput, 'scope'> & { scope: AgentRunScope };

/** A scripted agent: an `AgentDefinition` whose `run` also accepts a programme scope. */
export interface ScriptedAgent extends AgentDefinition {
  /** True when the agent accepts `{ kind: 'programme' }` as well as `scopes`. */
  acceptsProgramme: boolean;
  run(input: ScriptedAgentInput): AgentRunOutput;
}

/**
 * The run as stored by the store actions. It is an `AgentRun` with two extra
 * fields: the findings the agent raised (the shared state has no other home for
 * them) and the true scope (see header).
 */
export interface ScriptedAgentRun extends AgentRun {
  findings: Finding[];
  runScope: AgentRunScope;
}
