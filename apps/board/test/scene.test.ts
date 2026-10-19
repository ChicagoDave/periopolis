/**
 * @file The angled view's scene held to the Ground's sums and the Site's layout: a block a neighborhood far and a
 * block a row mid, a block a ring building with the ring's stories, a block a plant, a strip a stretch; the tile
 * lattice in metres; the camera fitted inside the canvas; the painter handed every face, far to near, coloured by
 * kind; and the session's view from the air.
 * Owner context: Board (adapter), tests.
 */
import { describe, expect, it } from 'vitest';
import { planNeighborhood, planRing } from '@city/ground';
import { RATES, emptyLayout, starterLayout } from '@city/site';
import type { Layout } from '@city/site';
import { MID_SCALE, fitCamera, lodFor, paintScene } from '../src/draw/angled/canvas.ts';
import type { Painter, Palette } from '../src/draw/angled/canvas.ts';
import { STORY_M, blockDepth, extrude } from '../src/draw/angled/extrude.ts';
import { project } from '../src/draw/angled/projection.ts';
import { LINE_WIDTH_M, PLANT_STORIES, sceneOf, tileCenterM } from '../src/draw/angled/scene.ts';
import { newSession } from '../src/session.ts';
import { memoryStore } from '../src/storage.ts';
import { angledCaption } from '../src/wording.ts';

const hood = planNeighborhood(RATES.shared, RATES.walking, RATES.base);
const ring = planRing(RATES.walking, RATES.base, 8);
const R = RATES.tileKm * 1000;
const close = (a: number, b: number): void => expect(Math.abs(a - b)).toBeLessThan(1e-6);
const count = (layout: Layout, kind: string): number => Object.values(layout.tiles).filter((t) => t?.kind === kind).length;
const PALETTE: Palette = { hood: 'H', ring: 'R', power: 'P', water: 'W', sewage: 'S', waste: 'T', line: 'L' };

describe('the tile lattice in metres', () => {
  it("a tile's middle is the map's hex lattice at the Ledger's tile radius", () => {
    expect(tileCenterM('0,0', RATES)).toEqual({ x: 0, y: 0 });
    const east = tileCenterM('1,0', RATES);
    close(east.x, Math.sqrt(3) * R);
    close(east.y, 0);
    const south = tileCenterM('0,1', RATES);
    close(south.x, (Math.sqrt(3) * R) / 2);
    close(south.y, 1.5 * R);
    // Neighbouring middles are one step apart, the Site's stepKm.
    close(Math.hypot(east.x, east.y), RATES.stepKm * 1000);
  });
});

describe("the scene of the ledger's city", () => {
  const layout = starterLayout();
  const far = sceneOf(layout, RATES, 'far');
  const mid = sceneOf(layout, RATES, 'mid');
  const hoods = count(layout, 'hood');
  const plants = ['power', 'water', 'sewage', 'waste'].reduce((t, k) => t + count(layout, k), 0);
  const stretches = Object.keys(layout.lines).length;

  it('far: one block a neighborhood at its stories, a block a ring building, a block a plant, a strip a stretch', () => {
    expect(far.blocks.filter((b) => b.kind === 'hood').length).toBe(hoods);
    for (const b of far.blocks.filter((b) => b.kind === 'hood')) {
      expect(b.stories).toBe(hood.surface.rows[0]?.stories);
      expect(b.block.corners.length).toBe(6);
      close(b.block.heightM, b.stories * STORY_M);
      // The hexagon lies on its tile: every corner within the tile radius of the middle.
      const c = tileCenterM(b.key, RATES);
      for (const p of b.block.corners) expect(Math.hypot(p.x - c.x, p.y - c.y)).toBeLessThanOrEqual(R + 1e-6);
    }
    expect(far.blocks.filter((b) => b.kind === 'ring').length).toBe(ring.figures.buildings);
    expect(far.blocks.filter((b) => b.kind === 'ring').reduce((t, b) => t + b.stories, 0)).toBe(ring.figures.buildings * ring.figures.stories);
    expect(far.blocks.filter((b) => b.kind !== 'hood' && b.kind !== 'ring' && b.kind !== 'line').length).toBe(plants);
    for (const b of far.blocks.filter((b) => b.kind === 'power')) expect(b.stories).toBe(PLANT_STORIES);
    const strips = far.blocks.filter((b) => b.kind === 'line');
    expect(strips.length).toBe(stretches);
    for (const strip of strips) {
      expect(strip.stories).toBe(0);
      expect(strip.block.heightM).toBe(0);
      const [a, b, c] = strip.block.corners;
      if (!a || !b || !c) throw new Error('strip');
      close(Math.hypot(b.x - c.x, b.y - c.y), LINE_WIDTH_M);
    }
    // The strips come first, so they lie under everything.
    expect(far.blocks.slice(0, stretches).every((b) => b.kind === 'line')).toBe(true);
    expect(far.stories).toBe(far.blocks.reduce((t, b) => t + b.stories, 0));
  });

  it("mid: a neighborhood is its rows, the Ground's count and stories, each row a slab of the row depth", () => {
    const rows = mid.blocks.filter((b) => b.kind === 'hood');
    expect(rows.length).toBe(hoods * hood.figures.rows);
    expect(rows.reduce((t, b) => t + b.stories, 0)).toBe(hoods * hood.surface.rows.reduce((t, r) => t + r.stories, 0));
    const one = rows[0];
    if (!one) throw new Error('row');
    const [a, b, c] = one.block.corners;
    if (!a || !b || !c) throw new Error('row');
    close(Math.hypot(c.x - b.x, c.y - b.y), hood.figures.rowDepthM);
    close(Math.hypot(b.x - a.x, b.y - a.y), hood.surface.rows[0]?.frontageM ?? 0);
    // The ring, the plants and the strips are as they are far.
    expect(mid.blocks.filter((b) => b.kind === 'ring').length).toBe(far.blocks.filter((b) => b.kind === 'ring').length);
    expect(mid.blocks.filter((b) => b.kind === 'line').length).toBe(stretches);
    expect(mid.stories - far.stories).toBe(hoods * (hood.surface.rows.reduce((t, r) => t + r.stories, 0) - (hood.surface.rows[0]?.stories ?? 0)));
  });

  it('an empty site is an empty scene', () => {
    const none = sceneOf(emptyLayout(), RATES, 'far');
    expect(none.blocks).toEqual([]);
    expect(none.stories).toBe(0);
  });
});

