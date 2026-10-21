/**
 * @file Layout commands: what a player may do to the board, each answering with an event or a rejection.
 * Public interface: SiteEvent, SiteRejection, Outcome, placeNeighborhood, addRingBuilding, toggleExtra, addPlantUnit,
 * layStretch, erase, openCircle.
 * Owner context: Site (domain).
 *
 * A command never changes the layout it is given; it returns a new one with the event. The sentences the page shows
 * are the Board's wording of these events. Every placing command keeps the band rule (ADR-0016 Decision 2): a plant
 * on a band, a neighborhood or ring inside one, nothing outside every circle; `erase` takes anything down. `openCircle`
 * lays out another circle: ground, not a piece, open the moment it answers (ADR-0016 Decisions 1 and 3).
 */
import { adjacent, edgeEnds, edgeKey, onBoard, tileAt } from './board.ts';
import type { EdgeKey, TileKey } from './board.ts';
import { bandRule, circleFits, circleOf, circleTiles } from './circle.ts';
import type { Layout, Tile } from './layout.ts';
import type { ExtraKind, PlantKind, SiteRates } from './rates.ts';

/** What a command did. */
export type SiteEvent =
  | { readonly type: 'NeighborhoodPlaced'; readonly tile: TileKey }
  | { readonly type: 'RingStarted'; readonly tile: TileKey }
  | { readonly type: 'RingBuildingAdded'; readonly tile: TileKey; readonly buildings: number }
  | { readonly type: 'ExtraAdded'; readonly tile: TileKey; readonly extra: ExtraKind }
  | { readonly type: 'ExtraRemoved'; readonly tile: TileKey; readonly extra: ExtraKind }
  | { readonly type: 'PlantStarted'; readonly tile: TileKey; readonly plant: PlantKind }
  | { readonly type: 'PlantUnitAdded'; readonly tile: TileKey; readonly plant: PlantKind; readonly units: number }
  | { readonly type: 'StretchLaid'; readonly edge: EdgeKey }
  | { readonly type: 'StretchRemoved'; readonly edge: EdgeKey }
  | { readonly type: 'LinesThroughTileRemoved'; readonly tile: TileKey; readonly edges: readonly EdgeKey[] }
  | { readonly type: 'UnitRemoved'; readonly tile: TileKey; readonly kind: Tile['kind']; readonly left: number }
  | { readonly type: 'TileCleared'; readonly tile: TileKey; readonly kind: Tile['kind'] }
  /** Another circle laid out on the board, by its middle (ADR-0016 Decision 3). */
  | { readonly type: 'CircleOpened'; readonly middle: TileKey };

/** Why a command refused. */
export type SiteRejection =
  | { readonly reason: 'OffBoard'; readonly tile: TileKey }
  | { readonly reason: 'TileTaken'; readonly tile: TileKey; readonly by: Tile['kind'] }
  | { readonly reason: 'RingFull'; readonly tile: TileKey; readonly most: number }
  | { readonly reason: 'PlantFull'; readonly tile: TileKey; readonly most: number }
  | { readonly reason: 'NotANeighborhood'; readonly tile: TileKey; readonly extra: ExtraKind }
  | { readonly reason: 'SameTile'; readonly tile: TileKey }
  | { readonly reason: 'NotAdjacent'; readonly from: TileKey; readonly to: TileKey }
  | { readonly reason: 'NothingThere'; readonly tile: TileKey }
  /** The tile is on no circle (ADR-0016 Decision 2). */
  | { readonly reason: 'OutsideCircle'; readonly tile: TileKey }
  /** A plant may stand only on a circle's band. */
  | { readonly reason: 'OutsideBand'; readonly tile: TileKey }
  /** A neighborhood or ring may stand only inside a circle's band. */
  | { readonly reason: 'InsideBand'; readonly tile: TileKey }
  /** A circle at this middle would take a tile (`shared`) that is already another circle's. */
  | { readonly reason: 'CircleOverlaps'; readonly tile: TileKey; readonly shared: TileKey };

/** A command's answer. */
export type Outcome =
  | { readonly ok: true; readonly layout: Layout; readonly event: SiteEvent }
  | { readonly ok: false; readonly rejection: SiteRejection };

