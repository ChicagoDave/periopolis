/**
 * @file A tile's ground, drawn to scale: the Ground's plan of a neighborhood or the ring, one level at a time, with a
 * legend, a scale bar and the placements the ledger did not fix. Also the view bar above the board.
 * Public interface: drawGround, drawViewBar, planAt.
 * Owner context: Board (adapter). Draws what @city/ground returns; decides nothing about the shapes.
 *
 * One SVG user unit is one metre. Rows carry data-homes, entries data-homes, buildings data-stories, so a test can
 * add up what is drawn and hold it to the plan.
 */
import { LEVELS, layersAt, planNeighborhood, planRing } from '@city/ground';
import type { GroundPlan, Layer, Point, Segment } from '@city/ground';
import { RATES } from '@city/site';
import type { TileKey } from '@city/site';
import { byId, svg } from '../dom.ts';
import type { Painted } from './angled/view.ts';
import { ZOOM_MAX } from '../session.ts';
import { fmt } from '../format.ts';
import type { Page } from '../page.ts';
import { LEVEL_NAME, NO_WEBGL, PRESET_NAME, SITE_NAME, SUB_LABEL, TILT_NAME, angledCaption, hourSaid, irlCaption, layerLines, placeholderNote, subCaption } from '../wording.ts';
import { nextPreset, presetOf } from './irl/sun.ts';
import { irlSupported, subCounts } from './irl/view.ts';

/** Room round the tile for the legend, the scale and the note, metres. */
const MARGIN = 48;

/**
 * The Ground's plan of a tile, or null when the tile has no ground to plan.
 * @param page - the page
 * @param key - the tile
 */
export function planAt(page: Page, key: TileKey): GroundPlan | null {
  const t = page.s.game.layout.tiles[key];
  if (!t) return null;
  if (t.kind === 'hood') return planNeighborhood(RATES.shared, RATES.walking, RATES.base);
  if (t.kind === 'ring') return planRing(RATES.walking, RATES.base, t.n);
  return null;
}

const pts = (list: readonly Point[]): string => list.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

function line(seg: Segment, cls: string): SVGElement {
  return svg('line', { x1: seg.from.x.toFixed(1), y1: seg.from.y.toFixed(1), x2: seg.to.x.toFixed(1), y2: seg.to.y.toFixed(1) }, cls);
}

/** Words broken into lines of at most so many characters, at spaces. */
function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line.length > 0 && line.length + 1 + word.length > width) {
      lines.push(line);
      line = word;
    } else line = line.length > 0 ? `${line} ${word}` : word;
  }
  if (line.length > 0) lines.push(line);
  return lines;
}

function label(x: number, y: number, cls: string, words: string, anchor = 'start'): SVGElement {
  const n = svg('text', { x: x.toFixed(1), y: y.toFixed(1), 'text-anchor': anchor }, cls);
  n.textContent = words;
  return n;
}

/** The shapes of one level. The other level's outlines are ghosted so the eye keeps its place. */
function drawLayer(g: SVGElement, layer: Layer, plan: GroundPlan): void {
  if (layer.of === 'neighborhood') {
    const surface = plan.kind === 'neighborhood' ? plan.surface : null;
    if (surface) {
      const ghost = layer.level === 'sub' ? ' ghost' : '';
      g.append(svg('circle', { cx: surface.center.at.x, cy: surface.center.at.y, r: surface.center.radiusM.toFixed(1) }, `g-center${ghost}`));
      g.append(svg('circle', { cx: surface.park.at.x.toFixed(1), cy: surface.park.at.y.toFixed(1), r: surface.park.radiusM.toFixed(1) }, `g-park${ghost}`));
      if (!ghost) {
        g.append(label(surface.center.at.x, surface.center.at.y + 5, 'g-name', 'Center', 'middle'));
        g.append(label(surface.park.at.x, surface.park.at.y + 5, 'g-name', 'Park', 'middle'));
      }
    }
    if (layer.level === 'surface') {
      const depth = plan.kind === 'neighborhood' ? plan.figures.rowDepthM : 0;
      for (const r of layer.rows) {
        g.append(svg('rect', { x: r.x0.toFixed(1), y: (r.y - depth / 2).toFixed(1), width: r.frontageM.toFixed(1), height: depth, 'data-homes': r.homes }, 'g-row'));
      }
      for (const e of layer.lane) g.append(line(e, 'g-lane'));
    } else {
      for (const p of layer.pipes) g.append(line(p, 'g-pipe'));
      for (const e of layer.entries) if (e.walkway) g.append(line(e.walkway, 'g-walkway'));
      for (const e of layer.entries) {
        g.append(svg('circle', { cx: e.at.x.toFixed(1), cy: e.at.y.toFixed(1), r: 6, 'data-homes': e.homes }, 'g-entry'));
      }
      g.append(svg('circle', { cx: layer.stop.at.x, cy: layer.stop.at.y, r: 14 }, 'g-stop'));
      g.append(label(layer.stop.at.x, layer.stop.at.y + 30, 'g-name', 'Stop', 'middle'));
    }
    return;
  }
  const surface = plan.kind === 'ring' ? plan.surface : null;
  if (surface) {
    const ghost = layer.level === 'sub' ? ' ghost' : '';
    g.append(svg('circle', { cx: 0, cy: 0, r: surface.plaza.radiusM.toFixed(1) }, `g-plaza${ghost}`));
    if (!ghost) g.append(label(0, 5, 'g-name', 'Plaza', 'middle'));
  }
  if (layer.level === 'surface') {
    for (const b of layer.buildings) g.append(svg('polygon', { points: pts(b.corners), 'data-stories': b.stories }, 'g-bldg'));
  } else {
    g.append(svg('circle', { cx: layer.stop.at.x, cy: layer.stop.at.y, r: 14 }, 'g-stop'));
    g.append(label(layer.stop.at.x, layer.stop.at.y + 30, 'g-name', 'Stop', 'middle'));
  }
}

