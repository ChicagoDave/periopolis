/**
 * @file Cost: every row is one premise times one ledger count in one of six layers, every premise carries a mark,
 * both columns are priced by the same arithmetic, money adds rows without moving a figure the nine steps already
 * gave, and the car column is vouched, loosely, against what America pays (ADR-0007).
 * Owner context: Ledger (domain), tests.
 */
import { describe, expect, it } from 'vitest';
import {
  CAR_CITY,
  COSTS,
  LAYERS,
  NEEDS,
  SHARED,
  WALKING_CITY,
  deriveCarCity,
  deriveWalkingCity,
  kindOf,
} from '../src/index.ts';
import type { CostFigures, CostId, CostPremiseId, CostPremises, CostRow } from '../src/index.ts';

const car = deriveCarCity(SHARED, CAR_CITY);
const yours = deriveWalkingCity(SHARED, WALKING_CITY, NEEDS);

function row(c: CostFigures, id: CostId): CostRow {
  const r = c.rows.find((x) => x.id === id);
  if (!r) throw new Error(`${id} has no row`);
  return r;
}

function ids(c: CostFigures): CostId[] {
  return c.rows.map((r) => r.id);
}

function sumOf(rows: readonly CostRow[]): number {
  return rows.reduce((t, r) => t + r.cost, 0);
}

describe('every row is a premise times a count', () => {
  it('each row costs count times unit, and the unit is the premise it names, in both columns', () => {
    for (const c of [car.cost, yours.cost]) {
      for (const r of c.rows) {
        expect(r.cost).toBeCloseTo(r.count * r.unit, 6);
        expect(r.unit).toBe(COSTS[r.premise].value);
      }
    }
  });
  it('the counts are the ledger’s own figures', () => {
    expect(row(car.cost, 'vehicles').count).toBe(car.fleet);
    expect(row(car.cost, 'streets').count).toBeCloseTo(SHARED.pop * car.streets, 9);
    expect(row(car.cost, 'waiting').count).toBeCloseTo(SHARED.pop * car.parkingGround, 9);
    expect(row(yours.cost, 'vehicles').count).toBe(yours.fleet);
    expect(row(yours.cost, 'highRiseFloor').count).toBe(yours.middleFloorM2);
    expect(row(yours.cost, 'walkwayFloor').count).toBeCloseTo(yours.walkwayKm * 1000 * COSTS.walkwayWidthM.value, 6);
    expect(row(yours.cost, 'moverLineFloor').count).toBeCloseTo(yours.moverKm * 1000 * COSTS.moverLineWidthM.value, 6);
    expect(row(yours.cost, 'moverTrack').count).toBe(yours.moverKm);
    expect(row(yours.cost, 'entries').count).toBe(yours.entries);
    expect(row(yours.cost, 'pipe').count).toBe(yours.pipeKm);
    expect(row(yours.cost, 'dumbwaiters').count).toBe(yours.dumbwaiters);
    expect(row(yours.cost, 'porters').count).toBe(yours.porters);
    expect(row(yours.cost, 'goodsRuns').count).toBeCloseTo(yours.goodsRuns * 365, 6);
  });
  it('the civic counts come from the people: pupils are the grades’ share, water and sewage are gallons a day', () => {
    const pupils = SHARED.pop * SHARED.gradeShare * COSTS.grades.value;
    expect(row(car.cost, 'schools').count).toBeCloseTo(pupils, 6);
    expect(row(yours.cost, 'schools').count).toBeCloseTo(pupils, 6);
    expect(pupils).toBeCloseTo(7800, 6);
    expect(row(car.cost, 'police').count).toBe(SHARED.pop);
    expect(row(car.cost, 'water').count).toBeCloseTo((SHARED.pop * COSTS.waterGpdCar.value * 365) / 1000, 6);
    expect(row(yours.cost, 'water').count).toBeCloseTo((SHARED.pop * COSTS.waterGpdWalking.value * 365) / 1000, 6);
    expect(row(yours.cost, 'sewer').count).toBeCloseTo((SHARED.pop * COSTS.sewageGpd.value * 365) / 1000, 6);
    expect(row(car.cost, 'electricity').count).toBeCloseTo(SHARED.pop * COSTS.kwhPerPersonYear.value, 6);
    expect(row(yours.cost, 'electricity').count).toBeCloseTo((SHARED.pop * COSTS.kwhPerPersonYear.value) / 1000, 6);
    expect(row(car.cost, 'electricity').premise).toBe('gridKwh');
    expect(row(yours.cost, 'electricity').premise).toBe('reactorMwh');
  });
  it('the floor is priced once: low rise plus the ring equals every square meter of home and other floor', () => {
    const floor = SHARED.pop * (SHARED.homeFloor + SHARED.otherFloor);
    expect(row(yours.cost, 'lowRiseFloor').count + row(yours.cost, 'highRiseFloor').count).toBeCloseTo(floor, 6);
    expect(row(car.cost, 'lowRiseFloor').count).toBeCloseTo(floor, 6);
  });
  it('the sub level is built floor, not tunnel: walkway and mover line floors are priced at the low-rise rate', () => {
    expect(row(yours.cost, 'walkwayFloor').premise).toBe('lowRiseM2');
    expect(row(yours.cost, 'moverLineFloor').premise).toBe('lowRiseM2');
  });
});

