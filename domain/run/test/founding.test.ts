/**
 * @file The founding run on the real path (ADR-0015, Phase 5 of `docs/work/archive/sim-infers-growth/plan.md`): David's
 * founding of 2026-10-15 (`docs/work/tests/city-261015.txt`) and one neighborhood on an empty site, each run twenty
 * years through the real Run on the month clock, built in order, with the city growing itself; and the same founding
 * by hand beside it. The figures here are the record ADR-0015's Consequences carry, pinned as a check on the premises,
 * not as truth (ADR-0007): a premise that moves moves them.
 * Moved 2026-10-20 (ADR-0016, Phase 2): the board now runs along the shore and the founding's reactor at 5,-4 and
 * west plants at -6,3, -5,1 and -4,-1 fall outside it and the circle, so they stand on the band at 4,-4, -4,0 (water,
 * upstream), -4,3 (sewage) and -3,-1 (waste), reached by the same number of stretches; every figure is unchanged.
 * Re-pinned 2026-10-21 for the waiting list (`docs/work/archive/arrivals-scale-past-100000/plan.md`, Phase 1): 30,000 a year
 * join the list (Mine) and the lead is 30 months of them, 75,000 homes, so every home is taken the year it opens and
 * the run keeps fifteen neighborhoods in hand. The crews are the brake: the needs of the neighborhoods in hand take
 * them first, so the first residents come later and the city is far larger by year 20.
 * Re-pinned 2026-10-22 (ADR-0020, Phase 2 of `docs/work/archive/school-seats-for-a-growing-circle/plan.md`): every circle's
 * schools are built with room for the wave, so the crews build more schools before homes; the high-school break in
 * year 18 is gone, and the city is smaller at year 20 from nothing.
 * Owner context: Run (domain), tests.
 */
import { describe, expect, it } from 'vitest';
import { RATES, addPlantUnit, addRingBuilding, emptyLayout, layStretch, placeNeighborhood, toggleExtra } from '@city/site';
import type { Layout, Outcome, TileKey } from '@city/site';
import { RULES, placeOrder, startRun, tick, totalSpend } from '../src/index.ts';
import type { Game, OrderOutcome, PieceKind, RecordRow } from '../src/index.ts';
import { cpuMs, slower } from './machine.ts';

function must(out: OrderOutcome): Game {
  if (!out.ok) throw new Error(`refused: ${out.rejection.reason}`);
  return out.game;
}
const order = (g: Game, c: (p: Layout) => Outcome): Game => must(placeOrder(g, c, RULES));

const HOODS: readonly TileKey[] = ['0,-1', '1,-1', '-1,0', '1,0', '-1,1', '0,1'];
const STRETCHES: readonly (readonly [TileKey, TileKey])[] = [
  ['-1,0', '0,0'], ['-1,0', '0,-1'], ['1,-1', '1,0'], ['-1,1', '0,1'], ['-1,1', '0,0'], ['0,0', '0,1'],
  ['0,-1', '0,0'], ['0,-1', '1,-1'], ['0,1', '1,0'], ['-1,0', '-1,1'], ['-1,0', '-2,0'], ['-2,0', '-3,0'],
  ['-3,-1', '-4,0'], ['-4,0', '-4,1'], ['-3,0', '-4,1'], ['-4,1', '-4,2'], ['-4,2', '-4,3'], ['-3,0', '-4,0'], ['0,0', '1,0'],
];

