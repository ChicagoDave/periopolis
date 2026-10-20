/**
 * @file The needs card's words and its accept move: the ledger's city needs nothing; thirteen neighborhoods are worded
 * and priced one addition at a time; Add all builds every proposal and leaves no line broken; a running clock and a
 * board with no room build nothing and say why.
 * Owner context: Board (adapter), tests.
 */
import { describe, expect, it } from 'vitest';
import { RATES, allTiles, assess, bandRule, emptyLayout, placeNeighborhood, proposeFor, starterLayout } from '@city/site';
import type { Layout, TileKey } from '@city/site';
import { RULES, startRun } from '@city/run';
import { accept } from '../src/moves.ts';
import { addedSaid, needsNow, proposalPrice } from '../src/wording.ts';

function placed(layout: Layout, keys: readonly TileKey[]): Layout {
  return keys.reduce((s, k) => {
    const o = placeNeighborhood(s, k, RATES);
    if (!o.ok) throw new Error(o.rejection.reason);
    return o.layout;
  }, layout);
}

const THIRTEEN = placed(starterLayout(), ['2,0', '-3,0', '0,2']);

describe('the needs card, worded', () => {
  it("says the ledger's city needs nothing", () => {
    expect(needsNow(proposeFor(starterLayout(), RATES).length, false, false)).toBe('The city needs nothing more to keep its lines whole.');
  });

  it('counts the additions for thirteen neighborhoods and prices each', () => {
    const ps = proposeFor(THIRTEEN, RATES);
    expect(needsNow(ps.length, false, false)).toBe('8 additions keep the lines whole that building can mend. Show marks where one goes; Add builds it.');
    expect(proposalPrice(ps[0]!)).toBe('$160 M to build, $3.2 M a year to run.');
    expect(proposalPrice(ps[4]!)).toBe('Inside floor already built; it costs nothing more.');
    // A high school nearer home means fewer rides and a smaller fleet: it saves money.
    expect(ps[5]!.room && ps[5]!.build).toBeLessThan(0);
    expect(proposalPrice(ps[5]!)).toMatch(/^\$[\d,]+ less to build, \$[\d,]+ less a year to run\.$/);
  });

  it('says the clock must stop first while it runs', () => {
    expect(needsNow(0, true, false)).toBe('While the clock runs, the crews build what you order. Stop the clock to see what the city needs.');
  });

  it('says when the site has no room', () => {
    const full = placed(emptyLayout(), allTiles(RATES.outline).filter((k) => !bandRule(['0,0'], k, 'home')));
    const ps = proposeFor(full, RATES);
    expect(needsNow(0, false, true)).toBe('The site has no room for the last of what it needs.');
    expect(proposalPrice(ps[0]!)).toBe('There is no room on the site for it.');
  });
});

describe('building what the city needs', () => {
  it('Add all builds every proposal: no line broken, the tally back to 15 of 16 with one to watch', () => {
    const m = accept({ layout: THIRTEEN, clock: null }, proposeFor(THIRTEEN, RATES));
    expect(m.changed).toBe(true);
    expect(m.said).toBe('Built 8 additions. Undo takes them back one click at a time.');
    const checks = assess(m.game.layout, RATES).checks;
    expect(checks.filter((c) => c.status === 'bad')).toEqual([]);
    expect(checks.filter((c) => c.status === 'ok')).toHaveLength(15);
    expect(m.game.layout.tiles['0,0']).toEqual({ kind: 'ring', n: 9 });
    expect(m.game.layout.tiles['0,2']).toEqual({ kind: 'hood', has: { high: true, fields: true } });
    expect(proposeFor(m.game.layout, RATES)).toEqual([]);
  });

  it('Add builds one proposal and says what it built', () => {
    const one = placed(starterLayout(), ['2,0']);
    const m = accept({ layout: one, clock: null }, proposeFor(one, RATES));
    expect(m.said).toBe('Built: the mover line run to 2,0, on a line to the ring.');
    expect(m.game.layout.lines['2,-1|2,0']).toBe(true);
    expect(assess(m.game.layout, RATES).checks.filter((c) => c.status === 'bad')).toEqual([]);
  });

  it('builds nothing while the clock runs', () => {
    const game = startRun(THIRTEEN, 7, RATES, RULES);
    const m = accept(game, proposeFor(THIRTEEN, RATES));
    expect(m.changed).toBe(false);
    expect(m.game).toBe(game);
    expect(m.said).toBe('Stop the clock to build what the city needs.');
  });

  it('builds nothing when there is no room, and says so', () => {
    const full = placed(emptyLayout(), allTiles(RATES.outline).filter((k) => !bandRule(['0,0'], k, 'home')));
    const m = accept({ layout: full, clock: null }, proposeFor(full, RATES));
    expect(m.changed).toBe(false);
    expect(m.game.layout).toBe(full);
    expect(m.said).toBe('There is no room on the site for what the city needs.');
  });

  it('words a single addition in the status line', () => {
    const ps = proposeFor(THIRTEEN, RATES);
    expect(addedSaid(ps.slice(0, 1))).toBe('Built: 1 more building on the ring at 0,0.');
  });
});
