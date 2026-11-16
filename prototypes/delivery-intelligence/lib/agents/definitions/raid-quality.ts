/**
 * RAID quality (propose change). For open RAID items it proposes:
 *   - an owner where there is none (the deliverable owner, until delegated);
 *   - a mitigation date where there is none (by severity, never after the
 *     deliverable's next milestone or planned end);
 *   - merging likely duplicates into the item raised first.
 * Items with no update for 14 days or more are reported: only the owner can
 * update them, so no change is proposed.
 */
import { AGENT_CATALOGUE } from '@/lib/agents/catalogue';
import { RULE_THRESHOLDS } from '@/lib/config/thresholds';
import { terms } from '@/lib/config/terminology';
import { titleSimilarity } from '@/lib/engine';
import type { AgentRunOutput, RaidItem, Severity } from '@/lib/types';
import { AgentKit, bySeverity, compareKeys, date, days, listPhrases, lowerFirst, plural, quote, ref } from '../kit';
import type { ScriptedAgent, ScriptedAgentInput } from '../types';

const meta = AGENT_CATALOGUE['raid-quality'];
/** Days from today to propose as a mitigation date, by severity. */
export const MITIGATION_DAYS: Record<Severity, number> = { critical: 7, high: 14, medium: 21, low: 28 };

