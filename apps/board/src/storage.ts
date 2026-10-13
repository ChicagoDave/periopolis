/**
 * @file The storage adapter: a saved game behind one interface, so the page plays without storage and the domain never
 * sees the browser.
 * Public interface: SavedGame, GameStore, browserStore, memoryStore, restoreGame.
 * Owner context: Board (adapter).
 */
import { RULES, restoreClock } from '@city/run';
import type { Game } from '@city/run';
import { RATES, restoreLayout } from '@city/site';

/** The shape a game is saved in: the sketch's, so a saved city from the published page still loads. */
export interface SavedGame {
  readonly tiles: Game['layout']['tiles'];
  readonly lines: Game['layout']['lines'];
  readonly clock: Game['clock'];
}

/** Somewhere a game is kept between visits. */
export interface GameStore {
  /** Whatever was saved, or null. Never throws. */
  load(): unknown;
  /** Save, or quietly fail. */
  save(game: SavedGame): void;
}

/** The browser's local storage under one key. */
export function browserStore(key: string): GameStore {
  return {
    load: () => {
      try {
        return JSON.parse(localStorage.getItem(key) ?? 'null') as unknown;
      } catch {
        return null;
      }
    },
    save: (game) => {
      try {
        localStorage.setItem(key, JSON.stringify(game));
      } catch {
        // The game plays without storage.
      }
    },
  };
}

/** A store that forgets on reload, for tests and for pages with no storage. */
export function memoryStore(): GameStore {
  let kept: unknown = null;
  return { load: () => kept, save: (game) => (kept = JSON.parse(JSON.stringify(game))) };
}

/**
 * Rebuild a game from anything, keeping only what the board and the clock allow.
 * @returns the game, or null when there is no board in it
 */
export function restoreGame(raw: unknown): Game | null {
  const layout = raw && typeof raw === 'object' ? restoreLayout(raw, RATES) : null;
  if (!layout) return null;
  const clock = (raw as { clock?: unknown }).clock;
  return { layout, clock: restoreClock(clock, layout, RATES, RULES) };
}
