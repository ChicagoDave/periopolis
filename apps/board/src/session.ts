/**
 * @file The page's session: the game, the tool in hand, the tile picked, the line cursor, the stretch test shown, and
 * the history undo keeps. Replaced, never changed in place.
 * Public interface: Session, newSession.
 * Owner context: Board (adapter).
 */
import { RULES, inHand, notices, stressAt } from '@city/run';
import type { Game, Notice, WorkInHand } from '@city/run';
import { RATES, assess } from '@city/site';
import type { Assessment, TestId, TileKey } from '@city/site';
import type { GameStore } from './storage.ts';
import type { ToolId } from './wording.ts';

/** Everything the page shows is drawn from this. */
export interface Session {
  game: Game;
  tool: ToolId;
  picked: TileKey | null;
  lineFrom: TileKey | null;
  showing: TestId | null;
  focusKey: TileKey;
  history: Game[];
  flash: TileKey[];
  /** The board assessed, as shown. */
  ev: Assessment;
  hand: WorkInHand;
  news: Notice[];
  readonly store: GameStore;
  /** Assess the game again after a change. */
  refresh(): void;
  /** Keep the game for undo. */
  remember(): void;
  /** Save the game. */
  save(): void;
  /** Take the game back one step; false when there is nothing to undo. */
  undo(): boolean;
}

/** A session on a game. */
export function newSession(game: Game, store: GameStore): Session {
  const s: Session = {
    game,
    tool: 'inspect',
    picked: null,
    lineFrom: null,
    showing: null,
    focusKey: '0,0',
    history: [],
    flash: [],
    ev: assess(game.layout, RATES),
    hand: inHand(game.layout, game.clock ? game.clock.jobs : null, RULES),
    news: [],
    store,
    refresh() {
      const clock = s.game.clock;
      s.hand = inHand(s.game.layout, clock ? clock.jobs : null, RULES);
      s.news = clock ? notices(clock, RATES.band, RULES) : [];
      // While the clock runs the board shows the year as it is, so the look-ahead is switched off.
      if (clock) s.showing = null;
      const options: { show?: TestId; now?: ReturnType<typeof stressAt> } = {};
      if (s.showing) options.show = s.showing;
      if (clock) options.now = stressAt(clock, RATES.band);
      s.ev = assess(s.game.layout, RATES, options);
      s.showing = s.ev.showing;
    },
    remember() {
      s.history.push(s.game);
      if (s.history.length > 80) s.history.shift();
    },
    save() {
      s.store.save({ tiles: s.game.layout.tiles, lines: s.game.layout.lines, clock: s.game.clock });
    },
    undo() {
      const was = s.history.pop();
      if (!was) return false;
      s.game = was;
      s.lineFrom = null;
      s.save();
      return true;
    },
  };
  return s;
}
