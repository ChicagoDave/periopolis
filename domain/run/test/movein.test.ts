/**
 * @file People move in only when they are served (ADR-0012 Decisions 3 to 9), on David's founding of 2026-10-15
 * (`docs/work/tests/city-261015.txt`): as he placed it, one reactor module carries the peak only while it runs, so the
 * childless share moves in once the plants open with lines 20 and 21 broken (ADR-0012 Decision 3, amended 2026-10-18);
 * with a second module the same people move in and the lines hold; with the schools too,
 * everyone. Each neighborhood is admitted on its own, in tile order; people who live there stay, and a service they
 * are short of takes the crews first. Without `inOrder` nothing of this happens.
 * Moved 2026-10-20 (ADR-0016, Phase 2): the board now runs along the shore and the founding's reactor at 5,-4 and
 * west plants at -6,3, -5,1 and -4,-1 fall outside it and the circle, so they stand on the band at 4,-4, -4,0 (water,
 * upstream), -4,3 (sewage) and -3,-1 (waste), reached by the same number of stretches; every figure is unchanged.
 * Owner context: Run (domain), tests.
 */
import { describe, expect, it } from 'vitest';
import {
  POPULATION,
  RATES,
  addPlantUnit,
  addRingBuilding,
  adjacent,
  allTiles,
  edgeKey,
  emptyLayout,
  erase,
  layStretch,
  placeNeighborhood,
  starterLayout,
  toggleExtra,
} from '@city/site';
import type { Layout, Outcome, TileKey } from '@city/site';
import { RULES, admit, crewed, emergencyOf, inHand, placeOrder, restoreClock, startRun, tick, tickMonth } from '../src/index.ts';
import type { Clock, Game, OrderOutcome, RecordRow } from '../src/index.ts';

function must(out: OrderOutcome): Game {
  if (!out.ok) throw new Error(`refused: ${out.rejection.reason}`);
  return out.game;
}

const order = (game: Game, command: (plan: Layout) => Outcome): Game => must(placeOrder(game, command, RULES));

const HOODS: readonly TileKey[] = ['0,-1', '1,-1', '-1,0', '1,0', '-1,1', '0,1'];
const STRETCHES: readonly (readonly [TileKey, TileKey])[] = [
  ['-1,0', '0,0'], ['-1,0', '0,-1'], ['1,-1', '1,0'], ['-1,1', '0,1'], ['-1,1', '0,0'], ['0,0', '0,1'],
  ['0,-1', '0,0'], ['0,-1', '1,-1'], ['0,1', '1,0'], ['-1,0', '-1,1'], ['-1,0', '-2,0'], ['-2,0', '-3,0'],
  ['-3,-1', '-4,0'], ['-4,0', '-4,1'], ['-3,0', '-4,1'], ['-4,1', '-4,2'], ['-4,2', '-4,3'], ['-3,0', '-4,0'], ['0,0', '1,0'],
];

/** David's orders, in his order: homes, ring, schools and fields, then the line and the plants. */
function founding(options: { growth?: boolean; inOrder?: boolean }): Game {
  let g = order(startRun(emptyLayout(), 7, RATES, RULES, options), (p) => addRingBuilding(p, '0,0', RATES));
  for (const h of HOODS) g = order(g, (p) => placeNeighborhood(p, h, RATES));
  for (const h of ['1,-1', '-1,0', '0,1']) g = order(g, (p) => toggleExtra(p, h, 'elementary', RATES));
  for (const h of ['1,-1', '-1,1']) g = order(g, (p) => toggleExtra(p, h, 'fields', RATES));
  for (const [a, b] of STRETCHES) g = order(g, (p) => layStretch(p, a, b, RATES));
  g = order(g, (p) => addPlantUnit(p, '4,-4', 'power', RATES));
  g = order(g, (p) => addPlantUnit(p, '-4,0', 'water', RATES));
  g = order(g, (p) => addPlantUnit(p, '-4,3', 'sewage', RATES));
  return order(g, (p) => addPlantUnit(p, '-3,-1', 'waste', RATES));
}

/** The second module the peak needs with one down. */
const secondModule = (g: Game): Game => order(g, (p) => addPlantUnit(p, '4,-4', 'power', RATES));

/** A second module, and an elementary, middle and high school within the walk of every neighborhood. */
function withSchools(g: Game): Game {
  let out = secondModule(g);
  for (const h of ['0,-1', '1,0', '-1,1']) out = order(out, (p) => toggleExtra(p, h, 'elementary', RATES));
  for (const h of ['1,0', '-1,0']) out = order(out, (p) => toggleExtra(p, h, 'middle', RATES));
  for (const h of ['0,-1', '0,1']) out = order(out, (p) => toggleExtra(p, h, 'high', RATES));
  return out;
}

