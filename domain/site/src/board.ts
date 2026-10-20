/**
 * @file The board: hexagonal tiles named "q,r" inside an outline, and the distances between them.
 * Public interface: TileKey, EdgeKey, Outline, Extent, hexagon, rectangle, rectangleFrom, extent, eastWest, tileKey,
 * tileAt, onBoard, allTiles, neighbors, adjacent, ringDistance, kmBetween, edgeKey, edgeEnds.
 * Owner context: Site (domain).
 *
 * Tiles are named by two whole numbers, "q,r": q counts east, r counts down and to the right. A stretch of mover line
 * between two neighboring tiles is named "a|b" with the lesser key first. Keys are parsed by walking them, never
 * by pattern (ADR-0002).
 *
 * The outline is the site's shape (ADR-0006): a hexagon of tiles, which is the sketch's board, or a rectangle of tiles,
 * which is the city's, laid along the lake shore (ADR-0016). Either way "0,0" names the same tile and the tiles are the
 * same hexagons at the same spacing.
 */

/** A tile's name, "q,r". */
export type TileKey = string;
/** A stretch of mover line, "q,r|q,r", lesser key first. */
export type EdgeKey = string;

/**
 * The site's shape: which tiles are on it. A hexagon reaches `radius` tiles from the middle to each corner, centred on
 * "0,0". A rectangle is an extent (ADR-0006 Decision 2 as amended by ADR-0016): the east-west positions (`q + r/2`
 * steps east of "0,0") from `west` to `east` and the rows from `north` to `south`, so every row spans the same width on
 * the ground and the rows alternate one tile shorter where they sit half a step over. `rectangle` makes the centred
 * form; `rectangleFrom` any extent. Values are whole numbers; west is at most east and north at most south.
 */
export type Outline =
  | { readonly kind: 'hexagon'; readonly radius: number }
  | { readonly kind: 'rectangle'; readonly west: number; readonly east: number; readonly north: number; readonly south: number };

/** How far an outline reaches: east-west positions west to east, rows north to south. */
export interface Extent {
  readonly west: number;
  readonly east: number;
  readonly north: number;
  readonly south: number;
}

/**
 * A hexagonal outline: the sketch's board.
 * @param radius - tiles from the middle to the edge
 * @throws RangeError when the radius is not a whole number of zero or more
 */
export function hexagon(radius: number): Outline {
  tileCount(radius, 'radius');
  return { kind: 'hexagon', radius };
}

/**
 * A rectangular outline centred on "0,0".
 * @param halfWidth - tile steps from the middle to the east or west edge
 * @param halfHeight - rows from the middle to the top or bottom edge
 * @throws RangeError when either figure is not a whole number of zero or more
 */
export function rectangle(halfWidth: number, halfHeight: number): Outline {
  tileCount(halfWidth, 'halfWidth');
  tileCount(halfHeight, 'halfHeight');
  return rectangleFrom(-halfWidth, halfWidth, -halfHeight, halfHeight);
}

/**
 * A rectangular outline of any extent (ADR-0016): the city's board runs along the lake shore, its south edge.
 * @param west - the westmost east-west position a tile's middle may have
 * @param east - the eastmost
 * @param north - the topmost row
 * @param south - the bottom row, the shore
 * @throws RangeError when a figure is not a whole number, or west is past east, or north past south
 */
export function rectangleFrom(west: number, east: number, north: number, south: number): Outline {
  for (const [n, name] of [
    [west, 'west'],
    [east, 'east'],
    [north, 'north'],
    [south, 'south'],
  ] as const) {
    if (!Number.isInteger(n)) throw new RangeError(`${name} must be a whole number, not ${n}`);
  }
  if (west > east) throw new RangeError(`west ${west} is past east ${east}`);
  if (north > south) throw new RangeError(`north ${north} is past south ${south}`);
  return { kind: 'rectangle', west, east, north, south };
}

/** Guard an outline figure: a whole number, zero or more. */
function tileCount(n: number, name: string): void {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`${name} must be a whole number of zero or more, not ${n}`);
}

/**
 * How far an outline reaches: east-west positions and rows. A hexagon reaches its radius every way. Drawing code
 * sizes its frame from this.
 * @param outline - the site's shape
 */
export function extent(outline: Outline): Extent {
  return outline.kind === 'hexagon'
    ? { west: -outline.radius, east: outline.radius, north: -outline.radius, south: outline.radius }
    : { west: outline.west, east: outline.east, north: outline.north, south: outline.south };
}

/**
 * Where a tile's middle sits east to west: `q + r/2` steps east of "0,0" (ADR-0016: along the shore, upstream and
 * downstream are read off this).
 * @param key - the tile
 */
export function eastWest(key: TileKey): number {
  const [q, r] = tileAt(key);
  return q + r / 2;
}

