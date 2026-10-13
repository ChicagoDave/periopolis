/**
 * @file What the ledger derives: the consequences of a column's premises, figure by figure.
 * Public interface: LedgerCore, CarCityLedger, WalkingCityLedger, Ledger, VehicleMix.
 * Owner context: Ledger (domain).
 *
 * Lengths are in km unless a name says otherwise; floor and land are square meters per person; walks are minutes;
 * shares are fractions from 0 to 1.
 */
import type { VehicleClassName } from './constants.ts';
import type { LandFigures, RingFigures } from './land.ts';
import type { PlacedNeed } from './needs.ts';

/** Share of vehicle trips made by each class of mover. */
export type VehicleMix = Readonly<Record<VehicleClassName, number>>;

/** The figures both columns derive. */
export interface LedgerCore extends LandFigures {
  /** The stretch the city holds its rules across. 0 for the car city. */
  readonly band: number;
  readonly stories: number;
  readonly parks: number;
  /** People per km². */
  readonly density: number;
  /** City land that is parking, off the street and on it. */
  readonly parkingShare: number;
  readonly areaKm2: number;
  /** Radius, if round. */
  readonly radiusKm: number;
  /** Rim to middle, on foot. */
  readonly rimMin: number;
  /** Land held in reserve at the edge. */
  readonly reserveKm2: number;
  /** Walk a driver will make for daily needs, as a straight-line distance. */
  readonly walkDailyKm: number;
  /** People the hungriest daily need wants. */
  readonly hungriest: number;
  /** Which need that is; null when the center is sized some other way. */
  readonly hungriestId: string | null;
  /** People a center has. */
  readonly centerPop: number;
  /** Middle of a center's ground to its corner. */
  readonly reachKm: number;
  /** Ground inside the reach. */
  readonly reachCellKm2: number;
  /** Density over what daily needs demand. */
  readonly ruleSlack: number;
  /** Centers in the city. */
  readonly centers: number;
  /** Ground one center serves. */
  readonly centerCellKm2: number;
  /** Typical trip to the center. */
  readonly typicalToCenterKm: number;
  /** Farthest walk to the center. */
  readonly farCenterMin: number;
  /** Homes within the daily walk of their center. */
  readonly inWalkReach: number;
  /** People one mover stop serves. 0 when the car is at the door. */
  readonly peoplePerStop: number;
  /** The median home's walk to its stop. */
  readonly stopWalkKm: number;
  /** Farthest walk to a stop. */
  readonly farStopMin: number;
  /** Trips per person per day, after deliveries. */
  readonly tripsPerDay: number;
  /** Trips that are daily needs. */
  readonly dailyShare: number;
  /** Trips to anywhere else in the city. */
  readonly elsewhereShare: number;
  readonly walk: number;
  readonly bike: number;
  readonly ride: number;
  /** Trips that want a ride and have none to take. */
  readonly noRide: number;
  /** Average ride, along the path. */
  readonly rideKm: number;
  /** Walks to or from a stop on the average ride. */
  readonly rideWalks: number;
  /** Getting to and from a ride. */
  readonly accessMin: number;
  /** Minutes a vehicle is tied up by one ride. */
  readonly vehicleMin: number;
  /** Walk past which a ride is quicker, at best. */
  readonly evenLowMin: number;
  /** Walk past which a ride is quicker, at worst. */
  readonly evenHighMin: number;
  /** Door to door, average ride. */
  readonly doorMin: number;
  readonly ridersPerDay: number;
  /** Vehicle trips per day. */
  readonly vehTrips: number;
  /** Seats filled while moving. */
  readonly seatUse: number;
  readonly vehTripsPerPerson: number;
  /** Vehicles moving in the busiest hour. */
  readonly movingPeak: number;
  readonly fleet: number;
  readonly fleetPer1000: number;
  /** Share of the fleet moving at the peak. */
  readonly peakUse: number;
  /** Places to wait. */
  readonly spaces: number;
  /** Ground those places take, m² for the whole city. */
  readonly storageM2: number;
  /** Places to leave a vehicle, per 1,000 people. */
  readonly placesPer1000: number;
  /** Ground per place, m². */
  readonly storagePerVeh: number;
  /** Vehicle runs for goods per day. */
  readonly goodsRuns: number;
  /** Goods runs among all vehicle trips. */
  readonly goodsShare: number;
}

/** The car city derived. */
export interface CarCityLedger extends LedgerCore {
  readonly kind: 'car';
}

/** Your city derived. */
export interface WalkingCityLedger extends LedgerCore, RingFigures {
  readonly kind: 'walking';
  /** Where every need lands. */
  readonly needs: readonly PlacedNeed[];
  readonly districts: number;
  /** Trips to places shared between centers. */
  readonly districtShare: number;
  /** Trips to the middle. */
  readonly middleShare: number;
  readonly mix: VehicleMix;
  /** Mover stops: each center's share of them, and one more under the ring. */
  readonly stations: number;
  /** Berths at each stop. */
  readonly berths: number;
  readonly peoplePerEntry: number;
  /** Homes that share an entry. */
  readonly homesPerEntry: number;
  readonly entries: number;
  readonly entriesPerCenter: number;
  /** Sub-level walkway, entries to stops. */
  readonly walkwayKm: number;
  /** Mover line, linking the stops. */
  readonly moverKm: number;
  /** Sub level to build. */
  readonly subLevelKm: number;
  readonly dumbwaiters: number;
  /** Goods pipe. */
  readonly pipeKm: number;
  /** Totes through the pipe per day. */
  readonly totes: number;
  readonly porters: number;
  /** Bike lanes. */
  readonly laneKm: number;
  /** City land in bike lanes. */
  readonly laneShare: number;
  /** Speed at which a bike is under the harm line. */
  readonly bikeLineKmh: number;
  /** Farthest door to a lane. */
  readonly farLaneMin: number;
  /** Homes inside the walk to work in the middle. */
  readonly insideLong: number;
  /** People the city holds before the rim is past that walk. */
  readonly ceilingPop: number;
  /** More children in the same homes before a school reaches its cap; null with no schools. */
  readonly growPupils: number | null;
  readonly growPupilsId: string | null;
  /** Fewer people before a need runs short; null with no counted needs. */
  readonly shrinkPeople: number | null;
  readonly shrinkPeopleId: string | null;
  /** Needs already short today. */
  readonly shortIds: readonly string[];
}

/** Either column derived. */
export type Ledger = CarCityLedger | WalkingCityLedger;
