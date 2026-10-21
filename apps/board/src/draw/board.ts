/**
 * @file The board: tiles, the city's circles and their bands, the lake along the shore, the 30-minute circles, the
 * mover line, what stands on each tile, and the labels. When the session looks at one tile, the ground module draws
 * that tile instead and the map waits; from the air, the angled view paints its canvas instead.
 * Public interface: drawBoard, describe, tileAtPixels, groundOf.
 * Owner context: Board (adapter).
 */
import { splitPiece } from '@city/run';
import { BAND_RING, EXTRAS, RATES, allTiles, circleOf, circleTiles, edgeEnds, extent, ringDistance, tileAt, tileKey } from '@city/site';
import type { TileKey } from '@city/site';
import { byId, svg } from '../dom.ts';
import { fmt, years } from '../format.ts';
import type { Page } from '../page.ts';
import { GROUND_TEXT, LAKE_LABEL, SITE_NAME, circleName, currentLabel } from '../wording.ts';
import type { GroundKind } from '../wording.ts';
import { drawAngled } from './angled/view.ts';
import { drawGround, drawViewBar } from './ground.ts';

const SIZE = 30;
const W3 = Math.sqrt(3);
const PX_KM = SIZE / RATES.tileKm;
const REACH = extent(RATES.outline);
/** The site's outline, px, centred on "0,0": the tiles' reach each way plus the half tile the outermost tiles extend past their middles. */
const OUT_LEFT = W3 * SIZE * (REACH.west - 0.5);
const OUT_RIGHT = W3 * SIZE * (REACH.east + 0.5);
const OUT_TOP = 1.5 * SIZE * REACH.north - SIZE;
const OUT_BOTTOM = 1.5 * SIZE * REACH.south + SIZE;
const OUT_W = (OUT_RIGHT - OUT_LEFT) / 2;
const OUT_H = (OUT_BOTTOM - OUT_TOP) / 2;
/** Where the outline's middle sits relative to "0,0", px. */
const OUT_CX = (OUT_LEFT + OUT_RIGHT) / 2;
const OUT_CY = (OUT_TOP + OUT_BOTTOM) / 2;
const MARGIN = 12;
/** The lake along the south edge, below the outline (ADR-0016 Decision 5): its height, px. */
const LAKE_H = 16;
/** Room below the outline for the lake, the scale and the tile's figures. */
const FOOTER = 34 + LAKE_H + 4;
const HALF_W = OUT_W + MARGIN;
const HALF_H = OUT_H + MARGIN;
const LETTER: Readonly<Record<string, string>> = { elementary: 'E', middle: 'M', high: 'H', fields: 'F' };
const PLANT_LABEL: Readonly<Record<string, string>> = { power: 'Power', water: 'Water', sewage: 'Sewage', waste: 'Waste' };
const SITE_LABEL: Readonly<Record<string, string>> = { hood: 'Homes', ring: 'Ring', power: 'Power', water: 'Water', sewage: 'Sewage', waste: 'Waste' };

/** Where a tile's middle is drawn. */
export function tileAtPixels(k: TileKey): readonly [number, number] {
  const [q, r] = tileAt(k);
  return [W3 * SIZE * (q + r / 2), 1.5 * SIZE * r];
}

