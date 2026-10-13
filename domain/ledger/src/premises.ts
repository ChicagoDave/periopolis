/**
 * @file The premises of the ledger: what is shared by both columns, what the car city is built on, and the lines your city is built on.
 * Public interface: SharedPremises, CarCityPremises, WalkingCityPremises, SHARED, CAR_CITY, WALKING_CITY.
 * Owner context: Ledger (domain).
 *
 * Lengths are in km unless a name says otherwise; floor and land are square meters per person; walks are minutes.
 */

/** Section 1 of the ledger: the people. The same in both columns. */
export interface SharedPremises {
  /** Population. */
  readonly pop: number;
  /** Trips per person per day. */
  readonly trips: number;
  /** People per home. */
  readonly hh: number;
  /** Home floor area per person, m². */
  readonly homeFloor: number;
  /** Shops, offices, schools and clinics per person, m². */
  readonly otherFloor: number;
  /** People in each school year, as a share of everyone. */
  readonly gradeShare: number;
  /** Walk a driver will make for daily needs, minutes. */
  readonly walkDailyMin: number;
  /** Walk at which people take a ride instead, minutes. */
  readonly walkMaxMin: number;
  /** Bike ride they will make, minutes. */
  readonly bikeMaxMin: number;
  /** Speed on a bike, km/h. */
  readonly bikeKmh: number;
  /** Trips that need a ride at any distance. */
  readonly rideAnyway: number;
  /** Share of the day's trips made in the busiest hour. */
  readonly peakShare: number;
  /** Parcels per person per year. */
  readonly parcelsPerYear: number;
  /** Other goods in and waste out, per person per day, kg. */
  readonly goodsKg: number;
}

/** The car city: houses on lots, daily needs reached by car, a vehicle in every household. */
export interface CarCityPremises {
  readonly kind: 'car';
  /** Time allowed to reach daily needs, minutes of driving. */
  readonly driveMin: number;
  /** Vehicle speed door to door, km/h. */
  readonly rideKmh: number;
  /** Path length divided by the straight line. */
  readonly detour: number;
  /** Share of trips that are daily needs. */
  readonly basicShare: number;
  /** People the hungriest daily need wants: a supermarket's worth. */
  readonly anchorPop: number;
  /** Ground per home, m². */
  readonly lotPerHome: number;
  /** Building height, stories. */
  readonly stories: number;
  /** Share of a building site that is built on. */
  readonly siteCoverage: number;
  /** Parks per person, m². */
  readonly parks: number;
  /** Land given to movement. */
  readonly moveShare: number;
  /** Vehicles per person. */
  readonly vehPerPerson: number;
  /** Places to wait, per vehicle. */
  readonly spacesPerVeh: number;
  /** Ground per place, m². */
  readonly stall: number;
  /** Seats per vehicle. */
  readonly seats: number;
  /** People per vehicle trip. */
  readonly occupancy: number;
  /** Bikeable trips that people do bike. */
  readonly bikeWilling: number;
  /** Getting to and from a ride: parking and walking, minutes. */
  readonly handlingMin: number;
  /** Extra driving with nobody aboard. */
  readonly emptyRunning: number;
  /** Parcels per delivery run. */
  readonly parcelsPerRun: number;
  /** Load per bulk run, kg. */
  readonly payloadKg: number;
}

