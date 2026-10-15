/**
 * @file The month clock (ADR-0009), on the real Ledger and Site: a run without growth is the sketch's clock; the
 * ledger's city, full, stays full month by month and its twelve months' running spend is the year's; the sized city
 * founded from nothing fills at the citywide pace, about Irvine's, and the neighborhood filling leaves its daily list
 * short; months advance one at a time to the year's end; a stored month clock reads back.
 * Owner context: Run (domain), tests.
 */
import { describe, expect, it } from 'vitest';
import {
  RATES,
  addPlantUnit,
  addRingBuilding,
  allTiles,
  edgeEnds,
  emptyLayout,
  layStretch,
  placeNeighborhood,
  sizedLayout,
  starterLayout,
  toggleExtra,
} from '@city/site';
import type { ExtraKind, Layout, Outcome, PlantKind } from '@city/site';
import { RULES, growthOn, monthStep, placeOrder, restoreClock, startRun, tick, tickMonth } from '../src/index.ts';
import type { Game, MonthRow } from '../src/index.ts';

const RUNNING = ['upkeep', 'civic', 'households'] as const;
const CAPITAL = ['groundworks', 'buildings', 'fleet'] as const;

/** The sized city ordered on an empty site with growth, every piece through the crews. */
function foundSized(seed: number): Game {
  const target = sizedLayout(RATES);
  let g = startRun(emptyLayout(), seed, RATES, RULES, { growth: true });
  const order = (cmd: (l: Layout) => Outcome): void => {
    const o = placeOrder(g, cmd, RULES);
    if (!o.ok) throw new Error('order refused');
    g = o.game;
  };
  for (const k of allTiles(RATES.outline)) {
    const t = target.tiles[k];
    if (!t) continue;
    if (t.kind === 'hood') {
      order((l) => placeNeighborhood(l, k, RATES));
      for (const x of Object.keys(t.has) as ExtraKind[]) order((l) => toggleExtra(l, k, x, RATES));
    } else if (t.kind === 'ring') for (let i = 0; i < t.n; i++) order((l) => addRingBuilding(l, k, RATES));
    else for (let i = 0; i < t.n; i++) order((l) => addPlantUnit(l, k, t.kind as PlantKind, RATES));
  }
  for (const e of Object.keys(target.lines)) {
    const [a, b] = edgeEnds(e);
    order((l) => layStretch(l, a, b, RATES));
  }
  return g;
}

function yearsOf(g: Game, n: number): Game {
  let out = g;
  for (let i = 0; i < n; i++) out = tick(out, RATES, RULES);
  return out;
}

const monthsIn = (g: Game, year: number): MonthRow[] => (g.clock?.growth?.months ?? []).filter((m) => m.year === year);
const sum = (rows: readonly MonthRow[], f: (m: MonthRow) => number): number => rows.reduce((t, m) => t + f(m), 0);