function accept(layout: Layout, event: SiteEvent): Outcome {
  return { ok: true, layout, event };
}

function refuse(rejection: SiteRejection): Outcome {
  return { ok: false, rejection };
}

function withTile(layout: Layout, key: TileKey, tile: Tile): Layout {
  return { ...layout, tiles: { ...layout.tiles, [key]: tile } };
}

function offBoard(key: TileKey, rates: SiteRates): boolean {
  const [q, r] = tileAt(key);
  return Number.isNaN(q) || Number.isNaN(r) || !onBoard(q, r, rates.outline);
}

/** The band rule's rejection for a tile, or null when the tile may hold the piece. */
function banded(layout: Layout, key: TileKey, piece: 'plant' | 'home' | 'line'): SiteRejection | null {
  const verdict = bandRule(layout.circles, key, piece);
  return verdict ? { reason: verdict, tile: key } : null;
}

/**
 * Place a neighborhood on open ground inside a circle's band.
 * @returns NeighborhoodPlaced, or OffBoard, OutsideCircle, InsideBand or TileTaken
 */
export function placeNeighborhood(layout: Layout, key: TileKey, rates: SiteRates): Outcome {
  if (offBoard(key, rates)) return refuse({ reason: 'OffBoard', tile: key });
  const band = banded(layout, key, 'home');
  if (band) return refuse(band);
  const t = layout.tiles[key];
  if (t) return refuse({ reason: 'TileTaken', tile: key, by: t.kind });
  return accept(withTile(layout, key, { kind: 'hood', has: {} }), { type: 'NeighborhoodPlaced', tile: key });
}

/**
 * Start a ring on open ground inside a circle's band, or add a building to one.
 * @returns RingStarted or RingBuildingAdded, or OffBoard, OutsideCircle, InsideBand, TileTaken or RingFull
 */
export function addRingBuilding(layout: Layout, key: TileKey, rates: SiteRates): Outcome {
  if (offBoard(key, rates)) return refuse({ reason: 'OffBoard', tile: key });
  const band = banded(layout, key, 'home');
  if (band) return refuse(band);
  const t = layout.tiles[key];
  if (!t) return accept(withTile(layout, key, { kind: 'ring', n: 1 }), { type: 'RingStarted', tile: key });
  if (t.kind !== 'ring') return refuse({ reason: 'TileTaken', tile: key, by: t.kind });
  if (t.n >= rates.ringMax) return refuse({ reason: 'RingFull', tile: key, most: rates.ringMax });
  return accept(withTile(layout, key, { kind: 'ring', n: t.n + 1 }), {
    type: 'RingBuildingAdded',
    tile: key,
    buildings: t.n + 1,
  });
}

/**
 * Add a school or playing fields to a neighborhood, or remove them if it has them.
 * @returns ExtraAdded or ExtraRemoved, or OffBoard, OutsideCircle, InsideBand or NotANeighborhood
 */
export function toggleExtra(layout: Layout, key: TileKey, extra: ExtraKind, rates: SiteRates): Outcome {
  if (offBoard(key, rates)) return refuse({ reason: 'OffBoard', tile: key });
  const band = banded(layout, key, 'home');
  if (band) return refuse(band);
  const t = layout.tiles[key];
  if (!t || t.kind !== 'hood') return refuse({ reason: 'NotANeighborhood', tile: key, extra });
  const has: Partial<Record<ExtraKind, true>> = { ...t.has };
  const had = Boolean(has[extra]);
  if (had) delete has[extra];
  else has[extra] = true;
  return accept(
    withTile(layout, key, { kind: 'hood', has }),
    had ? { type: 'ExtraRemoved', tile: key, extra } : { type: 'ExtraAdded', tile: key, extra },
  );
}

/**
 * Start a plant on open ground on a circle's band, or add a module or unit to one of the same kind.
 * @returns PlantStarted or PlantUnitAdded, or OffBoard, OutsideCircle, OutsideBand, TileTaken or PlantFull
 */
