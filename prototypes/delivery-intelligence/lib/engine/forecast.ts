/**
 * Forecast end against planned end, by a rule simple enough to explain aloud:
 *   rate      = points closed in the last FORECAST_LOOKBACK_DAYS / FORECAST_LOOKBACK_DAYS
 *   forecast  = today + ceil(remaining points / rate)
 * Falls back to the planned end (and says so) when there is no estimated work
 * or nothing was closed in the lookback window. When everything is closed, the
 * forecast is the date the last item was resolved.
 */
import type { DemoClock, IsoDate, WorkItem } from '@/lib/types';
import { FORECAST_LOOKBACK_DAYS } from './constants';
import { date, plural } from './messages';
import { addDaysTo, dayDiff, laterOf, toDate, toMs } from './util';
import { isClosed } from './work';

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
  /** Points per day; 0 when not computable. */
  dailyRate: number;
  /** One sentence explaining the figure. */
  explanation: string;
}

export function forecastEnd(items: readonly WorkItem[], plannedEnd: IsoDate, clock: DemoClock): Forecast {
  const lookbackStart = toMs(addDaysTo(clock.today, -FORECAST_LOOKBACK_DAYS));
  const todayEnd = toMs(addDaysTo(clock.today, 1));
  let remaining = 0;
  let total = 0;
  let recent = 0;
  let lastResolved: string | null = null;
  for (const item of items) {
    const points = item.points !== null && item.points > 0 ? item.points : 0;
    total += points;
    if (!isClosed(item)) {
      remaining += points;
      continue;
    }
    if (item.resolved) {
      lastResolved = laterOf<string | null>(lastResolved, item.resolved);
      const at = toMs(item.resolved);
      if (at >= lookbackStart && at < todayEnd) recent += points;
    }
  }
  const base = { plannedEnd, remainingPoints: remaining, recentClosedPoints: recent, lookbackDays: FORECAST_LOOKBACK_DAYS };

  if (total === 0) {
    return {
      ...base,
      forecastEnd: plannedEnd,
      slipDays: 0,
      method: 'planned-fallback',
      dailyRate: 0,
      explanation: `No estimated work is linked, so the forecast shows the planned end (${date(plannedEnd)}).`,
    };
  }
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
  if (recent === 0) {
    return {
      ...base,
      forecastEnd: plannedEnd,
      slipDays: 0,
      method: 'planned-fallback',
      dailyRate: 0,
      explanation: `No points were closed in the last ${FORECAST_LOOKBACK_DAYS} days, so there is no rate to project ${plural(remaining, 'remaining point')}; showing the planned end (${date(plannedEnd)}).`,
    };
  }
  const rate = recent / FORECAST_LOOKBACK_DAYS;
  const end = addDaysTo(clock.today, Math.ceil(remaining / rate));
  return {
    ...base,
    forecastEnd: end,
    slipDays: dayDiff(plannedEnd, end),
    method: 'throughput',
    dailyRate: rate,
    explanation:
      `${plural(remaining, 'point')} remain; ${plural(recent, 'point')} closed in the last ${FORECAST_LOOKBACK_DAYS} days ` +
      `(${(rate * 7).toFixed(1)} a week) puts the end at ${date(end)}, against ${date(plannedEnd)} planned.`,
  };
}
