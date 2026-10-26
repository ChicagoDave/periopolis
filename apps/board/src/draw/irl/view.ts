/**
 * @file The IRL view on the page: when the session looks at the city IRL, the map's SVG hides, the GL canvas shows,
 * the scene is derived from the game as it stands at the detail the camera deserves, described, built once per
 * change and rendered under the session's orbit. The orbit is the session's, never saved; this module applies the
 * camera's pure functions to it with the scene's box and the canvas's size. The canvas carries data-blocks,
 * data-stories, data-sites, data-lit, data-lod, data-triangles, data-homes, data-lit-homes, data-trees, data-chunks,
 * data-rebuilt, data-rebuild-ms, data-light, data-sub, data-guideways, data-closed, data-warned, data-stops, data-entries,
 * data-webgl and data-frames so a test can hold what was built to the scene.
 * The fleet of movers is kept here as the last frame's states, the basis for the next (a cache of the animation, never
 * a fact of the city), reconciled to the Ledger's fleet for the people living there and to the line as it stands,
 * and stepped by the wall clock in a frame loop that runs while the view is open.
 * The surface traffic (bikes on the lane, carts on the streets) is kept the same way, one set a neighborhood, and
 * stepped in the same loop, which runs whenever the view is open and backs off when a frame is slow.
 * Public interface: drawIrl, turnIrl, dollyIrl, panIrl, fitIrl, irlSupported, SubCounts, subCounts, moverCount,
 * trafficCount, MOVER_LOOP_MS.
 * Owner context: Board (adapter), the IRL view (plan irl-3d-city-view, ADR-0023).
 */
import { RATES } from '@city/site';
import { byId } from '../../dom.ts';
import type { Page } from '../../page.ts';
import { MID_SCALE } from '../angled/canvas.ts';
import { sceneOf } from '../angled/scene.ts';
import type { Lod, Standing } from '../angled/scene.ts';
import { palette } from '../angled/view.ts';
import type { Painted } from '../angled/view.ts';
import { boundsOf, dollyOrbit, fitOrbit, panOrbit, pixelsPerMetre, turnOrbit } from './camera.ts';
import type { Bounds, Orbit } from './camera.ts';
import { describeScene } from './describe.ts';
import { IrlRenderer, webglSupported } from './gl.ts';
import { fleetOf, graphOf, placeOf, reconcile, step } from './movers.ts';
import type { LineGraph, MoverClass, MoverState, Placed } from './movers.ts';
import { pathsOf, placeTraffic, stepTraffic, trafficOf } from './traffic.ts';
import { sunAt } from './sun.ts';
import type { Path, TrafficClass, TrafficPlaced, TrafficState } from './traffic.ts';
import { planNeighborhood } from '@city/ground';
import { tileCenterM } from '../angled/scene.ts';
import { hashOf } from './facade.ts';

/** The renderer on the page's canvas, made on first use; null once the browser has said it cannot. */
let renderer: IrlRenderer | null = null;
let supported: boolean | null = null;

/** What the last frame was of, so the next can tell whether to build again, and what the camera's functions need. */
interface Frame {
  readonly signature: string;
  readonly bounds: Bounds;
  readonly width: number;
  readonly height: number;
}
let frame: Frame | null = null;
/** A render scheduled for a burst of model arrivals; null when none is pending. */
let arrival: ReturnType<typeof setTimeout> | null = null;

/** The sub level's counts from the last build, for the view bar. */
export interface SubCounts {
  readonly guideways: number;
  readonly closed: number;
  readonly warned: number;
  readonly stops: number;
}
let lastSub: SubCounts = { guideways: 0, closed: 0, warned: 0, stops: 0 };

/** What the sub level holds as last built. */
export function subCounts(): SubCounts {
  return lastSub;
}

/** How often the fleet moves on while the view is open, milliseconds. */
export const MOVER_LOOP_MS = 50;

/** The fleet as last placed: the states, the line they ran on, and when. */
interface FleetFrame {
  readonly movers: readonly MoverState[];
  readonly graph: LineGraph;
  readonly lineKey: string;
  readonly at: number;
}
let fleet: FleetFrame | null = null;
let loop: ReturnType<typeof setTimeout> | null = null;

/** Movers running now. */
export function moverCount(): number {
  return fleet?.movers.length ?? 0;
}

/** One neighborhood's surface traffic: its paths and the states on them. */
interface TileTraffic {
  readonly paths: readonly Path[];
  states: readonly TrafficState[];
}
const trafficByTile = new Map<string, TileTraffic>();
let trafficAt = 0;

/** Bikes and carts running now. */
export function trafficCount(): Readonly<Record<TrafficClass, number>> {
  let bike = 0;
  let cart = 0;
  for (const t of trafficByTile.values()) for (const s of t.states) if (s.cls === 'bike') bike++; else cart++;
  return { bike, cart };
}