export const raidQualityAgent: ScriptedAgent = {
  id: meta.id,
  name: meta.name,
  purpose: meta.purpose,
  stages: meta.stages,
  mode: meta.mode,
  output: meta.output,
  scopes: ['portfolio', 'deliverable'],
  acceptsProgramme: true,
  provenance: 'scripted-agent',
  run(input: ScriptedAgentInput): AgentRunOutput {
    const kit = new AgentKit(input);
    const ids = new Set(kit.deliverables.map((d) => d.id));
    const all = kit.data.raid.filter((r) => ids.has(r.deliverableId));
    const open = all.filter((r) => r.status !== 'closed').sort((a, b) => bySeverity(a, b) || compareKeys(a.key, b.key));
    kit.step('read', `Read ${plural(all.length, 'RAID item')} in ${kit.scopeLabel}`, `${open.length} open, ${all.length - open.length} closed.`, open.slice(0, 25).map((r) => ref.raid(r.id)));

    const noOwner = open.filter((r) => !r.ownerId || !kit.ctx.idx.people.has(r.ownerId));
    const noDate = open.filter((r) => !r.mitigationDue);
    const stale = open.filter((r) => -kit.daysFromToday(r.updated) >= RULE_THRESHOLDS.raidStaleDays);
    kit.step(
      'check',
      `Checked ${plural(open.length, 'open item')} for owner, mitigation date and last update`,
      `Found ${plural(noOwner.length, 'item')} with no owner, ${noDate.length} with no mitigation date, ${stale.length} with no update for ${RULE_THRESHOLDS.raidStaleDays} days or more.`,
      [...noOwner, ...noDate, ...stale].map((r) => ref.raid(r.id)),
    );

    let count = 0;
    for (const r of noOwner) {
      const d = kit.deliverable(r.deliverableId);
      if (!d) continue;
      kit.propose({
        agentId: 'raid-quality',
        deliverableId: d.id,
        target: ref.raid(r.id),
        title: `Assign an owner to ${r.key}`,
        rationale: `${terms.raidKinds[r.kind]} ${r.key} ${quote(r.title)} (${lowerFirst(terms.severity[r.severity])}) has no owner; ${kit.person(d.ownerId)} owns ${d.ref} and is accountable until it is delegated.`,
        evidence: [ref.raid(r.id), ref.deliverable(d.id), ref.person(d.ownerId)],
        patch: { op: 'set-field', entity: 'raid', id: r.id, field: 'ownerId', before: r.ownerId, after: d.ownerId },
        beforeText: 'Owner: none',
        afterText: `Owner: ${kit.person(d.ownerId)}`,
        riskTier: d.riskTier,
        assigneeId: null,
      });
      count++;
    }
    for (const r of noDate) {
      const d = kit.deliverable(r.deliverableId);
      if (!d) continue;
      let due = kit.plusDays(MITIGATION_DAYS[r.severity]);
      let why = `${MITIGATION_DAYS[r.severity]} days for a ${lowerFirst(terms.severity[r.severity])} item`;
      const nextMs = (kit.ctx.milestonesByDeliverable.get(d.id) ?? []).filter((m) => m.status === 'planned' && m.date > kit.today).sort((a, b) => a.date.localeCompare(b.date))[0];
      if (nextMs && nextMs.date < due) {
        due = nextMs.date;
        why = `the date of ${quote(nextMs.title)}, the next milestone`;
      }
      if (d.plannedEnd < due && d.plannedEnd > kit.today) {
        due = d.plannedEnd;
        why = `${d.ref}'s planned end`;
      }
      kit.propose({
        agentId: 'raid-quality',
        deliverableId: d.id,
        target: ref.raid(r.id),
        title: `Set a mitigation date on ${r.key}`,
        rationale: `${r.key} ${quote(r.title)} has no mitigation date; proposed ${date(due)}, ${why}.`,
        evidence: [ref.raid(r.id), ...(nextMs ? [ref.milestone(nextMs.id)] : [ref.deliverable(d.id)])],
        patch: { op: 'set-field', entity: 'raid', id: r.id, field: 'mitigationDue', before: r.mitigationDue, after: due },
        beforeText: 'Mitigation due: none',
        afterText: `Mitigation due: ${date(due)}`,
        riskTier: d.riskTier,
        assigneeId: r.ownerId,
      });
      count++;
    }
    for (const r of stale) {
      const idle = -kit.daysFromToday(r.updated);
      kit.finding('R4', 'medium', ref.raid(r.id), r.deliverableId, `${r.key} ${quote(r.title)} has had no update for ${days(idle)}; ${r.ownerId ? `${kit.person(r.ownerId)} should confirm it is current` : 'it also has no owner'}.`, r.ownerId ? [ref.person(r.ownerId)] : []);
    }

    // Duplicates within each deliverable: the later item merges into the earlier one.
    const merges: [RaidItem, RaidItem, number][] = [];
    for (const d of kit.deliverables) {
      const items = open.filter((r) => r.deliverableId === d.id).sort((a, b) => a.created.localeCompare(b.created) || compareKeys(a.key, b.key));
      const merged = new Set<string>();
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const keep = items[i] as RaidItem;
          const dup = items[j] as RaidItem;
          if (merged.has(dup.id) || merged.has(keep.id)) continue;
          const sim = titleSimilarity(keep.title, dup.title);
          if (sim < RULE_THRESHOLDS.raidDuplicateSimilarity) continue;
          merged.add(dup.id);
          merges.push([keep, dup, sim]);
        }
      }
    }
    kit.step('compute', `Compared titles of open items within each deliverable`, `${plural(merges.length, 'likely duplicate')} at ${Math.round(RULE_THRESHOLDS.raidDuplicateSimilarity * 100)}% title overlap or more.`, merges.flatMap(([k, d]) => [ref.raid(k.id), ref.raid(d.id)]));
    for (const [keep, dup, sim] of merges) {
      const d = kit.deliverable(dup.deliverableId);
      if (!d) continue;
      kit.propose({
        agentId: 'raid-quality',
        deliverableId: d.id,
        target: ref.raid(dup.id),
        title: `Merge ${dup.key} into ${keep.key}`,
        rationale: `${dup.key} ${quote(dup.title)} and ${keep.key} ${quote(keep.title)} overlap by ${Math.round(sim * 100)}% of their title words; ${keep.key} was raised first on ${date(keep.created)}.`,
        evidence: [ref.raid(dup.id), ref.raid(keep.id)],
        patch: { op: 'merge-raid', keepId: keep.id, duplicateId: dup.id },
        beforeText: `${dup.key} open (${lowerFirst(terms.severity[dup.severity])}); ${keep.key} open (${lowerFirst(terms.severity[keep.severity])})`,
        afterText: `${dup.key} closed as a duplicate; ${keep.key} kept${bySeverity(dup, keep) < 0 ? ` at ${lowerFirst(terms.severity[dup.severity])} severity` : ''}`,
        riskTier: d.riskTier,
        assigneeId: dup.ownerId,
      });
      count++;
    }
    kit.step('propose', `Proposed ${plural(count, 'fix', 'fixes')}`, listPhrases([`${noOwner.length} owner`, `${noDate.length} date`, `${merges.length} merge`]) + '.', []);
    return kit.output(`${plural(count, 'RAID fix', 'RAID fixes')} proposed; ${plural(stale.length, 'stale item')} reported.`);
  },
};
