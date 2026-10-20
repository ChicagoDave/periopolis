/**
 * @file What a run spends: year 0 spends nothing; the spend summed over twenty years is the cost of what stands plus
 * the running years; summed over layers it equals summed over years; groundworks are paid first, buildings as crews
 * finish them, the fleet as people arrive; a take-down comes off; a stored clock reads its money back.
 * Owner context: Run (domain), tests.
 */
import { describe, expect, it } from 'vitest';
import { LAYERS, RATES, addPlantUnit, addRingBuilding, costOf, assess, emptyLayout, kindOf, layStretch, placeNeighborhood, starterLayout } from '@city/site';
import type { Layout, Outcome } from '@city/site';
import { RULES, noMoney, placeOrder, restoreClock, startRun, tick, totalSpend } from '../src/index.ts';
import type { Game, OrderOutcome } from '../src/index.ts';

function must(out: OrderOutcome): Game {
  if (!out.ok) throw new Error(`refused: ${out.rejection.reason}`);
  return out.game;
}

const order = (game: Game, command: (plan: Layout) => Outcome): Game => must(placeOrder(game, command, RULES));

function runOut(game: Game): Game {
  while (game.clock && game.clock.year < RULES.years) game = tick(game, RATES, RULES);
  return game;
}

/** A small founding from nothing: a ring, two neighborhoods on a line to it, a reactor, ordered at year 0. */
function founding(seed: number): Game {
  let g = startRun(emptyLayout(), seed, RATES, RULES);
  g = order(g, (plan) => addRingBuilding(plan, '0,0', RATES));
  g = order(g, (plan) => placeNeighborhood(plan, '1,0', RATES));
  g = order(g, (plan) => placeNeighborhood(plan, '0,1', RATES));
  g = order(g, (plan) => layStretch(plan, '0,0', '1,0', RATES));
  g = order(g, (plan) => layStretch(plan, '0,0', '0,1', RATES));
  g = order(g, (plan) => addPlantUnit(plan, '4,0', 'power', RATES));
  return g;
}

describe('year 0', () => {
  it('records what stands and spends nothing, whatever stands', () => {
    const g = startRun(starterLayout(), 1, RATES, RULES);
    const row = g.clock?.record[0];
    if (!row) throw new Error('no row');
    expect(row.spend).toEqual(noMoney());
    expect(row.standing.buildings).toBeGreaterThan(0);
    expect(row.standing).toEqual(costOf(g.layout, assess(g.layout, RATES), RATES).layers);
  });
  it('an empty site stands at nothing', () => {
    const g = startRun(emptyLayout(), 1, RATES, RULES);
    expect(g.clock?.record[0]?.standing).toEqual(noMoney());
  });
});

describe('spend over twenty years', () => {
  it('summed over the years, the capital spend is the cost of what stands and the running spend is the running years', () => {
    const g = runOut(founding(3));
    const record = g.clock?.record ?? [];
    const last = record[record.length - 1];
    if (!last) throw new Error('no record');
    const sums = totalSpend(record);
    for (const layer of LAYERS) {
      if (kindOf(layer) === 'capital') expect(sums.byLayer[layer]).toBeCloseTo(last.standing[layer], 3);
      else expect(sums.byLayer[layer]).toBeCloseTo(record.filter((r) => r.year > 0).reduce((t, r) => t + r.standing[layer], 0), 3);
    }
    expect(sums.capital).toBeCloseTo(last.standing.groundworks + last.standing.buildings + last.standing.fleet, 3);
  });
  it('summed over layers equals summed over years, and year 0 is a zero', () => {
    const g = runOut(founding(5));
    const sums = totalSpend(g.clock?.record ?? []);
    const overLayers = LAYERS.reduce((t, layer) => t + sums.byLayer[layer], 0);
    const overYears = sums.byYear.reduce((t, y) => t + y, 0);
    expect(overLayers).toBeCloseTo(overYears, 3);
    expect(sums.total).toBeCloseTo(overLayers, 3);
    expect(sums.byYear[0]).toBe(0);
    expect(sums.byYear).toHaveLength(RULES.years + 1);
  });
  it('a year’s spend is this year’s standing less last year’s in the built layers, and this year’s bill in the yearly ones', () => {
    const g = runOut(founding(8));
    const record = g.clock?.record ?? [];
    for (let i = 1; i < record.length; i++) {
      const now = record[i];
      const was = record[i - 1];
      if (!now || !was) throw new Error('short record');
      for (const layer of LAYERS) {
        const want = kindOf(layer) === 'capital' ? now.standing[layer] - was.standing[layer] : now.standing[layer];
        expect(now.spend[layer]).toBeCloseTo(want, 6);
      }
    }
  });
});

