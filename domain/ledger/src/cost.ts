/**
 * @file What the city costs: capital to build it and the yearly cost to run it, derived from the ledger's counts
 * and a list of unit costs. Every unit cost is a placeholder (Mine) that David can change; nothing here is tuned.
 * Public interface: CostPremises, COSTS, CapitalId, RunningId, CostRow, CostFigures, carCost, walkingCost.
 * Owner context: Ledger (domain).
 *
 * Money is in dollars. A row is one premise times one ledger count, and both columns are priced by the same
 * function, so a difference between the columns is a difference in what they build and run, never in the arithmetic.
 */
import type { CarCityLedger, WalkingCityLedger } from './consequences.ts';
import type { CarCityPremises, SharedPremises, WalkingCityPremises } from './premises.ts';

/** Unit costs. To build: per square meter, per kilometer or per piece. To run: per year. All Mine. */
export interface CostPremises {
  /** Floor in a house, a townhouse, a shop or a school, per m² built. */
  readonly lowRiseM2: number;
  /** Floor in a ring building, per m² built. */
  readonly highRiseM2: number;
  /** Streets, paths and plazas, per m² of ground given to movement. */
  readonly streetM2: number;
  /** Ground where vehicles wait: parking or a depot, per m². */
  readonly waitingM2: number;
  /** Parks, per m². */
  readonly parkM2: number;
  /** One car. */
  readonly carEach: number;
  /** One mover, of whatever size. */
  readonly moverEach: number;
  /** Sub-level walkway, per km. */
  readonly walkwayKm: number;
  /** Mover line on the sub level, per km. */
  readonly moverLineKm: number;
  /** One mover stop, with its berths. */
  readonly stationEach: number;
  /** One sub-level entry. */
  readonly entryEach: number;
  /** Goods pipe, per km. */
  readonly pipeKm: number;
  /** One dumbwaiter. */
  readonly dumbwaiterEach: number;
  /** Bike lane, per km. */
  readonly laneKm: number;
  /** Reactor module, each. Not a ledger count; the Site prices the modules that stand. */
  readonly reactorModuleEach: number;
  /** Water, sewage or waste plant unit, each. Not a ledger count; the Site prices the units that stand. */
  readonly plantUnitEach: number;
  /** Upkeep a year, as a share of what was built, vehicles aside. */
  readonly upkeepShare: number;
  /** Running a vehicle one kilometer. */
  readonly vehicleKm: number;
  /** Years a vehicle lasts before it is replaced. */
  readonly vehicleLifeYears: number;
  /** One goods run by van or truck. */
  readonly goodsRun: number;
  /** One porter for a year. */
  readonly porterYear: number;
}

/** Placeholders, 2026 dollars, round. Every one is Mine. */
export const COSTS: CostPremises = {
  lowRiseM2: 2000,
  highRiseM2: 4000,
  streetM2: 150,
  waitingM2: 100,
  parkM2: 50,
  carEach: 35000,
  moverEach: 150000,
  walkwayKm: 15e6,
  moverLineKm: 60e6,
  stationEach: 10e6,
  entryEach: 1e6,
  pipeKm: 2e6,
  dumbwaiterEach: 15000,
  laneKm: 1e6,
  reactorModuleEach: 1e9,
  plantUnitEach: 100e6,
  upkeepShare: 0.01,
  vehicleKm: 0.5,
  vehicleLifeYears: 12,
  goodsRun: 300,
  porterYear: 60000,
};

/** What is built. A column carries only the rows it has something of. */
export type CapitalId =
  | 'lowRiseFloor'
  | 'highRiseFloor'
  | 'streets'
  | 'waiting'
  | 'parks'
  | 'vehicles'
  | 'walkway'
  | 'moverLine'
  | 'stations'
  | 'entries'
  | 'pipe'
  | 'dumbwaiters'
  | 'lanes';

/** What it takes to run for a year. */
export type RunningId = 'upkeep' | 'vehicleKm' | 'vehiclesRenewed' | 'goodsRuns' | 'porters';

/** One row of cost: so many of something, at a unit cost, is this much. */
export interface CostRow<Id extends string> {
  readonly id: Id;
  /** How many: m², km, pieces, vehicle-km a year, or dollars built for the upkeep row. */
  readonly count: number;
  /** The premise the count is priced at. */
  readonly unit: number;
  /** count times unit. */
  readonly cost: number;
}

/** A column's money: what it costs to build, and what it costs to run each year. */
export interface CostFigures {
  readonly capital: readonly CostRow<CapitalId>[];
  readonly capitalTotal: number;
  readonly capitalPerPerson: number;
  readonly running: readonly CostRow<RunningId>[];
  readonly runningTotal: number;
  readonly runningPerPerson: number;
}

/** A count waiting to be priced. */
interface Counted<Id extends string> {
  readonly id: Id;
  readonly count: number;
  readonly unit: number;
}

const DAYS = 365;

function price<Id extends string>(rows: readonly Counted<Id>[]): CostRow<Id>[] {
  return rows.map((r) => ({ id: r.id, count: r.count, unit: r.unit, cost: r.count * r.unit }));
}

