/**
 * @file The day: how a city's trips and power spread over 24 hours, and when school starts and ends, each a premise
 * with a mark. The ledger already fixes the day's total (trips a person a day) and its busiest hour (`peakShare` of
 * trips, 1.5 kW a person of power); these shapes only say how the rest of the day falls (ADR-0009 Decision 7).
 * Public interface: DayType, DAY_TYPES, TripPeriod, DayPremises, DAYS, hourlyTripShares, hourlyPowerShares.
 * Owner context: Ledger (domain).
 *
 * Hours are clock hours, 0 for midnight to 1 a.m. through 23 for 11 p.m. to midnight. Shares are fractions of the
 * day; a power share is a fraction of the peak hour.
 */
import { accept, sourced } from './cost.ts';
import type { Mark, Marked } from './cost.ts';

/** The kinds of day the view can show. A summer weekday only, for now (David, 2026-10-14). */
export type DayType = 'summerWeekday';

export const DAY_TYPES: readonly DayType[] = ['summerWeekday'];

/** A stretch of the day and its share of the day's trips, spread evenly over its hours. */
export interface TripPeriod {
  /** Clock hour the stretch starts. */
  readonly from: number;
  /** How many hours it runs; a stretch may wrap past midnight. */
  readonly hours: number;
  /** Its share of the day's trips, as the source gives it (the shares need not sum to exactly 1). */
  readonly share: number;
}

/** The premises of one kind of day. */
export interface DayPremises {
  /** Trips by start time, covering the day once. */
  readonly tripPeriods: { readonly value: readonly TripPeriod[]; readonly mark: Mark };
  /** The clock hour the trips peak in, which carries the ledger's peakShare. */
  readonly tripPeakHour: Marked;
  /** The clock hour power peaks in. */
  readonly powerPeakHour: Marked;
  /** The clock hour power is lowest in. */
  readonly powerLowHour: Marked;
  /** Power in the lowest hour, as a share of the peak. */
  readonly powerLowShare: Marked;
  /** When school starts, in hours after midnight. */
  readonly schoolStart: Marked;
  /** How long the school day runs, hours. */
  readonly schoolHours: Marked;
}

const MINE: Mark = { kind: 'mine' };
const NHTS_2022 = 'https://nhts.ornl.gov/assets/2022/pub/2022_NHTS_Summary_Travel_Trends.pdf';
const EIA_2020 = 'https://www.eia.gov/todayinenergy/detail.php?id=42915';

/** The days as sourced in `docs/brainstorm/future-city/population.md` ("The day") and decided on 2026-10-14. */
export const DAYS: Readonly<Record<DayType, DayPremises>> = {
  summerWeekday: {
    // NHTS gives all days of the week together; a weekday is read from them until a weekday table is found.
    tripPeriods: {
      value: [
        { from: 22, hours: 3, share: 0.02 },
        { from: 1, hours: 5, share: 0.022 },
        { from: 6, hours: 3, share: 0.178 },
        { from: 9, hours: 4, share: 0.234 },
        { from: 13, hours: 3, share: 0.238 },
        { from: 16, hours: 3, share: 0.22 },
        { from: 19, hours: 3, share: 0.089 },
      ],
      mark: accept(sourced('NHTS 2022 Summary of Travel Trends, Table 8-1: person trips by start time', 2022, NHTS_2022)),
    },
    // 4-7 p.m. is the busiest stretch in NHTS 2022; which of its hours carries the peak is the city's reading.
    tripPeakHour: { value: 17, mark: MINE },
    powerPeakHour: { value: 17, mark: accept(sourced('EIA Today in Energy: summer load peaks around 5 to 6 p.m.', 2020, EIA_2020)) },
    powerLowHour: { value: 5, mark: accept(sourced('EIA Today in Energy: summer load is lowest around 5 a.m.', 2020, EIA_2020)) },
    powerLowShare: { value: 0.6, mark: MINE },
    schoolStart: {
      value: 8,
      mark: accept(sourced('NCES: average US public high school start 8:00 a.m. (2017-18), 8:07 (2020-21)', 2021, 'https://nces.ed.gov/blogs/nces/2020/02/19/default')),
    },
    schoolHours: { value: 6.5, mark: MINE },
  },
};

