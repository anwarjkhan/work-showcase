/**
 * Forecast end against planned end, by a rule simple enough to explain aloud:
 *   rate      = points closed in the last FORECAST_LOOKBACK_DAYS / FORECAST_LOOKBACK_DAYS
 *   forecast  = today + ceil(remaining points / rate)
 *
 * The projection is only used when there is enough history to trust it:
 *   - work started at least FORECAST_MIN_HISTORY_DAYS before today,
 *   - at least FORECAST_MIN_COMPLETION_RATIO of the points are closed, and
 *   - at least FORECAST_MIN_RECENT_CLOSED_ITEMS items closed in the lookback window.
 * Otherwise the forecast is the planned end, with method `planned-fallback` and an
 * explanation saying why. A projection slipping more than
 * FORECAST_MAX_CREDIBLE_SLIP_DAYS is low confidence: the planned end is shown,
 * `atRisk` is set and the explanation says throughput is too low for a reliable
 * date. So no forecast ever shows a multi-year slip.
 * When everything is closed, the forecast is the date the last item was resolved.
 */
import type { DemoClock, IsoDate, WorkItem } from '@/lib/types';
import {
  FORECAST_LOOKBACK_DAYS,
  FORECAST_MAX_CREDIBLE_SLIP_DAYS,
  FORECAST_MIN_COMPLETION_RATIO,
  FORECAST_MIN_HISTORY_DAYS,
  FORECAST_MIN_RECENT_CLOSED_ITEMS,
} from './constants';
import { date, days, pct, plural } from './messages';
import { addDaysTo, dayDiff, laterOf, toDate, toMs } from './util';
import { isClosed } from './work';

/** `throughput` only when the projection passed every gate; gated or empty cases are `planned-fallback`. */
export type ForecastMethod = 'throughput' | 'complete' | 'planned-fallback';

export interface Forecast {
  plannedEnd: IsoDate;
  forecastEnd: IsoDate;
  /** forecastEnd - plannedEnd in days; positive is late. */
  slipDays: number;
  method: ForecastMethod;
  remainingPoints: number;
  /** Points closed in the lookback window. */
  recentClosedPoints: number;
  lookbackDays: number;
  /** Points per day; 0 when not projected from throughput. */
  dailyRate: number;
  /**
   * True when a throughput projection exists but was too far out to be credible
   * (beyond the planned end by more than FORECAST_MAX_CREDIBLE_SLIP_DAYS): the
   * planned end is shown, but the work is at risk of slipping.
   */
  atRisk: boolean;
  /** One sentence explaining the figure. */
  explanation: string;
}

/**
 * Forecast for a set of story-level items. `plannedStart` (optional, for the history
 * gate) defaults to the earliest `created` among the items.
 */
export function forecastEnd(items: readonly WorkItem[], plannedEnd: IsoDate, clock: DemoClock, plannedStart?: IsoDate): Forecast {
  const lookbackStart = toMs(addDaysTo(clock.today, -FORECAST_LOOKBACK_DAYS));
  const todayEnd = toMs(addDaysTo(clock.today, 1));
  let remaining = 0;
  let total = 0;
  let recent = 0;
  let recentItems = 0;
  let lastResolved: string | null = null;
  let earliestCreated: string | null = null;
  for (const item of items) {
    if (earliestCreated === null || toMs(item.created) < toMs(earliestCreated)) earliestCreated = item.created;
    const points = item.points !== null && item.points > 0 ? item.points : 0;
    total += points;
    if (!isClosed(item)) {
      remaining += points;
      continue;
    }
    if (item.resolved) {
      lastResolved = laterOf<string | null>(lastResolved, item.resolved);
      const at = toMs(item.resolved);
      if (at >= lookbackStart && at < todayEnd) {
        recent += points;
        recentItems++;
      }
    }
  }
  const base = { plannedEnd, remainingPoints: remaining, recentClosedPoints: recent, lookbackDays: FORECAST_LOOKBACK_DAYS, atRisk: false };
  const fallback = (explanation: string, atRisk = false): Forecast => ({
    ...base,
    forecastEnd: plannedEnd,
    slipDays: 0,
    method: 'planned-fallback',
    dailyRate: 0,
    atRisk,
    explanation,
  });
  const showingPlanned = `showing the planned end (${date(plannedEnd)})`;

  if (total === 0) return fallback(`No estimated work is linked, so the forecast shows the planned end (${date(plannedEnd)}).`);
  if (remaining === 0) {
    const end = lastResolved ? toDate(lastResolved) : clock.today;
    return {
      ...base,
      forecastEnd: end,
      slipDays: dayDiff(plannedEnd, end),
      method: 'complete',
      dailyRate: 0,
      explanation: `All ${plural(total, 'point')} are closed; the last item was resolved on ${date(end)}.`,
    };
  }

  // --- Enough history to project? First failing gate wins, so the reason is specific.
  const start = plannedStart ?? (earliestCreated ? toDate(earliestCreated) : clock.today);
  const age = dayDiff(start, clock.today);
  const ratio = (total - remaining) / total;
  if (age < FORECAST_MIN_HISTORY_DAYS) {
    return fallback(
      `Too early to forecast from throughput: work started ${age <= 0 ? (age === 0 ? 'today' : `in ${days(age)}`) : `${days(age)} ago`}; ${showingPlanned}.`,
    );
  }
  if (ratio < FORECAST_MIN_COMPLETION_RATIO) {
    return fallback(`Too early to forecast from throughput: ${pct(ratio)} of work closed; ${showingPlanned}.`);
  }
  if (recentItems < FORECAST_MIN_RECENT_CLOSED_ITEMS) {
    return fallback(
      `Too little recent throughput to forecast: ${plural(recentItems, 'item')} closed in the last ${FORECAST_LOOKBACK_DAYS} days; ${showingPlanned}.`,
    );
  }

  const rate = recent / FORECAST_LOOKBACK_DAYS;
  const end = addDaysTo(clock.today, Math.ceil(remaining / rate));
  const slip = dayDiff(plannedEnd, end);
  if (slip > FORECAST_MAX_CREDIBLE_SLIP_DAYS) {
    return fallback(
      `Recent throughput (${(rate * 7).toFixed(1)} points a week against ${plural(remaining, 'remaining point')}) is too low to give a reliable date; ` +
        `at risk of slipping well beyond the planned end, which is shown (${date(plannedEnd)}).`,
      true,
    );
  }
  return {
    ...base,
    forecastEnd: end,
    slipDays: slip,
    method: 'throughput',
    dailyRate: rate,
    explanation:
      `${plural(remaining, 'point')} remain; ${plural(recent, 'point')} closed in the last ${FORECAST_LOOKBACK_DAYS} days ` +
      `(${(rate * 7).toFixed(1)} a week) puts the end at ${date(end)}, against ${date(plannedEnd)} planned.`,
  };
}
