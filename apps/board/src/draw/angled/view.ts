/**
 * @file The angled view on the page: when the session looks at the site from the air, the map's SVG hides, the
 * canvas shows, the scene is derived from the game as it stands and painted under a camera fitted to the canvas.
 * The canvas carries data-blocks and data-stories so a test can hold what was painted to the scene.
 * Public interface: Painted, drawAngled, ANGLED_YAW, ANGLED_PITCH.
 * Owner context: Board (adapter), the angled view (plan angled-view-through-time).
 */
import { RATES } from '@city/site';
import { byId } from '../../dom.ts';
import type { Page } from '../../page.ts';
import { fitCamera, lodFor, paintScene } from './canvas.ts';
import type { Painter, Palette } from './canvas.ts';
import type { ScreenPoint } from './projection.ts';
import { sceneOf } from './scene.ts';
import type { Standing } from './scene.ts';

/** What the view painted, for the view bar's caption. */
export interface Painted {
  readonly blocks: number;
  readonly stories: number;
  readonly sites: number;
  readonly lit: number;
}

/** The site turned a sixth, so two faces of every block show. */
export const ANGLED_YAW = Math.PI / 6;
/** Tilted to 50 degrees: heights read, and the far side of the site is not hidden behind the near. */
export const ANGLED_PITCH = (50 * Math.PI) / 180;

/** The page's colours for each kind, read from its tokens so the view follows the theme. */
function palette(): Palette {
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
  };
}

/** A painter on a canvas context: the colour, then a veil of ink for the shade. */
function canvasPainter(ctx: CanvasRenderingContext2D): Painter {
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
  };
}

/**
 * Show or hide the angled view for the session's view, and paint it when shown. The map's SVG is hidden while the
 * canvas shows; the caller draws the map when the view is elsewhere.
 * @param page - the page
 * @returns what was painted, for the view bar: blocks, stories, tiles under construction and the homes' lit share;
 * null when the view is not the angled one
 */
export function drawAngled(page: Page): Painted | null {
  const { s } = page;
  const canvas = byId<HTMLCanvasElement>('angledcanvas');
  const board = byId('board');
  const on = s.view.at === 'angled';
  canvas.hidden = !on;
  // An SVG element has no `hidden` property, so the attribute is set by hand and the page's CSS hides it.
  board.toggleAttribute('hidden', on);
  if (!on) return null;
  const scroller = byId('boardscroll');
  const cssWidth = Math.max(320, scroller.clientWidth || 960);
  const cssHeight = Math.round(cssWidth * 0.62);
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  canvas.style.height = `${cssHeight}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { blocks: 0, stories: 0, sites: 0, lit: 1 };
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);
  // What the clock says: tiles and stretches on order, and who lives where (the session reads both from the Run).
  const standing: Standing = { sites: s.hand.sites, lines: s.hand.lines, occupied: s.occupied };
  // Fit far first; if the fit is close enough for rows, derive again at mid detail and fit that.
  let scene = sceneOf(s.game.layout, RATES, 'far', standing);
  let camera = fitCamera(scene, cssWidth, cssHeight, ANGLED_YAW, ANGLED_PITCH);
  if (lodFor(camera.scale) === 'mid') {
    scene = sceneOf(s.game.layout, RATES, 'mid', standing);
    camera = fitCamera(scene, cssWidth, cssHeight, ANGLED_YAW, ANGLED_PITCH);
  }
  paintScene(canvasPainter(ctx), scene, camera, palette());
  canvas.setAttribute('data-blocks', String(scene.blocks.length));
  canvas.setAttribute('data-stories', String(scene.stories));
  canvas.setAttribute('data-sites', String(scene.sites));
  canvas.setAttribute('data-lit', scene.lit.toFixed(2));
  canvas.setAttribute('data-lod', scene.lod);
  return { blocks: scene.blocks.length, stories: scene.stories, sites: scene.sites, lit: scene.lit };
}
