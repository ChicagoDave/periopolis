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
  waterGpd,
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
    expect(row(car.cost, 'water').count).toBeCloseTo((SHARED.pop * waterGpd(car.yards + car.parks, COSTS) * 365) / 1000, 6);
    expect(row(yours.cost, 'water').count).toBeCloseTo((SHARED.pop * waterGpd(yours.yards + yours.parks, COSTS) * 365) / 1000, 6);
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

describe('water follows the green ground', () => {
  it('a person’s water is the base plus the watering of yards and parks; the car city lands on USGS’s 138, yours on 116', () => {
    expect(waterGpd(0, COSTS)).toBe(COSTS.waterBaseGpd.value);
    expect(waterGpd(car.yards + car.parks, COSTS)).toBeCloseTo(138, 0);
    expect(waterGpd(yours.yards + yours.parks, COSTS)).toBeCloseTo(116, 0);
  });
  it('more parks drink more water; the sewage, which is not watering, does not move', () => {
    const greener = deriveWalkingCity(SHARED, { ...WALKING_CITY, parks: WALKING_CITY.parks * 2 }, NEEDS);
    expect(row(greener.cost, 'water').count).toBeGreaterThan(row(yours.cost, 'water').count);
    expect(row(greener.cost, 'sewer').count).toBe(row(yours.cost, 'sewer').count);
  });
  it('refuses green ground below zero or not a number', () => {
    expect(() => waterGpd(-1, COSTS)).toThrow(RangeError);
    expect(() => waterGpd(Number.NaN, COSTS)).toThrow(RangeError);
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
  it('every premise was accepted by 2026-10-14: each is Yours or an accepted Sourced figure, and none is Mine', () => {
    for (const key of Object.keys(COSTS) as CostPremiseId[]) {
      const m = COSTS[key].mark;
      expect(m.kind === 'yours' || (m.kind === 'sourced' && m.accepted)).toBe(true);
    }
    expect(COSTS.grades.mark.kind).toBe('yours');
    expect(COSTS.goodsRun.mark.kind).toBe('yours');
  });
  it('an accepted Sourced figure keeps its source', () => {
    const pipe = COSTS.pipeKm.mark;
    expect(pipe.kind === 'sourced' && pipe.accepted).toBe(true);
    expect(pipe.kind === 'sourced' && pipe.source.startsWith('Analog: Envac')).toBe(true);
  });
  it('every premise of the three build layers was accepted on 2026-10-14: each is Yours or an accepted Sourced figure', () => {
    const built: CostPremiseId[] = [
      'lowRiseM2',
      'highRiseM2',
      'dumbwaiterEach',
      'carEach',
      'moverEach',
      'streetM2',
      'waitingM2',
      'parkM2',
      'walkwayWidthM',
      'moverLineWidthM',
      'moverTrackKm',
      'stationEach',
      'entryEach',
      'pipeKm',
      'laneKm',
      'reactorModuleEach',
      'plantUnitEach',
    ];
    for (const key of built) {
      const m = COSTS[key].mark;
      expect(m.kind === 'yours' || (m.kind === 'sourced' && m.accepted)).toBe(true);
    }
    expect(COSTS.moverLineWidthM.mark.kind).toBe('yours');
    expect(COSTS.waitingM2.value).toBe(250);
    expect(COSTS.moverTrackKm.value).toBe(12e6);
    expect(COSTS.stationEach.value).toBe(3e6);
    expect(COSTS.entryEach.value).toBe(300000);
    expect(COSTS.pipeKm.value).toBe(1e6);
    expect(COSTS.dumbwaiterEach.value).toBe(10000);
    expect(COSTS.moverEach.value).toBe(30000);
  });
  it('upkeep and households were accepted on 2026-10-14, the mover priced as a cart-class pod, not a robotaxi', () => {
    for (const key of ['upkeepShare', 'vehicleLifeYears', 'carKm', 'carInsuranceYear', 'moverKm'] as const) {
      const m = COSTS[key].mark;
      expect(m.kind === 'sourced' && m.accepted).toBe(true);
    }
    expect(COSTS.vehicleLifeYears.value).toBe(17);
    expect(COSTS.carKm.value).toBe(0.14);
    expect(COSTS.carInsuranceYear.value).toBe(1694);
    expect(COSTS.moverKm.value).toBe(0.1);
  });
  it('the civic services were accepted on 2026-10-14; the porter stays a paid city job (line 7)', () => {
    const civic = [
      'pupilYear',
      'policePerson',
      'firePerson',
      'healthPerson',
      'libraryPerson',
      'gridKwh',
      'reactorMwh',
      'waterKgal',
      'sewerKgal',
      'wasteTon',
      'porterYear',
    ] as const;
    for (const key of civic) {
      const m = COSTS[key].mark;
      expect(m.kind === 'sourced' && m.accepted).toBe(true);
    }
    expect(COSTS.waterKgal.value).toBe(6);
    expect(COSTS.sewerKgal.value).toBe(9);
    expect(COSTS.porterYear.value).toBe(54000);
    expect(COSTS.goodsRun.value).toBe(300);
  });
  it('the civic layer carries the state’s share, accepted on 2026-10-14 (line 27)', () => {
    const added = {
      welfarePerson: 2597,
      higherEducationPerson: 938,
      administrationPerson: 443,
      correctionsPerson: 262,
      courtsPerson: 158,
      streetRunM2: 2.41,
      parkRunM2: 2.58,
    } as const;
    for (const [key, value] of Object.entries(added) as [keyof typeof added, number][]) {
      const m = COSTS[key].mark;
      expect(m.kind === 'sourced' && m.accepted).toBe(true);
      expect(COSTS[key].value).toBe(value);
    }
  });
});

describe('the services a whole city carries (widen-civic-layer, 2026-10-14)', () => {
  const perPerson = [
    ['welfare', 'welfarePerson'],
    ['higherEducation', 'higherEducationPerson'],
    ['administration', 'administrationPerson'],
    ['corrections', 'correctionsPerson'],
    ['courts', 'courtsPerson'],
  ] as const;
  it('welfare, higher education, administration, corrections and courts are a person’s worth in both columns alike', () => {
    for (const [id, premise] of perPerson) {
      for (const c of [car.cost, yours.cost]) {
        expect(row(c, id).layer).toBe('civic');
        expect(row(c, id).count).toBe(SHARED.pop);
        expect(row(c, id).cost).toBeCloseTo(SHARED.pop * COSTS[premise].value, 6);
      }
    }
  });
  it('running the streets and parks follows each column’s own ground, so the car city pays more', () => {
    expect(row(car.cost, 'streetRunning').count).toBeCloseTo(SHARED.pop * car.streets, 6);
    expect(row(yours.cost, 'streetRunning').count).toBeCloseTo(SHARED.pop * yours.streets, 6);
    expect(row(car.cost, 'parkRunning').count).toBeCloseTo(SHARED.pop * car.parks, 6);
    expect(row(yours.cost, 'parkRunning').count).toBeCloseTo(SHARED.pop * yours.parks, 6);
    expect(Math.round(row(car.cost, 'streetRunning').cost / SHARED.pop)).toBe(274);
    expect(Math.round(row(yours.cost, 'streetRunning').cost / SHARED.pop)).toBe(36);
    expect(Math.round(row(car.cost, 'parkRunning').cost / SHARED.pop)).toBe(111);
    expect(Math.round(row(yours.cost, 'parkRunning').cost / SHARED.pop)).toBe(26);
  });
  it('the left-out categories have no row: housing, air, natural resources, the remainder (money.md, Decided)', () => {
    const civicIds = ids(car.cost).filter((id) => row(car.cost, id).layer === 'civic');
    expect(civicIds).toHaveLength(17);
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
  it('insurance is priced per car in the car city; yours has none, because the city indemnifies its citizens (line 29)', () => {
    expect(row(car.cost, 'insurance').count).toBe(car.fleet);
    expect(row(car.cost, 'insurance').premise).toBe('carInsuranceYear');
    expect(row(car.cost, 'insurance').layer).toBe('households');
    expect(row(car.cost, 'insurance').cost).toBeCloseTo(car.fleet * 1694, 6);
    expect(ids(yours.cost)).not.toContain('insurance');
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
  it('the published city with every premise accepted and the civic layer widened on 2026-10-14: a check on the premises, not truth', () => {
    expect(Math.round(car.cost.capitalPerPerson)).toBe(261845);
    expect(Math.round(yours.cost.capitalPerPerson)).toBe(198319);
    // Was 15,422 and 10,029 before the seven civic rows (welfare to park running) were added.
    expect(Math.round(car.cost.runningPerPerson)).toBe(20205);
    expect(Math.round(yours.cost.runningPerPerson)).toBe(14489);
    expect(Math.round(car.cost.financing.yearly / SHARED.pop)).toBe(13282);
    expect(Math.round(yours.cost.financing.yearly / SHARED.pop)).toBe(11884);
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
    const perCar = (row(car.cost, 'vehicleKm').cost + row(car.cost, 'vehiclesRenewed').cost + row(car.cost, 'insurance').cost) / car.fleet;
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