const run = (g: Game): Game => {
  let out = g;
  while (out.clock && out.clock.year < RULES.years) out = tick(out, RATES, RULES);
  return out;
};
const recordOf = (g: Game): readonly RecordRow[] => g.clock?.record ?? [];
const SHARE = POPULATION.childlessShare.value;

describe("David's founding, people when served (city-261015)", () => {
  it('as he placed it, one module carries the peak only while it runs: the childless share moves in once the plants open, and lines 20 and 21 are broken (ADR-0012 Decision 3, amended 2026-10-18)', () => {
    const g = run(founding({ inOrder: true }));
    const rows = recordOf(g);
    const opened = rows.findIndex((r) => r.pop > 0);
    expect(opened).toBeGreaterThan(2);
    for (const r of rows.slice(0, opened)) expect(r.pop).toBe(0);
    // Year 7 on, after the squeeze: six neighborhoods, each holding the childless share, held for seats only.
    const settled = rows[7];
    expect(settled?.homes).toBe(6 * RATES.hood);
    expect(settled?.pop).toBeCloseTo(6 * RATES.hood * SHARE, 6);
    expect(settled?.heldBack).toHaveLength(6);
    expect(settled?.heldBack?.every((x) => x.short.length === 0 && x.seats.join() === 'middle,high')).toBe(true);
    expect(Object.values(g.clock?.lived ?? {})).toEqual(Array(6).fill('childless'));
    // The one module is the risk the board shows: lines 20 and 21 broken and counted from the first resident.
    for (const r of rows.slice(opened)) expect(r.broken).toContain('power');
    const power = g.layout.tiles['4,-4'];
    expect(power?.kind === 'power' ? power.n : 0).toBe(1);
    expect(rows[RULES.years]?.pop).toBeCloseTo(6 * RATES.hood * SHARE, 6);
  });

  it('with a second module the childless share moves in once the plants open, held back for want of seats, and lines 20 and 21 hold', () => {
    const h = run(secondModule(founding({ inOrder: true })));
    const rows = recordOf(h);
    expect(rows[7]?.broken).not.toContain('power');
    const opened = rows.findIndex((r) => r.pop > 0);
    expect(opened).toBeGreaterThan(2);
    for (const r of rows.slice(0, opened)) expect(r.pop).toBe(0);
    // Year 7 on, after the squeeze: six neighborhoods, each holding the childless share.
    const settled = rows[7];
    expect(settled?.homes).toBe(6 * RATES.hood);
    expect(settled?.pop).toBeCloseTo(6 * RATES.hood * SHARE, 6);
    expect(settled?.heldBack).toHaveLength(6);
    expect(settled?.heldBack?.every((x) => x.short.length === 0 && x.seats.join() === 'middle,high')).toBe(true);
    expect(Object.values(h.clock?.lived ?? {})).toEqual(Array(6).fill('childless'));
    // Lines 6 and 15 are not broken for them: the stops stand and the childless share sends no pupils.
    expect(settled?.broken).not.toContain('stops');
    expect(settled?.broken.some((b) => b === 'middle' || b === 'high')).toBe(false);
  });

  it('with the schools as well, nobody until the line, plants, reactor and schools are open, then everyone', () => {
    const g = run(withSchools(founding({ inOrder: true })));
    const rows = recordOf(g);
    const opened = rows.findIndex((r) => r.pop > 0);
    expect(opened).toBeGreaterThan(2);
    for (const r of rows.slice(0, opened)) expect(r.pop).toBe(0);
    expect(rows[opened]?.heldBack).toEqual([]);
    expect(rows[7]?.pop).toBe(6 * RATES.hood);
    expect(Object.values(g.clock?.lived ?? {})).toEqual(Array(6).fill('all'));
    // Everything people need opened before the first resident: every stretch, both modules, the plant units.
    const before = founding({ inOrder: true });
    let at = withSchools(before);
    while (at.clock && at.clock.year < opened) at = tick(at, RATES, RULES);
    expect(Object.keys(at.layout.lines)).toHaveLength(STRETCHES.length);
    const power = at.layout.tiles['4,-4'];
    expect(power?.kind === 'power' ? power.n : 0).toBe(2);
  });

  it('with growth, people arrive only once it opens, at no more than 4,800 a year, until the homes are full', () => {
    const g = run(withSchools(founding({ inOrder: true, growth: true })));
    const rows = recordOf(g);
    const opened = rows.findIndex((r) => r.pop > 0);
    expect(opened).toBeGreaterThan(2);
    for (const r of rows.slice(0, opened)) expect(r.pop).toBe(0);
    // Arrivals, month by month: none before it opens, never more than the citywide pace allows.
    const months = g.clock?.growth?.months ?? [];
    expect(months.filter((m) => m.year < opened).every((m) => m.people === 0 && m.arrived === 0)).toBe(true);
    expect(months.every((m) => m.arrived <= POPULATION.arrivalsPerYear.value / 12 + 1e-9)).toBe(true);
    expect(months.filter((m) => m.year === opened + 1).reduce((t, m) => t + m.arrived, 0)).toBeCloseTo(POPULATION.arrivalsPerYear.value, 6);
    // Every month built in order says what holds the neighborhoods back; once open, nothing does.
    expect(g.clock?.growth?.months.every((m) => Array.isArray(m.heldBack))).toBe(true);
    expect(g.clock?.growth?.months.filter((m) => m.year > opened).every((m) => m.heldBack?.length === 0)).toBe(true);
    expect(rows[RULES.years]?.pop).toBe(6 * RATES.hood);
  });

  it('without inOrder the same orders fill the homes at year 2, as the sketch does, and say nothing of who waits', () => {
    const g = run(founding({}));
    expect(recordOf(g)[2]?.pop).toBe(6 * RATES.hood);
    expect(recordOf(g).some((r) => 'heldBack' in r)).toBe(false);
    expect(g.clock && 'lived' in g.clock).toBe(false);
  });
});

