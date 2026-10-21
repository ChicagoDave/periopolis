/**
 * @file The move-in gate and the checks it reads (ADR-0012 Decisions 3, 8 and 9): a neighborhood nobody lives in
 * watches its stop, its fields, the trips toward it and its schools instead of breaking them; a neighborhood held to the childless share sends no
 * pupils; and the gate lacks a service or a school exactly when that check is broken for the neighborhood asking.
 * Owner context: Site (domain), tests.
 */
import { describe, expect, it } from 'vitest';
import { NO_STRESS, PLANTS, RATES, SCHOOLS, addPlantUnit, assessCore, emptyLayout, moveInGate, placeNeighborhood, starterLayout } from '../src/index.ts';
import type { Layout, LineCheck, Outcome, TileKey } from '../src/index.ts';

function hoods(layout: Layout, keys: readonly TileKey[]): Layout {
  return keys.reduce((s, k) => {
    const o = placeNeighborhood(s, k, RATES);
    if (!o.ok) throw new Error(o.rejection.reason);
    return o.layout;
  }, layout);
}

const checkOf = (l: Layout, id: string, occupied: Record<TileKey, number> = {}, childless: TileKey[] = []): LineCheck | undefined =>
  assessCore(l, NO_STRESS, RATES, occupied, childless).checks.find((c) => c.id === id);

/** The ledger's city with three more neighborhoods, off the line and short of plant units for 65,000. */
const THIRTEEN = hoods(starterLayout(), ['2,0', '-3,0', '0,2']);
const ALONE = hoods(emptyLayout(), ['0,0']);

function must(outcome: Outcome): Layout {
  if (!outcome.ok) throw new Error(`refused: ${outcome.rejection.reason}`);
  return outcome.layout;
}

/** The lone neighborhood with one module: 5,000 people peak at 7.5 MW, which one 77 MW module carries only while it runs. */
const ONE_MODULE = must(addPlantUnit(ALONE, '4,0', 'power', RATES));
const TWO_MODULES = must(addPlantUnit(ONE_MODULE, '4,0', 'power', RATES));

