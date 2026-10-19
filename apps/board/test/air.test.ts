/**
 * @file The viewer from the air and the cost of a frame: near detail is one block a home held to the Ground's homes;
 * the camera turns, tilts, zooms about the middle and pans; a block outside the viewport is not painted; a month
 * tick where only who lives where changed repaints only the tiles whose lit share moved; and a city of 100,000
 * people at near detail paints a bounded number of blocks.
 * Owner context: Board (adapter), tests.
 */
import { describe, expect, it } from 'vitest';
import { planNeighborhood } from '@city/ground';
import { RULES, inHand, livingOf, startRun, tick, tickMonth } from '@city/run';
import type { Game } from '@city/run';
import { RATES, allTiles, emptyLayout, placeNeighborhood, starterLayout } from '@city/site';
import type { Layout } from '@city/site';
import { NEAR_SCALE, blockBox, changedTiles, fitCamera, lodFor, paintRegion, paintScene, regionOf } from '../src/draw/angled/canvas.ts';
import type { Painter, Palette, Region } from '../src/draw/angled/canvas.ts';
import { extrude } from '../src/draw/angled/extrude.ts';
import { unproject } from '../src/draw/angled/projection.ts';
import { sceneOf } from '../src/draw/angled/scene.ts';
import type { Standing } from '../src/draw/angled/scene.ts';
import { ANGLED_YAW, TILT_RAD, cameraFor } from '../src/draw/angled/view.ts';
import { move } from '../src/moves.ts';
import { AIR_START, ZOOM_MAX, newSession } from '../src/session.ts';
import { memoryStore } from '../src/storage.ts';

const hood = planNeighborhood(RATES.shared, RATES.walking, RATES.base);
const PALETTE: Palette = { hood: 'H', ring: 'R', power: 'P', water: 'W', sewage: 'S', waste: 'T', line: 'L', site: 'X', siteline: 'Y' };
const close = (a: number, b: number): void => expect(Math.abs(a - b)).toBeLessThan(1e-6);

/** A painter that counts, and records its clips. */
function counting(): Painter & { faces: number; colors: string[]; clips: Region[]; unclips: number } {
  const p = {
    faces: 0,
    colors: [] as string[],
    clips: [] as Region[],
    unclips: 0,
    fillPolygon(_points: readonly { x: number; y: number }[], color: string) {
      p.faces++;
      p.colors.push(color);
    },
    clip(region: Region) {
      p.clips.push(region);
    },
    unclip() {
      p.unclips++;
    },
  };
  return p;
}

function standingOf(game: Game): Standing {
  const clock = game.clock;
  if (!clock) return {};
  const hand = inHand(game.layout, clock.jobs, RULES, clock.inOrder === true);
  return { sites: hand.sites, lines: hand.lines, occupied: livingOf(game.layout, clock, RATES).occupied ?? null };
}

/** The browser flows' founding, run to the start of year 4. */
function foundedYear3(): Game {
  let game = startRun(emptyLayout(), 7, RATES, RULES, { growth: true, inOrder: true });
  const orders: [string, string][] = [
    ['power', '3,-1'],
    ['power', '3,-1'],
    ['water', '3,-2'],
    ['sewage', '-3,1'],
    ['waste', '-3,2'],
    ['hood', '1,0'],
    ['hood', '2,-1'],
  ];
  for (const [tool, key] of orders) game = move(game, tool as never, key, null).game;
  for (let y = 1; y <= 3; y++) game = tick(game, RATES, RULES);
  return game;
}

/** The ledger's city grown to twenty neighborhoods, 100,000 people, on whatever open tiles take them. */
function city100k(): Layout {
  let layout = starterLayout();
  let hoods = Object.values(layout.tiles).filter((t) => t?.kind === 'hood').length;
  for (const k of allTiles(RATES.outline)) {
    if (hoods >= 20) break;
    if (layout.tiles[k]) continue;
    const o = placeNeighborhood(layout, k, RATES);
    if (o.ok) {
      layout = o.layout;
      hoods++;
    }
  }
  if (hoods < 20) throw new Error(`only ${hoods} neighborhoods fit`);
  return layout;
}

describe('near detail: every home', () => {
  it("a neighborhood is the Ground's homes, each a front wide and the row deep, lit home by home", () => {
    const scene = sceneOf(starterLayout(), RATES, 'near', { occupied: { '1,0': RATES.hood / 2 } });
    const homes = scene.blocks.filter((b) => b.kind === 'hood' && b.key === '1,0');
    expect(homes.length).toBe(hood.figures.homes);
    expect(homes.length).toBe(hood.surface.rows.reduce((t, r) => t + r.homes, 0));
    expect(homes.reduce((t, b) => t + b.stories, 0)).toBe(hood.figures.homes * (hood.surface.rows[0]?.stories ?? 0));
    const first = homes[0];
    const row = hood.surface.rows[0];
    if (!first || !row) throw new Error('home');
    const [a, b, c] = first.block.corners;
    if (!a || !b || !c) throw new Error('home');
    close(Math.hypot(b.x - a.x, b.y - a.y), row.frontageM / row.homes);
    close(Math.hypot(c.x - b.x, c.y - b.y), hood.figures.rowDepthM);
    expect(homes.filter((h) => h.lit === 1).length).toBe(Math.round(hood.figures.homes / 2));
    expect(homes.every((h) => h.lit === 0 || h.lit === 1)).toBe(true);
    expect(lodFor(NEAR_SCALE)).toBe('near');
    expect(lodFor(NEAR_SCALE / 2)).toBe('mid');
  });
});

