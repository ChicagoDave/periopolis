/**
 * @file The Periopolis Ledger. Premises in, consequences out, for the car city and your city.
 * Public interface: deriveCarCity, deriveWalkingCity; the premise and consequence types; the Revision 3 defaults
 * SHARED, CAR_CITY, WALKING_CITY, NEEDS; the cost placeholders COSTS; the population premises POPULATION and one
 * month of a city's people, monthOf; the day's premises DAYS and their hourly shapes; and the constants and geometry the other contexts build on.
 * Owner context: Ledger (domain). Imports nothing outside this package.
 */
export { deriveCarCity, deriveWalkingCity } from './derive.ts';
export type {
  CarCityLedger,
  Ledger,
  LedgerCore,
  VehicleMix,
  WalkingCityLedger,
} from './consequences.ts';
export type { LandFigures, RingFigures } from './land.ts';
export { COSTS, LAYERS, kindOf, levelPayment, priceCounts, tallyCost, waterGpd } from './cost.ts';
export type {
  CostFigures,
  CostId,
  CostPremiseId,
  CostPremises,
  CostRow,
  Counted,
  FinancingLine,
  Kind,
  LandLine,
  Layer,
  Mark,
  Marked,
} from './cost.ts';
export { DAYS, DAY_TYPES, hourlyPowerShares, hourlyTripShares } from './day.ts';
export type { DayPremises, DayType, TripPeriod } from './day.ts';
export { POPULATION, monthOf } from './population.ts';
export type { PopulationMonth, PopulationPremises } from './population.ts';
export { CAR_CITY, SHARED, WALKING_CITY } from './premises.ts';
export type { CarCityPremises, ColumnPremises, SharedPremises, WalkingCityPremises } from './premises.ts';
export { NEEDS, placeNeeds } from './needs.ts';
export type {
  CappedNeed,
  CountedNeed,
  Need,
  NeedTier,
  OutNeed,
  PlacedCappedNeed,
  PlacedCountedNeed,
  PlacedNeed,
  Placement,
  PlacementGround,
  TierShares,
} from './needs.ts';
export { cellBins, cityBins, cornerKm, discCdf, farWalkMin, roundKm } from './geometry.ts';
export type { DistanceBin } from './geometry.ts';
export { splitTrips } from './trips.ts';
export type { SplitLimits, TripSplit } from './trips.ts';
export {
  CLASSES,
  CLASS_NAMES,
  CYCLIST_KG,
  HEX,
  PARK,
  PARTIES,
  RING_GAP,
  SHOPPING,
  TINY,
  WALK_M_PER_MIN,
  WORK,
} from './constants.ts';
export type { Party, VehicleClass, VehicleClassName } from './constants.ts';
