/**
 * Runs rules R1 to R16 and returns their findings, worst first
 * (severity, then rule number, then id), so output order is stable.
 */
import type { Finding, RuleId } from '@/lib/types';
import { type Rule, type RuleInput } from './rule-kit';
import { ruleR11, ruleR8 } from './rules-records';
import { ruleR4, ruleR7 } from './rules-raid';
import { ruleR12, ruleR13 } from './rules-evidence';
import { ruleR1, ruleR3, ruleR5, ruleR6 } from './rules-schedule';
import { ruleR15, ruleR16 } from './rules-team';
import { ruleR10, ruleR14, ruleR2, ruleR9 } from './rules-work';
import { compareIds, SEVERITY_RANK } from './util';

export const RULES: Record<RuleId, Rule> = {
  R1: ruleR1,
  R2: ruleR2,
  R3: ruleR3,
  R4: ruleR4,
  R5: ruleR5,
  R6: ruleR6,
  R7: ruleR7,
  R8: ruleR8,
  R9: ruleR9,
  R10: ruleR10,
  R11: ruleR11,
  R12: ruleR12,
  R13: ruleR13,
  R14: ruleR14,
  R15: ruleR15,
  R16: ruleR16,
};

export const RULE_IDS = Object.keys(RULES) as RuleId[];

export function compareFindings(a: Finding, b: Finding): number {
  return (
    SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
    Number(a.ruleId.slice(1)) - Number(b.ruleId.slice(1)) ||
    compareIds(a.id, b.id)
  );
}

export function runRules(input: RuleInput, only?: RuleId[]): Finding[] {
  const out: Finding[] = [];
  for (const id of only ?? RULE_IDS) out.push(...RULES[id](input));
  return out.sort(compareFindings);
}
