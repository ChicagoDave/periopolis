/**
 * @file The plan's scenarios for the Site, in the language of the lines: the ledger's city on the board, two far
 * neighborhoods with no line, growing to 100,000 on spokes and with loops, and what the commands refuse.
 * Owner context: Site (domain), tests.
 */
import { describe, expect, it } from 'vitest';
import {
  RATES,
  addPlantUnit,
  addRingBuilding,
  assess,
  bridges,
  emptyLayout,
  erase,
  layStretch,
  placeNeighborhood,
  restoreLayout,
  starterLayout,
  toggleExtra,
} from '../src/index.ts';
import type { Layout, LineCheck, Outcome, TileKey } from '../src/index.ts';

function must(outcome: Outcome): Layout {
  if (!outcome.ok) throw new Error(`refused: ${outcome.rejection.reason}`);
  return outcome.layout;
}

function checkCalled(checks: readonly LineCheck[], id: string): LineCheck {
  const c = checks.find((x) => x.id === id);
  if (!c) throw new Error(`no check ${id}`);
  return c;
}

/** The sketch's path from the ledger's city to 100,000 people: ten more neighborhoods on spokes, fitted out. */
function spokesCity(): Layout {
  let s = starterLayout();
  const line = (a: TileKey, b: TileKey): void => {
    s = must(layStretch(s, a, b, RATES));
  };
  const add: readonly (readonly [TileKey, TileKey])[] = [
    ['2,0', '1,0'],
    ['2,-2', '1,-1'],
    ['1,-2', '1,-1'],
    ['0,-2', '0,-1'],
    ['-2,0', '-1,0'],
    ['-2,2', '-1,1'],
    ['-1,2', '-1,1'],
    ['0,2', '0,1'],
    ['3,0', '2,0'],
    ['-3,0', '-2,0'],
  ];
  for (const [k, via] of add) {
    s = must(placeNeighborhood(s, k, RATES));
    line(via, k);
    s = must(toggleExtra(s, k, 'elementary', RATES));
  }
  for (const k of ['2,-2', '-2,2', '2,0']) s = must(toggleExtra(s, k, 'middle', RATES));
  for (const k of ['0,-2', '0,2']) s = must(toggleExtra(s, k, 'high', RATES));
  for (const k of ['2,-2', '-2,2']) s = must(toggleExtra(s, k, 'fields', RATES));
  for (let i = 0; i < 8; i++) s = must(addRingBuilding(s, '0,0', RATES));
  s = must(addPlantUnit(s, '3,-1', 'power', RATES));
  s = must(addPlantUnit(s, '3,-2', 'water', RATES));
  s = must(addPlantUnit(s, '-3,1', 'sewage', RATES));
  s = must(addPlantUnit(s, '-3,2', 'waste', RATES));
  return s;
}

/** The same city with a second way to every stop: the inner loop, the outer loop, and a bypass to each plant. */
function loopedCity(): Layout {
  let s = spokesCity();
  const line = (a: TileKey, b: TileKey): void => {
    s = must(layStretch(s, a, b, RATES));
  };
  const inner = ['1,0', '1,-1', '0,-1', '-1,0', '-1,1', '0,1'];
  for (let i = 0; i < 6; i++) line(inner[i] ?? '', inner[(i + 1) % 6] ?? '');
  const outer = ['2,0', '2,-1', '2,-2', '1,-2', '0,-2', '-1,-1', '-2,0', '-2,1', '-2,2', '-1,2', '0,2', '1,1'];
  for (let i = 0; i < 12; i++) line(outer[i] ?? '', outer[(i + 1) % 12] ?? '');
  line('3,-1', '3,-2');
  line('-3,1', '-3,2');
  line('3,0', '3,-1');
  line('-3,0', '-3,1');
  return s;
}

