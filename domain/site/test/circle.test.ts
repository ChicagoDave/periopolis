/**
 * @file The circles and the band (ADR-0016, `docs/domain/site.md` "The circles and the band", first scenario): one
 * circle on the empty site, its rings of 6, 12, 18 and 24, its band on the shore, and every tile of the board in a
 * circle or open to nothing; what a restored layout keeps of its circles.
 * Owner context: Site (domain), tests.
 */
import { describe, expect, it } from 'vitest';
import {
  BAND_RING,
  addPlantUnit,
  addRingBuilding,
  applyProposal,
  erase,
  layStretch,
  placeNeighborhood,
  proposeFor,
  toggleExtra,
  FIRST_CIRCLE,
  HOME_RINGS,
  RATES,
  allTiles,
  bandOf,
  circleFits,
  circleOf,
  circleTiles,
  eastWest,
  emptyLayout,
  hexRing,
  inBand,
  restoreLayout,
  ringDistance,
  shoreTiles,
  starterLayout,
} from '../src/index.ts';
import type { Layout, Outcome, Proposal } from '../src/index.ts';

describe('a circle on the board', () => {
  it('the empty site and the starter hold one circle, at 0,0', () => {
    expect(emptyLayout().circles).toEqual(['0,0']);
    expect(starterLayout().circles).toEqual([FIRST_CIRCLE]);
    expect(HOME_RINGS).toBe(3);
    expect(BAND_RING).toBe(4);
  });

  it('its hex rings hold 6, 12, 18 and 24 tiles, 61 in all, every one on the board', () => {
    expect(hexRing('0,0', 0)).toEqual(['0,0']);
    for (const [k, n] of [
      [1, 6],
      [2, 12],
      [3, 18],
      [4, 24],
    ] as const) {
      const ring = hexRing('0,0', k);
      expect(ring).toHaveLength(n);
      for (const t of ring) expect(ringDistance('0,0', t)).toBe(k);
    }
    expect(circleTiles('0,0')).toHaveLength(61);
    expect(bandOf('0,0')).toEqual(hexRing('0,0', 4));
    const board = allTiles(RATES.outline);
    for (const t of circleTiles('0,0')) expect(board).toContain(t);
    expect(circleFits('0,0', RATES.outline)).toBe(true);
  });

  it("the band's south tiles touch the shore", () => {
    expect(shoreTiles('0,0', RATES.outline)).toEqual(['-4,4', '-3,4', '-2,4', '-1,4', '0,4']);
    expect(shoreTiles('9,0', RATES.outline)).toEqual(['5,4', '6,4', '7,4', '8,4', '9,4']);
    expect(eastWest('-4,4')).toBe(-2);
    expect(eastWest('0,4')).toBe(2);
  });

  it('every tile of the rectangle is in one of the two circles or open to nothing', () => {
    const circles = ['0,0', '9,0'];
    const board = allTiles(RATES.outline);
    expect(board).toHaveLength(158);
    const first = board.filter((k) => circleOf(circles, k) === '0,0');
    const second = board.filter((k) => circleOf(circles, k) === '9,0');
    const none = board.filter((k) => circleOf(circles, k) === null);
    expect(first).toHaveLength(61);
    expect(second).toHaveLength(61);
    expect(none).toHaveLength(36);
    expect(circleOf(circles, '4,0')).toBe('0,0');
    expect(circleOf(circles, '5,0')).toBe('9,0');
    expect(circleOf(circles, '-4,4')).toBe('0,0');
    expect(circleOf(circles, '15,-4')).toBeNull();
    expect(inBand(circles, '4,0')).toBe(true);
    expect(inBand(circles, '3,0')).toBe(false);
    expect(inBand(circles, '15,-4')).toBe(false);
    expect(circleFits('9,0', RATES.outline)).toBe(true);
  });

  it('two circles 8 steps apart would share the tile between them; 9 steps apart they touch', () => {
    const shared = circleTiles('0,0').filter((k) => circleTiles('8,0').includes(k));
    expect(shared).toEqual(['4,0']);
    expect(circleTiles('0,0').filter((k) => circleTiles('9,0').includes(k))).toEqual([]);
    expect(ringDistance('4,0', '5,0')).toBe(1);
  });

  it('a circle fits only when its whole band is on the board', () => {
    expect(circleFits('12,0', RATES.outline)).toBe(false);
    expect(circleFits('0,1', RATES.outline)).toBe(false);
    expect(circleFits('4,0', RATES.outline)).toBe(true);
  });

  it('a restored layout keeps the circles that fit, once each, and falls back to the first', () => {
    const kept = restoreLayout({ tiles: {}, lines: {}, circles: ['9,0', '0,0', 'x', '9,0', '12,0', 7] }, RATES);
    expect(kept?.circles).toEqual(['9,0', '0,0']);
    expect(restoreLayout({ tiles: {}, lines: {} }, RATES)?.circles).toEqual(['0,0']);
    expect(restoreLayout({ tiles: {}, lines: {}, circles: ['12,0'] }, RATES)?.circles).toEqual(['0,0']);
    expect(restoreLayout({ tiles: {}, lines: {}, circles: 'none' }, RATES)?.circles).toEqual(['0,0']);
  });
});

describe('the circles ride through every command and proposal', () => {
  const two: Layout = { ...starterLayout(), circles: ['0,0', '9,0'] };
  const okLayout = (o: Outcome): Layout => {
    if (!o.ok) throw new Error(o.rejection.reason);
    return o.layout;
  };

  it('every event path answers with the circles it was given', () => {
    const cases: readonly (readonly [string, Outcome])[] = [
      ['NeighborhoodPlaced', placeNeighborhood(two, '3,0', RATES)],
      ['RingBuildingAdded', addRingBuilding(two, '0,0', RATES)],
      ['ExtraAdded', toggleExtra(two, '1,0', 'high', RATES)],
      ['PlantUnitAdded', addPlantUnit(two, '3,-1', 'power', RATES)],
      ['StretchLaid', layStretch(two, '2,-1', '3,-1', RATES)],
      ['StretchRemoved', layStretch(two, '0,0', '1,0', RATES)],
      ['LinesThroughTileRemoved', erase(two, '0,0', RATES)],
      ['TileCleared', erase(two, '3,-2', RATES)],
    ];
    for (const [name, o] of cases) {
      expect(o.ok, name).toBe(true);
      expect(okLayout(o).circles, name).toEqual(['0,0', '9,0']);
    }
    expect(erase(okLayout(erase(two, '0,0', RATES)), '0,0', RATES).ok && okLayout(erase(okLayout(erase(two, '0,0', RATES)), '0,0', RATES)).circles).toEqual(['0,0', '9,0']);
  });

  it('a proposal accepted keeps the circles', () => {
    const eleven = okLayout(placeNeighborhood(two, '2,0', RATES));
    const p = proposeFor(eleven, RATES)[0] as Proposal;
    expect(p.room).toBe(true);
    const applied = applyProposal(eleven, p.room ? p.steps : [], RATES);
    expect(applied.ok && applied.layout.circles).toEqual(['0,0', '9,0']);
  });

  it('a restored two-circle layout keeps its tiles and lines beside its circles, and drops a middle off the board', () => {
    const r = restoreLayout({ tiles: { '1,0': { kind: 'hood' } }, lines: { '0,0|1,0': true }, circles: ['0,0', '9,0', '40,0'] }, RATES);
    expect(r).toEqual({ tiles: { '1,0': { kind: 'hood', has: {} } }, lines: { '0,0|1,0': true }, circles: ['0,0', '9,0'] });
  });
});
