/**
 * @file What the board is checked for while a clock runs (ADR-0012 Decisions 4 and 5) and stops under construction
 * (Decision 6): between steps the board shows the people its record was checked for and what holds the rest back; a
 * neighborhood's stop is under construction when the work in hand gives it one and the board as it stands does not.
 * Owner context: Run (domain), tests.
 */
import { describe, expect, it } from 'vitest';
import { PLANTS, RATES, SCHOOLS, addPlantUnit, addRingBuilding, emptyLayout, layStretch, placeNeighborhood } from '@city/site';
import type { Layout, Outcome } from '@city/site';
import { RULES, limitsOf, livingOf, placeOrder, startRun, stopsBuilding, tick, tickMonth } from '../src/index.ts';
import type { Clock, Game } from '../src/index.ts';

function build(layout: Layout, ...commands: ((l: Layout) => Outcome)[]): Layout {
  return commands.reduce((l, c) => {
    const o = c(l);
    if (!o.ok) throw new Error(o.rejection.reason);
    return o.layout;
  }, layout);
}

const order = (game: Game, command: (plan: Layout) => Outcome): Game => {
  const out = placeOrder(game, command, RULES);
  if (!out.ok) throw new Error(out.rejection.reason);
  return out.game;
};

const clockOf = (g: Game): Clock => {
  if (!g.clock) throw new Error('no clock');
  return g.clock;
};

/** One neighborhood and nothing to serve it. */
const ALONE = build(emptyLayout(), (l) => placeNeighborhood(l, '0,0', RATES));
/** One neighborhood with two reactor modules and a unit of each plant, and no school. */
const SERVED = build(
  ALONE,
  (l) => addPlantUnit(l, '4,0', 'power', RATES),
  (l) => addPlantUnit(l, '4,0', 'power', RATES),
  (l) => addPlantUnit(l, '-4,0', 'water', RATES),
  (l) => addPlantUnit(l, '-4,3', 'sewage', RATES),
  (l) => addPlantUnit(l, '-4,2', 'waste', RATES),
);
/** A ring with a neighborhood beside it, and no line. */
const NO_LINE = build(emptyLayout(), (l) => addRingBuilding(l, '0,0', RATES), (l) => placeNeighborhood(l, '1,0', RATES));

describe('who the board is checked for', () => {
  it("on the sketch's yearly clock everyone lives there: no occupancy, nobody childless, nothing held back", () => {
    const g = startRun(ALONE, 7, RATES, RULES);
    expect(livingOf(g.layout, clockOf(g), RATES)).toEqual({ childless: [], held: [] });
  });

  it('built in order, a neighborhood nothing serves holds nobody, and the year says it waits for every service', () => {
    const g = startRun(ALONE, 7, RATES, RULES, { inOrder: true });
    const living = livingOf(g.layout, clockOf(g), RATES);
    expect(living.occupied).toEqual({ '0,0': 0 });
    expect(living.childless).toEqual([]);
    expect(living.held).toBe(clockOf(g).record[0]?.heldBack);
    expect(living.held).toEqual([{ hood: '0,0', short: PLANTS, seats: SCHOOLS }]);
  });

  it('built in order, a served neighborhood with no school holds the childless share, as its record row was checked', () => {
    const g = startRun(SERVED, 7, RATES, RULES, { inOrder: true });
    const clock = clockOf(g);
    const living = livingOf(g.layout, clock, RATES);
    expect(living.occupied).toEqual(limitsOf(g.layout, clock.lived ?? {}, RATES));
    expect(living.occupied).toEqual({ '0,0': RATES.hood * 0.6 });
    expect(living.childless).toEqual(['0,0']);
    expect(living.held).toEqual([{ hood: '0,0', short: [], seats: SCHOOLS }]);
    expect(clock.record[0]?.pop).toBeCloseTo(RATES.hood * 0.6, 6);
  });

  it("with growth, the month clock's people; what is held back comes from the latest step, a month or the year", () => {
    const g0 = startRun(SERVED, 7, RATES, RULES, { growth: true, inOrder: true });
    const at0 = livingOf(g0.layout, clockOf(g0), RATES);
    expect(at0.occupied).toEqual(clockOf(g0).growth?.occupied);
    expect(at0.held).toBe(clockOf(g0).record[0]?.heldBack);
    const g1 = tickMonth(g0, RATES, RULES);
    const months = clockOf(g1).growth?.months ?? [];
    const at1 = livingOf(g1.layout, clockOf(g1), RATES);
    expect(months).toHaveLength(1);
    expect(at1.held).toBe(months[0]?.heldBack);
    expect(at1.childless).toEqual(['0,0']);
    const y1 = tick(g1, RATES, RULES);
    const record = clockOf(y1).record;
    // The year's end: month 12 and the year carry the same year, and the year's row is the latest step.
    const at12 = livingOf(y1.layout, clockOf(y1), RATES);
    expect(clockOf(y1).growth?.months.at(-1)?.year).toBe(record[record.length - 1]?.year);
    expect(at12.held).toBe(record[record.length - 1]?.heldBack);
    expect(at12.held).toEqual([{ hood: '0,0', short: [], seats: SCHOOLS }]);
    expect(at12.childless).toEqual(['0,0']);
  });

  it('with growth but not in order, the month clock\'s people and nothing held back', () => {
    const g = tickMonth(startRun(ALONE, 7, RATES, RULES, { growth: true }), RATES, RULES);
    const living = livingOf(g.layout, clockOf(g), RATES);
    expect(living.occupied).toEqual(clockOf(g).growth?.occupied);
    expect(living).toMatchObject({ childless: [], held: [] });
  });
});

