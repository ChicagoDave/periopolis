/**
 * @file The angled view on the page: when the session looks at the site from the air, the map's SVG hides, the
 * canvas shows, the scene is derived from the game as it stands and painted under the session's camera (a quarter
 * turn, a tilt, a zoom over the fit, a pan). The canvas is its own cache: when only who lives where changed since
 * the last paint, only the tiles whose lit share moved are cleared and painted again. The canvas carries data-blocks,
 * data-stories, data-sites, data-lit, data-lod, data-repaint and data-faces so a test can hold what was painted to
 * the scene.
 * Public interface: Painted, drawAngled, cameraFor, palette, ANGLED_YAW, TILT_RAD.
 * Owner context: Board (adapter), the angled view (plan angled-view-through-time).
 */
import { RATES } from '@city/site';
import { byId } from '../../dom.ts';
import type { Page } from '../../page.ts';
import type { Air, Tilt } from '../../session.ts';
import { changedTiles, fitCamera, lodFor, paintRegion, paintScene, regionOf } from './canvas.ts';
import type { Painter, Palette, Region } from './canvas.ts';
import type { Camera, ScreenPoint } from './projection.ts';
import { sceneOf } from './scene.ts';
import type { Lod, Scene, Standing } from './scene.ts';

/** What the view painted, for the view bar's caption. */
export interface Painted {
  readonly blocks: number;
  readonly stories: number;
  readonly sites: number;
  readonly lit: number;
}

/** The site turned a sixth before any quarter turn, so two faces of every block show. */
export const ANGLED_YAW = Math.PI / 6;

/** The three tilts, radians: low is side on enough to read heights, high is nearly the plan. */
export const TILT_RAD: Readonly<Record<Tilt, number>> = { low: (30 * Math.PI) / 180, mid: (50 * Math.PI) / 180, high: (70 * Math.PI) / 180 };

/** The page's colours for each kind, read from its tokens so the view follows the theme (the IRL view's too). */
export function palette(): Palette {
  const css = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string): string => css.getPropertyValue(name).trim() || fallback;
  const plant = token('--plant-edge', '#74867B');
  return {
    hood: token('--hood-edge', '#93A699'),
    ring: token('--sign', '#0B6B49'),
    power: plant,
    water: plant,
    sewage: plant,
    waste: plant,
    line: token('--ink-2', '#4D5C53'),
    site: token('--flag', '#8F5600'),
    siteline: token('--flag', '#8F5600'),
    school: '#C9A227',
    fields: '#3F8F4F',
  };
}

/** A painter on a canvas context: the colour, then a veil of ink for the shade; a clip clears to the ground. */
function canvasPainter(ctx: CanvasRenderingContext2D, ground: string): Painter {
  return {
    fillPolygon(points: readonly ScreenPoint[], color: string, shade: number) {
      if (!points.length) return;
      ctx.beginPath();
      ctx.moveTo(points[0]?.x ?? 0, points[0]?.y ?? 0);
      for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      if (shade < 1) {
        ctx.fillStyle = `rgba(0, 0, 0, ${(0.7 * (1 - shade)).toFixed(3)})`;
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.lineWidth = 0.6;
      ctx.stroke();
    },
    clip(region: Region) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(region.x0, region.y0, region.x1 - region.x0, region.y1 - region.y0);
      ctx.clip();
      ctx.fillStyle = ground;
      ctx.fillRect(region.x0, region.y0, region.x1 - region.x0, region.y1 - region.y0);
    },
    unclip() {
      ctx.restore();
    },
  };
}

/**
 * The camera for the session's viewer: the scene fitted to the canvas at the turn and tilt, then nearer by the zoom
 * about the canvas's middle, then slid by the pan.
 * @param scene - what is shown
 * @param air - the viewer
 * @param width - the canvas, pixels
 * @param height - the canvas, pixels
 */
export function cameraFor(scene: Scene, air: Air, width: number, height: number): Camera {
  const fit = fitCamera(scene, width, height, ANGLED_YAW + (air.turn * Math.PI) / 2, TILT_RAD[air.tilt]);
  const cx = width / 2;
  const cy = height / 2;
  return {
    ...fit,
    scale: fit.scale * air.zoom,
    origin: { x: cx + (fit.origin.x - cx) * air.zoom + air.pan.x, y: cy + (fit.origin.y - cy) * air.zoom + air.pan.y },
  };
}

/** What the last paint was of, so the next can tell whether only who lives where changed. */
interface Last {
  readonly signature: string;
  readonly scene: Scene;
}
let last: Last | null = null;

