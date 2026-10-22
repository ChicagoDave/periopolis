/**
 * @file A full circle is built with headroom for the squeeze (ADR-0018; issue 9): `isFull` reads a circle with no open
 * tile for homes; `headroomOf` puts a full circle's neighborhoods at the squeeze; `needsOf` asks a full circle's ring,
 * plants and schools to carry it, marking what an ordinary year would not ask, and leaves a growing circle and a layout
 * with no circles at an ordinary year.
 * Owner context: Site (domain), tests.
 */
import { describe, expect, it } from 'vitest';
import {
  HEADROOM_CHECKS,
  NEED_CHECKS,
  NO_STRESS,
  RATES,
  applyProposal,
  assess,
  assessCore,
  emptyLayout,
  erase,
  headroomOf,
  homeTilesOf,
  isFull,
  needsOf,
  placeNeighborhood,
  proposeFor,
  proposeNeighborhood,
  starterLayout,
} from '../src/index.ts';
import type { Layout, Need, Outcome } from '../src/index.ts';

const ok = (o: Outcome): Layout => {
  if (!o.ok) throw new Error(o.rejection.reason);
  return o.layout;
};

/** Accept every proposal with room until the layout needs nothing. */
function settle(layout: Layout): Layout {
  let s = layout;
  for (let round = 0; round < 50; round++) {
    const steps = proposeFor(s, RATES).flatMap((p) => (p.room ? p.steps : []));
    if (!steps.length) return s;
    const a = applyProposal(s, steps, RATES);
    if (!a.ok) throw new Error(a.rejection.reason);
    s = a.layout;
  }
  throw new Error('never settled');
}

const hoodCount = (l: Layout): number => Object.values(l.tiles).filter((t) => t.kind === 'hood').length;

/** The first circle grown by the Site's own proposals to this many neighborhoods, settled after each. */
function grown(n: number): Layout {
  let s = emptyLayout();
  while (hoodCount(s) < n) {
    const at = proposeNeighborhood(s, RATES);
    if (!at) throw new Error('no room');
    s = settle(ok(placeNeighborhood(s, at, RATES)));
  }
  return s;
}

/** The headroom checks broken when a layout's full circles stand at the squeeze. */
function brokenAtSqueeze(l: Layout): string[] {
  const occupied = headroomOf(l, RATES);
  if (!occupied) return [];
  return assessCore(l, NO_STRESS, RATES, occupied).checks.filter((c) => c.status === 'bad' && HEADROOM_CHECKS.includes(c.id)).map((c) => c.id);
}

/** Checks a built thing can mend, broken in an ordinary year. */
const mendable = (l: Layout): string[] => assess(l, RATES).checks.filter((c) => c.status === 'bad' && NEED_CHECKS.includes(c.id)).map((c) => c.id);
const answered = (needs: readonly Need[]): string[] => [...new Set(needs.flatMap((n) => n.answers))].sort();
const squeezeGives = (l: Layout): string[] =>
  (assess(l, RATES).tests.find((t) => t.id === 'more')?.gives ?? []).filter((g) => g.status === 'bad' && HEADROOM_CHECKS.includes(g.id)).map((g) => g.id);

describe('a full circle', () => {
  const growing = grown(35);
  const at = proposeNeighborhood(growing, RATES);
  if (!at) throw new Error('no 36th tile');
  const filled = ok(placeNeighborhood(growing, at, RATES));
  const built = settle(filled);

  it('is full when every home tile within its rings 1 to 3 is taken, and only then; the middle and the band do not count', () => {
    expect(homeTilesOf('0,0', RATES.outline)).toHaveLength(36);
    expect(isFull(growing, '0,0', RATES.outline)).toBe(false);
    expect(isFull(filled, '0,0', RATES.outline)).toBe(true);
    expect(isFull(ok(erase(filled, at, RATES)), '0,0', RATES.outline)).toBe(false);
    expect(isFull(emptyLayout(), '0,0', RATES.outline)).toBe(false);
  });

  it('holds its neighborhoods at the squeeze for the headroom reading: 5,000 and 20% more, 6,000 each', () => {
    expect(headroomOf(growing, RATES)).toBeNull();
    const occupied = headroomOf(filled, RATES);
    if (!occupied) throw new Error('not full');
    expect(Object.keys(occupied)).toHaveLength(36);
    for (const v of Object.values(occupied)) expect(v).toBeCloseTo(RATES.hood * (1 + RATES.band), 9);
    expect(RATES.hood * (1 + RATES.band)).toBeCloseTo(6000, 9);
  });

  it('a growing circle settled for an ordinary year needs nothing more, though the squeeze would break its ring, plants or schools', () => {
    expect(needsOf(growing, RATES)).toEqual([]);
    expect(squeezeGives(growing).length).toBeGreaterThan(0);
  });

  it('once full, it asks for headroom: ring, plant or school needs marked as the squeeze, and nothing else marked', () => {
    const needs = needsOf(filled, RATES);
    const marked = needs.filter((n) => 'squeeze' in n && n.squeeze);
    expect(marked.length).toBeGreaterThan(0);
    for (const n of marked) expect(['ring', 'ringBuildings', 'modules', 'plantUnits', 'schools']).toContain(n.need);
    for (const n of marked) for (const id of n.answers) expect(HEADROOM_CHECKS).toContain(id);
  });

  it('built to its needs, its ring, plants and schools hold through the squeeze, and it needs nothing more', () => {
    expect(needsOf(built, RATES)).toEqual([]);
    expect(brokenAtSqueeze(built)).toEqual([]);
    expect(squeezeGives(built)).toEqual([]);
  });

  it('its needs answer exactly the checks broken in an ordinary year, and the headroom checks broken at the squeeze', () => {
    for (const l of [growing, filled, built]) {
      const want = [...new Set([...mendable(l), ...brokenAtSqueeze(l)])].sort();
      expect(answered(needsOf(l, RATES))).toEqual(want);
      expect(needsOf(l, RATES).length === 0).toBe(want.length === 0);
    }
  });
});

describe('what is left as it was', () => {
  it('a layout with no circles, the sketch\'s board, is read for an ordinary year only: no headroom, nothing marked, its needs exactly its broken checks', () => {
    const sketch: Layout = { ...starterLayout(), circles: [] };
    expect(headroomOf(sketch, RATES)).toBeNull();
    const needs = needsOf(sketch, RATES);
    expect(needs.some((n) => 'squeeze' in n)).toBe(false);
    expect(answered(needs)).toEqual(mendable(sketch).sort());
  });

  it('refuses a negative squeeze on a full circle, naming it', () => {
    const growing = grown(35);
    const full = ok(placeNeighborhood(growing, proposeNeighborhood(growing, RATES) ?? '', RATES));
    expect(() => needsOf(full, { ...RATES, band: -0.2 })).toThrow(RangeError);
    expect(() => needsOf(full, { ...RATES, band: -0.2 })).toThrow('-0.2');
  });
});