function sum<Id extends string>(rows: readonly CostRow<Id>[]): number {
  return rows.reduce((t, r) => t + r.cost, 0);
}

/** The figures the running rows are built from, whichever column. */
interface Traffic {
  readonly fleet: number;
  readonly vehTrips: number;
  readonly rideKm: number;
  readonly goodsRuns: number;
}

/**
 * Prices both lists and totals them. The one arithmetic both columns share.
 * @param pop - people, for the per-person figures
 * @param capital - what is built, counted
 * @param running - what it takes to run, counted, less upkeep, which is derived here from the capital rows
 * @param k - the unit costs
 * @returns the column's money
 */
function figures(
  pop: number,
  capital: readonly Counted<CapitalId>[],
  running: readonly Counted<RunningId>[],
  k: CostPremises,
): CostFigures {
  if (!(pop > 0)) throw new RangeError('cost needs people to be counted per person');
  const built = price(capital);
  const structures = sum(built.filter((r) => r.id !== 'vehicles'));
  const run = price([{ id: 'upkeep', count: structures, unit: k.upkeepShare }, ...running]);
  const capitalTotal = sum(built);
  const runningTotal = sum(run);
  return {
    capital: built,
    capitalTotal,
    capitalPerPerson: capitalTotal / pop,
    running: run,
    runningTotal,
    runningPerPerson: runningTotal / pop,
  };
}

/** The rows every column runs: vehicles driven, vehicles worn out, goods carried. */
function traffic(t: Traffic, emptyRunning: number, each: number, k: CostPremises): Counted<RunningId>[] {
  return [
    { id: 'vehicleKm', count: t.vehTrips * t.rideKm * (1 + emptyRunning) * DAYS, unit: k.vehicleKm },
    { id: 'vehiclesRenewed', count: t.fleet / k.vehicleLifeYears, unit: each },
    { id: 'goodsRuns', count: t.goodsRuns * DAYS, unit: k.goodsRun },
  ];
}

/**
 * The car city's money: houses and shops, streets, parking, parks, and a car for most people.
 * @param s - the shared premises
 * @param c - the car city's premises
 * @param f - the car column's figures, before cost
 * @param k - the unit costs
 * @returns what the car city costs to build and to run
 */
export function carCost(
  s: SharedPremises,
  c: CarCityPremises,
  f: Omit<CarCityLedger, 'cost'>,
  k: CostPremises,
): CostFigures {
  const capital: Counted<CapitalId>[] = [
    { id: 'lowRiseFloor', count: s.pop * (s.homeFloor + s.otherFloor), unit: k.lowRiseM2 },
    { id: 'streets', count: s.pop * f.streets, unit: k.streetM2 },
    { id: 'waiting', count: s.pop * f.parkingGround, unit: k.waitingM2 },
    { id: 'parks', count: s.pop * c.parks, unit: k.parkM2 },
    { id: 'vehicles', count: f.fleet, unit: k.carEach },
  ];
  return figures(s.pop, capital, traffic(f, c.emptyRunning, k.carEach, k), k);
}

/**
 * Your city's money: townhouses and the ring, paths, parks, the sub level and its movers, the pipe and the lanes.
 * @param s - the shared premises
 * @param c - your city's premises
 * @param f - your column's figures, before cost
 * @param k - the unit costs
 * @returns what your city costs to build and to run
 */
export function walkingCost(
  s: SharedPremises,
  c: WalkingCityPremises,
  f: Omit<WalkingCityLedger, 'cost'>,
  k: CostPremises,
): CostFigures {
  const floor = s.pop * (s.homeFloor + s.otherFloor);
  const capital: Counted<CapitalId>[] = [
    { id: 'lowRiseFloor', count: Math.max(0, floor - f.middleFloorM2), unit: k.lowRiseM2 },
    { id: 'highRiseFloor', count: f.middleFloorM2, unit: k.highRiseM2 },
    { id: 'streets', count: s.pop * f.streets, unit: k.streetM2 },
    { id: 'waiting', count: f.storageM2, unit: k.waitingM2 },
    { id: 'parks', count: s.pop * c.parks, unit: k.parkM2 },
    { id: 'vehicles', count: f.fleet, unit: k.moverEach },
    { id: 'walkway', count: f.walkwayKm, unit: k.walkwayKm },
    { id: 'moverLine', count: f.moverKm, unit: k.moverLineKm },
    { id: 'stations', count: f.stations, unit: k.stationEach },
    { id: 'entries', count: f.entries, unit: k.entryEach },
    { id: 'pipe', count: f.pipeKm, unit: k.pipeKm },
    { id: 'dumbwaiters', count: f.dumbwaiters, unit: k.dumbwaiterEach },
    { id: 'lanes', count: f.laneKm, unit: k.laneKm },
  ];
  const running: Counted<RunningId>[] = [
    ...traffic(f, c.emptyRunning, k.moverEach, k),
    { id: 'porters', count: f.porters, unit: k.porterYear },
  ];
  return figures(s.pop, capital, running, k);
}
