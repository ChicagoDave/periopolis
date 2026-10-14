/**
 * @file The site's outline (ADR-0006): the rectangle the city is laid out on, the hexagon the sketch used, and what
 * each lets through. Tiles, spacing and neighbors are the same under either.
 * Owner context: Site (domain), tests.
 */
import { describe, expect, it } from 'vitest';
import {
  RATES,
  adjacent,
  allTiles,
  extent,
  hexagon,
  neighbors,
  onBoard,
  placeNeighborhood,
  rectangle,
  restoreLayout,
  starterLayout,
  tileAt,
} from '../src/index.ts';

const SKETCH = hexagon(5);

describe("the city's outline", () => {
  it('is a rectangle five steps across and five rows down from the middle, 115 tiles', () => {
    expect(RATES.outline).toEqual({ kind: 'rectangle', halfWidth: 5, halfHeight: 5 });
    expect(extent(RATES.outline)).toEqual({ halfWidth: 5, halfHeight: 5 });
    expect(allTiles(RATES.outline)).toHaveLength(115);
  });

  it('spans the same width on every row: 11 tiles on even rows, 10 on odd rows, corners at -2,-5 7,-5 -7,5 2,5', () => {
    const rows: Record<number, number> = {};
    for (const k of allTiles(RATES.outline)) {
      const [, r] = tileAt(k);
      rows[r] = (rows[r] ?? 0) + 1;
    }
    for (let r = -5; r <= 5; r++) expect(rows[r]).toBe(r % 2 === 0 ? 11 : 10);
    for (const k of ['-2,-5', '7,-5', '-7,5', '2,5', '-5,0', '5,0']) expect(allTiles(RATES.outline)).toContain(k);
  });

  it("holds every one of the sketch's 91 tiles, in the sketch's order", () => {
    const sketch = allTiles(SKETCH);
    expect(sketch).toHaveLength(91);
    const city = allTiles(RATES.outline);
    expect(city.filter((k) => sketch.includes(k))).toEqual(sketch);
  });

  it('stops just outside the rectangle', () => {
    for (const [q, r] of [
      [6, 0],
      [-6, 0],
      [5, 1],
      [-6, 1],
      [8, -5],
      [-3, -5],
      [0, 6],
      [0, -6],
    ] as const) {
      expect(onBoard(q, r, RATES.outline)).toBe(false);
    }
    for (const [q, r] of [[5, 0], [4, 1], [-5, 1], [7, -5], [-2, -5], [2, 5]] as const) expect(onBoard(q, r, RATES.outline)).toBe(true);
  });

  it('a tile at the edge has only the neighbors inside the outline', () => {
    expect(neighbors('7,-5', RATES.outline)).toEqual(['6,-5', '6,-4', '7,-4']);
    expect(neighbors('5,0', RATES.outline)).toEqual(['5,-1', '4,0', '4,1']);
    expect(neighbors('0,0', RATES.outline)).toEqual(['1,0', '1,-1', '0,-1', '-1,0', '-1,1', '0,1']);
    expect(adjacent('5,0', '6,-1', RATES.outline)).toBe(false);
    expect(adjacent('5,0', '4,1', RATES.outline)).toBe(true);
  });

  it('is what the commands and the restore check against', () => {
    const start = starterLayout();
    expect(placeNeighborhood(start, '-6,3', RATES).ok).toBe(true);
    expect(placeNeighborhood(start, '6,0', RATES)).toEqual({ ok: false, rejection: { reason: 'OffBoard', tile: '6,0' } });
    expect(placeNeighborhood(start, '5,1', RATES)).toEqual({ ok: false, rejection: { reason: 'OffBoard', tile: '5,1' } });
    const restored = restoreLayout(
      { tiles: { '-6,3': { kind: 'hood' }, '6,0': { kind: 'hood' }, '5,1': { kind: 'hood' } }, lines: { '-6,3|-5,3': true, '5,0|6,0': true } },
      RATES,
    );
    expect(restored).toEqual({ tiles: { '-6,3': { kind: 'hood', has: {} } }, lines: { '-5,3|-6,3': true } });
  });
});

describe("the sketch's outline", () => {
  it('is the hexagon of hexagons, five tiles from the middle to the edge', () => {
    expect(SKETCH).toEqual({ kind: 'hexagon', radius: 5 });
    expect(extent(SKETCH)).toEqual({ halfWidth: 5, halfHeight: 5 });
    expect(onBoard(5, 0, SKETCH)).toBe(true);
    expect(onBoard(-6, 3, SKETCH)).toBe(false);
    expect(neighbors('5,0', SKETCH)).toEqual(['5,-1', '4,0', '4,1']);
  });
});

describe('an outline takes whole numbers of zero or more', () => {
  it('refuses a fraction or a negative', () => {
    expect(() => hexagon(-1)).toThrow(RangeError);
    expect(() => hexagon(2.5)).toThrow(RangeError);
    expect(() => rectangle(5, -1)).toThrow(RangeError);
    expect(() => rectangle(1.5, 5)).toThrow(RangeError);
    expect(allTiles(hexagon(0))).toEqual(['0,0']);
    expect(allTiles(rectangle(0, 0))).toEqual(['0,0']);
  });
});
