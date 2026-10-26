/**
 * @file Surface traffic held to numbers: a neighborhood's paths are its lane joined end to end and one down the middle
 * of every street; it gets a bike for every 60 m of lane and a cart for every 100 homes, each on a path of its class
 * by its seed; they run at their speed, turn back at the ends, stay on their paths and face the way they run; the
 * same seed and seconds give the same states. The streets module's vegetation: a tree each 24 m on both sidewalks,
 * a lamp each 48 m, a hedge a home along every garden gap, all bulk.
 * Owner context: Board (adapter), tests.
 */
import { describe, expect, it } from 'vitest';
import { planNeighborhood } from '@city/ground';
import { RATES } from '@city/site';
import { BIKE_PER_M, CART_PER_HOMES, SPEED, pathsOf, placeTraffic, stepTraffic, trafficOf } from '../src/draw/irl/traffic.ts';
import { LAMP_PITCH_M, TREE_PITCH_M, streetsOf } from '../src/draw/irl/streets.ts';

const hood = planNeighborhood(RATES.shared, RATES.walking, RATES.base);
const at = { x: 400, y: -300 };
const paths = pathsOf(hood, at);
const close = (a: number, b: number, eps = 1e-6): void => expect(Math.abs(a - b)).toBeLessThan(eps);

/** How far a point lies from a polyline. */
function offPath(points: readonly { x: number; y: number }[], p: { x: number; y: number }): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1] as { x: number; y: number };
    const b = points[i] as { x: number; y: number };
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy));
  }
  return best;
}

describe('the paths', () => {
  it("are the lane's three edges joined, the Ground's length, and one down the middle of every street", () => {
    const lane = paths.filter((p) => p.cls === 'bike');
    expect(lane.length).toBe(1);
    expect(lane[0]?.points.length).toBe(hood.surface.lane.length + 1);
    close(lane[0]?.lengthM ?? 0, hood.figures.laneM, 1e-6);
    const carts = paths.filter((p) => p.cls === 'cart');
    expect(carts.length).toBe(streetsOf(hood, at).streets);
    for (const c of carts) expect(c.points.length).toBe(2);
  });
});

describe('the traffic', () => {
  const states = trafficOf(paths, hood.figures.laneM, hood.figures.homes, 42);
  it('is a bike each 60 m of lane and a cart each 100 homes, every one on a path of its class, started some way along it', () => {
    expect(states.filter((s) => s.cls === 'bike').length).toBe(Math.round(hood.figures.laneM / BIKE_PER_M));
    expect(states.filter((s) => s.cls === 'cart').length).toBe(Math.round(hood.figures.homes / CART_PER_HOMES));
    expect(new Set(states.map((s) => s.id)).size).toBe(states.length);
    for (const s of states) {
      const path = paths[s.path];
      expect(path?.cls).toBe(s.cls);
      expect(s.alongM).toBeGreaterThanOrEqual(0);
      expect(s.alongM).toBeLessThanOrEqual(path?.lengthM ?? 0);
      close(offPath(path?.points ?? [], placeTraffic(paths, s)), 0, 1e-6);
    }
    expect(trafficOf(paths, 0, 0, 1).length).toBe(0);
  });
  it('runs at its speed, turns back at the ends, stays on its path for an hour, faces the way it runs, and repeats for the same seed', () => {
    const one = { ...(states[0] as (typeof states)[0]), alongM: 10, forward: true };
    const path = paths[one.path] as (typeof paths)[0];
    const ran = stepTraffic(paths, [one], 2)[0] as typeof one;
    close(ran.alongM, 10 + 2 * SPEED[one.cls]);
    expect(ran.forward).toBe(true);
    const back = stepTraffic(paths, [{ ...one, alongM: path.lengthM - 1 }], 1)[0] as typeof one;
    expect(back.forward).toBe(false);
    close(back.alongM, path.lengthM - (SPEED[one.cls] - 1));
    let all = states;
    for (let s = 0; s < 3600; s += 3) all = stepTraffic(paths, all, 3);
    for (const s of all) {
      const p = paths[s.path] as (typeof paths)[0];
      expect(s.alongM).toBeGreaterThanOrEqual(0);
      expect(s.alongM).toBeLessThanOrEqual(p.lengthM);
      const placed = placeTraffic(paths, s);
      close(offPath(p.points, placed), 0, 1e-6);
      expect(Number.isFinite(placed.heading)).toBe(true);
    }
    expect(JSON.stringify(stepTraffic(paths, states, 7))).toBe(JSON.stringify(stepTraffic(paths, states, 7)));
    expect(stepTraffic(paths, states, 0)).toEqual(states);
    expect(JSON.stringify(trafficOf(paths, hood.figures.laneM, hood.figures.homes, 7))).not.toBe(JSON.stringify(states));
  });
});

describe('the vegetation and furniture', () => {
  const laid = streetsOf(hood, at);
  it('a tree each 24 m on both sidewalks and a lamp each 48 m on one, a hedge a home along every garden gap, all bulk', () => {
    const trees = laid.props.filter((p) => p.model === 'tree-small');
    const lamps = laid.props.filter((p) => p.model === 'lamp');
    const hedges = laid.props.filter((p) => p.model === 'hedge');
    expect(trees.length).toBeGreaterThan(2 * laid.streets * 5);
    expect(lamps.length).toBeGreaterThan(laid.streets * 2);
    expect(hedges.length).toBeGreaterThan(laid.streets * 20);
    for (const p of [...trees, ...lamps, ...hedges]) expect(p.bulk).toBe(true);
    for (const p of laid.props.filter((x) => x.model === 'lamp-double' || x.model === 'planter')) expect(p.bulk).toBeUndefined();
    // Trees along one street are a pitch apart, lamps two.
    const asphalt = laid.strips.find((s) => s.kind === 'asphalt');
    if (!asphalt) throw new Error('street');
    const ys = asphalt.corners.map((c) => c.y);
    const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
    const north = trees.filter((t) => t.y < mid && t.y > mid - 8).map((t) => t.x).sort((a, b) => a - b);
    for (let i = 1; i < north.length; i++) close((north[i] as number) - (north[i - 1] as number), TREE_PITCH_M);
    const lampsHere = lamps.filter((l) => l.y < mid && l.y > mid - 8).map((l) => l.x).sort((a, b) => a - b);
    for (let i = 1; i < lampsHere.length; i++) close((lampsHere[i] as number) - (lampsHere[i - 1] as number), LAMP_PITCH_M);
    // Hedges lie a home apart on a garden line, halfway between two lines of rows.
    const lines = [...new Set(hood.surface.rows.map((r) => Math.round(r.y * 100) / 100))].sort((a, b) => a - b);
    const hedgeYs = new Set(hedges.map((h) => Math.round((h.y - at.y) * 100) / 100));
    for (const y of hedgeYs) {
      const i = lines.findIndex((l) => Math.abs((l + (lines[lines.indexOf(l) + 1] ?? l)) / 2 - y) < 1e-6);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i % 2).toBe(0);
    }
  });
});
