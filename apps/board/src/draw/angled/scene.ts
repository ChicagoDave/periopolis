/**
 * @file The scene: what the angled view paints, derived from the layout and the Ground's plans. Every neighborhood,
 * ring building and plant becomes a block on the site in metres, with its stories; every stretch of mover line a
 * flat strip. Far, a neighborhood is one block the size of its tile; mid, its rows of townhouses. On a clock, a tile
 * the crews are building is a low scaffold, a stretch on order a strip of its own kind, and every home block carries
 * how lit it is, the share of its people living there (ADR-0009, ADR-0012); mid, that share lights whole rows, in an
 * order seeded from the tile's key so the same share lights the same rows. Pure, no DOM; it decides no shape
 * itself, only where the Ground's shapes sit on the site (ADR-0014).
 * Public interface: Lod, SceneKind, SceneBlock, Scene, Standing, PLANT_STORIES, LINE_WIDTH_M, SITE_HEIGHT_M,
 * tileCenterM, litRows, sceneOf.
 * Owner context: Board (adapter), the angled view (plan angled-view-through-time).
 */
import { hexFrame, planNeighborhood, planRing } from '@city/ground';
import type { NeighborhoodPlan, Point, RingPlan } from '@city/ground';
import type { JobItem, SiteInHand } from '@city/run';
import { edgeEnds, tileAt } from '@city/site';
import type { EdgeKey, Layout, SiteRates, Tile, TileKey } from '@city/site';
import { STORY_M } from './extrude.ts';
import type { Block } from './extrude.ts';

/** How much detail: far is one block a tile, mid is the rows of townhouses and each ring building. */
export type Lod = 'far' | 'mid';

/** What a block is: what stands, a stretch of line, a tile under construction, a stretch under construction. */
export type SceneKind = Tile['kind'] | 'line' | 'site' | 'siteline';

/** The height of a scaffold on a tile the crews are building, metres: half a story. */
export const SITE_HEIGHT_M = STORY_M / 2;

/** What the clock says about the site: the tiles and stretches on order, and who lives in each neighborhood. */
export interface Standing {
  /** Open tiles that jobs will build on (`WorkInHand.sites`). */
  readonly sites?: Readonly<Record<TileKey, SiteInHand>>;
  /** Stretches of line on order (`WorkInHand.lines`). */
  readonly lines?: Readonly<Record<EdgeKey, JobItem>>;
  /** People in each neighborhood; absent or null, every neighborhood is full. */
  readonly occupied?: Readonly<Record<TileKey, number>> | null;
}

/** Stories a plant's works rise (Mine: the ledger prices units, not their height). */
export const PLANT_STORIES = 2;

/** The width of a stretch of mover line on the ground, metres (Mine: a twin-track guideway with its margins). */
export const LINE_WIDTH_M = 24;

/** One thing to paint, placed on the site. */
export interface SceneBlock {
  readonly key: TileKey;
  readonly kind: SceneKind;
  /** Stories the block rises; 0 for a strip on the ground or a scaffold. */
  readonly stories: number;
  /** How lit, 0 to 1: a home block's share of people living there; 1 for everything else. */
  readonly lit: number;
  readonly block: Block;
}

/** The whole scene, and the sums a test can hold it to. */
export interface Scene {
  readonly lod: Lod;
  readonly blocks: readonly SceneBlock[];
  /** Stories over every block. */
  readonly stories: number;
  /** Tiles under construction. */
  readonly sites: number;
  /** The homes' lit share, 0 to 1: the mean over the home blocks; 1 with no homes. */
  readonly lit: number;
}

/** A tile's middle on the site, metres: the map's hex lattice at the Ledger's tile radius. */
export function tileCenterM(key: TileKey, rates: SiteRates): Point {
  const [q, r] = tileAt(key);
  const radius = rates.tileKm * 1000;
  return { x: Math.sqrt(3) * radius * (q + r / 2), y: 1.5 * radius * r };
}

const shifted = (corners: readonly Point[], by: Point): Point[] => corners.map((c) => ({ x: c.x + by.x, y: c.y + by.y }));

/** A hexagon the size of a tile, drawn in a little from its edges so neighbours read apart. */
function tileHex(center: Point, rates: SiteRates, inset = 0.94): Point[] {
  return shifted(hexFrame(rates.tileKm * 1000 * inset).corners, center);
}

/** A small deterministic hash of a tile's key, for seeding the order rows light in. */
function seedOf(key: TileKey): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0;
  return h || 1;
}

/**
 * Which of a neighborhood's rows are lit for a share of its people: so many rows as the share rounds to, in an order
 * seeded from the tile's key, so the same share on the same tile lights the same rows and a growing share only adds.
 * @param key - the tile
 * @param rows - how many rows the neighborhood has
 * @param share - people living there over the homes as built, 0 to 1
 * @returns one flag a row, true for lit
 */
export function litRows(key: TileKey, rows: number, share: number): boolean[] {
  const n = Math.max(0, Math.min(rows, Math.round(Math.max(0, Math.min(1, share)) * rows)));
  const order = Array.from({ length: rows }, (_, i) => i);
  let x = seedOf(key);
  for (let i = rows - 1; i > 0; i--) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    const j = x % (i + 1);
    const t = order[i] as number;
    order[i] = order[j] as number;
    order[j] = t;
  }
  const lit = Array.from({ length: rows }, () => false);
  for (let i = 0; i < n; i++) lit[order[i] as number] = true;
  return lit;
}

