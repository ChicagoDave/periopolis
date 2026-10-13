/**
 * @file Ground and distance: how far people are from one another and from the middle of the ground they share.
 * Public interface: DistanceBin, discCdf, cityBins, cellBins, cornerKm, roundKm, farWalkMin.
 * Owner context: Ledger (domain).
 */
import { HEX, WALK_M_PER_MIN } from './constants.ts';

/** One bin of trip lengths: a distance in km and the share of trips that are about that long. */
export interface DistanceBin {
  readonly km: number;
  readonly share: number;
}

/**
 * Chance that two random points in a disc of radius 1 are no more than t apart.
 * @param t - a distance, in units of the disc's radius
 * @returns a probability from 0 to 1
 */
export function discCdf(t: number): number {
  if (t <= 0) return 0;
  if (t >= 2) return 1;
  return (
    1 +
    (2 / Math.PI) * (t * t - 1) * Math.acos(t / 2) -
    (t / Math.PI) * (1 + (t * t) / 2) * Math.sqrt(1 - (t * t) / 4)
  );
}

/**
 * Trip lengths between two random points in a city of radius r.
 * @param r - the city's radius in km
 * @returns 400 bins whose shares sum to 1
 */
export function cityBins(r: number): DistanceBin[] {
  const n = 400;
  const bins: DistanceBin[] = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * i) / n;
    const b = (2 * (i + 1)) / n;
    bins.push({ km: (r * (a + b)) / 2, share: discCdf(b) - discCdf(a) });
  }
  return bins;
}

/**
 * Trip lengths from a random home to the middle of the area it belongs to.
 * @param rc - the area's radius in km, taken as round
 * @returns 200 bins whose shares sum to 1
 */
export function cellBins(rc: number): DistanceBin[] {
  const n = 200;
  const bins: DistanceBin[] = [];
  for (let i = 0; i < n; i++) {
    const a = i / n;
    const b = (i + 1) / n;
    bins.push({ km: (rc * (a + b)) / 2, share: b * b - a * a });
  }
  return bins;
}

/**
 * Ground that holds a number of people as a hexagon: the distance from its middle to a corner, where the farthest home is.
 * @param people - how many live on the ground
 * @param density - people per km²
 * @returns km from the middle to a corner
 */
export function cornerKm(people: number, density: number): number {
  return Math.sqrt(people / density / HEX);
}

/**
 * Ground that holds a number of people as a circle: its radius.
 * @param people - how many live on the ground
 * @param density - people per km²
 * @returns the radius in km
 */
export function roundKm(people: number, density: number): number {
  return Math.sqrt(people / density / Math.PI);
}

/**
 * The walk from the farthest home on a hexagon of ground to its middle.
 * @param people - how many live on the ground
 * @param density - people per km²
 * @param detour - path length divided by the straight line
 * @returns minutes on foot
 */
export function farWalkMin(people: number, density: number, detour: number): number {
  return (cornerKm(people, density) * detour * 1000) / WALK_M_PER_MIN;
}
