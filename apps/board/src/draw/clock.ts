/**
 * @file The clock card: the year, the twenty years as a strip, what is announced, the record; and the work in hand.
 * Public interface: drawClock, drawWork, yearLine.
 * Owner context: Board (adapter).
 */
import { RULES, cancelJob, putFirst } from '@city/run';
import type { RecordRow } from '@city/run';
import { LAYERS, edgeEnds } from '@city/site';
import { button, byId, el } from '../dom.ts';
import { cap, fmt, low, money, years } from '../format.ts';
import type { Page } from '../page.ts';
import { PIECE_NAME, checkTitle, noticeText, openedSentence } from '../wording.ts';
import { RATES } from '@city/site';

/** One year of the record, in a sentence. */
export function yearLine(row: RecordRow): string {
  const parts = [`Year ${row.year}: ${fmt(row.pop)} people.`];
  if (row.bad) parts.push(`${row.bad}${row.bad === 1 ? ' line broken: ' : ' lines broken: '}${row.broken.map((id) => low(checkTitle(id))).join('; ')}.`);
  else parts.push(row.pop ? 'Every line held.' : 'Nobody lives here yet.');
  if (Object.keys(row.opened).length) parts.push(`Opened: ${openedSentence(row.opened)}.`);
  return parts.join(' ');
}

export function drawClock(page: Page): void {
  const { s } = page;
  const clock = s.game.clock;
  const on = Boolean(clock);
  const over = clock !== null && clock.year >= RULES.years;
  const now = byId('clocknow');
  for (const id of ['tick', 'stop', 'years', 'notices', 'keeprule', 'recordbox']) byId(id).hidden = !on;
  byId('run').hidden = on;
  byId('found').hidden = on;
  now.textContent = '';
  if (!clock) {
    now.textContent = 'The clock is stopped. What you place is built at once.';
    return;
  }
  const last = clock.record[clock.record.length - 1];
  now.append(
    el('b', '', over ? `Year ${RULES.years}. The run is over.` : `Year ${clock.year} of ${RULES.years}.`),
    ` Homes for ${fmt(last?.homes ?? 0)} people. ${clock.lineYears ? `${fmt(clock.lineYears)}${clock.lineYears === 1 ? ' broken line-year' : ' broken line-years'}` : 'No broken line-years'}${over ? '. Stop the clock to build on.' : ' so far.'}`,
  );
  byId<HTMLButtonElement>('tick').disabled = over;

  // The twenty years: what each past year was like, where the run stands, and when something announced falls.
  const strip = byId('years');
  strip.textContent = '';
  const rows: Record<number, RecordRow> = {};
  for (const r of clock.record) rows[r.year] = r;
  const known = clock.events.filter((e) => clock.year >= e.start - e.notice && !(e.type === 'closure' && !e.edge));
  for (let y = 1; y <= RULES.years; y++) {
    const row = rows[y];
    const li = el('li');
    const b = el('button', 'yr');
    const falls = known.filter((e) => y === e.start);
    b.type = 'button';
    b.id = `yr-${y}`;
    if (row) b.classList.add(row.bad ? 'broken' : 'clean');
    if (y === clock.year) b.classList.add('now');
    if (falls.length) b.classList.add('event');
    b.append(el('span', 'n', String(y)), el('span', 'm', row ? (row.bad ? (row.bad > 9 ? '9+' : String(row.bad)) : '✓') : ''));
    const words = (row ? yearLine(row) : `Year ${y} is still to come.`) + (falls.length ? ' Something announced starts in this year.' : '');
    b.setAttribute('aria-label', words);
    b.addEventListener('click', () => page.say(words));
    li.append(b);
    strip.append(li);
  }

  const list = byId('notices');
  list.textContent = '';
  if (!s.news.length && !over) list.append(el('li', 'quiet', 'Nothing is announced. Whatever comes is announced a year or two ahead.'));
  for (const n of s.news) {
    const li = el('li', n.when);
    if (n.when === 'now') li.append(el('b', '', 'Now. '));
    li.append(noticeText(n, RATES.band, RULES));
    const edge = n.edge;
    if (edge) {
      const b = button('Show it', () => {
        page.highlight(edgeEnds(edge));
        page.say('The two ends of that stretch are marked on the board.');
      });
      b.id = `show-${n.id}`;
      li.append(b);
    }
    list.append(li);
  }
  byId('keeprule').hidden = !s.news.length;

  const body = byId('recordrows');
  body.textContent = '';
  for (const r of clock.record) {
    const tr = el('tr');
    tr.append(
      el('td', 'num', String(r.year)),
      el('td', 'num', fmt(r.pop)),
      el('td', '', r.bad ? `${r.bad}: ${r.broken.map((id) => low(checkTitle(id))).join('; ')}` : r.pop ? 'none' : '–'),
      el('td', '', Object.keys(r.opened).length ? openedSentence(r.opened) : '–'),
      el('td', 'num', r.year ? money(LAYERS.reduce((t, layer) => t + r.spend[layer], 0)) : '–'),
    );
    body.append(tr);
  }
}

export function drawWork(page: Page): void {
  const { s } = page;
  const card = byId('workcard');
  const list = byId('work');
  const clock = s.game.clock;
  card.hidden = !clock;
  list.textContent = '';
  if (!clock) return;
  const hand = s.hand;
  byId('worknow').textContent = hand.list.length
    ? `${hand.working} of ${hand.crews} crews working${hand.waiting ? `, ${hand.waiting}${hand.waiting === 1 ? ' job' : ' jobs'} waiting for a crew.` : '.'}`
    : `No work in hand. All ${hand.crews} crews are idle. Place something to give them a job.`;
  list.hidden = !hand.list.length;
  for (const j of hand.list) {
    const li = el('li');
    const label = el('button', 'joblabel');
    const btns = el('span', 'jobbtns');
    const where = j.what === 'line' ? edgeEnds(j.at) : [j.at];
    const when = j.status === 'working' ? `${years(j.left)} to go` : j.status === 'waiting' ? 'waiting for a crew' : `done, waits for its ${j.what === 'power' ? 'site' : 'homes'}`;
    label.type = 'button';
    label.id = `job-${j.index}`;
    label.append(cap(PIECE_NAME[j.what]), el('span', '', when));
    label.addEventListener('click', () => {
      page.highlight(where);
      page.say(`${cap(PIECE_NAME[j.what])}, ${when}. Marked on the board.`);
    });
    if (j.status === 'waiting') {
      const b = button('First', () => {
        s.remember();
        s.game = { layout: s.game.layout, clock: { ...clock, jobs: putFirst(clock.jobs, j.index) } };
        s.save();
        page.say(`${cap(PIECE_NAME[j.what])} goes first. Whatever lost its crew keeps the work done on it.`);
        page.render();
      });
      b.id = `first-${j.index}`;
      btns.append(b);
    }
    const x = button('Cancel', () => {
      s.remember();
      s.game = { layout: s.game.layout, clock: { ...clock, jobs: cancelJob(clock.jobs, j.index) } };
      s.save();
      page.say(`Canceled: ${PIECE_NAME[j.what]}.`);
      page.render();
    });
    x.id = `cancel-${j.index}`;
    btns.append(x);
    li.append(label, btns);
    list.append(li);
  }
}
