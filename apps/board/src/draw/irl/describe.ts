/**
 * @file What the IRL view builds, described: the derived scene chunked by tile, every block a prism (a top fan and
 * an outward side for every edge, with metre UVs and a material) except a home at near detail, which is an instance
 * of one townhouse (its place, which way it faces, its material variant seeded from the tile's key, and whether it
 * is lit); with the Ground's plans, a neighborhood's park and center as discs, its bike lane as paths, trees seeded
 * into the park, the ring's plaza, a scaffold and a crane on a tile under construction, and a survey strip for a
 * stretch on order; and under the ground, the sub level: a guideway under every stretch of line (closed, or named
 * for a closure ahead, or on order, each its own material), a stop under every tile the line touches, and at near
 * detail a neighborhood's entries, walkways and goods pipes. At near detail a neighborhood also gets its streets,
 * sidewalks, kerbs, crossings, bike lane and park paths as flat prisms and its plaza furniture as props (kit models
 * placed by the streets module, ADR-0024 Decision 3), and the site gets its terrain: the shore the Site names. Near,
 * the ring's buildings, a plant's works and a neighborhood's schools stand as kit models too (Decision 1): each a
 * prop with a footprint or height fit, the plant on a paved yard with its stacks, tanks, tower or solar panels one
 * set a unit, the fields a flat pitch, and the trees and the park's cross path keep clear of the fields. Each chunk carries a signature so the adapter rebuilds only the tiles that changed. Pure, no
 * DOM, no three.js: the same scene describes byte for byte the same (ADR-0023 Decisions 2 and 3). A chunk is
 * remembered by its signature, so a tile that did not change is handed back, not described again.
 * Public interface: Prism, MaterialId, Level, MeshRecord, HomeInstance, Tree, PropInstance, Terrain, Chunk,
 * Described, DescribeContext, FLAT_LIFT_M, HOME_TRIANGLES, TREE_SPACING_M, SUB_DEPTH_M, PIPE_DEPTH_M, SHORE_SOIL_M,
 * prismOf, describeScene.
 * Owner context: Board (adapter), the IRL view (plan irl-3d-city-view, ADR-0023).
 */
import { planNeighborhood, planRing } from '@city/ground';
import type { Disc, Point, RingPlan, Segment } from '@city/ground';
import { edgeEnds, extent, lineNetwork } from '@city/site';
import type { EdgeKey, Layout, SiteRates, TileKey } from '@city/site';
import type { GroundPoint } from '../angled/projection.ts';
import { STORY_M } from '../angled/extrude.ts';
import { tileCenterM } from '../angled/scene.ts';
import type { Scene, SceneBlock, SceneKind } from '../angled/scene.ts';
import { boundsOf } from './camera.ts';
import type { Bounds } from './camera.ts';
import { hashOf, randomOf, variantOf } from './facade.ts';
import type { HomeVariant } from './facade.ts';
import { TOWERS, townhouseFor } from './kit.ts';
import type { ModelId } from './kit.ts';
import { plazaOf, streetsOf } from './streets.ts';
import type { Prop, SurfaceKind } from './streets.ts';

/** Metres a flat block (a strip of line) is lifted off the ground, so it draws over it and not through it. */
export const FLAT_LIFT_M = 0.3;

/** Triangles in one instanced townhouse: four walls of a box, two roof slopes and two gables. */
export const HOME_TRIANGLES = 14;

/** Metres between trees in a park, one a square of this side (Mine). */
export const TREE_SPACING_M = 20;

/** Metres below the ground the sub level's floor lies, and the goods pipe below that (Mine). */
export const SUB_DEPTH_M = -7;
export const PIPE_DEPTH_M = -10;

/** What a prism is made of: the adapter has a material for each. */
export type MaterialId =
  | 'massing'
  | 'office'
  | 'plant'
  | 'strip'
  | 'survey'
  | 'scaffold'
  | 'crane'
  | 'park'
  | 'plaza'
  | 'path'
  | 'guideway'
  | 'closed'
  | 'warned'
  | 'ordered'
  | 'stop'
  | 'entry'
  | 'walkway'
  | 'pipe'
  | 'fields'
  | 'yard'
  | SurfaceKind;

