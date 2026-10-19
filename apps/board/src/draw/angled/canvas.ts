/**
 * @file Painting a scene: fit the camera to it, sort its blocks far to near, extrude each and hand every face to a
 * painter in order, leaving out what lies outside the viewport. On a month tick where only who lives where changed,
 * only the region of the tiles whose lit share moved is cleared and painted again, so the canvas is its own cache.
 * The painter is an interface, so a test paints into a list and the page paints into a canvas. Pure but for the
 * painter it is given.
 * Public interface: Painter, Palette, Viewport, Region, fitCamera, lodFor, blockBox, changedTiles, regionOf,
 * paintScene, paintRegion, MID_SCALE, NEAR_SCALE, DARK.
 * Owner context: Board (adapter), the angled view (plan angled-view-through-time).
 */
import { blockDepth, extrude } from './extrude.ts';
import type { Block, Face } from './extrude.ts';
import { project } from './projection.ts';
import type { Camera, ScreenPoint } from './projection.ts';
import type { Lod, Scene, SceneBlock, SceneKind } from './scene.ts';

/** What paints a face: the page's canvas, or a fake in tests. */
export interface Painter {
  /** Fill one polygon with a colour, darkened to the shade (1 is the colour as given). */
  fillPolygon(points: readonly ScreenPoint[], color: string, shade: number): void;
  /** Clear a region to the ground and confine what follows to it, until `unclip`. Absent, a region repaint is a
   * full repaint of the blocks in it with nothing cleared (a test's painter). */
  clip?(region: Region): void;
  unclip?(): void;
}

/** The canvas's size in pixels. */
export interface Viewport {
  readonly width: number;
  readonly height: number;
}

/** A rectangle on the screen, pixels. */
export interface Region {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/** Pixels a metre from which every home is drawn. */
export const NEAR_SCALE = 1;

/** A block's bounding box on the screen, its height included. */
export function blockBox(block: Block, camera: Camera): Region {
  let x0 = Number.POSITIVE_INFINITY;
  let y0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  let y1 = Number.NEGATIVE_INFINITY;
  for (const c of block.corners) {
    for (const z of [0, block.heightM]) {
      const p = project({ ...c, z }, camera);
      x0 = Math.min(x0, p.x);
      x1 = Math.max(x1, p.x);
      y0 = Math.min(y0, p.y);
      y1 = Math.max(y1, p.y);
    }
  }
  return { x0, y0, x1, y1 };
}

const overlaps = (a: Region, b: Region): boolean => a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1;

/** The tiles whose lit share moved between two scenes of the same layout. */
export function changedTiles(before: Scene, after: Scene): string[] {
  const litOf = (scene: Scene): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const b of scene.blocks) if (b.kind === 'hood') out[b.key] = (out[b.key] ?? 0) + b.lit;
    return out;
  };
  const was = litOf(before);
  const now = litOf(after);
  const keys = new Set([...Object.keys(was), ...Object.keys(now)]);
  return [...keys].filter((k) => Math.abs((was[k] ?? -1) - (now[k] ?? -1)) > 1e-9).sort();
}

/** The screen region the given tiles' blocks cover, a pixel of slack round it; null with no such block. */
export function regionOf(scene: Scene, tiles: readonly string[], camera: Camera): Region | null {
  const set = new Set(tiles);
  let region: Region | null = null;
  for (const b of scene.blocks) {
    if (!set.has(b.key)) continue;
    const box = blockBox(b.block, camera);
    region = region ? { x0: Math.min(region.x0, box.x0), y0: Math.min(region.y0, box.y0), x1: Math.max(region.x1, box.x1), y1: Math.max(region.y1, box.y1) } : box;
  }
  return region ? { x0: region.x0 - 1, y0: region.y0 - 1, x1: region.x1 + 1, y1: region.y1 + 1 } : null;
}

/** A colour for each kind of block. */
export type Palette = Readonly<Record<SceneKind, string>>;

/** The shade an unlit home block keeps, so a dark neighborhood still reads as standing. */
export const DARK = 0.45;

/** Pixels a metre from which the rows of townhouses are drawn instead of one block a tile. */
export const MID_SCALE = 0.25;

/** The detail a scale deserves. */
export function lodFor(scale: number): Lod {
  return scale >= NEAR_SCALE ? 'near' : scale >= MID_SCALE ? 'mid' : 'far';
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

/** The blocks in painter's order: what lies flat first, then the rest farthest first; only those touching the region. */
function ordered(scene: Scene, camera: Camera, region: Region | null): SceneBlock[] {
  const inside = region ? scene.blocks.filter((b) => overlaps(blockBox(b.block, camera), region)) : [...scene.blocks];
  const flat = inside.filter((b) => b.block.heightM === 0);
  const rising = inside.filter((b) => b.block.heightM > 0).sort((a, b) => blockDepth(a.block, camera) - blockDepth(b.block, camera));
  return [...flat, ...rising];
}

function paintBlocks(painter: Painter, blocks: readonly SceneBlock[], camera: Camera, palette: Palette): number {
  let faces = 0;
  for (const b of blocks) {
    const color = palette[b.kind];
    for (const face of extrude(b.block, camera) as Face[]) {
      painter.fillPolygon(face.points, color, face.shade * (DARK + (1 - DARK) * b.lit));
      faces++;
    }
  }
  return faces;
}

/**
 * Paint a scene: what lies flat on the ground first, in the scene's order, then the blocks that rise sorted by depth,
 * farthest first; each extruded under the camera and its faces handed to the painter in order, coloured by kind and
 * dimmed by how little of it is lit (an empty home block keeps 0.45 of its shade). With a viewport, a block wholly
 * outside it is left out.
 * @returns how many faces were painted
 */
export function paintScene(painter: Painter, scene: Scene, camera: Camera, palette: Palette, viewport?: Viewport): number {
  const region = viewport ? { x0: 0, y0: 0, x1: viewport.width, y1: viewport.height } : null;
  return paintBlocks(painter, ordered(scene, camera, region), camera, palette);
}

/**
 * Paint again only one region of a scene already painted: the painter clears and clips to it, every block touching
 * it is painted in the painter's order, and the clip is lifted.
 * @returns how many faces were painted
 */
export function paintRegion(painter: Painter, scene: Scene, camera: Camera, palette: Palette, region: Region): number {
  painter.clip?.(region);
  const faces = paintBlocks(painter, ordered(scene, camera, region), camera, palette);
  painter.unclip?.();
  return faces;
}
