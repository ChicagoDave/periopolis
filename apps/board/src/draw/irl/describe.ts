/**
 * @file What the IRL view builds, described: the derived scene chunked by tile, every block a prism (a top fan and
 * an outward side for every edge, with metre UVs and a material) except a home at near detail, which is an instance
 * of one townhouse (its place, which way it faces, its material variant seeded from the tile's key, and whether it
 * is lit); with the Ground's plans, a neighborhood's park and center as discs, its bike lane as paths, trees seeded
 * into the park, the ring's plaza, a scaffold and a crane on a tile under construction, and a survey strip for a
 * stretch on order. Each chunk carries a signature so the adapter rebuilds only the tiles that changed. Pure, no
 * DOM, no three.js: the same scene describes byte for byte the same (ADR-0023 Decisions 2 and 3). A chunk is
 * remembered by its signature, so a tile that did not change is handed back, not described again.
 * Public interface: Prism, MaterialId, MeshRecord, HomeInstance, Tree, Chunk, Described, DescribeContext,
 * FLAT_LIFT_M, HOME_TRIANGLES, TREE_SPACING_M, prismOf, describeScene.
 * Owner context: Board (adapter), the IRL view (plan irl-3d-city-view, ADR-0023).
 */
import { planNeighborhood, planRing } from '@city/ground';
import type { Disc, Point, RingPlan, Segment } from '@city/ground';
import type { Layout, SiteRates, TileKey } from '@city/site';
import type { GroundPoint } from '../angled/projection.ts';
import { tileCenterM } from '../angled/scene.ts';
import type { Scene, SceneBlock, SceneKind } from '../angled/scene.ts';
import { boundsOf } from './camera.ts';
import type { Bounds } from './camera.ts';
import { hashOf, randomOf, variantOf } from './facade.ts';
import type { HomeVariant } from './facade.ts';

/** Metres a flat block (a strip of line) is lifted off the ground, so it draws over it and not through it. */
export const FLAT_LIFT_M = 0.3;

/** Triangles in one instanced townhouse: four walls of a box, two roof slopes and two gables. */
export const HOME_TRIANGLES = 14;

/** Metres between trees in a park, one a square of this side (Mine). */
export const TREE_SPACING_M = 20;

/** What a prism is made of: the adapter has a material for each. */
export type MaterialId = 'massing' | 'office' | 'plant' | 'strip' | 'survey' | 'scaffold' | 'crane' | 'park' | 'plaza' | 'path';

/** A prism's geometry: positions and normals three a vertex and UVs two a vertex (metres along the face and up), in
 * scene metres (x east, y south, z up), and the triangles as indices into them. */
export interface Prism {
  readonly positions: readonly number[];
  readonly normals: readonly number[];
  readonly uvs: readonly number[];
  readonly indices: readonly number[];
}

/** One block or feature as it is built: what it is, its prism, its material, how lit. */
export interface MeshRecord {
  readonly kind: SceneKind;
  readonly material: MaterialId;
  readonly prism: Prism;
  readonly lit: number;
  /** Triangles in the prism. */
  readonly triangles: number;
  /** The scene block it came from; absent for a feature the Ground's plan adds. */
  readonly block?: SceneBlock;
}

/** One townhouse, instanced: where its middle is, which way its front faces, its size, its material and its light. */
export interface HomeInstance {
  readonly x: number;
  readonly y: number;
  /** Radians the front is turned from facing south (+y): 0 faces south, π faces north. */
  readonly yaw: number;
  readonly frontM: number;
  readonly depthM: number;
  readonly heightM: number;
  readonly variant: HomeVariant;
  /** 1 lived in, 0 empty. */
  readonly lit: 0 | 1;
}

/** One tree in a park: where, and how tall. */
export interface Tree {
  readonly x: number;
  readonly y: number;
  readonly heightM: number;
}

/** One tile's share of the scene, with a signature that changes when any of it does. */
export interface Chunk {
  readonly key: TileKey;
  readonly signature: string;
  readonly meshes: readonly MeshRecord[];
  readonly homes: readonly HomeInstance[];
  readonly trees: readonly Tree[];
}

/** What the describer needs beyond the scene to add the Ground's features: the Site's rates and the layout. */
export interface DescribeContext {
  readonly rates: SiteRates;
  readonly layout: Layout;
}