describe('the camera fitted to the canvas, and the detail a scale deserves', () => {
  it('every corner of every block, on the ground and at its height, lands inside the margin', () => {
    const scene = sceneOf(starterLayout(), RATES, 'far');
    const cam = fitCamera(scene, 960, 600, Math.PI / 6, Math.PI / 3, 16);
    expect(cam.scale).toBeGreaterThan(0);
    for (const b of scene.blocks) {
      for (const c of b.block.corners) {
        for (const z of [0, b.block.heightM]) {
          const p = project({ ...c, z }, cam);
          expect(p.x).toBeGreaterThanOrEqual(16 - 1e-6);
          expect(p.x).toBeLessThanOrEqual(960 - 16 + 1e-6);
          expect(p.y).toBeGreaterThanOrEqual(16 - 1e-6);
          expect(p.y).toBeLessThanOrEqual(600 - 16 + 1e-6);
        }
      }
    }
    // The whole site in 960 px is far; rows want a quarter pixel a metre.
    expect(lodFor(cam.scale)).toBe('far');
    expect(lodFor(MID_SCALE)).toBe('mid');
    expect(lodFor(MID_SCALE / 2)).toBe('far');
  });

  it('an empty scene gets the camera at unit scale in the middle', () => {
    const cam = fitCamera(sceneOf(emptyLayout(), RATES, 'far'), 400, 300, 0, Math.PI / 2);
    expect(cam.scale).toBe(1);
    expect(cam.origin).toEqual({ x: 200, y: 150 });
  });
});

describe('painting', () => {
  it('hands the painter every face: the strips on the ground first, then every block farthest first, coloured by kind and shaded', () => {
    const scene = sceneOf(starterLayout(), RATES, 'far');
    const cam = fitCamera(scene, 960, 600, Math.PI / 6, Math.PI / 3);
    const calls: { points: number; color: string; shade: number }[] = [];
    const painter: Painter = { fillPolygon: (points, color, shade) => calls.push({ points: points.length, color, shade }) };
    const faces = paintScene(painter, scene, cam, PALETTE);
    expect(faces).toBe(calls.length);
    expect(faces).toBe(scene.blocks.reduce((t, b) => t + extrude(b.block, cam).length, 0));
    // The order: what lies flat first, in the scene's order, then the rising blocks by depth, nearest last.
    const flat = scene.blocks.filter((b) => b.block.heightM === 0);
    const rising = scene.blocks.filter((b) => b.block.heightM > 0).sort((a, b) => blockDepth(a.block, cam) - blockDepth(b.block, cam));
    const ordered = [...flat, ...rising];
    let i = 0;
    for (const b of ordered) {
      for (const face of extrude(b.block, cam)) {
        expect(calls[i]?.color).toBe(PALETTE[b.kind]);
        expect(calls[i]?.shade).toBe(face.shade);
        expect(calls[i]?.points).toBe(face.points.length);
        i++;
      }
    }
    // Strips are flat: one face each, the top, at full shade, and all of them before the first rising block.
    const strips = calls.filter((c) => c.color === 'L');
    expect(strips.length).toBe(Object.keys(starterLayout().lines).length);
    for (const s of strips) expect(s.shade).toBe(1);
    expect(calls.slice(0, strips.length).every((c) => c.color === 'L')).toBe(true);
  });
});

describe('the session from the air', () => {
  it('looks at the site from the air from the map or a tile, keeps it through a refresh, and comes back', () => {
    const s = newSession({ layout: starterLayout(), clock: null }, memoryStore());
    s.lookAngled();
    expect(s.view).toEqual({ at: 'angled' });
    s.refresh();
    expect(s.view).toEqual({ at: 'angled' });
    s.showLevel('sub');
    expect(s.view).toEqual({ at: 'angled' });
    expect(s.look('1,0')).toBe(true);
    s.lookAngled();
    expect(s.view).toEqual({ at: 'angled' });
    s.lookAway();
    expect(s.view).toEqual({ at: 'map' });
  });

  it('the caption counts what was painted', () => {
    expect(angledCaption(0, 0)).toBe('The site from the air. Nothing stands yet.');
    expect(angledCaption(1, 3)).toBe('The site from the air: 1 block, 3 stories in all.');
    expect(angledCaption(27, 1234)).toBe('The site from the air: 27 blocks, 1,234 stories in all.');
  });
});