/**
 * The surface traffic moved on to now: a set for every neighborhood standing (made when it first stands, from the
 * Ground's lane and homes, seeded by its tile), stepped by the seconds since the last frame, dropped with its tile.
 * Off near detail there is none to place.
 */
function trafficNow(page: Page, now: number, near: boolean): Readonly<Record<TrafficClass, TrafficPlaced[]>> {
  const { s } = page;
  const placed: Record<TrafficClass, TrafficPlaced[]> = { bike: [], cart: [] };
  const seconds = trafficAt ? Math.min(5, (now - trafficAt) / 1000) : 0;
  trafficAt = now;
  if (!near) {
    trafficByTile.clear();
    return placed;
  }
  const hoods = new Set(Object.keys(s.game.layout.tiles).filter((k) => s.game.layout.tiles[k]?.kind === 'hood'));
  for (const key of [...trafficByTile.keys()]) if (!hoods.has(key)) trafficByTile.delete(key);
  const plan = planNeighborhood(RATES.shared, RATES.walking, RATES.base);
  for (const key of hoods) {
    let t = trafficByTile.get(key);
    if (!t) {
      const paths = pathsOf(plan, tileCenterM(key, RATES));
      t = { paths, states: trafficOf(paths, plan.figures.laneM, plan.figures.homes, hashOf(key)) };
      trafficByTile.set(key, t);
    } else t.states = stepTraffic(t.paths, t.states, seconds);
    for (const st of t.states) placed[st.cls].push(placeTraffic(t.paths, st));
  }
  return placed;
}

/** The people living in the city now: on a clock those the Run admits, off it every home full. */
function peopleOf(page: Page): number {
  const { s } = page;
  if (s.occupied) return Object.values(s.occupied).reduce((t, n) => t + n, 0);
  return Object.values(s.game.layout.tiles).filter((t) => t?.kind === 'hood').length * RATES.hood;
}

/**
 * The fleet moved on to now: the line rebuilt when a stretch or a closure changed (the movers set down only where
 * their stretch went), the fleet reconciled to the Ledger's for the people living there, and every mover stepped
 * by the seconds since the last frame (at most five, so a tab left in the background does not run a mover far).
 */
function fleetNow(page: Page, now: number): Readonly<Record<MoverClass, Placed[]>> {
  const { s } = page;
  const lineKey = `${Object.keys(s.game.layout.lines).sort().join(';')}|${[...s.closed].sort().join(';')}`;
  const seed = s.game.clock?.seed ?? 42;
  const graph = fleet && fleet.lineKey === lineKey ? fleet.graph : graphOf(s.game.layout, RATES, s.closed);
  const wanted = fleetOf(peopleOf(page), RATES.base);
  const before = fleet ? step(graph, fleet.movers, Math.min(5, (now - fleet.at) / 1000), seed) : [];
  const movers = reconcile(graph, before, wanted, seed);
  fleet = { movers, graph, lineKey, at: now };
  const placed: Record<MoverClass, Placed[]> = { pod: [], cab: [], shuttle: [] };
  for (const m of movers) placed[m.cls].push(placeOf(graph, m));
  return placed;
}

/**
 * Keep the traffic moving while the view is open: a tick places the movers (when the sub level shows) and the
 * surface traffic (at near detail) and renders a frame. The next tick waits at least MOVER_LOOP_MS and at least four
 * times what the frame took, so a slow renderer (software GL) is never saturated and the page stays responsive.
 */
function keepMoving(page: Page): void {
  if (loop) return;
  const tick = (): void => {
    loop = null;
    if (page.s.view.at !== 'irl' || !renderer || !frame) return;
    const started = performance.now();
    const near = byId<HTMLCanvasElement>('irlcanvas').getAttribute('data-lod') === 'near';
    if (page.s.sub) renderer.setMovers(fleetNow(page, started));
    if (near) renderer.setTraffic(trafficNow(page, started, true));
    if (page.s.sub || near) {
      const orbit = page.s.orbit ?? fitOrbit(frame.bounds, frame.width / frame.height);
      const frames = renderer.render(orbit, frame.width, frame.height, Math.min(2, window.devicePixelRatio || 1));
      const canvas = byId<HTMLCanvasElement>('irlcanvas');
      canvas.setAttribute('data-frames', String(frames));
      const first = fleet?.movers[0];
      if (first && fleet) {
        const p = placeOf(fleet.graph, first);
        canvas.setAttribute('data-mover0', `${p.x.toFixed(1)},${p.y.toFixed(1)}`);
      }
    }
    const took = performance.now() - started;
    loop = setTimeout(tick, Math.max(MOVER_LOOP_MS, 4 * took));
  };
  loop = setTimeout(tick, MOVER_LOOP_MS);
}

