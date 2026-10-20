/**
 * @file A circle: a central ring tile, three hex rings of homes within the walk, and a fourth, the band, where the
 * plants stand (ADR-0016). Circles are values laid out on the rectangular board along the shore; a tile outside every
 * circle is open to nothing.
 * Public interface: HOME_RINGS, BAND_RING, circleTiles, hexRing, bandOf, circleOf, inBand, circleFits, shoreTiles,
 * bandRule, upstreamOf.
 *
 * The band rule (ADR-0016 Decision 2) is read off a layout's circles: a plant stands on a band, a neighborhood or ring
 * inside one, and nothing outside every circle. A layout with no circles at all, which only the sketch's recorded
 * fixtures carry (ADR-0003), is the sketch's free board and the rule is silent on it.
 * Owner context: Site (domain).
 */
import { allTiles, eastWest, extent, onBoard, ringDistance, tileAt, tileKey } from './board.ts';
import type { Outline, TileKey } from './board.ts';

/** Hex rings of homes round a circle's ring: 1 to 3, every tile within the 30-minute walk of the ring. */
export const HOME_RINGS = 3;
/** The hex ring that is the band: the fourth, 24 tiles, where the plants stand. */
export const BAND_RING = 4;

/**
 * The tiles of one hex ring round a middle, whether or not they are on a board.
 * @param middle - the circle's middle
 * @param k - which ring; 0 is the middle itself
 * @returns the tiles, in the board's row order
 */
export function hexRing(middle: TileKey, k: number): TileKey[] {
  const [mq, mr] = tileAt(middle);
  const out: TileKey[] = [];
  for (let r = -k; r <= k; r++) {
    for (let q = -k; q <= k; q++) {
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) === k) out.push(tileKey(mq + q, mr + r));
    }
  }
  return out;
}

/**
 * Every tile of a circle: its middle, its home rings and its band.
 * @param middle - the circle's middle
 */
export function circleTiles(middle: TileKey): TileKey[] {
  const out: TileKey[] = [];
  for (let k = 0; k <= BAND_RING; k++) out.push(...hexRing(middle, k));
  return out;
}

/** The band tiles of a circle. */
export function bandOf(middle: TileKey): TileKey[] {
  return hexRing(middle, BAND_RING);
}

/**
 * Which circle a tile is in: the middle of the first circle, in the layout's order, whose rings reach it; null when
 * no circle does.
 * @param circles - the circles' middles
 * @param key - the tile
 */
export function circleOf(circles: readonly TileKey[], key: TileKey): TileKey | null {
  for (const m of circles) if (ringDistance(m, key) <= BAND_RING) return m;
  return null;
}

/** Whether a tile is on the band of the circle it is in. */
export function inBand(circles: readonly TileKey[], key: TileKey): boolean {
  const m = circleOf(circles, key);
  return m !== null && ringDistance(m, key) === BAND_RING;
}

/**
 * Whether a circle at a middle would lie wholly on the board.
 * @param middle - the circle's middle
 * @param outline - the site's shape
 */
export function circleFits(middle: TileKey, outline: Outline): boolean {
  return circleTiles(middle).every((k) => {
    const [q, r] = tileAt(k);
    return onBoard(q, r, outline);
  });
}

/** What the band rule says of a tile for a kind of piece: nothing, or the rejection it earns. */
export type BandVerdict = 'OutsideCircle' | 'OutsideBand' | 'InsideBand' | null;

/**
 * The band rule for one tile (ADR-0016 Decision 2): a plant goes on a band, a neighborhood or ring inside one, a
 * stretch's ends anywhere in a circle; a tile outside every circle takes nothing. Silent when the layout has no circles.
 * @param circles - the layout's circles' middles
 * @param key - the tile
 * @param piece - what would stand there: a plant, a home or ring, or a stretch's end
 */
export function bandRule(circles: readonly TileKey[] | undefined, key: TileKey, piece: 'plant' | 'home' | 'line'): BandVerdict {
  if (!circles || !circles.length) return null;
  const m = circleOf(circles, key);
  if (m === null) return 'OutsideCircle';
  const band = ringDistance(m, key) === BAND_RING;
  if (piece === 'plant') return band ? null : 'OutsideBand';
  if (piece === 'home') return band ? 'InsideBand' : null;
  return null;
}

/**
 * Whether one tile is strictly upstream of another along the shore: before it in the direction the current runs,
 * read off the tiles' east-west positions (line 32; ADR-0016 Decision 5).
 * @param a - the tile that would be upstream
 * @param b - the other
 * @param current - +1 when the current runs east, -1 when west
 */
export function upstreamOf(a: TileKey, b: TileKey, current: 1 | -1): boolean {
  return (eastWest(b) - eastWest(a)) * current > 1e-9;
}

/**
 * A circle's band tiles on the shore: those on the board's south row (line 30; ADR-0016 Decision 5).
 * @param middle - the circle's middle
 * @param outline - the site's shape, whose south edge is the shore
 */
export function shoreTiles(middle: TileKey, outline: Outline): TileKey[] {
  const south = extent(outline).south;
  return bandOf(middle).filter((k) => tileAt(k)[1] === south && allTiles(outline).includes(k));
}