/**
 * Draw the ground of the tile the session is looking at, at the level it shows. The caller has checked the view is
 * at a tile with ground; a view at anything else draws nothing.
 * @param page - the page
 */
export function drawGround(page: Page): void {
  const { s } = page;
  if (s.view.at !== 'tile') return;
  const plan = planAt(page, s.view.key);
  if (!plan) return;
  const board = byId('board');
  const layer = layersAt(plan, s.view.level);
  const halfW = (Math.sqrt(3) / 2) * plan.frame.cornerM + MARGIN;
  const halfH = plan.frame.cornerM + MARGIN;
  board.setAttribute('viewBox', [-halfW, -halfH, 2 * halfW, 2 * halfH].map((v) => v.toFixed(0)).join(' '));
  board.textContent = '';
  const g = svg('g', { 'data-view': s.view.key, 'data-level': s.view.level }, 'ground');
  g.append(svg('polygon', { points: pts(plan.frame.corners) }, 'g-tile'));
  drawLayer(g, layer, plan);
  // Legend, top left; scale, bottom left; the note, bottom right.
  const lines = layerLines(layer, plan);
  g.append(label(-halfW + 8, -halfH + 16, 'g-head', `${SITE_NAME[plan.kind === 'ring' ? 'ring' : 'hood']} · ${LEVEL_NAME[s.view.level]}`));
  lines.forEach((words, i) => g.append(label(-halfW + 8, -halfH + 32 + i * 14, 'g-legend', words)));
  const sy = halfH - 14;
  const sx = -halfW + 8;
  g.append(svg('path', { d: `M${sx} ${sy - 5} V${sy} H${sx + 100} V${sy - 5}` }, 'scalebar'));
  g.append(label(sx, sy - 9, 'g-legend', '100 m'));
  // The note, wrapped to the width that is left of the scale bar.
  const noteLines = wrap(placeholderNote(plan), Math.floor((2 * halfW - 140) / 5.2));
  noteLines.forEach((words, i) => g.append(label(halfW - 8, halfH - 8 - (noteLines.length - 1 - i) * 12, 'g-note', words, 'end')));
  board.append(g);
}

/**
 * The bar above the board: hidden on the map; on a tile it names the tile, offers the way back and the two levels;
 * from the air it says what was painted and offers the way back, with no levels.
 * @param page - the page
 * @param painted - what the angled view painted, when it is showing
 */
export function drawViewBar(page: Page, painted: Painted | null = null): void {
  const { s } = page;
  const bar = byId('viewbar');
  const levels = byId('levels');
  const air = byId('aircontrols');
  const irl = byId('irlcontrols');
  byId('angled').setAttribute('aria-pressed', String(s.view.at === 'angled'));
  byId('irl').setAttribute('aria-pressed', String(s.view.at === 'irl'));
  irl.hidden = s.view.at !== 'irl';
  if (s.view.at === 'irl') {
    bar.hidden = false;
    levels.hidden = true;
    air.hidden = true;
    const sub = subCounts();
    const caption = irlCaption(painted?.blocks ?? 0, painted?.stories ?? 0, painted?.sites ?? 0, painted?.lit ?? 1);
    byId('viewtext').textContent = irlSupported() ? (s.sub ? `${caption} ${subCaption(sub.guideways, sub.stops, sub.closed, sub.warned)}` : caption) : NO_WEBGL;
    byId('irl-night').textContent = PRESET_NAME[nextPreset(s.hour)];
    byId<HTMLInputElement>('irl-hour').value = String(s.hour);
    byId('irl-hour-said').textContent = hourSaid(s.hour, presetOf(s.hour));
    byId('irl-sub').textContent = SUB_LABEL[s.sub ? 'on' : 'off'];
    byId('irl-sub').setAttribute('aria-pressed', String(s.sub));
    return;
  }
  if (s.view.at === 'angled') {
    bar.hidden = false;
    levels.hidden = true;
    air.hidden = false;
    byId('viewtext').textContent = angledCaption(painted?.blocks ?? 0, painted?.stories ?? 0, painted?.sites ?? 0, painted?.lit ?? 1);
    byId<HTMLButtonElement>('air-out').disabled = s.air.zoom <= 1;
    byId<HTMLButtonElement>('air-in').disabled = s.air.zoom >= ZOOM_MAX;
    byId('air-tilt').textContent = `Tilt: ${TILT_NAME[s.air.tilt]}`;
    return;
  }
  levels.hidden = false;
  air.hidden = true;
  if (s.view.at !== 'tile') {
    bar.hidden = true;
    return;
  }
  const plan = planAt(page, s.view.key);
  bar.hidden = false;
  byId('viewtext').textContent = plan
    ? `${SITE_NAME[plan.kind === 'ring' ? 'ring' : 'hood']} at ${s.view.key}, ${fmt(RATES.tileAcres)} acres`
    : '';
  for (const level of LEVELS) byId(`level-${level}`).setAttribute('aria-pressed', String(level === s.view.level));
}
