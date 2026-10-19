/**
 * @file The angled view's camera and extrusion, in numbers: a unit square under the plan-view camera is itself, a
 * tilt foreshortens depth, a height lifts a point by the known amount, the inverse round-trips, nearer is later, and
 * a block's faces are the sides that face the viewer, farthest first, then the top, each with its shade.
 * Owner context: Board (adapter), tests.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_CAMERA, cameraAt, depthOf, project, unproject } from '../src/draw/angled/projection.ts';
import type { Camera } from '../src/draw/angled/projection.ts';
import { STORY_M, blockDepth, extrude } from '../src/draw/angled/extrude.ts';

const plan: Camera = { yaw: 0, pitch: Math.PI / 2, scale: 1, origin: { x: 0, y: 0 } };
const tilted: Camera = { yaw: 0, pitch: Math.PI / 4, scale: 1, origin: { x: 0, y: 0 } };
const square = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];
const close = (a: number, b: number): void => expect(Math.abs(a - b)).toBeLessThan(1e-9);

describe('the camera', () => {
  it('under the plan view a unit square on the ground is itself', () => {
    expect(square.map((c) => project(c, plan))).toEqual(square);
  });

  it('a tilt foreshortens depth by the sine of the pitch and leaves x alone', () => {
    const p = project({ x: 3, y: 2 }, tilted);
    close(p.x, 3);
    close(p.y, 2 * Math.SQRT1_2);
  });

  it('a height lifts a point up the screen by its cosine of the pitch, and not at all in the plan view', () => {
    const ground = project({ x: 3, y: 2 }, tilted);
    const up = project({ x: 3, y: 2, z: 10 }, tilted);
    close(up.x, ground.x);
    close(ground.y - up.y, 10 * Math.SQRT1_2);
    close(project({ x: 3, y: 2, z: 10 }, plan).y, 2);
  });

  it('the scale and the origin place the ground on the screen, and the yaw turns it', () => {
    const cam: Camera = { yaw: 0, pitch: Math.PI / 4, scale: 10, origin: { x: 100, y: 50 } };
    const p = project({ x: 1, y: 1 }, cam);
    close(p.x, 110);
    close(p.y, 50 + 10 * Math.SQRT1_2);
    const quarter: Camera = { ...plan, yaw: Math.PI / 2 };
    const q = project({ x: 1, y: 0 }, quarter);
    close(q.x, 0);
    close(q.y, 1);
  });

  it('unproject is the inverse of project at the stated height, on any camera', () => {
    const cameras: Camera[] = [plan, tilted, DEFAULT_CAMERA, { yaw: 2.3, pitch: 0.4, scale: 7.5, origin: { x: -40, y: 300 } }];
    const points = [
      { x: 0, y: 0 },
      { x: 12.5, y: -3 },
      { x: -200, y: 450, z: 7 },
      { x: 1e4, y: 1e4, z: 96 },
    ];
    for (const cam of cameras) {
      for (const p of points) {
        const back = unproject(project(p, cam), cam, p.z ?? 0);
        close(back.x, p.x);
        close(back.y, p.y);
        expect(back.z).toBe(p.z ?? 0);
      }
    }
  });

  it('nearer the viewer is a larger depth, lower on the screen, and turns with the yaw; height changes nothing', () => {
    expect(depthOf({ x: 0, y: 5 }, tilted)).toBeGreaterThan(depthOf({ x: 0, y: 1 }, tilted));
    expect(project({ x: 0, y: 5 }, tilted).y).toBeGreaterThan(project({ x: 0, y: 1 }, tilted).y);
    const about: Camera = { ...tilted, yaw: Math.PI };
    expect(depthOf({ x: 0, y: 5 }, about)).toBeLessThan(depthOf({ x: 0, y: 1 }, about));
    close(depthOf({ x: 3, y: 4, z: 50 }, tilted), depthOf({ x: 3, y: 4 }, tilted));
  });

  it('refuses a pitch outside (0, π/2] and a scale that is not positive', () => {
    expect(() => cameraAt({ ...plan, pitch: 0 })).toThrow(RangeError);
    expect(() => cameraAt({ ...plan, pitch: Math.PI / 2 + 0.01 })).toThrow(RangeError);
    expect(() => cameraAt({ ...plan, scale: 0 })).toThrow(RangeError);
    expect(cameraAt(plan)).toBe(plan);
  });
});

describe('extrusion', () => {
  it('a block of no height is its footprint, one top face at full shade', () => {
    const faces = extrude({ corners: square, heightM: 0 }, tilted);
    expect(faces.length).toBe(1);
    expect(faces[0]?.kind).toBe('top');
    expect(faces[0]?.shade).toBe(1);
    expect(faces[0]?.points.length).toBe(4);
  });

  it('seen straight on, a block shows the one side that faces the viewer, then its top, the side rising by the height', () => {
    const cam: Camera = { yaw: 0, pitch: Math.PI / 3, scale: 1, origin: { x: 0, y: 0 } };
    const faces = extrude({ corners: square, heightM: 2 }, cam);
    expect(faces.map((f) => f.kind)).toEqual(['side', 'top']);
    const side = faces[0];
    if (!side) throw new Error('no side');
    // The side is the y = 1 edge: its ground corners sit at the foreshortened depth, its upper corners 2·cos(π/3) higher.
    for (const p of side.points.slice(0, 2)) close(p.y, Math.sin(Math.PI / 3));
    for (const p of side.points.slice(2)) close(p.y, Math.sin(Math.PI / 3) - 2 * Math.cos(Math.PI / 3));
    expect(side.points.map((p) => p.x).sort()).toEqual([0, 0, 1, 1]);
    // The top sits at the height.
    for (const p of faces[1]?.points ?? []) expect(p.y).toBeLessThanOrEqual(Math.sin(Math.PI / 3) - 2 * Math.cos(Math.PI / 3) + 1e-9);
  });

  it('turned a sixth, two sides face the viewer, the farther painted first, each shaded by its facing to the light', () => {
    const cam: Camera = { yaw: Math.PI / 6, pitch: Math.PI / 3, scale: 1, origin: { x: 0, y: 0 } };
    const faces = extrude({ corners: square, heightM: 2 }, cam);
    expect(faces.map((f) => f.kind)).toEqual(['side', 'side', 'top']);
    // The x = 1 side (normal +x) is farther than the y = 1 side (normal +y) at this turn, so it comes first.
    const first = faces[0]?.points.slice(0, 2).map((p) => unproject(p, cam)) ?? [];
    const second = faces[1]?.points.slice(0, 2).map((p) => unproject(p, cam)) ?? [];
    for (const p of first) close(p.x, 1);
    for (const p of second) close(p.y, 1);
    // Light comes from (-1, -1): the +x and +y sides are both in shadow.
    expect(faces[0]?.shade).toBe(0.45);
    expect(faces[1]?.shade).toBe(0.45);
    // Turned half way round, the sides facing the light show, lit.
    const lit = extrude({ corners: square, heightM: 2 }, { ...cam, yaw: Math.PI + Math.PI / 6 });
    expect(lit.map((f) => f.kind)).toEqual(['side', 'side', 'top']);
    for (const f of lit.slice(0, 2)) close(f.shade ?? 0, 0.45 + 0.5 * Math.SQRT1_2);
  });

  it('a footprint given clockwise paints the same faces as one given counter-clockwise', () => {
    const cam: Camera = { yaw: Math.PI / 6, pitch: Math.PI / 3, scale: 1, origin: { x: 0, y: 0 } };
    const ccw = extrude({ corners: square, heightM: 2 }, cam);
    const cw = extrude({ corners: [...square].reverse(), heightM: 2 }, cam);
    expect(cw.map((f) => f.kind)).toEqual(ccw.map((f) => f.kind));
    expect(cw.map((f) => f.shade)).toEqual(ccw.map((f) => f.shade));
    const xs = (fs: typeof ccw): number[] => fs.flatMap((f) => f.points.map((p) => Math.round(p.x * 1e6))).sort((a, b) => a - b);
    expect(xs(cw)).toEqual(xs(ccw));
  });

  it('a block in front has the larger depth, so sorting by it paints it last; a story is 3.2 m', () => {
    const near = { corners: square.map((c) => ({ x: c.x, y: c.y + 10 })), heightM: 1 };
    const far = { corners: square, heightM: 1 };
    expect(blockDepth(near, tilted)).toBeGreaterThan(blockDepth(far, tilted));
    expect([near, far].sort((a, b) => blockDepth(a, tilted) - blockDepth(b, tilted))).toEqual([far, near]);
    expect(STORY_M).toBe(3.2);
  });

  it('refuses a footprint under three corners and a height that is not a length', () => {
    expect(() => extrude({ corners: square.slice(0, 2), heightM: 1 }, tilted)).toThrow(RangeError);
    expect(() => extrude({ corners: square, heightM: -1 }, tilted)).toThrow(RangeError);
    expect(() => extrude({ corners: square, heightM: Number.NaN }, tilted)).toThrow(RangeError);
  });
});