function hexPoints(cx: number, cy: number, s: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    pts.push(`${(cx + s * Math.cos(a)).toFixed(1)},${(cy + s * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

/** Each hex edge, from corner i to corner i + 1 of `hexPoints`, faces the neighbor this many steps away. */
const EDGE_TOWARD: readonly (readonly [number, number])[] = [
  [1, 0],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [0, -1],
  [1, -1],
];

/**
 * Where a tile lies among the circles (ADR-0016): inside a circle's band, on it, or outside every circle. A layout with
 * no circles is the sketch's free board, all inside.
 * @param circles - the layout's circles' middles
 * @param k - the tile
 */
export function groundOf(circles: readonly TileKey[], k: TileKey): GroundKind {
  if (!circles.length) return 'inside';
  const m = circleOf(circles, k);
  if (m === null) return 'outside';
  return ringDistance(m, k) === BAND_RING ? 'band' : 'inside';
}

/** The outer edge of a circle as one path: every hex edge of its tiles that faces a tile not in it. */
function circleEdge(middle: TileKey): string {
  const parts: string[] = [];
  for (const k of circleTiles(middle)) {
    const [q, r] = tileAt(k);
    const [cx, cy] = tileAtPixels(k);
    EDGE_TOWARD.forEach(([dq, dr], i) => {
      if (ringDistance(middle, tileKey(q + dq, r + dr)) <= BAND_RING) return;
      const a = (Math.PI / 180) * (60 * i - 30);
      const b = (Math.PI / 180) * (60 * (i + 1) - 30);
      parts.push(`M${(cx + SIZE * Math.cos(a)).toFixed(1)} ${(cy + SIZE * Math.sin(a)).toFixed(1)}L${(cx + SIZE * Math.cos(b)).toFixed(1)} ${(cy + SIZE * Math.sin(b)).toFixed(1)}`);
    });
  }
  return parts.join('');
}

/** A tile in a few words, for the screen reader and the inspect tool. */
export function describe(page: Page, k: TileKey): string {
  const { s } = page;
  const t = s.game.layout.tiles[k];
  const info = s.ev.per[k];
  const site = s.hand.sites[k];
  if (!t) {
    return site
      ? `Building site, ${(SITE_LABEL[site.kind] ?? site.kind).toLowerCase()}, ${site.status === 'working' ? `${years(site.left)} to go` : 'waiting for a crew'}`
      : GROUND_TEXT[groundOf(s.game.layout.circles ?? [], k)];
  }
  let text: string = SITE_NAME[t.kind];
  if (t.kind === 'hood') {
    const has = EXTRAS.filter((x) => t.has[x]).map((x) => SITE_NAME[x].toLowerCase());
    if (has.length) text += ` with ${has.join(', ')}`;
  } else if (t.kind === 'ring') text += ` of ${t.n}${t.n === 1 ? ' building' : ' buildings'}`;
  else text += `, ${t.n}${t.kind === 'power' ? (t.n === 1 ? ' module' : ' modules') : t.n === 1 ? ' unit' : ' units'}`;
  if (info && info.issues.length) text += `. ${info.issues.length}${info.issues.length === 1 ? ' problem' : ' problems'}`;
  return text;
}

/** Draw the board from the ground up. Only the tiles take clicks, so nothing drawn above them gets in the way. */
export function drawBoard(page: Page): void {
  const { s } = page;
  // From the air, the canvas shows in the SVG's place and the view bar says what was painted.
  const painted = drawAngled(page);
  drawViewBar(page, painted);
  if (s.view.at === 'angled') return;
  if (s.view.at === 'tile') {
    drawGround(page);
    return;
  }
  const board = byId('board');
  const hadFocus = board.contains(document.activeElement);
  board.setAttribute('viewBox', [OUT_CX - HALF_W, OUT_CY - HALF_H, 2 * HALF_W, 2 * HALF_H + FOOTER].map((v) => v.toFixed(0)).join(' '));
  board.textContent = '';
  const defs = svg('defs');
  const hatch = svg('pattern', { id: 'hatch', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
  hatch.append(svg('line', { x1: 0, y1: 0, x2: 0, y2: 6 }, 'hatchline'));
  defs.append(hatch);
  const ground = svg('g');
  // The site's outline: one plain figure round the tiles (ADR-0006), stronger than the tile lines inside it.
  ground.append(svg('rect', { x: OUT_LEFT.toFixed(1), y: OUT_TOP.toFixed(1), width: (2 * OUT_W).toFixed(1), height: (2 * OUT_H).toFixed(1), rx: 2 }, 'outline'));
  const reach = svg('g', undefined, 'over');
  const lines = svg('g', undefined, 'over');
  const stands = svg('g', undefined, 'over');
  const top = svg('g', undefined, 'over');
  const tiles = s.game.layout.tiles;
  const circles = s.game.layout.circles ?? [];
  const rings = Object.keys(tiles).filter((k) => tiles[k]?.kind === 'ring');
  const text = (x: number | string, y: number | string, cls: string, words: string): SVGElement => {
    const n = svg('text', { x, y, 'text-anchor': 'middle' }, cls);
    n.textContent = words;
    return n;
  };
  const badges = (cx: number, cy: number, list: readonly { x: string; soon: boolean }[]): void =>
    list.forEach((b, i) => {
      const bx = cx + (i - (list.length - 1) / 2) * 11.5;
      const by = cy + 14.5;
      const kind = (b.x === 'fields' ? ' out' : '') + (b.soon ? ' soon' : '');
      stands.append(svg('circle', { cx: bx, cy: by, r: 5 }, `badge${kind}`), text(bx, by + 2.3, `badgetext${kind}`, LETTER[b.x] ?? ''));
    });

  for (const k of allTiles(RATES.outline)) {
    const t = tiles[k];
    const [cx, cy] = tileAtPixels(k);
    const info = s.ev.per[k];
    const site = t ? null : s.hand.sites[k];
    const ordered = s.hand.extras[k] ?? {};
    const where = groundOf(circles, k);
    const cls = ['tile', t ? t.kind : site ? 'site' : 'open'];
    if (where !== 'inside') cls.push(where);
    if (info && info.level) cls.push(info.level);
    if (k === s.picked) cls.push('picked');
    if (k === s.lineFrom && s.tool === 'line') cls.push('from');
    if (s.flash.includes(k)) cls.push('flash');
    const g = svg('g', { 'data-k': k, 'data-ground': where, role: 'button', tabindex: k === s.focusKey ? '0' : '-1', 'aria-label': describe(page, k) }, cls.join(' '));
    g.append(svg('polygon', { points: hexPoints(cx, cy, SIZE - 1.3) }, 'hex'));
    ground.append(g);
    if (site) {
      stands.append(
        text(cx, cy - 2.5, 'sitename', `${SITE_LABEL[site.kind] ?? site.kind}${site.n > 1 ? ` ×${site.n}` : ''}`),
        text(cx, cy + 6.5, 'sitewhen', site.status === 'working' ? `${site.left} yr` : 'waits'),
      );
      badges(cx, cy + 1.5, EXTRAS.filter((x) => ordered[x]).map((x) => ({ x, soon: true })));
    }
    if (!t) continue;
    const more = s.hand.more[k] ? `+${s.hand.more[k]}` : '';
    if (t.kind === 'hood') {
      if (!(info && info.stop)) stands.append(svg('circle', { cx, cy, r: 2.6 }, 'plaza'));
      badges(cx, cy, EXTRAS.filter((x) => t.has[x] || ordered[x]).map((x) => ({ x, soon: !t.has[x] })));
    } else if (t.kind === 'ring') {
      const shown = Math.min(t.n, 14);
      for (let i = 0; i < shown; i++) {
        const a = (2 * Math.PI * i) / shown - Math.PI / 2;
        const bx = cx + 16.5 * Math.cos(a);
        const by = cy + 16.5 * Math.sin(a);
        stands.append(svg('rect', { x: (bx - 2.6).toFixed(1), y: (by - 2.6).toFixed(1), width: 5.2, height: 5.2 }, 'bldg'));
      }
      const label = text(cx, cy + 3.5, 'onring', `${t.n}${more}`);
      if (more) label.setAttribute('style', 'font-size:7px');
      stands.append(svg('circle', { cx, cy, r: more ? 9.6 : 8.6 }, 'hub'), label);
    } else {
      stands.append(text(cx, cy - 7.5, 'plantname', PLANT_LABEL[t.kind] ?? t.kind), text(cx, cy + 14.5, 'plantn', `×${t.n}${more}`));
    }
    if (info && info.level) {
      const my = cy - 16;
      stands.append(
        svg('polygon', { points: [cx - 4.6, my + 3.4, cx + 4.6, my + 3.4, cx, my - 4.2].map((v) => v.toFixed(1)).join(' ') }, `mark ${info.level}`),
      );
    }
  }

  // Each circle's outer edge, and its name above the board; a circle the player closed, dashed, where it would stand.
  const closed = (s.game.clock?.vetoes ?? []).filter((v) => splitPiece(v)[0] === 'circle').map((v) => splitPiece(v)[1]);
  circles.forEach((m, i) => {
    reach.append(svg('path', { d: circleEdge(m), 'data-circle': m }, 'circleedge'));
    top.append(text(tileAtPixels(m)[0].toFixed(1), (OUT_TOP - 3).toFixed(1), 'circlelabel', circleName(i)));
  });
  for (const m of closed) if (!circles.includes(m)) reach.append(svg('path', { d: circleEdge(m), 'data-circle': m }, 'circleedge closed'));
  for (const g of rings) {
    const [cx, cy] = tileAtPixels(g);
    reach.append(svg('circle', { cx, cy, r: (RATES.longKm * PX_KM).toFixed(1) }, 'reach'));
  }
  // The line that stands, with any stretch closed this year or about to be; then the line on order.
  const shut = s.ev.stress.closed ?? [];
  const doomed = s.news.filter((n) => n.edge && n.when === 'soon').map((n) => n.edge);
  const span = (e: string) => {
    const [a, b] = edgeEnds(e);
    const [x1, y1] = tileAtPixels(a);
    const [x2, y2] = tileAtPixels(b);
    return { x1: x1.toFixed(1), y1: y1.toFixed(1), x2: x2.toFixed(1), y2: y2.toFixed(1), mx: (x1 + x2) / 2, my: (y1 + y2) / 2 };
  };
  for (const e of Object.keys(s.game.layout.lines)) {
    const sp = span(e);
    const closed = shut.includes(e);
    const soon = !closed && doomed.includes(e);
    lines.append(svg('line', { x1: sp.x1, y1: sp.y1, x2: sp.x2, y2: sp.y2 }, `mover${closed ? ' closed' : soon ? ' doomed' : ''}`));
    if (closed) {
      top.append(
        svg('circle', { cx: sp.mx.toFixed(1), cy: sp.my.toFixed(1), r: 5.4 }, 'shutdisc'),
        svg('path', { d: `M${(sp.mx - 2.4).toFixed(1)} ${(sp.my - 2.4).toFixed(1)} l4.8 4.8 m0 -4.8 l-4.8 4.8` }, 'shutmark'),
      );
    } else if (soon) {
      top.append(svg('circle', { cx: sp.mx.toFixed(1), cy: sp.my.toFixed(1), r: 5.4 }, 'shutdisc doomed'), text(sp.mx.toFixed(1), (sp.my + 2.9).toFixed(1), 'shutsoon', '!'));
    }
  }
  for (const e of Object.keys(s.hand.lines)) {
    const sp = span(e);
    lines.append(svg('line', { x1: sp.x1, y1: sp.y1, x2: sp.x2, y2: sp.y2 }, 'mover soon'));
  }
  for (const k of Object.keys(tiles)) {
    if (!s.ev.per[k]?.stop || tiles[k]?.kind === 'ring') continue;
    const [cx, cy] = tileAtPixels(k);
    lines.append(svg('circle', { cx, cy, r: 3.9 }, 'stop'));
  }
  const firstRing = rings[0];
  if (firstRing) {
    const [cx, cy] = tileAtPixels(firstRing);
    top.append(text(cx, (cy - RATES.longKm * PX_KM - 4).toFixed(1), 'reachlabel', '30-minute walk'));
  }
  // The lake along the south edge, off the board, and the way its current runs (line 32).
  const lakeY = OUT_BOTTOM + 2;
  ground.append(svg('rect', { x: OUT_LEFT.toFixed(1), y: lakeY.toFixed(1), width: (2 * OUT_W).toFixed(1), height: LAKE_H }, 'lake'));
  const lakeName = svg('text', { x: (OUT_LEFT + 6).toFixed(1), y: (lakeY + LAKE_H - 5).toFixed(1) }, 'laketext');
  lakeName.textContent = LAKE_LABEL;
  const flow = svg('text', { x: (OUT_RIGHT - 6).toFixed(1), y: (lakeY + LAKE_H - 5).toFixed(1), 'text-anchor': 'end' }, 'laketext');
  flow.textContent = currentLabel(RATES.current);
  top.append(lakeName, flow);
  // A scale, below the lake at its left edge.
  const half = PX_KM / 2;
  const sx = Number(OUT_LEFT.toFixed(1));
  const sy = OUT_BOTTOM + LAKE_H + 4 + MARGIN + 16;
  top.append(svg('path', { d: `M${sx} ${sy - 4} V${sy} H${(sx + half).toFixed(1)} V${sy - 4}` }, 'scalebar'));
  const scale = svg('text', { x: sx, y: sy - 8 }, 'scaletext');
  scale.textContent = '500 m';
  const what = svg('text', { x: sx, y: sy + 11 }, 'scaletext');
  what.textContent = `one tile: ${fmt(RATES.hood)} people, ${fmt(RATES.tileAcres)} acres`;
  top.append(scale, what);

  board.append(defs, ground, reach, lines, stands, top);
  if (hadFocus) {
    const again = board.querySelector<SVGElement>('[tabindex="0"]');
    if (again) again.focus();
  }
}
