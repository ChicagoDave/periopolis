/**
 * @file The money card: what this city costs to build and to run, by layer, beside a car city of the same size; every
 * row with its premise and mark; and, while the clock runs, what the run has spent by layer and in all (ADR-0007).
 * Public interface: drawMoney.
 * Owner context: Board (adapter).
 */
import { LAYERS, RATES, costOf, kindOf } from '@city/site';
import type { CostFigures, Layer } from '@city/site';
import { RULES } from '@city/run';
import { byId, el } from '../dom.ts';
import { fmt, money } from '../format.ts';
import { linesOf, spentSoFar } from '../money.ts';
import type { Page } from '../page.ts';
import { COST_ROW_NAME, LAYER_NAME, lineAt, markLabel, markText } from '../wording.ts';

function cell(text: string, cls = ''): HTMLTableCellElement {
  return el('td', cls, text);
}

/** A row of the layer table: a label, this city's total and a person, the car city's a person. */
function layerRow(label: string, mine: number, pop: number, car: number | null, cls = ''): HTMLTableRowElement {
  const tr = el('tr', cls);
  tr.append(el('th', '', label), cell(money(mine), 'num'), cell(pop > 0 ? money(mine / pop) : '–', 'num'), cell(car === null ? '–' : money(car), 'num'));
  tr.firstElementChild?.setAttribute('scope', 'row');
  return tr;
}

export function drawMoney(page: Page): void {
  const { s } = page;
  const cost = costOf(s.game.layout, s.ev, RATES);
  const car: CostFigures | null = s.ev.score.car ? s.ev.score.car.cost : null;
  const pop = cost.pop;
  const head = byId('moneynow');
  head.textContent = '';
  if (!cost.rows.length) head.textContent = 'Nothing stands, so nothing costs anything yet.';
  else {
    head.append(
      el('b', '', `${money(cost.capitalTotal)} to build`),
      `, ${money(cost.capitalPerPerson)} a person. `,
      el('b', '', `${money(cost.runningTotal)} a year to run`),
      `, ${money(cost.runningPerPerson)} a person. Land ${money(cost.land.cost)}. Financing the structures ${money(cost.financing.yearly)} a year over ${cost.financing.years} years at ${fmt(100 * cost.financing.rate, 1)}%.`,
    );
  }

  // By layer, beside the car city of the same size.
  const body = byId('layerrows');
  body.textContent = '';
  const carPer = (f: (c: CostFigures) => number): number | null => (car && pop > 0 ? f(car) / pop : null);
  for (const kind of ['capital', 'running'] as const) {
    for (const layer of LAYERS.filter((l) => kindOf(l) === kind)) body.append(layerRow(LAYER_NAME[layer], cost.layers[layer], pop, carPer((c) => c.layers[layer])));
    body.append(
      kind === 'capital'
        ? layerRow('To build, once', cost.capitalTotal, pop, carPer((c) => c.capitalTotal), 'total')
        : layerRow('To run, a year', cost.runningTotal, pop, carPer((c) => c.runningTotal), 'total'),
    );
  }
  body.append(layerRow('Land, once', cost.land.cost, pop, carPer((c) => c.land.cost)), layerRow('Financing, a year', cost.financing.yearly, pop, carPer((c) => c.financing.yearly)));

  // Every row: how many of what, at which premise, and whose figure the premise is.
  const rows = byId('costrows');
  rows.textContent = '';
  let last: Layer | null = null;
  for (const line of linesOf(cost)) {
    if (line.layer !== last) {
      const tr = el('tr', 'layer');
      const th = el('th', '', LAYER_NAME[line.layer]);
      th.colSpan = 4;
      th.setAttribute('scope', 'rowgroup');
      tr.append(th);
      rows.append(tr);
      last = line.layer;
    }
    const tr = el('tr');
    const chip = el('span', `chip mark ${line.mark.kind}`, markLabel(line.mark));
    chip.title = markText(line.mark);
    const markCell = el('td');
    markCell.append(chip);
    tr.append(cell(COST_ROW_NAME[line.id]), cell(lineAt(line), 'at'), cell(money(line.cost), 'num'), markCell);
    rows.append(tr);
  }

  // The run's spend so far.
  const spentBox = byId('spentbox');
  const spent = spentSoFar(s.game.clock);
  spentBox.hidden = !spent;
  if (!spent) return;
  const year = s.game.clock?.year ?? 0;
  byId('spentnow').textContent = year
    ? `${money(spent.total)} spent in ${year === 1 ? 'one year' : `${year} years`}: ${money(spent.capital)} to build, ${money(spent.running)} to run.${year >= RULES.years ? ' The twenty years are up.' : ''}`
    : 'Nothing spent yet. Year 0 counts for nothing.';
  const sb = byId('spentrows');
  sb.textContent = '';
  for (const layer of LAYERS) {
    const tr = el('tr');
    tr.append(el('th', '', LAYER_NAME[layer]), cell(money(spent.byLayer[layer]), 'num'));
    tr.firstElementChild?.setAttribute('scope', 'row');
    sb.append(tr);
  }
}
