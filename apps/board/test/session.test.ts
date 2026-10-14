/**
 * @file The session and the storage adapter: what is saved, what undo brings back, what a bad save becomes, and the
 * view: the map or one tile's ground, never saved, back to the map when the ground goes.
 * Owner context: Board (adapter), tests.
 */
import { describe, expect, it } from 'vitest';
import { RULES, startRun } from '@city/run';
import { RATES, emptyLayout, placeNeighborhood, starterLayout } from '@city/site';
import { move } from '../src/moves.ts';
import { newSession } from '../src/session.ts';
import { memoryStore, restoreGame } from '../src/storage.ts';
import type { GameStore } from '../src/storage.ts';

const placed = (): ReturnType<typeof placeNeighborhood> => placeNeighborhood(starterLayout(), '4,0', RATES);

describe('the memory store and restoreGame', () => {
  it('saves a copy and gives it back; restoreGame rebuilds the game from it', () => {
    const store = memoryStore();
    const game = startRun(starterLayout(), 3, RATES, RULES);
    store.save({ tiles: game.layout.tiles, lines: game.layout.lines, clock: game.clock });
    const back = restoreGame(store.load());
    expect(back).toEqual(game);
  });

  it('restores a layout alone when there is no clock, and nothing from rubbish', () => {
    expect(restoreGame({ tiles: starterLayout().tiles, lines: starterLayout().lines, clock: null })).toEqual({ layout: starterLayout(), clock: null });
    expect(restoreGame('city')).toBeNull();
    expect(restoreGame(null)).toBeNull();
    expect(restoreGame({ tiles: { '9,9': { kind: 'hood' } }, lines: {}, clock: { year: 99 } })).toEqual({ layout: emptyLayout(), clock: null });
  });
});

describe('the session', () => {
  it('saves the game as the sketch saved it, under tiles, lines and clock', () => {
    const store = memoryStore();
    const s = newSession({ layout: starterLayout(), clock: null }, store);
    s.save();
    expect(store.load()).toEqual({ tiles: starterLayout().tiles, lines: starterLayout().lines, clock: null });
  });

  it('undo brings back the game before, clears the line cursor, saves, and refuses with nothing to undo', () => {
    const store = memoryStore();
    const s = newSession({ layout: starterLayout(), clock: null }, store);
    expect(s.undo()).toBe(false);
    const m = move(s.game, 'hood', '4,0', null);
    s.remember();
    s.game = m.game;
    s.lineFrom = '1,0';
    s.save();
    expect(restoreGame(store.load())?.layout.tiles['4,0']).toEqual({ kind: 'hood', has: {} });
    expect(s.undo()).toBe(true);
    expect(s.game).toEqual({ layout: starterLayout(), clock: null });
    expect(s.lineFrom).toBeNull();
    expect(restoreGame(store.load())).toEqual({ layout: starterLayout(), clock: null });
    expect(s.history).toEqual([]);
  });

  it('keeps at most 80 steps of history, dropping the oldest', () => {
    const s = newSession({ layout: emptyLayout(), clock: null }, memoryStore());
    for (let i = 0; i < 81; i++) {
      s.remember();
      s.game = { layout: { tiles: { '0,0': { kind: 'ring', n: i + 1 } }, lines: {} }, clock: null };
    }
    expect(s.history.length).toBe(80);
    expect(s.history[0]?.layout.tiles['0,0']).toEqual({ kind: 'ring', n: 1 });
  });

  it('refresh assesses the game as it stands, switches the look-ahead off while the clock runs, and lists the notices', () => {
    const s = newSession({ layout: starterLayout(), clock: null }, memoryStore());
    s.showing = 'children';
    s.refresh();
    expect(s.ev.showing).toBe('children');
    expect(s.news).toEqual([]);
    s.game = startRun(starterLayout(), 3, RATES, RULES);
    s.refresh();
    expect(s.showing).toBeNull();
    expect(s.ev.showing).toBeNull();
    expect(s.hand.crews).toBe(RULES.crews);
    expect(s.ev.score.pop).toBe(50000);
  });

  it('a store that throws leaves the game playing', () => {
    const broken: GameStore = {
      load: () => null,
      save: () => {
        throw new Error('full');
      },
    };
    const s = newSession({ layout: starterLayout(), clock: null }, broken);
    expect(() => s.remember()).not.toThrow();
    expect(placed().ok).toBe(true);
  });
});

describe('the view', () => {
  it('opens on the map, looks at a neighborhood or a ring on the surface, and refuses ground that has none', () => {
    const s = newSession({ layout: starterLayout(), clock: null }, memoryStore());
    expect(s.view).toEqual({ at: 'map' });
    expect(s.look('1,0')).toBe(true);
    expect(s.view).toEqual({ at: 'tile', key: '1,0', level: 'surface' });
    expect(s.look('0,0')).toBe(true);
    expect(s.view).toEqual({ at: 'tile', key: '0,0', level: 'surface' });
    expect(s.look('4,0')).toBe(false);
    expect(s.view).toEqual({ at: 'tile', key: '0,0', level: 'surface' });
    const plant = Object.keys(starterLayout().tiles).find((k) => starterLayout().tiles[k]?.kind === 'power') as string;
    expect(s.look(plant)).toBe(false);
    expect(s.view).toEqual({ at: 'tile', key: '0,0', level: 'surface' });
  });

  it('switches level only while looking at a tile, and comes back to the map', () => {
    const s = newSession({ layout: starterLayout(), clock: null }, memoryStore());
    s.showLevel('sub');
    expect(s.view).toEqual({ at: 'map' });
    s.look('1,0');
    s.showLevel('sub');
    expect(s.view).toEqual({ at: 'tile', key: '1,0', level: 'sub' });
    s.showLevel('surface');
    expect(s.view).toEqual({ at: 'tile', key: '1,0', level: 'surface' });
    s.lookAway();
    expect(s.view).toEqual({ at: 'map' });
  });

  it('is never saved with the city', () => {
    const store = memoryStore();
    const s = newSession({ layout: starterLayout(), clock: null }, store);
    s.look('1,0');
    s.showLevel('sub');
    s.save();
    expect(store.load()).toEqual({ tiles: starterLayout().tiles, lines: starterLayout().lines, clock: null });
    const again = newSession(restoreGame(store.load()) as { layout: ReturnType<typeof starterLayout>; clock: null }, store);
    expect(again.view).toEqual({ at: 'map' });
  });

  it('returns to the map when the tile looked at loses its ground, and stays while it keeps it', () => {
    const s = newSession({ layout: starterLayout(), clock: null }, memoryStore());
    s.look('1,0');
    s.showLevel('sub');
    s.remember();
    s.game = move(s.game, 'elementary', '1,0', null).game;
    s.refresh();
    expect(s.view).toEqual({ at: 'tile', key: '1,0', level: 'sub' });
    s.remember();
    s.game = move(s.game, 'erase', '1,0', null).game;
    expect(s.game.layout.tiles['1,0']).toBeUndefined();
    s.refresh();
    expect(s.view).toEqual({ at: 'map' });
    s.undo();
    s.refresh();
    expect(s.game.layout.tiles['1,0']?.kind).toBe('hood');
    expect(s.view).toEqual({ at: 'map' });
  });
});
