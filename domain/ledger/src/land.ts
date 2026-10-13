/**
 * @file Built form, and the land it takes per person: houses on lots for the car city, townhouses and a ring for yours.
 * Public interface: LandFigures, RingFigures, lotsLand, townhouseLand.
 * Owner context: Ledger (domain).
 */
import { PARK, RING_GAP, TINY } from './constants.ts';
import type { CarCityPremises, SharedPremises, WalkingCityPremises } from './premises.ts';

/** Ground per person, m², by what it is given to. */
export interface LandFigures {
  readonly footprint: number;
  readonly yards: number;
  readonly parkingGround: number;
  readonly streets: number;
  /** Everything together: footprints, yards, parking, parks, streets, and the ring where there is one. */
  readonly land: number;
  /** Street parking per person, m². Counted against the land but not in it. */
  readonly streetParking: number;
}

/** The ring in the middle of your city. */
export interface RingFigures {
  /** Floor the middle has to hold, m². */
  readonly middleFloorM2: number;
  /** Homes that are condos in the ring. */
  readonly condos: number;
  readonly ringStories: number;
  /** Buildings' worth of floor needed today. */
  readonly ringNeed: number;
  /** Buildings built: the need stretched by the band, rounded up. */
  readonly ringBuildings: number;
  /** People one ring building serves. */
  readonly ringServes: number;
  /** How far the people can grow before the ring is full. */
  readonly ringSlack: number;
  /** The circle, outer edge to outer edge, m. */
  readonly ringAcrossM: number;
  /** The plaza inside the circle, m². */
  readonly plazaM2: number;
  /** Ground the ring takes per person, m²: buildings and the gaps between them. */
  readonly ringGround: number;
}

/**
 * Houses on lots, with the parking the vehicles need at home and away.
 * @param s - the shared premises
 * @param c - the car city's premises
 * @returns ground per person
 */
export function lotsLand(s: SharedPremises, c: CarCityPremises): LandFigures {
  const perVeh = c.vehPerPerson * c.spacesPerVeh * c.stall;
  const stallHome = perVeh * PARK.home;
  const stallAway = perVeh * PARK.away;
  const homeFoot = s.homeFloor / c.stories;
  const otherFoot = s.otherFloor / c.stories;
  const resGround = Math.max(c.lotPerHome / s.hh, homeFoot + stallHome);
  const otherGround = (otherFoot + stallAway) / c.siteCoverage;
  const land = (resGround + otherGround + c.parks) / (1 - c.moveShare);
  return {
    footprint: homeFoot + otherFoot,
    parkingGround: stallHome + stallAway,
    yards: resGround - homeFoot - stallHome + (otherGround - otherFoot - stallAway),
    land,
    streets: land * c.moveShare,
    streetParking: perVeh * PARK.street,
  };
}

/**
 * Townhouses, and a circle of taller buildings in the middle for the offices, the civic floors and a few homes.
 * @param s - the shared premises
 * @param c - your city's premises
 * @param band - the stretch the ring must hold, from 0 to 0.95
 * @returns ground per person and the ring
 */
export function townhouseLand(
  s: SharedPremises,
  c: WalkingCityPremises,
  band: number,
): LandFigures & RingFigures {
  const office = s.otherFloor * c.officeShare * (1 - c.coworkShare);
  const perPerson = office + c.civicFloor + s.homeFloor * c.condoShare;
  const middleFloorM2 = s.pop * perPerson;
  const each = c.floorPlate * c.ringStories;
  const ringNeed = middleFloorM2 / each;
  const ringBuildings = Math.max(1, Math.ceil(ringNeed * (1 + band) - TINY));
  const ringServes = perPerson > 0 ? each / perPerson : Infinity;
  const side = Math.sqrt(c.floorPlate);
  // Middle of the circle to the middle of a building.
  const ringR = (ringBuildings * (1 + RING_GAP) * side) / (2 * Math.PI);
  const ringGround = (ringBuildings * (1 + RING_GAP) * c.floorPlate) / s.pop;
  const fabric = s.homeFloor * (1 - c.condoShare) + s.otherFloor - office - c.civicFloor;
  const footprint = fabric / c.stories;
  const sites = footprint / c.siteCoverage;
  const fabricLand = (sites + c.parks) / (1 - c.moveShare);
  return {
    middleFloorM2,
    condos: (s.pop * c.condoShare) / s.hh,
    ringStories: c.ringStories,
    ringNeed,
    ringBuildings,
    ringServes,
    ringSlack: perPerson > 0 ? (ringBuildings * ringServes) / s.pop - 1 : Infinity,
    ringAcrossM: 2 * (ringR + side / 2),
    plazaM2: Math.PI * Math.max(0, ringR - side / 2) ** 2,
    ringGround,
    footprint,
    yards: sites - footprint,
    parkingGround: 0,
    streetParking: 0,
    streets: fabricLand * c.moveShare,
    land: fabricLand + ringGround,
  };
}
