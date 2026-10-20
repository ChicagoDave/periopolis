/**
 * @file The site's outline (ADR-0006, laid along the shore by ADR-0016): the rectangle the city is laid out on, the
 * hexagon the sketch used, and what each lets through. Tiles, spacing and neighbors are the same under either.
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
  rectangleFrom,
  restoreLayout,
  starterLayout,
  tileAt,
} from '../src/index.ts';

const SKETCH = hexagon(5);

describe("the city's outline", () => {
  it('is a rectangle along the shore: rows -4 to 4, east-west positions -4 to 13, 158 tiles (ADR-0016)', () => {
    expect(RATES.outline).toEqual({ kind: 'rectangle', west: -4, east: 13, north: -4, south: 4 });
    expect(extent(RATES.outline)).toEqual({ west: -4, east: 13, north: -4, south: 4 });
    expect(allTiles(RATES.outline)).toHaveLength(158);
  });

  it('spans the same width on every row: 18 tiles on even rows, 17 on odd rows, corners at -2,-4 15,-4 -6,4 11,4', () => {
    const rows: Record<number, number> = {};
    for (const k of allTiles(RATES.outline)) {
      const [, r] = tileAt(k);
      rows[r] = (rows[r] ?? 0) + 1;
    }
    for (let r = -4; r <= 4; r++) expect(rows[r]).toBe(r % 2 === 0 ? 18 : 17);
    for (const k of ['-2,-4', '15,-4', '-6,4', '11,4', '-4,0', '13,0']) expect(allTiles(RATES.outline)).toContain(k);
  });

  it("holds the sketch's tiles that lie within its rows, in the sketch's order", () => {
    const sketch = allTiles(SKETCH);
    expect(sketch).toHaveLength(91);
    const city = allTiles(RATES.outline);
    const shared = sketch.filter((k) => city.includes(k));
    expect(shared.length).toBe(76);
    expect(city.filter((k) => sketch.includes(k))).toEqual(shared);
    for (const k of ['0,-5', '-5,5', '-5,1']) expect(city).not.toContain(k);
  });

  it('stops just outside the rectangle', () => {
    for (const [q, r] of [
      [-5, 0],
      [14, 0],
      [0, 5],
      [0, -5],
      [-7, 4],
      [12, 4],
      [-3, -4],
      [16, -4],
    ] as const) {
      expect(onBoard(q, r, RATES.outline)).toBe(false);
    }
    for (const [q, r] of [[-4, 0], [13, 0], [-6, 4], [11, 4], [-2, -4], [15, -4], [-4, 1], [12, 1]] as const) expect(onBoard(q, r, RATES.outline)).toBe(true);
  });

  it('a tile at the edge has only the neighbors inside the outline', () => {
    expect(neighbors('15,-4', RATES.outline)).toEqual(['14,-4', '14,-3']);
    expect(neighbors('13,0', RATES.outline)).toEqual(['13,-1', '12,0', '12,1']);
    expect(neighbors('0,0', RATES.outline)).toEqual(['1,0', '1,-1', '0,-1', '-1,0', '-1,1', '0,1']);
    expect(adjacent('13,0', '14,-1', RATES.outline)).toBe(false);
    expect(adjacent('13,0', '12,1', RATES.outline)).toBe(true);
  });

  it('is what the commands and the restore check against', () => {
    const start = starterLayout();
    expect(placeNeighborhood(start, '-6,4', RATES).ok).toBe(true);
    expect(placeNeighborhood(start, '14,0', RATES)).toEqual({ ok: false, rejection: { reason: 'OffBoard', tile: '14,0' } });
    expect(placeNeighborhood(start, '0,5', RATES)).toEqual({ ok: false, rejection: { reason: 'OffBoard', tile: '0,5' } });
    const restored = restoreLayout(
      { tiles: { '-6,4': { kind: 'hood' }, '14,0': { kind: 'hood' }, '0,5': { kind: 'hood' } }, lines: { '-6,4|-5,4': true, '13,0|14,0': true } },
      RATES,
    );
    expect(restored).toEqual({ tiles: { '-6,4': { kind: 'hood', has: {} } }, lines: { '-5,4|-6,4': true }, circles: ['0,0'] });
  });
});

describe("the sketch's outline", () => {
  it('is the hexagon of hexagons, five tiles from the middle to the edge', () => {
    expect(SKETCH).toEqual({ kind: 'hexagon', radius: 5 });
    expect(extent(SKETCH)).toEqual({ west: -5, east: 5, north: -5, south: 5 });
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
    expect(rectangle(5, 5)).toEqual({ kind: 'rectangle', west: -5, east: 5, north: -5, south: 5 });
    expect(allTiles(rectangle(5, 5))).toHaveLength(115);
    expect(() => rectangleFrom(1, 0, 0, 0)).toThrow(RangeError);
    expect(() => rectangleFrom(0, 0, 1, 0)).toThrow(RangeError);
    expect(() => rectangleFrom(0.5, 1, 0, 0)).toThrow(RangeError);
    expect(allTiles(rectangleFrom(0, 1, 0, 0))).toEqual(['0,0', '1,0']);
  });
});
