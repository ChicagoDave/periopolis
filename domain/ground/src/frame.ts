/**
 * @file The tile's frame: a pointy-top hexagon in metres, its corners, its width at a height, and the grid of
 * one-minute cells laid over it.
 * Public interface: Point, Segment, Frame, hexFrame, halfWidthAt, insideFrame, segment, gridPoints, hexDistance.
 * Owner context: Ground (domain).
 *
 * Coordinates are metres from the middle of the tile: x east, y south, the way the Board draws. The hexagon has
 * a corner straight up and straight down, matching the Site's board, whose tiles step east and down-right.
 */

/** A spot in the tile's frame, metres east and south of its middle. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A straight length between two spots. */
export interface Segment {
  readonly from: Point;
  readonly to: Point;
  /** Its length, metres. */
  readonly m: number;
}

/** The hexagon one neighborhood stands on. */
export interface Frame {
  /** Middle to a corner, metres. */
  readonly cornerM: number;
  /** The six corners, from the top one clockwise. */
  readonly corners: readonly Point[];
  readonly areaM2: number;
}

const ROOT3 = Math.sqrt(3);

/**
 * The frame of a tile.
 * @param cornerM - middle to a corner, metres; must be finite and positive
 * @returns the hexagon, corners from the top clockwise
 */
export function hexFrame(cornerM: number): Frame {
  if (!(cornerM > 0) || !Number.isFinite(cornerM)) throw new RangeError('a frame needs a positive corner radius');
  const corners: Point[] = [];
  for (let k = 0; k < 6; k++) {
    const a = (-Math.PI / 2) + (k * Math.PI) / 3;
    corners.push({ x: cornerM * Math.cos(a), y: cornerM * Math.sin(a) });
  }
  return { cornerM, corners, areaM2: ((3 * ROOT3) / 2) * cornerM * cornerM };
}

/**
 * How far the frame reaches east (and west) of its middle at a height.
 * @param frame - the tile
 * @param y - metres south of the middle
 * @returns metres from the middle to the edge; 0 or less outside the frame
 */
export function halfWidthAt(frame: Frame, y: number): number {
  const r = frame.cornerM;
  return Math.min((ROOT3 / 2) * r, ROOT3 * (r - Math.abs(y)));
}

/** Whether a spot lies on the tile, its edge included. */
export function insideFrame(frame: Frame, p: Point): boolean {
  return Math.abs(p.y) <= frame.cornerM && Math.abs(p.x) <= halfWidthAt(frame, p.y) + 1e-9;
}

/** A segment between two spots, with its length. */
export function segment(from: Point, to: Point): Segment {
  return { from, to, m: Math.hypot(to.x - from.x, to.y - from.y) };
}

/** A point of the one-minute grid: its axial place and where it sits. */
export interface GridPoint extends Point {
  readonly q: number;
  readonly r: number;
}

/**
 * The points of a hexagonal grid that lie on the tile. The grid's six directions point at the tile's corners,
 * which is what lets a ring of cells sit inside a tile of the same shape.
 * @param frame - the tile
 * @param spacingM - middle to middle of neighboring cells, metres; must be finite and positive
 * @returns the points on the tile, nearest the middle first
 */
export function gridPoints(frame: Frame, spacingM: number): GridPoint[] {
  if (!(spacingM > 0) || !Number.isFinite(spacingM)) throw new RangeError('a grid needs a positive spacing');
  const rings = Math.ceil(frame.cornerM / spacingM) + 1;
  const cos = Math.cos(Math.PI / 6);
  const sin = Math.sin(Math.PI / 6);
  const out: GridPoint[] = [];
  for (let q = -rings; q <= rings; q++) {
    for (let r = -rings; r <= rings; r++) {
      if (hexDistance(q, r) > rings) continue;
      const x0 = spacingM * (q + r / 2);
      const y0 = spacingM * (ROOT3 / 2) * r;
      const p = { q, r, x: x0 * cos - y0 * sin, y: x0 * sin + y0 * cos };
      if (insideFrame(frame, p)) out.push(p);
    }
  }
  out.sort((a, b) => hexDistance(a.q, a.r) - hexDistance(b.q, b.r) || a.q - b.q || a.r - b.r);
  return out;
}

/** Steps between a grid point and the middle. */
export function hexDistance(q: number, r: number): number {
  return (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
}
