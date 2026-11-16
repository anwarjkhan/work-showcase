/**
 * Shared toolkit for the scripted agents: scope resolution, step recording,
 * cited sentences, proposal building and wording helpers. Pure; no clock other
 * than the one in the input, no randomness.
 */
import { addDays } from '@/lib/config/clock';
import { autonomyFor } from '@/lib/config/risk-tiers';
import { terms } from '@/lib/config/terminology';
import { buildContext, type EngineContext } from '@/lib/engine';
import { date, days, listPhrases, lowerFirst, plural, quote } from '@/lib/engine/messages';
import type {
  AgentRunOutput,
  AgentStepKind,
  AgentStepSpec,
  DraftSection,
  DraftSentence,
  EntityRef,
  Finding,
  PortfolioData,
  ProposedChangeSpec,
  RiskTier,
  RuleId,
  Severity,
  TechDeliverable,
  WorkItem,
} from '@/lib/types';
import type { AgentRunScope, ScriptedAgentInput } from './types';

export { date, days, listPhrases, lowerFirst, plural, quote };

/** Lower-cases the first letter unless the first word is an acronym or key ("TD-1001", "RAID"). */
export function softLower(text: string): string {
  return /^[A-Z][A-Z0-9-]/.test(text) ? text : lowerFirst(text);
}

/** Suggested playback time per step kind, in milliseconds. */
export const STEP_DURATION_MS: Record<AgentStepKind, number> = {
  read: 900,
  compute: 800,
  check: 1000,
  propose: 700,
  draft: 1100,
  note: 600,
  blocked: 700,
};

export const ref = {
  deliverable: (id: string): EntityRef => ({ kind: 'deliverable', id }),
  pmNode: (id: string): EntityRef => ({ kind: 'pm-node', id }),
  outcome: (id: string): EntityRef => ({ kind: 'outcome', id }),
  criterion: (id: string): EntityRef => ({ kind: 'criterion', id }),
  item: (key: string): EntityRef => ({ kind: 'work-item', id: key }),
  evidence: (id: string): EntityRef => ({ kind: 'evidence', id }),
  raid: (id: string): EntityRef => ({ kind: 'raid', id }),
  dependency: (id: string): EntityRef => ({ kind: 'dependency', id }),
  milestone: (id: string): EntityRef => ({ kind: 'milestone', id }),
  person: (id: string): EntityRef => ({ kind: 'person', id }),
  finding: (id: string): EntityRef => ({ kind: 'finding', id }),
  pdlcRun: (id: string): EntityRef => ({ kind: 'pdlc-run', id }),
};