describe('each neighborhood on its own', () => {
  /** The ledger's city with three more neighborhoods: 65,000 homes, plant units for 60,000. */
  function thirteen(): Layout {
    let l = starterLayout();
    for (const k of ['2,0', '-3,0', '0,2']) {
      const o = placeNeighborhood(l, k, RATES);
      if (!o.ok) throw new Error(o.rejection.reason);
      l = o.layout;
    }
    return l;
  }

  it('standing when the run starts, they are admitted in tile order until the plants are full; the last waits', () => {
    const g = startRun(thirteen(), 7, RATES, RULES, { inOrder: true });
    const lived = g.clock?.lived ?? {};
    expect(Object.keys(lived)).toHaveLength(12);
    expect(lived['0,2']).toBeUndefined();
    const row = recordOf(g)[0];
    expect(row?.pop).toBe(60000);
    expect(row?.heldBack).toEqual([{ hood: '0,2', short: ['water', 'sewage', 'waste'], seats: ['high'] }]);
    // The order is the board's: the last tile waits, whichever was placed last.
    const order = allTiles(RATES.outline).filter((k) => thirteen().tiles[k]?.kind === 'hood');
    expect(order[order.length - 1]).toBe('0,2');
  });

  it('admitting never takes anyone out: a neighborhood lived in stays so when the city can no longer carry it', () => {
    const before = admit(starterLayout(), {}, RATES, { people: 0, children: 0 });
    expect(Object.values(before.lived).every((r) => r === 'all')).toBe(true);
    const squeezed = admit(starterLayout(), before.lived, RATES, { people: 0.3, children: 0 });
    expect(squeezed.lived).toEqual(before.lived);
    expect(squeezed.held).toEqual([]);
  });

  it('a neighborhood taken down drops out of who lives where', () => {
    const before = admit(starterLayout(), {}, RATES, { people: 0, children: 0 });
    const o = erase(starterLayout(), '1,0', RATES);
    if (!o.ok) throw new Error(o.rejection.reason);
    const after = admit(o.layout, before.lived, RATES, { people: 0, children: 0 });
    expect(after.lived['1,0']).toBeUndefined();
    expect(Object.keys(after.lived)).toHaveLength(Object.keys(before.lived).length - 1);
  });
});

