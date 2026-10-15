/**
 * @file The day's shapes (ADR-0009 Decision 7): trips by hour carry the ledger's 10% in the 5-6 p.m. hour and NHTS
 * 2022's stretches everywhere else, summing to the day; power swings from 0.6 of the peak at 5 a.m. to the peak at 5
 * p.m.; a day that misses an hour, doubles one, or would put the peak anywhere but the busiest hour is refused; every
 * premise is marked.
 * Owner context: Ledger (domain), tests.
 */
import { describe, expect, it } from 'vitest';
import { DAYS, DAY_TYPES, SHARED, hourlyPowerShares, hourlyTripShares } from '../src/index.ts';
import type { DayPremises, TripPeriod } from '../src/index.ts';

const SUMMER = DAYS.summerWeekday;
const withPeriods = (value: readonly TripPeriod[]): DayPremises => ({ ...SUMMER, tripPeriods: { ...SUMMER.tripPeriods, value } });

describe('trips by hour', () => {
  const s = hourlyTripShares(SUMMER, SHARED.peakShare);

  it('24 hours summing to the whole day, with exactly 10% in the 5-6 p.m. hour and no hour busier', () => {
    expect(s).toHaveLength(24);
    expect(s.reduce((t, x) => t + x, 0)).toBeCloseTo(1, 12);
    expect(s[17]).toBe(0.1);
    expect(Math.max(...s)).toBe(0.1);
    expect(s.filter((x) => x === 0.1)).toHaveLength(1);
  });

  it('the rest of the day keeps NHTS 2022\'s stretches in proportion: 6-9 a.m. holds 17.8 parts to 9 a.m.-1 p.m.\'s 23.4', () => {
    const sum = (from: number, hours: number): number => Array.from({ length: hours }, (_, i) => s[(from + i) % 24] ?? 0).reduce((t, x) => t + x, 0);
    expect(sum(6, 3) / sum(9, 4)).toBeCloseTo(0.178 / 0.234, 12);
    expect(sum(1, 5) / sum(22, 3)).toBeCloseTo(0.022 / 0.02, 12);
    // Hours inside one stretch are spread evenly.
    expect(s[6]).toBeCloseTo(s[8] ?? NaN, 15);
    // 4-7 p.m. less its peak hour: the two other hours share the stretch's scaled share evenly.
    expect(s[16]).toBeCloseTo(s[18] ?? NaN, 15);
  });

  it('refuses a day with an hour in no stretch, an hour in two, a negative share, or a peakShare outside 0 to 1', () => {
    const periods = SUMMER.tripPeriods.value;
    expect(() => hourlyTripShares(withPeriods(periods.slice(1)), 0.1)).toThrow(RangeError);
    expect(() => hourlyTripShares(withPeriods([...periods, { from: 3, hours: 1, share: 0.01 }]), 0.1)).toThrow('hour 3 is in two stretches');
    expect(() => hourlyTripShares(withPeriods(periods.map((p, i) => (i ? p : { ...p, share: -0.02 }))), 0.1)).toThrow(RangeError);
    expect(() => hourlyTripShares(SUMMER, 0)).toThrow(RangeError);
    expect(() => hourlyTripShares(SUMMER, 1)).toThrow(RangeError);
  });

  it('refuses a peak that would not be the busiest hour: a 4% peak leaves 1-4 p.m. busier', () => {
    expect(() => hourlyTripShares(SUMMER, 0.04)).toThrow('more than the peak');
  });
});

describe('power by hour', () => {
  const p = hourlyPowerShares(SUMMER);

  it('the peak at 5-6 p.m., 0.6 of it at 5 a.m., and every hour between the two', () => {
    expect(p).toHaveLength(24);
    expect(p[17]).toBe(1);
    expect(p[5]).toBeCloseTo(0.6, 15);
    expect(Math.max(...p)).toBe(1);
    expect(Math.min(...p)).toBeCloseTo(0.6, 15);
  });

  it('climbs every hour from 5 a.m. to 5 p.m. and falls every hour after', () => {
    for (let h = 5; h < 17; h++) expect(p[h + 1] ?? NaN).toBeGreaterThan(p[h] ?? NaN);
    for (let h = 17; h < 29; h++) expect(p[(h + 1) % 24] ?? NaN).toBeLessThan(p[h % 24] ?? NaN);
  });

  it('refuses a peak and a low in the same hour, an hour off the clock, or a low share outside 0 to 1', () => {
    expect(() => hourlyPowerShares({ ...SUMMER, powerLowHour: { ...SUMMER.powerLowHour, value: 17 } })).toThrow(RangeError);
    expect(() => hourlyPowerShares({ ...SUMMER, powerPeakHour: { ...SUMMER.powerPeakHour, value: 24 } })).toThrow(RangeError);
    expect(() => hourlyPowerShares({ ...SUMMER, powerLowShare: { ...SUMMER.powerLowShare, value: 0 } })).toThrow(RangeError);
  });
});

describe('the day\'s premises', () => {
  it('every premise of every day carries a mark, and every sourced one names its source, year and link', () => {
    for (const d of DAY_TYPES) {
      const k = DAYS[d];
      const marks = [k.tripPeriods, k.tripPeakHour, k.powerPeakHour, k.powerLowHour, k.powerLowShare, k.schoolStart, k.schoolHours].map((x) => x.mark);
      for (const m of marks) {
        expect(['yours', 'mine', 'sourced']).toContain(m.kind);
        if (m.kind === 'sourced') {
          expect(m.source.length).toBeGreaterThan(0);
          expect(m.year).toBeGreaterThan(2000);
          expect(m.url.startsWith('https://')).toBe(true);
          expect(m.accepted).toBe(true);
        }
      }
    }
  });
});