describe("the ledger's city on the board", () => {
  const a = assess(starterLayout(), RATES);

  it('is 50,000 people in ten neighborhoods on about 1,400 acres, against 5,857 for a car city', () => {
    expect(a.score.pop).toBe(50000);
    expect(a.score.hoods).toBe(10);
    expect(Math.round(a.score.acres)).toBe(1399);
    expect(Math.round(a.score.car?.acres ?? 0)).toBe(5857);
  });

  it('holds 14 of 15 lines, with fine dining the one to watch', () => {
    const holding = a.checks.filter((c) => c.status === 'ok');
    expect(holding.length).toBe(14);
    const size = checkCalled(a.checks, 'size');
    expect(size.status).toBe('warn');
    expect(size.facts).toEqual({ check: 'size', case: 'underFine', fine: 71300, pop: 50000 });
  });

  it('seats every pupil: 9 elementary schools full to 500, the longest high-school walk 20 minutes', () => {
    const elementary = checkCalled(a.checks, 'elementary');
    expect(elementary.facts).toMatchObject({ case: 'seated', schools: 9, pupils: 3600, fullest: 500, cap: 500 });
    const high = checkCalled(a.checks, 'high');
    expect(high.facts).toMatchObject({ case: 'seated', schools: 2, fullest: 1440 });
    expect(Math.round(high.facts.case === 'seated' ? high.facts.longestMin : 0)).toBe(20);
  });

  it('moves 71% of trips on foot, 11% by bike and 18% by mover, with 217 movers against 42,000 cars', () => {
    expect(Math.round(100 * a.score.foot)).toBe(71);
    expect(Math.round(100 * a.score.bike)).toBe(11);
    expect(Math.round(100 * a.score.ride)).toBe(18);
    expect(Math.round(a.score.fleet)).toBe(217);
    expect(Math.round(a.score.car?.vehicles ?? 0)).toBe(42000);
    expect(a.score.stuck).toBe(0);
  });

  it('holds the three band tests but not a closure: every stretch is a spoke', () => {
    const byId = Object.fromEntries(a.tests.map((t) => [t.id, t]));
    expect(byId['children']?.gives).toEqual([]);
    expect(byId['fewer']?.gives).toEqual([]);
    expect(byId['more']?.gives).toEqual([]);
    const closure = byId['closure'];
    expect(closure?.gives.map((g) => g.id)).toEqual(['stops', 'ways']);
    expect(bridges(starterLayout()).length).toBe(14);
  });

  it('shows the board under a stretch test when asked, and the score of today beside it', () => {
    const shown = assess(starterLayout(), RATES, { show: 'children' });
    expect(shown.showing).toBe('children');
    expect(shown.pop1).toBe(5000);
    expect(checkCalled(shown.checks, 'elementary').facts).toMatchObject({ pupils: 4320 });
    expect(shown.today.pop).toBe(50000);
  });
});

describe('two far neighborhoods with no line', () => {
  let s = starterLayout();
  s = must(placeNeighborhood(s, '4,-2', RATES));
  s = must(placeNeighborhood(s, '4,-1', RATES));
  const a = assess(s, RATES);

  it('break three lines: the walk to work, the stop, and trips with no way', () => {
    expect(a.checks.filter((c) => c.status === 'bad').map((c) => c.id)).toEqual(['work', 'stops', 'ways']);
  });

  it('leave 9.1% of trips with no way, and mark only themselves', () => {
    const ways = checkCalled(a.checks, 'ways');
    expect(ways.facts).toMatchObject({ case: 'stuck' });
    expect(Math.round(1000 * a.score.stuck) / 10).toBe(9.1);
    expect(ways.tiles).toEqual(['4,-2', '4,-1']);
    expect(a.per['1,0']?.issues).toEqual([]);
    expect(a.per['4,-2']?.issues.map((i) => i.kind)).toEqual(['farFromRingNoLine', 'noStop', 'tripsStuck']);
  });
});

describe('growing to 100,000', () => {
  it('on spokes every line holds, but a closure breaks the stop and the way', () => {
    const a = assess(spokesCity(), RATES);
    expect(a.score.pop).toBe(100000);
    expect(a.checks.every((c) => c.status === 'ok')).toBe(true);
    expect(Math.round(a.score.fleet)).toBe(649);
    const closure = a.tests.find((t) => t.id === 'closure');
    expect(closure?.gives.map((g) => g.id)).toEqual(['stops', 'ways']);
  });

  it('with loops every line holds and all four stretch tests hold, on 584 movers', () => {
    const looped = loopedCity();
    const a = assess(looped, RATES);
    expect(a.checks.every((c) => c.status === 'ok')).toBe(true);
    expect(a.tests.every((t) => t.gives.length === 0)).toBe(true);
    expect(bridges(looped)).toEqual([]);
    expect(Math.round(a.score.fleet)).toBe(584);
    expect(Math.round(10 * a.score.moverKm) / 10).toBe(30.4);
  });
});

