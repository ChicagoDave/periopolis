/**
 * @file The cost of what stands: an empty site costs nothing, a finished neighborhood costs the Ledger's per-tile
 * share, plants and stretches are priced at the groundworks premises, the layers sum to the whole, and a changed
 * premise moves only its rows (ADR-0007 Decision 6).
 * Owner context: Site (domain), tests.
 */
import { describe, expect, it } from 'vitest';
import { COSTS, LAYERS, RATES, assess, costOf, emptyLayout, kindOf, layStretch, placeNeighborhood, starterLayout } from '../src/index.ts';
import type { CostId, CostPremises, CostRow, Layout, SiteCost } from '../src/index.ts';

function priced(layout: Layout, k?: CostPremises): SiteCost {
  return costOf(layout, assess(layout, RATES), RATES, k);
}

function rowIn(rows: readonly CostRow[] | undefined, id: CostId): CostRow {
  const r = rows?.find((x) => x.id === id);
  if (!r) throw new Error(`${id} has no row`);
  return r;
}

function sumOf(rows: readonly CostRow[]): number {
  return rows.reduce((t, r) => t + r.cost, 0);
}

const starter = priced(starterLayout());
const ledger = RATES.base.cost;
const centers = RATES.base.centers;

describe('an empty site costs nothing', () => {
  it('has no rows, zero in every layer, zero a person, no land and nothing to finance', () => {
    const c = priced(emptyLayout());
    expect(c.rows).toEqual([]);
    for (const layer of LAYERS) expect(c.layers[layer]).toBe(0);
    expect(c.capitalTotal).toBe(0);
    expect(c.runningTotal).toBe(0);
    expect(c.capitalPerPerson).toBe(0);
    expect(c.runningPerPerson).toBe(0);
    expect(c.land.cost).toBe(0);
    expect(c.financing.yearly).toBe(0);
    expect(c.pop).toBe(0);
  });
});

describe("a finished tile costs the Ledger's per-tile share", () => {
  it("a neighborhood with a stop: streets, parks, entries, pipe, lanes, floor, dumbwaiters and walkway are the ledger's rows over the centers", () => {
    const hood = starter.tiles['1,0'];
    for (const id of ['streets', 'parks', 'entries', 'pipe', 'lanes', 'lowRiseFloor', 'dumbwaiters', 'walkwayFloor'] as const) {
      const ledgerRow = ledger.rows.find((r) => r.id === id);
      if (!ledgerRow) throw new Error(`the ledger has no ${id}`);
      expect(rowIn(hood, id).cost).toBeCloseTo(ledgerRow.cost / centers, 3);
      expect(rowIn(hood, id).premise).toBe(ledgerRow.premise);
    }
  });
  it("a neighborhood's yearly services are the ledger's per-person civic rows over the centers", () => {
    const hood = starter.tiles['1,0'];
    for (const id of [
      'schools',
      'police',
      'fire',
      'health',
      'library',
      'welfare',
      'higherEducation',
      'administration',
      'corrections',
      'courts',
      'streetRunning',
      'parkRunning',
      'electricity',
      'water',
      'sewer',
      'waste',
      'goodsRuns',
      'porters',
    ] as const) {
      const ledgerRow = ledger.rows.find((r) => r.id === id);
      if (!ledgerRow) throw new Error(`the ledger has no ${id}`);
      expect(rowIn(hood, id).cost).toBeCloseTo(ledgerRow.cost / centers, 3);
    }
  });
  it('a neighborhood off the line has no walkway and no station; one on it has one station', () => {
    let s = placeNeighborhood(emptyLayout(), '0,0', RATES);
    if (!s.ok) throw new Error('refused');
    const alone = priced(s.layout).tiles['0,0'] ?? [];
    expect(alone.map((r) => r.id)).not.toContain('walkwayFloor');
    expect(alone.map((r) => r.id)).not.toContain('stations');
    const onLine = starter.tiles['1,0'] ?? [];
    expect(rowIn(onLine, 'stations').count).toBe(1);
    expect(rowIn(onLine, 'stations').unit).toBe(COSTS.stationEach.value);
  });
  it("a ring prices each building's worth of the middle's floor at the high-rise rate", () => {
    const ring = starter.tiles['0,0'];
    const perBuilding = RATES.base.middleFloorM2 / RATES.base.ringNeed;
    expect(rowIn(ring, 'highRiseFloor').count).toBeCloseTo(8 * perBuilding, 6);
    expect(rowIn(ring, 'highRiseFloor').premise).toBe('highRiseM2');
  });
  it('plants are modules and units at the groundworks premises, with a stop where the line reaches them', () => {
    expect(rowIn(starter.tiles['3,-1'], 'reactorModules')).toMatchObject({ count: 3, unit: COSTS.reactorModuleEach.value, layer: 'groundworks' });
    expect(rowIn(starter.tiles['3,-2'], 'plantUnits')).toMatchObject({ count: 1, unit: COSTS.plantUnitEach.value });
    expect(rowIn(starter.tiles['-3,1'], 'plantUnits').count).toBe(1);
    expect(rowIn(starter.tiles['-3,2'], 'stations').count).toBe(1);
  });
  it('a stretch of line is a step of mover floor at the low-rise rate plus a step of track', () => {
    const stretch = starter.stretches['0,0|1,0'];
    expect(rowIn(stretch, 'moverLineFloor').count).toBeCloseTo(RATES.stepKm * 1000 * COSTS.moverLineWidthM.value, 6);
    expect(rowIn(stretch, 'moverLineFloor').premise).toBe('lowRiseM2');
    expect(rowIn(stretch, 'moverTrack').count).toBeCloseTo(RATES.stepKm, 9);
    expect(Object.keys(starter.stretches)).toHaveLength(14);
  });
  it('schools and fields add no row: a neighborhood with them costs what one without them costs', () => {
    const withSchools = sumOf((starter.tiles['2,-1'] ?? []).filter((r) => kindOf(r.layer) === 'capital'));
    const without = sumOf((starter.tiles['1,-1'] ?? []).filter((r) => kindOf(r.layer) === 'capital'));
    expect(withSchools).toBeCloseTo(without, 3);
  });
});

