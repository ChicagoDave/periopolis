/**
 * @file The page: wires the board, the tray and the panels to the session, and the buttons to the clock.
 * Public interface: none; it runs on load.
 * Owner context: Board (adapter).
 */
import { RULES, startRun, stopRun } from '@city/run';
import type { Game } from '@city/run';
import { RATES, allTiles, emptyLayout, sizedLayout, starterLayout, tileAt, tileKey } from '@city/site';
import type { TileKey } from '@city/site';
import { byId } from './dom.ts';
import { describe, drawBoard } from './draw/board.ts';
import { canStep, monthStep, newAutoRun, yearStep } from './autorun.ts';
import type { Speed } from './autorun.ts';
import { drawClock, drawWork } from './draw/clock.ts';
import { drawDay } from './draw/day.ts';
import { drawInspector } from './draw/inspector.ts';
import { drawMoney } from './draw/money.ts';
import { drawNeeds } from './draw/needs.ts';
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
import { dollyIrl, fitIrl, panIrl, turnIrl } from './draw/irl/view.ts';
import { IRL_OPENED, PAUSED_FOR_ORDER, clockStarted } from './wording.ts';
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
  // The months running on their own: after each, the page is redrawn and the month said; when they stop themselves
  // at the horizon the Play button goes with them.
  const auto = newAutoRun(s, (said) => {
    page.render();
    if (said !== null) page.say(said);
  });

  const page: Page = {
    s,
    auto,
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
      drawNeeds(page);
      drawWork(page);
      drawRules(page);
      drawTests(page);
      drawDay(page);
      drawMoney(page);
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
      auto.pause();
      s.remember();
      s.game = game;
      s.lineFrom = null;
      s.save();
      page.render();
      page.say(words);
    },
    commit: (m: Move) => {
      // An order placed while the months run pauses them (plan board-auto-run-by-month, decision 4).
      const paused = m.changed && auto.pause();
      if (m.changed) {
        s.remember();
        s.game = m.game;
        s.save();
      }
      page.say(paused ? `${m.said} ${PAUSED_FOR_ORDER}` : m.said);
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
    auto.pause();
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
  byId('sized').addEventListener('click', () => {
    const running = Boolean(s.game.clock);
    s.picked = null;
    s.showing = null;
    page.swap(
      { layout: sizedLayout(RATES), clock: null },
      `The ledger's city sized to its 50,000 people: 7 ring buildings and 2 reactor modules, one of each fewer, and every line it held still holds${running ? '. The clock is stopped' : ''}. Undo brings yours back.`,
    );
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
  // The viewer from the air: a quarter turn, the next tilt, nearer or farther by half again, fitted; a drag slides it.
  byId('air-turn').addEventListener('click', () => {
    s.turnAir();
    page.render();
  });
  byId('air-tilt').addEventListener('click', () => {
    s.tiltAir();
    page.render();
  });
  byId('air-in').addEventListener('click', () => {
    s.zoomAir(1.5);
    page.render();
  });
  byId('air-out').addEventListener('click', () => {
    s.zoomAir(1 / 1.5);
    page.render();
  });
  byId('air-fit').addEventListener('click', () => {
    s.fitAir();
    page.render();
  });
  const air = byId<HTMLCanvasElement>('angledcanvas');
  let drag: { x: number; y: number } | null = null;
  air.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY };
    air.classList.add('dragging');
    air.setPointerCapture(e.pointerId);
  });
  air.addEventListener('pointermove', (e) => {
    if (!drag) return;
    s.panAir(e.clientX - drag.x, e.clientY - drag.y);
    drag = { x: e.clientX, y: e.clientY };
    page.render();
  });
  const dragEnd = (): void => {
    drag = null;
    air.classList.remove('dragging');
  };
  air.addEventListener('pointerup', dragEnd);
  air.addEventListener('pointercancel', dragEnd);
  // The site from the air: a toggle, from the map or a tile alike; pressed again, or Back, returns to the map.
  byId('angled').addEventListener('click', () => {
    if (s.view.at === 'angled') {
      s.lookAway();
      page.say('The map.');
    } else {
      s.lookAngled();
      page.say('The site from the air. Back to the map returns.');
    }
    page.render();
  });
  // The city IRL: a toggle from any view; pressed again, or Back, returns to the map. A drag turns the orbit, a
  // shift-drag slides it, the wheel and the buttons come nearer or farther, Fit opens it again.
  byId('irl').addEventListener('click', () => {
    if (s.view.at === 'irl') {
      s.lookAway();
      page.say('The map.');
    } else {
      s.lookIrl();
      page.say(IRL_OPENED);
    }
    page.render();
  });
  byId('irl-in').addEventListener('click', () => {
    dollyIrl(page, 1 / 1.5);
    page.render();
  });
  byId('irl-out').addEventListener('click', () => {
    dollyIrl(page, 1.5);
    page.render();
  });
  byId('irl-fit').addEventListener('click', () => {
    fitIrl(page);
    page.render();
  });
  byId('irl-night').addEventListener('click', () => {
    s.toggleLight();
    page.render();
  });
  byId('irl-sub').addEventListener('click', () => {
    s.toggleSub();
    page.render();
  });
  const irl = byId<HTMLCanvasElement>('irlcanvas');
  let orbitDrag: { x: number; y: number; slide: boolean } | null = null;
  irl.addEventListener('pointerdown', (e) => {
    orbitDrag = { x: e.clientX, y: e.clientY, slide: e.shiftKey };
    irl.classList.add('dragging');
    irl.setPointerCapture(e.pointerId);
  });
  irl.addEventListener('pointermove', (e) => {
    if (!orbitDrag) return;
    const dx = e.clientX - orbitDrag.x;
    const dy = e.clientY - orbitDrag.y;
    if (orbitDrag.slide) panIrl(page, dx, dy);
    else turnIrl(page, dx, dy);
    orbitDrag = { ...orbitDrag, x: e.clientX, y: e.clientY };
    page.render();
  });
  const orbitEnd = (): void => {
    orbitDrag = null;
    irl.classList.remove('dragging');
  };
  irl.addEventListener('pointerup', orbitEnd);
  irl.addEventListener('pointercancel', orbitEnd);
  irl.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      dollyIrl(page, e.deltaY > 0 ? 1.15 : 1 / 1.15);
      page.render();
    },
    { passive: false },
  );
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
  // A run is on the month clock (ADR-0009) unless the yearly mode, the sketch's, is asked for: homes full the year
  // they finish. Starting a run never starts the months running; Play does, once the orders are in.
  // On the month clock the city grows itself unless the player turns it off (ADR-0015 Decision 9); the yearly mode
  // cannot infer, so its box greys the control.
  const monthly = (): boolean => !byId<HTMLInputElement>('yearly').checked;
  const grows = (): boolean => monthly() && byId<HTMLInputElement>('grow').checked;
  const syncGrow = (): void => {
    byId<HTMLInputElement>('grow').disabled = !monthly();
  };
  byId('yearly').addEventListener('change', syncGrow);
  syncGrow();
  byId('run').addEventListener('click', () => {
    const growth = monthly();
    const infer = grows();
    page.swap(startRun(s.game.layout, seed(), RATES, RULES, { growth, inOrder: true, infer }), clockStarted(RULES, growth, false, infer));
  });
  byId('found').addEventListener('click', () => {
    const growth = monthly();
    const infer = grows();
    s.picked = null;
    page.swap(startRun(emptyLayout(), seed(), RATES, RULES, { growth, inOrder: true, infer }), clockStarted(RULES, growth, true, infer));
  });
  byId('stop').addEventListener('click', () => page.swap(stopRun(s.game), 'The clock is stopped. Work in hand was finished at once.'));
  byId('play').addEventListener('click', () => {
    if (auto.playing) auto.pause();
    else if (!auto.play()) return;
    page.render();
  });
  byId('speed').addEventListener('change', () => {
    auto.setSpeed(byId<HTMLSelectElement>('speed').value as Speed);
  });
  // A tap steps one, remembering one state each; it pauses the months first.
  byId('tick').addEventListener('click', () => {
    auto.pause();
    if (!canStep(s)) return;
    s.remember();
    const said = yearStep(s);
    page.render();
    if (said) page.say(said);
  });
  byId('month').addEventListener('click', () => {
    auto.pause();
    if (!canStep(s) || !s.game.clock?.growth) return;
    s.remember();
    const said = monthStep(s);
    page.render();
    if (said) page.say(said);
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
  if (hot?.snapshot) hot.snapshot(() => ({ game: { tiles: s.game.layout.tiles, lines: s.game.layout.lines, circles: s.game.layout.circles, clock: s.game.clock } }));
}

const hot = window.claude?.hot;
if (hot?.ready) hot.ready(start);
else start(hot?.data ?? {});