/** The scene described, and the sums a test can hold it to. */
export interface Described {
  readonly chunks: readonly Chunk[];
  /** Every block's prism, features aside, in the scene's order. */
  readonly meshes: readonly MeshRecord[];
  /** Blocks in the scene. */
  readonly blocks: number;
  /** Stories over every block (the scene's). */
  readonly stories: number;
  /** Tiles under construction (the scene's). */
  readonly sites: number;
  /** The homes' lit share (the scene's). */
  readonly lit: number;
  /** Triangles over every prism, features included; instanced homes apart. */
  readonly triangles: number;
  /** Triangles by kind of block. */
  readonly byKind: Readonly<Partial<Record<SceneKind, number>>>;
  /** Townhouses instanced, and how many of them are lit. */
  readonly homes: number;
  readonly litHomes: number;
  readonly trees: number;
  /** The box round everything; null for an empty scene. */
  readonly bounds: Bounds | null;
}

/** Chunks remembered by signature; cleared when the memory grows past a bound. */
const rememberedChunks = new Map<string, Chunk>();
const REMEMBER_MAX = 2048;

/** A block folded into a running hash: its kind, stories, light and corner count. */
function foldBlock(h: number, block: SceneBlock): number {
  let x = h;
  const fold = (v: number): void => {
    x = Math.imul(x ^ (v | 0), 16777619) >>> 0;
  };
  fold(block.kind.charCodeAt(0) + block.kind.length * 131);
  fold(block.stories);
  fold(Math.round(block.lit * 1000));
  fold(block.block.corners.length);
  fold(Math.round(block.block.heightM * 10));
  return x;
}

/** Twice the signed area of a ground polygon: positive when its corners go counter-clockwise (y up). */
function twiceArea(corners: readonly GroundPoint[]): number {
  let a = 0;
  for (let i = 0; i < corners.length; i++) {
    const p = corners[i] as GroundPoint;
    const q = corners[(i + 1) % corners.length] as GroundPoint;
    a += p.x * q.y - q.x * p.y;
  }
  return a;
}

/**
 * A footprint and a height as a prism: the top as a fan of triangles, and for a height over zero a side for every
 * edge, each face with its own vertices carrying the face's outward normal and UVs in metres. A flat block is its
 * top alone, lifted FLAT_LIFT_M (or the lift given). The footprint must be convex for the fan to be right; every
 * footprint the scene makes is.
 * @param corners - the footprint, metres, in order round it either way
 * @param heightM - metres the block rises, 0 for flat
 * @param lift - metres a flat block is lifted; FLAT_LIFT_M by default
 * @throws RangeError on fewer than three corners or a negative height
 */
export function prismOf(corners: readonly GroundPoint[], heightM: number, lift = FLAT_LIFT_M): Prism {
  if (corners.length < 3) throw new RangeError(`a footprint needs three corners, not ${corners.length}`);
  if (!(heightM >= 0)) throw new RangeError(`height ${heightM} is not a length`);
  const ccw = twiceArea(corners) < 0 ? [...corners].reverse() : [...corners];
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const top = heightM > 0 ? heightM : lift;
  const base = positions.length / 3;
  for (const c of ccw) {
    positions.push(c.x, c.y, top);
    normals.push(0, 0, 1);
    uvs.push(c.x, c.y);
  }
  for (let i = 1; i + 1 < ccw.length; i++) indices.push(base, base + i, base + i + 1);
  if (heightM > 0) {
    for (let i = 0; i < ccw.length; i++) {
      const p = ccw[i] as GroundPoint;
      const q = ccw[(i + 1) % ccw.length] as GroundPoint;
      const ex = q.x - p.x;
      const ey = q.y - p.y;
      const len = Math.hypot(ex, ey);
      if (!(len > 0)) continue;
      const nx = ey / len;
      const ny = -ex / len;
      const at = positions.length / 3;
      positions.push(p.x, p.y, 0, q.x, q.y, 0, q.x, q.y, heightM, p.x, p.y, heightM);
      for (let k = 0; k < 4; k++) normals.push(nx, ny, 0);
      uvs.push(0, 0, len, 0, len, heightM, 0, heightM);
      indices.push(at, at + 1, at + 2, at, at + 2, at + 3);
    }
  }
  return { positions, normals, uvs, indices };
}

/** A disc as a polygon of so many sides, shifted to a tile's middle. */
function discPolygon(disc: Disc, center: Point, sides = 32): GroundPoint[] {
  const out: GroundPoint[] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * 2 * Math.PI;
    out.push({ x: center.x + disc.at.x + disc.radiusM * Math.cos(a), y: center.y + disc.at.y + disc.radiusM * Math.sin(a) });
  }
  return out;
}

