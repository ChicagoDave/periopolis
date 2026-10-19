/**
 * @file The page's session: the game, the tool in hand, the tile picked, the line cursor, the stretch test shown, the
 * view (the map, one tile's ground at a level, or the site from the air), and the history undo keeps. Replaced, never changed in place.
 * The view is the page's alone: it is never saved with the city.
 * Public interface: Session, View, newSession.
 * Owner context: Board (adapter).
 */
import type { Level } from '@city/ground';
import { RULES, emergencyOf, inHand, livingOf, notices, stopsBuilding, stressAt } from '@city/run';
import type { Game, HeldBack, Notice, WorkInHand } from '@city/run';
import { RATES, assess } from '@city/site';
import type { AssessOptions, Assessment, TestId, TileKey } from '@city/site';
import type { GameStore } from './storage.ts';
import type { ToolId } from './wording.ts';

/** What the board shows: the whole map, the ground of one tile at one level, or the whole site from the air at an angle. */
export type View = { readonly at: 'map' } | { readonly at: 'tile'; readonly key: TileKey; readonly level: Level } | { readonly at: 'angled' };

/** Whether a tile has ground to look at: a neighborhood or a ring. */
function hasGround(game: Game, key: TileKey): boolean {
  const t = game.layout.tiles[key];
  return t !== undefined && (t.kind === 'hood' || t.kind === 'ring');
}

/** Everything the page shows is drawn from this. */
export interface Session {
  game: Game;
  /** The map, or one tile's ground. Never saved. */
  view: View;
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
  /** Neighborhoods standing empty or held to the childless share, and what each lacks (ADR-0012 Decision 5). */
  held: readonly HeldBack[];
  /** People in each neighborhood the board is checked for on a clock; null when every neighborhood is full. */
  occupied: Readonly<Record<TileKey, number>> | null;
  /** Neighborhoods whose stop is under construction: the work in hand gives them one (ADR-0012 Decision 6). */
  building: TileKey[];
  readonly store: GameStore;
  /** Assess the game again after a change. */
  refresh(): void;
  /** Keep the game for undo. */
  remember(): void;
  /** Save the game. */
  save(): void;
  /** Take the game back one step; false when there is nothing to undo. */
  undo(): boolean;
  /** Look at a tile's ground on the surface; false when the tile has no ground (open, a plant, a site). */
  look(key: TileKey): boolean;
  /** Back to the map. */
  lookAway(): void;
  /** The whole site from the air, at an angle; from the map or a tile alike. */
  lookAngled(): void;
  /** Show the other level of the tile being looked at; nothing happens on the map. */
  showLevel(level: Level): void;
}

/** A session on a game. */
export function newSession(game: Game, store: GameStore): Session {
  const s: Session = {
    game,
    view: { at: 'map' },
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
    held: [],
    occupied: null,
    building: [],
    store,
    refresh() {
      // A tile looked at that has lost its ground (erased, undone, the site cleared) sends the view back to the map.
      if (s.view.at === 'tile' && !hasGround(s.game, s.view.key)) s.view = { at: 'map' };
      const clock = s.game.clock;
      s.hand = inHand(s.game.layout, clock ? clock.jobs : null, RULES, clock?.inOrder === true, clock ? emergencyOf(clock) : []);
      s.building = clock ? stopsBuilding(s.game.layout, clock.jobs, RATES) : [];
      s.news = clock ? notices(clock, RATES.band, RULES) : [];
      // While the clock runs the board shows the year as it is, so the look-ahead is switched off.
      if (clock) s.showing = null;
      // On a clock the board is checked for the people living there, as its record was: with the month clock, the
      // month's people (ADR-0009); built in order, only those admitted (ADR-0012).
      const living = clock ? livingOf(s.game.layout, clock, RATES) : null;
      const options: AssessOptions = {
        ...(s.showing ? { show: s.showing } : {}),
        ...(clock ? { now: stressAt(clock, RATES.band) } : {}),
        ...(living?.occupied ? { occupied: living.occupied } : {}),
        ...(living?.childless.length ? { childless: living.childless } : {}),
      };
      s.held = living ? living.held : [];
      s.occupied = living?.occupied ?? null;
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
    look(key) {
      if (!hasGround(s.game, key)) return false;
      s.view = { at: 'tile', key, level: 'surface' };
      return true;
    },
    lookAway() {
      s.view = { at: 'map' };
    },
    lookAngled() {
      s.view = { at: 'angled' };
    },
    showLevel(level) {
      if (s.view.at === 'tile') s.view = { ...s.view, level };
    },
  };
  return s;
}