const HOURS = 24;

function clockHour(h: number, what: string): number {
  if (!Number.isInteger(h) || h < 0 || h >= HOURS) throw new RangeError(`${what} must be a clock hour 0 to 23, not ${h}`);
  return h;
}

/**
 * The day's trips by clock hour: the peak hour carries peakShare, and the source's stretches, spread evenly over their
 * hours, fill the rest of the day in proportion.
 * @param day - the day's premises
 * @param peakShare - share of the day's trips made in the busiest hour (the ledger's, 0.1)
 * @returns 24 shares summing to 1, the largest of them peakShare at the trip peak hour
 * @throws RangeError when the stretches do not cover every hour exactly once, a share is negative, peakShare is not
 *   between 0 and 1, or the peak hour would not be the busiest hour of the day
 */
export function hourlyTripShares(day: DayPremises, peakShare: number): number[] {
  if (!(peakShare > 0 && peakShare < 1)) throw new RangeError(`peakShare must be between 0 and 1, not ${peakShare}`);
  const peak = clockHour(day.tripPeakHour.value, 'the trip peak hour');
  const raw: (number | null)[] = new Array<number | null>(HOURS).fill(null);
  for (const p of day.tripPeriods.value) {
    if (!(p.share >= 0)) throw new RangeError(`a stretch's share must be zero or more, not ${p.share}`);
    if (!Number.isInteger(p.hours) || p.hours < 1) throw new RangeError(`a stretch runs a whole number of hours, not ${p.hours}`);
    clockHour(p.from, 'a stretch start');
    for (let i = 0; i < p.hours; i++) {
      const h = (p.from + i) % HOURS;
      if (raw[h] !== null) throw new RangeError(`hour ${h} is in two stretches`);
      raw[h] = p.share / p.hours;
    }
  }
  const missing = raw.findIndex((x) => x === null);
  if (missing >= 0) throw new RangeError(`hour ${missing} is in no stretch`);
  const each = raw.map((x) => x ?? 0);
  const rest = each.reduce((t, x, h) => (h === peak ? t : t + x), 0);
  if (!(rest > 0)) throw new RangeError('the day has no trips outside its peak hour to spread');
  const scale = (1 - peakShare) / rest;
  const shares = each.map((x, h) => (h === peak ? peakShare : x * scale));
  const busiest = shares.reduce((m, x, h) => (h === peak ? m : Math.max(m, x)), 0);
  if (busiest > peakShare) throw new RangeError(`another hour carries ${busiest} of the day's trips, more than the peak's ${peakShare}`);
  return shares;
}

/**
 * Power by clock hour against the peak: a smooth swing from the lowest hour up to the peak hour and back.
 * @param day - the day's premises
 * @returns 24 shares of the peak, exactly 1 at the power peak hour and powerLowShare at the low hour
 * @throws RangeError when an hour is not a clock hour, the low and peak hours are the same, or powerLowShare is not
 *   between 0 and 1
 */
export function hourlyPowerShares(day: DayPremises): number[] {
  const peak = clockHour(day.powerPeakHour.value, 'the power peak hour');
  const low = clockHour(day.powerLowHour.value, 'the power low hour');
  const floor = day.powerLowShare.value;
  if (peak === low) throw new RangeError('power cannot peak and bottom out in the same hour');
  if (!(floor > 0 && floor <= 1)) throw new RangeError(`the low hour's share of the peak must be above 0 and at most 1, not ${floor}`);
  const up = (peak - low + HOURS) % HOURS;
  const down = HOURS - up;
  return Array.from({ length: HOURS }, (_, h) => {
    // How far the hour has climbed from the low towards the peak, 0 at the low and 1 at the peak, on either side.
    const since = (h - low + HOURS) % HOURS;
    const climb = since <= up ? since / up : (HOURS - since) / down;
    return floor + (1 - floor) * (1 - Math.cos(Math.PI * climb)) / 2;
  });
}