describe('a neighborhood nobody lives in', () => {
  it('lacks its stop as a watch: line 6 is amber, marks it, and counts it', () => {
    const lived = checkOf(THIRTEEN, 'stops');
    expect(lived?.status).toBe('bad');
    expect(lived?.facts).toEqual({ check: 'stops', case: 'without', count: 3 });
    const empty = assessCore(THIRTEEN, NO_STRESS, RATES, { '2,0': 0, '-3,0': 0, '0,2': 0 });
    const stops = empty.checks.find((c) => c.id === 'stops');
    expect(stops?.status).toBe('warn');
    expect(stops?.facts).toEqual({ check: 'stops', case: 'waiting', count: 3 });
    expect(stops?.tiles).toEqual(['2,0', '-3,0', '0,2']);
    expect(empty.per['2,0']?.issues).toContainEqual({ kind: 'noStop' });
  });

  it('is past the walk from fields as a watch: line 4 is amber and marks it, and breaks again once anyone lives there', () => {
    const lived = checkOf(THIRTEEN, 'fields');
    expect(lived?.status).toBe('bad');
    expect(lived?.facts).toEqual({ check: 'fields', case: 'far', count: 1, fieldWalk: RATES.fieldWalk });
    const empty = assessCore(THIRTEEN, NO_STRESS, RATES, { '2,0': 0, '-3,0': 0, '0,2': 0 });
    const fields = empty.checks.find((c) => c.id === 'fields');
    expect(fields?.status).toBe('warn');
    expect(fields?.facts).toEqual({ check: 'fields', case: 'waiting', count: 1, sets: 2, fieldWalk: RATES.fieldWalk });
    expect(fields?.tiles).toEqual(['0,2']);
    expect(empty.per['0,2']?.issues.some((i) => i.kind === 'fieldsFar')).toBe(true);
    expect(empty.per['0,2']?.level).toBe('warn');
    expect(checkOf(THIRTEEN, 'fields', { '2,0': 0, '-3,0': 0, '0,2': 1 })?.status).toBe('bad');
  });

  it('with no fields at all and nobody living anywhere, line 4 waits; with anyone, it is broken', () => {
    expect(checkOf(ALONE, 'fields')?.facts).toEqual({ check: 'fields', case: 'none' });
    const waiting = assessCore(ALONE, NO_STRESS, RATES, { '0,0': 0 });
    const fields = waiting.checks.find((c) => c.id === 'fields');
    expect(fields?.status).toBe('warn');
    expect(fields?.facts).toEqual({ check: 'fields', case: 'waiting', count: 1, sets: 0, fieldWalk: RATES.fieldWalk });
    expect(waiting.per['0,0']?.issues.some((i) => i.kind === 'fieldsFar')).toBe(false);
  });

  it('trips toward it that would be stuck are a watch: line 17 is amber and marks it, not broken', () => {
    const lived = checkOf(THIRTEEN, 'ways');
    expect(lived?.status).toBe('bad');
    expect(lived?.tiles).toEqual(['2,0', '-3,0', '0,2']);
    const empty = assessCore(THIRTEEN, NO_STRESS, RATES, { '2,0': 0, '-3,0': 0, '0,2': 0 });
    const ways = empty.checks.find((c) => c.id === 'ways');
    expect(ways?.status).toBe('warn');
    expect(ways?.facts.check === 'ways' && ways.facts.case === 'waiting' ? ways.facts.count : null).toBe(3);
    expect(ways?.facts.check === 'ways' && ways.facts.case === 'waiting' ? ways.facts.share : 0).toBeGreaterThan(0.005);
    expect(ways?.tiles).toEqual(['2,0', '-3,0', '0,2']);
    expect(empty.per['2,0']?.issues).toContainEqual({ kind: 'tripsToHereStuck' });
    expect(empty.per['2,0']?.level).toBe('warn');
    // One person in one of them: the trips between lived-in neighborhoods are stuck again, and only that tile breaks.
    const one = checkOf(THIRTEEN, 'ways', { '2,0': 1, '-3,0': 0, '0,2': 0 });
    expect(one?.status).toBe('bad');
    expect(one?.tiles).toEqual(['2,0']);
  });

  it('a city nobody lives in yet has no trips, and line 17 says so without dividing by nobody', () => {
    const ways = checkOf(ALONE, 'ways', { '0,0': 0 });
    expect(ways?.status).toBe('ok');
    expect(ways?.facts).toEqual({ check: 'ways', case: 'flowing', foot: 0, bike: 0, ride: 0, nowhere: 0 });
  });

  it('as soon as anyone lives there its missing stop is broken again, and only it is counted', () => {
    const stops = checkOf(THIRTEEN, 'stops', { '2,0': 1, '-3,0': 0, '0,2': 0 });
    expect(stops?.status).toBe('bad');
    expect(stops?.facts).toEqual({ check: 'stops', case: 'without', count: 1 });
    expect(stops?.tiles).toEqual(['2,0']);
  });

  it('with no school of a kind and no pupils, each school check waits instead of breaking', () => {
    for (const kind of SCHOOLS) {
      expect(checkOf(ALONE, kind)?.status).toBe('bad');
      const empty = checkOf(ALONE, kind, { '0,0': 0 });
      expect(empty?.status).toBe('warn');
      expect(empty?.facts).toEqual({ check: kind, case: 'waiting', hoods: 1 });
    }
  });
});

describe('a neighborhood held to the childless share', () => {
  it('sends no pupils, so its households fill no seat and need none', () => {
    const share = RATES.hood * 0.6;
    const core = assessCore(ALONE, NO_STRESS, RATES, { '0,0': share }, ['0,0']);
    for (const kind of SCHOOLS) {
      expect(core.per['0,0']?.goes?.[kind].each).toBe(0);
      const c = core.checks.find((x) => x.id === kind);
      expect(c?.status).toBe('warn');
      expect(c?.facts).toEqual({ check: kind, case: 'waiting', hoods: 1 });
    }
    expect(core.score.pop).toBeCloseTo(share, 6);
  });

  it('in a city with schools it takes no seats, and the others keep theirs', () => {
    const all = assessCore(starterLayout(), NO_STRESS, RATES);
    const held = assessCore(starterLayout(), NO_STRESS, RATES, {}, ['1,0']);
    const pupils = (core: typeof all): number => {
      const f = core.checks.find((c) => c.id === 'elementary')?.facts;
      return f && f.check === 'elementary' && f.case === 'seated' ? f.pupils : Number.NaN;
    };
    const one = all.per['1,0']?.goes?.elementary.each ?? 0;
    expect(one).toBeGreaterThan(0);
    expect(pupils(held)).toBeCloseTo(pupils(all) - one, 6);
    expect(held.per['1,0']?.goes?.elementary.each).toBe(0);
  });
});

