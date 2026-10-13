/**
 * @file The ground plan of the ring: so many buildings of the Ledger's floor plate round a plaza, one side each
 * facing it, a building's width apart; and the stop beneath.
 * Public interface: planRing.
 * Owner context: Ground (domain). Reads the Ledger; the circle is the Ledger's own construction (land.ts).
 */
import { RING_GAP } from '@city/ledger';
import type { WalkingCityLedger, WalkingCityPremises } from '@city/ledger';
import { hexFrame, insideFrame } from './frame.ts';
import type { Point } from './frame.ts';
import { GroundError } from './neighborhood.ts';
import type { Footprint, Placeholder, RingPlan } from './plan.ts';

/** The placements this plan chooses. The first building's bearing is not the Ledger's to fix. */
const PLACEHOLDERS: readonly Placeholder[] = ['building-angles'];

/** The ring's first building stands due north of the plaza, toward the tile's top corner. */
const FIRST_ANGLE = -Math.PI / 2;

/** A square of the given side, centered at a spot, one side facing the middle of the ring. */
function footprint(at: Point, sideM: number, angle: number, stories: number): Footprint {
  const half = sideM / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  // Local axes: u points away from the ring's middle, v along the circle.
  const corner = (u: number, v: number): Point => ({ x: at.x + u * cos - v * sin, y: at.y + u * sin + v * cos });
  return {
    at,
    sideM,
    angle,
    corners: [corner(-half, -half), corner(half, -half), corner(half, half), corner(-half, half)],
    stories,
  };
}

/** Whether two convex footprints share any ground: the separating-axis test over both squares' sides. */
function overlap(a: Footprint, b: Footprint): boolean {
  for (const shape of [a, b]) {
    for (let i = 0; i < 4; i++) {
      const p = shape.corners[i] as Point;
      const q = shape.corners[(i + 1) % 4] as Point;
      const nx = q.y - p.y;
      const ny = p.x - q.x;
      const span = (s: Footprint): readonly [number, number] => {
        let lo = Infinity;
        let hi = -Infinity;
        for (const c of s.corners) {
          const d = c.x * nx + c.y * ny;
          lo = Math.min(lo, d);
          hi = Math.max(hi, d);
        }
        return [lo, hi];
      };
      const [alo, ahi] = span(a);
      const [blo, bhi] = span(b);
      if (ahi <= blo + 1e-9 || bhi <= alo + 1e-9) return false;
    }
  }
  return true;
}

/**
 * The ground plan of a ring of so many buildings.
 * @param c - your city's premises (the floor plate and the height of a ring building)
 * @param l - your city derived: the tile, the people one building serves, the berths
 * @param buildings - how many buildings stand; the Ledger's count when not given
 * @returns the plan; with the Ledger's count its width and plaza are the Ledger's own figures
 * @throws GroundError 'no-ring-buildings' when the count is not a whole number of at least one;
 *   'figure-not-positive' when the floor plate, height or tile is not; 'buildings-overlap' if the circle the
 *   Ledger draws ever put two footprints on the same ground
 */
export function planRing(c: WalkingCityPremises, l: WalkingCityLedger, buildings: number = l.ringBuildings): RingPlan {
  if (!Number.isInteger(buildings) || buildings < 1) throw new GroundError('no-ring-buildings');
  for (const f of [c.floorPlate, c.ringStories, l.reachKm, l.ringServes]) {
    if (!(f > 0) || !Number.isFinite(f)) throw new GroundError('figure-not-positive');
  }
  const frame = hexFrame(l.reachKm * 1000);
  const sideM = Math.sqrt(c.floorPlate);
  // The Ledger's circle: the buildings and the gaps between them laid end to end make its circumference.
  const radiusM = (buildings * (1 + RING_GAP) * sideM) / (2 * Math.PI);
  const footprints: Footprint[] = [];
  for (let k = 0; k < buildings; k++) {
    const angle = FIRST_ANGLE + (2 * Math.PI * k) / buildings;
    footprints.push(
      footprint({ x: radiusM * Math.cos(angle), y: radiusM * Math.sin(angle) }, sideM, angle, c.ringStories),
    );
  }
  for (let i = 0; i < footprints.length; i++) {
    for (let j = i + 1; j < footprints.length; j++) {
      if (overlap(footprints[i] as Footprint, footprints[j] as Footprint)) throw new GroundError('buildings-overlap');
    }
  }
  const plazaR = Math.max(0, radiusM - sideM / 2);
  const plazaM2 = Math.PI * plazaR * plazaR;
  const acrossM = 2 * (radiusM + sideM / 2);
  const fitsFrame = footprints.every((f) => f.corners.every((p) => insideFrame(frame, p)));
  return {
    kind: 'ring',
    frame,
    figures: {
      buildings,
      stories: c.ringStories,
      floorPlateM2: c.floorPlate,
      sideM,
      acrossM,
      plazaM2,
      serves: l.ringServes,
      fitsFrame,
    },
    surface: { of: 'ring', level: 'surface', buildings: footprints, plaza: { at: { x: 0, y: 0 }, radiusM: plazaR, areaM2: plazaM2 } },
    sub: { of: 'ring', level: 'sub', stop: { at: { x: 0, y: 0 }, berths: l.berths } },
    placeholders: PLACEHOLDERS,
  };
}
