/**
 * @file Constants of the Future City Ledger: physical facts and measured shares that every derivation uses.
 * Public interface: HEX, WALK_M_PER_MIN, SHOPPING, WORK, CYCLIST_KG, RING_GAP, TINY, PARK, PARTIES, CLASSES,
 * and the types VehicleClassName, VehicleClass, Party.
 * Owner context: Ledger (domain).
 */

/** Area of a hexagon whose corners are 1 from its middle. */
export const HEX = (3 * Math.sqrt(3)) / 2;

/** Meters a minute on foot: 4.8 km/h. */
export const WALK_M_PER_MIN = 80;

/** Share of US trips that are shopping (NHTS 2017: 0.62 of 3.37 a day). */
export const SHOPPING = 0.184;

/** Share of US trips that are work or work-related (17.4% + 1.6%). */
export const WORK = 0.19;

/** Rider and bike together, in kilograms. */
export const CYCLIST_KG = 95;

/** Gap between two ring buildings, in building widths. */
export const RING_GAP = 1;

/** Keeps a count that lands exactly on a whole number from rounding the wrong way. */
export const TINY = 1e-9;

/** Where parked cars sit. Los Angeles County, 2010: 5.5M spaces at homes, 9.6M at destinations, 3.6M on the street. */
export const PARK = {
  home: 5.5 / 18.7,
  away: 9.6 / 18.7,
  street: 3.6 / 18.7,
} as const;

/** The three sizes of mover. */
export type VehicleClassName = 'pod' | 'cab' | 'shuttle';

/** One size of mover: how many it seats and the ground its body covers in square meters. */
export interface VehicleClass {
  readonly seats: number;
  readonly body: number;
}

/** A party that rides together: its size, its share of rides, and the class of mover it takes. */
export interface Party {
  readonly size: number;
  readonly share: number;
  readonly cls: VehicleClassName;
}

/** Who rides together. Mean party 1.39, the trip-weighted occupancy in the 2017 NHTS. */
export const PARTIES: readonly Party[] = [
  { size: 1, share: 0.74, cls: 'pod' },
  { size: 2, share: 0.18, cls: 'pod' },
  { size: 3.4, share: 0.07, cls: 'cab' },
  { size: 5.5, share: 0.01, cls: 'shuttle' },
];

/** The movers by class: a Citroen Ami, a Zoox robotaxi, a Navya Autonom Shuttle. */
export const CLASSES: Readonly<Record<VehicleClassName, VehicleClass>> = {
  pod: { seats: 2, body: 2.41 * 1.39 },
  cab: { seats: 4, body: 3.63 * 1.9 },
  shuttle: { seats: 15, body: 4.75 * 2.11 },
};

/** The class names in the order the ledger reports them. */
export const CLASS_NAMES: readonly VehicleClassName[] = ['pod', 'cab', 'shuttle'];
