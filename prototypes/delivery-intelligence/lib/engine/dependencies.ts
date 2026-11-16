/**
 * Dependency status helpers. `from` provides, `to` receives by `needBy`.
 * A dependency is open until delivered. Lateness is how far the expected
 * arrival (the later of the committed date and today) sits past need-by.
 */
import type { DemoClock, Dependency } from '@/lib/types';
import { RULE_THRESHOLDS } from './constants';
import { dayDiff } from './util';

export function isDependencyOpen(dep: Dependency): boolean {
  return dep.status !== 'delivered' && dep.deliveredOn === null;
}

/** Days past need-by for an open dependency (0 when not late or delivered). */
export function dependencyLateDays(dep: Dependency, clock: DemoClock): number {
  if (!isDependencyOpen(dep)) return 0;
  const byCommitment = dep.committed ? dayDiff(dep.needBy, dep.committed) : 0;
  const byToday = dayDiff(dep.needBy, clock.today);
  return Math.max(0, byCommitment, byToday);
}

/** Late as rule R5 and the plan define it: status `late`, or open and past need-by beyond the threshold. */
export function isDependencyLate(dep: Dependency, clock: DemoClock): boolean {
  if (!isDependencyOpen(dep)) return false;
  return dep.status === 'late' || dependencyLateDays(dep, clock) > RULE_THRESHOLDS.dependencyLateDays;
}

/** Late or blocked, and still open. */
export function isDependencyTroubled(dep: Dependency, clock: DemoClock): boolean {
  return isDependencyOpen(dep) && (dep.status === 'blocked' || isDependencyLate(dep, clock));
}
