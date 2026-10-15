/**
 * @file The day view (ADR-0009 Decisions 1 and 7): one summer weekday of the sized city, hour by hour, whose trips sum to
 * the checks' day, whose 5-6 p.m. hour carries the ledger's peak, whose busiest power hour is the power check's peak and
 * whose most movers moving is the fleet less its reserve; the same for a half-filled city the month clock hands it; an
 * empty city's day is empty; a negative occupancy is refused.
 * Owner context: Site (domain), tests.
 */
import { describe, expect, it } from 'vitest';
import { NO_STRESS, RATES, assessCore, dayFrom, dayOf, sizedLayout } from '../src/index.ts';
import type { Day, Layout, TileKey } from '../src/index.ts';

const SIZED = sizedLayout(RATES);
const HOODS = Object.keys(SIZED.tiles).filter((k) => SIZED.tiles[k]?.kind === 'hood');
const sum = (d: Day, f: (h: Day['hours'][number]) => number): number => d.hours.reduce((t, h) => t + f(h), 0);
const most = (d: Day, f: (h: Day['hours'][number]) => number): number => Math.max(...d.hours.map(f));

/** The day reconciles with the checks of the same layout and people. */
function reconciles(layout: Layout, occupied: Record<TileKey, number>): void {
  const core = assessCore(layout, NO_STRESS, RATES, occupied);
  const d = dayOf(layout, RATES, { occupied });
  expect(d.pop).toBe(core.score.pop);
  expect(d.hours).toHaveLength(24);
  expect(d.trips).toBeCloseTo(core.score.pop * RATES.base.tripsPerDay, 6);
  expect(sum(d, (h) => h.trips)).toBeCloseTo(d.trips, 6);
  expect(most(d, (h) => h.trips)).toBeCloseTo(d.trips * RATES.shared.peakShare, 6);
  expect(d.hours[d.tripPeakHour]?.trips).toBe(most(d, (h) => h.trips));
  expect(sum(d, (h) => h.rides)).toBeCloseTo(d.trips * core.score.ride, 6);
  expect(sum(d, (h) => h.vehicleTrips)).toBeCloseTo(core.score.vehicleTrips, 6);
  expect(most(d, (h) => h.powerMw)).toBeCloseTo(core.score.peak, 12);
  expect(d.peakMw).toBe(core.score.peak);
  expect(most(d, (h) => h.moving)).toBeCloseTo(core.score.fleet / (1 + RATES.walking.reserve), 9);
  for (const h of d.hours) expect(h.moving + h.parked).toBeCloseTo(core.score.fleet, 9);
}

describe('one summer weekday of the sized city', () => {
  const d = dayOf(SIZED, RATES);

  it('50,000 people make 147,727 trips; 14,773 of them, 10%, start between 5 and 6 p.m.', () => {
    expect(d.day).toBe('summerWeekday');
    expect(d.pop).toBe(50000);
    expect(d.trips).toBeCloseTo(147727.32, 2);
    expect(sum(d, (h) => h.trips)).toBeCloseTo(147727.32, 2);
    expect(d.tripPeakHour).toBe(17);
    expect(d.hours[17]?.trips).toBeCloseTo(14772.73, 2);
    expect(most(d, (h) => h.trips)).toBeCloseTo(14772.73, 2);
  });

  it('power peaks at 75 MW at 5 p.m., the power check\'s peak, bottoms at 45 MW at 5 a.m., and draws 1,440 MWh', () => {
    const power = assessCore(SIZED, NO_STRESS, RATES).checks.find((c) => c.id === 'power')?.facts;
    expect(power?.check === 'power' && power.case === 'carries' ? power.peakMw : null).toBe(75);
    expect(d.hours[17]?.powerMw).toBe(75);
    expect(most(d, (h) => h.powerMw)).toBe(75);
    expect(d.hours[5]?.powerMw).toBeCloseTo(45, 9);
    expect(d.energyMwh).toBeCloseTo(1440, 6);
  });

  it('the busiest hour moves 188.5 of the 216.7 movers; 3 a.m. moves 8, the rest parked or charging', () => {
    expect(d.fleet).toBeCloseTo(216.73, 2);
    expect(d.hours[17]?.moving).toBeCloseTo(188.46, 2);
    expect(d.hours[3]?.moving).toBeCloseTo(8.04, 2);
    expect(d.hours[3]?.parked).toBeCloseTo(208.68, 2);
  });

  it('7,800 pupils go to school between 7 and 8 a.m. and come home between 2 and 3 p.m., and travel no other hour', () => {
    expect(d.pupils).toBeCloseTo(7800, 6);
    expect(d.hours[7]?.pupils).toBeCloseTo(7800, 6);
    expect(d.hours[14]?.pupils).toBeCloseTo(7800, 6);
    expect(d.hours.filter((h) => h.pupils > 0).map((h) => h.hour)).toEqual([7, 14]);
  });

  it('reconciles with the checks figure for figure', () => {
    reconciles(SIZED, {});
  });
});

describe('the day for the people the month clock hands it', () => {
  it('a city half filled (2,500 in every neighborhood) has half the trips, half the power and the same shape', () => {
    const half = Object.fromEntries(HOODS.map((h) => [h, 2500]));
    const d = dayOf(SIZED, RATES, { occupied: half });
    const full = dayOf(SIZED, RATES);
    expect(d.pop).toBe(25000);
    expect(d.trips).toBeCloseTo(full.trips / 2, 6);
    expect(d.peakMw).toBeCloseTo(37.5, 12);
    for (let h = 0; h < 24; h++) expect((d.hours[h]?.trips ?? 0) / d.trips).toBeCloseTo((full.hours[h]?.trips ?? 0) / full.trips, 12);
    reconciles(SIZED, half);
  });

  it('uneven neighborhoods, one still filling at 400, reconcile all the same', () => {
    reconciles(SIZED, { [HOODS[0] ?? '']: 400, [HOODS[1] ?? '']: 3100 });
  });

  it('a city with nobody in it yet has an empty day: no trips, no power, every mover parked', () => {
    const d = dayOf(SIZED, RATES, { occupied: Object.fromEntries(HOODS.map((h) => [h, 0])) });
    expect(d.pop).toBe(0);
    expect(sum(d, (h) => h.trips + h.rides + h.vehicleTrips + h.moving + h.powerMw + h.pupils)).toBe(0);
    for (const h of d.hours) expect(h.parked).toBe(d.fleet);
  });

  it('dayFrom of an assessment is the same day as dayOf of its layout and people', () => {
    expect(dayFrom(assessCore(SIZED, NO_STRESS, RATES), RATES, 'summerWeekday')).toEqual(dayOf(SIZED, RATES));
  });

  it('refuses a negative occupancy', () => {
    expect(() => dayOf(SIZED, RATES, { occupied: { [HOODS[0] ?? '']: -1 } })).toThrow(RangeError);
  });
});