describe('six layers, two kinds, two lines', () => {
  it('every row is in one of the six layers and each layer total is the sum of its rows', () => {
    for (const c of [car.cost, yours.cost]) {
      for (const r of c.rows) expect(LAYERS).toContain(r.layer);
      for (const layer of LAYERS) expect(c.layers[layer]).toBeCloseTo(sumOf(c.rows.filter((r) => r.layer === layer)), 6);
    }
  });
  it('capital is the three built layers and running the three yearly ones; per person divides by the people', () => {
    for (const c of [car.cost, yours.cost]) {
      const capital = LAYERS.filter((l) => kindOf(l) === 'capital').reduce((t, l) => t + c.layers[l], 0);
      const running = LAYERS.filter((l) => kindOf(l) === 'running').reduce((t, l) => t + c.layers[l], 0);
      expect(c.capitalTotal).toBeCloseTo(capital, 6);
      expect(c.runningTotal).toBeCloseTo(running, 6);
      expect(c.capitalPerPerson).toBeCloseTo(c.capitalTotal / SHARED.pop, 9);
      expect(c.runningPerPerson).toBeCloseTo(c.runningTotal / SHARED.pop, 9);
    }
  });
  it('upkeep is a share of groundworks and buildings only; the fleet is renewed in households instead', () => {
    for (const c of [car.cost, yours.cost]) {
      expect(row(c, 'upkeep').count).toBeCloseTo(c.layers.groundworks + c.layers.buildings, 6);
      expect(row(c, 'vehiclesRenewed').layer).toBe('households');
      expect(row(c, 'vehicleKm').layer).toBe('households');
    }
  });
  it('the Land line prices the city’s area and the Financing line pays the structures off level over the term', () => {
    for (const [c, l] of [
      [car.cost, car],
      [yours.cost, yours],
    ] as const) {
      expect(c.land.areaM2).toBeCloseTo(l.areaKm2 * 1e6, 6);
      expect(c.land.cost).toBeCloseTo(c.land.areaM2 * COSTS.landM2.value, 6);
      expect(c.financing.capital).toBeCloseTo(c.layers.groundworks + c.layers.buildings, 6);
      const r = c.financing.rate;
      const n = c.financing.years;
      expect(c.financing.yearly).toBeCloseTo((c.financing.capital * r) / (1 - (1 + r) ** -n), 6);
      expect(c.financing.yearly * n).toBeGreaterThan(c.financing.capital);
    }
    expect(ids(car.cost)).not.toContain('rent');
  });
  it('a rate of zero divides the capital evenly over the years', () => {
    const k: CostPremises = { ...COSTS, financeRate: { value: 0, mark: { kind: 'mine' } } };
    const c = deriveCarCity(SHARED, CAR_CITY, k).cost;
    expect(c.financing.yearly).toBeCloseTo(c.financing.capital / c.financing.years, 6);
  });
});

describe('every premise carries a mark', () => {
  it('each premise is Yours, Mine or Sourced, and a Sourced one names its source, year and url', () => {
    for (const key of Object.keys(COSTS) as CostPremiseId[]) {
      const m = COSTS[key].mark;
      expect(['yours', 'mine', 'sourced']).toContain(m.kind);
      if (m.kind === 'sourced') {
        expect(m.source.length).toBeGreaterThan(0);
        expect(m.year).toBeGreaterThanOrEqual(1990);
        expect(m.year).toBeLessThanOrEqual(2026);
        expect(m.url.startsWith('https://')).toBe(true);
      }
    }
  });
  it('the grades are Yours (line 15), the per-pupil cost is Sourced, the pipe is Mine', () => {
    expect(COSTS.grades.mark.kind).toBe('yours');
    expect(COSTS.pupilYear.mark.kind).toBe('sourced');
    expect(COSTS.pipeKm.mark.kind).toBe('mine');
  });
});

describe('both columns use the same arithmetic', () => {
  it('vehicle-km a year is trips times the ride, with the empty running, times 365', () => {
    expect(row(car.cost, 'vehicleKm').count).toBeCloseTo(car.vehTrips * car.rideKm * (1 + CAR_CITY.emptyRunning) * 365, 6);
    expect(row(yours.cost, 'vehicleKm').count).toBeCloseTo(
      yours.vehTrips * yours.rideKm * (1 + WALKING_CITY.emptyRunning) * 365,
      6,
    );
    expect(row(car.cost, 'vehicleKm').premise).toBe('carKm');
    expect(row(yours.cost, 'vehicleKm').premise).toBe('moverKm');
  });
  it('a column carries only the rows it has something of', () => {
    const carIds = ids(car.cost);
    expect(carIds).toContain('waiting');
    expect(carIds).not.toContain('walkwayFloor');
    expect(carIds).not.toContain('porters');
    expect(carIds).not.toContain('highRiseFloor');
    const yourIds = ids(yours.cost);
    for (const id of ['walkwayFloor', 'moverLineFloor', 'moverTrack', 'stations', 'entries', 'pipe', 'lanes', 'porters'] as const) {
      expect(yourIds).toContain(id);
    }
    for (const c of [car.cost, yours.cost]) expect(new Set(ids(c)).size).toBe(c.rows.length);
  });
});

