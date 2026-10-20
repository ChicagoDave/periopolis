/**
 * @file The page's session: the game, the tool in hand, the tile picked, the line cursor, the stretch test shown, the
 * view (the map, one tile's ground at a level, or the site from the air), and the history undo keeps. Replaced, never changed in place.
 * The view is the page's alone: it is never saved with the city.
 * Public interface: Session, View, Air, Tilt, AIR_START, ZOOM_MAX, newSession.
 * Owner context: Board (adapter).
 */
import type { Level } from '@city/ground';
import { RULES, emergencyOf, inHand, livingOf, notices, stopsBuilding, stressAt } from '@city/run';
import type { Game, HeldBack, Notice, WorkInHand } from '@city/run';
import { RATES, assess } from '@city/site';
import type { AssessOptions, Assessment, TestId, TileKey } from '@city/site';
import type { GameStore } from './storage.ts';
import type { ToolId } from './wording.ts';

/** How steep the view from the air is. */
export type Tilt = 'low' | 'mid' | 'high';

/** Where the viewer stands over the site: quarter turns, a tilt, a zoom over the fitted scale, and a pan in pixels.
 * The page's alone, never saved. */
export interface Air {
  readonly turn: 0 | 1 | 2 | 3;
  readonly tilt: Tilt;
  readonly zoom: number;
  readonly pan: { readonly x: number; readonly y: number };
}

/** The view from the air as it opens: a sixth of a turn is built in, mid tilt, fitted, centred. */
export const AIR_START: Air = { turn: 0, tilt: 'mid', zoom: 1, pan: { x: 0, y: 0 } };

/** The zoom's bounds: fitted to the site, to sixty-four times nearer. */
export const ZOOM_MAX = 64;

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
  /** The viewer over the site, from the air. Never saved. */
  air: Air;
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
  /** A quarter turn of the site from the air. */
  turnAir(): void;
  /** The next tilt: mid, high, low, round again. */
  tiltAir(): void;
  /** Nearer or farther by a factor, held between fitted and ZOOM_MAX; the pan scales with it so what is in the middle stays. */
  zoomAir(factor: number): void;
  /** Slide the site by so many pixels. */
  panAir(dx: number, dy: number): void;
  /** Fitted and centred again; the turn and tilt stay. */
  fitAir(): void;
  /** Show the other level of the tile being looked at; nothing happens on the map. */
  showLevel(level: Level): void;
}

/** A session on a game. */
export function newSession(game: Game, store: GameStore): Session {
  const s: Session = {
    game,
    view: { at: 'map' },
    air: AIR_START,
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
      s.store.save({ tiles: s.game.layout.tiles, lines: s.game.layout.lines, circles: s.game.layout.circles, clock: s.game.clock });
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
    turnAir() {
      s.air = { ...s.air, turn: ((s.air.turn + 1) % 4) as Air['turn'] };
    },
    tiltAir() {
      const next: Record<Tilt, Tilt> = { mid: 'high', high: 'low', low: 'mid' };
      s.air = { ...s.air, tilt: next[s.air.tilt] };
    },
    zoomAir(factor) {
      if (!(factor > 0)) return;
      const zoom = Math.max(1, Math.min(ZOOM_MAX, s.air.zoom * factor));
      const by = zoom / s.air.zoom;
      s.air = { ...s.air, zoom, pan: { x: s.air.pan.x * by, y: s.air.pan.y * by } };
    },
    panAir(dx, dy) {
      s.air = { ...s.air, pan: { x: s.air.pan.x + dx, y: s.air.pan.y + dy } };
    },
    fitAir() {
      s.air = { ...s.air, zoom: 1, pan: { x: 0, y: 0 } };
    },
    showLevel(level) {
      if (s.view.at === 'tile') s.view = { ...s.view, level };
    },
  };
  return s;
}
