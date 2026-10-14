/**
 * @file Cost: every row is one premise times one ledger count, both columns are priced by the same arithmetic,
 * and money adds rows without moving a figure the nine steps already gave.
 * Owner context: Ledger (domain), tests.
 */
import { describe, expect, it } from 'vitest';
import { CAR_CITY, COSTS, NEEDS, SHARED, WALKING_CITY, deriveCarCity, deriveWalkingCity } from '../src/index.ts';
import type { CapitalId, CostFigures, CostPremises, RunningId } from '../src/index.ts';

const car = deriveCarCity(SHARED, CAR_CITY);
const yours = deriveWalkingCity(SHARED, WALKING_CITY, NEEDS);

function row<Id extends string>(rows: readonly { id: Id; count: number; unit: number; cost: number }[], id: Id) {
  const r = rows.find((x) => x.id === id);
  if (!r) throw new Error(`${id} has no row`);
  return r;
}

function ids(c: CostFigures): { capital: CapitalId[]; running: RunningId[] } {
  return { capital: c.capital.map((r) => r.id), running: c.running.map((r) => r.id) };
}

describe('every row is a premise times a count', () => {
  it('each row costs count times unit, in both columns', () => {
    for (const c of [car.cost, yours.cost]) {
      for (const r of [...c.capital, ...c.running]) expect(r.cost).toBeCloseTo(r.count * r.unit, 6);
    }
  });
  it('the totals are the sums of their rows, and per person divides by the people', () => {
    for (const c of [car.cost, yours.cost]) {
      expect(c.capitalTotal).toBeCloseTo(c.capital.reduce((t, r) => t + r.cost, 0), 6);
      expect(c.runningTotal).toBeCloseTo(c.running.reduce((t, r) => t + r.cost, 0), 6);
      expect(c.capitalPerPerson).toBeCloseTo(c.capitalTotal / SHARED.pop, 9);
      expect(c.runningPerPerson).toBeCloseTo(c.runningTotal / SHARED.pop, 9);
    }
  });
  it('the counts are the ledger’s own figures', () => {
    expect(row(car.cost.capital, 'vehicles').count).toBe(car.fleet);
    expect(row(car.cost.capital, 'streets').count).toBeCloseTo(SHARED.pop * car.streets, 9);
    expect(row(car.cost.capital, 'waiting').count).toBeCloseTo(SHARED.pop * car.parkingGround, 9);
    expect(row(yours.cost.capital, 'vehicles').count).toBe(yours.fleet);
    expect(row(yours.cost.capital, 'highRiseFloor').count).toBe(yours.middleFloorM2);
    expect(row(yours.cost.capital, 'walkway').count).toBe(yours.walkwayKm);
    expect(row(yours.cost.capital, 'moverLine').count).toBe(yours.moverKm);
    expect(row(yours.cost.capital, 'entries').count).toBe(yours.entries);
    expect(row(yours.cost.capital, 'pipe').count).toBe(yours.pipeKm);
    expect(row(yours.cost.capital, 'dumbwaiters').count).toBe(yours.dumbwaiters);
    expect(row(yours.cost.running, 'porters').count).toBe(yours.porters);
    expect(row(yours.cost.running, 'goodsRuns').count).toBeCloseTo(yours.goodsRuns * 365, 6);
  });
  it('the floor is priced once: low rise plus the ring equals every square meter of home and other floor', () => {
    const floor = SHARED.pop * (SHARED.homeFloor + SHARED.otherFloor);
    const low = row(yours.cost.capital, 'lowRiseFloor').count;
    const high = row(yours.cost.capital, 'highRiseFloor').count;
    expect(low + high).toBeCloseTo(floor, 6);
    expect(row(car.cost.capital, 'lowRiseFloor').count).toBeCloseTo(floor, 6);
  });
  it('the units are the premises', () => {
    expect(row(car.cost.capital, 'vehicles').unit).toBe(COSTS.carEach);
    expect(row(yours.cost.capital, 'vehicles').unit).toBe(COSTS.moverEach);
    expect(row(car.cost.capital, 'lowRiseFloor').unit).toBe(COSTS.lowRiseM2);
    expect(row(yours.cost.running, 'upkeep').unit).toBe(COSTS.upkeepShare);
  });
});

