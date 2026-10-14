/**
 * @file The page: wires the board, the tray and the panels to the session, and the buttons to the clock.
 * Public interface: none; it runs on load.
 * Owner context: Board (adapter).
 */
import { RULES, startRun, stopRun, tick } from '@city/run';
import type { Game } from '@city/run';
import { RATES, allTiles, emptyLayout, starterLayout, tileAt, tileKey } from '@city/site';
import type { TileKey } from '@city/site';
import { byId } from './dom.ts';
import { describe, drawBoard } from './draw/board.ts';
import { drawClock, drawWork, yearLine } from './draw/clock.ts';
import { drawInspector } from './draw/inspector.ts';
import { drawRules, drawTests } from './draw/rules.ts';
import { drawScore } from './draw/score.ts';
import { buildTray, drawTray } from './draw/tray.ts';
import { asText } from './export.ts';
import { move } from './moves.ts';
import type { Move } from './moves.ts';
import type { Page } from './page.ts';
import { newSession } from './session.ts';
import { browserStore, restoreGame } from './storage.ts';
import type { SavedGame } from './storage.ts';
import type { ToolId } from './wording.ts';

const KEY = 'future-city-builder-v1';

/** A host that hands an open page a new version keeps its game through these hooks. */
interface Hot {
  snapshot?(take: () => { game: SavedGame }): void;
  ready?(start: (data: { game?: unknown }) => void): void;
  data?: { game?: unknown };
}

declare global {
  interface Window {
    claude?: { hot?: Hot };
  }
}