/** A segment as a strip so wide, shifted to a tile's middle. */
function stripPolygon(seg: Segment, center: Point, widthM: number): GroundPoint[] {
  const dx = seg.to.x - seg.from.x;
  const dy = seg.to.y - seg.from.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (widthM / 2);
  const ny = (dx / len) * (widthM / 2);
  const from = { x: seg.from.x + center.x, y: seg.from.y + center.y };
  const to = { x: seg.to.x + center.x, y: seg.to.y + center.y };
  return [
    { x: from.x + nx, y: from.y + ny },
    { x: to.x + nx, y: to.y + ny },
    { x: to.x - nx, y: to.y - ny },
    { x: from.x - nx, y: from.y - ny },
  ];
}

/** An axis-aligned box on the ground: its middle, width (x), depth (y). */
function boxPolygon(cx: number, cy: number, w: number, d: number): GroundPoint[] {
  return [
    { x: cx - w / 2, y: cy - d / 2 },
    { x: cx + w / 2, y: cy - d / 2 },
    { x: cx + w / 2, y: cy + d / 2 },
    { x: cx - w / 2, y: cy + d / 2 },
  ];
}

function record(kind: SceneKind, material: MaterialId, prism: Prism, lit: number, block?: SceneBlock): MeshRecord {
  const base = { kind, material, prism, lit, triangles: prism.indices.length / 3 };
  return block ? { ...base, block } : base;
}

/** The material a block is built of: what it is, and whether near enough to see its face. */
function materialOf(block: SceneBlock, near: boolean): MaterialId {
  switch (block.kind) {
    case 'line':
      return 'strip';
    case 'siteline':
      return 'survey';
    case 'site':
      return 'scaffold';
    case 'ring':
      return near ? 'office' : 'massing';
    case 'hood':
      return 'massing';
    default:
      return near ? 'plant' : 'massing';
  }
}

/** Trees seeded into a park: one a TREE_SPACING_M square of its area, placed by the tile's seed inside the disc. */
function treesOf(key: TileKey, park: Disc, center: Point): Tree[] {
  const count = Math.max(0, Math.floor(park.areaM2 / (TREE_SPACING_M * TREE_SPACING_M)));
  const next = randomOf(hashOf(`${key}/trees`));
  const out: Tree[] = [];
  const inner = Math.max(0, park.radiusM - 4);
  while (out.length < count) {
    const x = (next() * 2 - 1) * inner;
    const y = (next() * 2 - 1) * inner;
    if (Math.hypot(x, y) > inner) continue;
    out.push({ x: center.x + park.at.x + x, y: center.y + park.at.y + y, heightM: 5 + next() * 4 });
  }
  return out;
}

/** A length to the centimetre, so rows on one line compare equal. */
const cm = (v: number): number => Math.round(v * 100) / 100;

/** A tile's home blocks at near detail as instances: the rows on one line face the street they share with the next
 * line, lines alternating, so the streets and the back gardens alternate too. */
function homesOf(key: TileKey, blocks: readonly SceneBlock[]): HomeInstance[] {
  const rowYs = [...new Set(blocks.map((b) => cm(((b.block.corners[0]?.y ?? 0) + (b.block.corners[2]?.y ?? 0)) / 2)))].sort((a, b) => a - b);
  const seed = hashOf(key);
  return blocks.map((b, i) => {
    const [c0, c1, c2] = b.block.corners;
    if (!c0 || !c1 || !c2) throw new RangeError(`a home needs four corners`);
    const row = rowYs.indexOf(cm((c0.y + c2.y) / 2));
    return {
      x: (c0.x + c2.x) / 2,
      y: (c0.y + c2.y) / 2,
      yaw: row % 2 === 0 ? Math.PI : 0,
      frontM: Math.hypot(c1.x - c0.x, c1.y - c0.y),
      depthM: Math.hypot(c2.x - c1.x, c2.y - c1.y),
      heightM: b.block.heightM,
      variant: variantOf(seed + i * 2654435761),
      lit: b.lit >= 0.5 ? 1 : 0,
    };
  });
}

/** A scaffold's crane: a post at the tile's middle and a jib across its top. */
function craneOf(center: Point): MeshRecord[] {
  const postH = 45;
  const post = prismOf(boxPolygon(center.x + 60, center.y - 40, 3, 3), postH);
  const jib: Prism = ((): Prism => {
    const p = prismOf(boxPolygon(center.x + 60 + 18, center.y - 40, 40, 2.4), 2);
    return { ...p, positions: p.positions.map((v, i) => (i % 3 === 2 ? v + postH - 2 : v)) };
  })();
  return [record('site', 'crane', post, 1), record('site', 'crane', jib, 1)];
}

