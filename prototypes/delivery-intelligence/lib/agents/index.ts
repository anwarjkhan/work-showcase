/**
 * Public entry point of lib/agents (D5). See README.md in this folder.
 *
 * Screens: list agents from the catalogue, start runs and drive the PDLC
 * workflow through `useDemoActions()` (lib/store), play steps with
 * `playbackAt`, and resolve citations with `resolveRef`.
 */
export { AGENT_CATALOGUE, AGENT_IDS, agentsForStage, crossCuttingAgents, type AgentCatalogueEntry, type AgentIconName } from './catalogue';
export { AGENTS, AGENT_LIST, getAgent, stageAgentId, acceptsScope, checkScope, runAgent, runScopeOf, runFindings, type RunResult } from './registry';
export { GOVERNANCE_RULES, ceilingFor, isAutoApplicable, initialStatus, checkApproval, checkRejection, requirePerson, type Check, type GovernanceCode } from './governance';
export { applyPatch, isEditable, EDITABLE_FIELDS, type PatchResult } from './patches';
export { playbackAt, playbackDuration, stepTimeline, type PlaybackView, type PlayState, type StepTiming } from './playback';
export { scriptedProvider, activeProvider } from './provider';
export { resolveRef, unresolvedRefs, type ResolvedRef } from './refs';
export { checkSimulateWorkClosed, describeWorkflow, latestEvidence, producingStage, SIMULATE_WORK_FROM, type SimulatedStep, type StageView, type WorkflowView } from './workflow';
export { scopeLabel, STEP_DURATION_MS } from './kit';
export type { AgentRunScope, AgentScopeKind, ProgrammeScope, ScriptedAgent, ScriptedAgentInput, ScriptedAgentRun } from './types';
