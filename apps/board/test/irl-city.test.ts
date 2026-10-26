/**
 * @file The living city IRL held to numbers: a facade is the same sheet every time with its windows, door and
 * ledges counted; the describer gives a neighborhood every one of the Ground's homes as an instance facing its
 * street, lit by the share of people living there, trees inside the park, the park, center and lane, the ring's
 * plaza, a scaffold with a crane and a survey strip on the clock; the same scene describes byte for byte the same;
 * only the chunk whose tile changed changes its signature; and the ledger's city at 100,000 people describes within
 * a bounded time.
 * Owner context: Board (adapter), tests.
 */
import { describe, expect, it } from 'vitest';
import { planNeighborhood, planRing } from '@city/ground';
import { RULES, inHand, livingOf, namedClosures, startRun, stressAt, tick, tickMonth } from '@city/run';
import type { Game } from '@city/run';
import { RATES, allTiles, applyProposal, edgeEnds, edgeKey, emptyLayout, lineNetwork, placeNeighborhood, proposeFor, proposeNeighborhood, starterLayout } from '@city/site';
import type { Layout } from '@city/site';
import { litRows, sceneOf, tileCenterM } from '../src/draw/angled/scene.ts';
import type { Standing } from '../src/draw/angled/scene.ts';
import { HOME_TRIANGLES, SUB_DEPTH_M, TREE_SPACING_M, describeScene } from '../src/draw/irl/describe.ts';
import { HOME_VARIANTS, STOREY_M, hashOf, homeFacade, officeFacade, plantFacade, randomOf, variantOf } from '../src/draw/irl/facade.ts';
import { move } from '../src/moves.ts';

const hood = planNeighborhood(RATES.shared, RATES.walking, RATES.base);
const close = (a: number, b: number, eps = 1e-6): void => expect(Math.abs(a - b)).toBeLessThan(eps);
const context = (layout: Layout) => ({ rates: RATES, layout });

function standingOf(game: Game): Standing {
  const clock = game.clock;
  if (!clock) return {};
  const hand = inHand(game.layout, clock.jobs, RULES, clock.inOrder === true);
  return { sites: hand.sites, lines: hand.lines, occupied: livingOf(game.layout, clock, RATES).occupied ?? null };
}

/** The browser flows' founding: six tiles ordered, run to the start of a year. */
function founded(years: number): Game {
  let game = startRun(emptyLayout(), 7, RATES, RULES, { growth: true, inOrder: true });
  const orders: [string, string][] = [
    ['power', '4,0'],
    ['power', '4,0'],
    ['water', '-4,0'],
    ['sewage', '-4,3'],
    ['waste', '-4,2'],
    ['hood', '1,0'],
    ['hood', '2,-1'],
  ];
  for (const [tool, key] of orders) game = move(game, tool as never, key, null).game;
  for (let y = 1; y <= years; y++) game = tick(game, RATES, RULES);
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

/** Accept every proposal with room until the layout needs nothing (the Run's own test helper). */
function settle(layout: Layout): Layout {
  let s = layout;
  for (let round = 0; round < 50; round++) {
    const steps = proposeFor(s, RATES).flatMap((p) => (p.room ? p.steps : []));
    if (!steps.length) return s;
    const a = applyProposal(s, steps, RATES);
    if (!a.ok) throw new Error(a.rejection.reason);
    s = a.layout;
  }
  throw new Error('never settled');
}

/** A first circle filled by the Site's own proposals: 36 neighborhoods and what they call for. */
function fullCircle(): Layout {
  let s = emptyLayout();
  for (let i = 0; i < 40; i++) {
    const at = proposeNeighborhood(s, RATES);
    if (!at) return s;
    const o = placeNeighborhood(s, at, RATES);
    if (!o.ok) throw new Error(o.rejection.reason);
    s = settle(o.layout);
  }
  throw new Error('the circle never filled');
}

describe('the facades', () => {
  it('a townhouse front has two bays and three floors: five windows, a door on the ground floor, a sill under each window and a band a floor', () => {
    const sheet = homeFacade(0);
    expect(sheet.widthM).toBe(6);
    expect(sheet.heightM).toBe(3 * STOREY_M);
    expect(sheet.windows.length).toBe(5);
    expect(sheet.door).toEqual({ x: 1.0, y: 0, w: 1.0, h: 2.2 });
    expect(sheet.ledges.length).toBe(5 + 2);
    for (const w of sheet.windows) {
      expect(w.x).toBeGreaterThanOrEqual(0);
      expect(w.x + w.w).toBeLessThanOrEqual(6);
      expect(w.y + w.h).toBeLessThanOrEqual(sheet.heightM);
    }
    expect(sheet.repeats).toBe(false);
  });
  it('the four variants differ in their walls and are each the same sheet every time; a seed picks one', () => {
    const walls = new Set(Array.from({ length: HOME_VARIANTS }, (_, v) => homeFacade(v as 0).wall));
    expect(walls.size).toBe(HOME_VARIANTS);
    expect(JSON.stringify(homeFacade(2))).toBe(JSON.stringify(homeFacade(2)));
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 400; i++) counts[variantOf(hashOf(`seed ${i}`))] = (counts[variantOf(hashOf(`seed ${i}`))] ?? 0) + 1;
    expect(counts.every((c) => c > 50)).toBe(true);
    expect(variantOf(12345)).toBe(variantOf(12345));
  });
  it('an office floor repeats with four bays of glass and a slab band; a plant wall repeats with one high window', () => {
    const office = officeFacade();
    expect(office.repeats).toBe(true);
    expect(office.windows.length).toBe(4);
    expect(office.heightM).toBe(STOREY_M);
    expect(office.door).toBeNull();
    const plant = plantFacade();
    expect(plant.repeats).toBe(true);
    expect(plant.windows.length).toBe(1);
  });
  it('the seeded stream is the same for the same seed and in [0, 1)', () => {
    const a = randomOf(42);
    const b = randomOf(42);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
    expect(randomOf(1)()).not.toBe(randomOf(2)());
  });
});