export function addPlantUnit(layout: Layout, key: TileKey, plant: PlantKind, rates: SiteRates): Outcome {
  if (offBoard(key, rates)) return refuse({ reason: 'OffBoard', tile: key });
  const band = banded(layout, key, 'plant');
  if (band) return refuse(band);
  const t = layout.tiles[key];
  if (!t) return accept(withTile(layout, key, { kind: plant, n: 1 }), { type: 'PlantStarted', tile: key, plant });
  if (t.kind !== plant) return refuse({ reason: 'TileTaken', tile: key, by: t.kind });
  if (t.n >= rates.plantMax) return refuse({ reason: 'PlantFull', tile: key, most: rates.plantMax });
  return accept(withTile(layout, key, { kind: plant, n: t.n + 1 }), {
    type: 'PlantUnitAdded',
    tile: key,
    plant,
    units: t.n + 1,
  });
}

/**
 * Lay a stretch of mover line between two neighboring tiles in a circle, or remove it if it is there.
 * @returns StretchLaid or StretchRemoved, or OffBoard, OutsideCircle, SameTile or NotAdjacent
 */
export function layStretch(layout: Layout, from: TileKey, to: TileKey, rates: SiteRates): Outcome {
  if (offBoard(from, rates)) return refuse({ reason: 'OffBoard', tile: from });
  if (offBoard(to, rates)) return refuse({ reason: 'OffBoard', tile: to });
  const bandFrom = banded(layout, from, 'line');
  if (bandFrom) return refuse(bandFrom);
  const bandTo = banded(layout, to, 'line');
  if (bandTo) return refuse(bandTo);
  if (from === to) return refuse({ reason: 'SameTile', tile: to });
  if (!adjacent(from, to, rates.outline)) return refuse({ reason: 'NotAdjacent', from, to });
  const e = edgeKey(from, to);
  const lines: Record<EdgeKey, true> = { ...layout.lines };
  if (lines[e]) {
    delete lines[e];
    return accept({ ...layout, lines }, { type: 'StretchRemoved', edge: e });
  }
  lines[e] = true;
  return accept({ ...layout, lines }, { type: 'StretchLaid', edge: e });
}

/**
 * Open another circle on the board, with its middle for a ring, three rings of homes and a band (ADR-0016 Decision 3).
 * A circle is ground, not a piece: no crew, no years, no price; it is open the moment this answers.
 * @returns CircleOpened, or OffBoard when the middle is off the board or the circle's band would leave it, or
 * CircleOverlaps when a tile of it is already another circle's
 */
export function openCircle(layout: Layout, middle: TileKey, rates: SiteRates): Outcome {
  if (offBoard(middle, rates) || !circleFits(middle, rates.outline)) return refuse({ reason: 'OffBoard', tile: middle });
  const circles = layout.circles ?? [];
  const shared = circleTiles(middle).find((k) => circleOf(circles, k) !== null);
  if (shared !== undefined) return refuse({ reason: 'CircleOverlaps', tile: middle, shared });
  return accept({ ...layout, circles: [...circles, middle] }, { type: 'CircleOpened', middle });
}

/**
 * Erase at a tile: the line through open ground, one unit of a ring or plant, or the whole tile.
 * @returns LinesThroughTileRemoved, UnitRemoved or TileCleared, or OffBoard or NothingThere
 */
export function erase(layout: Layout, key: TileKey, rates: SiteRates): Outcome {
  if (offBoard(key, rates)) return refuse({ reason: 'OffBoard', tile: key });
  const t = layout.tiles[key];
  if (!t) {
    const touching = Object.keys(layout.lines).filter((e) => edgeEnds(e).includes(key));
    if (!touching.length) return refuse({ reason: 'NothingThere', tile: key });
    const lines: Record<EdgeKey, true> = { ...layout.lines };
    for (const e of touching) delete lines[e];
    return accept({ ...layout, lines }, { type: 'LinesThroughTileRemoved', tile: key, edges: touching });
  }
  if (t.kind !== 'hood' && t.n > 1) {
    const fewer: Tile = t.kind === 'ring' ? { kind: 'ring', n: t.n - 1 } : { kind: t.kind, n: t.n - 1 };
    return accept(withTile(layout, key, fewer), { type: 'UnitRemoved', tile: key, kind: t.kind, left: t.n - 1 });
  }
  const tiles: Record<TileKey, Tile> = { ...layout.tiles };
  delete tiles[key];
  return accept({ ...layout, tiles }, { type: 'TileCleared', tile: key, kind: t.kind });
}
