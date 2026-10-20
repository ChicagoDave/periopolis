/**
 * @file The founding run on the real path (ADR-0015, Phase 5 of `docs/work/archive/sim-infers-growth/plan.md`): David's
 * founding of 2026-10-15 (`docs/work/tests/city-261015.txt`) and one neighborhood on an empty site, each run twenty
 * years through the real Run on the month clock, built in order, with the city growing itself; and the same founding
 * by hand beside it. The figures here are the record ADR-0015's Consequences carry, pinned as a check on the premises,
 * not as truth (ADR-0007): a premise that moves moves them.
 * Moved 2026-10-20 (ADR-0016, Phase 2): the board now runs along the shore and the founding's reactor at 5,-4 and
 * west plants at -6,3, -5,1 and -4,-1 fall outside it and the circle, so they stand on the band at 4,-4, -4,0 (water,
 * upstream), -4,3 (sewage) and -3,-1 (waste), reached by the same number of stretches; every figure is unchanged.
 * Owner context: Run (domain), tests.
 */
import { describe, expect, it } from 'vitest';
import { RATES, addPlantUnit, addRingBuilding, emptyLayout, layStretch, placeNeighborhood, toggleExtra } from '@city/site';
import type { Layout, Outcome, TileKey } from '@city/site';
import { RULES, placeOrder, startRun, tick, totalSpend } from '../src/index.ts';
import type { Game, OrderOutcome, PieceKind, RecordRow } from '../src/index.ts';

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

  it('by hand, as placed: 18,000 people held for seats, three lines broken, 46 line-years (the ADR-0012 record)', () => {
    expect(Math.round(last(byHand).pop)).toBe(18000);
    expect(hoodsOf(byHand)).toBe(6);
    expect(last(byHand).broken).toEqual(['ring', 'power', 'haul']);
    expect(byHand.clock?.lineYears).toBe(46);
    expect(firstPeople(byHand)).toBe(5);
    expect(last(byHand).heldBack?.every((h) => h.seats.includes('middle') && h.seats.includes('high'))).toBe(true);
  });

  it('growing itself: 48,379 people in 12 neighborhoods, every line held, no line-years, nobody held back', () => {
    expect(Math.round(last(grown).pop)).toBe(48379);
    expect(hoodsOf(grown)).toBe(12);
    expect(last(grown).homes).toBe(60000);
    expect(last(grown).broken).toEqual([]);
    expect(last(grown).held).toBe(14); // 13 before the plants moved to the shore (ADR-0016 Phase 3)
    expect(grown.clock?.lineYears).toBe(0);
    expect(last(grown).heldBack).toEqual([]);
    const bag = inferredBag(grown);
    expect(bag.power).toBe(2);
    expect(bag.hood).toBe(7);
    expect(bag.middle).toBe(3);
    expect(bag.high).toBe(2);
    expect(bag.ring).toBe(7);
    expect(bag.water ?? 0).toBe(0);
  });

  it('the price of building in order: the first residents come in year 7, not 5, while the crews build what the run ordered first', () => {
    expect(firstPeople(grown)).toBe(7);
    expect(Math.round(totalSpend(grown.clock?.record ?? []).capital / 1e9 * 100) / 100).toBe(15.3); // 15.31 on the 115-tile board (ADR-0015); the shore board moves the run's own placements by 10 million
    expect(Math.round(totalSpend(byHand.clock?.record ?? []).capital / 1e9 * 100) / 100).toBe(6.82);
  });
});

describe('one neighborhood on an empty site, and nothing at all, twenty years growing itself', () => {
  const one = placeNeighborhood(emptyLayout(), '0,0', RATES);
  if (!one.ok) throw new Error('refused');
  const fromOne = twentyYears(startRun(one.layout, 42, RATES, RULES, { growth: true, inOrder: true, infer: true }));
  const fromNothing = twentyYears(startRun(emptyLayout(), 42, RATES, RULES, { growth: true, inOrder: true, infer: true }));

  it('from one neighborhood: 56,349 people in 14 neighborhoods, every line held at year 20, 5 line-years', () => {
    expect(Math.round(last(fromOne).pop)).toBe(56349);
    expect(hoodsOf(fromOne)).toBe(14);
    expect(last(fromOne).homes).toBe(70000);
    expect(last(fromOne).broken).toEqual([]);
    expect(fromOne.clock?.lineYears).toBe(5);
    expect(firstPeople(fromOne)).toBe(3);
    const bag = inferredBag(fromOne);
    expect(bag.hood).toBe(13);
    expect(bag.line).toBe(22); // 18 before the plants moved to the shore: four stretches more reach the band
    expect(bag.water).toBe(2);
  });

  it('the 5 line-years: the ring the lone neighborhood lacks in its first year, the haul and the fields a year before their stretch, and a stop in year 16', () => {
    const broken = (fromOne.clock?.record ?? []).filter((r) => r.year > 0 && r.bad > 0).map((r) => `${r.year}: ${r.broken.join(', ')}`);
    expect(broken).toEqual(['1: ring', '2: haul', '3: fields', '16: stops, ways']); // '7: haul' before the plants moved to the shore
  });

  it('from nothing: 53,698 people in 13 neighborhoods, every line held at year 20, 2 line-years, the first in year 5', () => {
    expect(Math.round(last(fromNothing).pop)).toBe(53698);
    expect(hoodsOf(fromNothing)).toBe(13);
    expect(last(fromNothing).broken).toEqual([]);
    expect(fromNothing.clock?.lineYears).toBe(2); // 3 before the ring took the middle and the first neighborhood stood beside it (ADR-0016 Phase 4)
    expect(firstPeople(fromNothing)).toBe(5);
    expect(inferredBag(fromNothing).hood).toBe(14);
  });

  it('every month the homes as built cover the people, and the run takes well under a second', () => {
    for (const g of [fromOne, fromNothing]) for (const m of g.clock?.growth?.months ?? []) expect(m.people).toBeLessThanOrEqual(m.homes + 1e-6);
    const t0 = Date.now();
    twentyYears(startRun(emptyLayout(), 42, RATES, RULES, { growth: true, inOrder: true, infer: true }));
    expect(Date.now() - t0).toBeLessThan(1000);
  });
});