describe('the month clock', () => {
  it('a run started without growth is the sketch\'s clock: no month clock, and a month is no step at all', () => {
    const g = startRun(starterLayout(), 42, RATES, RULES);
    expect(g.clock?.growth).toBeUndefined();
    expect(tickMonth(g, RATES, RULES)).toBe(g);
    expect(tick(g, RATES, RULES).clock?.growth).toBeUndefined();
  });

  it('starting with growth, what stands is lived in, full', () => {
    const g = startRun(starterLayout(), 42, RATES, RULES, { growth: true });
    expect(g.clock?.growth?.month).toBe(0);
    expect(Object.values(g.clock?.growth?.occupied ?? {})).toEqual(Array(10).fill(5000));
    expect(g.clock?.record[0]?.pop).toBe(50000);
  });

  it('months advance one at a time; the twelfth closes the year and starts the next at month 0', () => {
    let g = startRun(starterLayout(), 42, RATES, RULES, { growth: true });
    for (let i = 1; i <= 11; i++) {
      g = tickMonth(g, RATES, RULES);
      expect(g.clock?.year).toBe(0);
      expect(g.clock?.growth?.month).toBe(i);
    }
    expect(g.clock?.record).toHaveLength(1);
    g = tickMonth(g, RATES, RULES);
    expect(g.clock?.year).toBe(1);
    expect(g.clock?.growth?.month).toBe(0);
    expect(g.clock?.record).toHaveLength(2);
    expect(monthsIn(g, 1).map((m) => m.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("the ledger's city, full, refills what it loses each month and stays at 50,000", () => {
    const g = yearsOf(startRun(starterLayout(), 42, RATES, RULES, { growth: true }), 1);
    const months = monthsIn(g, 1);
    for (const m of months) {
      expect(m.left).toBeCloseTo((50000 * 0.087 * 0.5) / 12, 6);
      expect(m.people).toBeCloseTo(50000, 6);
      expect(m.homes).toBe(50000);
    }
  });

  it('with the homes full, twelve months of running spend are the year\'s, and month 12 carries the year\'s capital', () => {
    const g = yearsOf(startRun(starterLayout(), 42, RATES, RULES, { growth: true }), 2);
    for (const year of [1, 2]) {
      const months = monthsIn(g, year);
      const row = g.clock?.record.find((r) => r.year === year);
      if (!row) throw new Error('no row');
      for (const layer of RUNNING) expect(sum(months, (m) => m.spend[layer])).toBeCloseTo(row.spend[layer], 2);
      for (const layer of CAPITAL) {
        expect(months[11]?.spend[layer]).toBeCloseTo(row.spend[layer], 6);
        expect(sum(months.slice(0, 11), (m) => m.spend[layer])).toBe(0);
      }
    }
  });

  it('a run with growth on a full city records the same lines broken and the same capital as one without', () => {
    const plain = yearsOf(startRun(starterLayout(), 42, RATES, RULES), 3);
    const grown = yearsOf(startRun(starterLayout(), 42, RATES, RULES, { growth: true }), 3);
    expect(grown.clock?.record.map((r) => [r.year, r.broken, r.homes])).toEqual(plain.clock?.record.map((r) => [r.year, r.broken, r.homes]));
    for (const year of [1, 2, 3]) {
      const a = plain.clock?.record[year];
      const b = grown.clock?.record[year];
      for (const layer of CAPITAL) expect(b?.spend[layer]).toBeCloseTo(a?.spend[layer] ?? Number.NaN, 2);
    }
  });

  it('the sized city founded from nothing fills at the citywide pace, about Irvine\'s 4,800 a year, and is full by year 16', () => {
    const g = yearsOf(foundSized(42), 20);
    const arrived = (year: number): number => sum(monthsIn(g, year), (m) => m.arrived);
    const left = (year: number): number => sum(monthsIn(g, year), (m) => m.left);
    expect(arrived(1)).toBe(0);
    for (let year = 3; year <= 15; year++) expect(arrived(year)).toBeCloseTo(4800, 6);
    for (let year = 1; year <= 20; year++) expect(arrived(year)).toBeLessThanOrEqual(4800 + 1e-6);
    // Net of the leavers, the city grows by 2,600 to 4,700 a year while it fills: Irvine added about 4,800.
    for (let year = 4; year <= 15; year++) {
      expect(arrived(year) - left(year)).toBeGreaterThan(2600);
      expect(arrived(year) - left(year)).toBeLessThan(4800);
    }
    const end = (year: number): number => monthsIn(g, year).at(-1)?.people ?? Number.NaN;
    expect(end(15)).toBeLessThan(50000);
    expect(end(16)).toBeCloseTo(50000, 6);
    expect(end(20)).toBeCloseTo(50000, 6);
    expect(sum(monthsIn(g, 20), (m) => m.left)).toBeCloseTo(50000 * 0.087 * 0.5, 2);
  });

  it('while a neighborhood fills, its daily list is a watch, not a break; full, it is fed', () => {
    const g = yearsOf(foundSized(42), 20);
    const row = (year: number) => g.clock?.record.find((r) => r.year === year);
    for (let year = 8; year <= 15; year++) {
      expect(row(year)?.broken).not.toContain('daily');
      expect(row(year)?.warn).toBeGreaterThanOrEqual(1);
    }
    expect(row(20)?.broken).not.toContain('daily');
    expect(row(20)?.bad).toBe(0);
  });

  it('a month past the eleventh is the year\'s end, not a month step', () => {
    const g = growthOn(starterLayout(), RATES);
    expect(() => monthStep(starterLayout(), { ...g, month: 12 }, 1, { people: 0, children: 0 }, RATES)).toThrow(
      'the year is complete at month 12; start the next year first',
    );
  });

  it('a stored month clock reads back; occupancy on tiles with no neighborhood and broken months are dropped', () => {
    let g = startRun(starterLayout(), 42, RATES, RULES, { growth: true });
    for (let i = 0; i < 14; i++) g = tickMonth(g, RATES, RULES);
    const stored = JSON.parse(JSON.stringify(g.clock));
    const back = restoreClock(stored, g.layout, RATES, RULES);
    expect(back?.growth).toEqual(g.clock?.growth);
    const tampered = { ...stored, growth: { ...stored.growth, occupied: { ...stored.growth.occupied, '0,0': 900, '9,9': 5 }, months: [...stored.growth.months, { year: 1, month: 13 }] } };
    const fixed = restoreClock(tampered, g.layout, RATES, RULES);
    expect(fixed?.growth?.occupied['0,0']).toBeUndefined();
    expect(fixed?.growth?.occupied['9,9']).toBeUndefined();
    expect(fixed?.growth?.months).toHaveLength(14);
    const plain = restoreClock({ ...stored, growth: undefined }, g.layout, RATES, RULES);
    expect(plain?.growth).toBeUndefined();
  });
});
