/**
 * @file The fleet of movers held to numbers: the fleet is the Ledger's for the people living there and splits by its
 * mix; the line is a graph with the closed stretches shut; movers spawn at stops, dwell, run at their class's speed
 * along their stretch, turn at stops by their seed, never enter a closed stretch, keep their places when the fleet
 * grows or shrinks, and are set down at a stop only when their own stretch closes; the same seed and seconds give
 * the same states.
 * Owner context: Board (adapter), tests.
 */
import { describe, expect, it } from 'vitest';
import { RATES, starterLayout } from '@city/site';
import type { EdgeKey } from '@city/site';
import { DWELL_S, SPEED_M_S, fleetOf, graphOf, placeOf, reconcile, spawn, step } from '../src/draw/irl/movers.ts';
import type { MoverState } from '../src/draw/irl/movers.ts';

const layout = starterLayout();
const graph = graphOf(layout, RATES);
const SEED = 42;
const close = (a: number, b: number, eps = 1e-6): void => expect(Math.abs(a - b)).toBeLessThan(eps);

/** How far a point is from the segment between a stretch's ends. */
function offLine(m: MoverState): number {
  const e = graph.edges[m.edge];
  if (!e) throw new Error('edge');
  const a = graph.at[e.a];
  const b = graph.at[e.b];
  if (!a || !b) throw new Error('ends');
  const p = placeOf(graph, m);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  const cx = a.x + Math.max(0, Math.min(1, t)) * dx;
  const cy = a.y + Math.max(0, Math.min(1, t)) * dy;
  return Math.hypot(p.x - cx, p.y - cy);
}

describe('the fleet', () => {
  it("is the Ledger's at 50,000 people, split by its mix, and scales by the people living there", () => {
    const f = fleetOf(50000, RATES.base);
    expect(f.pod + f.cab + f.shuttle).toBe(Math.round(RATES.base.fleet));
    expect(f.cab).toBe(Math.round(RATES.base.fleet * RATES.base.mix.cab));
    expect(f.shuttle).toBe(Math.round(RATES.base.fleet * RATES.base.mix.shuttle));
    const half = fleetOf(25000, RATES.base);
    expect(half.pod + half.cab + half.shuttle).toBe(Math.round(RATES.base.fleetPer1000 * 25));
    expect(fleetOf(0, RATES.base)).toEqual({ pod: 0, cab: 0, shuttle: 0 });
  });
  it("the line is a graph of the layout's stretches with their lengths, and a closed stretch leaves what is open", () => {
    expect(Object.keys(graph.edges).length).toBe(Object.keys(layout.lines).length);
    for (const e of Object.values(graph.edges)) {
      const a = graph.at[e.a];
      const b = graph.at[e.b];
      if (!a || !b) throw new Error('ends');
      close(e.lengthM, Math.hypot(b.x - a.x, b.y - a.y));
      expect(e.lengthM).toBeGreaterThan(100);
    }
    const edge = Object.keys(layout.lines).sort()[0] as EdgeKey;
    const shut = graphOf(layout, RATES, [edge]);
    expect(shut.edges[edge]?.closed).toBe(true);
    for (const list of Object.values(shut.open)) expect(list.includes(edge)).toBe(false);
    expect(Object.values(graph.open).flat().filter((k) => k === edge).length).toBe(2);
  });
});

