/**
 * @file The board: a hexagon of hexagonal tiles, named "q,r", and the distances between them.
 * Public interface: TileKey, EdgeKey, tileKey, tileAt, onBoard, allTiles, neighbors, adjacent, kmBetween, edgeKey, edgeEnds.
 * Owner context: Site (domain).
 *
 * Tiles are named by two whole numbers, "q,r": q counts east, r counts down and to the right. A stretch of mover line
 * between two neighboring tiles is named "a|b" with the lesser key first. Keys are parsed by walking them, never
 * by pattern (ADR-0002).
 */

/** A tile's name, "q,r". */
export type TileKey = string;
/** A stretch of mover line, "q,r|q,r", lesser key first. */
export type EdgeKey = string;

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
 * Whether a tile lies on a board of the given size.
 * @param q - column
 * @param r - row
 * @param board - tiles from the middle to the edge
 */
export function onBoard(q: number, r: number, board: number): boolean {
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= board;
}

/**
 * Every tile of the board, row by row.
 * @param board - tiles from the middle to the edge
 */
export function allTiles(board: number): TileKey[] {
  const out: TileKey[] = [];
  for (let r = -board; r <= board; r++) {
    for (let q = -board; q <= board; q++) if (onBoard(q, r, board)) out.push(tileKey(q, r));
  }
  return out;
}

/**
 * The tiles next to one, on the board.
 * @param key - the tile
 * @param board - tiles from the middle to the edge
 */
export function neighbors(key: TileKey, board: number): TileKey[] {
  const [q, r] = tileAt(key);
  const out: TileKey[] = [];
  for (const [dq, dr] of DIRECTIONS) {
    if (onBoard(q + dq, r + dr, board)) out.push(tileKey(q + dq, r + dr));
  }
  return out;
}

/** Whether two tiles are next to each other on the board. */
export function adjacent(a: TileKey, b: TileKey, board: number): boolean {
  return neighbors(a, board).includes(b);
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
