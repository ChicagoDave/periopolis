/**
 * @file Extrusion: a footprint on the ground and a height become the faces the angled view paints, a top and the
 * sides that face the viewer, each with a shade from one fixed light, already in screen pixels and in the order to
 * paint them. Pure, no DOM.
 * Public interface: Face, Block, STORY_M, extrude, blockDepth, LIGHT.
 * Owner context: Board (adapter), the angled view (plan angled-view-through-time).
 */
import type { Camera, GroundPoint, ScreenPoint } from './projection.ts';
import { depthOf, project, turned } from './projection.ts';

/** Metres a story, the height a building rises for each (Mine: the ledger fixes stories, not their height). */
export const STORY_M = 3.2;

/** Where the light comes from, on the ground plane, as a unit vector before the camera's turn. */
export const LIGHT: { readonly x: number; readonly y: number } = { x: -Math.SQRT1_2, y: -Math.SQRT1_2 };

/** One painted face of a block. */
export interface Face {
  readonly kind: 'top' | 'side';
  /** Screen corners, in order round the face. */
  readonly points: readonly ScreenPoint[];
  /** How lit, 0 dark to 1 full: the top is full, a side by its facing to the light. */
  readonly shade: number;
}

/** A thing to paint: its footprint on the ground, its height, and what it is for the painter. */
export interface Block {
  /** Corners on the ground, metres, in order round the footprint, either way round. */
  readonly corners: readonly GroundPoint[];
  readonly heightM: number;
}

/** A face's shade from its outward normal: 0.45 in shadow, up to 0.95 facing the light. */
function sideShade(nx: number, ny: number): number {
  const lit = Math.max(0, nx * LIGHT.x + ny * LIGHT.y);
  return 0.45 + 0.5 * lit;
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
 * The faces of a block under a camera, in the order to paint them: the sides that face the viewer, farthest first,
 * then the top. A block of no height is its footprint alone, as one top face.
 * @param block - the footprint and height, metres
 * @param camera - the viewer
 * @throws RangeError on fewer than three corners or a negative height
 */
export function extrude(block: Block, camera: Camera): Face[] {
  if (block.corners.length < 3) throw new RangeError(`a footprint needs three corners, not ${block.corners.length}`);
  if (!(block.heightM >= 0)) throw new RangeError(`height ${block.heightM} is not a length`);
  // Walk the corners counter-clockwise so every edge's outward normal is to its right.
  const corners = twiceArea(block.corners) < 0 ? [...block.corners].reverse() : [...block.corners];
  const h = block.heightM;
  const top: Face = { kind: 'top', points: corners.map((c) => project({ ...c, z: h }, camera)), shade: 1 };
  if (h === 0) return [top];
  const sides: { face: Face; depth: number }[] = [];
  for (let i = 0; i < corners.length; i++) {
    const p = corners[i] as GroundPoint;
    const q = corners[(i + 1) % corners.length] as GroundPoint;
    const ex = q.x - p.x;
    const ey = q.y - p.y;
    const len = Math.hypot(ex, ey);
    if (!(len > 0)) continue;
    // The outward normal of a counter-clockwise edge is the edge turned clockwise.
    const nx = ey / len;
    const ny = -ex / len;
    // A side faces the viewer when its outward normal, turned with the camera, points toward the viewer (+y).
    if (turned({ x: nx, y: ny }, camera).y <= 0) continue;
    const face: Face = {
      kind: 'side',
      points: [project(p, camera), project(q, camera), project({ ...q, z: h }, camera), project({ ...p, z: h }, camera)],
      shade: sideShade(nx, ny),
    };
    sides.push({ face, depth: depthOf({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }, camera) });
  }
  sides.sort((a, b) => a.depth - b.depth);
  return [...sides.map((s) => s.face), top];
}

/** A block's place in the painter's order: its footprint's nearest corner, so a block in front is painted after. */
export function blockDepth(block: Block, camera: Camera): number {
  return Math.max(...block.corners.map((c) => depthOf(c, camera)));
}