describe('the city described at near detail', () => {
  const layout = starterLayout();
  const scene = sceneOf(layout, RATES, 'near', { occupied: { '1,0': RATES.hood / 2 } });
  const d = describeScene(scene, context(layout));
  const chunk = d.chunks.find((c) => c.key === '1,0');
  it("a neighborhood is the Ground's homes as instances, 6 m by 12 m by three stories, half of them lit for half its people, facing their streets in pairs", () => {
    if (!chunk) throw new Error('chunk');
    expect(chunk.homes.length).toBe(hood.figures.homes);
    expect(chunk.homes.filter((h) => h.lit === 1).length).toBe(litRows('1,0', hood.figures.homes, 0.5).filter(Boolean).length);
    expect(chunk.homes.every((h) => Math.abs(h.frontM - 6) < 1e-9 && Math.abs(h.depthM - hood.figures.rowDepthM) < 1e-9 && Math.abs(h.heightM - 3 * STOREY_M) < 1e-9)).toBe(true);
    // Rows either side of the park share a line; the lines alternate which way they face.
    const ys = [...new Set(chunk.homes.map((h) => Math.round(h.y * 100) / 100))].sort((a, b) => a - b);
    expect(ys.length).toBe(new Set(hood.surface.rows.map((r) => Math.round(r.y * 100) / 100)).size);
    ys.forEach((y, i) => {
      const row = chunk.homes.filter((h) => Math.round(h.y * 100) / 100 === y);
      expect(row.every((h) => h.yaw === (i % 2 === 0 ? Math.PI : 0))).toBe(true);
    });
    expect(new Set(chunk.homes.map((h) => h.variant)).size).toBe(HOME_VARIANTS);
    expect(d.homes).toBe(10 * hood.figures.homes);
    expect(d.litHomes).toBe(9 * hood.figures.homes + litRows('1,0', hood.figures.homes, 0.5).filter(Boolean).length);
    // No prism stands for a home: the neighborhood's prisms are its park, its center and its three lane paths (and the
    // strips of line that start on its tile, which share its chunk).
    expect(chunk.meshes.filter((m) => m.level === 'surface').map((m) => m.material).filter((m) => m !== 'strip').sort()).toEqual(['park', 'path', 'path', 'path', 'plaza']);
  });
  it("trees stand inside the park, one a 20 m square of it, the same for the same tile", () => {
    if (!chunk) throw new Error('chunk');
    const center = tileCenterM('1,0', RATES);
    const park = hood.surface.park;
    expect(chunk.trees.length).toBe(Math.floor(park.areaM2 / (TREE_SPACING_M * TREE_SPACING_M)));
    for (const t of chunk.trees) {
      expect(Math.hypot(t.x - center.x - park.at.x, t.y - center.y - park.at.y)).toBeLessThanOrEqual(park.radiusM);
      expect(t.heightM).toBeGreaterThanOrEqual(5);
      expect(t.heightM).toBeLessThan(9);
    }
    const again = describeScene(sceneOf(layout, RATES, 'near', { occupied: { '1,0': RATES.hood / 2 } }), context(layout)).chunks.find((c) => c.key === '1,0');
    expect(JSON.stringify(again?.trees)).toBe(JSON.stringify(chunk.trees));
  });
  it('the ring is eight office prisms round a plaza, a plant a plant prism, a strip a strip; far, everything is massing', () => {
    const ring = d.chunks.find((c) => c.key === '0,0');
    if (!ring) throw new Error('ring');
    expect(ring.meshes.filter((m) => m.material === 'office').length).toBe(planRing(RATES.walking, RATES.base, 8).surface.buildings.length);
    expect(ring.meshes.filter((m) => m.material === 'plaza').length).toBe(1);
    expect(d.meshes.filter((m) => m.kind === 'power').every((m) => m.material === 'plant')).toBe(true);
    expect(d.meshes.filter((m) => m.kind === 'line').every((m) => m.material === 'strip')).toBe(true);
    const far = describeScene(sceneOf(layout, RATES, 'far'), context(layout));
    expect(far.homes).toBe(0);
    expect(far.trees).toBe(0);
    expect(far.meshes.every((m) => m.material === 'massing' || m.material === 'strip')).toBe(true);
    expect(far.chunks.flatMap((c) => c.meshes).filter((m) => m.level === 'sub').every((m) => m.material === 'guideway' || m.material === 'stop')).toBe(true);
    expect(far.chunks.every((c) => c.meshes.filter((m) => m.level === 'surface').every((m) => m.block !== undefined))).toBe(true);
  });
  it('the same scene describes byte for byte the same, and every prism carries two UVs a vertex', () => {
    const again = describeScene(sceneOf(layout, RATES, 'near', { occupied: { '1,0': RATES.hood / 2 } }), context(layout));
    expect(JSON.stringify(again)).toBe(JSON.stringify(d));
    for (const m of d.meshes) expect(m.prism.uvs.length * 3).toBe(m.prism.positions.length * 2);
    expect(HOME_TRIANGLES).toBe(14);
  });
  it("only the chunk whose tile changed changes its signature when one neighborhood's people move", () => {
    const moved = describeScene(sceneOf(layout, RATES, 'near', { occupied: { '1,0': RATES.hood * 0.75 } }), context(layout));
    const changed = moved.chunks.filter((c) => c.signature !== d.chunks.find((x) => x.key === c.key)?.signature).map((c) => c.key);
    expect(changed).toEqual(['1,0']);
    expect(moved.chunks.length).toBe(d.chunks.length);
  });
});