export function dedupeRefs(refs: EntityRef[]): EntityRef[] {
  const seen = new Set<string>();
  const out: EntityRef[] = [];
  for (const r of refs) {
    const k = `${r.kind}:${r.id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

/** Scope label for steps and titles, e.g. "TD-1001", "programme PG-CCR", "the portfolio". */
export function scopeLabel(data: PortfolioData, scope: AgentRunScope): string {
  switch (scope.kind) {
    case 'portfolio':
      return 'the portfolio';
    case 'programme': {
      const node = data.pmNodes.find((n) => n.id === scope.pmNodeId);
      return node ? `${lowerFirst(terms.pmNodeLevels[node.level])} ${node.ref} ${quote(node.title)}` : scope.pmNodeId;
    }
    case 'deliverable':
    case 'pdlc-stage': {
      const d = data.deliverables.find((x) => x.id === scope.deliverableId);
      return d ? d.ref : scope.deliverableId;
    }
  }
}

/** Gerund of the first word of a phrase: "filter limit breaches" -> "filtering limit breaches". */
export function gerund(phrase: string): string {
  const [first = '', ...rest] = phrase.split(' ');
  let g: string;
  if (/ee$/.test(first)) g = `${first}ing`;
  else if (/ie$/.test(first)) g = `${first.slice(0, -2)}ying`;
  else if (/[^aeiou]e$/.test(first)) g = `${first.slice(0, -1)}ing`;
  else g = `${first}ing`;
  return [g, ...rest].join(' ');
}

const STOP = new Set(['a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'is', 'of', 'on', 'or', 'the', 'to', 'with', 'can', 'are', 'be', 'their', 'they', 'it', 'its', 'as', 'that', 'this', 'into', 'per', 'all', 'each', 'every', 'one']);

function stem(token: string): string {
  if (token.length <= 3) return token;
  if (/ies$/.test(token)) return `${token.slice(0, -3)}y`;
  if (/(ches|shes|sses|xes)$/.test(token)) return token.slice(0, -2);
  if (/s$/.test(token) && !/ss$/.test(token)) return token.slice(0, -1);
  return token;
}

/** Content words of a text, lower-cased and lightly stemmed. */
export function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 1 && !STOP.has(t))
      .map(stem),
  );
}

/** Shared content words of two texts (stems). */
export function sharedTokens(a: string, b: string): string[] {
  const tb = tokens(b);
  return [...tokens(a)].filter((t) => tb.has(t));
}

/** Overlap of `a` with `b` relative to the size of `a` (0..1). */
export function coverage(a: string, b: string): number {
  const ta = tokens(a);
  if (ta.size === 0) return 0;
  return sharedTokens(a, b).length / ta.size;
}

/** Natural compare for keys such as "CCR-9" and "CCR-10". */
const collator = new Intl.Collator('en', { numeric: true });
export const compareKeys = (a: string, b: string) => collator.compare(a, b);

const SEVERITY_RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };
export const bySeverity = (a: { severity: Severity }, b: { severity: Severity }) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];

/**
 * Everything an agent's `run` needs: the input, an engine context, the scope's
 * deliverables, and recorders for steps, findings, proposals and draft sections.
 */
export class AgentKit {
  readonly ctx: EngineContext;
  readonly data: PortfolioData;
  readonly input: ScriptedAgentInput;
  /** Deliverables in scope, in data order. */
  readonly deliverables: TechDeliverable[];
  readonly scopeLabel: string;
  readonly steps: AgentStepSpec[] = [];
  readonly findings: AgentRunOutput['findings'] = [];
  readonly proposals: ProposedChangeSpec[] = [];
  readonly sections: DraftSection[] = [];
  private sentenceCount = 0;

  constructor(input: ScriptedAgentInput) {
    this.input = input;
    this.data = input.data;
    this.ctx = buildContext(input.data, input.clock);
    this.deliverables = deliverablesInScope(input.data, this.ctx, input.scope);
    this.scopeLabel = scopeLabel(input.data, input.scope);
  }

  get results() {
    return this.input.results;
  }
  get today() {
    return this.input.clock.today;
  }
  get scope() {
    return this.input.scope;
  }

  step(kind: AgentStepKind, label: string, detail: string, refs: EntityRef[] = []): void {
    this.steps.push({ kind, label, detail, refs: dedupeRefs(refs).slice(0, 25), durationMs: STEP_DURATION_MS[kind] });
  }

  finding(ruleId: RuleId, severity: Severity, subject: EntityRef, deliverableId: string | null, message: string, evidence: EntityRef[] = []): void {
    this.findings.push({ ruleId, severity, subject, deliverableId, message, evidence: dedupeRefs([subject, ...evidence]), provenance: 'scripted-agent' });
  }

  /** Records a proposed change; the autonomy ceiling is set from the risk tier (lib/config/risk-tiers.ts). */
  propose(spec: Omit<ProposedChangeSpec, 'ceiling'>): void {
    this.proposals.push({ ...spec, ceiling: autonomyFor(spec.riskTier), evidence: dedupeRefs(spec.evidence) });
  }

  /** A cited sentence. Every sentence must cite at least one record; `fallback` is cited when `refs` is empty. */
  sentence(text: string, refs: EntityRef[], fallback?: EntityRef): DraftSentence {
    this.sentenceCount += 1;
    let citations = dedupeRefs(this.records(refs));
    if (citations.length === 0 && fallback) citations = [fallback];
    if (citations.length === 0) throw new Error(`Uncited sentence: ${text}`);
    return { id: `s${this.sentenceCount}`, text, citations: citations.slice(0, 12) };
  }

  section(heading: string, sentences: DraftSentence[]): void {
    if (sentences.length > 0) this.sections.push({ heading, sentences });
  }

  private findingIndex: Map<string, Finding> | null = null;

  /**
   * Replaces references to engine findings with the records behind them, so a
   * citation always opens a record rather than a computed finding.
   */
  records(refs: EntityRef[]): EntityRef[] {
    if (!refs.some((r) => r.kind === 'finding')) return refs;
    if (!this.findingIndex) this.findingIndex = new Map(this.results.findings.map((f) => [f.id, f]));
    return refs.flatMap((r) => {
      if (r.kind !== 'finding') return [r];
      const f = this.findingIndex?.get(r.id);
      return f ? [f.subject, ...f.evidence] : [];
    });
  }

  // --- Lookups -------------------------------------------------------------

  person(id: string | null | undefined): string {
    if (!id) return 'nobody';
    return this.ctx.idx.people.get(id)?.name ?? this.ctx.idx.agentIdentities.get(id)?.handle ?? id;
  }

  deliverable(id: string): TechDeliverable | undefined {
    return this.ctx.idx.deliverables.get(id);
  }

  hubName(id: string | null | undefined): string {
    return (id && this.ctx.idx.hubs.get(id)?.name) || 'an unnamed hub';
  }

  /** Story-level items of a deliverable. */
  stories(deliverableId: string): WorkItem[] {
    return this.ctx.storiesByDeliverable.get(deliverableId) ?? [];
  }

  epics(deliverableId: string): string[] {
    return this.ctx.epicsByDeliverable.get(deliverableId) ?? [];
  }

  tierOf(d: TechDeliverable, item?: WorkItem | null): RiskTier {
    return item?.riskTier ?? d.riskTier;
  }

  /** Engine findings for the deliverables in scope. */
  engineFindings(filter?: (f: Finding) => boolean): Finding[] {
    const ids = new Set(this.deliverables.map((d) => d.id));
    return this.results.findings.filter((f) => f.deliverableId !== null && ids.has(f.deliverableId) && (!filter || filter(f)));
  }

  /** "in 9 days" / "9 days ago" / "today" from today to `d`. */
  relative(d: string): string {
    const n = Math.round((Date.parse(d.slice(0, 10)) - Date.parse(this.today)) / 86_400_000);
    if (n === 0) return 'today';
    return n > 0 ? `in ${days(n)}` : `${days(n)} ago`;
  }

  daysFromToday(d: string): number {
    return Math.round((Date.parse(d.slice(0, 10)) - Date.parse(this.today)) / 86_400_000);
  }

  plusDays(n: number): string {
    return addDays(this.today, n);
  }

  output(summary: string, draft: AgentRunOutput['draft'] = null): AgentRunOutput {
    return { steps: this.steps, findings: this.findings, proposals: this.proposals, draft, summary };
  }
}

export function deliverablesInScope(data: PortfolioData, ctx: EngineContext, scope: AgentRunScope): TechDeliverable[] {
  switch (scope.kind) {
    case 'portfolio':
      return data.deliverables;
    case 'programme': {
      const ids = new Set(ctx.deliverablesUnderPmNode.get(scope.pmNodeId) ?? []);
      return data.deliverables.filter((d) => ids.has(d.id));
    }
    case 'deliverable':
    case 'pdlc-stage':
      return data.deliverables.filter((d) => d.id === scope.deliverableId);
  }
}
