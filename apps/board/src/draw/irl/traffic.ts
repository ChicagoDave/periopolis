/**
 * @file Surface traffic, cosmetic and seeded (ADR-0024 Decision 6): bikes running the Ground's bike lane and delivery
 * carts running a neighborhood's streets, back and forth, each a state (which path, how far along, which way)
 * stepped by wall-clock seconds, like the fleet of movers and like them deciding no fact of the city. A neighborhood
 * gets one bike for every BIKE_PER_M of its lane and one cart for every CART_PER_HOMES of its homes, each on a path
 * chosen and started by a seeded hash. No people. Pure, no DOM, no clock of its own.
 * Public interface: TrafficClass, Path, TrafficState, TrafficPlaced, BIKE_PER_M, CART_PER_HOMES, SPEED, pathsOf,
 * trafficOf, stepTraffic, placeTraffic.
 * Owner context: Board (adapter), the IRL view (plan simcity-detail-city).
 */
import type { NeighborhoodPlan, Point } from '@city/ground';
import { hashOf } from './facade.ts';
import { streetsOf } from './streets.ts';

/** What runs on the surface. */
export type TrafficClass = 'bike' | 'cart';

/** A path to run: its points in scene metres, in order, and its length. */
export interface Path {
  readonly cls: TrafficClass;
  readonly points: readonly Point[];
  readonly lengthM: number;
}

/** One bike or cart: its path, metres along it, and which way it runs. */
export interface TrafficState {
  readonly id: number;
  readonly cls: TrafficClass;
  readonly path: number;
  readonly alongM: number;
  readonly forward: boolean;
}

/** Where one is on the ground, and which way it points. */
export interface TrafficPlaced {
  readonly cls: TrafficClass;
  readonly x: number;
  readonly y: number;
  readonly heading: number;
}

/** Metres of lane a bike (Mine), and homes a cart (Mine). */
export const BIKE_PER_M = 60;
export const CART_PER_HOMES = 100;

/** Metres a second each runs at (Mine: a bike 5 m/s, a cart 3). */
export const SPEED: Readonly<Record<TrafficClass, number>> = { bike: 5, cart: 3 };

function lengthOf(points: readonly Point[]): number {
  let m = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1] as Point;
    const b = points[i] as Point;
    m += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return m;
}

/**
 * A neighborhood's paths: one for the bikes, the lane's three edges joined end to end, and one for the carts a
 * street, down the middle of its shared surface.
 * @param plan - the Ground's neighborhood
 * @param at - the tile's middle, scene metres
 */
export function pathsOf(plan: NeighborhoodPlan, at: Point): Path[] {
  const lane: Point[] = [];
  for (const seg of plan.surface.lane) {
    if (!lane.length) lane.push({ x: at.x + seg.from.x, y: at.y + seg.from.y });
    lane.push({ x: at.x + seg.to.x, y: at.y + seg.to.y });
  }
  const paths: Path[] = [];
  if (lane.length > 1) paths.push({ cls: 'bike', points: lane, lengthM: lengthOf(lane) });
  for (const strip of streetsOf(plan, at).strips) {
    if (strip.kind !== 'asphalt') continue;
    const xs = strip.corners.map((c) => c.x);
    const ys = strip.corners.map((c) => c.y);
    const y = (Math.min(...ys) + Math.max(...ys)) / 2;
    const points = [
      { x: Math.min(...xs), y },
      { x: Math.max(...xs), y },
    ];
    paths.push({ cls: 'cart', points, lengthM: lengthOf(points) });
  }
  return paths;
}

/**
 * The traffic a neighborhood gets, each on a path of its class chosen by its seed and started some seeded way along it.
 * @param paths - the neighborhood's paths
 * @param laneM - the lane's length, metres (the Ground's)
 * @param homes - the neighborhood's homes (the Ground's)
 * @param seed - the tile's seed
 * @param firstId - the id the first gets; the rest follow
 */
export function trafficOf(paths: readonly Path[], laneM: number, homes: number, seed: number, firstId = 0): TrafficState[] {
  const out: TrafficState[] = [];
  const bikes = Math.max(0, Math.round(laneM / BIKE_PER_M));
  const carts = Math.max(0, Math.round(homes / CART_PER_HOMES));
  let id = firstId;
  const spawn = (cls: TrafficClass, count: number): void => {
    const mine = paths.map((p, i) => ({ p, i })).filter((x) => x.p.cls === cls);
    if (!mine.length) return;
    for (let k = 0; k < count; k++) {
      const h = hashOf(`${seed}:${cls}:${k}`);
      const chosen = mine[h % mine.length] as { p: Path; i: number };
      out.push({ id: id++, cls, path: chosen.i, alongM: ((h >>> 8) % 1000) / 1000 * chosen.p.lengthM, forward: (h & 1) === 1 });
    }
  };
  spawn('bike', bikes);
  spawn('cart', carts);
  return out;
}

/** Everything so many seconds on: along its path at its speed, turning back at either end. Seconds not positive
 * change nothing. */
export function stepTraffic(paths: readonly Path[], states: readonly TrafficState[], seconds: number): TrafficState[] {
  if (!(seconds > 0)) return [...states];
  return states.map((s) => {
    const path = paths[s.path];
    if (!path || !(path.lengthM > 0)) return s;
    let along = s.alongM + (s.forward ? 1 : -1) * SPEED[s.cls] * seconds;
    let forward = s.forward;
    for (let guard = 0; guard < 16 && (along < 0 || along > path.lengthM); guard++) {
      if (along > path.lengthM) {
        along = 2 * path.lengthM - along;
        forward = false;
      } else if (along < 0) {
        along = -along;
        forward = true;
      }
    }
    return { ...s, alongM: Math.max(0, Math.min(path.lengthM, along)), forward };
  });
}

/** Where one is: the point so far along its path, facing the way it runs. */
export function placeTraffic(paths: readonly Path[], s: TrafficState): TrafficPlaced {
  const path = paths[s.path];
  if (!path) throw new RangeError(`no path ${s.path}`);
  let left = s.alongM;
  for (let i = 1; i < path.points.length; i++) {
    const a = path.points[i - 1] as Point;
    const b = path.points[i] as Point;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (left <= len || i === path.points.length - 1) {
      const t = len > 0 ? Math.max(0, Math.min(1, left / len)) : 0;
      const heading = Math.atan2(b.y - a.y, b.x - a.x) + (s.forward ? 0 : Math.PI);
      return { cls: s.cls, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, heading };
    }
    left -= len;
  }
  const p = path.points[0] as Point;
  return { cls: s.cls, x: p.x, y: p.y, heading: 0 };
}