/** David's founding, ordered at year 0 in his order: homes, ring, schools and fields, then the line and the plants. */
function founding(infer: boolean): Game {
  let g = order(startRun(emptyLayout(), 7, RATES, RULES, { growth: true, inOrder: true, infer }), (p) => addRingBuilding(p, '0,0', RATES));
  for (const h of HOODS) g = order(g, (p) => placeNeighborhood(p, h, RATES));
  for (const h of ['1,-1', '-1,0', '0,1']) g = order(g, (p) => toggleExtra(p, h, 'elementary', RATES));
  for (const h of ['1,-1', '-1,1']) g = order(g, (p) => toggleExtra(p, h, 'fields', RATES));
  for (const [a, b] of STRETCHES) g = order(g, (p) => layStretch(p, a, b, RATES));
  g = order(g, (p) => addPlantUnit(p, '4,-4', 'power', RATES));
  g = order(g, (p) => addPlantUnit(p, '-4,0', 'water', RATES));
  g = order(g, (p) => addPlantUnit(p, '-4,3', 'sewage', RATES));
  return order(g, (p) => addPlantUnit(p, '-3,-1', 'waste', RATES));
}

function twentyYears(g0: Game): Game {
  let g = g0;
  while (g.clock && g.clock.year < RULES.years) g = tick(g, RATES, RULES);
  return g;
}

const last = (g: Game): RecordRow => {
  const rec = g.clock?.record ?? [];
  const row = rec[rec.length - 1];
  if (!row) throw new Error('no record');
  return row;
};
const hoodsOf = (g: Game): number => Object.values(g.layout.tiles).filter((t) => t.kind === 'hood').length;
const firstPeople = (g: Game): number => g.clock?.record.find((r) => r.pop > 0)?.year ?? -1;
const inferredBag = (g: Game): Partial<Record<PieceKind, number>> => {
  const bag: Partial<Record<PieceKind, number>> = {};
  for (const m of g.clock?.growth?.months ?? []) for (const f of m.inferred ?? []) if (f.type === 'InferredOrder') for (const e of f.events) if (e.type === 'JobOrdered') bag[e.what] = (bag[e.what] ?? 0) + 1;
  return bag;
};

describe("David's founding of 2026-10-15, twenty years on the real path", () => {
  const byHand = twentyYears(founding(false));
  const grown = twentyYears(founding(true));

  it('by hand, as placed: 18,000 people held for seats, three lines broken, 48 line-years, and the list waits (the ADR-0012 record)', () => {
    expect(Math.round(last(byHand).pop)).toBe(18000);
    expect(hoodsOf(byHand)).toBe(6);
    expect(last(byHand).broken).toEqual(['ring', 'power', 'haul']);
    // 46 at 4,800 a year: the share moved in over two years; off the list it moves in the year it opens, year 5.
    expect(byHand.clock?.lineYears).toBe(48);
    expect(byHand.clock?.growth?.waiting).toBeGreaterThan(500000);
    expect(firstPeople(byHand)).toBe(5);
    expect(last(byHand).heldBack?.every((h) => h.seats.includes('middle') && h.seats.includes('high'))).toBe(true);
  });

  it('growing itself: 90,000 people in 18 neighborhoods, every home taken, every line held, no line-years, nobody held back; its schools built with room for the wave (ADR-0020)', () => {
    expect(Math.round(last(grown).pop)).toBe(90000);
    expect(hoodsOf(grown)).toBe(18);
    expect(last(grown).homes).toBe(90000);
    expect(last(grown).broken).toEqual([]);
    expect(last(grown).held).toBe(16);
    expect(grown.clock?.lineYears).toBe(0);
    expect(last(grown).heldBack).toEqual([]);
    const bag = inferredBag(grown);
    expect(bag.power).toBe(4);
    expect(bag.hood).toBe(27);
    expect(bag.middle).toBe(8);
    expect(bag.high).toBe(7);
    expect(bag.ring).toBe(21);
    expect(bag.water).toBe(2);
    // Fifteen neighborhoods are in hand at year 20, the lead's 75,000 homes, and the list is longer than the city.
    expect(grown.clock?.jobs.filter((j) => j.what === 'hood')).toHaveLength(15);
    expect(grown.clock?.growth?.waiting).toBeGreaterThan(last(grown).pop);
  });

  it('the price of building in order: the first residents come in year 11, not 5, while the crews build what the run ordered first', () => {
    // Year 7 at a lead of 12,000 homes: the needs of fifteen neighborhoods in hand now take the crews ahead of the homes;
    // year 10 before the schools were built with room for the wave (ADR-0020).
    expect(firstPeople(grown)).toBe(11);
    expect(Math.round(totalSpend(grown.clock?.record ?? []).capital / 1e9 * 100) / 100).toBe(24.84);
    expect(Math.round(totalSpend(byHand.clock?.record ?? []).capital / 1e9 * 100) / 100).toBe(6.82);
  });
});