describe('the whole is the sum of its parts', () => {
  it('every row is its count times its premise, and every premise is one of the Ledger’s', () => {
    for (const r of starter.rows) {
      expect(r.cost).toBeCloseTo(r.count * r.unit, 6);
      expect(r.unit).toBe(COSTS[r.premise].value);
      expect(['yours', 'mine', 'sourced']).toContain(COSTS[r.premise].mark.kind);
    }
  });
  it('the rows are the tiles, the stretches and the city together, and each layer is the sum of its rows', () => {
    const parts = [...Object.values(starter.tiles).flat(), ...Object.values(starter.stretches).flat(), ...starter.city];
    expect(starter.rows).toHaveLength(parts.length);
    for (const layer of LAYERS) expect(starter.layers[layer]).toBeCloseTo(sumOf(starter.rows.filter((r) => r.layer === layer)), 3);
    expect(starter.capitalTotal).toBeCloseTo(starter.layers.groundworks + starter.layers.buildings + starter.layers.fleet, 3);
    expect(starter.runningTotal).toBeCloseTo(starter.layers.upkeep + starter.layers.civic + starter.layers.households, 3);
    expect(starter.capitalPerPerson).toBeCloseTo(starter.capitalTotal / 50000, 6);
  });
  it('the city rows are the fleet, where it waits, upkeep on the structures, and getting around', () => {
    const a = assess(starterLayout(), RATES);
    expect(rowIn(starter.city, 'vehicles').count).toBeCloseTo(a.score.fleet, 9);
    expect(rowIn(starter.city, 'waiting').count).toBeCloseTo(a.score.fleet * RATES.base.storagePerVeh, 6);
    expect(rowIn(starter.city, 'upkeep').count).toBeCloseTo(starter.layers.groundworks + starter.layers.buildings, 3);
    expect(rowIn(starter.city, 'upkeep').premise).toBe('upkeepShare');
    expect(rowIn(starter.city, 'vehicleKm').count).toBeCloseTo(a.score.vehicleTrips * a.score.rideKm * (1 + RATES.walking.emptyRunning) * 365, 3);
    expect(rowIn(starter.city, 'vehiclesRenewed').count).toBeCloseTo(a.score.fleet / COSTS.vehicleLifeYears.value, 9);
  });
  it('the Land line prices the standing tiles’ ground and the Financing line pays the structures off level', () => {
    expect(starter.land.areaM2).toBeCloseTo(15 * RATES.tileAcres * (1e6 / 247.105), 3);
    expect(starter.financing.capital).toBeCloseTo(starter.layers.groundworks + starter.layers.buildings, 3);
    expect(starter.financing.yearly).toBeGreaterThan(starter.financing.capital / COSTS.financeYears.value);
  });
});

