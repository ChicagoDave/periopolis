/**
 * @file A layout: what stands on each tile and where the mover line runs. Values only; commands make new ones.
 * Public interface: Neighborhood, Ring, Plant, Tile, Layout, emptyLayout, starterLayout, restoreLayout.
 * Owner context: Site (domain).
 */
import { adjacent, allTiles, edgeEnds, edgeKey, tileKey } from './board.ts';
import type { EdgeKey, TileKey } from './board.ts';
import { EXTRAS, PLANTS } from './rates.ts';
import type { ExtraKind, PlantKind, SiteRates } from './rates.ts';

/** A neighborhood: one tile's worth of people, and what it holds beside its homes. */
export interface Neighborhood {
  readonly kind: 'hood';
  readonly has: Readonly<Partial<Record<ExtraKind, true>>>;
}

/** A ring: so many 25-story buildings. */
export interface Ring {
  readonly kind: 'ring';
  readonly n: number;
}

/** A plant at the edge: so many modules or units. */
export interface Plant {
  readonly kind: PlantKind;
  readonly n: number;
}

/** What a tile holds. */
export type Tile = Neighborhood | Ring | Plant;

/** The board as it stands. */
export interface Layout {
  readonly tiles: Readonly<Record<TileKey, Tile>>;
  readonly lines: Readonly<Record<EdgeKey, true>>;
}

/** An empty site. */
export function emptyLayout(): Layout {
  return { tiles: {}, lines: {} };
}

/** Whether a kind is one of the plants. */
export function isPlantKind(kind: string): kind is PlantKind {
  return (PLANTS as readonly string[]).includes(kind);
}

/**
 * The ledger's city of 50,000, laid out: a ring, ten neighborhoods, their schools, the line and the plants.
 */
export function starterLayout(): Layout {
  const tiles: Record<TileKey, Tile> = {};
  const lines: Record<EdgeKey, true> = {};
  const hood = (q: number, r: number, ...has: ExtraKind[]): void => {
    const held: Partial<Record<ExtraKind, true>> = {};
    for (const h of has) held[h] = true;
    tiles[tileKey(q, r)] = { kind: 'hood', has: held };
  };
  const line = (a: readonly [number, number], b: readonly [number, number]): void => {
    lines[edgeKey(tileKey(a[0], a[1]), tileKey(b[0], b[1]))] = true;
  };
  tiles[tileKey(0, 0)] = { kind: 'ring', n: 8 };
  hood(1, 0, 'elementary', 'middle');
  hood(0, 1, 'elementary');
  hood(-1, 1, 'elementary', 'middle');
  hood(-1, 0, 'elementary');
  hood(0, -1, 'elementary', 'middle');
  hood(1, -1);
  hood(2, -1, 'elementary', 'high', 'fields');
  hood(1, 1, 'elementary');
  hood(-2, 1, 'elementary', 'high', 'fields');
  hood(-1, -1, 'elementary');
  for (const [q, r] of [
    [1, 0],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [0, -1],
    [1, -1],
  ] as const) {
    line([0, 0], [q, r]);
  }
  line([1, 0], [2, -1]);
  line([0, 1], [1, 1]);
  line([-1, 1], [-2, 1]);
  line([-1, 0], [-1, -1]);
  tiles[tileKey(3, -1)] = { kind: 'power', n: 3 };
  tiles[tileKey(3, -2)] = { kind: 'water', n: 1 };
  tiles[tileKey(-3, 1)] = { kind: 'sewage', n: 1 };
  tiles[tileKey(-3, 2)] = { kind: 'waste', n: 1 };
  line([2, -1], [3, -1]);
  line([2, -1], [3, -2]);
  line([-2, 1], [-3, 1]);
  line([-2, 1], [-3, 2]);
  return { tiles, lines };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Rebuild a layout from anything, keeping only what the board allows. Anything loaded from storage comes through here.
 * @param raw - whatever was stored
 * @param rates - the site's outline and limits
 * @returns a layout, or null when the input is not even an object
 */
export function restoreLayout(raw: unknown, rates: SiteRates): Layout | null {
  if (!isRecord(raw)) return null;
  const tiles: Record<TileKey, Tile> = {};
  const lines: Record<EdgeKey, true> = {};
  const rawTiles = isRecord(raw['tiles']) ? raw['tiles'] : {};
  const rawLines = isRecord(raw['lines']) ? raw['lines'] : {};
  const valid = allTiles(rates.outline);
  for (const k of Object.keys(rawTiles)) {
    const t = rawTiles[k];
    if (!valid.includes(k) || !isRecord(t)) continue;
    const kind = t['kind'];
    if (kind === 'hood') {
      const has: Partial<Record<ExtraKind, true>> = {};
      const rawHas = t['has'];
      if (isRecord(rawHas)) for (const x of EXTRAS) if (rawHas[x]) has[x] = true;
      tiles[k] = { kind: 'hood', has };
    } else if (kind === 'ring' || (typeof kind === 'string' && isPlantKind(kind))) {
      const most = kind === 'ring' ? rates.ringMax : rates.plantMax;
      const n = Math.max(1, Math.min(most, Math.round(Number(t['n']) || 1)));
      tiles[k] = kind === 'ring' ? { kind, n } : { kind, n };
    }
  }
  for (const e of Object.keys(rawLines)) {
    if (e.indexOf('|') < 0) continue;
    const [a, b] = edgeEnds(e);
    if (valid.includes(a) && valid.includes(b) && adjacent(a, b, rates.outline)) lines[edgeKey(a, b)] = true;
  }
  return { tiles, lines };
}
