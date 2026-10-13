/**
 * @file The tray: the tools you build with, each with a swatch, a name and a count.
 * Public interface: TOOLS, buildTray, drawTray, toolCalled.
 * Owner context: Board (adapter).
 */
import { RATES } from '@city/site';
import { byId, el, svg } from '../dom.ts';
import { fmt } from '../format.ts';
import type { Page } from '../page.ts';
import type { ToolId } from '../wording.ts';

/** One tool in the tray. */
export interface Tool {
  readonly id: ToolId;
  readonly group: string;
  readonly name: string;
  readonly letter?: string;
  readonly hint: string;
}

export const TOOLS: readonly Tool[] = [
  { id: 'inspect', group: 'Tools', name: 'Inspect', hint: 'Click a tile to read it.' },
  { id: 'erase', group: 'Tools', name: 'Erase', hint: 'Click a tile to remove what is on it, one building at a time. On open ground it removes the mover line.' },
  { id: 'hood', group: 'On the surface', name: 'Neighborhood', hint: `Click open ground to found a neighborhood of ${fmt(RATES.hood)} people.` },
  { id: 'ring', group: 'On the surface', name: 'Ring building', hint: 'Click open ground to start a ring. Click a ring to add a 25-story building.' },
  { id: 'elementary', group: 'On the surface', name: 'Elementary school', letter: 'E', hint: 'Click a neighborhood to give it a school of up to 500 pupils. Click again to take it away.' },
  { id: 'middle', group: 'On the surface', name: 'Middle school', letter: 'M', hint: 'Click a neighborhood to give it a school of up to 1,000 pupils. Click again to take it away.' },
  { id: 'high', group: 'On the surface', name: 'High school', letter: 'H', hint: 'Click a neighborhood to give it a school of up to 1,500 pupils. Click again to take it away.' },
  { id: 'fields', group: 'On the surface', name: 'Playing fields', letter: 'F', hint: 'Click a neighborhood to put playing fields beside it. Click again to take them away.' },
  { id: 'line', group: 'On the sub level', name: 'Mover line', hint: 'Click a tile, then a neighbor, to run the mover line between them. Click the same pair again to remove it.' },
  { id: 'power', group: 'At the edge', name: 'Reactor module', hint: `Click open ground for a reactor site. Click the site to add a ${RATES.moduleMw} MW module.` },
  { id: 'water', group: 'At the edge', name: 'Water plant', hint: `Click open ground for a water plant. Each click adds a unit for ${fmt(RATES.plantServes)} people.` },
  { id: 'sewage', group: 'At the edge', name: 'Sewage plant', hint: `Click open ground for a sewage plant. Each click adds a unit for ${fmt(RATES.plantServes)} people.` },
  { id: 'waste', group: 'At the edge', name: 'Waste works', hint: `Click open ground for a sorting line and digester. Each click adds a unit for ${fmt(RATES.plantServes)} people.` },
];

/** The tool with an id. */
export function toolCalled(id: ToolId): Tool {
  const t = TOOLS.find((x) => x.id === id);
  if (!t) throw new Error(`no tool ${id}`);
  return t;
}

function hexPoints(s: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    pts.push(`${(s * Math.cos(a)).toFixed(1)},${(s * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

function swatch(t: Tool): SVGElement {
  const s = svg('svg', { viewBox: '-13 -13 26 26', 'aria-hidden': 'true' });
  if (t.id === 'inspect') {
    s.append(svg('circle', { cx: -2, cy: -2, r: 6 }, 'glyph'), svg('path', { d: 'M3 3 L9 9' }, 'glyph'));
    return s;
  }
  if (t.id === 'erase') {
    s.append(svg('path', { d: 'M-6 -6 L6 6 M6 -6 L-6 6' }, 'glyph'));
    return s;
  }
  if (t.id === 'line') {
    const l = svg('path', { d: 'M-10 6 L10 -6' }, 'mover');
    l.setAttribute('style', 'stroke-width:2.6;stroke-dasharray:5 3');
    s.append(l, svg('circle', { cx: -10, cy: 6, r: 2.4 }, 'stop'), svg('circle', { cx: 10, cy: -6, r: 2.4 }, 'stop'));
    return s;
  }
  if (t.letter) {
    s.append(svg('circle', { cx: 0, cy: 0, r: 8.5 }, t.id === 'fields' ? 'badge out' : 'badge'));
    const label = svg('text', { x: 0, y: 3.6, 'text-anchor': 'middle', style: 'font: 800 10px var(--display)' }, t.id === 'fields' ? 'badgetext out' : 'badgetext');
    label.textContent = t.letter;
    s.append(label);
    return s;
  }
  const g = svg('g', undefined, `tile ${t.id}`);
  g.append(svg('polygon', { points: hexPoints(11.5) }, 'hex'));
  if (t.id === 'ring') {
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      g.append(svg('rect', { x: (6 * Math.cos(a) - 1.4).toFixed(1), y: (6 * Math.sin(a) - 1.4).toFixed(1), width: 2.8, height: 2.8 }, 'bldg'));
    }
  }
  s.append(g);
  return s;
}

const buttons: Partial<Record<ToolId, { b: HTMLButtonElement; n: HTMLSpanElement }>> = {};

/** Build the tray once. */
export function buildTray(page: Page): void {
  const tray = byId('tray');
  const groups: string[] = [];
  for (const t of TOOLS) if (!groups.includes(t.group)) groups.push(t.group);
  for (const name of groups) {
    const box = el('div', 'group');
    const tools = el('div', 'tools');
    box.append(el('h2', '', name), tools);
    for (const t of TOOLS.filter((x) => x.group === name)) {
      const b = el('button', 'tool');
      b.type = 'button';
      b.id = `tool-${t.id}`;
      const n = el('span', 'n');
      b.append(swatch(t), el('span', '', t.name), n);
      b.addEventListener('click', () => {
        page.s.tool = t.id;
        page.s.lineFrom = null;
        page.say(t.hint);
        page.render();
      });
      buttons[t.id] = { b, n };
      tools.append(b);
    }
    tray.append(box);
  }
}

/** Mark the tool in hand and count what stands. */
export function drawTray(page: Page): void {
  const sc = page.s.ev.score;
  const counts: Partial<Record<ToolId, string | number>> = {
    hood: sc.hoods,
    ring: sc.ringBuildings,
    elementary: sc.schools.elementary,
    middle: sc.schools.middle,
    high: sc.schools.high,
    fields: sc.fields,
    line: `${fmt(sc.moverKm, 1)} km`,
    power: sc.units.power,
    water: sc.units.water,
    sewage: sc.units.sewage,
    waste: sc.units.waste,
  };
  for (const t of TOOLS) {
    const entry = buttons[t.id];
    if (!entry) continue;
    entry.b.setAttribute('aria-pressed', String(t.id === page.s.tool));
    const c = counts[t.id];
    entry.n.textContent = c === undefined ? '' : String(c);
  }
  byId('board').style.cursor = page.s.tool === 'inspect' ? '' : 'crosshair';
}