describe('stops under construction', () => {
  const run = startRun(NO_LINE, 7, RATES, RULES, { inOrder: true });

  it('with nothing in hand, none', () => {
    expect(stopsBuilding(run.layout, [], RATES)).toEqual([]);
  });

  it('a stretch ordered through a neighborhood without a stop puts its stop under construction', () => {
    const g = order(run, (p) => layStretch(p, '0,0', '1,0', RATES));
    expect(stopsBuilding(g.layout, clockOf(g).jobs, RATES)).toEqual(['1,0']);
  });

  it('a stretch ordered elsewhere does not, nor a neighborhood still on order', () => {
    const g = order(order(run, (p) => layStretch(p, '0,0', '-1,0', RATES)), (p) => placeNeighborhood(p, '-1,0', RATES));
    expect(stopsBuilding(g.layout, clockOf(g).jobs, RATES)).toEqual([]);
  });

  it('stretches ordered to join a line that misses the ring put the stop on it under construction', () => {
    const missing = build(NO_LINE, (l) => placeNeighborhood(l, '2,0', RATES), (l) => layStretch(l, '2,0', '3,0', RATES));
    const g = order(order(startRun(missing, 7, RATES, RULES, { inOrder: true }), (p) => layStretch(p, '0,0', '1,0', RATES)), (p) => layStretch(p, '1,0', '2,0', RATES));
    expect(stopsBuilding(missing, [], RATES)).toEqual([]);
    expect(stopsBuilding(g.layout, clockOf(g).jobs, RATES)).toEqual(['1,0', '2,0']);
  });

  it('a ring ordered where a line ends puts the stop on that line under construction', () => {
    const missing = build(NO_LINE, (l) => placeNeighborhood(l, '2,0', RATES), (l) => layStretch(l, '2,0', '3,0', RATES));
    const g = order(startRun(missing, 7, RATES, RULES, { inOrder: true }), (p) => addRingBuilding(p, '3,0', RATES));
    expect(clockOf(g).jobs.map((j) => j.what)).toEqual(['ring']);
    expect(stopsBuilding(g.layout, clockOf(g).jobs, RATES)).toEqual(['2,0']);
  });

  it('work in hand that lays no line and builds no ring puts no stop under construction', () => {
    const g = order(run, (p) => addPlantUnit(p, '-4,0', 'water', RATES));
    expect(stopsBuilding(g.layout, clockOf(g).jobs, RATES)).toEqual([]);
  });

  it('once the stretch opens the neighborhood has its stop, and nothing is under construction', () => {
    const g = tick(order(run, (p) => layStretch(p, '0,0', '1,0', RATES)), RATES, RULES);
    expect(Object.keys(g.layout.lines)).toHaveLength(1);
    expect(stopsBuilding(g.layout, clockOf(g).jobs, RATES)).toEqual([]);
  });
});
