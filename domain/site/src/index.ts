/**
 * @file The Site. A board of hexagonal tiles where the city is laid out; commands that lay it out; the fifteen line
 * checks and the four stretch tests against the layout.
 * Public interface: the layout and its commands, assess, the rates, the board geometry, seating and the line network.
 * Owner context: Site (domain). Depends on @city/ledger alone.
 */
export { RATES, ratesFrom, SCHOOLS, EXTRAS, PLANTS } from './rates.ts';
export type { SiteRates, TripShares, SchoolKind, ExtraKind, PlantKind } from './rates.ts';
export { tileKey, tileAt, onBoard, allTiles, neighbors, adjacent, kmBetween, edgeKey, edgeEnds } from './board.ts';
export type { TileKey, EdgeKey } from './board.ts';
export { emptyLayout, starterLayout, restoreLayout, isPlantKind } from './layout.ts';
export type { Layout, Tile, Neighborhood, Ring, Plant } from './layout.ts';
export { placeNeighborhood, addRingBuilding, toggleExtra, addPlantUnit, layStretch, erase } from './commands.ts';
export type { SiteEvent, SiteRejection, Outcome } from './commands.ts';
export { lineNetwork, closable, bridges } from './network.ts';
export type { LineNetwork, Bridge } from './network.ts';
export { seat } from './seating.ts';
export type { Taker, Place, Seat, Seating } from './seating.ts';
export { assessCore } from './assess.ts';
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