describe('the order of paying', () => {
  it('groundworks first: a stretch finishes in a year and is paid before the neighborhood’s floor', () => {
    let g = startRun(emptyLayout(), 2, RATES, RULES);
    g = order(g, (plan) => layStretch(plan, '0,0', '1,0', RATES));
    g = order(g, (plan) => placeNeighborhood(plan, '1,0', RATES));
    g = tick(g, RATES, RULES);
    const y1 = g.clock?.record[1];
    expect(y1?.opened).toEqual({ line: 1 });
    expect(y1?.spend.groundworks).toBeGreaterThan(0);
    expect(y1?.spend.buildings).toBe(0);
    g = tick(g, RATES, RULES);
    const y2 = g.clock?.record[2];
    expect(y2?.opened).toEqual({ hood: 1 });
    expect(y2?.spend.buildings).toBeGreaterThan(0);
  });
  it('the fleet as people arrive: no movers are bought until someone rides', () => {
    const g = runOut(founding(4));
    const record = g.clock?.record ?? [];
    const firstRiders = record.find((r) => r.pop > 0 && r.standing.fleet > 0);
    if (!firstRiders) throw new Error('nobody ever rode');
    for (const r of record) if (r.year < firstRiders.year) expect(r.spend.fleet).toBe(0);
    expect(firstRiders.spend.fleet).toBeGreaterThan(0);
    const ran = record.filter((r) => r.pop > 0 && r.year > 0);
    expect(ran.length).toBeGreaterThan(0);
    for (const r of ran) expect(r.spend.civic).toBeGreaterThan(0);
  });
  it('a stretch taken down comes off that year’s groundworks', () => {
    let g = startRun(starterLayout(), 6, RATES, RULES);
    const before = costOf(g.layout, assess(g.layout, RATES), RATES);
    const stretch = before.stretches['0,0|1,0']?.reduce((t, r) => t + r.cost, 0) ?? 0;
    expect(stretch).toBeGreaterThan(0);
    g = order(g, (plan) => layStretch(plan, '0,0', '1,0', RATES));
    expect(g.layout.lines['0,0|1,0']).toBeUndefined();
    g = tick(g, RATES, RULES);
    const y1 = g.clock?.record[1];
    if (!y1) throw new Error('no row');
    // The stretch is gone, and with it the stop under 1,0 and some of the riding; the waiting ground follows the fleet.
    expect(y1.spend.groundworks).toBeLessThan(0);
    expect(y1.spend.groundworks).toBeLessThan(-stretch * 0.5);
  });
});

describe('a stored clock', () => {
  it('reads its standing and spend back, and a row written before money restores zeros', () => {
    const g = runOut(founding(7));
    const clock = g.clock;
    if (!clock) throw new Error('no clock');
    const stored = JSON.parse(JSON.stringify(clock)) as { record: Record<string, unknown>[] };
    const last = stored.record[stored.record.length - 1];
    if (!last) throw new Error('no row');
    delete last['standing'];
    delete last['spend'];
    const back = restoreClock(stored, g.layout, RATES, RULES);
    if (!back) throw new Error('not a clock');
    expect(back.record[1]?.standing).toEqual(clock.record[1]?.standing);
    expect(back.record[1]?.spend).toEqual(clock.record[1]?.spend);
    expect(back.record[back.record.length - 1]?.standing).toEqual(noMoney());
    expect(back.record[back.record.length - 1]?.spend).toEqual(noMoney());
  });
});