describe('the city on the clock', () => {
  it('a founding: scaffolds with cranes and survey strips at year 0, homes standing dark at year 2, lit by their people from year 3, a month adding more', () => {
    const y0 = founded(0);
    const d0 = describeScene(sceneOf(y0.layout, RATES, 'near', standingOf(y0)), context(y0.layout));
    expect(d0.sites).toBe(6);
    expect(d0.homes).toBe(0);
    expect(d0.meshes.filter((m) => m.material === 'scaffold').length).toBe(6);
    expect(d0.chunks.filter((c) => c.meshes.some((m) => m.material === 'crane')).length).toBe(6);
    expect(d0.chunks.every((c) => c.meshes.filter((m) => m.material === 'crane').length % 2 === 0)).toBe(true);
    // A stretch on order is a survey strip: the ledger's city on the clock, a neighborhood ordered at 3,-1 and the line to it from 2,-1.
    let ordered = startRun(starterLayout(), 7, RATES, RULES, { growth: true, inOrder: true });
    ordered = move(ordered, 'hood', '3,-1', null).game;
    const lineMove = move(ordered, 'line', '3,-1', '2,-1');
    expect(lineMove.changed, lineMove.said).toBe(true);
    const st = standingOf(lineMove.game);
    const onOrder = Object.keys(st.lines ?? {}).filter((e) => !lineMove.game.layout.lines[e]);
    expect(onOrder.length).toBe(1);
    const dl = describeScene(sceneOf(lineMove.game.layout, RATES, 'near', st), context(lineMove.game.layout));
    expect(dl.meshes.filter((m) => m.material === 'survey').length).toBe(1);
    expect(dl.meshes.filter((m) => m.material === 'scaffold').length).toBe(1);
    const y2 = founded(2);
    const d2 = describeScene(sceneOf(y2.layout, RATES, 'near', standingOf(y2)), context(y2.layout));
    expect(d2.homes).toBe(2 * hood.figures.homes);
    expect(d2.litHomes).toBe(0);
    expect(d2.sites).toBe(1);
    const y3 = founded(3);
    const s3 = standingOf(y3);
    const d3 = describeScene(sceneOf(y3.layout, RATES, 'near', s3), context(y3.layout));
    expect(d3.sites).toBe(0);
    expect(d3.litHomes).toBeGreaterThan(0);
    const share = (key: string): number => Math.max(0, Math.min(1, (s3.occupied?.[key] ?? RATES.hood) / RATES.hood));
    expect(d3.litHomes).toBe(litRows('1,0', hood.figures.homes, share('1,0')).filter(Boolean).length + litRows('2,-1', hood.figures.homes, share('2,-1')).filter(Boolean).length);
    const month = tickMonth(y3, RATES, RULES);
    const dm = describeScene(sceneOf(month.layout, RATES, 'near', standingOf(month)), context(month.layout));
    expect(dm.litHomes).toBeGreaterThanOrEqual(d3.litHomes);
    const changed = dm.chunks.filter((c) => c.signature !== d3.chunks.find((x) => x.key === c.key)?.signature).length;
    expect(changed).toBeLessThanOrEqual(2);
  });
  it("a month on seed 42's full circle, 73,000 homes at near detail, derives and describes again within a frame's budget (the tiles that did not change are remembered)", () => {
    let g = startRun(fullCircle(), 42, RATES, RULES, { growth: true, inOrder: true, infer: true });
    let prev = describeScene(sceneOf(g.layout, RATES, 'near', standingOf(g)), context(g.layout));
    let worst = 0;
    let changedMost = 0;
    for (let m = 0; m < 36; m++) {
      g = tickMonth(g, RATES, RULES);
      const st = standingOf(g);
      const started = performance.now();
      const d = describeScene(sceneOf(g.layout, RATES, 'near', st), context(g.layout));
      worst = Math.max(worst, performance.now() - started);
      const changed = d.chunks.filter((c) => c.signature !== prev.chunks.find((x) => x.key === c.key)?.signature).length;
      changedMost = Math.max(changedMost, changed);
      expect(changed).toBeLessThan(d.chunks.length);
      prev = d;
    }
    expect(prev.homes).toBe(36 * hood.figures.homes);
    // A frame is 16.7 ms; the bound here is loose so a slow machine does not fail the suite, four times looser on the
    // publish workflow's runner (about three times slower than the dev machine, and it sets CI), and the figure is printed.
    expect(worst).toBeLessThan(100 * (process.env.CI ? 4 : 1));
    process.stdout.write(`seed 42 full circle, 36 months near: ${prev.homes} homes in ${prev.chunks.length} chunks, worst month ${worst.toFixed(1)} ms, at most ${changedMost} chunks changed\n`);
    // Filling the circle and running 36 months takes a few seconds here and more on the runner: past vitest's five.
  }, 60000);
  it("the ledger's city at 100,000 people describes 40,000 homes within a bounded time", () => {
    const layout = city100k();
    const scene = sceneOf(layout, RATES, 'near');
    const started = performance.now();
    const d = describeScene(scene, context(layout));
    const ms = performance.now() - started;
    expect(d.homes).toBe(20 * hood.figures.homes);
    expect(d.trees).toBe(20 * Math.floor(hood.surface.park.areaM2 / (TREE_SPACING_M * TREE_SPACING_M)));
    expect(ms).toBeLessThan(1000 * (process.env.CI ? 4 : 1));
    process.stdout.write(`describe 100k near: ${d.homes} homes, ${d.trees} trees, ${d.triangles} triangles in ${ms.toFixed(1)} ms\n`);
  });
});

