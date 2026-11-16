/**
 * Dependency discovery (propose change). Looks for cross-deliverable
 * dependencies the plan does not record, from four signals:
 *   1. open work items that name another deliverable's ref or Epic key;
 *   2. blocked work items that no dependency record covers;
 *   3. dependency-type RAID items that no dependency record covers;
 *   4. open items labelled cross-hub whose wording strongly matches another deliverable.
 * For signals 2 to 4 the provider is the other deliverable whose title, summary,
 * Epics and outcomes share the most domain words with the item. One candidate
 * per receiver and provider pair, citing every item that suggests it.
 */
import { AGENT_CATALOGUE } from '@/lib/agents/catalogue';
import { terms } from '@/lib/config/terminology';
import { isClosed } from '@/lib/engine';
import type { AgentRunOutput, Dependency, EntityRef, RaidItem, TechDeliverable, WorkItem } from '@/lib/types';
import { AgentKit, compareKeys, date, listPhrases, plural, quote, ref, tokens } from '../kit';
import type { ScriptedAgent, ScriptedAgentInput } from '../types';

const meta = AGENT_CATALOGUE['dependency-discovery'];

/** Words that describe the kind of work rather than its subject; ignored when matching providers. */
const GENERIC = new Set(
  'add build capture sign off criteria automate reduce manual step instrument standardise standardize fix rounding differently source system production improve performance plan migration expose audit trail prototype archive validate configurable threshold publish update runbook configure draft release note backfill user level entitlement agree data contract set up monitoring onboard desk write unit test reconcile parameterise month end overnight batch asia time zone acceptance environment legal entities entity rate across handle support review report dashboard view new existing delivery deliver risk reporting layer based calculation calculate table store column mapping data model engine service desks equities equity'
    .split(' ')
    .flatMap((w) => [...tokens(w)]),
);

interface Candidate {
  receiver: TechDeliverable;
  provider: TechDeliverable;
  items: WorkItem[];
  raid: RaidItem[];
  signals: string[];
  shared: string[];
}

