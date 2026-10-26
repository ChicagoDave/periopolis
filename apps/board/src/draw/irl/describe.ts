/**
 * @file What the IRL view builds, described: every block of the derived scene becomes a prism, its footprint's
 * corners walked counter-clockwise, a top and a side for every edge, each face with its own vertices and outward
 * normal so the GL adapter lights it flat; a block of no height is its footprint lifted a little off the ground.
 * Pure, no DOM, no three.js: the numbers are what a test holds the view to, and the adapter only uploads them.
 * Public interface: Prism, MeshRecord, Described, FLAT_LIFT_M, prismOf, describeScene.
 * Owner context: Board (adapter), the IRL view (plan irl-3d-city-view, ADR-0023).
 */
import type { GroundPoint } from '../angled/projection.ts';
import type { Scene, SceneBlock, SceneKind } from '../angled/scene.ts';
import { boundsOf } from './camera.ts';
import type { Bounds } from './camera.ts';

/** Metres a flat block (a strip of line) is lifted off the ground, so it draws over it and not through it. */
export const FLAT_LIFT_M = 0.3;

/** A prism's geometry: positions and normals three a vertex, in scene metres (x east, y south, z up), and the
 * triangles as indices into them. */
export interface Prism {
  readonly positions: readonly number[];
  readonly normals: readonly number[];
  readonly indices: readonly number[];
}

/** One block as it is built: the scene's record and its prism. */
export interface MeshRecord {
  readonly block: SceneBlock;
  readonly prism: Prism;
  /** Triangles in the prism. */
  readonly triangles: number;
}

/** The scene described, and the sums a test can hold it to. */
export interface Described {
  readonly meshes: readonly MeshRecord[];
  /** Blocks described: one mesh a block. */
  readonly blocks: number;
  /** Stories over every block (the scene's). */
  readonly stories: number;
  /** Tiles under construction (the scene's). */
  readonly sites: number;
  /** The homes' lit share (the scene's). */
  readonly lit: number;
  /** Triangles over every mesh. */
  readonly triangles: number;
  /** Triangles by kind of block. */
  readonly byKind: Readonly<Partial<Record<SceneKind, number>>>;
  /** The box round everything; null for an empty scene. */
  readonly bounds: Bounds | null;
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
 * edge, each face with its own four (or n) vertices carrying the face's outward normal. A flat block is its top
 * alone, lifted FLAT_LIFT_M. The footprint must be convex for the fan to be right; every footprint the scene makes is.
 * @param corners - the footprint, metres, in order round it either way
 * @param heightM - metres the block rises, 0 for flat
 * @throws RangeError on fewer than three corners or a negative height
 */
export function prismOf(corners: readonly GroundPoint[], heightM: number): Prism {
  if (corners.length < 3) throw new RangeError(`a footprint needs three corners, not ${corners.length}`);
  if (!(heightM >= 0)) throw new RangeError(`height ${heightM} is not a length`);
  const ccw = twiceArea(corners) < 0 ? [...corners].reverse() : [...corners];
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const top = heightM > 0 ? heightM : FLAT_LIFT_M;
  // The top: one vertex a corner, normal up, a fan from the first corner. Scene y is south, so the outward normal of a
  // counter-clockwise edge (y up on paper) is the edge turned clockwise; with y south the walk is clockwise seen from
  // above, and the top still faces up.
  const base = positions.length / 3;
  for (const c of ccw) {
    positions.push(c.x, c.y, top);
    normals.push(0, 0, 1);
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
      indices.push(at, at + 1, at + 2, at, at + 2, at + 3);
    }
  }
  return { positions, normals, indices };
}

/**
 * The scene described: a prism for every block, the scene's sums carried over, the triangles counted in all and by
 * kind, and the box round everything.
 * @param scene - the derived scene (`sceneOf`), never kept
 */
export function describeScene(scene: Scene): Described {
  const meshes: MeshRecord[] = [];
  const byKind: Partial<Record<SceneKind, number>> = {};
  let triangles = 0;
  for (const block of scene.blocks) {
    const prism = prismOf(block.block.corners, block.block.heightM);
    const t = prism.indices.length / 3;
    meshes.push({ block, prism, triangles: t });
    triangles += t;
    byKind[block.kind] = (byKind[block.kind] ?? 0) + t;
  }
  return { meshes, blocks: scene.blocks.length, stories: scene.stories, sites: scene.sites, lit: scene.lit, triangles, byKind, bounds: boundsOf(scene) };
}