describe('the year’s people pay the yearly rows; the homes as built carry the capital', () => {
  it('under a squeeze the civic rows grow with the people and the buildings do not', () => {
    const layout = starterLayout();
    const plain = costOf(layout, assess(layout, RATES), RATES);
    const squeezed = costOf(layout, assess(layout, RATES, { now: { people: RATES.band, children: 0 } }), RATES);
    expect(squeezed.layers.buildings).toBeCloseTo(plain.layers.buildings, 3);
    // Only the ground where the movers wait follows the people, because the fleet does.
    const groundLessWaiting = (c: SiteCost): number => sumOf(c.rows.filter((r) => r.layer === 'groundworks' && r.id !== 'waiting'));
    expect(groundLessWaiting(squeezed)).toBeCloseTo(groundLessWaiting(plain), 3);
    expect(sumOf(squeezed.rows.filter((r) => r.id === 'waiting'))).toBeGreaterThan(sumOf(plain.rows.filter((r) => r.id === 'waiting')));
    const civicOf = (c: SiteCost, id: CostId): number => sumOf(c.rows.filter((r) => r.id === id));
    expect(civicOf(squeezed, 'police')).toBeCloseTo(civicOf(plain, 'police') * (1 + RATES.band), 3);
    expect(squeezed.pop).toBeCloseTo(50000 * (1 + RATES.band), 6);
  });
});

describe('changing a premise moves only the rows that use it', () => {
  it('doubling the track premise doubles every moverTrack row and nothing else', () => {
    const doubled = priced(starterLayout(), { ...COSTS, moverTrackKm: { value: COSTS.moverTrackKm.value * 2, mark: { kind: 'mine' } } });
    expect(doubled.rows).toHaveLength(starter.rows.length);
    starter.rows.forEach((was, i) => {
      const now = doubled.rows[i];
      if (!now) throw new Error('a row went missing');
      expect(now.id).toBe(was.id);
      if (was.id === 'moverTrack') expect(now.cost).toBeCloseTo(was.cost * 2, 3);
      else if (was.id === 'upkeep') expect(now.cost).toBeGreaterThan(was.cost);
      else expect(now.cost).toBeCloseTo(was.cost, 3);
    });
  });
  it('laying a stretch adds exactly that stretch’s rows and a station where a new tile is reached', () => {
    const before = starterLayout();
    const laid = layStretch(before, '1,0', '2,0', RATES);
    if (!laid.ok) throw new Error('refused');
    const after = priced(laid.layout);
    const stretchCost = sumOf(after.stretches['1,0|2,0'] ?? []);
    expect(stretchCost).toBeGreaterThan(0);
    // 2,0 is empty, so no station there; the groundworks grow by the stretch alone, and the waiting ground with the fleet.
    const grew = after.layers.groundworks - starter.layers.groundworks;
    const waitingGrew = rowIn(after.city, 'waiting').cost - rowIn(starter.city, 'waiting').cost;
    expect(grew - waitingGrew).toBeCloseTo(stretchCost, 3);
  });
});

describe('the standing city against the ledger’s column (loose by design)', () => {
  it('the ledger’s city on the board costs more to build than the column, by the plants and the band’s two spare ring buildings, and within half again', () => {
    expect(starter.capitalTotal).toBeGreaterThan(ledger.capitalTotal);
    expect(starter.capitalTotal).toBeLessThan(ledger.capitalTotal * 1.5);
    expect(starter.runningTotal).toBeGreaterThan(ledger.runningTotal * 0.8);
    expect(starter.runningTotal).toBeLessThan(ledger.runningTotal * 1.3);
  });
});