/** Where a prism stands: on the surface, or on the sub level under it. */
export type Level = 'surface' | 'sub';

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
  readonly level: Level;
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
  /** The kit model that stands for it (ADR-0024), chosen by its tile and index. */
  readonly model: ModelId;
  /** 1 lived in, 0 empty. */
  readonly lit: 0 | 1;
}

/** One tree in a park: where, how tall, and which of the kit's species (plan Phase 5). */
export interface Tree {
  readonly x: number;
  readonly y: number;
  readonly heightM: number;
  readonly species: 'tree-small' | 'tree-large';
}

/** A kit model placed on the ground as a prop (a lamp, a planter, a tower, a works, a school): the streets module's
 * record, with a footprint to fit to instead of a height when given. */
export type PropInstance = Prop & { readonly footprintM?: number };

/** The site's terrain: where the shore lies (the Site's south edge, ADR-0016), and how far the land reaches. */
export interface Terrain {
  /** Scene y of the shore line; water lies south of it (greater y). */
  readonly shoreY: number;
  readonly west: number;
  readonly east: number;
  readonly north: number;
}

/** Metres of soil between the grass and the water (Mine). */
export const SHORE_SOIL_M = 30;

/** One tile's share of the scene, with a signature that changes when any of it does. */
export interface Chunk {
  readonly key: TileKey;
  readonly signature: string;
  readonly meshes: readonly MeshRecord[];
  readonly homes: readonly HomeInstance[];
  readonly trees: readonly Tree[];
  readonly props: readonly PropInstance[];
}

/** What the describer needs beyond the scene to add the Ground's features and the sub level: the Site's rates, the
 * layout, and what the Run says of the line this year. */