/** Everything but who lives where: the tiles and lines that stand, what is on order, the viewer and the canvas. */
function signatureOf(page: Page, standing: Standing, lod: Lod, width: number, height: number): string {
  const { s } = page;
  const tiles = Object.keys(s.game.layout.tiles)
    .map((k) => `${k}:${s.game.layout.tiles[k]?.kind}:${(s.game.layout.tiles[k] as { n?: number }).n ?? ''}`)
    .join(';');
  const lines = Object.keys(s.game.layout.lines).join(';');
  const sites = Object.keys(standing.sites ?? {}).join(';');
  const ordered = Object.keys(standing.lines ?? {}).join(';');
  const air = `${s.air.turn}/${s.air.tilt}/${s.air.zoom.toFixed(4)}/${s.air.pan.x.toFixed(1)}/${s.air.pan.y.toFixed(1)}`;
  return [tiles, lines, sites, ordered, air, lod, width, height].join('|');
}

/**
 * Show or hide the angled view for the session's view, and paint it when shown. The map's SVG is hidden while the
 * canvas shows; the caller draws the map when the view is elsewhere.
 * @param page - the page
 * @returns what was painted, for the view bar; null when the view is not the angled one
 */
export function drawAngled(page: Page): Painted | null {
  const { s } = page;
  const canvas = byId<HTMLCanvasElement>('angledcanvas');
  const board = byId('board');
  const on = s.view.at === 'angled';
  canvas.hidden = !on;
  // An SVG element has no `hidden` property, so the attribute is set by hand and the page's CSS hides it.
  board.toggleAttribute('hidden', on);
  if (!on) {
    last = null;
    return null;
  }
  const scroller = byId('boardscroll');
  const cssWidth = Math.max(320, scroller.clientWidth || 960);
  const cssHeight = Math.round(cssWidth * 0.62);
  const dpr = window.devicePixelRatio || 1;
  const sized = canvas.width !== Math.round(cssWidth * dpr) || canvas.height !== Math.round(cssHeight * dpr);
  if (sized) {
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    canvas.style.height = `${cssHeight}px`;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return { blocks: 0, stories: 0, sites: 0, lit: 1 };
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // What the clock says: tiles and stretches on order, and who lives where (the session reads both from the Run).
  const standing: Standing = { sites: s.hand.sites, lines: s.hand.lines, occupied: s.occupied };
  // Fit far first; if the viewer is close enough for rows or homes, derive again at that detail.
  let scene = sceneOf(s.game.layout, RATES, 'far', standing);
  let camera = cameraFor(scene, s.air, cssWidth, cssHeight);
  const lod = lodFor(camera.scale);
  if (lod !== 'far') {
    scene = sceneOf(s.game.layout, RATES, lod, standing);
    camera = cameraFor(scene, s.air, cssWidth, cssHeight);
  }
  const colors = palette();
  const ground = getComputedStyle(document.documentElement).getPropertyValue('--ground').trim() || '#E1E8DF';
  const painter = canvasPainter(ctx, ground);
  const signature = signatureOf(page, standing, lod, cssWidth, cssHeight);
  const viewport = { width: cssWidth, height: cssHeight };
  let repaint: 'full' | 'region' | 'none' = 'full';
  let faces = 0;
  if (!sized && last && last.signature === signature) {
    const moved = changedTiles(last.scene, scene);
    const region = regionOf(scene, moved, camera);
    if (!moved.length) repaint = 'none';
    else if (region) {
      repaint = 'region';
      faces = paintRegion(painter, scene, camera, colors, {
        x0: Math.max(0, region.x0),
        y0: Math.max(0, region.y0),
        x1: Math.min(cssWidth, region.x1),
        y1: Math.min(cssHeight, region.y1),
      });
    } else repaint = 'none';
  }
  if (repaint === 'full') {
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    faces = paintScene(painter, scene, camera, colors, viewport);
  }
  last = { signature, scene };
  canvas.setAttribute('data-blocks', String(scene.blocks.length));
  canvas.setAttribute('data-stories', String(scene.stories));
  canvas.setAttribute('data-sites', String(scene.sites));
  canvas.setAttribute('data-lit', scene.lit.toFixed(2));
  canvas.setAttribute('data-lod', scene.lod);
  canvas.setAttribute('data-repaint', repaint);
  canvas.setAttribute('data-faces', String(faces));
  canvas.setAttribute('data-scale', camera.scale.toFixed(3));
  return { blocks: scene.blocks.length, stories: scene.stories, sites: scene.sites, lit: scene.lit };
}