/** The six neighbors of a tile, in the order the sketch walks them. */
const DIRECTIONS: readonly (readonly [number, number])[] = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

/**
 * Name a tile.
 * @param q - columns east of the middle
 * @param r - rows down and to the right
 * @returns the key "q,r"
 */
export function tileKey(q: number, r: number): TileKey {
  return `${q},${r}`;
}

/**
 * Read a tile's coordinates from its key. A key with no comma, or with anything but whole numbers, reads as NaN parts.
 * @param key - "q,r"
 * @returns [q, r]
 */
export function tileAt(key: TileKey): readonly [number, number] {
  const i = key.indexOf(',');
  if (i < 0) return [Number.NaN, Number.NaN];
  return [wholeNumber(key.slice(0, i)), wholeNumber(key.slice(i + 1))];
}

/** Read a whole number, with an optional leading minus, from text; anything else is NaN. */
function wholeNumber(text: string): number {
  if (text.length === 0) return Number.NaN;
  let i = 0;
  let sign = 1;
  if (text.charAt(0) === '-') {
    sign = -1;
    i = 1;
    if (text.length === 1) return Number.NaN;
  }
  let value = 0;
  for (; i < text.length; i++) {
    const digit = text.charCodeAt(i) - 48;
    if (digit < 0 || digit > 9) return Number.NaN;
    value = value * 10 + digit;
  }
  return sign * value;
}

/**
 * Whether a tile lies inside the outline. On a rectangle a tile is in when its row is within the extent and its middle,
 * which sits q + r/2 steps east of "0,0", is within the extent east or west.
 * @param q - column
 * @param r - row
 * @param outline - the site's shape
 */
export function onBoard(q: number, r: number, outline: Outline): boolean {
  if (outline.kind === 'hexagon') return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= outline.radius;
  const x = q + r / 2;
  return r >= outline.north && r <= outline.south && x >= outline.west && x <= outline.east;
}

/**
 * Every tile inside the outline, row by row from the top, west to east within a row. The order over any tiles two
 * outlines share is the same, which the sketch's fixtures rely on (ADR-0003).
 * @param outline - the site's shape
 */
export function allTiles(outline: Outline): TileKey[] {
  const { west, east, north, south } = extent(outline);
  const out: TileKey[] = [];
  for (let r = north; r <= south; r++) {
    for (let q = Math.floor(west - r / 2); q <= Math.ceil(east - r / 2); q++) if (onBoard(q, r, outline)) out.push(tileKey(q, r));
  }
  return out;
}

/**
 * The tiles next to one, inside the outline.
 * @param key - the tile
 * @param outline - the site's shape
 */
export function neighbors(key: TileKey, outline: Outline): TileKey[] {
  const [q, r] = tileAt(key);
  const out: TileKey[] = [];
  for (const [dq, dr] of DIRECTIONS) {
    if (onBoard(q + dq, r + dr, outline)) out.push(tileKey(q + dq, r + dr));
  }
  return out;
}

/** Whether two tiles are next to each other inside the outline. */
export function adjacent(a: TileKey, b: TileKey, outline: Outline): boolean {
  return neighbors(a, outline).includes(b);
}

/**
 * How many tile steps apart two tiles are: the hex distance, which is the ring a tile sits on round another.
 * @param a - one tile
 * @param b - the other
 */
export function ringDistance(a: TileKey, b: TileKey): number {
  const [q1, r1] = tileAt(a);
  const [q2, r2] = tileAt(b);
  const dq = q2 - q1;
  const dr = r2 - r1;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
}

/** Where a tile's middle sits: km east and south of the middle of the board. */
function spot(key: TileKey, stepKm: number): readonly [number, number] {
  const [q, r] = tileAt(key);
  return [stepKm * (q + r / 2), ((stepKm * Math.sqrt(3)) / 2) * r];
}

/**
 * The straight-line distance between the middles of two tiles.
 * @param a - one tile
 * @param b - the other
 * @param stepKm - middle to middle of neighboring tiles
 * @returns km
 */
export function kmBetween(a: TileKey, b: TileKey, stepKm: number): number {
  const [x1, y1] = spot(a, stepKm);
  const [x2, y2] = spot(b, stepKm);
  return Math.hypot(x2 - x1, y2 - y1);
}

/** Name a stretch of mover line between two tiles, lesser key first. */
export function edgeKey(a: TileKey, b: TileKey): EdgeKey {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * The two tiles a stretch joins. A key with no bar reads as the whole key and an empty second end.
 * @param edge - "a|b"
 */
export function edgeEnds(edge: EdgeKey): readonly [TileKey, TileKey] {
  const i = edge.indexOf('|');
  if (i < 0) return [edge, ''];
  return [edge.slice(0, i), edge.slice(i + 1)];
}