describe('changing a premise moves only the rows that use it', () => {
  it('doubling the price of a mover moves vehicles and vehiclesRenewed in your column and nothing in the car’s', () => {
    const k: CostPremises = { ...COSTS, moverEach: { ...COSTS.moverEach, value: COSTS.moverEach.value * 2 } };
    const after = deriveWalkingCity(SHARED, WALKING_CITY, NEEDS, k).cost;
    expect(row(after, 'vehicles').cost).toBeCloseTo(row(yours.cost, 'vehicles').cost * 2, 6);
    expect(row(after, 'vehiclesRenewed').cost).toBeCloseTo(row(yours.cost, 'vehiclesRenewed').cost * 2, 6);
    for (const r of after.rows) {
      if (r.id !== 'vehicles' && r.id !== 'vehiclesRenewed') expect(r.cost).toBe(row(yours.cost, r.id).cost);
    }
    expect(after.financing.yearly).toBe(yours.cost.financing.yearly);
    expect(deriveCarCity(SHARED, CAR_CITY, k).cost).toEqual(car.cost);
  });
  it('a unit cost of zero zeroes its row and nothing else', () => {
    const k: CostPremises = { ...COSTS, pipeKm: { ...COSTS.pipeKm, value: 0 } };
    const after = deriveWalkingCity(SHARED, WALKING_CITY, NEEDS, k).cost;
    expect(row(after, 'pipe').cost).toBe(0);
    expect(after.layers.groundworks).toBeCloseTo(yours.cost.layers.groundworks - row(yours.cost, 'pipe').cost, 6);
    expect(after.layers.buildings).toBe(yours.cost.layers.buildings);
  });
});

describe('money adds rows and moves nothing', () => {
  it('every figure of the nine steps is the same with and without the cost premises passed', () => {
    const { cost: _a, ...before } = deriveWalkingCity(SHARED, WALKING_CITY, NEEDS);
    const { cost: _b, ...after } = deriveWalkingCity(SHARED, WALKING_CITY, NEEDS, {
      ...COSTS,
      lowRiseM2: { ...COSTS.lowRiseM2, value: 1 },
    });
    expect(after).toEqual(before);
  });
  it('the published city at the premises of 2026-10-13: a check on the premises, not truth', () => {
    expect(Math.round(car.cost.capitalPerPerson)).toBe(255086);
    expect(Math.round(yours.cost.capitalPerPerson)).toBe(210226);
    expect(Math.round(car.cost.runningPerPerson)).toBe(14869);
    expect(Math.round(yours.cost.runningPerPerson)).toBe(10394);
    expect(Math.round(car.cost.financing.yearly / SHARED.pop)).toBe(12876);
    expect(Math.round(yours.cost.financing.yearly / SHARED.pop)).toBe(12575);
  });
  it('refuses a city with nobody to count per person', () => {
    expect(() => deriveCarCity({ ...SHARED, pop: 0 }, CAR_CITY)).toThrow(RangeError);
  });
});

describe('the car column is vouched against what America pays (loose by design)', () => {
  it('to build: within the US stock of structures, roughly 200,000 to 250,000 a person, give or take a third', () => {
    const structures = (car.cost.layers.groundworks + car.cost.layers.buildings) / SHARED.pop;
    expect(structures).toBeGreaterThan(130000);
    expect(structures).toBeLessThan(330000);
  });
  it('schools: the pupils are the US school-age share of the people, about 16%', () => {
    const share = row(car.cost, 'schools').count / SHARED.pop;
    expect(share).toBeGreaterThan(0.13);
    expect(share).toBeLessThan(0.19);
  });
  it('getting around: a car’s year costs less than AAA’s 11,577, because the ledger’s city is a 10-minute drive across', () => {
    const perCar = (row(car.cost, 'vehicleKm').cost + row(car.cost, 'vehiclesRenewed').cost) / car.fleet;
    const kmPerCar = row(car.cost, 'vehicleKm').count / car.fleet;
    expect(kmPerCar).toBeLessThan(24000);
    expect(perCar).toBeGreaterThan(11577 * 0.3);
    expect(perCar).toBeLessThan(11577 * 1.2);
  });
  it('civic: between half and twice the Urban Institute’s local direct spending a person, 11,087 all levels', () => {
    const civic = car.cost.layers.civic / SHARED.pop;
    expect(civic).toBeGreaterThan(11087 * 0.4);
    expect(civic).toBeLessThan(11087 * 1.2);
  });
});
