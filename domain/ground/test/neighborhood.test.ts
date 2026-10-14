/**
 * @file The ground plan of the ledger's neighborhood: every sum the Ledger fixes comes out of the shapes, every
 * shape sits where it may, every open placement is named, and what the plan refuses.
 * Owner context: Ground (domain), tests.
 */
import { NEEDS, SHARED, WALKING_CITY, WALK_M_PER_MIN, deriveWalkingCity } from '@city/ledger';
import type { WalkingCityLedger } from '@city/ledger';
import { describe, expect, it } from 'vitest';
import { GroundError, halfWidthAt, hexFrame, insideFrame, planNeighborhood } from '../src/index.ts';
import type { Disc, NeighborhoodPlan, Point } from '../src/index.ts';

const ledger = deriveWalkingCity(SHARED, WALKING_CITY, NEEDS);
const plan = planNeighborhood(SHARED, WALKING_CITY, ledger);

/** A length in km, rounded the way the ledger's page shows it. */
function km(m: number, decimals = 1): number {
  const scale = 10 ** decimals;
  return Math.round((m / 1000) * scale) / scale;
}

function clearOf(p: Point, d: Disc, by: number): boolean {
  return Math.hypot(p.x - d.at.x, p.y - d.at.y) >= d.radiusM + by - 1e-9;
}

describe('the sums reconcile with the ledger', () => {
  it('2,041 townhouses of 6 m and three stories, 12.2 km of frontage', () => {
    expect(plan.figures.homes).toBe(2041);
    expect(plan.figures.homes).toBe(Math.round(ledger.centerPop / SHARED.hh));
    expect(plan.figures.stories).toBe(3);
    expect(plan.figures.frontageM).toBe(2041 * 6);
    expect(km(plan.figures.frontageM)).toBe(km((ledger.centerPop / SHARED.hh) * WALKING_CITY.frontage));
  });
  it('a 12-acre park: the ledger’s parks per person for the neighborhood', () => {
    expect(plan.figures.parkM2).toBe(ledger.parks * ledger.centerPop);
    expect(Math.round(plan.figures.parkM2 / 4046.86)).toBe(12);
  });
  it('33 entries shared by about 62 homes each', () => {
    expect(plan.figures.entries).toBe(33);
    expect(plan.figures.entries).toBe(Math.round(ledger.entriesPerCenter));
    expect(Math.abs(plan.figures.homesPerEntry - ledger.homesPerEntry)).toBeLessThan(1);
  });
  it('1.1 km of bike lane, 3.7 km of walkway, 6.1 km of goods pipe, as the ledger’s city divided by its centers', () => {
    expect(km(plan.figures.laneM)).toBe(1.1);
    expect(km(plan.figures.laneM)).toBe(km((ledger.laneKm * 1000) / ledger.centers));
    expect(km(plan.figures.walkwayM)).toBe(3.7);
    expect(km(plan.figures.walkwayM)).toBe(km((ledger.walkwayKm * 1000) / ledger.centers));
    expect(km(plan.figures.pipeM)).toBe(6.1);
    expect(km(plan.figures.pipeM)).toBe(km((ledger.pipeKm * 1000) / ledger.centers));
  });
  it('the tile is the ledger’s: 93 acres, a corner 381 m from the middle', () => {
    expect(plan.frame.cornerM).toBeCloseTo(ledger.reachKm * 1000, 6);
    expect(Math.round(plan.frame.areaM2 / 4046.86)).toBe(93);
  });
});