function neighborhoodBlocks(key: TileKey, center: Point, plan: NeighborhoodPlan, rates: SiteRates, lod: Lod, share: number): SceneBlock[] {
  const stories = plan.surface.rows[0]?.stories ?? 0;
  if (lod === 'far') return [{ key, kind: 'hood', stories, lit: share, block: { corners: tileHex(center, rates), heightM: stories * STORY_M } }];
  const depth = plan.figures.rowDepthM;
  const lit = litRows(key, plan.surface.rows.length, share);
  return plan.surface.rows.map((row, i) => ({
    key,
    kind: 'hood',
    stories: row.stories,
    lit: lit[i] ? 1 : 0,
    block: {
      corners: shifted(
        [
          { x: row.x0, y: row.y - depth / 2 },
          { x: row.x1, y: row.y - depth / 2 },
          { x: row.x1, y: row.y + depth / 2 },
          { x: row.x0, y: row.y + depth / 2 },
        ],
        center,
      ),
      heightM: row.stories * STORY_M,
    },
  }));
}

function ringBlocks(key: TileKey, center: Point, plan: RingPlan): SceneBlock[] {
  return plan.surface.buildings.map((b) => ({
    key,
    kind: 'ring',
    stories: b.stories,
    lit: 1,
    block: { corners: shifted(b.corners, center), heightM: b.stories * STORY_M },
  }));
}

function plantBlock(key: TileKey, kind: Tile['kind'], center: Point, rates: SiteRates): SceneBlock {
  return { key, kind, stories: PLANT_STORIES, lit: 1, block: { corners: tileHex(center, rates, 0.6), heightM: PLANT_STORIES * STORY_M } };
}

/** A tile the crews are building: a low scaffold on the tile, no stories yet. */
function siteBlock(key: TileKey, center: Point, rates: SiteRates): SceneBlock {
  return { key, kind: 'site', stories: 0, lit: 1, block: { corners: tileHex(center, rates, 0.8), heightM: SITE_HEIGHT_M } };
}

/** A stretch of line as a flat strip between two tile middles; on order, a strip of its own kind. */
function lineStrip(edge: string, rates: SiteRates, kind: 'line' | 'siteline' = 'line'): SceneBlock {
  const [a, b] = edgeEnds(edge);
  const from = tileCenterM(a, rates);
  const to = tileCenterM(b, rates);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (LINE_WIDTH_M / 2);
  const ny = (dx / len) * (LINE_WIDTH_M / 2);
  return {
    key: a,
    kind,
    stories: 0,
    lit: 1,
    block: {
      corners: [
        { x: from.x + nx, y: from.y + ny },
        { x: to.x + nx, y: to.y + ny },
        { x: to.x - nx, y: to.y - ny },
        { x: from.x - nx, y: from.y - ny },
      ],
      heightM: 0,
    },
  };
}

/**
 * The scene of a layout as it stands, and of the clock's work and people when given: a block for every neighborhood
 * (one far, its rows mid) lit by the share of its people living there, every ring building, every plant, a strip for
 * every stretch of line, a scaffold for every tile on order and a strip of its own kind for every stretch on order;
 * the strips first so they lie under everything, then the board's tile order.
 * @param layout - what stands
 * @param rates - the Site's rates: the tile radius, the homes a tile, and the Ground's premises
 * @param lod - far or mid
 * @param standing - the clock's work in hand and occupancy; absent, nothing is on order and every home is lit
 */
export function sceneOf(layout: Layout, rates: SiteRates, lod: Lod, standing: Standing = {}): Scene {
  const blocks: SceneBlock[] = [];
  for (const edge of Object.keys(layout.lines)) blocks.push(lineStrip(edge, rates));
  for (const edge of Object.keys(standing.lines ?? {})) if (!layout.lines[edge]) blocks.push(lineStrip(edge, rates, 'siteline'));
  const hood = planNeighborhood(rates.shared, rates.walking, rates.base);
  const rings: Record<number, RingPlan> = {};
  for (const key of Object.keys(layout.tiles)) {
    const t = layout.tiles[key];
    if (!t) continue;
    const center = tileCenterM(key, rates);
    if (t.kind === 'hood') {
      const people = standing.occupied?.[key];
      const share = people === undefined || !(rates.hood > 0) ? 1 : Math.max(0, Math.min(1, people / rates.hood));
      blocks.push(...neighborhoodBlocks(key, center, hood, rates, lod, share));
    } else if (t.kind === 'ring') {
      const plan = (rings[t.n] ??= planRing(rates.walking, rates.base, t.n));
      blocks.push(...ringBlocks(key, center, plan));
    } else blocks.push(plantBlock(key, t.kind, center, rates));
  }
  let sites = 0;
  for (const key of Object.keys(standing.sites ?? {})) {
    if (layout.tiles[key]) continue;
    blocks.push(siteBlock(key, tileCenterM(key, rates), rates));
    sites++;
  }
  const homes = blocks.filter((b) => b.kind === 'hood');
  const lit = homes.length ? homes.reduce((t, b) => t + b.lit, 0) / homes.length : 1;
  return { lod, blocks, stories: blocks.reduce((t, b) => t + b.stories, 0), sites, lit };
}
