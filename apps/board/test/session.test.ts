/**
 * @file The session and the storage adapter: what is saved, what undo brings back, what a bad save becomes, and the
 * view: the map or one tile's ground, never saved, back to the map when the ground goes; and on a run built in order
 * (ADR-0012), the people admitted, what holds the rest back, stops under construction and the crew order.
 * Owner context: Board (adapter), tests.
 */
import { describe, expect, it } from 'vitest';
import { RULES, placeOrder, startRun, stopRun, tick } from '@city/run';
import type { Game } from '@city/run';
import { RATES, addPlantUnit, addRingBuilding, assess, emptyLayout, layStretch, placeNeighborhood, starterLayout } from '@city/site';
import type { Layout, Outcome, TileKey } from '@city/site';
import { move } from '../src/moves.ts';
import { newSession } from '../src/session.ts';
import { memoryStore, restoreGame } from '../src/storage.ts';
import type { GameStore } from '../src/storage.ts';

const placed = (): ReturnType<typeof placeNeighborhood> => placeNeighborhood(starterLayout(), '3,0', RATES);

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
  it('saves the game as the sketch saved it, under tiles, lines and clock, with the circles beside them (ADR-0016)', () => {
    const store = memoryStore();
    const s = newSession({ layout: starterLayout(), clock: null }, store);
    s.save();
    expect(store.load()).toEqual({ tiles: starterLayout().tiles, lines: starterLayout().lines, circles: ['0,0'], clock: null });
  });

  it('saves and reloads a city on two circles, and a save without circles comes back on the first (ADR-0016)', () => {
    const store = memoryStore();
    const s = newSession({ layout: { ...starterLayout(), circles: ['0,0', '9,0'] }, clock: null }, store);
    s.save();
    expect((store.load() as { circles: unknown }).circles).toEqual(['0,0', '9,0']);
    expect(restoreGame(store.load())?.layout.circles).toEqual(['0,0', '9,0']);
    expect(restoreGame({ tiles: starterLayout().tiles, lines: starterLayout().lines, clock: null })?.layout.circles).toEqual(['0,0']);
  });

  it('undo brings back the game before, clears the line cursor, saves, and refuses with nothing to undo', () => {
    const store = memoryStore();
    const s = newSession({ layout: starterLayout(), clock: null }, store);
    expect(s.undo()).toBe(false);
    const m = move(s.game, 'hood', '3,0', null);
    s.remember();
    s.game = m.game;
    s.lineFrom = '1,0';
    s.save();
    expect(restoreGame(store.load())?.layout.tiles['3,0']).toEqual({ kind: 'hood', has: {} });
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
      s.game = { layout: { tiles: { '0,0': { kind: 'ring', n: i + 1 } }, lines: {}, circles: ['0,0'] }, clock: null };
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
    expect(s.look('3,0')).toBe(false);
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
    expect(store.load()).toEqual({ tiles: starterLayout().tiles, lines: starterLayout().lines, circles: ['0,0'], clock: null });
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

/** Ten stretches inside the first circle: along row 0 from the band's west edge to its east, then two steps south. */
const TEN_STRETCHES: readonly (readonly [TileKey, TileKey])[] = [
  ['-4,0', '-3,0'], ['-3,0', '-2,0'], ['-2,0', '-1,0'], ['-1,0', '0,0'], ['0,0', '1,0'], ['1,0', '2,0'], ['2,0', '3,0'], ['3,0', '4,0'], ['4,0', '3,1'], ['3,1', '2,2'],
];

describe('a run built in order (ADR-0012)', () => {
  const built = (layout: Layout, ...commands: ((l: Layout) => Outcome)[]): Layout =>
    commands.reduce((l, c) => {
      const o = c(l);
      if (!o.ok) throw new Error(o.rejection.reason);
      return o.layout;
    }, layout);
  const order = (game: Game, command: (plan: Layout) => Outcome): Game => {
    const out = placeOrder(game, command, RULES);
    if (!out.ok) throw new Error(out.rejection.reason);
    return out.game;
  };
  const served = built(
    emptyLayout(),
    (l) => placeNeighborhood(l, '0,0', RATES),
    (l) => addPlantUnit(l, '4,0', 'power', RATES),
    (l) => addPlantUnit(l, '4,0', 'power', RATES),
    (l) => addPlantUnit(l, '-4,0', 'water', RATES),
    (l) => addPlantUnit(l, '-4,3', 'sewage', RATES),
    (l) => addPlantUnit(l, '-4,2', 'waste', RATES),
  );

  it('shows the board for the people admitted, and what holds them back; off the clock everyone lives there', () => {
    const s = newSession(startRun(served, 7, RATES, RULES, { inOrder: true }), memoryStore());
    s.refresh();
    expect(s.ev.score.pop).toBeCloseTo(RATES.hood * 0.6, 6);
    expect(s.occupied).toEqual({ '0,0': RATES.hood * 0.6 });
    expect(s.held).toEqual([{ hood: '0,0', short: [], seats: ['elementary', 'middle', 'high'] }]);
    // The childless share sends no pupils, so with no school the line waits; counted with children it would break.
    expect(s.ev.checks.find((c) => c.id === 'elementary')?.facts).toEqual({ check: 'elementary', case: 'waiting', hoods: 1 });
    expect(assess(served, RATES, { occupied: { '0,0': RATES.hood * 0.6 } }).checks.find((c) => c.id === 'elementary')?.status).toBe('bad');
    s.game = stopRun(s.game);
    s.refresh();
    expect(s.ev.score.pop).toBe(RATES.hood);
    expect(s.occupied).toBeNull();
    expect(s.held).toEqual([]);
  });

  it('names the neighborhoods whose stop is under construction, and none once the clock stops', () => {
    const ringed = built(emptyLayout(), (l) => addRingBuilding(l, '0,0', RATES), (l) => placeNeighborhood(l, '1,0', RATES));
    const s = newSession(order(startRun(ringed, 7, RATES, RULES, { inOrder: true }), (p) => layStretch(p, '0,0', '1,0', RATES)), memoryStore());
    s.refresh();
    expect(s.building).toEqual(['1,0']);
    expect(s.ev.checks.find((c) => c.id === 'stops')?.tiles).toEqual(['1,0']);
    s.game = tick(s.game, RATES, RULES);
    s.refresh();
    expect(s.building).toEqual([]);
    expect(s.ev.checks.find((c) => c.id === 'stops')?.status).toBe('ok');
    s.game = order(s.game, (p) => layStretch(p, '1,0', '2,0', RATES));
    s.game = { layout: s.game.layout, clock: null };
    s.refresh();
    expect(s.building).toEqual([]);
  });

  it('lists a unit of a service the city is short of as working ahead of the stretches (ADR-0012 Decision 7)', () => {
    let g = startRun(emptyLayout(), 7, RATES, RULES, { inOrder: true });
    for (const [a, b] of TEN_STRETCHES) g = order(g, (p) => layStretch(p, a, b, RATES));
    g = order(g, (p) => addPlantUnit(p, '-4,0', 'water', RATES));
    const water = (game: Game): string | undefined => {
      const s = newSession(game, memoryStore());
      s.refresh();
      return s.hand.list.find((j) => j.what === 'water')?.status;
    };
    expect(water(g)).toBe('waiting');
    const clock = g.clock;
    if (!clock) throw new Error('no clock');
    const row = clock.record[0];
    if (!row) throw new Error('no year');
    expect(water({ layout: g.layout, clock: { ...clock, record: [{ ...row, broken: ['water'] }] } })).toBe('working');
  });

  it('lists the work in hand in the crew order: a home ordered before ten stretches waits for them', () => {
    const hand = (inOrder: boolean): string | undefined => {
      let g = order(startRun(emptyLayout(), 7, RATES, RULES, { inOrder }), (p) => placeNeighborhood(p, '0,-2', RATES));
      for (const [a, b] of TEN_STRETCHES) g = order(g, (p) => layStretch(p, a, b, RATES));
      const s = newSession(g, memoryStore());
      s.refresh();
      return s.hand.list.find((j) => j.what === 'hood')?.status;
    };
    expect(hand(true)).toBe('waiting');
    expect(hand(false)).toBe('working');
  });
});
