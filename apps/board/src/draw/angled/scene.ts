/**
 * @file The scene: what the angled view paints, derived from the layout and the Ground's plans. Every neighborhood,
 * ring building and plant becomes a block on the site in metres, with its stories; every stretch of mover line a
 * flat strip. Far, a neighborhood is one block the size of its tile; mid, its rows of townhouses. Pure, no DOM; it
 * decides no shape itself, only where the Ground's shapes sit on the site.
 * Public interface: Lod, SceneKind, SceneBlock, Scene, PLANT_STORIES, LINE_WIDTH_M, tileCenterM, sceneOf.
 * Owner context: Board (adapter), the angled view (plan angled-view-through-time).
 */
import { hexFrame, planNeighborhood, planRing } from '@city/ground';
import type { NeighborhoodPlan, Point, RingPlan } from '@city/ground';
import { edgeEnds, tileAt } from '@city/site';
import type { Layout, SiteRates, Tile, TileKey } from '@city/site';
import { STORY_M } from './extrude.ts';
import type { Block } from './extrude.ts';

/** How much detail: far is one block a tile, mid is the rows of townhouses and each ring building. */
export type Lod = 'far' | 'mid';

/** What a block is. */
export type SceneKind = Tile['kind'] | 'line';

/** Stories a plant's works rise (Mine: the ledger prices units, not their height). */
export const PLANT_STORIES = 2;

/** The width of a stretch of mover line on the ground, metres (Mine: a twin-track guideway with its margins). */
export const LINE_WIDTH_M = 24;

/** One thing to paint, placed on the site. */
export interface SceneBlock {
  readonly key: TileKey;
  readonly kind: SceneKind;
  /** Stories the block rises; 0 for a strip on the ground. */
  readonly stories: number;
  readonly block: Block;
}

/** The whole scene, and the sums a test can hold it to. */
export interface Scene {
  readonly lod: Lod;
  readonly blocks: readonly SceneBlock[];
  /** Stories over every block. */
  readonly stories: number;
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

function neighborhoodBlocks(key: TileKey, center: Point, plan: NeighborhoodPlan, rates: SiteRates, lod: Lod): SceneBlock[] {
  const stories = plan.surface.rows[0]?.stories ?? 0;
  if (lod === 'far') return [{ key, kind: 'hood', stories, block: { corners: tileHex(center, rates), heightM: stories * STORY_M } }];
  const depth = plan.figures.rowDepthM;
  return plan.surface.rows.map((row) => ({
    key,
    kind: 'hood',
    stories: row.stories,
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
    block: { corners: shifted(b.corners, center), heightM: b.stories * STORY_M },
  }));
}

function plantBlock(key: TileKey, kind: Tile['kind'], center: Point, rates: SiteRates): SceneBlock {
  return { key, kind, stories: PLANT_STORIES, block: { corners: tileHex(center, rates, 0.6), heightM: PLANT_STORIES * STORY_M } };
}

/** A stretch of line as a flat strip between two tile middles. */
function lineStrip(edge: string, rates: SiteRates): SceneBlock {
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
    kind: 'line',
    stories: 0,
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
 * The scene of a layout as it stands: a block for every neighborhood (one far, its rows mid), every ring building,
 * every plant, and a strip for every stretch of line, in the board's tile order with the strips first so they lie
 * under everything.
 * @param layout - what stands
 * @param rates - the Site's rates: the tile radius and the Ground's premises
 * @param lod - far or mid
 */
export function sceneOf(layout: Layout, rates: SiteRates, lod: Lod): Scene {
  const blocks: SceneBlock[] = [];
  for (const edge of Object.keys(layout.lines)) blocks.push(lineStrip(edge, rates));
  const hood = planNeighborhood(rates.shared, rates.walking, rates.base);
  const rings: Record<number, RingPlan> = {};
  for (const key of Object.keys(layout.tiles)) {
    const t = layout.tiles[key];
    if (!t) continue;
    const center = tileCenterM(key, rates);
    if (t.kind === 'hood') blocks.push(...neighborhoodBlocks(key, center, hood, rates, lod));
    else if (t.kind === 'ring') {
      const plan = (rings[t.n] ??= planRing(rates.walking, rates.base, t.n));
      blocks.push(...ringBlocks(key, center, plan));
    } else blocks.push(plantBlock(key, t.kind, center, rates));
  }
  return { lod, blocks, stories: blocks.reduce((t, b) => t + b.stories, 0) };
}
