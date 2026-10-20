/**
 * @file A city sized to its people: the ledger's city on the board keeps its tiles and line and every line it held,
 * with one ring building and one reactor module fewer; the starter itself is untouched; a city that needs something
 * cannot be sized; and the trim runs only the ordinary erase command.
 * Owner context: Site (domain), tests.
 */
import { describe, expect, it } from 'vitest';
import { RATES, assess, needsOf, placeNeighborhood, sizedLayout, sizedTo, starterLayout } from '../src/index.ts';
import type { Layout } from '../src/index.ts';

const statuses = (l: Layout): Record<string, string> => Object.fromEntries(assess(l, RATES).checks.map((c) => [c.id, c.status]));

describe('a city sized to its people', () => {
  it("the ledger's city sized keeps 7 of its 8 ring buildings and 2 of its 3 reactor modules, and nothing else moves", () => {
    const sized = sizedLayout(RATES);
    const starter = starterLayout();
    expect(sized.tiles['0,0']).toEqual({ kind: 'ring', n: 7 });
    expect(sized.tiles['0,4']).toEqual({ kind: 'power', n: 2 });
    const others = (l: Layout): Layout['tiles'] => Object.fromEntries(Object.entries(l.tiles).filter(([k]) => k !== '0,0' && k !== '0,4'));
    expect(others(sized)).toEqual(others(starter));
    expect(sized.lines).toEqual(starter.lines);
  });

  it('holds every line the starter holds, and needs nothing', () => {
    expect(statuses(sizedLayout(RATES))).toEqual(statuses(starterLayout()));
    expect(needsOf(sizedLayout(RATES), RATES)).toEqual([]);
  });

  it('leaves the sketch\'s starter as it was (ADR-0003)', () => {
    const before = JSON.stringify(starterLayout());
    sizedLayout(RATES);
    expect(JSON.stringify(starterLayout())).toBe(before);
    expect(starterLayout().tiles['0,0']).toEqual({ kind: 'ring', n: 8 });
  });

  it('one building or module fewer would break a line', () => {
    const sized = sizedLayout(RATES);
    expect(assess({ ...sized, tiles: { ...sized.tiles, '0,0': { kind: 'ring', n: 6 } } }, RATES).checks.find((c) => c.id === 'ring')?.status).toBe('bad');
    expect(assess({ ...sized, tiles: { ...sized.tiles, '0,4': { kind: 'power', n: 1 } } }, RATES).checks.find((c) => c.id === 'power')?.status).toBe('bad');
  });

  it('refuses to size a city that needs something', () => {
    const o = placeNeighborhood(starterLayout(), '2,0', RATES);
    if (!o.ok) throw new Error(o.rejection.reason);
    expect(() => sizedTo(o.layout, RATES)).toThrow('a layout that needs something cannot be sized; meet its needs first');
  });

  it('a city already sized is sized to itself', () => {
    const sized = sizedLayout(RATES);
    expect(sizedTo(sized, RATES)).toEqual(sized);
  });
});
