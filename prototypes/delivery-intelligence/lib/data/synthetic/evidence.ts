/**
 * Evidence records for the generated deliverables. Evidence follows each
 * deliverable's PDLC stage: later stages hold more kinds. Results are mostly
 * passing, with some failing, pending and (deliberately) stale records.
 * Stale means the covered work changed after the evidence was observed.
 *
 * Every record is tied to a closed work item that was last updated before the
 * evidence was observed, so only the records planted as stale are stale.
 */
import { PDLC_STAGE_IDS } from '@/lib/config/pdlc';
import type { Evidence, EvidenceKind, PdlcStageId, ReviewRoleId, SourceSystemId, WorkItem } from '@/lib/types';
import { PENDING_RELEASE, type DeliverableSpec } from './catalogue';
import { addDays, clampDate, dateOf, daysBetween, stamp, stampOn, TODAY } from './dates';
import type { Hierarchy } from './hierarchy';
import { isStoryLevel } from './workitems';
import type { AcceptanceDates, OutcomePlan } from './outcomes';
import type { Rng } from './random';

const KIND_STAGE: Record<EvidenceKind, PdlcStageId> = {
  'requirements-sign-off': 'ideation-requirements',
  'design-review': 'design-specifications',
  'control-assessment': 'risk-control-compliance',
  'test-result': 'build-test-validate',
  'business-acceptance': 'delivery-launch',
  'release-checklist': 'delivery-launch',
};

const KIND_SOURCE: Record<EvidenceKind, SourceSystemId> = {
  'requirements-sign-off': 'document-store',
  'design-review': 'document-store',
  'control-assessment': 'control-register',
  'test-result': 'test-harness',
  'business-acceptance': 'document-store',
  'release-checklist': 'release-tool',
};

const KIND_REVIEWER: Partial<Record<EvidenceKind, ReviewRoleId>> = {
  'requirements-sign-off': 'requirements-owner',
  'design-review': 'design-reviewer',
  'control-assessment': 'control-owner',
  'business-acceptance': 'business-owner',
  'release-checklist': 'release-owner',
};

const KIND_PREFIX: Record<EvidenceKind, string> = {
  'requirements-sign-off': 'DOC',
  'design-review': 'DOC',
  'control-assessment': 'CTL',
  'test-result': 'RUN',
  'business-acceptance': 'DOC',
  'release-checklist': 'REL',
};

const KIND_SHORT: Record<EvidenceKind, string> = {
  'requirements-sign-off': 'rs',
  'design-review': 'dr',
  'control-assessment': 'ca',
  'test-result': 'tr',
  'business-acceptance': 'ba',
  'release-checklist': 'rc',
};

const TEST_KINDS = ['Regression suite', 'Integration run', 'Reconciliation check', 'Performance run', 'User acceptance scenarios', 'Data validation pack', 'End-to-end batch run'];

function trimTitle(title: string): string {
  return title.length > 58 ? `${title.slice(0, 55).trimEnd()}...` : title;
}

