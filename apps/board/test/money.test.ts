/**
 * @file Money as the page words and lays it out: dollars formatted, marks worded, every row and premise named, the
 * Site's rows gathered by id in layer order with their marks, and the run's spend so far.
 * Owner context: Board (adapter), tests.
 */
import { describe, expect, it } from 'vitest';
import { COSTS, LAYERS, RATES, assess, costOf, emptyLayout, starterLayout } from '@city/site';
import type { CostId, CostPremiseId } from '@city/site';
import { RULES, startRun, tick } from '@city/run';
import { money } from '../src/format.ts';
import { linesOf, spentSoFar } from '../src/money.ts';
import { COST_ROW_NAME, LAYER_NAME, PREMISE_UNIT, lineAt, markLabel, markText } from '../src/wording.ts';

describe('dollars, formatted', () => {
  it('reads in whole dollars, millions and billions, with a minus for what comes off', () => {
    expect(money(0)).toBe('$0');
    expect(money(1750)).toBe('$1,750');
    expect(money(48000)).toBe('$48,000');
    expect(money(4.5e6)).toBe('$4.5 M');
    expect(money(592e6)).toBe('$592 M');
    expect(money(13996e6)).toBe('$14.0 B');
    expect(money(-70e6)).toBe('−$70 M');
    expect(money(-0.2)).toBe('$0');
    expect(money(Number.NaN)).toBe('–');
  });
});

describe('marks, worded', () => {
  it('a chip names whose figure it is and a sourced one its year; the text carries the source', () => {
    expect(markLabel({ kind: 'yours' })).toBe('Yours');
    expect(markLabel({ kind: 'mine' })).toBe('Mine');
    expect(markLabel(COSTS.pupilYear.mark)).toBe('Sourced 2023');
    expect(markText(COSTS.pupilYear.mark)).toContain('Census Bureau');
    expect(markText({ kind: 'mine' })).toContain('placeholder');
    expect(markLabel(COSTS.pipeKm.mark)).toBe('Sourced 2023, accepted');
    expect(markText(COSTS.pipeKm.mark)).toContain('Envac');
    expect(markText(COSTS.pipeKm.mark)).toContain('Accepted.');
    expect(markText(COSTS.pupilYear.mark)).toContain('A placeholder until accepted.');
    expect(markLabel(COSTS.lowRiseM2.mark)).toBe('Sourced 2024, accepted');
  });
  it('a line says how many at what; a share premise reads as a percentage of dollars, not a price', () => {
    expect(lineAt({ count: 748375, premise: 'streetM2', unit: 300 })).toBe('748,375 at $300 a m²');
    expect(lineAt({ count: 3, premise: 'reactorModuleEach', unit: 1e9 })).toBe('3 at $1.0 B a module');
    expect(lineAt({ count: 9.2345, premise: 'moverTrackKm', unit: 25e6 })).toBe('9.2 at $25 M a km');
    expect(lineAt({ count: 13.96e9, premise: 'upkeepShare', unit: 0.02 })).toBe('$14.0 B at 2% of the structures a year');
  });
  it('every premise has a unit and every layer a name', () => {
    for (const id of Object.keys(COSTS) as CostPremiseId[]) expect(PREMISE_UNIT[id]).toBeTruthy();
    for (const layer of LAYERS) expect(LAYER_NAME[layer]).toBeTruthy();
  });
});

describe('the rows gathered', () => {
  const layout = starterLayout();
  const cost = costOf(layout, assess(layout, RATES), RATES);
  const lines = linesOf(cost);
  it('one line per row id, in layer order, each summing the rows of that id across the tiles and stretches', () => {
    const ids = lines.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    const layerIndex = lines.map((l) => LAYERS.indexOf(l.layer));
    expect([...layerIndex].sort((a, b) => a - b)).toEqual(layerIndex);
    for (const line of lines) {
      const rows = cost.rows.filter((r) => r.id === line.id);
      expect(line.cost).toBeCloseTo(rows.reduce((t, r) => t + r.cost, 0), 3);
      expect(line.count).toBeCloseTo(rows.reduce((t, r) => t + r.count, 0), 6);
      expect(line.mark).toEqual(COSTS[line.premise].mark);
      expect(COST_ROW_NAME[line.id]).toBeTruthy();
    }
    expect(lines.reduce((t, l) => t + l.cost, 0)).toBeCloseTo(cost.capitalTotal + cost.runningTotal, 3);
  });
  it('the ten neighborhoods’ streets make one line; the stops of eleven tiles on the line make another', () => {
    const streets = lines.find((l) => l.id === 'streets');
    expect(streets?.count).toBeCloseTo(10 * RATES.hood * RATES.base.streets, 6);
    const stations = lines.find((l) => l.id === 'stations');
    expect(stations?.count).toBe(15);
  });
  it('an empty site has no lines', () => {
    expect(linesOf(costOf(emptyLayout(), assess(emptyLayout(), RATES), RATES))).toEqual([]);
  });
  it('the row names cover every id the Site prices', () => {
    const named = Object.keys(COST_ROW_NAME) as CostId[];
    for (const line of lines) expect(named).toContain(line.id);
  });
});

describe('spent so far', () => {
  it('is null with no clock, zero at year 0, and the record summed after a year', () => {
    expect(spentSoFar(null)).toBeNull();
    let g = startRun(starterLayout(), 3, RATES, RULES);
    expect(spentSoFar(g.clock)?.total).toBe(0);
    g = tick(g, RATES, RULES);
    const spent = spentSoFar(g.clock);
    const row = g.clock?.record[1];
    if (!spent || !row) throw new Error('no year');
    expect(spent.total).toBeCloseTo(LAYERS.reduce((t, l) => t + row.spend[l], 0), 3);
    expect(spent.running).toBeGreaterThan(0);
  });
});
