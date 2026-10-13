/**
 * @file The Ground. The physical plan of one neighborhood and of the ring, drawn from the figures the Ledger
 * fixes: shapes in metres, sums that reconcile, and a named placeholder for every placement the Ledger leaves open.
 * Public interface: planNeighborhood, planRing, layersAt, LEVELS, GroundError; the plan types; the frame geometry
 * hexFrame, halfWidthAt, insideFrame.
 * Owner context: Ground (domain). Depends on @city/ledger alone.
 */
export { planNeighborhood, GroundError } from './neighborhood.ts';
export type { GroundErrorReason } from './neighborhood.ts';
export { planRing } from './ring.ts';
export { layersAt } from './levels.ts';
export { LEVELS } from './plan.ts';
export { hexFrame, halfWidthAt, insideFrame } from './frame.ts';
export type { Point, Segment, Frame } from './frame.ts';
export type {
  Level,
  Placeholder,
  Disc,
  Row,
  Entry,
  Stop,
  Footprint,
  Surface,
  SubLevel,
  RingSurface,
  RingSub,
  Layer,
  NeighborhoodFigures,
  NeighborhoodPlan,
  RingFigures,
  RingPlan,
  GroundPlan,
} from './plan.ts';
