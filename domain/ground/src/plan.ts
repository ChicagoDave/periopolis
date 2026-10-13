/**
 * @file What a ground plan is made of: the shapes on the surface, the shapes on the sub level, the figures they
 * add up to, and the mark on every placement the Ledger does not fix.
 * Public interface: Placeholder, Disc, Row, Entry, Stop, Surface, SubLevel, NeighborhoodFigures, NeighborhoodPlan.
 * Owner context: Ground (domain).
 *
 * Every length is metres in the tile's frame (see frame.ts). Numbers travel as numbers; the Board words them
 * (ADR-0004).
 */
import type { Frame, Point, Segment } from './frame.ts';

/**
 * A placement the Ledger does not fix, chosen so the plan could be drawn. Each is open to change; the Board
 * says so when it shows them. The lengths, counts and areas the Ledger derives are never on this list.
 */
export type Placeholder =
  | 'row-pitch'
  | 'row-positions'
  | 'center-size'
  | 'park-position'
  | 'lane-edges'
  | 'entry-positions'
  | 'pipe-positions';

/** A round footprint. */
export interface Disc {
  readonly at: Point;
  readonly radiusM: number;
  readonly areaM2: number;
}

/** A row of townhouses: so many homes side by side along a line of constant y, from x0 east to x1. */
export interface Row {
  readonly y: number;
  readonly x0: number;
  readonly x1: number;
  readonly homes: number;
  /** x1 - x0: the homes times the width of one front. */
  readonly frontageM: number;
  readonly stories: number;
}

/** A sub-level entry shared by the homes nearest it. */
export interface Entry {
  readonly at: Point;
  /** Homes whose nearest entry this is. */
  readonly homes: number;
  /** Steps from the entry under the stop, on the one-minute grid. */
  readonly steps: number;
  /** The walkway from this entry one step toward the stop; absent at the stop. */
  readonly walkway?: Segment;
}

/** The mover stop under the center. */
export interface Stop {
  readonly at: Point;
  readonly berths: number;
}

/** What stands on the surface. */
export interface Surface {
  readonly rows: readonly Row[];
  readonly center: Disc;
  readonly park: Disc;
  /** The bike lane: the three edges of the tile this neighborhood keeps. */
  readonly lane: readonly Segment[];
}

/** What runs underneath. */
export interface SubLevel {
  readonly stop: Stop;
  readonly entries: readonly Entry[];
  /** The goods pipe, one length under each pair of rows. */
  readonly pipes: readonly Segment[];
}

/** The sums the shapes add up to, beside the Ledger's own. */
export interface NeighborhoodFigures {
  readonly people: number;
  readonly homes: number;
  readonly stories: number;
  readonly frontageM: number;
  readonly rows: number;
  readonly parkM2: number;
  readonly laneM: number;
  readonly entries: number;
  readonly homesPerEntry: number;
  readonly walkwayM: number;
  readonly pipeM: number;
  /** The farthest home's walk to its entry, straight line, minutes. */
  readonly farthestEntryWalkMin: number;
  /** The space between rows, metres. */
  readonly rowPitchM: number;
}

/** The ground of one neighborhood. */
export interface NeighborhoodPlan {
  readonly frame: Frame;
  readonly figures: NeighborhoodFigures;
  readonly surface: Surface;
  readonly sub: SubLevel;
  readonly placeholders: readonly Placeholder[];
}
