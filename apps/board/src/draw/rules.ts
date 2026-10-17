/**
 * @file Your lines against this map, and whether it stretches.
 * Public interface: drawRules, drawTests.
 * Owner context: Board (adapter).
 */
import { RATES } from '@city/site';
import { button, byId, el } from '../dom.ts';
import { cap, low } from '../format.ts';
import type { Page } from '../page.ts';
import { STATUS, checkDetail, checkTitle, linesLabel, stopsInHand, testLabel } from '../wording.ts';
import { tally } from './score.ts';

export function drawRules(page: Page): void {
  const list = byId('rules');
  list.textContent = '';
  for (const r of page.s.ev.checks) {
    const li = el('li');
    const b = el('button', 'rulebtn');
    const words = el('span');
    b.type = 'button';
    b.id = `rule-${r.id}`;
    words.append(el('span', 'title', checkTitle(r.id)), el('span', 'ref', linesLabel(r.lines)), el('span', 'detail', checkDetail(r.facts, RATES, stopsInHand(r, page.s.building))));
    b.append(el('span', `chip ${r.status}`, STATUS[r.status]), words);
    b.addEventListener('click', () => {
      if (r.tiles.length) {
        page.highlight(r.tiles);
        page.say(`Marked on the board: ${r.tiles.length}${r.tiles.length === 1 ? ' tile.' : ' tiles.'}`);
      } else page.say('Nothing on the board to mark for that line.');
    });
    li.append(b);
    list.append(li);
  }
  const line = byId('tally');
  const t = tally(page);
  line.textContent = '';
  if (!t.checked) line.textContent = 'Nothing to check yet.';
  else line.append(el('b', '', String(t.ok)), ` of ${t.checked} hold${t.bad ? `, ${t.bad} broken` : ''}${t.warn ? `, ${t.warn} to watch` : ''}. Click one to mark its tiles.`);
}

export function drawTests(page: Page): void {
  const { s } = page;
  const list = byId('tests');
  list.textContent = '';
  for (const t of s.ev.tests) {
    const li = el('li');
    const gives = t.gives.length > 0;
    const empty = s.ev.today.pop === 0;
    const hard = t.gives.some((g) => g.status === 'bad');
    const closure = t.id === 'closure';
    const label = testLabel(t.id, RATES.band);
    li.append(el('span', `chip ${empty ? 'idle' : gives ? (hard ? 'bad' : 'warn') : 'ok'}`, empty ? 'Not yet' : gives ? 'Gives' : 'Holds'), el('span', 'title', cap(label)));
    let detail: string;
    const first = t.gives[0];
    if (empty) detail = 'Nothing to stretch yet.';
    else if (gives && first) {
      detail = `First to give: ${low(checkTitle(first.id))}. ${checkDetail(first.facts, RATES)}`;
      if (t.id === 'closure') detail += ` ${t.weak} of the ${t.lines}${t.lines === 1 ? ' stretch' : ' stretches'} of line ${t.weak === 1 ? 'has' : 'have'} no way round.`;
    } else if (t.id === 'closure') detail = !t.lines ? 'There is no mover line to close.' : t.weak ? 'Closing any one stretch breaks nothing.' : 'Every stretch has a way round it.';
    else detail = 'Every line that holds today still holds.';
    li.append(el('span', 'detail', detail));
    // While the clock runs the board shows the year as it is, so the look-ahead is switched off.
    if (!s.game.clock && !(closure && !gives)) {
      const b = button(s.ev.showing === t.id ? 'Back to today' : 'Show on the board', () => {
        s.showing = s.showing === t.id ? null : t.id;
        page.say(s.showing ? `The board now shows the city with ${label}.` : 'Back to today.');
        page.render();
      });
      b.id = `test-${t.id}`;
      b.setAttribute('aria-pressed', String(s.ev.showing === t.id));
      li.append(b);
    }
    list.append(li);
  }
  const banner = byId('banner');
  const shown = s.ev.tests.find((t) => t.id === s.ev.showing);
  banner.hidden = !shown;
  if (shown) byId('bannertext').textContent = `Stretch test: the board shows the city with ${testLabel(shown.id, RATES.band)}.`;
}