function start(data: { game?: unknown }): void {
  const store = browserStore(KEY);
  const kept = (data.game ? restoreGame(data.game) : null) ?? restoreGame(store.load());
  const s = newSession(kept ?? { layout: starterLayout(), clock: null }, store);
  let flashTimer: ReturnType<typeof setTimeout> | null = null;

  const page: Page = {
    s,
    say: (text) => {
      byId('said').textContent = text || '';
    },
    render: () => {
      s.refresh();
      drawBoard(page);
      drawTray(page);
      drawScore(page);
      drawClock(page);
      drawInspector(page);
      drawWork(page);
      drawRules(page);
      drawTests(page);
      byId<HTMLButtonElement>('undo').disabled = s.history.length === 0;
    },
    apply: (tool, key) => page.commit(move(s.game, tool, key, null)),
    highlight: (keys) => {
      s.flash = [...keys];
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = setTimeout(() => {
        s.flash = [];
        drawBoard(page);
      }, 2600);
      drawBoard(page);
    },
    swap: (game: Game, words: string) => {
      s.remember();
      s.game = game;
      s.lineFrom = null;
      s.save();
      page.render();
      page.say(words);
    },
    commit: (m: Move) => {
      if (m.changed) {
        s.remember();
        s.game = m.game;
        s.save();
      }
      page.say(m.said);
      page.render();
    },
  };

  const use = (k: TileKey): void => {
    s.focusKey = k;
    s.picked = k;
    if (s.tool === 'inspect') {
      page.say(`${describe(page, k)}.`);
      page.render();
      return;
    }
    const m = move(s.game, s.tool as ToolId, k, s.lineFrom);
    if (s.tool === 'line') s.lineFrom = m.from;
    page.commit(m);
  };

  buildTray(page);
  const board = byId('board');
  board.addEventListener('click', (e) => {
    const target = e.target as Element | null;
    const g = target?.closest ? target.closest('.tile') : null;
    if (g) use(g.getAttribute('data-k') ?? '');
  });
  board.addEventListener('keydown', (e) => {
    const target = e.target as Element | null;
    const g = target?.closest ? target.closest('.tile') : null;
    if (!g) return;
    const k = g.getAttribute('data-k') ?? '';
    const [q, r] = tileAt(k);
    const steps: Record<string, readonly (readonly [number, number])[]> = {
      ArrowLeft: [[-1, 0]],
      ArrowRight: [[1, 0]],
      ArrowUp: [[0, -1], [1, -1]],
      ArrowDown: [[0, 1], [-1, 1]],
    };
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      use(k);
      return;
    }
    const tries = steps[e.key];
    if (!tries) return;
    e.preventDefault();
    const valid = allTiles(RATES.outline);
    for (const [dq, dr] of tries) {
      const to = tileKey(q + dq, r + dr);
      if (valid.includes(to)) {
        s.focusKey = to;
        drawBoard(page);
        const node = board.querySelector<SVGElement>('[tabindex="0"]');
        if (node) node.focus();
        return;
      }
    }
  });
  const seed = (): number => 1 + Math.floor(Math.random() * 2147483646);
  byId('undo').addEventListener('click', () => {
    if (!s.undo()) return;
    page.say('Undone.');
    page.render();
  });
  byId('starter').addEventListener('click', () => {
    const running = Boolean(s.game.clock);
    s.picked = null;
    s.showing = null;
    page.swap({ layout: starterLayout(), clock: null }, `The ledger's city of 50,000 is on the board${running ? ', and the clock is stopped' : ''}. Undo brings yours back.`);
  });
  byId('clear').addEventListener('click', () => {
    const running = Boolean(s.game.clock);
    s.picked = null;
    s.showing = null;
    page.swap({ layout: emptyLayout(), clock: null }, `The site is clear${running ? ', and the clock is stopped' : ''}. Undo brings the city back.`);
  });
  byId('back').addEventListener('click', () => {
    s.lookAway();
    page.say('The map.');
    page.render();
  });
  for (const level of ['surface', 'sub'] as const) {
    byId(`level-${level}`).addEventListener('click', () => {
      s.showLevel(level);
      page.render();
    });
  }
  byId('today').addEventListener('click', () => {
    s.showing = null;
    page.say('Back to today.');
    page.render();
  });
  byId('run').addEventListener('click', () =>
    page.swap(startRun(s.game.layout, seed(), RATES, RULES), `The clock is running on this city: year 0 of ${RULES.years}. What you place now is an order for the ${RULES.crews} crews. Press Next year when your orders are in.`),
  );
  byId('found').addEventListener('click', () => {
    s.picked = null;
    page.swap(startRun(emptyLayout(), seed(), RATES, RULES), `An empty site, year 0, ${RULES.crews} crews. Place your first orders, then press Next year. Undo brings the old city back.`);
  });
  byId('stop').addEventListener('click', () => page.swap(stopRun(s.game), 'The clock is stopped. Work in hand was finished at once.'));
  byId('tick').addEventListener('click', () => {
    const clock = s.game.clock;
    if (!clock || clock.year >= RULES.years) return;
    const next = tick(s.game, RATES, RULES);
    const row = next.clock?.record[next.clock.record.length - 1];
    s.remember();
    s.game = next;
    s.lineFrom = null;
    s.save();
    page.render();
    if (row) page.say(yearLine(row) + ((next.clock?.year ?? 0) >= RULES.years ? ` The ${RULES.years} years are up.` : ''));
  });
  byId('copy').addEventListener('click', () => {
    const text = asText(s);
    const dump = byId<HTMLTextAreaElement>('dump');
    const fallback = (): void => {
      dump.hidden = false;
      dump.value = text;
      dump.focus();
      dump.select();
      page.say('Copying is blocked here. The text is selected below.');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => page.say('Copied. Paste it back into the conversation.'), fallback);
    else fallback();
  });
  page.render();
  page.say(
    kept
      ? s.game.clock
        ? `Your run is as you left it, in year ${s.game.clock.year}.`
        : 'Your city is as you left it. Pick a tool to carry on.'
      : "This is the ledger's city of 50,000. Pick a tool and change it, or clear the site and start your own.",
  );
  // Start a small screen looking at the middle of the site.
  const scroller = byId('boardscroll');
  scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) / 2;

  const hot = window.claude?.hot;
  if (hot?.snapshot) hot.snapshot(() => ({ game: { tiles: s.game.layout.tiles, lines: s.game.layout.lines, clock: s.game.clock } }));
}

const hot = window.claude?.hot;
if (hot?.ready) hot.ready(start);
else start(hot?.data ?? {});