describe('both columns use the same arithmetic', () => {
  it('upkeep is the share of what was built, vehicles aside, in both columns', () => {
    for (const c of [car.cost, yours.cost]) {
      const structures = c.capital.filter((r) => r.id !== 'vehicles').reduce((t, r) => t + r.cost, 0);
      expect(row(c.running, 'upkeep').count).toBeCloseTo(structures, 6);
    }
  });
  it('vehicle-km a year is trips times the ride, with the empty running, times 365', () => {
    expect(row(car.cost.running, 'vehicleKm').count).toBeCloseTo(
      car.vehTrips * car.rideKm * (1 + CAR_CITY.emptyRunning) * 365,
      6,
    );
    expect(row(yours.cost.running, 'vehicleKm').count).toBeCloseTo(
      yours.vehTrips * yours.rideKm * (1 + WALKING_CITY.emptyRunning) * 365,
      6,
    );
  });
  it('a column carries only the rows it has something of', () => {
    expect(ids(car.cost).capital).toEqual(['lowRiseFloor', 'streets', 'waiting', 'parks', 'vehicles']);
    expect(ids(car.cost).running).toEqual(['upkeep', 'vehicleKm', 'vehiclesRenewed', 'goodsRuns']);
    expect(ids(yours.cost).capital).toContain('walkway');
    expect(ids(yours.cost).running).toContain('porters');
  });
});

describe('changing a premise moves only the rows that use it', () => {
  it('doubling the price of a mover moves vehicles and vehiclesRenewed in your column and nothing in the car’s', () => {
    const k: CostPremises = { ...COSTS, moverEach: COSTS.moverEach * 2 };
    const after = deriveWalkingCity(SHARED, WALKING_CITY, NEEDS, k);
    expect(row(after.cost.capital, 'vehicles').cost).toBeCloseTo(row(yours.cost.capital, 'vehicles').cost * 2, 6);
    expect(row(after.cost.running, 'vehiclesRenewed').cost).toBeCloseTo(
      row(yours.cost.running, 'vehiclesRenewed').cost * 2,
      6,
    );
    for (const r of after.cost.capital) {
      if (r.id !== 'vehicles') expect(r.cost).toBe(row(yours.cost.capital, r.id).cost);
    }
    for (const r of after.cost.running) {
      if (r.id !== 'vehiclesRenewed' && r.id !== 'upkeep') expect(r.cost).toBe(row(yours.cost.running, r.id).cost);
    }
    expect(row(after.cost.running, 'upkeep').cost).toBe(row(yours.cost.running, 'upkeep').cost);
    expect(deriveCarCity(SHARED, CAR_CITY, k).cost).toEqual(car.cost);
  });
  it('a unit cost of zero zeroes its row and nothing else', () => {
    const k: CostPremises = { ...COSTS, pipeKm: 0 };
    const after = deriveWalkingCity(SHARED, WALKING_CITY, NEEDS, k);
    expect(row(after.cost.capital, 'pipe').cost).toBe(0);
    expect(after.cost.capitalTotal).toBeCloseTo(yours.cost.capitalTotal - row(yours.cost.capital, 'pipe').cost, 6);
  });
});

describe('money adds rows and moves nothing', () => {
  it('every figure of the nine steps is the same with and without the cost premises passed', () => {
    const { cost: _a, ...before } = deriveWalkingCity(SHARED, WALKING_CITY, NEEDS);
    const { cost: _b, ...after } = deriveWalkingCity(SHARED, WALKING_CITY, NEEDS, { ...COSTS, lowRiseM2: 1 });
    expect(after).toEqual(before);
  });
  it('the published city: your city costs about as much to build and about half as much to run', () => {
    expect(Math.round(car.cost.capitalPerPerson / 1000)).toBe(248);
    expect(Math.round(yours.cost.capitalPerPerson / 1000)).toBe(247);
    expect(Math.round(car.cost.runningPerPerson)).toBe(5941);
    expect(Math.round(yours.cost.runningPerPerson)).toBe(3237);
  });
  it('refuses a city with nobody to count per person', () => {
    expect(() => deriveCarCity({ ...SHARED, pop: 0 }, CAR_CITY)).toThrow(RangeError);
  });
});