/**
 * The scene described, chunked by tile: a prism for every block (homes at near detail instanced instead), the
 * Ground's features when the context is given, the scene's sums carried over, the triangles counted in all and by
 * kind, and the box round everything.
 * @param scene - the derived scene (`sceneOf`), never kept
 * @param context - the Site's rates and the layout, for the Ground's plans; absent, blocks alone are described
 */
export function describeScene(scene: Scene, context?: DescribeContext): Described {
  const near = scene.lod !== 'far';
  const byTile = new Map<TileKey, SceneBlock[]>();
  for (const block of scene.blocks) {
    const list = byTile.get(block.key);
    if (list) list.push(block);
    else byTile.set(block.key, [block]);
  }
  const hoodPlan = context && near ? planNeighborhood(context.rates.shared, context.rates.walking, context.rates.base) : null;
  const rings: Record<number, RingPlan> = {};
  const chunks: Chunk[] = [];
  const meshes: MeshRecord[] = [];
  const byKind: Partial<Record<SceneKind, number>> = {};
  let triangles = 0;
  let homes = 0;
  let litHomes = 0;
  let trees = 0;
  for (const [key, blocks] of byTile) {
    const tile = context?.layout.tiles[key];
    let h = hashOf(`${key}|${scene.lod}|${tile ? `${tile.kind}:${(tile as { n?: number }).n ?? ''}` : 'none'}|${context ? 'features' : 'bare'}`);
    for (const block of blocks) h = foldBlock(h, block);
    const signature = `${scene.lod}|${blocks.length}|${h}`;
    const had = rememberedChunks.get(signature);
    if (had && had.key === key) {
      chunks.push(had);
      for (const m of had.meshes) {
        if (m.block) {
          meshes.push(m);
          byKind[m.kind] = (byKind[m.kind] ?? 0) + m.triangles;
        }
        triangles += m.triangles;
      }
      homes += had.homes.length;
      litHomes += had.homes.filter((x) => x.lit === 1).length;
      trees += had.trees.length;
      continue;
    }
    const chunkMeshes: MeshRecord[] = [];
    const chunkHomes: HomeInstance[] = [];
    let chunkTrees: Tree[] = [];
    const center = context ? tileCenterM(key, context.rates) : null;
    const homeSet = new Set(near && tile?.kind === 'hood' ? blocks.filter((b) => b.kind === 'hood') : []);
    const homeBlocks = [...homeSet];
    for (const block of blocks) {
      if (homeSet.has(block)) continue;
      const m = record(block.kind, materialOf(block, near), prismOf(block.block.corners, block.block.heightM), block.lit, block);
      chunkMeshes.push(m);
      meshes.push(m);
      byKind[block.kind] = (byKind[block.kind] ?? 0) + m.triangles;
      if (block.kind === 'site' && center && !blocks.some((b) => b !== block && b.kind === 'site')) chunkMeshes.push(...craneOf(center));
    }
    if (homeBlocks.length) chunkHomes.push(...homesOf(key, homeBlocks));
    if (center && hoodPlan && tile?.kind === 'hood') {
      const s = hoodPlan.surface;
      chunkMeshes.push(record('hood', 'park', prismOf(discPolygon(s.park, center), 0, 0.1), 1));
      chunkMeshes.push(record('hood', 'plaza', prismOf(discPolygon(s.center, center), 0, 0.1), 1));
      for (const seg of s.lane) chunkMeshes.push(record('hood', 'path', prismOf(stripPolygon(seg, center, 3), 0, 0.2), 1));
      chunkTrees = treesOf(key, s.park, center);
    } else if (center && context && near && tile?.kind === 'ring') {
      const plan = (rings[tile.n] ??= planRing(context.rates.walking, context.rates.base, tile.n));
      chunkMeshes.push(record('ring', 'plaza', prismOf(discPolygon(plan.surface.plaza, center), 0, 0.1), 1));
    }
    for (const m of chunkMeshes) triangles += m.triangles;
    homes += chunkHomes.length;
    litHomes += chunkHomes.filter((h) => h.lit === 1).length;
    trees += chunkTrees.length;
    const chunk: Chunk = { key, signature, meshes: chunkMeshes, homes: chunkHomes, trees: chunkTrees };
    if (rememberedChunks.size >= REMEMBER_MAX) rememberedChunks.clear();
    rememberedChunks.set(signature, chunk);
    chunks.push(chunk);
  }
  return { chunks, meshes, blocks: scene.blocks.length, stories: scene.stories, sites: scene.sites, lit: scene.lit, triangles, byKind, homes, litHomes, trees, bounds: boundsOf(scene) };
}
