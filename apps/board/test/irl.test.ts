/**
 * @file The IRL view held to numbers: the orbit camera fits the scene's sphere, turns within its bounds, comes nearer
 * and farther within its bounds, slides inside the site and refuses what it should; the describer gives every block
 * a prism whose faces point outward and whose counts equal the scene's; the session opens the view fitted and keeps
 * the orbit it is given, never saved.
 * Owner context: Board (adapter), tests.
 */
import { describe, expect, it } from 'vitest';
import { RATES, starterLayout } from '@city/site';
import { sceneOf } from '../src/draw/angled/scene.ts';
import {
  DISTANCE_MIN_M,
  ELEVATION_MAX,
  ELEVATION_MIN,
  FAR_FACTOR,
  FOV_RAD,
  boundsOf,
  dollyOrbit,
  eyeOf,
  fitOrbit,
  panOrbit,
  pixelsPerMetre,
  turnOrbit,
} from '../src/draw/irl/camera.ts';
import type { Bounds } from '../src/draw/irl/camera.ts';
import { FLAT_LIFT_M, describeScene, prismOf } from '../src/draw/irl/describe.ts';
import { newSession } from '../src/session.ts';
import { memoryStore } from '../src/storage.ts';

const close = (a: number, b: number, eps = 1e-6): void => expect(Math.abs(a - b)).toBeLessThan(eps);
const BOX: Bounds = { minX: -1000, maxX: 1000, minY: -500, maxY: 500, maxZ: 80 };
const SQUARE = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

describe('the orbit', () => {
  it("fits the scene's sphere in the narrower field of view, opens a sixth of a turn round and fifty degrees up", () => {
    const o = fitOrbit(BOX, 16 / 9);
    expect(o.target).toEqual({ x: 0, y: 0, z: 0 });
    const radius = Math.hypot(2000, 1000, 80) / 2;
    close(o.distance, radius / Math.sin(FOV_RAD / 2));
    close(o.azimuth, Math.PI / 6);
    close(o.elevation, (50 * Math.PI) / 180);
    // A tall narrow canvas fits by its width, so the eye stands farther back.
    expect(fitOrbit(BOX, 0.5).distance).toBeGreaterThan(o.distance);
    expect(() => fitOrbit(BOX, 0)).toThrow(RangeError);
  });
  it('turns round and round, and the elevation is held between five and eighty-nine degrees', () => {
    const o = fitOrbit(BOX, 1);
    close(turnOrbit(o, 2 * Math.PI, 0).azimuth, o.azimuth);
    close(turnOrbit(o, -o.azimuth - 0.1, 0).azimuth, 2 * Math.PI - 0.1);
    expect(turnOrbit(o, 0, 10).elevation).toBe(ELEVATION_MAX);
    expect(turnOrbit(o, 0, -10).elevation).toBe(ELEVATION_MIN);
    close(turnOrbit(o, 0.3, -0.2).elevation, o.elevation - 0.2);
  });
  it('comes nearer and farther within forty metres and three times the fit, and ignores a factor that is not positive', () => {
    const o = fitOrbit(BOX, 1);
    close(dollyOrbit(o, 0.5, BOX, 1).distance, o.distance / 2);
    expect(dollyOrbit(o, 1e-9, BOX, 1).distance).toBe(DISTANCE_MIN_M);
    close(dollyOrbit(o, 1e9, BOX, 1).distance, FAR_FACTOR * o.distance);
    expect(dollyOrbit(o, 0, BOX, 1)).toBe(o);
    expect(dollyOrbit(o, -2, BOX, 1)).toBe(o);
  });
  it('slides the target by the metres a pixel spans at the target, and never out of the box', () => {
    const o = { ...fitOrbit(BOX, 1), azimuth: 0 };
    const height = 600;
    const perPixel = (2 * o.distance * Math.tan(o.fov / 2)) / height;
    close(pixelsPerMetre(o, height), 1 / perPixel);
    // From the south (azimuth 0) the viewer's right is east: a drag to the right slides the target west.
    const slid = panOrbit(o, 10, 0, height, BOX);
    close(slid.target.x, -10 * perPixel);
    close(slid.target.y, 0);
    // A drag down the screen brings the target toward the viewer, south.
    const down = panOrbit(o, 0, 10, height, BOX);
    close(down.target.y, 10 * perPixel);
    expect(panOrbit(o, -1e9, 0, height, BOX).target.x).toBe(BOX.maxX);
    expect(panOrbit(o, 0, -1e9, height, BOX).target.y).toBe(BOX.minY);
  });
  it('the eye stands so far from the target, that high above it, on the side the azimuth names', () => {
    const o = { ...fitOrbit(BOX, 1), azimuth: 0, elevation: Math.PI / 4, distance: 100 };
    const eye = eyeOf(o);
    close(eye.x, 0);
    close(eye.y, 100 * Math.SQRT1_2);
    close(eye.z, 100 * Math.SQRT1_2);
    close(Math.hypot(eye.x - o.target.x, eye.y - o.target.y, eye.z - o.target.z), 100);
    const turned = eyeOf({ ...o, azimuth: Math.PI / 2 });
    close(turned.x, 100 * Math.SQRT1_2);
    close(turned.y, 0);
  });
  it("the box round the ledger's city holds every corner and its tallest block, and an empty scene has none", () => {
    const scene = sceneOf(starterLayout(), RATES, 'far');
    const b = boundsOf(scene);
    if (!b) throw new Error('bounds');
    for (const block of scene.blocks) {
      for (const c of block.block.corners) {
        expect(c.x).toBeGreaterThanOrEqual(b.minX);
        expect(c.x).toBeLessThanOrEqual(b.maxX);
        expect(c.y).toBeGreaterThanOrEqual(b.minY);
        expect(c.y).toBeLessThanOrEqual(b.maxY);
      }
    }
    expect(b.maxZ).toBe(Math.max(...scene.blocks.map((x) => x.block.heightM)));
    expect(boundsOf({ lod: 'far', blocks: [], stories: 0, sites: 0, lit: 1 })).toBeNull();
  });
});

