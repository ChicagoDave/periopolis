/**
 * @file The board: hexagonal tiles named "q,r" inside an outline, and the distances between them.
 * Public interface: TileKey, EdgeKey, Outline, hexagon, rectangle, extent, tileKey, tileAt, onBoard, allTiles,
 * neighbors, adjacent, kmBetween, edgeKey, edgeEnds.
 * Owner context: Site (domain).
 *
 * Tiles are named by two whole numbers, "q,r": q counts east, r counts down and to the right. A stretch of mover line
 * between two neighboring tiles is named "a|b" with the lesser key first. Keys are parsed by walking them, never
 * by pattern (ADR-0002).
 *
 * The outline is the site's shape (ADR-0006): a hexagon of tiles, which is the sketch's board, or a rectangle of tiles,
 * which is the city's. Either way the middle tile is "0,0" and the tiles are the same hexagons at the same spacing.
 */

/** A tile's name, "q,r". */
export type TileKey = string;
/** A stretch of mover line, "q,r|q,r", lesser key first. */
export type EdgeKey = string;

/**
 * The site's shape: which tiles are on it. A hexagon reaches `radius` tiles from the middle to each corner. A
 * rectangle reaches `halfWidth` tile steps east and west of the middle and `halfHeight` rows above and below it, so
 * every row spans the same width on the ground and the rows alternate one tile shorter where they sit half a step over.
 * Both are centred on "0,0". Values are whole numbers, zero or more.
 */
export type Outline =
  | { readonly kind: 'hexagon'; readonly radius: number }
  | { readonly kind: 'rectangle'; readonly halfWidth: number; readonly halfHeight: number };

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
 * A rectangular outline.
 * @param halfWidth - tile steps from the middle to the east or west edge
 * @param halfHeight - rows from the middle to the top or bottom edge
 * @throws RangeError when either figure is not a whole number of zero or more
 */
export function rectangle(halfWidth: number, halfHeight: number): Outline {
  tileCount(halfWidth, 'halfWidth');
  tileCount(halfHeight, 'halfHeight');
  return { kind: 'rectangle', halfWidth, halfHeight };
}

/** Guard an outline figure: a whole number, zero or more. */
function tileCount(n: number, name: string): void {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`${name} must be a whole number of zero or more, not ${n}`);
}

/**
 * How far an outline reaches from the middle: tile steps east or west, and rows up or down. A hexagon's reach is its
 * radius both ways. Drawing code sizes its frame from this.
 * @param outline - the site's shape
 */
export function extent(outline: Outline): { readonly halfWidth: number; readonly halfHeight: number } {
  return outline.kind === 'hexagon'
    ? { halfWidth: outline.radius, halfHeight: outline.radius }
    : { halfWidth: outline.halfWidth, halfHeight: outline.halfHeight };
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
 * Whether a tile lies inside the outline. On a rectangle a tile is in when its row is within reach and its middle,
 * which sits q + r/2 steps east of the board's middle, is within reach east or west.
 * @param q - column
 * @param r - row
 * @param outline - the site's shape
 */
export function onBoard(q: number, r: number, outline: Outline): boolean {
  if (outline.kind === 'hexagon') return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= outline.radius;
  return Math.abs(r) <= outline.halfHeight && Math.abs(q + r / 2) <= outline.halfWidth;
}

/**
 * Every tile inside the outline, row by row from the top, west to east within a row. The order over any tiles two
 * outlines share is the same, which the sketch's fixtures rely on (ADR-0003).
 * @param outline - the site's shape
 */
export function allTiles(outline: Outline): TileKey[] {
  const { halfWidth, halfHeight } = extent(outline);
  const span = halfWidth + halfHeight;
  const out: TileKey[] = [];
  for (let r = -halfHeight; r <= halfHeight; r++) {
    for (let q = -span; q <= span; q++) if (onBoard(q, r, outline)) out.push(tileKey(q, r));
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