describe('the month clock built in order', () => {
  /** The ledger's city and one more neighborhood three steps out, no school within its walk: 55,000 homes. */
  function oneMore(): Layout {
    const o = placeNeighborhood(starterLayout(), '0,-3', RATES);
    if (!o.ok) throw new Error(o.rejection.reason);
    return o.layout;
  }

  it('starts each standing neighborhood as full as it may be: everyone, the childless share, or nobody', () => {
    const g = startRun(oneMore(), 7, RATES, RULES, { inOrder: true, growth: true });
    expect(g.clock?.lived?.['0,-3']).toBe('childless');
    expect(g.clock?.growth?.occupied['1,0']).toBe(RATES.hood);
    expect(g.clock?.growth?.occupied['0,-3']).toBeCloseTo(RATES.hood * SHARE, 6);
    expect(recordOf(g)[0]?.pop).toBeCloseTo(50000 + RATES.hood * SHARE, 6);
    const t = startRun(starterLayout(), 7, RATES, RULES, { inOrder: true, growth: true });
    const thirteen = ['2,0', '-3,0', '0,2'].reduce((l, k) => {
      const o = placeNeighborhood(l, k, RATES);
      if (!o.ok) throw new Error(o.rejection.reason);
      return o.layout;
    }, starterLayout());
    const waiting = startRun(thirteen, 7, RATES, RULES, { inOrder: true, growth: true });
    expect(waiting.clock?.growth?.occupied['0,2']).toBe(0);
    expect(t.clock?.growth?.occupied['1,0']).toBe(RATES.hood);
  });

  it('held to the childless share, arrivals stop at that share in every neighborhood and no school line breaks', () => {
    const g = run(secondModule(founding({ inOrder: true, growth: true })));
    const months = g.clock?.growth?.months ?? [];
    expect(months.every((m) => m.people <= 6 * RATES.hood * SHARE + 1e-6)).toBe(true);
    expect(Math.max(...months.map((m) => m.people))).toBeCloseTo(6 * RATES.hood * SHARE, 0);
    for (const h of HOODS) expect(g.clock?.growth?.occupied[h] ?? 0).toBeLessThanOrEqual(RATES.hood * SHARE + 1e-6);
    const late = months.filter((m) => m.year >= 8);
    expect(late.every((m) => m.heldBack?.length === 6 && m.heldBack.every((x) => x.seats.join() === 'middle,high'))).toBe(true);
    expect(recordOf(g).every((r) => !r.broken.some((b) => b === 'elementary' || b === 'middle' || b === 'high'))).toBe(true);
  });

  it('a month asks again: a stored clock that forgot who lives where admits them on its next month', () => {
    const g = startRun(starterLayout(), 7, RATES, RULES, { inOrder: true, growth: true });
    const forgot = { ...(g.clock as Clock), lived: {} };
    const next = tickMonth({ layout: g.layout, clock: forgot }, RATES, RULES);
    expect(next.clock?.growth?.month).toBe(1);
    expect(Object.keys(next.clock?.lived ?? {})).toHaveLength(10);
    expect(Object.values(next.clock?.lived ?? {}).every((r) => r === 'all')).toBe(true);
  });
});

describe('a breakdown is an emergency (ADR-0012 Decision 7)', () => {
  /** Ten stretches nowhere near the city: class 0 work enough for every crew. */
  function tenStretches(g: Game): Game {
    let out = g;
    let laid = 0;
    for (const a of allTiles(RATES.outline)) {
      for (const b of allTiles(RATES.outline)) {
        if (laid >= RULES.crews || !adjacent(a, b, RATES.outline) || a >= b) continue;
        if (out.layout.lines[edgeKey(a, b)] || out.layout.tiles[a] || out.layout.tiles[b]) continue;
        const next = placeOrder(out, (p) => layStretch(p, a, b, RATES), RULES);
        if (next.ok) {
          out = next.game;
          laid++;
        }
      }
    }
    if (laid < RULES.crews) throw new Error(`only ${laid} stretches laid`);
    return out;
  }

  /** The ledger's city, everyone living there, its only water unit taken down. */
  function dry(): Game {
    const g = order(startRun(starterLayout(), 7, RATES, RULES, { inOrder: true }), (p) => erase(p, '3,-2', RATES));
    return tick(g, RATES, RULES);
  }

  it('nobody leaves: the line is broken and counts', () => {
    const g = dry();
    const row = recordOf(g)[1];
    expect(row?.pop).toBe(50000);
    expect(row?.broken).toContain('water');
    expect(g.clock?.lineYears).toBeGreaterThan(0);
    expect(emergencyOf(g.clock as Clock)).toEqual(['water']);
  });

  it('a water unit ordered behind ten stretches takes a crew ahead of them, and restores the water', () => {
    const g = order(tenStretches(dry()), (p) => addPlantUnit(p, '3,-2', 'water', RATES));
    const jobs = g.clock?.jobs ?? [];
    const water = jobs.findIndex((j) => j.what === 'water');
    const urgent = emergencyOf(g.clock as Clock);
    expect(crewed(jobs, RULES.crews, true, urgent)[water]).toBe(true);
    expect(crewed(jobs, RULES.crews, true)[water]).toBe(false);
    expect(inHand(g.layout, jobs, RULES, true, urgent).list[water]?.status).toBe('working');
    expect(inHand(g.layout, jobs, RULES, true, urgent).list.filter((j) => j.what === 'line' && j.status === 'waiting')).toHaveLength(1);
    let after = g;
    while (after.clock && after.layout.tiles['3,-2']?.kind !== 'water') after = tick(after, RATES, RULES);
    const row = recordOf(after)[recordOf(after).length - 1];
    expect(row?.broken).not.toContain('water');
    expect(emergencyOf(after.clock as Clock)).toEqual([]);
  });

  it('an order for the short kind starts now; off a clock built in order there is no emergency', () => {
    const out = placeOrder(tenStretches(dry()), (p) => addPlantUnit(p, '3,-2', 'water', RATES), RULES);
    expect(out.ok && out.events.map((e) => e.type === 'JobOrdered' && e.startsNow)).toEqual([true]);
    const sketch = startRun(starterLayout(), 7, RATES, RULES);
    const broken = { ...(sketch.clock as Clock), record: [{ ...(recordOf(sketch)[0] as RecordRow), broken: ['water' as const] }] };
    expect(emergencyOf(broken)).toEqual([]);
  });
});