describe('the prism', () => {
  it('a square ten metres on a side and twelve high is a top fan and four sides, every side facing outward', () => {
    const p = prismOf(SQUARE, 12);
    expect(p.positions.length / 3).toBe(4 + 4 * 4);
    expect(p.indices.length / 3).toBe(2 + 4 * 2);
    // The top is at the height, its normal up.
    for (let i = 0; i < 4; i++) {
      expect(p.positions[i * 3 + 2]).toBe(12);
      expect(p.normals.slice(i * 3, i * 3 + 3)).toEqual([0, 0, 1]);
    }
    // Each side's normal is a unit vector pointing away from the footprint's middle.
    for (let side = 0; side < 4; side++) {
      const at = 4 + side * 4;
      const nx = p.normals[at * 3] as number;
      const ny = p.normals[at * 3 + 1] as number;
      close(Math.hypot(nx, ny), 1);
      const mx = ((p.positions[at * 3] as number) + (p.positions[(at + 1) * 3] as number)) / 2 - 5;
      const my = ((p.positions[at * 3 + 1] as number) + (p.positions[(at + 1) * 3 + 1] as number)) / 2 - 5;
      expect(nx * mx + ny * my).toBeGreaterThan(0);
    }
    // The same square the other way round gives the same faces.
    const other = prismOf([...SQUARE].reverse(), 12);
    expect(other.indices.length).toBe(p.indices.length);
    expect(other.normals.filter((n, i) => i % 3 === 2 && n === 1).length).toBe(4);
  });
  it('a flat footprint is its top alone, lifted off the ground; too few corners or a negative height are refused', () => {
    const p = prismOf(SQUARE, 0);
    expect(p.positions.length / 3).toBe(4);
    expect(p.indices.length / 3).toBe(2);
    expect(p.positions[2]).toBe(FLAT_LIFT_M);
    expect(() => prismOf(SQUARE.slice(0, 2), 1)).toThrow(RangeError);
    expect(() => prismOf(SQUARE, -1)).toThrow(RangeError);
  });
  it("the ledger's city described has a mesh a block, the scene's stories, and triangles that add up by kind", () => {
    const scene = sceneOf(starterLayout(), RATES, 'far');
    const d = describeScene(scene);
    expect(d.blocks).toBe(scene.blocks.length);
    expect(d.meshes.length).toBe(scene.blocks.length);
    expect(d.stories).toBe(scene.stories);
    expect(d.lit).toBe(scene.lit);
    expect(d.triangles).toBe(d.meshes.reduce((t, m) => t + m.triangles, 0));
    expect(Object.values(d.byKind).reduce((t, n) => t + (n ?? 0), 0)).toBe(d.triangles);
    // A strip of line is two triangles; a hexagonal neighborhood far is a fan of four and six sides of two.
    expect(d.meshes.find((m) => m.block.kind === 'line')?.triangles).toBe(2);
    expect(d.meshes.find((m) => m.block.kind === 'hood')?.triangles).toBe(4 + 6 * 2);
    expect(d.bounds).toEqual(boundsOf(scene));
  });
});

describe('the session IRL', () => {
  it('opens the city IRL fitted from any view, keeps the orbit it is given, forgets it on fit, and never saves it', () => {
    const store = memoryStore();
    const s = newSession({ layout: starterLayout(), clock: null }, store);
    expect(s.orbit).toBeNull();
    s.look('1,0');
    s.lookIrl();
    expect(s.view).toEqual({ at: 'irl' });
    expect(s.orbit).toBeNull();
    const o = fitOrbit(BOX, 1);
    s.setOrbit(o);
    expect(s.orbit).toBe(o);
    s.lookAway();
    expect(s.view).toEqual({ at: 'map' });
    expect(s.orbit).toBe(o);
    s.lookIrl();
    expect(s.orbit).toBeNull();
    s.setOrbit(o);
    s.setOrbit(null);
    expect(s.orbit).toBeNull();
    s.save();
    const saved = store.load() as Record<string, unknown> | null;
    expect(saved).not.toBeNull();
    expect(saved && 'orbit' in saved).toBe(false);
    expect(saved && 'view' in saved).toBe(false);
  });
});
