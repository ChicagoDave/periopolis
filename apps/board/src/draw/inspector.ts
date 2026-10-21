/**
 * @file The inspector: the tile you picked, in facts and buttons. On open ground it offers only what the band rule
 * lets stand there (ADR-0016 Decision 2); on the middle of an empty circle the city opened, a way to close it, and on
 * the middle of a circle the player closed, a way to open it again (ADR-0016 Decision 3).
 * Public interface: drawInspector.
 * Owner context: Board (adapter).
 */
import { RULES, circleId, placeOrder, vetoCircle } from '@city/run';
import { EXTRAS, RATES, SCHOOLS, bandRule, openCircle } from '@city/site';
import type { ExtraKind, TileKey } from '@city/site';
import { button, byId, el } from '../dom.ts';
import { fmt, years } from '../format.ts';
import type { Page } from '../page.ts';
import { CIRCLE_CLOSE, CIRCLE_REOPEN, GROUND_TEXT, SITE_NAME, circleClosedSaid, heldHere, issueText, moveSaid, planCaption } from '../wording.ts';
import { groundOf } from './board.ts';
import { planAt } from './ground.ts';
import { TOOLS, toolCalled } from './tray.ts';

const SITE_LABEL: Readonly<Record<string, string>> = { hood: 'Homes', ring: 'Ring', power: 'Power', water: 'Water', sewage: 'Sewage', waste: 'Waste' };

function facts(rows: readonly (readonly [string, string, boolean?])[]): HTMLElement {
  const dl = el('dl', 'facts');
  for (const [a, b, sub] of rows) dl.append(el('dt', sub ? 'sub' : '', a), el('dd', '', b));
  return dl;
}

/** The typical walk to the stop, the wait, then the ride. */
const rideMin = (hops: number): number => RATES.inTile + RATES.walking.waitMin + ((hops * RATES.stepKm) / RATES.walking.rideKmh) * 60;

function extraButtons(page: Page, k: TileKey, has: Readonly<Partial<Record<ExtraKind, true>>>): HTMLElement {
  const row = el('div', 'row');
  const ordered = page.s.hand.extras[k] ?? {};
  row.append(el('span', 'lab', 'In this neighborhood'));
  for (const x of EXTRAS) {
    const b = button(`${SITE_NAME[x]}${ordered[x] ? ' (on order)' : ''}`, () => page.apply(x, k));
    b.setAttribute('aria-pressed', String(Boolean(has[x] || ordered[x])));
    row.append(b);
  }
  return row;
}

/**
 * On a circle's middle while the clock runs: close an empty circle the city opened (the Run's `vetoCircle`), or open
 * again a circle the player closed (the player's own `openCircle` through `placeOrder`, which lifts the veto).
 */
function circleButtons(page: Page, picked: TileKey): void {
  const { s } = page;
  const clock = s.game.clock;
  if (!clock) return;
  const box = byId('inspector');
  const shut = vetoCircle(s.game, picked);
  if (shut !== s.game) {
    const b = button(CIRCLE_CLOSE, () => {
      s.remember();
      s.game = shut;
      s.save();
      page.say(circleClosedSaid(picked));
      page.render();
    });
    b.id = 'close-circle';
    box.append(b);
  } else if ((clock.vetoes ?? []).includes(circleId(picked))) {
    const b = button(CIRCLE_REOPEN, () => {
      const out = placeOrder(s.game, (plan) => openCircle(plan, picked, RATES), RULES);
      if (out.ok) {
        s.remember();
        s.game = out.game;
        s.save();
        page.say(moveSaid('hood', { ok: true, layout: out.game.layout, event: out.siteEvent }, RATES));
      } else page.say(moveSaid('hood', out, RATES));
      page.render();
    });
    b.id = 'reopen-circle';
    box.append(b);
  }
}

