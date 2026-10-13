/**
 * @file The ring's ground plan: the Ledger's eight buildings make its 272 m and 6.5 acres, any count stands clear
 * of its neighbors, a ring past 21 buildings spills off its tile, and each level returns only its own shapes.
 * Owner context: Ground (domain), tests.
 */
import { NEEDS, RING_GAP, SHARED, WALKING_CITY, deriveWalkingCity } from '@city/ledger';
import { describe, expect, it } from 'vitest';
import { GroundError, LEVELS, insideFrame, layersAt, planNeighborhood, planRing } from '../src/index.ts';
import type { Footprint, Point } from '../src/index.ts';

const ledger = deriveWalkingCity(SHARED, WALKING_CITY, NEEDS);
const ring = planRing(WALKING_CITY, ledger);

/** Whether a spot lies inside a footprint (strictly), by the same separating axes the plan uses. */
function within(p: Point, f: Footprint): boolean {
  for (let i = 0; i < 4; i++) {
    const a = f.corners[i] as Point;
    const b = f.corners[(i + 1) % 4] as Point;
    if ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) <= 1e-9) return false;
  }
  return true;
}

describe('the ring reconciles with the ledger', () => {
  it('eight 25-story buildings of 2,000 m² floors, 272 m across, round a 6.5-acre plaza', () => {
    expect(ring.figures.buildings).toBe(8);
    expect(ring.figures.buildings).toBe(ledger.ringBuildings);
    expect(ring.figures.stories).toBe(25);
    expect(ring.figures.floorPlateM2).toBe(2000);
    expect(Math.round(ring.figures.acrossM)).toBe(272);
    expect(ring.figures.acrossM).toBeCloseTo(ledger.ringAcrossM, 9);
    expect(ring.figures.plazaM2).toBeCloseTo(ledger.plazaM2, 9);
    expect(Math.round((ring.figures.plazaM2 / 4046.86) * 10) / 10).toBe(6.5);
    expect(Math.round(ring.figures.serves)).toBe(7771);
    expect(ring.figures.fitsFrame).toBe(true);
    expect(ring.frame.cornerM).toBeCloseTo(ledger.reachKm * 1000, 6);
  });
  it('the shapes make the figures: footprints on one circle a building apart, the plaza inside, the stop below', () => {
    const { buildings, plaza } = ring.surface;
    expect(buildings).toHaveLength(ring.figures.buildings);
    const radius = Math.hypot(buildings[0]?.at.x ?? 0, buildings[0]?.at.y ?? 0);
    expect(radius * 2 * Math.PI).toBeCloseTo(8 * (1 + RING_GAP) * ring.figures.sideM, 9);
    for (const b of buildings) {
      expect(Math.hypot(b.at.x, b.at.y)).toBeCloseTo(radius, 9);
      expect(b.sideM).toBeCloseTo(Math.sqrt(2000), 9);
      expect(b.stories).toBe(25);
      expect(b.corners).toHaveLength(4);
      for (let i = 0; i < 4; i++) {
        const p = b.corners[i] as Point;
        const q = b.corners[(i + 1) % 4] as Point;
        expect(Math.hypot(q.x - p.x, q.y - p.y)).toBeCloseTo(b.sideM, 9);
        expect(insideFrame(ring.frame, p)).toBe(true);
      }
      // The side facing the plaza is the nearest; its middle sits at radius - side/2.
      const nearest = Math.min(...b.corners.map((p) => Math.hypot(p.x, p.y)));
      expect(nearest).toBeCloseTo(Math.hypot(radius - b.sideM / 2, b.sideM / 2), 9);
    }
    expect(plaza.radiusM).toBeCloseTo(radius - ring.figures.sideM / 2, 9);
    expect(plaza.at).toEqual({ x: 0, y: 0 });
    expect(ring.figures.acrossM).toBeCloseTo(2 * (radius + ring.figures.sideM / 2), 9);
    expect(ring.sub.stop).toEqual({ at: { x: 0, y: 0 }, berths: ledger.berths });
    expect(buildings[0]?.angle).toBe(-Math.PI / 2);
    expect(ring.placeholders).toEqual(['building-angles']);
  });
  it('is the same plan every time', () => {
    expect(planRing(WALKING_CITY, ledger)).toEqual(ring);
  });
});