describe('the shapes add up to the figures and sit where they may', () => {
  it('the rows hold every home, in whole homes, at one pitch, inside the tile and half a row clear of the center and park', () => {
    const { rows, center, park } = plan.surface;
    expect(rows.reduce((n, r) => n + r.homes, 0)).toBe(plan.figures.homes);
    expect(rows.reduce((m, r) => m + r.frontageM, 0)).toBeCloseTo(plan.figures.frontageM, 6);
    expect(rows.length).toBe(plan.figures.rows);
    for (const r of rows) {
      expect(r.x1 - r.x0).toBeCloseTo(r.homes * WALKING_CITY.frontage, 9);
      expect(insideFrame(plan.frame, { x: r.x0, y: r.y })).toBe(true);
      expect(insideFrame(plan.frame, { x: r.x1, y: r.y })).toBe(true);
      for (let i = 0; i <= r.homes; i++) {
        const p = { x: r.x0 + i * WALKING_CITY.frontage, y: r.y };
        expect(clearOf(p, center, plan.figures.rowDepthM / 2) && clearOf(p, park, plan.figures.rowDepthM / 2)).toBe(true);
      }
    }
    const ys = [...new Set(rows.map((r) => r.y))].sort((a, b) => a - b);
    // Rows sit on one pitch; a level too narrow for a whole home is skipped, so neighbors may be several pitches apart.
    for (let i = 1; i < ys.length; i++) {
      const steps = ((ys[i] as number) - (ys[i - 1] as number)) / plan.figures.rowPitchM;
      expect(Math.abs(steps - Math.round(steps))).toBeLessThan(1e-6);
      expect(Math.round(steps)).toBeGreaterThanOrEqual(1);
    }
    // The pitch is a placeholder: a quarter-metre step at or below the ledger's ground per home over one front.
    const ledgerPitch = ((ledger.footprint + ledger.yards + ledger.streets) * SHARED.hh) / WALKING_CITY.frontage;
    expect(plan.figures.rowPitchM).toBeLessThanOrEqual(ledgerPitch);
    expect(plan.figures.rowPitchM).toBeGreaterThan(ledgerPitch * 0.9);
    expect((plan.figures.rowPitchM * 4) % 1).toBe(0);
  });
  it('the park has the ledger’s area and lies on the tile beside the center', () => {
    const { park, center } = plan.surface;
    expect(Math.PI * park.radiusM ** 2).toBeCloseTo(park.areaM2, 6);
    for (let k = 0; k < 36; k++) {
      const a = (k * Math.PI) / 18;
      expect(insideFrame(plan.frame, { x: park.at.x + park.radiusM * Math.cos(a), y: park.at.y + park.radiusM * Math.sin(a) })).toBe(true);
    }
    expect(Math.hypot(park.at.x, park.at.y) - park.radiusM).toBeGreaterThan(center.radiusM);
  });
  it('the lane runs along three edges of the tile, corner to corner', () => {
    expect(plan.surface.lane).toHaveLength(3);
    for (const e of plan.surface.lane) {
      expect(e.m).toBeCloseTo(plan.frame.cornerM, 6);
      expect(plan.frame.corners).toContainEqual(e.from);
      expect(plan.frame.corners).toContainEqual(e.to);
    }
  });
  it('every home has an entry; every entry but the stop’s walks one step toward the stop', () => {
    const { entries, stop } = plan.sub;
    const spacing = ((WALKING_CITY.entryWalkMin * WALK_M_PER_MIN) / WALKING_CITY.detour) * Math.sqrt(3);
    expect(entries.reduce((n, e) => n + e.homes, 0)).toBe(plan.figures.homes);
    expect(entries.filter((e) => e.steps === 0)).toHaveLength(1);
    expect(entries.find((e) => e.steps === 0)?.at).toEqual(stop.at);
    expect(stop.at).toEqual({ x: 0, y: 0 });
    expect(stop.berths).toBe(ledger.berths);
    for (const e of entries) {
      expect(insideFrame(plan.frame, e.at)).toBe(true);
      if (e.steps === 0) expect(e.walkway).toBeUndefined();
      else {
        expect(e.walkway?.m).toBeCloseTo(spacing, 6);
        expect(e.walkway?.from).toEqual(e.at);
        const parent = entries.find((o) => o.at.x === e.walkway?.to.x && o.at.y === e.walkway?.to.y);
        expect(parent?.steps).toBe(e.steps - 1);
      }
    }
    expect(plan.figures.walkwayM).toBeCloseTo((entries.length - 1) * spacing, 6);
    expect(plan.figures.farthestEntryWalkMin).toBeLessThan(2);
  });
  it('the pipe runs under each pair of rows, half as long as their fronts together', () => {
    const { pipes } = plan.sub;
    expect(pipes).toHaveLength(Math.ceil(plan.surface.rows.length / WALKING_CITY.rowsPerPipe));
    expect(pipes.reduce((m, p) => m + p.m, 0)).toBeCloseTo(plan.figures.frontageM / WALKING_CITY.rowsPerPipe, 6);
    pipes.forEach((p, i) => {
      const pair = plan.surface.rows.slice(i * 2, i * 2 + 2);
      expect(p.m).toBeCloseTo(pair.reduce((m, r) => m + r.frontageM, 0) / 2, 6);
      expect(p.from.y).toBe(p.to.y);
      expect(insideFrame(plan.frame, p.from) && insideFrame(plan.frame, p.to)).toBe(true);
    });
  });
  it('names every placement the ledger leaves open, and nothing it fixes', () => {
    expect(plan.placeholders).toEqual([
      'row-pitch',
      'row-positions',
      'center-size',
      'park-position',
      'lane-edges',
      'entry-positions',
      'pipe-positions',
    ]);
  });
  it('is the same plan every time', () => {
    expect(planNeighborhood(SHARED, WALKING_CITY, ledger)).toEqual(plan);
  });
});

describe('what the plan refuses', () => {
  function refusal(l: WalkingCityLedger): string | null {
    try {
      planNeighborhood(SHARED, WALKING_CITY, l);
      return null;
    } catch (e) {
      return e instanceof GroundError ? e.reason : 'other';
    }
  }
  it('a figure that is not positive', () => {
    expect(refusal({ ...ledger, parks: 0 })).toBe('figure-not-positive');
    expect(refusal({ ...ledger, reachKm: Number.NaN })).toBe('figure-not-positive');
  });
  it('more homes than the tile holds at any pitch', () => {
    expect(refusal({ ...ledger, centerPop: ledger.centerPop * 6 })).toBe('homes-do-not-fit');
  });
  it('more entries than the tile has one-minute cells', () => {
    expect(refusal({ ...ledger, entriesPerCenter: 500 })).toBe('entries-do-not-fit');
  });
});

describe('the frame', () => {
  const f = hexFrame(100);
  it('has a corner straight up and its full width across the middle', () => {
    expect(f.corners[0]).toEqual({ x: expect.closeTo(0, 9), y: -100 });
    expect(halfWidthAt(f, 0)).toBeCloseTo((Math.sqrt(3) / 2) * 100, 9);
    expect(halfWidthAt(f, 75)).toBeCloseTo(Math.sqrt(3) * 25, 9);
    expect(halfWidthAt(f, 101)).toBeLessThan(0);
    expect(insideFrame(f, { x: 86, y: 0 })).toBe(true);
    expect(insideFrame(f, { x: 87, y: 0 })).toBe(false);
    expect(f.areaM2).toBeCloseTo(((3 * Math.sqrt(3)) / 2) * 10000, 6);
  });
  it('refuses a corner radius that is not positive', () => {
    expect(() => hexFrame(0)).toThrow(RangeError);
  });
});

/** Keeps the type import in use when every assertion above goes through the value. */
export type Seen = NeighborhoodPlan;