describe('the movers', () => {
  const fleet = fleetOf(50000, RATES.base);
  const movers = reconcile(graph, [], fleet, SEED);
  it('spawn to the fleet, each on an open stretch leaving a seeded stop, some seeded way along it', () => {
    expect(movers.length).toBe(fleet.pod + fleet.cab + fleet.shuttle);
    expect(movers.filter((m) => m.cls === 'pod').length).toBe(fleet.pod);
    expect(movers.filter((m) => m.cls === 'shuttle').length).toBe(fleet.shuttle);
    expect(new Set(movers.map((m) => m.id)).size).toBe(movers.length);
    for (const m of movers) {
      const e = graph.edges[m.edge];
      expect(e).toBeDefined();
      expect(m.alongM).toBeGreaterThanOrEqual(0);
      expect(m.alongM).toBeLessThan(e?.lengthM ?? 0);
      expect(m.dwellS).toBe(0);
      close(offLine(m), 0);
    }
    expect(new Set(movers.map((m) => Math.round(m.alongM / 50))).size).toBeGreaterThan(3);
    expect(spawn(graphOf({ ...layout, lines: {} }, RATES), 0, 'pod', SEED)).toBeNull();
  });
  it('wait out the dwell, then run their stretch at their speed, staying on the line, and turn at the stop onto an open stretch', () => {
    const one = { ...(movers[0] as MoverState), alongM: 0, dwellS: DWELL_S };
    const waited = step(graph, [one], DWELL_S, SEED)[0] as MoverState;
    expect(waited.dwellS).toBe(0);
    expect(waited.alongM).toBe(0);
    const ran = step(graph, [waited], 10, SEED)[0] as MoverState;
    close(ran.alongM, 10 * SPEED_M_S[one.cls]);
    close(offLine(ran), 0);
    const len = graph.edges[one.edge]?.lengthM ?? 0;
    const turned = step(graph, [waited], len / SPEED_M_S[one.cls] + 1, SEED)[0] as MoverState;
    expect(turned.legs).toBe(1);
    expect(turned.edge).not.toBe(one.edge);
    expect(turned.alongM).toBe(0);
    expect(turned.dwellS).toBeGreaterThan(0);
    const stopReached = one.forward ? graph.edges[one.edge]?.b : graph.edges[one.edge]?.a;
    expect(graph.open[stopReached as string]?.includes(turned.edge)).toBe(true);
    // Over an hour, every mover stays on the line and keeps moving.
    let all = movers;
    for (let s = 0; s < 3600; s += 7) all = step(graph, all, 7, SEED);
    for (const m of all) close(offLine(m), 0);
    expect(all.every((m) => m.legs > 0)).toBe(true);
    const heading = placeOf(graph, all[0] as MoverState).heading;
    expect(Number.isFinite(heading)).toBe(true);
  });
  it('the same seed and seconds give the same states, seconds that are not positive change nothing, and a different seed takes different turns', () => {
    const a = step(graph, step(graph, movers, 30, SEED), 45, SEED);
    const b = step(graph, step(graph, movers, 30, SEED), 45, SEED);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(step(graph, movers, 0, SEED)).toEqual(movers);
    expect(step(graph, movers, -1, SEED)).toEqual(movers);
    const other = reconcile(graph, [], fleet, 7);
    expect(JSON.stringify(other)).not.toBe(JSON.stringify(movers));
  });
  it('a bigger fleet adds movers and a smaller removes them, the rest untouched; a closed stretch sets down only the movers on it, and none enters it after', () => {
    let all = step(graph, movers, 100, SEED);
    const more = reconcile(graph, all, { pod: fleet.pod + 5, cab: fleet.cab, shuttle: fleet.shuttle + 1 }, SEED);
    expect(more.length).toBe(all.length + 6);
    for (const m of all) expect(more.find((x) => x.id === m.id)).toEqual(m);
    const fewer = reconcile(graph, more, { pod: fleet.pod - 3, cab: fleet.cab, shuttle: fleet.shuttle }, SEED);
    expect(fewer.length).toBe(all.length - 3);
    for (const m of fewer) expect(more.find((x) => x.id === m.id)).toEqual(m);
    // Close the stretch most movers are on.
    const counts = new Map<string, number>();
    for (const m of all) counts.set(m.edge, (counts.get(m.edge) ?? 0) + 1);
    const busiest = [...counts.entries()].sort((p, q) => q[1] - p[1])[0]?.[0] as EdgeKey;
    const shut = graphOf(layout, RATES, [busiest]);
    const setDown = reconcile(shut, all, fleet, SEED);
    expect(setDown.length).toBe(all.length);
    for (const m of all) {
      const after = setDown.find((x) => x.id === m.id);
      if (m.edge === busiest) {
        expect(after?.edge).not.toBe(busiest);
        expect(after?.alongM).toBe(0);
      } else expect(after).toEqual(m);
    }
    all = setDown;
    for (let s = 0; s < 1800; s += 5) {
      all = step(shut, all, 5, SEED);
      expect(all.some((m) => m.edge === busiest)).toBe(false);
    }
  });
});
