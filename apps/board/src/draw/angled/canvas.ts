/**
 * @file Painting a scene: fit the camera to it, sort its blocks far to near, extrude each and hand every face to a
 * painter in order. The painter is an interface, so a test paints into a list and the page paints into a canvas.
 * Pure but for the painter it is given.
 * Public interface: Painter, Palette, fitCamera, lodFor, paintScene, MID_SCALE, DARK.
 * Owner context: Board (adapter), the angled view (plan angled-view-through-time).
 */
import { blockDepth, extrude } from './extrude.ts';
import type { Face } from './extrude.ts';
import { project } from './projection.ts';
import type { Camera, ScreenPoint } from './projection.ts';
import type { Lod, Scene, SceneKind } from './scene.ts';

/** What paints a face: the page's canvas, or a fake in tests. */
export interface Painter {
  /** Fill one polygon with a colour, darkened to the shade (1 is the colour as given). */
  fillPolygon(points: readonly ScreenPoint[], color: string, shade: number): void;
}

/** A colour for each kind of block. */
export type Palette = Readonly<Record<SceneKind, string>>;

/** The shade an unlit home block keeps, so a dark neighborhood still reads as standing. */
export const DARK = 0.45;

/** Pixels a metre from which the rows of townhouses are drawn instead of one block a tile. */
export const MID_SCALE = 0.25;

/** The detail a scale deserves. */
export function lodFor(scale: number): Lod {
  return scale >= MID_SCALE ? 'mid' : 'far';
}

/**
 * A camera that shows the whole scene inside a width and height, with a margin, at the given turn and tilt. The
 * scale is the largest that fits; the origin centres the scene. An empty scene gets the camera at unit scale.
 * @param scene - what to fit
 * @param width - pixels across
 * @param height - pixels down
 * @param yaw - the turn
 * @param pitch - the tilt, in (0, π/2]
 * @param margin - pixels kept clear round the scene
 */
export function fitCamera(scene: Scene, width: number, height: number, yaw: number, pitch: number, margin = 16): Camera {
  const unit: Camera = { yaw, pitch, scale: 1, origin: { x: 0, y: 0 } };
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const b of scene.blocks) {
    for (const c of b.block.corners) {
      for (const z of [0, b.block.heightM]) {
        const p = project({ ...c, z }, unit);
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
    }
  }
  if (!Number.isFinite(minX)) return { ...unit, origin: { x: width / 2, y: height / 2 } };
  const spanX = Math.max(maxX - minX, 1e-9);
  const spanY = Math.max(maxY - minY, 1e-9);
  const scale = Math.min((width - 2 * margin) / spanX, (height - 2 * margin) / spanY);
  return {
    yaw,
    pitch,
    scale,
    origin: { x: width / 2 - ((minX + maxX) / 2) * scale, y: height / 2 - ((minY + maxY) / 2) * scale },
  };
}

/**
 * Paint a scene: what lies flat on the ground first, in the scene's order, then the blocks that rise sorted by depth,
 * farthest first; each extruded under the camera and its faces handed to the painter in order, coloured by kind and
 * dimmed by how little of it is lit (an empty home block keeps 0.45 of its shade).
 * @returns how many faces were painted
 */
export function paintScene(painter: Painter, scene: Scene, camera: Camera, palette: Palette): number {
  const flat = scene.blocks.filter((b) => b.block.heightM === 0);
  const rising = scene.blocks.filter((b) => b.block.heightM > 0).sort((a, b) => blockDepth(a.block, camera) - blockDepth(b.block, camera));
  const ordered = [...flat, ...rising];
  let faces = 0;
  for (const b of ordered) {
    const color = palette[b.kind];
    for (const face of extrude(b.block, camera) as Face[]) {
      painter.fillPolygon(face.points, color, face.shade * (DARK + (1 - DARK) * b.lit));
      faces++;
    }
  }
  return faces;
}
