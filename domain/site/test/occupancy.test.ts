/**
 * @file The checks under a population (ADR-0009): left out, every neighborhood is full and nothing moves; three new
 * neighborhoods still empty leave the ring room it lacks when they fill; a neighborhood of 400 cannot feed its doctor;
 * the yearly per-person rows follow the people while the capital rows keep the homes as built; and a negative
 * occupancy is refused.
 * Owner context: Site (domain), tests.
 */
import { describe, expect, it } from 'vitest';
import { NO_STRESS, RATES, assess, assessCore, costOf, placeNeighborhood, starterLayout } from '../src/index.ts';
import type { Layout, TileKey } from '../src/index.ts';

function hoods(layout: Layout, keys: readonly TileKey[]): Layout {
  return keys.reduce((s, k) => {
    const o = placeNeighborhood(s, k, RATES);
    if (!o.ok) throw new Error(o.rejection.reason);
    return o.layout;
  }, layout);
}

const status = (l: Layout, id: string, occupied?: Record<TileKey, number>): string | undefined =>
  assess(l, RATES, occupied ? { occupied } : {}).checks.find((c) => c.id === id)?.status;

const THIRTEEN = hoods(starterLayout(), ['2,0', '-3,0', '0,2']);
const NEW_EMPTY: Record<TileKey, number> = { '2,0': 0, '-3,0': 0, '0,2': 0 };

describe('the checks under a population', () => {
  it('with no occupancy given every neighborhood is full: the same assessment as before, figure for figure', () => {
    const full = Object.fromEntries(Object.keys(starterLayout().tiles).filter((k) => starterLayout().tiles[k]?.kind === 'hood').map((k) => [k, RATES.hood]));
    const a = assessCore(starterLayout(), NO_STRESS, RATES);
    const b = assessCore(starterLayout(), NO_STRESS, RATES, full);
    expect(b).toEqual(a);
    expect(a.score.pop).toBe(50000);
    expect(Object.values(a.people)).toEqual(Array(10).fill(5000));
  });

  it('thirteen neighborhoods outgrow the ring; while the three new ones stand empty the ring still has room', () => {
    expect(status(THIRTEEN, 'ring')).toBe('bad');
    expect(status(THIRTEEN, 'ring', NEW_EMPTY)).toBe('ok');
    const a = assess(THIRTEEN, RATES, { occupied: NEW_EMPTY });
    expect(a.score.pop).toBe(50000);
    const ring = a.checks.find((c) => c.id === 'ring');
    expect(ring?.facts).toEqual({ check: 'ring', case: 'room', buildings: 8, serves: RATES.ringServes, pop: 50000 });
  });

  it('the plants are short for 65,000 and enough for the 50,000 living there while the new homes are empty', () => {
    for (const plant of ['water', 'sewage', 'waste']) {
      expect(status(THIRTEEN, plant)).toBe('bad');
      expect(status(THIRTEEN, plant, NEW_EMPTY)).toBe('ok');
    }
  });

  it('a neighborhood of 400 cannot feed its doctor\'s office, and only that neighborhood is marked', () => {
    const a = assess(starterLayout(), RATES, { occupied: { '1,0': 400 } });
    const daily = a.checks.find((c) => c.id === 'daily');
    expect(daily?.status).toBe('bad');
    expect(daily?.tiles).toEqual(['1,0']);
    expect(daily?.facts.check === 'daily' && daily.facts.case === 'short' ? daily.facts.pop1 : null).toBe(400);
    expect(a.per['1,0']?.issues.some((i) => i.kind === 'dailyShort')).toBe(true);
    expect(a.per['0,1']?.issues.some((i) => i.kind === 'dailyShort')).toBe(false);
    expect(a.score.pop).toBe(45400);
  });

  it('an empty neighborhood sends no pupils and no trips', () => {
    const a = assessCore(THIRTEEN, NO_STRESS, RATES, NEW_EMPTY);
    expect(a.people['2,0']).toBe(0);
    expect(a.per['2,0']?.goes?.elementary.each).toBe(0);
    expect(a.per['2,0']?.stuck).toBe(0);
  });

  it('the yearly per-person rows follow the people; the capital rows keep the homes as built', () => {
    const rows = (occupied: Record<TileKey, number>): Record<string, number> => {
      const c = costOf(THIRTEEN, assessCore(THIRTEEN, NO_STRESS, RATES, occupied), RATES);
      return Object.fromEntries((c.tiles['2,0'] ?? []).map((r) => [r.id, r.count]));
    };
    const full = rows({});
    const empty = rows(NEW_EMPTY);
    for (const id of ['police', 'fire', 'health', 'library', 'schools', 'electricity', 'water', 'sewer', 'waste']) {
      expect(full[id]).toBeGreaterThan(0);
      expect(empty[id]).toBe(0);
    }
    for (const id of ['streets', 'parks', 'lowRiseFloor']) {
      if (full[id] !== undefined) expect(empty[id]).toBe(full[id]);
    }
    expect(empty['streets']).toBeGreaterThan(0);
  });

  it('refuses a negative or missing occupancy, naming the tile', () => {
    expect(() => assessCore(starterLayout(), NO_STRESS, RATES, { '1,0': -1 })).toThrow(new RangeError('occupancy of 1,0 must be zero or more, not -1'));
    expect(() => assessCore(starterLayout(), NO_STRESS, RATES, { '1,0': Number.NaN })).toThrow(new RangeError('occupancy of 1,0 must be zero or more, not NaN'));
  });
});