export interface DescribeContext {
  readonly rates: SiteRates;
  readonly layout: Layout;
  /** Stretches closed for repairs this year (the Run's `stressAt`). */
  readonly closed?: readonly EdgeKey[];
  /** Stretches named for a closure ahead and not yet closed (the Run's `namedClosures`). */
  readonly warned?: readonly EdgeKey[];
  /** Stretches on order, not yet laid (the work in hand). */
  readonly ordered?: readonly EdgeKey[];
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
  /** The sub level: guideways under every stretch, how many closed and named ahead, stops, and entries. */
  readonly guideways: number;
  readonly closed: number;
  readonly warned: number;
  readonly stops: number;
  readonly entries: number;
  /** Streets laid, crossings and props placed; of the props, how many are bulk (street trees, hedges). */
  readonly streets: number;
  readonly crossings: number;
  readonly props: number;
  readonly bulkProps: number;
  /** The site's terrain; null without a context. */
  readonly terrain: Terrain | null;
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

/** How far each paving is lifted off the ground, metres, so what lies over reads over (Mine). */
const SURFACE_LIFT: Readonly<Record<SurfaceKind | 'fields' | 'yard', number>> = { asphalt: 0.08, sidewalk: 0.2, kerb: 0.22, crossing: 0.1, lane: 0.14, parkpath: 0.12, plaza: 0.1, fields: 0.12, yard: 0.1 };

/** The site's terrain from the Site's outline: the shore is the south edge, one tile radius south of the last row
 * of tiles (ADR-0016); the land runs a tile radius past the outline on the other sides. */
function terrainOf(context: DescribeContext): Terrain {
  const r = context.rates.tileKm * 1000;
  const e = extent(context.rates.outline);
  const south = e.south;
  const shoreY = 1.5 * r * south + r;
  const north = 1.5 * r * e.north - r;
  const west = Math.sqrt(3) * r * (e.west + Math.min(e.north, e.south) / 2) - 2 * r;
  const east = Math.sqrt(3) * r * (e.east + Math.max(e.north, e.south) / 2) + 2 * r;
  return { shoreY, west, east, north };
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

function record(kind: SceneKind, material: MaterialId, prism: Prism, lit: number, block?: SceneBlock, level: Level = 'surface'): MeshRecord {
  const base = { kind, material, level, prism, lit, triangles: prism.indices.length / 3 };
  return block ? { ...base, block } : base;
}

/** A prism moved down (or up) by so many metres. */
function lowered(prism: Prism, dz: number): Prism {
  return { ...prism, positions: prism.positions.map((v, i) => (i % 3 === 2 ? v + dz : v)) };
}

/** The state of a stretch of line on the sub level, and the material it is built of. */
type EdgeState = 'open' | 'closed' | 'warned' | 'ordered';
const EDGE_MATERIAL: Readonly<Record<EdgeState, MaterialId>> = { open: 'guideway', closed: 'closed', warned: 'warned', ordered: 'ordered' };

/** A guideway under a stretch: a box 8 m wide and 1 m high between the two tile middles, on the sub level's floor. */
function guidewayOf(edge: EdgeKey, state: EdgeState, rates: SiteRates): MeshRecord {
  const [a, b] = edgeEnds(edge);
  const from = tileCenterM(a, rates);
  const to = tileCenterM(b, rates);
  const seg: Segment = { from, to, m: Math.hypot(to.x - from.x, to.y - from.y) };
  return record('line', EDGE_MATERIAL[state], lowered(prismOf(stripPolygon(seg, { x: 0, y: 0 }, 8), 1), SUB_DEPTH_M), 1, undefined, 'sub');
}

/** A stop: a platform 60 m by 16 m and 3 m high on the sub level's floor, at the Ground's stop. */
function stopOf(at: Point): MeshRecord {
  return record('line', 'stop', lowered(prismOf(boxPolygon(at.x, at.y, 60, 16), 3), SUB_DEPTH_M), 1, undefined, 'sub');
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
      return 'massing';
    case 'hood':
    case 'school':
      return 'massing';
    case 'fields':
      return 'fields';
    default:
      return near ? 'plant' : 'massing';
  }
}

/** Whether a point lies inside an axis-aligned rectangle given by its corners. */
function insideRect(p: Point, corners: readonly GroundPoint[]): boolean {
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  return p.x >= Math.min(...xs) && p.x <= Math.max(...xs) && p.y >= Math.min(...ys) && p.y <= Math.max(...ys);
}

/** Trees seeded into a park: one a TREE_SPACING_M square of its area, placed by the tile's seed inside the disc and
 * off the fields when the park has them (the ones that would fall there are dropped, so the seed's stream is kept). */
function treesOf(key: TileKey, park: Disc, center: Point, fields: readonly GroundPoint[] | null): Tree[] {
  const count = Math.max(0, Math.floor(park.areaM2 / (TREE_SPACING_M * TREE_SPACING_M)));
  const next = randomOf(hashOf(`${key}/trees`));
  const out: Tree[] = [];
  const inner = Math.max(0, park.radiusM - 4);
  let placed = 0;
  while (placed < count) {
    const x = (next() * 2 - 1) * inner;
    const y = (next() * 2 - 1) * inner;
    if (Math.hypot(x, y) > inner) continue;
    const height = 5 + next() * 4;
    const tree: Tree = { x: center.x + park.at.x + x, y: center.y + park.at.y + y, heightM: height, species: height > 7.5 ? 'tree-large' : 'tree-small' };
    placed++;
    if (fields && insideRect(tree, fields)) continue;
    out.push(tree);
  }
  return out;
}

/** The plant's works on its yard: one set of models a unit, round a ring on the yard (Mine). */
const PLANT_SETS: Readonly<Record<string, readonly { model: ModelId; heightM?: number; footprintM?: number; dx: number; dy: number }[]>> = {
  power: [
    { model: 'works-a', footprintM: 70, dx: 0, dy: 0 },
    { model: 'chimney', heightM: 45, dx: 45, dy: -20 },
    { model: 'tank', footprintM: 30, dx: -50, dy: 20 },
  ],
  water: [
    { model: 'works-b', footprintM: 60, dx: 0, dy: 0 },
    { model: 'water-tower', heightM: 35, dx: 45, dy: 10 },
    { model: 'tank', footprintM: 30, dx: -45, dy: -15 },
  ],
  sewage: [
    { model: 'works-c', footprintM: 55, dx: 0, dy: 0 },
    { model: 'tank', footprintM: 34, dx: 50, dy: 15 },
    { model: 'tank', footprintM: 34, dx: -50, dy: 15 },
  ],
  waste: [
    { model: 'works-d', footprintM: 60, dx: 0, dy: 0 },
    { model: 'chimney-small', heightM: 25, dx: 40, dy: -20 },
    { model: 'solar', footprintM: 50, dx: -50, dy: 20 },
  ],
};

/** A plant's props at near detail: its sets laid one a unit on a ring 110 m out from the tile's middle. */
function plantProps(key: TileKey, kind: string, units: number, center: Point): PropInstance[] {
  const set = PLANT_SETS[kind] ?? PLANT_SETS.power ?? [];
  const out: PropInstance[] = [];
  const n = Math.max(1, units);
  for (let u = 0; u < n; u++) {
    const a = (u / n) * 2 * Math.PI + hashOf(key) % 7 / 7;
    const ux = n === 1 ? 0 : 110 * Math.cos(a);
    const uy = n === 1 ? 0 : 110 * Math.sin(a);
    for (const s of set) {
      const prop: PropInstance = { model: s.model, x: center.x + ux + s.dx, y: center.y + uy + s.dy, yaw: 0, heightM: s.heightM ?? 0, ...(s.footprintM ? { footprintM: s.footprintM } : {}) };
      out.push(prop);
    }
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
      model: townhouseFor(key, i),
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
  // Near: every home a kit model with the props; mid: the rows as massing, the streets and parks laid, no props.
  const near = scene.lod === 'near';
  const laidOut = scene.lod !== 'far';
  const byTile = new Map<TileKey, SceneBlock[]>();
  for (const block of scene.blocks) {
    const list = byTile.get(block.key);
    if (list) list.push(block);
    else byTile.set(block.key, [block]);
  }
  const hoodPlan = context ? planNeighborhood(context.rates.shared, context.rates.walking, context.rates.base) : null;
  void laidOut;
  const rings: Record<number, RingPlan> = {};
  // The line on the sub level, by the tile each stretch starts from, with what the Run says of it this year.
  const edgesByTile = new Map<TileKey, { edge: EdgeKey; state: EdgeState }[]>();
  const network = context ? lineNetwork(context.layout.lines) : null;
  if (context) {
    const closed = new Set(context.closed ?? []);
    const warned = new Set(context.warned ?? []);
    const add = (edge: EdgeKey, state: EdgeState): void => {
      const [a] = edgeEnds(edge);
      const list = edgesByTile.get(a);
      if (list) list.push({ edge, state });
      else edgesByTile.set(a, [{ edge, state }]);
      if (!byTile.has(a)) byTile.set(a, []);
    };
    for (const edge of Object.keys(context.layout.lines)) add(edge, closed.has(edge) ? 'closed' : warned.has(edge) ? 'warned' : 'open');
    for (const edge of context.ordered ?? []) if (!context.layout.lines[edge]) add(edge, 'ordered');
  }
  const chunks: Chunk[] = [];
  const meshes: MeshRecord[] = [];
  const byKind: Partial<Record<SceneKind, number>> = {};
  let triangles = 0;
  let homes = 0;
  let litHomes = 0;
  let trees = 0;
  let streetsLaid = 0;
  let crossingsLaid = 0;
  let guideways = 0;
  let closedCount = 0;
  let warnedCount = 0;
  let stops = 0;
  let entries = 0;
  const tally = (c: Chunk): void => {
    for (const m of c.meshes) {
      if (m.level === 'surface') {
        if (m.material === 'asphalt') streetsLaid++;
        if (m.material === 'crossing') crossingsLaid++;
        continue;
      }
      if (m.level !== 'sub') continue;
      if (m.material === 'guideway' || m.material === 'closed' || m.material === 'warned' || m.material === 'ordered') guideways++;
      if (m.material === 'closed') closedCount++;
      if (m.material === 'warned') warnedCount++;
      if (m.material === 'stop') stops++;
      if (m.material === 'entry') entries++;
    }
  };
  for (const [key, blocks] of byTile) {
    const tile = context?.layout.tiles[key];
    const edges = edgesByTile.get(key) ?? [];
    const onLine = Boolean(tile && network?.onLine(key));
    let h = hashOf(`${key}|${scene.lod}|${tile ? `${tile.kind}:${(tile as { n?: number }).n ?? ''}` : 'none'}|${context ? 'features' : 'bare'}|${edges.map((e) => `${e.edge}=${e.state}`).join(',')}|${onLine ? 'stop' : ''}`);
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
      tally(had);
      continue;
    }
    const chunkMeshes: MeshRecord[] = [];
    const chunkHomes: HomeInstance[] = [];
    let chunkTrees: Tree[] = [];
    const chunkProps: PropInstance[] = [];
    const center = context ? tileCenterM(key, context.rates) : null;
    const homeSet = new Set(near && tile?.kind === 'hood' ? blocks.filter((b) => b.kind === 'hood') : []);
    const homeBlocks = [...homeSet];
    const fieldsBlock = blocks.find((b) => b.kind === 'fields') ?? null;
    let schoolIndex = 0;
    for (const block of blocks) {
      if (homeSet.has(block)) continue;
      // Near, with the plans in hand, the ring's buildings, the plants' works and the schools stand as kit models.
      if (context && near && (block.kind === 'ring' || block.kind === 'school' || (tile && tile.kind !== 'hood' && tile.kind !== 'ring' && block.kind === tile.kind))) {
        const cx = block.block.corners.reduce((t, c) => t + c.x, 0) / block.block.corners.length;
        const cy = block.block.corners.reduce((t, c) => t + c.y, 0) / block.block.corners.length;
        if (block.kind === 'ring') {
          const i = chunkProps.length;
          chunkProps.push({ model: TOWERS[hashOf(`${key}/tower/${i}`) % TOWERS.length] as ModelId, x: cx, y: cy, yaw: 0, heightM: block.stories * STORY_M });
        } else if (block.kind === 'school') {
          const xs = block.block.corners.map((c) => c.x);
          const ys = block.block.corners.map((c) => c.y);
          const w = Math.max(...xs) - Math.min(...xs);
          const d = Math.max(...ys) - Math.min(...ys);
          chunkProps.push({ model: block.stories >= 3 ? 'school-tall' : 'school-wide', x: cx, y: cy, yaw: w >= d ? 0 : Math.PI / 2, heightM: 0, footprintM: Math.max(w, d) });
          schoolIndex++;
        } else {
          // A plant: its yard paved, then its works.
          chunkMeshes.push(record(block.kind, 'yard', prismOf(block.block.corners, 0, 0.1), 1));
          chunkProps.push(...plantProps(key, block.kind, (tile as { n?: number }).n ?? 1, { x: cx, y: cy }));
        }
        continue;
      }
      const m = record(block.kind, materialOf(block, near), prismOf(block.block.corners, block.block.heightM, block.kind === 'fields' ? SURFACE_LIFT.fields : FLAT_LIFT_M), block.lit, block);
      chunkMeshes.push(m);
      meshes.push(m);
      byKind[block.kind] = (byKind[block.kind] ?? 0) + m.triangles;
      if (block.kind === 'site' && center && !blocks.some((b) => b !== block && b.kind === 'site')) chunkMeshes.push(...craneOf(center));
    }
    if (homeBlocks.length) chunkHomes.push(...homesOf(key, homeBlocks));
    if (center && hoodPlan && laidOut && tile?.kind === 'hood') {
      const s = hoodPlan.surface;
      chunkMeshes.push(record('hood', 'park', prismOf(discPolygon(s.park, center), 0, 0.1), 1));
      chunkMeshes.push(record('hood', 'plaza', prismOf(discPolygon(s.center, center), 0, 0.1), 1));
      const fields = fieldsBlock ? fieldsBlock.block.corners : null;
      chunkTrees = treesOf(key, s.park, center, fields);
      // The streets and open ground: each strip a flat prism lifted by its kind so kerbs stand over asphalt and
      // crossings over the street; the furniture as props.
      const laid = streetsOf(hoodPlan, center, fields !== null);
      for (const strip of laid.strips) chunkMeshes.push(record('hood', strip.kind, prismOf(strip.corners, 0, SURFACE_LIFT[strip.kind]), 1));
      if (near) chunkProps.push(...laid.props);
    } else if (center && context && laidOut && tile?.kind === 'ring') {
      const plan = (rings[tile.n] ??= planRing(context.rates.walking, context.rates.base, tile.n));
      chunkMeshes.push(record('ring', 'plaza', prismOf(discPolygon(plan.surface.plaza, center), 0, 0.1), 1));
      if (near) chunkProps.push(...plazaOf(plan, center).props);
    }
    // The sub level: guideways under the stretches that start here, a stop under the tile if the line touches it, and
    // at near detail a neighborhood's entries (shafts up to the surface), walkways and goods pipes.
    if (context && center) {
      for (const e of edges) chunkMeshes.push(guidewayOf(e.edge, e.state, context.rates));
      if (onLine && tile && hoodPlan) {
        const at = tile.kind === 'hood' ? hoodPlan.sub.stop.at : tile.kind === 'ring' ? (rings[tile.n] ??= planRing(context.rates.walking, context.rates.base, tile.n)).sub.stop.at : { x: 0, y: 0 };
        chunkMeshes.push(stopOf({ x: center.x + at.x, y: center.y + at.y }));
      }
      if (near && tile?.kind === 'hood' && hoodPlan) {
        for (const entry of hoodPlan.sub.entries) {
          chunkMeshes.push(record('hood', 'entry', lowered(prismOf(boxPolygon(center.x + entry.at.x, center.y + entry.at.y, 4, 4), -SUB_DEPTH_M), SUB_DEPTH_M), 1, undefined, 'sub'));
          if (entry.walkway) chunkMeshes.push(record('hood', 'walkway', prismOf(stripPolygon(entry.walkway, center, 2.5), 0, SUB_DEPTH_M + 0.2), 1, undefined, 'sub'));
        }
        for (const pipe of hoodPlan.sub.pipes) chunkMeshes.push(record('hood', 'pipe', lowered(prismOf(stripPolygon(pipe, center, 1.5), 1.5), PIPE_DEPTH_M), 1, undefined, 'sub'));
      }
    }
    for (const m of chunkMeshes) triangles += m.triangles;
    void schoolIndex;
    homes += chunkHomes.length;
    litHomes += chunkHomes.filter((h) => h.lit === 1).length;
    trees += chunkTrees.length;
    const chunk: Chunk = { key, signature, meshes: chunkMeshes, homes: chunkHomes, trees: chunkTrees, props: chunkProps };
    if (rememberedChunks.size >= REMEMBER_MAX) rememberedChunks.clear();
    rememberedChunks.set(signature, chunk);
    chunks.push(chunk);
    tally(chunk);
  }
  return {
    chunks,
    meshes,
    blocks: scene.blocks.length,
    stories: scene.stories,
    sites: scene.sites,
    lit: scene.lit,
    triangles,
    byKind,
    homes,
    litHomes,
    trees,
    guideways,
    closed: closedCount,
    warned: warnedCount,
    stops,
    entries,
    streets: streetsLaid,
    crossings: crossingsLaid,
    props: chunks.reduce((t, c) => t + c.props.length, 0),
    bulkProps: chunks.reduce((t, c) => t + c.props.filter((p) => p.bulk).length, 0),
    terrain: context ? terrainOf(context) : null,
    bounds: boundsOf(scene),
  };
}
