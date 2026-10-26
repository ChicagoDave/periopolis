/**
 * @file Streets and open ground held to the Ground's numbers: a street lies between an odd line of rows and the even
 * one after it when they are one pitch apart, spans the union of their rows, is 8 m of shared surface between two
 * 2 m sidewalks with kerbs, and has a crossing at each end; every strip lies on the tile; the lane runs the plan's
 * three edges; the park gets a ring path and a cross; the center and the plaza are furnished with lamps and
 * planters facing the middle; and the describer carries it all through with a terrain whose shore lies south of
 * every tile.
 * Owner context: Board (adapter), tests.
 */
import { describe, expect, it } from 'vitest';
import { planNeighborhood, planRing } from '@city/ground';
import { RATES, starterLayout } from '@city/site';
import { sceneOf } from '../src/draw/angled/scene.ts';
import { describeScene } from '../src/draw/irl/describe.ts';
import { CROSSING_M, LANE_M, SIDEWALK_M, STREET_M, plazaOf, streetsOf } from '../src/draw/irl/streets.ts';

const hood = planNeighborhood(RATES.shared, RATES.walking, RATES.base);
const close = (a: number, b: number, eps = 1e-6): void => expect(Math.abs(a - b)).toBeLessThan(eps);
const at = { x: 1000, y: -500 };
const laid = streetsOf(hood, at);
const lines = [...new Set(hood.surface.rows.map((r) => Math.round(r.y * 100) / 100))].sort((a, b) => a - b);

describe('the streets', () => {
  it('lie between an odd line and the even one after it, one pitch apart, as many as such pairs', () => {
    let pairs = 0;
    for (let i = 1; i + 1 < lines.length; i += 2) if (Math.abs((lines[i + 1] as number) - (lines[i] as number) - hood.figures.rowPitchM) < 1e-6) pairs++;
    expect(laid.streets).toBe(pairs);
    expect(laid.streets).toBeGreaterThan(8);
    expect(laid.crossings).toBe(2 * pairs);
    expect(laid.strips.filter((s) => s.kind === 'asphalt').length).toBe(pairs);
    expect(laid.strips.filter((s) => s.kind === 'sidewalk').length).toBe(2 * pairs);
    expect(laid.strips.filter((s) => s.kind === 'kerb').length).toBe(2 * pairs);
    expect(laid.strips.filter((s) => s.kind === 'crossing').length).toBe(2 * pairs);
  });
  it('are 8 m of shared surface between 2 m sidewalks, the kerb inside the sidewalk, crossings 4 m long at each end, spanning the rows they serve', () => {
    const asphalt = laid.strips.filter((s) => s.kind === 'asphalt');
    for (const s of asphalt) {
      const ys = s.corners.map((c) => c.y);
      close(Math.max(...ys) - Math.min(...ys), STREET_M);
      const xs = s.corners.map((c) => c.x);
      const x0 = Math.min(...xs) - at.x;
      const x1 = Math.max(...xs) - at.x;
      const mid = (Math.max(...ys) + Math.min(...ys)) / 2 - at.y;
      // The street's middle lies halfway between its two lines; the rows on those lines span its length.
      const above = lines.filter((y) => y < mid).pop() as number;
      const below = lines.find((y) => y > mid) as number;
      close(mid, (above + below) / 2);
      const rows = hood.surface.rows.filter((r) => Math.round(r.y * 100) / 100 === above || Math.round(r.y * 100) / 100 === below);
      close(x0, Math.min(...rows.map((r) => r.x0)));
      close(x1, Math.max(...rows.map((r) => r.x1)));
      // A sidewalk and a kerb lie just outside each edge; a crossing at each end.
      const sidewalks = laid.strips.filter((k) => k.kind === 'sidewalk' && k.corners.every((c) => Math.abs(c.x - at.x - x0) < 1e-6 || Math.abs(c.x - at.x - x1) < 1e-6));
      expect(sidewalks.length).toBeGreaterThanOrEqual(2);
      const crossings = laid.strips.filter((k) => k.kind === 'crossing' && k.corners.every((c) => c.y >= Math.min(...ys) - 1e-6 && c.y <= Math.max(...ys) + 1e-6));
      expect(crossings.length).toBe(2);
      for (const c of crossings) {
        const cx = c.corners.map((p) => p.x);
        close(Math.max(...cx) - Math.min(...cx), CROSSING_M);
      }
    }
    const side = laid.strips.find((s) => s.kind === 'sidewalk');
    if (!side) throw new Error('sidewalk');
    const sy = side.corners.map((c) => c.y);
    close(Math.max(...sy) - Math.min(...sy), SIDEWALK_M - 0.25);
  });
  it("every strip lies on the tile, the lane runs the plan's three edges 3 m wide, the park has a ring path and a cross, the center twelve props facing the middle", () => {
    const r = hood.frame.cornerM;
    // The lane runs the tile's edges, so half its width lies over them; everything else lies inside.
    for (const s of laid.strips) for (const c of s.corners) {
      const slack = s.kind === 'lane' ? LANE_M / 2 : 0;
      expect(Math.abs(c.x - at.x)).toBeLessThanOrEqual((r * Math.sqrt(3)) / 2 + slack + 1e-6);
      expect(Math.abs(c.y - at.y)).toBeLessThanOrEqual(r + slack + 1e-6);
    }
    const lane = laid.strips.filter((s) => s.kind === 'lane');
    expect(lane.length).toBe(hood.surface.lane.length);
    for (const l of lane) {
      const [a, b, c] = l.corners;
      if (!a || !b || !c) throw new Error('lane');
      close(Math.hypot(c.x - b.x, c.y - b.y), LANE_M);
    }
    expect(laid.strips.filter((s) => s.kind === 'parkpath').length).toBe(24 + 2);
    // The center's furniture, apart from the bulk vegetation along the streets (traffic.test.ts holds that).
    const furniture = laid.props.filter((p) => !p.bulk);
    expect(furniture.length).toBe(12);
    expect(furniture.filter((p) => p.model === 'lamp-double').length).toBe(6);
    expect(furniture.filter((p) => p.model === 'planter').length).toBe(6);
    const centre = { x: at.x + hood.surface.center.at.x, y: at.y + hood.surface.center.at.y };
    for (const p of furniture) {
      expect(Math.hypot(p.x - centre.x, p.y - centre.y)).toBeLessThan(hood.surface.center.radiusM);
      // Facing south is yaw 0; the prop's heading (sin yaw, cos yaw) points at the middle.
      const toMid = Math.atan2(centre.x - p.x, centre.y - p.y);
      close(Math.atan2(Math.sin(p.yaw - toMid), Math.cos(p.yaw - toMid)), 0, 1e-6);
    }
    const plaza = plazaOf(planRing(RATES.walking, RATES.base, 8), at);
    expect(plaza.props.length).toBe(16);
    expect(plaza.strips.length).toBe(0);
  });
});

