/**
 * @file The build order (ADR-0012 Decision 2): with `inOrder`, crews take the line, the ring, the plants and the
 * schools before fields and neighborhoods, whatever order they were placed in. The founding is David's run of
 * 2026-10-15 (`docs/work/tests/city-261015.txt`): six neighborhoods placed first, the line and the plants after.
 * Owner context: Run (domain), tests.
 */
import { describe, expect, it } from 'vitest';
import { RATES, addPlantUnit, addRingBuilding, emptyLayout, layStretch, placeNeighborhood, toggleExtra } from '@city/site';
import type { Layout, Outcome, TileKey } from '@city/site';
import { RULES, classOf, crewed, inHand, placeOrder, putFirst, restoreClock, startRun, tick, totalSpend } from '../src/index.ts';
import type { Game, Job, OrderOutcome } from '../src/index.ts';

function must(out: OrderOutcome): Game {
  if (!out.ok) throw new Error(`refused: ${out.rejection.reason}`);
  return out.game;
}

const order = (game: Game, command: (plan: Layout) => Outcome): Game => must(placeOrder(game, command, RULES));

const HOODS: readonly TileKey[] = ['0,-1', '1,-1', '-1,0', '1,0', '-1,1', '0,1'];
const STRETCHES: readonly (readonly [TileKey, TileKey])[] = [
  ['-1,0', '0,0'], ['-1,0', '0,-1'], ['1,-1', '1,0'], ['-1,1', '0,1'], ['-1,1', '0,0'], ['0,0', '0,1'],
  ['0,-1', '0,0'], ['0,-1', '1,-1'], ['0,1', '1,0'], ['-1,0', '-1,1'], ['-1,0', '-2,0'], ['-2,0', '-3,0'],
  ['-4,-1', '-4,0'], ['-4,0', '-5,1'], ['-3,0', '-4,1'], ['-4,1', '-5,2'], ['-5,2', '-6,3'], ['-3,0', '-4,0'], ['0,0', '1,0'],
];

/** The homes, ring, schools and fields, as David placed them first. */
function homesFirst(game: Game): Game {
  let g = order(game, (p) => addRingBuilding(p, '0,0', RATES));
  for (const h of HOODS) g = order(g, (p) => placeNeighborhood(p, h, RATES));
  for (const h of ['1,-1', '-1,0', '0,1']) g = order(g, (p) => toggleExtra(p, h, 'elementary', RATES));
  for (const h of ['1,-1', '-1,1']) g = order(g, (p) => toggleExtra(p, h, 'fields', RATES));
  return g;
}

/** Then the line and the plants. */
function thenTheLine(game: Game): Game {
  let g = game;
  for (const [a, b] of STRETCHES) g = order(g, (p) => layStretch(p, a, b, RATES));
  g = order(g, (p) => addPlantUnit(p, '5,-4', 'power', RATES));
  g = order(g, (p) => addPlantUnit(p, '-6,3', 'water', RATES));
  g = order(g, (p) => addPlantUnit(p, '-5,1', 'sewage', RATES));
  return order(g, (p) => addPlantUnit(p, '-4,-1', 'waste', RATES));
}

const founding = (inOrder: boolean): Game => thenTheLine(homesFirst(startRun(emptyLayout(), 7, RATES, RULES, { inOrder })));

const hoodsStanding = (g: Game): number => HOODS.filter((h) => g.layout.tiles[h]?.kind === 'hood').length;
const tickTo = (g: Game, year: number): Game => {
  while (g.clock && g.clock.year < year) g = tick(g, RATES, RULES);
  return g;
};

describe('the crew order', () => {
  it('puts the line, the ring, the plants and the schools first, then fields, then neighborhoods', () => {
    expect(['line', 'ring', 'power', 'water', 'sewage', 'waste', 'elementary', 'middle', 'high'].map((w) => classOf(w as Job['what']))).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(classOf('fields')).toBe(1);
    expect(classOf('hood')).toBe(2);
  });

  it('refuses a crew count that is not a whole number of crews', () => {
    expect(() => crewed([], -1, true)).toThrow('crews must be a whole number');
    expect(() => crewed([], 2.5, false)).toThrow('crews must be a whole number');
  });
});