describe('one neighborhood on an empty site, and nothing at all, twenty years growing itself', () => {
  const one = placeNeighborhood(emptyLayout(), '0,0', RATES);
  if (!one.ok) throw new Error('refused');
  const fromOne = twentyYears(startRun(one.layout, 42, RATES, RULES, { growth: true, inOrder: true, infer: true }));
  const fromNothing = twentyYears(startRun(emptyLayout(), 42, RATES, RULES, { growth: true, inOrder: true, infer: true }));

  it('from one neighborhood: 100,000 people in 20 neighborhoods, every line held at year 20, 7 line-years (9 before the line held through a closure, ADR-0021; 10 before the schools had room for the wave, ADR-0020; 11 before a plant came with its line, ADR-0019)', () => {
    expect(Math.round(last(fromOne).pop)).toBe(100000);
    expect(hoodsOf(fromOne)).toBe(20);
    expect(last(fromOne).homes).toBe(100000);
    expect(last(fromOne).broken).toEqual([]);
    expect(fromOne.clock?.lineYears).toBe(7);
    expect(firstPeople(fromOne)).toBe(3);
    const bag = inferredBag(fromOne);
    expect(bag.hood).toBe(34);
    // 42 stretches: 41 and the way round the closure of year 16 (ADR-0021).
    expect(bag.line).toBe(42);
    expect(bag.water).toBe(3);
  });

  it('the 7 line-years: the ring in year 1, no haul since each plant comes with its line (ADR-0019), the fields six years while the crews build homes first; no stop lost in the closure year 16, the way round built ahead of it (ADR-0021); no high school in year 18, its schools built with room for the wave (ADR-0020)', () => {
    const broken = (fromOne.clock?.record ?? []).filter((r) => r.year > 0 && r.bad > 0).map((r) => `${r.year}: ${r.broken.join(', ')}`);
    expect(broken).toEqual(['1: ring', '3: fields', '4: fields', '5: fields', '6: fields', '7: fields', '8: fields']);
  });

  it('from nothing: 100,000 people in 20 neighborhoods at year 20, every line held, no line-years, the first in year 10, the second circle not yet opened (90,000 in 18 and 2 line-years before the line held through a closure, ADR-0021; 115,000 in 23 and opened before the schools had room for the wave, ADR-0020)', () => {
    expect(Math.round(last(fromNothing).pop)).toBe(100000);
    expect(hoodsOf(fromNothing)).toBe(20);
    expect(last(fromNothing).broken).toEqual([]);
    expect(fromNothing.clock?.lineYears).toBe(0);
    expect(firstPeople(fromNothing)).toBe(10);
    expect(inferredBag(fromNothing).hood).toBe(35);
    expect(fromNothing.layout.circles).toEqual(['0,0']);
  });

  it('every month the homes as built cover the people, and the run takes under two seconds', () => {
    for (const g of [fromOne, fromNothing]) for (const m of g.clock?.growth?.months ?? []) expect(m.people).toBeLessThanOrEqual(m.homes + 1e-6);
    const t0 = cpuMs();
    twentyYears(startRun(emptyLayout(), 42, RATES, RULES, { growth: true, inOrder: true, infer: true }));
    expect(cpuMs() - t0).toBeLessThan(2000 * slower());
  });
});