describe('the city described with its streets', () => {
  const layout = starterLayout();
  it("near, every neighborhood carries its streets, crossings and props, the ring its plaza furniture, and the terrain's shore lies south of every tile; far, no street is laid", () => {
    const near = describeScene(sceneOf(layout, RATES, 'near'), { rates: RATES, layout });
    const hoods = Object.values(layout.tiles).filter((t) => t?.kind === 'hood').length;
    expect(near.streets).toBe(hoods * laid.streets);
    expect(near.crossings).toBe(hoods * laid.crossings);
    // Twelve a center and sixteen round the ring's plaza, plus the towers, the plants' works and the schools (ADR-0024).
    expect(near.props).toBe(near.chunks.reduce((t, c) => t + c.props.length, 0));
    expect(near.props).toBeGreaterThanOrEqual(hoods * 12 + 16 + 8);
    expect(near.chunks.flatMap((c) => c.props).filter((p) => p.model === 'lamp-double' || p.model === 'planter').length).toBe(hoods * 12 + 16);
    const chunk = near.chunks.find((c) => c.key === '1,0');
    if (!chunk) throw new Error('chunk');
    expect(chunk.meshes.filter((m) => m.material === 'asphalt').length).toBe(laid.streets);
    expect(chunk.meshes.filter((m) => m.material === 'lane').length).toBe(3);
    expect(chunk.meshes.filter((m) => m.material === 'path').length).toBe(0);
    expect(chunk.props.filter((p) => p.model === 'lamp-double' || p.model === 'planter').length).toBe(12);
    const terrain = near.terrain;
    if (!terrain) throw new Error('terrain');
    for (const b of near.chunks.flatMap((c) => c.meshes)) for (let i = 1; i < b.prism.positions.length; i += 3) expect(b.prism.positions[i] as number).toBeLessThan(terrain.shoreY);
    expect(terrain.east).toBeGreaterThan(terrain.west);
    expect(terrain.north).toBeLessThan(terrain.shoreY);
    const far = describeScene(sceneOf(layout, RATES, 'far'), { rates: RATES, layout });
    expect(far.streets).toBe(0);
    expect(far.props).toBe(0);
    // Described twice, the same.
    expect(JSON.stringify(describeScene(sceneOf(layout, RATES, 'near'), { rates: RATES, layout }))).toBe(JSON.stringify(near));
  });
});
