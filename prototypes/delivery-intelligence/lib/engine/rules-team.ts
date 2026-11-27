/**
 * Core Four rules (the pod roles every deliverable needs before work starts).
 *   R15  Core Four incomplete. One finding per deliverable for missing roles
 *        (severity from CORE_TEAM_SEVERITY: a missing In-Business Risk Lead on a
 *        T3 or T4 deliverable is high, anything else the base medium), and one
 *        per person holding two or more core roles on the same deliverable (base
 *        severity). Every deliverable is at or beyond the first stage, so all are checked.
 *   R16  Work started before the Core Four was complete: the start of work (see
 *        `workStartedAt`: the earliest moment a story-level item provably left "to do")
 *        is before the latest `joinedAt` among the filled seats, beyond the configured
 *        tolerance, or a core role is still unfilled once work has started.
 */
import { CORE_TEAM_SEVERITY, RULE_SEVERITY, RULE_THRESHOLDS } from '@/lib/config/thresholds';
import { terms } from '@/lib/config/terminology';
import type { CoreRole, EntityRef, Finding, Severity, TechDeliverable } from '@/lib/types';
import { coreTeamSeats, missingCoreRoles, sharedCoreSeats, workStartedAt } from './core-team';
import { date, listPhrases } from './messages';
import { finding, ref, type Rule } from './rule-kit';
import { dayDiff, SEVERITY_RANK } from './util';

const role = (r: CoreRole) => terms.coreRoles[r];

/** Severity of a missing core role on a deliverable, from config. */
export function missingRoleSeverity(d: Pick<TechDeliverable, 'riskTier'>, roleId: CoreRole): Severity {
  const raised = CORE_TEAM_SEVERITY.find((c) => c.role === roleId && c.tiers.includes(d.riskTier));
  return raised ? raised.severity : RULE_SEVERITY.R15;
}

export const ruleR15: Rule = ({ ctx }) => {
  const out: Finding[] = [];
  for (const d of ctx.data.deliverables) {
    const dRef = ref.deliverable(d.id);
    const missing = missingCoreRoles(d);
    if (missing.length > 0) {
      const severity = missing.map((r) => missingRoleSeverity(d, r)).reduce((a, b) => (SEVERITY_RANK[b] > SEVERITY_RANK[a] ? b : a));
      const named = coreTeamSeats(d).filter((s) => s.personId).map((s) => ref.person(s.personId as string));
      out.push(
        finding(
          ctx,
          'R15',
          dRef,
          d.id,
          `${d.ref} has no ${listPhrases(missing.map(role))} named in its ${terms.coreTeam.name}` +
            (severity !== RULE_SEVERITY.R15 ? `; ${terms.riskTiers[d.riskTier]} work needs ${missing.length === 1 ? 'that role' : 'those roles'} filled before it moves on.` : '.'),
          named,
          'missing',
          severity,
        ),
      );
    }
    for (const shared of sharedCoreSeats(d)) {
      const name = ctx.idx.people.get(shared.personId)?.name ?? shared.personId;
      out.push(
        finding(
          ctx,
          'R15',
          dRef,
          d.id,
          `${name} holds both the ${listPhrases(shared.roles.map(role))} roles on ${d.ref}; each core role needs a different person.`,
          [ref.person(shared.personId)],
          `shared-${shared.personId}`,
        ),
      );
    }
  }
  return out;
};

export const ruleR16: Rule = ({ ctx }) => {
  const out: Finding[] = [];
  const tolerance = RULE_THRESHOLDS.coreTeamLateJoinToleranceDays;
  for (const d of ctx.data.deliverables) {
    const started = workStartedAt(ctx.storiesByDeliverable.get(d.id) ?? []);
    if (!started) continue;
    const seats = coreTeamSeats(d);
    const late = seats.filter((s) => s.personId && s.joinedAt && dayDiff(started.at, s.joinedAt) > tolerance);
    const unfilled = seats.filter((s) => !s.personId);
    if (late.length === 0 && unfilled.length === 0) continue;
    const parts: string[] = [];
    const lateNames = late.map((s) => `the ${role(s.roleId)} (${ctx.idx.people.get(s.personId as string)?.name ?? s.personId}) joined on ${date(s.joinedAt as string)}`);
    if (lateNames.length > 0) parts.push(listPhrases(lateNames));
    if (unfilled.length > 0) parts.push(`the ${listPhrases(unfilled.map((s) => role(s.roleId)))} ${unfilled.length === 1 ? 'role is' : 'roles are'} still unfilled`);
    const evidence: EntityRef[] = [ref.item(started.key), ...late.map((s) => ref.person(s.personId as string))];
    out.push(
      finding(
        ctx,
        'R16',
        ref.deliverable(d.id),
        d.id,
        `Work on ${d.ref} had started by ${date(started.at)} (${started.key} had moved out of ${terms.statusCategories['to-do'].toLowerCase()}) before its ${terms.coreTeam.name} was complete: ${parts.join(', and ')}.`,
        evidence,
      ),
    );
  }
  return out;
};
