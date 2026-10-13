/**
 * @file The Ground. The physical plan of one neighborhood, and in Phase 2 of the ring, drawn from the figures the
 * Ledger fixes: shapes in metres, sums that reconcile, and a named placeholder for every placement the Ledger
 * leaves open.
 * Public interface: planNeighborhood, GroundError; the plan types; the frame geometry hexFrame, halfWidthAt,
 * insideFrame.
 * Owner context: Ground (domain). Depends on @city/ledger alone.
 */
export { planNeighborhood, GroundError } from './neighborhood.ts';
export type { GroundErrorReason } from './neighborhood.ts';
export { hexFrame, halfWidthAt, insideFrame } from './frame.ts';
export type { Point, Segment, Frame } from './frame.ts';
export type {
  Placeholder,
  Disc,
  Row,
  Entry,
  Stop,
  Surface,
  SubLevel,
  NeighborhoodFigures,
  NeighborhoodPlan,
} from './plan.ts';