/** Whether the browser can draw the city IRL; decided once, on the page's canvas. */
export function irlSupported(): boolean {
  if (supported === null) supported = webglSupported(byId<HTMLCanvasElement>('irlcanvas'));
  return supported;
}

/** The detail the orbit deserves: far, one block a tile; from the angled view's mid scale, every home instanced. */
function lodAt(scale: number): Lod {
  return scale >= MID_SCALE ? 'near' : 'far';
}

/** Everything that changes what is built: what stands, what is on order, who lives where, and the detail. */
function signatureOf(page: Page, standing: Standing, lod: Lod): string {
  const { s } = page;
  const tiles = Object.keys(s.game.layout.tiles)
    .map((k) => `${k}:${s.game.layout.tiles[k]?.kind}:${(s.game.layout.tiles[k] as { n?: number }).n ?? ''}`)
    .join(';');
  const lines = Object.keys(s.game.layout.lines).join(';');
  const sites = Object.keys(standing.sites ?? {}).join(';');
  const ordered = Object.keys(standing.lines ?? {}).join(';');
  const occupied = Object.entries(standing.occupied ?? {})
    .map(([k, n]) => `${k}=${Math.round(n)}`)
    .join(';');
  const line = `${s.closed.join(';')}/${s.warned.join(';')}`;
  return [tiles, lines, sites, ordered, occupied, line, lod].join('|');
}

/** The page's ground and sky, from its tokens so the view follows the theme. */
function tokens(): { ground: string; sky: string } {
  const css = getComputedStyle(document.documentElement);
  const dark = css.getPropertyValue('color-scheme').trim() === 'dark';
  return {
    ground: css.getPropertyValue('--ground').trim() || '#E1E8DF',
    sky: dark ? '#1A2430' : '#CFE0EE',
  };
}

/**
 * Show or hide the IRL view for the session's view, and render it when shown. The map's SVG is hidden while the
 * canvas shows; the caller draws the map when the view is elsewhere.
 * @param page - the page
 * @returns what was built, for the view bar; null when the view is not the IRL one
 */