describe('a stored run keeps who lives where', () => {
  it('restores who may live where and what held the rest back, dropping what the board cannot hold', () => {
    let g = secondModule(founding({ inOrder: true }));
    while (g.clock && g.clock.year < 8) g = tick(g, RATES, RULES);
    const stored = JSON.parse(JSON.stringify(g.clock)) as Record<string, unknown>;
    const back = restoreClock(stored, g.layout, RATES, RULES);
    expect(back?.lived).toEqual(g.clock?.lived);
    expect(back?.record.map((r) => r.heldBack)).toEqual(g.clock?.record.map((r) => r.heldBack));
    const bad = { ...stored, lived: { ...(stored['lived'] as object), '9,9': 'all', '0,0': 'all', '0,-1': 'some' } };
    const cleaned = restoreClock(bad, g.layout, RATES, RULES);
    expect(cleaned?.lived?.['9,9']).toBeUndefined();
    expect(cleaned?.lived?.['0,0']).toBeUndefined();
    expect(cleaned?.lived?.['0,-1']).toBeUndefined();
    expect(Object.keys(cleaned?.lived ?? {})).toHaveLength(5);
  });

  it('drops held-back entries the board cannot hold: an unknown tile, a non-entry, an unknown service or school', () => {
    let g = secondModule(founding({ inOrder: true }));
    while (g.clock && g.clock.year < 8) g = tick(g, RATES, RULES);
    const stored = JSON.parse(JSON.stringify(g.clock)) as { record: Record<string, unknown>[] };
    const rows = stored.record.map((r, i) =>
      i === 8 ? { ...r, heldBack: [{ hood: '9,9', short: [], seats: [] }, 'x', { hood: '0,-1', short: ['bogus', 'power'], seats: ['nope'] }] } : r,
    );
    const back = restoreClock({ ...stored, record: rows }, g.layout, RATES, RULES);
    expect(back?.record[8]?.heldBack).toEqual([{ hood: '0,-1', short: ['power'], seats: [] }]);
  });

  it('a month clock built in order carries on from storage, still filling only what was admitted', () => {
    // Year 8: everyone admitted, the homes still filling at the pace.
    let g = withSchools(founding({ inOrder: true, growth: true }));
    while (g.clock && g.clock.year < 8) g = tick(g, RATES, RULES);
    const people = g.clock?.growth?.months.at(-1)?.people ?? 0;
    expect(people).toBeGreaterThan(0);
    expect(people).toBeLessThan(6 * RATES.hood);
    const back = restoreClock(JSON.parse(JSON.stringify(g.clock)), g.layout, RATES, RULES);
    const resumed = tickMonth({ layout: g.layout, clock: back }, RATES, RULES);
    const live = tickMonth(g, RATES, RULES);
    expect(resumed.clock?.growth?.occupied).toEqual(live.clock?.growth?.occupied);
    expect(resumed.clock?.growth?.months.at(-1)?.arrived).toBeGreaterThan(0);
    expect(resumed.clock?.lived).toEqual(live.clock?.lived);
    expect(back?.growth?.months.map((m) => m.heldBack)).toEqual(g.clock?.growth?.months.map((m) => m.heldBack));
  });
});
