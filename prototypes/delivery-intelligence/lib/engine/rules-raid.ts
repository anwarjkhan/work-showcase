/**
 * RAID quality rules.
 *   R4  Open RAID item with no owner, no mitigation date, or no update for the stale window.
 *   R7  Likely duplicate RAID items: open items of the same deliverable whose titles
 *       overlap (token Jaccard at or above the configured similarity).
 */
import { terms } from '@/lib/config/terminology';
import type { Finding, RaidItem } from '@/lib/types';
import { DUPLICATE_STOP_WORDS, RULE_THRESHOLDS } from './constants';
import { days, listPhrases, pct, quote } from './messages';
import { finding, ref, type Rule } from './rule-kit';
import { compareIds, dayDiff, toMs } from './util';

export const ruleR4: Rule = ({ ctx }) => {
  const out: Finding[] = [];
  for (const r of ctx.data.raid) {
    if (r.status === 'closed') continue;
    const problems: string[] = [];
    if (!r.ownerId || !ctx.idx.people.has(r.ownerId)) problems.push('no owner');
    if (!r.mitigationDue) problems.push('no mitigation date');
    const idle = dayDiff(r.updated, ctx.clock.today);
    if (idle >= RULE_THRESHOLDS.raidStaleDays) problems.push(`no update for ${days(idle)}`);
    if (problems.length === 0) continue;
    out.push(
      finding(
        ctx,
        'R4',
        ref.raid(r.id),
        r.deliverableId,
        `${terms.raidKinds[r.kind]} ${r.key} ${quote(r.title)} (${terms.severity[r.severity]}) has ${listPhrases(problems)}.`,
        r.ownerId && ctx.idx.people.has(r.ownerId) ? [ref.person(r.ownerId)] : [],
      ),
    );
  }
  return out;
};

export function titleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 0 && !DUPLICATE_STOP_WORDS.has(t)),
  );
}

/** Token Jaccard similarity of two titles, 0..1. */
export function titleSimilarity(a: string, b: string): number {
  const ta = titleTokens(a);
  const tb = titleTokens(b);
  if (ta.size === 0 && tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / (ta.size + tb.size - shared);
}

export const ruleR7: Rule = ({ ctx }) => {
  const out: Finding[] = [];
  for (const [deliverableId, items] of ctx.raidByDeliverable) {
    const open = items
      .filter((r) => r.status !== 'closed')
      .sort((a, b) => toMs(a.created) - toMs(b.created) || compareIds(a.key, b.key));
    const flagged = new Set<string>();
    for (let i = 0; i < open.length; i++) {
      for (let j = i + 1; j < open.length; j++) {
        const keep = open[i] as RaidItem;
        const dup = open[j] as RaidItem;
        if (flagged.has(dup.id)) continue;
        const similarity = titleSimilarity(keep.title, dup.title);
        if (similarity < RULE_THRESHOLDS.raidDuplicateSimilarity) continue;
        flagged.add(dup.id);
        out.push(
          finding(
            ctx,
            'R7',
            ref.raid(dup.id),
            deliverableId,
            `${dup.key} ${quote(dup.title)} looks like a duplicate of ${keep.key} ${quote(keep.title)} ` +
              `(${pct(similarity)} title overlap); ${keep.key} was raised first.`,
            [ref.raid(keep.id)],
          ),
        );
      }
    }
  }
  return out;
};