export const dependencyDiscoveryAgent: ScriptedAgent = {
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
    const receivers = kit.deliverables;
    const all = kit.data.deliverables;
    const coveredItems = new Set(kit.data.dependencies.map((d) => d.workItemKey).filter((k): k is string => !!k));
    const coveredRaid = new Set(kit.data.dependencies.map((d) => d.raidKey).filter((k): k is string => !!k));
    const pairs = new Set(kit.data.dependencies.filter((d) => d.status !== 'delivered').map((d) => `${d.toDeliverableId}<${d.fromDeliverableId}`));

    const open = receivers.flatMap((d) => kit.stories(d.id).filter((w) => !isClosed(w)).map((w) => ({ d, w })));
    kit.step('read', `Read ${plural(open.length, 'open work item')} and ${plural(kit.data.dependencies.length, 'recorded dependency', 'recorded dependencies')}`, `Receivers: ${plural(receivers.length, 'deliverable')} in ${kit.scopeLabel}; providers: all ${all.length}.`, receivers.slice(0, 25).map((d) => ref.deliverable(d.id)));

    // Provider profiles.
    const profiles = all.map((p) => {
      const epics = kit.epics(p.id).map((k) => kit.ctx.idx.workItems.get(k)?.summary ?? '');
      const outcomes = (kit.ctx.idx.outcomesByDeliverable.get(p.id) ?? []).map((o) => o.title);
      const words = new Set([...tokens([p.title, p.summary, ...epics, ...outcomes].join(' '))].filter((t) => !GENERIC.has(t)));
      return { p, words, epicKeys: new Set(kit.epics(p.id)) };
    });
    kit.step('compute', `Built a subject profile for each of ${plural(all.length, 'deliverable')}`, 'Title, summary, Epic and outcome wording, without generic work words.', []);

    const bestProvider = (text: string, receiver: TechDeliverable, min: number) => {
      const words = [...tokens(text)].filter((t) => !GENERIC.has(t));
      let best: { p: TechDeliverable; shared: string[] } | null = null;
      for (const prof of profiles) {
        if (prof.p.id === receiver.id) continue;
        const shared = words.filter((w) => prof.words.has(w));
        if (shared.length >= min && (!best || shared.length > best.shared.length || (shared.length === best.shared.length && compareKeys(prof.p.ref, best.p.ref) < 0))) best = { p: prof.p, shared };
      }
      return best;
    };

    const candidates = new Map<string, Candidate>();
    const add = (receiver: TechDeliverable, provider: TechDeliverable, signal: string, shared: string[], item?: WorkItem, raidItem?: RaidItem) => {
      const key = `${receiver.id}<${provider.id}`;
      if (pairs.has(key)) return;
      let c = candidates.get(key);
      if (!c) {
        c = { receiver, provider, items: [], raid: [], signals: [], shared: [] };
        candidates.set(key, c);
      }
      if (item && !c.items.includes(item)) c.items.push(item);
      if (raidItem && !c.raid.includes(raidItem)) c.raid.push(raidItem);
      if (!c.signals.includes(signal)) c.signals.push(signal);
      for (const s of shared) if (!c.shared.includes(s)) c.shared.push(s);
    };

    // Signal 1: explicit mentions.
    let mentions = 0;
    for (const { d, w } of open) {
      for (const prof of profiles) {
        if (prof.p.id === d.id) continue;
        const named = w.summary.includes(prof.p.ref) || [...prof.epicKeys].some((k) => new RegExp(`\\b${k}\\b`).test(w.summary));
        if (named) {
          add(d, prof.p, `names ${prof.p.ref}`, [], w);
          mentions++;
        }
      }
    }
    // Signal 2: blocked items with no dependency record.
    const blocked = open.filter(({ w }) => w.status.toLowerCase() === 'blocked' && !coveredItems.has(w.key));
    for (const { d, w } of blocked) {
      const best = bestProvider(w.summary, d, 2);
      if (best) add(d, best.p, 'blocked with no dependency recorded', best.shared, w);
    }
    // Signal 3: dependency RAID items with no dependency record.
    const raid = kit.data.raid.filter((r) => receivers.some((d) => d.id === r.deliverableId) && r.status !== 'closed' && (r.kind === 'dependency' || /\bdepend/i.test(r.title)) && !coveredRaid.has(r.key));
    for (const r of raid) {
      const d = kit.deliverable(r.deliverableId) as TechDeliverable;
      const best = bestProvider(`${r.title} ${r.description}`, d, 2);
      if (best) add(d, best.p, 'dependency RAID item with no dependency recorded', best.shared, undefined, r);
    }
    // Signal 4: cross-hub items with a strong subject match.
    const crossHub = open.filter(({ w }) => w.labels.includes('cross-hub') && !coveredItems.has(w.key));
    for (const { d, w } of crossHub) {
      const best = bestProvider(w.summary, d, 3);
      if (best) add(d, best.p, 'cross-hub item matching another deliverable', best.shared, w);
    }
    kit.step(
      'check',
      'Checked four signals for unrecorded dependencies',
      `${plural(mentions, 'item')} name another deliverable, ${plural(blocked.length, 'blocked item')} and ${plural(raid.length, 'dependency RAID item')} have no dependency record, ${plural(crossHub.length, 'cross-hub item')} checked.`,
      [...blocked.map(({ w }) => ref.item(w.key)), ...raid.map((r) => ref.raid(r.id))],
    );

    const list = [...candidates.values()].sort((a, b) => compareKeys(a.receiver.ref, b.receiver.ref) || compareKeys(a.provider.ref, b.provider.ref));
    for (const c of list) {
      const first = c.items[0];
      const r = c.raid[0];
      const nextMs = (kit.ctx.milestonesByDeliverable.get(c.receiver.id) ?? []).filter((m) => m.status === 'planned' && m.date >= kit.today).sort((a, b) => a.date.localeCompare(b.date))[0];
      const needBy = first?.due ?? r?.mitigationDue ?? nextMs?.date ?? c.receiver.plannedEnd;
      const isBlocked = c.items.some((w) => w.status.toLowerCase() === 'blocked');
      const critical = isBlocked || c.raid.some((x) => x.severity === 'critical' || x.severity === 'high');
      const status: Dependency['status'] = isBlocked ? 'blocked' : kit.daysFromToday(needBy) <= 14 ? 'at-risk' : 'on-track';
      const dep: Dependency = {
        id: `dep-agent-${c.receiver.id}-${c.provider.id}`,
        title: first?.summary ?? r?.title ?? `${c.provider.ref} to ${c.receiver.ref}`,
        fromDeliverableId: c.provider.id,
        toDeliverableId: c.receiver.id,
        fromHubId: c.provider.hubIds[0] ?? '',
        toHubId: first?.hubId ?? c.receiver.hubIds[0] ?? '',
        needBy,
        committed: null,
        deliveredOn: null,
        status,
        critical,
        raidKey: r?.key ?? null,
        workItemKey: first?.key ?? null,
        origin: 'agent-proposed',
      };
      const evidence: EntityRef[] = [ref.deliverable(c.receiver.id), ref.deliverable(c.provider.id), ...c.items.map((w) => ref.item(w.key)), ...c.raid.map((x) => ref.raid(x.id)), ...(nextMs && !first?.due && !r?.mitigationDue ? [ref.milestone(nextMs.id)] : [])];
      const basis = [...c.items.map((w) => `${w.key} ${quote(w.summary)}`), ...c.raid.map((x) => `${x.key} ${quote(x.title)}`)];
      kit.propose({
        agentId: 'dependency-discovery',
        deliverableId: c.receiver.id,
        target: ref.deliverable(c.receiver.id),
        title: `Record a dependency of ${c.receiver.ref} on ${c.provider.ref}`,
        rationale:
          `${listPhrases(basis)} ${basis.length === 1 ? 'suggests' : 'suggest'} ${c.receiver.ref} needs work from ${c.provider.ref} ${quote(c.provider.title)} (${listPhrases(c.signals)})` +
          (c.shared.length > 0 ? `; shared subject words: ${listPhrases(c.shared.slice(0, 5).map((s) => quote(s)))}.` : '.'),
        evidence,
        patch: { op: 'add-dependency', dependency: dep },
        beforeText: `No dependency recorded from ${c.provider.ref} to ${c.receiver.ref}.`,
        afterText: `${dep.critical ? 'Critical dependency' : 'Dependency'} ${quote(dep.title)} from ${c.provider.ref} (${kit.hubName(dep.fromHubId)}) to ${c.receiver.ref} (${kit.hubName(dep.toHubId)}), needed by ${date(needBy)}, no committed date, ${terms.dependencyStatus[status].toLowerCase()}.`,
        riskTier: first?.riskTier ?? c.receiver.riskTier,
        assigneeId: first?.assigneeId ?? r?.ownerId ?? null,
      });
    }
    kit.step('propose', `Proposed ${plural(list.length, 'candidate dependency', 'candidate dependencies')}`, list.length > 0 ? listPhrases(list.map((c) => `${c.provider.ref} to ${c.receiver.ref}`)) : 'No unrecorded dependency found.', list.map((c) => ref.deliverable(c.receiver.id)));
    return kit.output(`${plural(list.length, 'candidate dependency', 'candidate dependencies')} found in ${kit.scopeLabel}.`);
  },
};