export function drawInspector(page: Page): void {
  const { s } = page;
  const box = byId('inspector');
  box.textContent = '';
  const picked = s.picked;
  if (!picked) {
    box.append(el('h2', '', 'Pick a tile'), el('p', 'quiet', 'Click any tile to read it here: who lives there, where they go to school, and how they reach the ring.'));
    return;
  }
  const t = s.game.layout.tiles[picked];
  const info = s.ev.per[picked];
  const site = t ? null : s.hand.sites[picked];
  const more = s.hand.more[picked] ?? 0;
  if (site) {
    box.append(
      el('h2', '', 'Building site'),
      facts([[`${SITE_LABEL[site.kind] ?? site.kind}${site.n > 1 ? `, ${site.n} on order` : ''}`, site.status === 'working' ? `${years(site.left)} to go` : 'waiting for a crew']]),
    );
    if (site.kind === 'hood') box.append(extraButtons(page, picked, {}), el('p', 'quiet', 'A school ordered now opens with the homes.'));
    box.append(button(site.kind === 'hood' ? 'Cancel this neighborhood' : 'Cancel one job here', () => page.apply('erase', picked)));
    return;
  }
  if (!t) {
    const circles = s.game.layout.circles ?? [];
    box.append(el('h2', '', 'Open ground'), el('p', 'quiet', `${fmt(RATES.tileAcres)} acres with nothing on it. ${GROUND_TEXT[groundOf(circles, picked)]}`));
    // Only what the band rule lets stand here is offered (ADR-0016 Decision 2); the Site says which.
    const allowed = (['hood', 'ring', 'power', 'water', 'sewage', 'waste'] as const).filter((id) => !bandRule(circles, picked, id === 'hood' || id === 'ring' ? 'home' : 'plant'));
    if (allowed.length) {
      const row = el('div', 'row');
      row.append(el('span', 'lab', 'Build here'));
      for (const id of allowed) row.append(button(toolCalled(id).name, () => page.apply(id, picked)));
      box.append(row);
    }
    circleButtons(page, picked);
    return;
  }
  box.append(el('h2', '', SITE_NAME[t.kind]));
  if (t.kind === 'hood' || t.kind === 'ring') {
    const looking = s.view.at === 'tile' && s.view.key === picked;
    const look = button(looking ? 'Back to the map' : 'Look closer', () => {
      if (looking) {
        s.lookAway();
        page.say('The map.');
      } else if (s.look(picked)) {
        const plan = planAt(page, picked);
        page.say(plan ? planCaption(plan) : '');
      }
      page.render();
    });
    look.id = 'look';
    look.setAttribute('aria-pressed', String(looking));
    box.append(look);
  }
  if (t.kind === 'hood') {
    const rows: (readonly [string, string, boolean?])[] = [['People', fmt(s.occupied ? (s.occupied[picked] ?? 0) : s.ev.pop1)]];
    const ring = info?.ring;
    if (ring) {
      rows.push(['Walk to the ring', `${fmt(ring.walkMin)} min`]);
      rows.push(['By mover to the ring', ring.segments === null ? 'no line' : `${fmt(rideMin(ring.segments))} min`]);
    } else rows.push(['Walk to the ring', 'no ring yet']);
    for (const kind of SCHOOLS) {
      const g = info?.goes?.[kind];
      const own = info?.schools?.[kind];
      if (g) {
        rows.push([SITE_NAME[kind], g.to.length ? `${fmt(Math.max(...g.to.map((w) => w.minutes)))} min walk` : 'no seat in reach']);
        if (g.to.length && g.left > 0.5) rows.push(['with no seat', `${fmt(g.left)} pupils`, true]);
      }
      if (own) rows.push(['the school here', `${fmt(own.load)} of ${fmt(own.cap)} seats`, true]);
    }
    rows.push(['Playing fields', info?.fields ? `${fmt(info.fields.walkMin)} min walk` : 'none yet']);
    box.append(facts(rows));
    const held = s.held.find((h) => h.hood === picked);
    if (held) box.append(el('p', 'quiet held', heldHere(held)));
    box.append(extraButtons(page, picked, t.has));
  } else if (t.kind === 'ring') {
    const rows: (readonly [string, string, boolean?])[] = [
      ['Buildings of 25 stories', String(t.n)],
      ['Offices and halls for', `${fmt(info?.cap ?? 0)} people`],
      ['Nearest to', `${fmt(info?.load ?? 0)} people`],
      ['Buildings that takes', String(info?.needs ?? 0)],
    ];
    if (more) rows.push(['On order', String(more)]);
    box.append(facts(rows));
    const row = el('div', 'row');
    row.append(button('Add a building', () => page.apply('ring', picked)), button('Remove one', () => page.apply('erase', picked)));
    box.append(row);
  } else {
    const power = t.kind === 'power';
    const sc = s.ev.score;
    const rows: (readonly [string, string, boolean?])[] = power
      ? [
          [`Modules of ${RATES.moduleMw} MW`, String(t.n)],
          ['City peak', `${fmt(sc.peak)} MW`],
          ['Firm with one module down', `${fmt(sc.firmMW)} MW`],
          ['Modules the city needs', String(sc.needModules)],
        ]
      : [
          ['Units', String(t.n)],
          ['Serves', `${fmt(t.n * RATES.plantServes)} people`],
          ['The city has', fmt(sc.pop)],
        ];
    if (more) rows.push(['On order', String(more)]);
    box.append(facts(rows));
    const row = el('div', 'row');
    const kind = t.kind;
    row.append(button(power ? 'Add a module' : 'Add a unit', () => page.apply(kind, picked)), button('Remove one', () => page.apply('erase', picked)));
    box.append(row);
  }
  if (info && info.issues.length) {
    const ul = el('ul', 'issues');
    for (const issue of info.issues) ul.append(el('li', info.level === 'warn' ? 'warn' : '', issueText(issue)));
    box.append(ul);
  } else box.append(el('p', 'quiet', info && info.stop ? 'On the mover line. Nothing is broken here.' : 'Nothing is broken here.'));
  if (t.kind === 'hood') box.append(button('Remove this neighborhood', () => page.apply('erase', picked)));
  void TOOLS;
}