/** Your city: townhouses, a ring in the middle, daily needs within a walk, one fleet of movers on the sub level. */
export interface WalkingCityPremises {
  readonly kind: 'walking';
  /** Mover speed door to door, km/h. */
  readonly rideKmh: number;
  /** Path length divided by the straight line. */
  readonly detour: number;
  /** Building height of the townhouses, stories. */
  readonly stories: number;
  /** Share of a building site that is built on. */
  readonly siteCoverage: number;
  /** Parks per person, m². */
  readonly parks: number;
  /** Land given to movement. */
  readonly moveShare: number;
  /** Offices, as a share of the non-home floor. */
  readonly officeShare: number;
  /** Office work kept in neighborhood rooms. */
  readonly coworkShare: number;
  /** Government and auditorium floor per person, m². */
  readonly civicFloor: number;
  /** Homes that are condos in the ring. */
  readonly condoShare: number;
  /** Height of a ring building, stories. Line 19. */
  readonly ringStories: number;
  /** One floor of a ring building, m². */
  readonly floorPlate: number;
  /** Work trips that go to the middle. */
  readonly officeJobShare: number;
  /** Walk to school or work, at most, minutes. Line 16. 0 means as any other trip. */
  readonly longWalkMin: number;
  /** Stretch the city must hold its rules across. Line 18. */
  readonly band: number;
  /** Shopping trips the dumbwaiter replaces. Line 12. */
  readonly dumbShare: number;
  /** Mover stops in the ground of each center. */
  readonly stopsPerCenter: number;
  /** Wait for a mover, minutes. */
  readonly waitMin: number;
  /** Walk to a sub-level entry, minutes. Line 9. */
  readonly entryWalkMin: number;
  /** Mover line laid, as a multiple of the straight stop-to-stop length. */
  readonly loopFactor: number;
  /** Spare vehicles. */
  readonly reserve: number;
  /** Extra driving with nobody aboard. */
  readonly emptyRunning: number;
  /** Riders who share a shuttle. */
  readonly pooledShare: number;
  /** Riders aboard a shared shuttle. */
  readonly pooledLoad: number;
  /** Depot ground per mover body. */
  readonly packFactor: number;
  /** Bikeable trips that people do bike. Line 8. */
  readonly bikeWilling: number;
  /** A mover's stop at a berth, minutes. */
  readonly dwellMin: number;
  /** Share of an hour a berth is in use. */
  readonly berthUse: number;
  /** Load per bulk run on the sub level, kg. */
  readonly payloadKg: number;
  /** Weight the pipe takes. */
  readonly pipedShare: number;
  /** Width of a townhouse front, m. */
  readonly frontage: number;
  /** Rows of townhouses one pipe serves. */
  readonly rowsPerPipe: number;
  /** Grocery deliveries per home per week. */
  readonly groceryPerWeek: number;
  /** Trash totes out per home per day. */
  readonly trashTotes: number;
  /** Bulky deliveries per 1,000 homes per day. */
  readonly bulkyPer1000: number;
  /** Porter minutes a bulky delivery takes. */
  readonly bulkyMin: number;
  /** Homes that change hands each year. */
  readonly moveRate: number;
  /** Porter hours to move a household out or in. */
  readonly moveHours: number;
  /** The harm line, joules. Line 5. */
  readonly harmLine: number;
  /** Width of a bike lane, m. */
  readonly laneWidth: number;
}

/** Either column's premises. */
export type ColumnPremises = CarCityPremises | WalkingCityPremises;

/** Revision 3 of the ledger: the people. */
export const SHARED: SharedPremises = {
  pop: 50000,
  trips: 3.37,
  hh: 2.45,
  homeFloor: 68.8,
  otherFloor: 27.4,
  gradeShare: 0.012,
  walkDailyMin: 5,
  walkMaxMin: 15,
  bikeMaxMin: 15,
  bikeKmh: 15,
  rideAnyway: 0.1,
  peakShare: 0.1,
  parcelsPerYear: 64,
  goodsKg: 7,
};

/** Revision 3 of the ledger: the car city. */
export const CAR_CITY: CarCityPremises = {
  kind: 'car',
  driveMin: 10,
  rideKmh: 35,
  detour: 1.3,
  basicShare: 0.35,
  anchorPop: 7500,
  lotPerHome: 590,
  stories: 1.5,
  siteCoverage: 0.8,
  parks: 42.9,
  moveShare: 0.24,
  vehPerPerson: 0.84,
  spacesPerVeh: 3.3,
  stall: 30.2,
  seats: 5,
  occupancy: 1.39,
  bikeWilling: 0.05,
  handlingMin: 3,
  emptyRunning: 0,
  parcelsPerRun: 150,
  payloadKg: 5000,
};

/** Revision 3 of the ledger: your city. */
export const WALKING_CITY: WalkingCityPremises = {
  kind: 'walking',
  rideKmh: 25,
  detour: 1.2,
  stories: 3,
  siteCoverage: 0.6,
  parks: 10,
  moveShare: 0.2,
  officeShare: 0.17,
  coworkShare: 0,
  civicFloor: 0.4,
  condoShare: 0.02,
  ringStories: 25,
  floorPlate: 2000,
  officeJobShare: 0.3,
  longWalkMin: 30,
  band: 0.2,
  dumbShare: 0.67,
  stopsPerCenter: 1,
  waitMin: 2,
  entryWalkMin: 1,
  loopFactor: 1.25,
  reserve: 0.15,
  emptyRunning: 0.2,
  pooledShare: 0.25,
  pooledLoad: 8,
  packFactor: 1.25,
  bikeWilling: 0.5,
  dwellMin: 1,
  berthUse: 0.5,
  payloadKg: 500,
  pipedShare: 0.6,
  frontage: 6,
  rowsPerPipe: 2,
  groceryPerWeek: 2,
  trashTotes: 1,
  bulkyPer1000: 10,
  bulkyMin: 30,
  moveRate: 0.09,
  moveHours: 16,
  harmLine: 310,
  laneWidth: 3.5,
};