describe('the move-in gate', () => {
  it('the ledger city carries any of its neighborhoods: nothing short, every seat there', () => {
    expect(moveInGate(starterLayout(), RATES, '1,0', {})).toEqual({ hood: '1,0', short: [], seats: [] });
  });

  it('a new neighborhood counted full leaves the plants short for 65,000; counted empty, the city carries the rest', () => {
    const counted = moveInGate(THIRTEEN, RATES, '2,0', { '-3,0': RATES.hood, '0,2': RATES.hood });
    expect(counted.short).toEqual(['water', 'sewage', 'waste']);
    const alone = moveInGate(THIRTEEN, RATES, '2,0', { '-3,0': 0, '0,2': 0 });
    expect(alone.short).toEqual([]);
  });

  it('a neighborhood with no school near lacks those seats; one held to the childless share lacks none', () => {
    expect(moveInGate(ALONE, RATES, '0,0', {}).seats).toEqual(['elementary', 'middle', 'high']);
    expect(moveInGate(ALONE, RATES, '0,0', { '0,0': RATES.hood * 0.6 }, ['0,0']).seats).toEqual([]);
  });

  it('lacks a service or a school exactly when that check is broken for it (ADR-0008: read off the checks)', () => {
    const cases: [Layout, TileKey, Record<TileKey, number>, TileKey[]][] = [
      [starterLayout(), '1,0', {}, []],
      [THIRTEEN, '2,0', {}, []],
      [THIRTEEN, '0,2', { '2,0': 0, '-3,0': 0 }, []],
      [THIRTEEN, '-3,0', { '2,0': 3000 }, ['2,0']],
      [ALONE, '0,0', {}, []],
      [ALONE, '0,0', { '0,0': 3000 }, ['0,0']],
      [ONE_MODULE, '0,0', {}, []],
      [TWO_MODULES, '0,0', {}, []],
    ];
    for (const [layout, hood, occupied, childless] of cases) {
      const gate = moveInGate(layout, RATES, hood, occupied, childless);
      const core = assessCore(layout, NO_STRESS, RATES, occupied, childless);
      const bad = (id: string): LineCheck | undefined => core.checks.find((c) => c.id === id && c.status === 'bad');
      // Power is lacking when the check is broken short of carrying, not short of a spare (ADR-0012 Decision 3, amended).
      expect(gate.short).toEqual(PLANTS.filter((p) => bad(p) && !(p === 'power' && bad(p)?.facts.case === 'noSpare')));
      expect(gate.seats).toEqual(SCHOOLS.filter((s) => bad(s)?.tiles.includes(hood)));
    }
  });

  it('carries the people under the stress it is given', () => {
    // 50,000 fit the plants' 60,000; a squeeze of 20% more in the same homes, 60,000, still does; 30% would not.
    expect(moveInGate(starterLayout(), RATES, '1,0', {}, [], { people: 0.2, children: 0 }).short).toEqual([]);
    expect(moveInGate(starterLayout(), RATES, '1,0', {}, [], { people: 0.3, children: 0 }).short).toEqual(['water', 'sewage', 'waste']);
  });

  it('refuses a tile that is not a standing neighborhood', () => {
    expect(() => moveInGate(starterLayout(), RATES, '9,9', {})).toThrow('9,9 is not a standing neighborhood');
  });
});

describe('power with every module running (ADR-0012 Decision 3, amended 2026-10-18)', () => {
  it('no module: the check is short, and the gate lacks power', () => {
    expect(checkOf(ALONE, 'power')?.status).toBe('bad');
    expect(checkOf(ALONE, 'power')?.facts).toEqual({ check: 'power', case: 'short', modules: 0, peakMw: 7.5, needed: 2, short: [{ circle: '0,0', has: 0, needed: 2 }] });
    expect(moveInGate(ALONE, RATES, '0,0', {}).short).toEqual(['power', 'water', 'sewage', 'waste']);
  });

  it('one module carries the peak only while it runs: lines 20 and 21 are broken, people move in all the same', () => {
    const check = checkOf(ONE_MODULE, 'power');
    expect(check?.status).toBe('bad');
    expect(check?.facts).toEqual({ check: 'power', case: 'noSpare', modules: 1, peakMw: 7.5, needed: 2, short: [{ circle: '0,0', has: 1, needed: 2 }] });
    expect(check?.tiles).toEqual(['4,0']);
    expect(moveInGate(ONE_MODULE, RATES, '0,0', {}).short).toEqual(['water', 'sewage', 'waste']);
  });

  it('two modules carry it with one down: the check holds and the gate lacks nothing of power', () => {
    const check = checkOf(TWO_MODULES, 'power');
    expect(check?.status).toBe('ok');
    expect(check?.facts).toEqual({ check: 'power', case: 'carries', modules: 2, firmMw: 77, peakMw: 7.5 });
    expect(moveInGate(TWO_MODULES, RATES, '0,0', {}).short).toEqual(['water', 'sewage', 'waste']);
  });

  it('the peak counts the people given, so an empty neighborhood asks for no module', () => {
    expect(checkOf(ONE_MODULE, 'power', { '0,0': 0 })?.status).toBe('ok');
  });
});