describe('the sub level', () => {
  const layout = starterLayout();
  const network = lineNetwork(layout.lines);
  const stretches = Object.keys(layout.lines);
  const onLine = Object.keys(layout.tiles).filter((k) => network.onLine(k));
  it("the ledger's city has a guideway under every stretch and a stop under every tile the line touches, far and near alike; near, a neighborhood's 33 entries, their walkways and its pipes", () => {
    const far = describeScene(sceneOf(layout, RATES, 'far'), context(layout));
    expect(far.guideways).toBe(stretches.length);
    expect(far.stops).toBe(onLine.length);
    expect(far.closed).toBe(0);
    expect(far.warned).toBe(0);
    expect(far.entries).toBe(0);
    const near = describeScene(sceneOf(layout, RATES, 'near'), context(layout));
    expect(near.guideways).toBe(stretches.length);
    expect(near.stops).toBe(onLine.length);
    const hoods = Object.values(layout.tiles).filter((t) => t?.kind === 'hood').length;
    expect(near.entries).toBe(hoods * hood.sub.entries.length);
    const chunk = near.chunks.find((c) => c.key === '1,0');
    if (!chunk) throw new Error('chunk');
    const sub = chunk.meshes.filter((m) => m.level === 'sub');
    expect(sub.filter((m) => m.material === 'entry').length).toBe(hood.sub.entries.length);
    expect(sub.filter((m) => m.material === 'walkway').length).toBe(hood.sub.entries.filter((e) => e.walkway).length);
    expect(sub.filter((m) => m.material === 'pipe').length).toBe(hood.sub.pipes.length);
    expect(sub.filter((m) => m.material === 'stop').length).toBe(1);
    // Everything on the sub level lies below the ground; an entry's shaft reaches the surface.
    for (const m of sub) {
      const zs = m.prism.positions.filter((_, i) => i % 3 === 2);
      expect(Math.min(...zs)).toBeLessThan(0);
      expect(Math.max(...zs)).toBeLessThanOrEqual(m.material === 'entry' ? 0 : SUB_DEPTH_M + 3);
    }
    const stop = sub.find((m) => m.material === 'stop');
    const center = tileCenterM('1,0', RATES);
    const xs = stop?.prism.positions.filter((_, i) => i % 3 === 0) ?? [];
    const ys = stop?.prism.positions.filter((_, i) => i % 3 === 1) ?? [];
    close((Math.min(...xs) + Math.max(...xs)) / 2, center.x + hood.sub.stop.at.x);
    close((Math.min(...ys) + Math.max(...ys)) / 2, center.y + hood.sub.stop.at.y);
  });
  it('a closed stretch is built closed, one named ahead is built warned, one on order is built as ordered, and only the chunk of the stretch changes', () => {
    const plain = describeScene(sceneOf(layout, RATES, 'far'), context(layout));
    const edge = stretches[0] as string;
    const [a] = edgeEnds(edge);
    const closed = describeScene(sceneOf(layout, RATES, 'far'), { ...context(layout), closed: [edge] });
    expect(closed.closed).toBe(1);
    expect(closed.guideways).toBe(stretches.length);
    const changed = closed.chunks.filter((c) => c.signature !== plain.chunks.find((x) => x.key === c.key)?.signature).map((c) => c.key);
    expect(changed).toEqual([a]);
    expect(closed.chunks.find((c) => c.key === a)?.meshes.filter((m) => m.material === 'closed').length).toBe(1);
    const warned = describeScene(sceneOf(layout, RATES, 'far'), { ...context(layout), warned: [edge] });
    expect(warned.warned).toBe(1);
    expect(warned.closed).toBe(0);
    // A stretch both closed and named stays closed.
    expect(describeScene(sceneOf(layout, RATES, 'far'), { ...context(layout), closed: [edge], warned: [edge] }).closed).toBe(1);
    // A stretch on order and not yet laid: a survey strip on the surface and an ordered guideway under it.
    const ordered = edgeKey('3,-1', '2,-1');
    const scene = sceneOf(layout, RATES, 'far', { lines: { [ordered]: { kind: 'line', edge: ordered, index: 0, status: 'waiting' } as never } });
    const d = describeScene(scene, { ...context(layout), ordered: [ordered] });
    expect(d.guideways).toBe(stretches.length + 1);
    expect(d.chunks.flatMap((c) => c.meshes).filter((m) => m.material === 'ordered').length).toBe(1);
    expect(d.chunks.flatMap((c) => c.meshes).filter((m) => m.material === 'survey').length).toBe(1);
  });
  it("on seed 42 the ledger's city run to year 7 names a closure ahead and then closes it, and the view reads both from the Run", () => {
    let g = startRun(starterLayout(), 42, RATES, RULES, { growth: true, inOrder: true });
    let namedAt: number | null = null;
    let closedAt: number | null = null;
    for (let y = 1; y <= 20 && closedAt === null; y++) {
      g = tick(g, RATES, RULES);
      const clock = g.clock;
      if (!clock) throw new Error('clock');
      const closed = stressAt(clock, RATES.band).closed ?? [];
      const warned = namedClosures(clock, clock.year).filter((e) => !closed.includes(e));
      const d = describeScene(sceneOf(g.layout, RATES, 'far', standingOf(g)), { ...context(g.layout), closed, warned });
      expect(d.closed).toBe(closed.filter((e) => g.layout.lines[e]).length);
      expect(d.warned).toBe(warned.filter((e) => g.layout.lines[e]).length);
      if (namedAt === null && warned.length) namedAt = clock.year;
      if (closed.length) closedAt = clock.year;
    }
    expect(namedAt).not.toBeNull();
    expect(closedAt).not.toBeNull();
    expect(namedAt as number).toBeLessThan(closedAt as number);
  });
});
