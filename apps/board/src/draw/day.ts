/**
 * @file The day card: one day of the people living here now, hour by hour, from the Site's day view (ADR-0009), with
 * the day's shape and each figure's mark.
 * Public interface: drawDay, dayNow.
 * Owner context: Board (adapter).
 */
import { occupiedOf } from '@city/run';
import { DAYS, RATES, dayOf } from '@city/site';
import type { Day, DayPremises } from '@city/site';
import type { Game } from '@city/run';
import { byId, el } from '../dom.ts';
import { fmt } from '../format.ts';
import type { Page } from '../page.ts';
import { DAY_PREMISE, dayCaption, hourLabel } from '../wording.ts';
import { markChip } from './money.ts';

/**
 * The day of a game's people: on a run with the month clock, the people living there this month; otherwise every
 * neighborhood full. A summer weekday, the default day (David, 2026-10-14).
 * @param game - the game
 */
export function dayNow(game: Game): Day {
  const growth = game.clock?.growth;
  return growth ? dayOf(game.layout, RATES, { occupied: occupiedOf(game.layout, growth, RATES) }) : dayOf(game.layout, RATES);
}

function premiseItem(name: string, value: string, mark: DayPremises['tripPeakHour']['mark']): HTMLLIElement {
  const li = el('li');
  li.append(el('b', '', `${name}: `), value, markChip(mark));
  return li;
}

export function drawDay(page: Page): void {
  const day = dayNow(page.s.game);
  byId('daynow').textContent = dayCaption(day);
  const rows = byId('hourrows');
  rows.textContent = '';
  for (const h of day.hours) {
    const tr = el('tr', h.hour === day.tripPeakHour ? 'peak' : '');
    const th = el('th', '', hourLabel(h.hour));
    th.setAttribute('scope', 'row');
    tr.append(
      th,
      el('td', 'num', fmt(h.trips)),
      el('td', 'num', fmt(h.rides)),
      el('td', 'num', fmt(h.moving)),
      el('td', 'num', fmt(h.powerMw, 1)),
      el('td', 'num', h.pupils > 0.5 ? fmt(h.pupils) : '–'),
    );
    rows.append(tr);
  }
  const k = DAYS[day.day];
  const list = byId('daypremises');
  list.textContent = '';
  list.append(premiseItem(DAY_PREMISE.tripPeriods.name, DAY_PREMISE.tripPeriods.value(k.tripPeriods.value), k.tripPeriods.mark));
  // Every premise the wording names, so a premise added to the Ledger and worded is listed without another change here.
  const ids = (Object.keys(DAY_PREMISE) as (keyof DayPremises)[]).filter((id): id is Exclude<keyof DayPremises, 'tripPeriods'> => id !== 'tripPeriods');
  for (const id of ids) list.append(premiseItem(DAY_PREMISE[id].name, DAY_PREMISE[id].value(k[id].value), k[id].mark));
}
