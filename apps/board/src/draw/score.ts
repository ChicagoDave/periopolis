/**
 * @file The score: your city against a car city of the same size, and the tally of lines.
 * Public interface: drawScore, tally.
 * Owner context: Board (adapter).
 */
import { byId, el } from '../dom.ts';
import { fmt, pct } from '../format.ts';
import type { Page } from '../page.ts';

/** How many lines hold, are watched, are broken, and how many are checked at all. */
export function tally(page: Page): { ok: number; warn: number; bad: number; idle: number; checked: number } {
  const t = { ok: 0, warn: 0, bad: 0, idle: 0, checked: 0 };
  for (const c of page.s.ev.checks) t[c.status]++;
  t.checked = page.s.ev.checks.length - t.idle;
  return t;
}

export function drawScore(page: Page): void {
  const s = page.s.ev.score;
  const c = s.car;
  const box = byId('score');
  box.textContent = '';
  const stat = (label: string, mine: string, car: string, tone = '', carTone = ''): void => {
    const d = el('div');
    const dd = el('dd');
    dd.append(el('span', tone ? `mine ${tone}` : 'mine', mine), el('span', carTone ? `car ${carTone}` : 'car', car));
    d.append(el('dt', '', label), dd);
    box.append(d);
  };
  const t = tally(page);
  const noWay = s.stuck + s.nowhere;
  const rising = Object.keys(page.s.hand.sites).filter((k) => page.s.hand.sites[k]?.kind === 'hood').length;
  stat(
    'Your lines',
    t.checked ? `${t.ok} of ${t.checked}` : '–',
    !t.checked ? 'nothing built yet' : t.bad ? `${t.bad} broken${t.warn ? `, ${t.warn} to watch` : ''}` : t.warn ? `${t.warn} to watch` : 'all hold',
    t.bad ? 'bad' : t.warn ? 'warn' : '',
  );
  stat('People', fmt(s.pop), `${s.hoods}${s.hoods === 1 ? ' neighborhood' : ' neighborhoods'}${rising ? `, ${rising} being built` : ''}`);
  stat('Ground taken', `${fmt(s.acres)} acres`, c ? `car city: ${fmt(c.acres)} acres` : 'car city: none yet');
  if (c && noWay > 0.005) stat('Trips on foot or bike', pct(s.foot + s.bike), `${fmt(100 * noWay, noWay < 0.1 ? 1 : 0)}% have no way to go`, '', 'bad');
  else stat('Trips on foot or bike', s.pop ? pct(s.foot + s.bike) : '–', c ? `car city: ${pct(c.foot + c.bike)}` : ' ');
  stat('Vehicles', `${fmt(s.fleet)} movers`, c ? `car city: ${fmt(c.vehicles)} cars` : ' ');
  stat('Ride, door to door', s.door ? `${fmt(s.door, 1)} min` : '–', c ? `car city: ${fmt(c.door, 1)} min` : ' ');
  stat('Sub level', `${fmt(s.subLevelKm)} km`, `${fmt(s.pipeKm)} km of goods pipe`);
}