export function drawIrl(page: Page): Painted | null {
  const { s } = page;
  const canvas = byId<HTMLCanvasElement>('irlcanvas');
  const board = byId('board');
  const on = s.view.at === 'irl';
  canvas.hidden = !on;
  if (on) board.toggleAttribute('hidden', true);
  if (!on) {
    frame = null;
    if (loop) clearTimeout(loop);
    loop = null;
    return null;
  }
  const scroller = byId('boardscroll');
  const cssWidth = Math.max(320, scroller.clientWidth || 960);
  const cssHeight = Math.round(cssWidth * 0.62);
  canvas.style.height = `${cssHeight}px`;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.setAttribute('data-webgl', irlSupported() ? 'yes' : 'no');
  const standing: Standing = { sites: s.hand.sites, lines: s.hand.lines, occupied: s.occupied };
  // Fit far first; if the orbit is close enough for rows or homes, derive again at that detail.
  let scene = sceneOf(s.game.layout, RATES, 'far', standing);
  const aspect = cssWidth / cssHeight;
  let bounds = boundsOf(scene) ?? { minX: -500, maxX: 500, minY: -500, maxY: 500, maxZ: 0 };
  const orbit: Orbit = s.orbit ?? fitOrbit(bounds, aspect);
  const lod = lodAt(pixelsPerMetre(orbit, cssHeight));
  if (lod !== 'far') {
    scene = sceneOf(s.game.layout, RATES, lod, standing);
    bounds = boundsOf(scene) ?? bounds;
  }
  const painted: Painted = { blocks: scene.blocks.length, stories: scene.stories, sites: scene.sites, lit: scene.lit };
  canvas.setAttribute('data-blocks', String(scene.blocks.length));
  canvas.setAttribute('data-stories', String(scene.stories));
  canvas.setAttribute('data-sites', String(scene.sites));
  canvas.setAttribute('data-lit', scene.lit.toFixed(2));
  canvas.setAttribute('data-lod', scene.lod);
  if (!irlSupported()) {
    canvas.setAttribute('data-triangles', '0');
    canvas.setAttribute('data-frames', '0');
    frame = { signature: '', bounds, width: cssWidth, height: cssHeight };
    return painted;
  }
  if (!renderer) {
    renderer = new IrlRenderer(
      canvas,
      () => canvas.setAttribute('data-webgl', 'lost'),
      () => {
        frame = null;
        page.render();
      },
      () => {
        // A kit model arrived: build again so the stand-in gives way to it. Arrivals come in a burst, so they are
        // coalesced into one render a tick rather than a full rebuild each.
        if (arrival) return;
        arrival = setTimeout(() => {
          arrival = null;
          frame = null;
          page.render();
        }, 60);
      },
    );
  }
  // The kit models stand near the orbit's target; the signature carries which tiles that is, so a move rebuilds.
  const focus = { x: orbit.target.x, y: orbit.target.y };
  const signature = `${signatureOf(page, standing, lod)}|${Math.round(focus.x / 100)},${Math.round(focus.y / 100)}`;
  if (!frame || frame.signature !== signature) {
    const started = performance.now();
    const described = describeScene(scene, { rates: RATES, layout: s.game.layout, closed: s.closed, warned: s.warned, ordered: Object.keys(s.hand.lines) });
    const stats = renderer.build(described, palette(), tokens(), focus);
    canvas.setAttribute('data-rebuild-ms', (performance.now() - started).toFixed(1));
    canvas.setAttribute('data-triangles', String(described.triangles));
    canvas.setAttribute('data-homes', String(described.homes));
    canvas.setAttribute('data-lit-homes', String(described.litHomes));
    canvas.setAttribute('data-trees', String(described.trees));
    canvas.setAttribute('data-chunks', String(stats.chunks));
    canvas.setAttribute('data-rebuilt', String(stats.rebuilt));
    canvas.setAttribute('data-models', String(renderer.kitModels));
    canvas.setAttribute('data-streets', String(described.streets));
    canvas.setAttribute('data-crossings', String(described.crossings));
    canvas.setAttribute('data-props', String(described.props));
    canvas.setAttribute('data-bulk-props', String(described.bulkProps));
    canvas.setAttribute('data-shore', described.terrain ? described.terrain.shoreY.toFixed(0) : '');
    canvas.setAttribute('data-guideways', String(described.guideways));
    canvas.setAttribute('data-closed', String(described.closed));
    canvas.setAttribute('data-warned', String(described.warned));
    canvas.setAttribute('data-stops', String(described.stops));
    canvas.setAttribute('data-entries', String(described.entries));
    lastSub = { guideways: described.guideways, closed: described.closed, warned: described.warned, stops: described.stops };
  } else canvas.setAttribute('data-rebuilt', '0');
  renderer.setSun(sunAt(s.hour));
  renderer.setSub(s.sub);
  canvas.setAttribute('data-light', s.light);
  canvas.setAttribute('data-hour', String(s.hour));
  canvas.setAttribute('data-composed', renderer.composed ? 'yes' : 'no');
  canvas.setAttribute('data-sub', s.sub ? 'on' : 'off');
  frame = { signature, bounds, width: cssWidth, height: cssHeight };
  renderer.setMovers(fleetNow(page, performance.now()));
  canvas.setAttribute('data-movers', String(moverCount()));
  renderer.setTraffic(trafficNow(page, performance.now(), lod === 'near'));
  const traffic = trafficCount();
  canvas.setAttribute('data-bikes', String(traffic.bike));
  canvas.setAttribute('data-carts', String(traffic.cart));
  const frames = renderer.render(orbit, cssWidth, cssHeight, dpr);
  canvas.setAttribute('data-frames', String(frames));
  keepMoving(page);
  return painted;
}

/** The orbit as it stands, fitted if the session has none yet; null before the first frame. */
function current(page: Page): { orbit: Orbit; frame: Frame } | null {
  if (!frame) return null;
  return { orbit: page.s.orbit ?? fitOrbit(frame.bounds, frame.width / frame.height), frame };
}

/** Turn the orbit by a drag of so many pixels: across turns round the target, down raises the eye. */
export function turnIrl(page: Page, dx: number, dy: number): void {
  const c = current(page);
  if (!c) return;
  page.s.setOrbit(turnOrbit(c.orbit, (-dx / c.frame.width) * Math.PI * 1.5, (dy / c.frame.height) * Math.PI * 0.75));
}

/** Nearer or farther by a factor, within the camera's bounds. */
export function dollyIrl(page: Page, factor: number): void {
  const c = current(page);
  if (!c) return;
  page.s.setOrbit(dollyOrbit(c.orbit, factor, c.frame.bounds, c.frame.width / c.frame.height));
}

/** Slide the target along the ground by a drag of so many pixels. */
export function panIrl(page: Page, dx: number, dy: number): void {
  const c = current(page);
  if (!c) return;
  page.s.setOrbit(panOrbit(c.orbit, dx, dy, c.frame.height, c.frame.bounds));
}

/** Fitted again: the session forgets its orbit and the next frame opens as the view does. */
export function fitIrl(page: Page): void {
  page.s.setOrbit(null);
}