describe("David's founding, built in order (city-261015)", () => {
  it('the first year takes the crews off the homes and puts them on the line and the plants', () => {
    // The first ten of class 0 in placed order: the ring (2 years), three schools (1, then ready for their homes) and
    // the first six stretches (1, so they open).
    const g = tick(founding(true), RATES, RULES);
    const jobs = g.clock?.jobs ?? [];
    expect(Object.keys(g.layout.lines)).toHaveLength(6);
    expect(jobs.find((j) => j.what === 'ring')?.left).toBe(1);
    expect(jobs.filter((j) => j.what === 'elementary').map((j) => j.left)).toEqual([0, 0, 0]);
    expect(jobs.filter((j) => j.what === 'hood').every((j) => j.left === j.total)).toBe(true);
    expect(jobs.filter((j) => j.what === 'fields').every((j) => j.left === j.total)).toBe(true);
  });

  it('every stretch and every plant stands before the first neighborhood opens', () => {
    let g = founding(true);
    while (g.clock && hoodsStanding(g) === 0 && g.clock.year < RULES.years) g = tick(g, RATES, RULES);
    expect(hoodsStanding(g)).toBeGreaterThan(0);
    expect(Object.keys(g.layout.lines)).toHaveLength(STRETCHES.length);
    for (const [k, kind] of [['5,-4', 'power'], ['-6,3', 'water'], ['-5,1', 'sewage'], ['-4,-1', 'waste']] as const) {
      expect(g.layout.tiles[k]?.kind).toBe(kind);
    }
    expect(g.clock?.year).toBeGreaterThan(2);
  });

  it('without inOrder the same orders play as the sketch: the homes open at year 2 with the line still in hand', () => {
    // Year 1 crews the ring, the six homes and the three schools; year 2 the ring and homes again, the two fields and
    // the first stretch.
    const g = tickTo(founding(false), 2);
    expect(hoodsStanding(g)).toBe(HOODS.length);
    expect(Object.keys(g.layout.lines)).toEqual(['-1,0|0,0']);
    expect(g.clock?.jobs.filter((j) => j.what === 'line')).toHaveLength(STRETCHES.length - 1);
  });

  it('by year 20 the same city stands either way, and each paid to build exactly what stands', () => {
    // What stands is priced for the people living there (ADR-0007), and in order nobody may live in this city (one
    // module cannot carry a peak with one down), so the two runs pay differently; each pays for what it built.
    const a = tickTo(founding(true), RULES.years);
    const b = tickTo(founding(false), RULES.years);
    expect(a.layout).toEqual(b.layout);
    for (const g of [a, b]) {
      const t = totalSpend(g.clock?.record ?? []);
      const last = g.clock?.record[RULES.years];
      expect(t.byLayer.groundworks + t.byLayer.buildings).toBeCloseTo((last?.standing.groundworks ?? 0) + (last?.standing.buildings ?? 0), 2);
    }
  });
});

describe('orders and the work in hand under the crew order', () => {
  it('a stretch ordered behind the homes starts now; on the sketch clock it waits', () => {
    const first = (inOrder: boolean): OrderOutcome =>
      placeOrder(homesFirst(startRun(emptyLayout(), 7, RATES, RULES, { inOrder })), (p) => layStretch(p, '-1,0', '0,0', RATES), RULES);
    const ours = first(true);
    const sketch = first(false);
    expect(ours.ok && ours.events.map((e) => e.type === 'JobOrdered' && e.startsNow)).toEqual([true]);
    expect(sketch.ok && sketch.events.map((e) => e.type === 'JobOrdered' && e.startsNow)).toEqual([false]);
  });

  it('the work in hand shows the stretches working and the homes waiting', () => {
    const g = founding(true);
    const hand = inHand(g.layout, g.clock?.jobs ?? null, RULES, true);
    expect(hand.list.filter((j) => j.what === 'hood').every((j) => j.status === 'waiting')).toBe(true);
    expect(hand.list.filter((j) => j.status === 'working').every((j) => classOf(j.what) === 0)).toBe(true);
    expect(hand.working).toBe(RULES.crews);
  });

  it('putting a home first puts it first among the homes, not ahead of the line', () => {
    const g = founding(true);
    const jobs = g.clock?.jobs ?? [];
    const last = jobs.map((j) => j.what).lastIndexOf('hood');
    const moved = putFirst(jobs, last);
    const hand = inHand(g.layout, moved, RULES, true);
    expect(hand.list[0]?.what).toBe('hood');
    expect(hand.list[0]?.status).toBe('waiting');
    expect(hand.list.filter((j) => j.status === 'working').every((j) => classOf(j.what) === 0)).toBe(true);
  });
});

describe('a stored run keeps its order', () => {
  it('restores inOrder when it was stored, and only when it was stored as true', () => {
    const g = tick(founding(true), RATES, RULES);
    const stored = JSON.parse(JSON.stringify(g.clock)) as Record<string, unknown>;
    expect(restoreClock(stored, g.layout, RATES, RULES)?.inOrder).toBe(true);
    for (const bad of [undefined, 'yes', 1, false]) {
      expect(restoreClock({ ...stored, inOrder: bad }, g.layout, RATES, RULES)?.inOrder).toBeUndefined();
    }
  });

  it('a run started without inOrder carries no flag, so the sketch clock is stored as before', () => {
    const g = startRun(emptyLayout(), 7, RATES, RULES);
    expect(g.clock && 'inOrder' in g.clock).toBe(false);
  });
});
