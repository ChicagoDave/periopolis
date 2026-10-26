/**
 * @file The IRL view's camera: an orbit about a point on the site, held as a plain value (target, distance, azimuth,
 * elevation, field of view) in scene metres, x east, y south, z up. Pure, no DOM, no three.js: the page's GL adapter
 * turns it into a perspective camera, and a street-level camera later is a second controller over the same scene.
 * Fitting, turning, coming nearer, sliding and the pixels a metre at the target are all functions of the value.
 * Public interface: Point3, Orbit, Bounds, FOV_RAD, ELEVATION_MIN, ELEVATION_MAX, DISTANCE_MIN_M, FAR_FACTOR,
 * boundsOf, fitOrbit, turnOrbit, dollyOrbit, panOrbit, eyeOf, pixelsPerMetre.
 * Owner context: Board (adapter), the IRL view (plan irl-3d-city-view, ADR-0023).
 */
import type { Scene } from '../angled/scene.ts';

/** A point in scene metres: x east, y south, z up. */
export interface Point3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Where the viewer stands: on a sphere about the target, so far from it, turned round it and raised above it. */
export interface Orbit {
  readonly target: Point3;
  /** Metres from the eye to the target, positive. */
  readonly distance: number;
  /** Turn round the target, radians; 0 looks from the south, growing counter-clockwise seen from above. */
  readonly azimuth: number;
  /** Angle above the ground, radians, in [ELEVATION_MIN, ELEVATION_MAX]. */
  readonly elevation: number;
  /** Vertical field of view, radians. */
  readonly fov: number;
}

/** The box the scene fills, metres. */
export interface Bounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly maxZ: number;
}

/** The vertical field of view: 45 degrees, a lens that neither flattens nor fish-eyes a city. */
export const FOV_RAD = (45 * Math.PI) / 180;

/** The lowest the viewer goes, so the ground never flips: five degrees. */
export const ELEVATION_MIN = (5 * Math.PI) / 180;

/** The highest, a degree short of straight down, so the turn stays meaningful. */
export const ELEVATION_MAX = (89 * Math.PI) / 180;

/** The nearest the eye comes to the target, metres: a townhouse row seen from across the street. */
export const DISTANCE_MIN_M = 40;

/** The farthest, as a multiple of the fitted distance. */
export const FAR_FACTOR = 3;

/** The turn and the height the view opens at: a sixth of a turn, so two faces of every block show, at fifty degrees. */
const OPEN_AZIMUTH = Math.PI / 6;
const OPEN_ELEVATION = (50 * Math.PI) / 180;

/** The box round every block of a scene, its heights included; null for an empty scene. */
export function boundsOf(scene: Scene): Bounds | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = 0;
  for (const b of scene.blocks) {
    for (const c of b.block.corners) {
      minX = Math.min(minX, c.x);
      maxX = Math.max(maxX, c.x);
      minY = Math.min(minY, c.y);
      maxY = Math.max(maxY, c.y);
    }
    maxZ = Math.max(maxZ, b.block.heightM);
  }
  return Number.isFinite(minX) ? { minX, maxX, minY, maxY, maxZ } : null;
}

/** The radius of the sphere round a box. */
function radiusOf(bounds: Bounds): number {
  return Math.max(1, Math.hypot(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, bounds.maxZ) / 2);
}

/** The narrower of the two fields of view: the vertical, or the horizontal that an aspect gives it. */
function narrowFov(fov: number, aspect: number): number {
  const horizontal = 2 * Math.atan(Math.tan(fov / 2) * aspect);
  return Math.min(fov, horizontal);
}

/** The distance at which a box's sphere just fits the view. */
function fitDistance(bounds: Bounds, aspect: number, fov: number): number {
  return radiusOf(bounds) / Math.sin(narrowFov(fov, aspect) / 2);
}

/**
 * The orbit the view opens at: the box's middle as the target, the whole sphere round it in view, a sixth of a
 * turn and fifty degrees up.
 * @param bounds - the scene's box
 * @param aspect - the canvas, width over height, positive
 * @throws RangeError on an aspect that is not positive
 */
export function fitOrbit(bounds: Bounds, aspect: number): Orbit {
  if (!(aspect > 0)) throw new RangeError(`aspect ${aspect} is not positive`);
  return {
    target: { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2, z: 0 },
    distance: fitDistance(bounds, aspect, FOV_RAD),
    azimuth: OPEN_AZIMUTH,
    elevation: OPEN_ELEVATION,
    fov: FOV_RAD,
  };
}

/** The orbit turned round the target and raised or lowered, the elevation held within its bounds. */
export function turnOrbit(orbit: Orbit, byAzimuth: number, byElevation: number): Orbit {
  const azimuth = ((orbit.azimuth + byAzimuth) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  const elevation = Math.max(ELEVATION_MIN, Math.min(ELEVATION_MAX, orbit.elevation + byElevation));
  return { ...orbit, azimuth, elevation };
}

/**
 * Nearer or farther by a factor, held between the nearest the eye comes and FAR_FACTOR times the fitted distance.
 * @param factor - over 1 is farther, under 1 nearer; not positive leaves the orbit as it is
 */
export function dollyOrbit(orbit: Orbit, factor: number, bounds: Bounds, aspect: number): Orbit {
  if (!(factor > 0)) return orbit;
  const far = FAR_FACTOR * fitDistance(bounds, aspect, orbit.fov);
  return { ...orbit, distance: Math.max(DISTANCE_MIN_M, Math.min(far, orbit.distance * factor)) };
}

/** Metres on the ground at the target that one pixel of a canvas so many pixels high spans. */
function metresPerPixel(orbit: Orbit, height: number): number {
  return (2 * orbit.distance * Math.tan(orbit.fov / 2)) / Math.max(1, height);
}

/**
 * The target slid along the ground by a drag of so many pixels: across to the viewer's right, and down the screen
 * toward the viewer; the target stays inside the scene's box.
 */
export function panOrbit(orbit: Orbit, dx: number, dy: number, height: number, bounds: Bounds): Orbit {
  const m = metresPerPixel(orbit, height);
  // The eye sits at (sin az, cos az) from the target on the ground; its right is a quarter turn from that.
  const rightX = Math.cos(orbit.azimuth);
  const rightY = -Math.sin(orbit.azimuth);
  const towardX = Math.sin(orbit.azimuth);
  const towardY = Math.cos(orbit.azimuth);
  const x = orbit.target.x - dx * m * rightX + dy * m * towardX;
  const y = orbit.target.y - dx * m * rightY + dy * m * towardY;
  return {
    ...orbit,
    target: { x: Math.max(bounds.minX, Math.min(bounds.maxX, x)), y: Math.max(bounds.minY, Math.min(bounds.maxY, y)), z: orbit.target.z },
  };
}

/** Where the eye is, in scene metres. */
export function eyeOf(orbit: Orbit): Point3 {
  const flat = orbit.distance * Math.cos(orbit.elevation);
  return {
    x: orbit.target.x + flat * Math.sin(orbit.azimuth),
    y: orbit.target.y + flat * Math.cos(orbit.azimuth),
    z: orbit.target.z + orbit.distance * Math.sin(orbit.elevation),
  };
}

/** Pixels a metre on the ground at the target, for the detail the view deserves (the angled view's `lodFor`). */
export function pixelsPerMetre(orbit: Orbit, height: number): number {
  return 1 / metresPerPixel(orbit, height);
}
