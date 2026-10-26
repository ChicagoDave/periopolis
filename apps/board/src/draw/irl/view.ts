/**
 * @file The IRL view on the page: when the session looks at the city IRL, the map's SVG hides, the GL canvas shows,
 * the scene is derived from the game as it stands at the detail the camera deserves, described, built once per
 * change and rendered under the session's orbit. The orbit is the session's, never saved; this module applies the
 * camera's pure functions to it with the scene's box and the canvas's size. The canvas carries data-blocks,
 * data-stories, data-sites, data-lit, data-lod, data-triangles, data-homes, data-lit-homes, data-trees, data-chunks,
 * data-rebuilt, data-rebuild-ms, data-light, data-sub, data-guideways, data-closed, data-warned, data-stops, data-entries,
 * data-webgl and data-frames so a test can hold what was built to the scene.
 * Public interface: drawIrl, turnIrl, dollyIrl, panIrl, fitIrl, irlSupported, SubCounts, subCounts.
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
    );
  }
  const signature = signatureOf(page, standing, lod);
  if (!frame || frame.signature !== signature) {
    const started = performance.now();
    const described = describeScene(scene, { rates: RATES, layout: s.game.layout, closed: s.closed, warned: s.warned, ordered: Object.keys(s.hand.lines) });
    const stats = renderer.build(described, palette(), tokens());
    canvas.setAttribute('data-rebuild-ms', (performance.now() - started).toFixed(1));
    canvas.setAttribute('data-triangles', String(described.triangles));
    canvas.setAttribute('data-homes', String(described.homes));
    canvas.setAttribute('data-lit-homes', String(described.litHomes));
    canvas.setAttribute('data-trees', String(described.trees));
    canvas.setAttribute('data-chunks', String(stats.chunks));
    canvas.setAttribute('data-rebuilt', String(stats.rebuilt));
    canvas.setAttribute('data-guideways', String(described.guideways));
    canvas.setAttribute('data-closed', String(described.closed));
    canvas.setAttribute('data-warned', String(described.warned));
    canvas.setAttribute('data-stops', String(described.stops));
    canvas.setAttribute('data-entries', String(described.entries));
    lastSub = { guideways: described.guideways, closed: described.closed, warned: described.warned, stops: described.stops };
  } else canvas.setAttribute('data-rebuilt', '0');
  renderer.setLight(s.light);
  renderer.setSub(s.sub);
  canvas.setAttribute('data-light', s.light);
  canvas.setAttribute('data-sub', s.sub ? 'on' : 'off');
  frame = { signature, bounds, width: cssWidth, height: cssHeight };
  const frames = renderer.render(orbit, cssWidth, cssHeight, dpr);
  canvas.setAttribute('data-frames', String(frames));
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