describe('the viewer', () => {
  it('turns by quarters, tilts round three, zooms within bounds scaling the pan, pans, and fits again', () => {
    const s = newSession({ layout: starterLayout(), clock: null }, memoryStore());
    expect(s.air).toEqual(AIR_START);
    s.turnAir();
    expect(s.air.turn).toBe(1);
    s.turnAir();
    s.turnAir();
    s.turnAir();
    expect(s.air.turn).toBe(0);
    s.tiltAir();
    expect(s.air.tilt).toBe('high');
    s.tiltAir();
    expect(s.air.tilt).toBe('low');
    s.tiltAir();
    expect(s.air.tilt).toBe('mid');
    s.panAir(10, -4);
    expect(s.air.pan).toEqual({ x: 10, y: -4 });
    s.zoomAir(2);
    expect(s.air.zoom).toBe(2);
    expect(s.air.pan).toEqual({ x: 20, y: -8 });
    s.zoomAir(1 / 4);
    expect(s.air.zoom).toBe(1);
    expect(s.air.pan).toEqual({ x: 10, y: -4 });
    s.zoomAir(1e9);
    expect(s.air.zoom).toBe(ZOOM_MAX);
    s.zoomAir(0);
    expect(s.air.zoom).toBe(ZOOM_MAX);
    s.turnAir();
    s.fitAir();
    expect(s.air).toEqual({ turn: 1, tilt: 'mid', zoom: 1, pan: { x: 0, y: 0 } });
  });

  it('the camera is the fit at the turn and tilt; a zoom keeps the middle fixed and scales; a pan slides the origin', () => {
    const scene = sceneOf(starterLayout(), RATES, 'far');
    const fit = fitCamera(scene, 960, 600, ANGLED_YAW, TILT_RAD.mid);
    expect(cameraFor(scene, AIR_START, 960, 600)).toEqual(fit);
    const turned = cameraFor(scene, { ...AIR_START, turn: 1, tilt: 'low' }, 960, 600);
    close(turned.yaw, ANGLED_YAW + Math.PI / 2);
    close(turned.pitch, TILT_RAD.low);
    const zoomed = cameraFor(scene, { ...AIR_START, zoom: 3 }, 960, 600);
    close(zoomed.scale, fit.scale * 3);
    const middleBefore = unproject({ x: 480, y: 300 }, fit);
    const middleAfter = unproject({ x: 480, y: 300 }, zoomed);
    close(middleBefore.x, middleAfter.x);
    close(middleBefore.y, middleAfter.y);
    const panned = cameraFor(scene, { ...AIR_START, pan: { x: 25, y: -7 } }, 960, 600);
    close(panned.origin.x, fit.origin.x + 25);
    close(panned.origin.y, fit.origin.y - 7);
  });
});

