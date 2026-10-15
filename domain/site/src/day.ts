/**
 * @file The day view: one day of a layout's people, hour by hour — trips, rides, movers moving and parked, power, and
 * pupils on their way to and from school. Built from the same assessment as the checks, so its day is the checks' day
 * and its busiest hours are their peaks (ADR-0009 Decisions 1 and 7). It holds no state; the month clock hands it the
 * people.
 * Public interface: Hour, Day, dayOf, dayFrom.
 * Owner context: Site (domain).
 */
import { DAYS, hourlyPowerShares, hourlyTripShares } from '@city/ledger';
import type { DayType } from '@city/ledger';
import type { TileKey } from './board.ts';
import { assessCore } from './assess.ts';
import { NO_STRESS } from './checks.ts';
import type { Core } from './checks.ts';
import type { Layout } from './layout.ts';
import { SCHOOLS } from './rates.ts';
import type { SiteRates } from './rates.ts';

/** One clock hour of the day. */
export interface Hour {
  /** Clock hour, 0 for midnight to 1 a.m. */
  readonly hour: number;
  /** Person trips started in the hour, every way of making them. */
  readonly trips: number;
  /** Of those, trips taken on a mover. */
  readonly rides: number;
  /** Mover trips run in the hour, riders shared among vehicles. */
  readonly vehicleTrips: number;
  /** Movers carrying riders or running empty to them. */
  readonly moving: number;
  /** Movers parked or charging: the fleet less those moving. */
  readonly parked: number;
  /** Power drawn, MW. */
  readonly powerMw: number;
  /** Pupils walking or riding to or from school in the hour. */
  readonly pupils: number;
}

/** One day of a layout's people. */
export interface Day {
  readonly day: DayType;
  /** People living in the layout this day. */
  readonly pop: number;
  readonly hours: readonly Hour[];
  /** The day's person trips: people times trips a person a day, as the checks count them. */
  readonly trips: number;
  /** The clock hour with the most trips. */
  readonly tripPeakHour: number;
  /** The mover fleet, sized for the busiest hour with its reserve. */
  readonly fleet: number;
  /** The day's highest power, MW: the power check's peak. */
  readonly peakMw: number;
  /** Power over the day, MWh. */
  readonly energyMwh: number;
  /** Pupils in the layout, each going once and coming home once. */
  readonly pupils: number;
}

/**
 * One day of a layout's people, hour by hour, in an ordinary year.
 * @param layout - the board
 * @param rates - the ledger's rates
 * @param options - occupied: people in each neighborhood, as the month clock hands them (a neighborhood left out is
 *   full); day: which kind of day, a summer weekday when left out
 * @returns 24 hours whose trips sum to the day's and whose busiest hours are the checks' peaks
 * @throws RangeError when an occupancy is negative, or the day's premises do not make a day (see dayFrom)
 */
export function dayOf(
  layout: Layout,
  rates: SiteRates,
  options: { readonly occupied?: Readonly<Record<TileKey, number>>; readonly day?: DayType } = {},
): Day {
  return dayFrom(assessCore(layout, NO_STRESS, rates, options.occupied ?? {}), rates, options.day ?? 'summerWeekday');
}

/**
 * One day of an assessment's people, hour by hour.
 * @param core - an assessment, under whatever stress it was made
 * @param rates - the rates the assessment was made with
 * @param day - which kind of day
 * @returns 24 hours; trips sum to the day's trips, the peak hour carries the ledger's peakShare of them, the most movers
 *   moving is the fleet less its reserve, and the highest power is the power check's peak
 * @throws RangeError when the day's premises do not cover the day or would put the peak anywhere but the busiest hour
 */
export function dayFrom(core: Core, rates: SiteRates, day: DayType): Day {
  const k = DAYS[day];
  const share = hourlyTripShares(k, rates.shared.peakShare);
  const power = hourlyPowerShares(k);
  const { pop, ride, vehicleTrips, fleet, peak } = core.score;
  const trips = pop * rates.base.tripsPerDay;
  // The fleet is the busiest hour's movers plus a reserve; each hour needs the busiest hour's movers in proportion.
  const peakMoving = fleet / (1 + rates.walking.reserve);
  let pupils = 0;
  for (const r of Object.values(core.per)) for (const kind of SCHOOLS) pupils += r.goes?.[kind].each ?? 0;
  // Pupils are on their way in the hour before school starts and in the hour it lets out.
  const going = Math.ceil(k.schoolStart.value) - 1;
  const coming = Math.floor(k.schoolStart.value + k.schoolHours.value);
  const hours: Hour[] = share.map((s, hour) => {
    const moving = (peakMoving * s) / rates.shared.peakShare;
    return {
      hour,
      trips: trips * s,
      rides: trips * ride * s,
      vehicleTrips: vehicleTrips * s,
      moving,
      parked: fleet - moving,
      powerMw: peak * (power[hour] ?? 0),
      pupils: hour === going || hour === coming ? pupils : 0,
    };
  });
  return {
    day,
    pop,
    hours,
    trips,
    tripPeakHour: k.tripPeakHour.value,
    fleet,
    peakMw: peak,
    energyMwh: hours.reduce((t, h) => t + h.powerMw, 0),
    pupils,
  };
}
