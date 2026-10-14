/**
 * @file The city as text: everything on the board, the lines, the stretch tests and the clock, to paste back into a
 * conversation.
 * Public interface: asText.
 * Owner context: Board (adapter).
 */
import { RULES, stressAt } from '@city/run';
import { EXTRAS, LAYERS, RATES, allTiles, assess, costOf } from '@city/site';
import { yearLine } from './draw/clock.ts';
import { cap, fmt, money, pct } from './format.ts';
import { linesOf, spentSoFar } from './money.ts';
import type { Session } from './session.ts';
import { COST_ROW_NAME, LAYER_NAME, PIECE_NAME, STATUS, checkDetail, checkTitle, lineAt, linesLabel, markLabel, noticeText, testLabel } from './wording.ts';

export function asText(s: Session): string {
  const clock = s.game.clock;
  const today = assess(s.game.layout, RATES, clock ? { now: stressAt(clock, RATES.band) } : {});
  const sc = today.score;
  const out = ['FUTURE CITY BUILDER', ''];
  out.push(`People: ${fmt(sc.pop)} in ${sc.hoods} neighborhoods`);
  out.push(`Ring buildings: ${sc.ringBuildings}. Schools: ${sc.schools.elementary} elementary, ${sc.schools.middle} middle, ${sc.schools.high} high. Fields: ${sc.fields}.`);
  out.push(`Reactor modules: ${sc.units.power}. Water units: ${sc.units.water}. Sewage units: ${sc.units.sewage}. Waste units: ${sc.units.waste}.`);
  out.push(`Mover line: ${fmt(sc.moverKm, 1)} km with ${sc.stops} stops. Sub-level walkway: ${fmt(sc.walkwayKm)} km. Goods pipe: ${fmt(sc.pipeKm)} km.`);
  out.push(
    `Trips: ${pct(sc.foot)} on foot, ${pct(sc.bike)} by bike, ${pct(sc.ride)} by mover${sc.stuck + sc.nowhere > 0.0005 ? `, ${fmt(100 * (sc.stuck + sc.nowhere), 1)}% with no way to go` : ''}. Movers: ${fmt(sc.fleet)}. Average ride: ${fmt(sc.door, 1)} min door to door.`,
  );
  if (sc.car) out.push(`Car city of the same size: ${fmt(sc.car.acres)} acres, ${fmt(sc.car.vehicles)} cars, ${pct(sc.car.ride)} of trips by car.`);
  out.push('', 'LINES');
  for (const r of today.checks) out.push(`[${STATUS[r.status]}] ${linesLabel(r.lines)}: ${checkTitle(r.id)}. ${checkDetail(r.facts, RATES)}`);
  out.push('', 'STRETCH');
  for (const t of today.tests) {
    out.push(`${t.gives.length ? '[Gives] ' : '[Holds] '}${cap(testLabel(t.id, RATES.band))}${t.gives.length ? `: ${t.gives.map((g) => checkTitle(g.id)).join('; ')}` : ''}`);
  }
  if (clock) {
    const last = clock.record[clock.record.length - 1];
    out.push('', 'CLOCK', `Year ${clock.year} of ${RULES.years}. Homes for ${fmt(last?.homes ?? 0)} people. Broken line-years: ${clock.lineYears}.`);
    for (const n of s.news) out.push(`${n.when === 'now' ? 'Now: ' : 'Announced: '}${noticeText(n, RATES.band, RULES)}`);
    for (const r of clock.record) out.push(yearLine(r));
    if (s.hand.list.length) out.push(`Work in hand: ${s.hand.list.map((j) => `${PIECE_NAME[j.what]} at ${j.at} (${j.status === 'working' ? `${j.left} yr` : j.status})`).join('; ')}`);
  }
  const cost = costOf(s.game.layout, today, RATES);
  out.push('', 'MONEY (ADR-0007; every unit cost is a placeholder with its mark)');
  if (!cost.rows.length) out.push('Nothing stands, so nothing costs anything yet.');
  else {
    out.push(`To build: ${money(cost.capitalTotal)} (${money(cost.capitalPerPerson)} a person). To run: ${money(cost.runningTotal)} a year (${money(cost.runningPerPerson)} a person). Land: ${money(cost.land.cost)}. Financing: ${money(cost.financing.yearly)} a year.`);
    const car = sc.car?.cost;
    if (car && cost.pop > 0) out.push(`Car city of the same size, a person: ${money(car.capitalTotal / cost.pop)} to build, ${money(car.runningTotal / cost.pop)} a year to run.`);
    for (const layer of LAYERS) out.push(`${LAYER_NAME[layer]}: ${money(cost.layers[layer])}`);
    for (const line of linesOf(cost)) out.push(`  ${COST_ROW_NAME[line.id]}: ${lineAt(line)} = ${money(line.cost)} [${markLabel(line.mark)}]`);
    const spent = spentSoFar(clock);
    if (spent && clock) {
      out.push(`Spent so far, years 1 to ${clock.year}: ${money(spent.total)} (${money(spent.capital)} to build, ${money(spent.running)} to run).`);
      out.push(`  By layer: ${LAYERS.map((layer) => `${LAYER_NAME[layer]} ${money(spent.byLayer[layer])}`).join('; ')}.`);
    }
  }
  out.push('', 'TILES (east, down-right)');
  for (const k of allTiles(RATES.outline)) {
    const t = s.game.layout.tiles[k];
    if (!t) continue;
    const held = t.kind === 'hood' ? EXTRAS.filter((x) => t.has[x]) : [];
    out.push(`${k} ${t.kind}${t.kind === 'hood' ? (held.length ? ` with ${held.join(', ')}` : '') : ` x${t.n}`}`);
  }
  out.push('', 'MOVER LINE', Object.keys(s.game.layout.lines).sort().join('  '));
  return out.join('\n');
}