describe('a ring of any count the site allows', () => {
  it('stands clear: no footprint corner lies inside another footprint, from one building to forty', () => {
    for (let n = 1; n <= 40; n++) {
      const r = planRing(WALKING_CITY, ledger, n);
      expect(r.figures.buildings).toBe(n);
      expect(r.surface.buildings).toHaveLength(n);
      for (const a of r.surface.buildings) {
        for (const b of r.surface.buildings) {
          if (a === b) continue;
          for (const p of a.corners) expect(within(p, b)).toBe(false);
        }
      }
    }
  });
  it('grows with the count and fits the tile up to 21 buildings', () => {
    expect(planRing(WALKING_CITY, ledger, 1).figures.plazaM2).toBe(0);
    expect(planRing(WALKING_CITY, ledger, 21).figures.fitsFrame).toBe(true);
    expect(planRing(WALKING_CITY, ledger, 22).figures.fitsFrame).toBe(false);
    expect(planRing(WALKING_CITY, ledger, 40).figures.acrossM).toBeGreaterThan(2 * ring.frame.cornerM);
    let last = 0;
    for (let n = 1; n <= 40; n++) {
      const across = planRing(WALKING_CITY, ledger, n).figures.acrossM;
      expect(across).toBeGreaterThan(last);
      last = across;
    }
  });
});

describe('what the ring refuses', () => {
  function refusal(fn: () => unknown): string | null {
    try {
      fn();
      return null;
    } catch (e) {
      return e instanceof GroundError ? e.reason : 'other';
    }
  }
  it('no buildings, or a count that is not whole', () => {
    expect(refusal(() => planRing(WALKING_CITY, ledger, 0))).toBe('no-ring-buildings');
    expect(refusal(() => planRing(WALKING_CITY, ledger, 2.5))).toBe('no-ring-buildings');
    expect(refusal(() => planRing(WALKING_CITY, ledger, -1))).toBe('no-ring-buildings');
  });
  it('a floor plate or height that is not positive', () => {
    expect(refusal(() => planRing({ ...WALKING_CITY, floorPlate: 0 }, ledger))).toBe('figure-not-positive');
    expect(refusal(() => planRing({ ...WALKING_CITY, ringStories: Number.NaN }, ledger))).toBe('figure-not-positive');
  });
});

describe('the two levels', () => {
  const hood = planNeighborhood(SHARED, WALKING_CITY, ledger);
  it('are the surface and the sub level, in that order', () => {
    expect(LEVELS).toEqual(['surface', 'sub']);
  });
  it('each returns only its own shapes of a neighborhood', () => {
    const surface = layersAt(hood, 'surface');
    const sub = layersAt(hood, 'sub');
    expect(surface.of).toBe('neighborhood');
    expect(surface.level).toBe('surface');
    expect(surface.rows).toBe(hood.surface.rows);
    expect(Object.keys(surface)).not.toContain('entries');
    expect(sub.level).toBe('sub');
    expect(sub.entries).toBe(hood.sub.entries);
    expect(Object.keys(sub)).not.toContain('rows');
  });
  it('each returns only its own shapes of the ring', () => {
    const surface = layersAt(ring, 'surface');
    const sub = layersAt(ring, 'sub');
    expect(surface.of).toBe('ring');
    expect(surface.buildings).toBe(ring.surface.buildings);
    expect(Object.keys(surface)).not.toContain('stop');
    expect(sub.stop).toBe(ring.sub.stop);
    expect(Object.keys(sub)).not.toContain('buildings');
  });
});
