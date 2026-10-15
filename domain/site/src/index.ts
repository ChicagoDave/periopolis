/**
 * @file The Site. A board of hexagonal tiles inside an outline, where the city is laid out; commands that lay it out; the fifteen line
 * checks and the four stretch tests against the layout.
 * Public interface: the layout and its commands, assess, the rates, the board geometry, seating, the line network,
 * one day of its people hour by hour (the day view), what a layout needs to keep its lines whole and where each need could go, a city sized to its people, and the cost of what stands (with the Ledger's cost and population names re-exported, so the Run depends on the Site
 * alone).
 * Owner context: Site (domain). Depends on @city/ledger alone.
 */
export { costOf } from './cost.ts';
export type { SiteCost } from './cost.ts';
export { COSTS, LAYERS, kindOf } from '@city/ledger';
export { POPULATION, monthOf } from '@city/ledger';
export type { PopulationMonth, PopulationPremises } from '@city/ledger';
export type { CostFigures, CostId, CostPremiseId, CostPremises, CostRow, FinancingLine, Kind, LandLine, Layer, Mark, Marked } from '@city/ledger';
export { RATES, ratesFrom, SCHOOLS, EXTRAS, PLANTS } from './rates.ts';
export type { SiteRates, TripShares, SchoolKind, ExtraKind, PlantKind } from './rates.ts';
export { tileKey, tileAt, hexagon, rectangle, extent, onBoard, allTiles, neighbors, adjacent, kmBetween, edgeKey, edgeEnds } from './board.ts';
export type { TileKey, EdgeKey, Outline } from './board.ts';
export { emptyLayout, starterLayout, restoreLayout, isPlantKind } from './layout.ts';
export type { Layout, Tile, Neighborhood, Ring, Plant } from './layout.ts';
export { placeNeighborhood, addRingBuilding, toggleExtra, addPlantUnit, layStretch, erase } from './commands.ts';
export type { SiteEvent, SiteRejection, Outcome } from './commands.ts';
export { lineNetwork, closable, bridges } from './network.ts';
export type { LineNetwork, Bridge } from './network.ts';
export { seat } from './seating.ts';
export type { Taker, Place, Seat, Seating } from './seating.ts';
export { assessCore } from './assess.ts';
export { dayOf, dayFrom } from './day.ts';
export type { Day, Hour } from './day.ts';
export { DAYS, DAY_TYPES } from '@city/ledger';
export type { DayPremises, DayType } from '@city/ledger';
export { NEED_CHECKS, needsOf } from './needs.ts';
export type { Need } from './needs.ts';
export { proposeFor, applyProposal } from './propose.ts';
export type { Step, Proposal } from './propose.ts';
export { sizedTo, sizedLayout } from './sized.ts';
export { assess, bandTests } from './stretch.ts';
export type { TestId, Given, StretchTest, Assessment, AssessOptions } from './stretch.ts';
export { NO_STRESS } from './checks.ts';
export type {
  CheckStatus,
  CheckId,
  Facts,
  LineCheck,
  TileIssue,
  TileLevel,
  Reach,
  TileReport,
  Stress,
  CarComparison,
  Score,
  Core,
} from './checks.ts';