export function buildEvidence(root: Rng, hierarchy: Hierarchy, plan: OutcomePlan, acceptance: AcceptanceDates, items: WorkItem[]): Evidence[] {
  const rng = root.fork('evidence');
  const evidence: Evidence[] = [];
  const itemsByEpic = new Map<string, WorkItem[]>();
  for (const item of items) if (item.epicKey) itemsByEpic.set(item.epicKey, [...(itemsByEpic.get(item.epicKey) ?? []), item]);
  let runCounter = 5600;
  let docCounter = 1400;

  for (const deliverable of hierarchy.deliverables) {
    const spec = hierarchy.specs.get(deliverable.id) as DeliverableSpec;
    if (spec.pinned) continue;
    if (spec.stage === 'ideation-requirements') {
      // Not-started deliverables hold no evidence, except where a requirements sign-off has been requested.
      if (spec.n % 2 === 0) {
        const own = deliverable.epicKeys[0] as string;
        evidence.push({
          id: `ev-${spec.n}-rs-01`, kind: 'requirements-sign-off', title: `Requirements sign-off — ${trimTitle(spec.title)}`, deliverableId: spec.id, outcomeId: null, workItemKey: own,
          stageId: 'ideation-requirements', result: 'pending', source: 'document-store', sourceRef: `DOC-${(docCounter += 7)}`, observedAt: stamp(addDays(TODAY, -1), 18, 0),
          recordedById: deliverable.reviewers['requirements-owner'] ?? null, provenance: 'sample',
        });
      }
      continue;
    }
    const dr = rng.fork(spec.id);
    const stageIndex = PDLC_STAGE_IDS.indexOf(spec.stage);
    const flags = spec.flags ?? {};

    const own = deliverable.epicKeys.flatMap((k) => itemsByEpic.get(k) ?? []).filter(isStoryLevel);
    const done = own.filter((i) => i.statusCategory === 'done' && i.resolved).sort((a, b) => ((a.resolved as string) < (b.resolved as string) ? -1 : 1));
    const usedKeys = new Set<string>();
    const sequence: Partial<Record<EvidenceKind, number>> = {};

    const span = Math.max(1, Math.min(daysBetween(spec.start, TODAY), daysBetween(spec.start, spec.end)));
    const at = (fraction: number): string =>
      clampDate(addDays(spec.start, Math.round(span * fraction)), addDays(spec.start, 3), addDays(TODAY, -1));

    /** A closed work item to tie evidence to, with the date the evidence can be observed. */
    const anchor = (date: string, preferUnused = false): { key: string; date: string } => {
      const eligible = done.filter((i) => dateOf(i.updated) < date);
      const fresh = preferUnused ? eligible.filter((i) => !usedKeys.has(i.key)) : eligible;
      const pool = fresh.length > 0 ? fresh : eligible;
      if (pool.length > 0) {
        const chosen = dr.pick(pool.slice(0, Math.max(3, Math.ceil(pool.length * 0.8))));
        return { key: chosen.key, date };
      }
      const first = done[0];
      if (first) return { key: first.key, date: clampDate(addDays(dateOf(first.updated), 1), date, addDays(TODAY, -1)) };
      return { key: deliverable.epicKeys[0] as string, date };
    };

    const add = (kind: EvidenceKind, title: string, result: Evidence['result'], when: { key: string | null; date: string; stamp?: string }, outcomeId: string | null = null): Evidence => {
      const n = (sequence[kind] = (sequence[kind] ?? 0) + 1);
      const role = KIND_REVIEWER[kind];
      if (when.key) usedKeys.add(when.key);
      const record: Evidence = {
        id: `ev-${spec.n}-${KIND_SHORT[kind]}-${String(n).padStart(2, '0')}`,
        kind,
        title,
        deliverableId: spec.id,
        outcomeId,
        workItemKey: when.key,
        stageId: KIND_STAGE[kind],
        result,
        source: KIND_SOURCE[kind],
        sourceRef: kind === 'test-result' ? `RUN-${(runCounter += dr.int(1, 4))}` : `${KIND_PREFIX[kind]}-${(docCounter += dr.int(3, 19))}`,
        observedAt: when.stamp ?? stamp(when.date, 18, dr.int(0, 59)),
        recordedById: role ? (deliverable.reviewers[role] ?? null) : null,
        provenance: 'sample',
      };
      evidence.push(record);
      return record;
    };

    // Requirements sign-off: held once the deliverable is past the first stage.
    const reqAnchor = anchor(at(0.12));
    const req = add('requirements-sign-off', `Requirements sign-off — ${trimTitle(spec.title)}`, 'pass', { key: reqAnchor.key, date: reqAnchor.date });
    let design: Evidence | null = null;

    // Design review (not required of T1): pass once past stage 2, pending during it.
    if (spec.tier !== 'T1') {
      if (stageIndex >= 2) {
        const a = anchor(at(0.3), true);
        design = add('design-review', `Design review — ${trimTitle(spec.title)}`, 'pass', { key: a.key, date: a.date });
      } else {
        const a = anchor(addDays(TODAY, -2));
        design = add('design-review', `Design review — ${trimTitle(spec.title)}`, 'pending', { key: a.key, date: a.date });
      }
    }

    // Control assessment (T3 and T4): pass once past stage 3, pending during it.
    if (spec.tier === 'T3' || spec.tier === 'T4') {
      if (stageIndex >= 3) {
        const a = anchor(at(0.5), true);
        add('control-assessment', `Control assessment — ${trimTitle(spec.title)}`, 'pass', { key: a.key, date: a.date });
      } else if (stageIndex === 2) {
        const a = anchor(addDays(TODAY, -3));
        add('control-assessment', `Control assessment — ${trimTitle(spec.title)}`, 'pending', { key: a.key, date: a.date });
      }
    }

    // Test results from the build stage onwards.
    let latestTest: Evidence | null = null;
    if (stageIndex >= 3) {
      const finished = spec.stage === 'delivery-launch';
      const count = Math.max(5, Math.min(22, Math.round(done.length * 0.5) + (finished ? 3 : 0)));
      const staleTest = (flags.staleEvidence ?? 0) >= 1;
      const lastDate = staleTest ? addDays(TODAY, -7) : flags.failingTest ? addDays(TODAY, -2) : addDays(TODAY, -dr.int(1, 3));
      const firstDate = at(0.55);
      const dates: string[] = [];
      for (let i = 0; i < count; i += 1) {
        const fraction = count === 1 ? 1 : i / (count - 1);
        dates.push(clampDate(addDays(firstDate, Math.round(daysBetween(firstDate, lastDate) * fraction)), firstDate, lastDate));
      }
      dates.forEach((date, i) => {
        const isLast = i === count - 1;
        let result: Evidence['result'] = 'pass';
        if (isLast && flags.failingTest) result = 'fail';
        else if (isLast && stageIndex === 3 && !staleTest && dr.chance(0.35)) result = 'pending';
        const a = anchor(date, isLast && staleTest);
        const epicTitle = spec.epics[i % spec.epics.length] as string;
        const record = add('test-result', `${dr.pick(TEST_KINDS)} — ${trimTitle(epicTitle)}`, result, { key: a.key, date: a.date });
        if (isLast) latestTest = record;
      });
    }

    // Business acceptance for each accepted outcome.
    for (const outcome of plan.outcomes.filter((o) => o.deliverableId === spec.id && plan.acceptedIds.has(o.id))) {
      const when = acceptance.byOutcome.get(outcome.id);
      if (!when) continue;
      add('business-acceptance', `Business acceptance — ${trimTitle(outcome.title)}`, 'pass', { key: null, date: dateOf(when), stamp: when }, outcome.id);
    }

    // Release checklist at the launch stage.
    if (stageIndex >= 4) {
      const passing = !PENDING_RELEASE.has(spec.id);
      const a = anchor(passing ? clampDate(addDays(spec.end, -1), addDays(spec.start, 5), addDays(TODAY, -1)) : addDays(TODAY, -2));
      add('release-checklist', `Release checklist — ${trimTitle(spec.title)}`, passing ? 'pass' : 'pending', { key: a.key, date: a.date });
    }

    // Planted stale records: the covered item changes after the evidence was observed.
    const staleTargets: Array<Evidence | null> = [latestTest, design && design.result === 'pass' ? design : null, req];
    let toPlant = flags.staleEvidence ?? 0;
    for (const target of staleTargets) {
      if (toPlant <= 0) break;
      if (!target || !target.workItemKey) continue;
      const covered = items.find((i) => i.key === target.workItemKey);
      if (!covered) continue;
      const changed = clampDate(addDays(dateOf(target.observedAt), 2), addDays(dateOf(target.observedAt), 1), addDays(TODAY, -1));
      covered.updated = stampOn(changed, dr);
      toPlant -= 1;
    }
  }
  return evidence;
}