describe('what the commands refuse', () => {
  const start = starterLayout();

  it('a neighborhood on taken ground, and anything off the board', () => {
    expect(placeNeighborhood(start, '0,0', RATES)).toEqual({ ok: false, rejection: { reason: 'TileTaken', tile: '0,0', by: 'ring' } });
    expect(placeNeighborhood(start, '9,9', RATES)).toEqual({ ok: false, rejection: { reason: 'OffBoard', tile: '9,9' } });
    expect(placeNeighborhood(start, 'north', RATES)).toEqual({ ok: false, rejection: { reason: 'OffBoard', tile: 'north' } });
  });

  it('a ring past 40 buildings and a plant past 12 units', () => {
    let s = emptyLayout();
    for (let i = 0; i < 40; i++) s = must(addRingBuilding(s, '0,0', RATES));
    expect(addRingBuilding(s, '0,0', RATES)).toEqual({ ok: false, rejection: { reason: 'RingFull', tile: '0,0', most: 40 } });
    let p = emptyLayout();
    for (let i = 0; i < 12; i++) p = must(addPlantUnit(p, '1,0', 'water', RATES));
    expect(addPlantUnit(p, '1,0', 'water', RATES)).toEqual({ ok: false, rejection: { reason: 'PlantFull', tile: '1,0', most: 12 } });
    expect(addPlantUnit(p, '1,0', 'sewage', RATES)).toEqual({ ok: false, rejection: { reason: 'TileTaken', tile: '1,0', by: 'water' } });
  });

  it('a school outside a neighborhood, a stretch to itself or a non-neighbor, and erasing nothing', () => {
    expect(toggleExtra(start, '0,0', 'high', RATES)).toEqual({ ok: false, rejection: { reason: 'NotANeighborhood', tile: '0,0', extra: 'high' } });
    expect(layStretch(start, '0,0', '0,0', RATES)).toEqual({ ok: false, rejection: { reason: 'SameTile', tile: '0,0' } });
    expect(layStretch(start, '0,0', '3,0', RATES)).toEqual({ ok: false, rejection: { reason: 'NotAdjacent', from: '0,0', to: '3,0' } });
    expect(erase(start, '4,0', RATES)).toEqual({ ok: false, rejection: { reason: 'NothingThere', tile: '4,0' } });
  });

  it('never changes the layout it was given', () => {
    const before = JSON.stringify(start);
    must(placeNeighborhood(start, '4,0', RATES));
    must(layStretch(start, '0,0', '1,0', RATES));
    must(erase(start, '0,0', RATES));
    expect(JSON.stringify(start)).toBe(before);
  });
});

describe('what the commands do', () => {
  it('laying a stretch twice removes it; erasing a ring takes one building at a time', () => {
    const start = starterLayout();
    const laid = layStretch(start, '1,0', '2,0', RATES);
    expect(laid.ok && laid.event).toEqual({ type: 'StretchLaid', edge: '1,0|2,0' });
    const removed = laid.ok ? layStretch(laid.layout, '2,0', '1,0', RATES) : laid;
    expect(removed.ok && removed.event).toEqual({ type: 'StretchRemoved', edge: '1,0|2,0' });
    expect(removed.ok && removed.layout.lines).toEqual(start.lines);
    const fewer = erase(start, '0,0', RATES);
    expect(fewer.ok && fewer.event).toEqual({ type: 'UnitRemoved', tile: '0,0', kind: 'ring', left: 7 });
    expect(fewer.ok && fewer.layout.tiles['0,0']).toEqual({ kind: 'ring', n: 7 });
  });

  it('erasing open ground removes the line through it', () => {
    const s = must(layStretch(starterLayout(), '1,0', '2,0', RATES));
    const cleared = erase(s, '2,0', RATES);
    expect(cleared.ok && cleared.event).toEqual({ type: 'LinesThroughTileRemoved', tile: '2,0', edges: ['1,0|2,0'] });
    expect(cleared.ok && cleared.layout.lines).toEqual(starterLayout().lines);
  });
});

describe('restoring a layout from storage', () => {
  it('keeps only what the board allows', () => {
    const restored = restoreLayout(
      { tiles: { '9,9': { kind: 'hood' }, '0,0': { kind: 'zoo' }, '1,0': { kind: 'ring', n: 999 } }, lines: { x: true, '0,0|3,3': true, '1,0|0,0': true } },
      RATES,
    );
    expect(restored).toEqual({ tiles: { '1,0': { kind: 'ring', n: 40 } }, lines: { '0,0|1,0': true }, circles: ['0,0'] });
    expect(restoreLayout('city', RATES)).toBeNull();
  });
});
