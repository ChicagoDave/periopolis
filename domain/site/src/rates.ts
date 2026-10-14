/**
 * @file The rates the site is built on: the tile, the walks and the trip shares, all from the ledger's city of 50,000.
 * Public interface: SiteRates, TripShares, RATES, SCHOOLS, EXTRAS, PLANTS, and the kind types.
 * Owner context: Site (domain).
 */
import {
  CAR_CITY,
  HEX,
  NEEDS,
  SHARED,
  SHOPPING,
  WALKING_CITY,
  WALK_M_PER_MIN,
  WORK,
  deriveWalkingCity,
} from '@city/ledger';
import type { CarCityPremises, Need, SharedPremises, WalkingCityLedger, WalkingCityPremises } from '@city/ledger';
import { rectangle } from './board.ts';
import type { Outline } from './board.ts';

/** The three kinds of school a neighborhood may hold. */
export type SchoolKind = 'elementary' | 'middle' | 'high';
/** What a neighborhood may hold beside its homes: a school of each kind, or playing fields. */
export type ExtraKind = SchoolKind | 'fields';
/** The plants at the edge, each on the sub level. */
export type PlantKind = 'power' | 'water' | 'sewage' | 'waste';

export const SCHOOLS: readonly SchoolKind[] = ['elementary', 'middle', 'high'];
export const EXTRAS: readonly ExtraKind[] = ['elementary', 'middle', 'high', 'fields'];
export const PLANTS: readonly PlantKind[] = ['power', 'water', 'sewage', 'waste'];

/** Where trips go, as shares of the trips still made once the dumbwaiter has replaced most shopping. */
export interface TripShares {
  readonly daily: number;
  readonly elementary: number;
  readonly middle: number;
  readonly high: number;
  readonly fields: number;
  /** Fine dining, the auditorium and government, in the ring. */
  readonly civic: number;
  /** Office work in the ring. */
  readonly office: number;
  /** Work anywhere else in the city. */
  readonly otherWork: number;
  /** Everything else, anywhere in the city. */
  readonly rest: number;
}

/** Everything the site takes from the ledger, worked out once. */
export interface SiteRates {
  /** The ledger's city of 50,000, your column. */
  readonly base: WalkingCityLedger;
  readonly shared: SharedPremises;
  readonly walking: WalkingCityPremises;
  readonly car: CarCityPremises;
  readonly needs: readonly Need[];
  /** The site's shape: which tiles are on it (ADR-0006). */
  readonly outline: Outline;
  /** People in one neighborhood. */
  readonly hood: number;
  /** Middle of a tile to its corner, km. */
  readonly tileKm: number;
  /** Middle to middle of neighboring tiles, km. */
  readonly stepKm: number;
  /** Minutes on foot per straight-line km. */
  readonly foot: number;
  /** Minutes by bike per straight-line km. */
  readonly bike: number;
  /** The typical home's walk to the center of its own tile, minutes. */
  readonly inTile: number;
  /** A typical walk between two homes in one neighborhood, minutes (assumed: 1.5 in-tile walks). */
  readonly acrossTile: number;
  readonly tileAcres: number;
  /** People one ring building serves. */
  readonly ringServes: number;
  /** The walk to school or work, as a straight line, km. */
  readonly longKm: number;
  /** Line 20: one module's output, MW. */
  readonly moduleMw: number;
  /** The peak worked out for 50,000 people, kW a person. */
  readonly peakKw: number;
  /** Cooling water per reactor module, million gallons a day. */
  readonly coolingMgd: number;
  /** Cleaned sewage per person per day, gallons. */
  readonly sewageGal: number;
  /** People one unit of a water, sewage or waste plant serves: 50,000 plus the band. */
  readonly plantServes: number;
  /** Minutes: the reading of "a slightly longer walk" in line 4. */
  readonly fieldWalk: number;
  readonly band: number;
  /** Sub-level walkway per neighborhood, km. */
  readonly walkwayKm: number;
  /** Goods pipe per neighborhood, km. */
  readonly pipeKm: number;
  /** Sub-level entries per neighborhood. */
  readonly entries: number;
  /** People on the average mover trip. */
  readonly perVehicle: number;
  readonly share: TripShares;
  /** The most buildings a ring tile holds. */
  readonly ringMax: number;
  /** The most units a plant tile holds. */
  readonly plantMax: number;
}

function needCalled(needs: readonly Need[], id: string): Need {
  const found = needs.find((n) => n.id === id);
  if (!found) throw new Error(`the needs list has no ${id}`);
  return found;
}

/**
 * Work the site's rates out from a ledger column.
 * @param shared - the shared premises
 * @param walking - your city's premises
 * @param car - the car city's premises, for the score's comparison
 * @param needs - the needs list
 * @returns the rates
 */
export function ratesFrom(
  shared: SharedPremises,
  walking: WalkingCityPremises,
  car: CarCityPremises,
  needs: readonly Need[],
): SiteRates {
  const base = deriveWalkingCity(shared, walking, needs);
  const hood = base.centerPop;
  const tileKm = Math.sqrt(hood / base.density / HEX);
  const foot = (walking.detour * 1000) / WALK_M_PER_MIN;
  const inTile = (base.typicalToCenterKm * 1000) / WALK_M_PER_MIN;
  const still = 1 - SHOPPING * walking.dumbShare;
  const shareOf = (id: string): number => needCalled(needs, id).share / 100 / still;
  const office = (WORK * walking.officeJobShare * (1 - walking.coworkShare)) / still;
  const partial = {
    daily: needs.filter((n) => n.tier === 'center').reduce((t, n) => t + n.share, 0) / 100 / still,
    elementary: shareOf('elementary'),
    middle: shareOf('middle'),
    high: shareOf('high'),
    fields: shareOf('fields'),
    civic: shareOf('finedining') + shareOf('auditorium') + shareOf('government'),
    office,
    otherWork: WORK / still - office,
  };
  const listed =
    partial.daily +
    partial.elementary +
    partial.middle +
    partial.high +
    partial.fields +
    partial.civic +
    partial.office +
    partial.otherWork;
  return {
    base,
    shared,
    walking,
    car,
    needs,
    outline: rectangle(5, 5),
    hood,
    tileKm,
    stepKm: Math.sqrt(3) * tileKm,
    foot,
    bike: (walking.detour * 60) / shared.bikeKmh,
    inTile,
    acrossTile: 1.5 * inTile,
    tileAcres: (hood / base.density) * 247.105,
    ringServes: base.ringServes,
    longKm: walking.longWalkMin / foot,
    moduleMw: 77,
    peakKw: 1.5,
    coolingMgd: 1.44,
    sewageGal: 101,
    plantServes: 60000,
    fieldWalk: 20,
    band: walking.band,
    walkwayKm: base.walkwayKm / base.centers,
    pipeKm: base.pipeKm / base.centers,
    entries: base.entriesPerCenter,
    perVehicle: base.ridersPerDay / base.vehTrips,
    share: { ...partial, rest: 1 - listed },
    ringMax: 40,
    plantMax: 12,
  };
}

/** The rates of Revision 3. */
export const RATES: SiteRates = ratesFrom(SHARED, WALKING_CITY, CAR_CITY, NEEDS);