describe('what a frame costs', () => {
  it('a block outside the viewport is not painted; one inside is; the whole viewport paints the whole scene', () => {
    const scene = sceneOf(starterLayout(), RATES, 'far');
    const cam = fitCamera(scene, 960, 600, ANGLED_YAW, TILT_RAD.mid);
    const all = counting();
    const whole = paintScene(all, scene, cam, PALETTE);
    const inView = counting();
    expect(paintScene(inView, scene, cam, PALETTE, { width: 960, height: 600 })).toBe(whole);
    const away = counting();
    expect(paintScene(away, scene, { ...cam, origin: { x: 100000, y: 100000 } }, PALETTE, { width: 960, height: 600 })).toBe(0);
    // A viewport holding only the ring's middle paints the ring and what overlaps it, not every tile.
    const ringBox = scene.blocks.filter((b) => b.kind === 'ring').map((b) => blockBox(b.block, cam));
    const x = Math.min(...ringBox.map((b) => b.x0));
    const y = Math.min(...ringBox.map((b) => b.y0));
    const narrow = counting();
    const near = { ...cam, origin: { x: cam.origin.x - x, y: cam.origin.y - y } };
    const some = paintScene(narrow, scene, near, PALETTE, { width: 30, height: 30 });
    expect(some).toBeGreaterThan(0);
    expect(some).toBeLessThan(whole);
    expect(narrow.colors).toContain('R');
  });

  it('a month where only who lives where changed repaints only the tiles whose lit share moved, clipped once', () => {
    const before = foundedYear3();
    const after = tickMonth(before, RATES, RULES);
    const sceneBefore = sceneOf(before.layout, RATES, 'far', standingOf(before));
    const sceneAfter = sceneOf(after.layout, RATES, 'far', standingOf(after));
    const occBefore = standingOf(before).occupied ?? {};
    const occAfter = standingOf(after).occupied ?? {};
    const moved = Object.keys(occAfter).filter((k) => (occBefore[k] ?? 0) !== (occAfter[k] ?? 0)).sort();
    expect(moved.length).toBeGreaterThan(0);
    expect(changedTiles(sceneBefore, sceneAfter)).toEqual(moved);
    const cam = fitCamera(sceneAfter, 960, 600, ANGLED_YAW, TILT_RAD.mid);
    const region = regionOf(sceneAfter, moved, cam);
    if (!region) throw new Error('no region');
    for (const b of sceneAfter.blocks.filter((b) => moved.includes(b.key))) {
      const box = blockBox(b.block, cam);
      expect(box.x0).toBeGreaterThanOrEqual(region.x0);
      expect(box.x1).toBeLessThanOrEqual(region.x1);
      expect(box.y0).toBeGreaterThanOrEqual(region.y0);
      expect(box.y1).toBeLessThanOrEqual(region.y1);
    }
    const whole = paintScene(counting(), sceneAfter, cam, PALETTE);
    const part = counting();
    const faces = paintRegion(part, sceneAfter, cam, PALETTE, region);
    expect(faces).toBe(part.faces);
    expect(faces).toBeLessThan(whole);
    expect(part.clips).toEqual([region]);
    expect(part.unclips).toBe(1);
    // Exactly the blocks whose box touches the region, no others.
    const touching = sceneAfter.blocks.filter((b) => {
      const box = blockBox(b.block, cam);
      return box.x0 <= region.x1 && region.x0 <= box.x1 && box.y0 <= region.y1 && region.y0 <= box.y1;
    });
    expect(faces).toBe(touching.reduce((t, b) => t + extrude(b.block, cam).length, 0));
    // Nothing moved: no tile to repaint.
    expect(changedTiles(sceneAfter, sceneAfter)).toEqual([]);
    expect(regionOf(sceneAfter, [], cam)).toBeNull();
  });

  it('a city of 100,000 at near detail is about 40,000 homes, and a frame of it paints under the cap', () => {
    const layout = city100k();
    const near = sceneOf(layout, RATES, 'near');
    const homes = near.blocks.filter((b) => b.kind === 'hood').length;
    expect(homes).toBe(20 * hood.figures.homes);
    expect(homes).toBeGreaterThan(40000);
    // The viewer nearer by enough for homes, looking at the middle: the viewport holds a bounded number of blocks.
    const far = sceneOf(layout, RATES, 'far');
    const fit = cameraFor(far, AIR_START, 960, 600);
    const zoom = Math.ceil(NEAR_SCALE / fit.scale) + 1;
    // Nearer by that much about the middle of the site, then slid so the ring is in the middle of the canvas.
    const zoomed = cameraFor(near, { ...AIR_START, zoom }, 960, 600);
    const ring = near.blocks.find((b) => b.kind === 'ring');
    if (!ring) throw new Error('no ring');
    const ringBox = blockBox(ring.block, zoomed);
    const pan = { x: 480 - (ringBox.x0 + ringBox.x1) / 2, y: 300 - (ringBox.y0 + ringBox.y1) / 2 };
    const cam = cameraFor(near, { ...AIR_START, zoom, pan }, 960, 600);
    expect(lodFor(cam.scale)).toBe('near');
    const painter = counting();
    const faces = paintScene(painter, near, cam, PALETTE, { width: 960, height: 600 });
    const CAP = 8000;
    const inView = near.blocks.filter((b) => {
      const box = blockBox(b.block, cam);
      return box.x0 <= 960 && 0 <= box.x1 && box.y0 <= 600 && 0 <= box.y1;
    }).length;
    expect(inView).toBeGreaterThan(0);
    expect(inView).toBeLessThanOrEqual(CAP);
    expect(faces).toBeLessThanOrEqual(3 * inView);
    // A month's repaint on one tile touches a small part of the frame.
    const one = Object.keys(layout.tiles).find((k) => layout.tiles[k]?.kind === 'hood') as string;
    const dimmed = sceneOf(layout, RATES, 'near', { occupied: { [one]: 0 } });
    expect(changedTiles(near, dimmed)).toEqual([one]);
    // A month's repaint on one tile, clamped to the canvas as the page clamps it, paints no more than the frame.
    const region = regionOf(dimmed, [one], cam);
    if (!region) throw new Error('no region');
    const clamped = { x0: Math.max(0, region.x0), y0: Math.max(0, region.y0), x1: Math.min(960, region.x1), y1: Math.min(600, region.y1) };
    expect(paintRegion(counting(), dimmed, cam, PALETTE, clamped)).toBeLessThanOrEqual(faces);
  });
});
