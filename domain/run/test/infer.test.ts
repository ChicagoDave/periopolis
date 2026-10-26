/**
 * @file The run orders for itself (ADR-0015, `infer`), on the real Ledger and Site: one neighborhood on an empty site
 * gets its ring, plants, schools, fields and line and the next neighborhoods in its first month with nothing placed by
 * hand; the homes signal orders one neighborhood a month while homes run short of the lead, nearest the ring; a need
 * the player already ordered is not ordered again; a cancelled inferred job is vetoed and never re-ordered until the
 * player orders it; a player's own piece taken down is re-ordered; a board with no room says so; `infer` needs growth
 * and in order; a run without it is untouched; a stored run reads back with its vetoes and facts; twenty years from
 * one neighborhood grow a city whose spend adds up.
 * Owner context: Run (domain), tests.
 */
import { describe, expect, it } from 'vitest';
import { LAYERS, POPULATION, RATES, addPlantUnit, allTiles, emptyLayout, erase, kindOf, placeNeighborhood, proposeFor, shoreTiles, starterLayout } from '@city/site';
import type { Layout, Outcome, TileKey } from '@city/site';
import { RULES, cancelOrder, homesAhead, inferStep, pieceId, planned, placeOrder, restoreClock, startRun, tick, tickMonth, totalSpend } from '../src/index.ts';
import type { Game, Inferred, Job, MonthRow, OrderOutcome } from '../src/index.ts';

const GROW = { growth: true, inOrder: true, infer: true } as const;

function must(out: OrderOutcome): Game {
  if (!out.ok) throw new Error(`refused: ${out.rejection.reason}`);
  return out.game;
}

const order = (game: Game, command: (plan: Layout) => Outcome): Game => must(placeOrder(game, command, RULES));

function oneHood(): Layout {
  const o = placeNeighborhood(emptyLayout(), '0,0', RATES);
  if (!o.ok) throw new Error('refused');
  return o.layout;
}

function months(game: Game, n: number): Game {
  let g = game;
  for (let i = 0; i < n; i++) g = tickMonth(g, RATES, RULES);
  return g;
}

const lastMonth = (g: Game): MonthRow => {
  const rows = g.clock?.growth?.months ?? [];
  const row = rows[rows.length - 1];
  if (!row) throw new Error('no month yet');
  return row;
};

const jobs = (g: Game): readonly Job[] => g.clock?.jobs ?? [];
const ids = (list: readonly Job[]): string[] => list.map((j) => pieceId(j.what, j.at));
const orders = (facts: readonly Inferred[] | undefined): string[] =>
  (facts ?? []).flatMap((f) => (f.type === 'InferredOrder' ? f.events.map((e) => pieceId(e.what, e.at)) : []));

const LEAD = (RULES.lead * POPULATION.demandPerYear.value) / 12;

describe('the first month on one neighborhood', () => {
  const g0 = startRun(oneHood(), 7, RATES, RULES, GROW);
  const g1 = months(g0, 1);

  it('orders every proposal the Site makes, marked as the run\'s, with nothing placed by hand', () => {
    const proposed = proposeFor(oneHood(), RATES).flatMap((p) => (p.room ? p.steps : []));
    expect(proposed.length).toBeGreaterThan(5);
    const inHand = ids(jobs(g1));
    expect(inHand).toContain('ring@0,-1');
    expect(inHand.filter((id) => id === 'power@0,4')).toHaveLength(2); // the shore's downstream end (ADR-0016 Decision 5)
    for (const plant of ['water', 'sewage', 'waste']) expect(inHand.some((id) => id.startsWith(`${plant}@`))).toBe(true);
    for (const x of ['elementary', 'middle', 'high', 'fields']) expect(inHand).toContain(`${x}@0,0`);
    expect(inHand.filter((id) => id.startsWith('line@')).length).toBeGreaterThanOrEqual(1);
    expect(jobs(g1).every((j) => j.inferred === true)).toBe(true);
    expect(jobs(g0)).toEqual([]);
  });

  it('records each order on the month with the need it answers, and the input game is unchanged', () => {
    const facts = lastMonth(g1).inferred ?? [];
    const whys = facts.filter((f) => f.type === 'InferredOrder').map((f) => f.why);
    for (const why of ['ring', 'modules', 'plantUnits', 'schools', 'fields', 'homes']) expect(whys).toContain(why);
    // The plants' orders carry the line that joins them (ADR-0019), and here it reaches the neighborhood's stop too,
    // so no order is left for the line alone.
    expect(whys).not.toContain('line');
    expect(ids(jobs(g1)).some((id) => id.startsWith('line@'))).toBe(true);
    expect(orders(facts).sort()).toEqual(ids(jobs(g1)).sort());
    expect(facts.some((f) => f.type === 'NoRoom')).toBe(false);
    expect(g0.clock?.jobs).toEqual([]);
    expect(g0.clock?.growth?.months).toEqual([]);
  });

  it('orders one neighborhood a month, nearest the ring, while the homes ahead are below the lead', () => {
    const hoodsOf = (g: Game): string[] => ids(jobs(g)).filter((id) => id.startsWith('hood@'));
    expect(hoodsOf(g1)).toHaveLength(1);
    expect(lastMonth(g1).inferred?.filter((f) => f.type === 'InferredOrder' && f.why === 'homes')).toHaveLength(1);
    expect(homesAhead(g1, RATES)).toBeLessThan(LEAD);
    // At 30 months of 30,000 a year the lead is 75,000 homes: three months order three neighborhoods, still short of it.
    const g3 = months(g1, 2);
    expect(hoodsOf(g3)).toHaveLength(3);
    expect(homesAhead(g3, RATES)).toBeLessThan(LEAD);
  });

  it('stops ordering neighborhoods once the homes ahead reach the lead', () => {
    // A lead of 5 months of demand is 12,500 homes: the empty lone neighborhood and one in hand fall short, two reach it.
    const short = { ...RULES, lead: 5 };
    const lead = (short.lead * POPULATION.demandPerYear.value) / 12;
    const step = (g: Game, n: number): Game => {
      let at = g;
      for (let i = 0; i < n; i++) at = tickMonth(at, RATES, short);
      return at;
    };
    const hoodsOf = (g: Game): string[] => ids(jobs(g)).filter((id) => id.startsWith('hood@'));
    const s1 = step(startRun(oneHood(), 7, RATES, short, GROW), 1);
    expect(hoodsOf(s1)).toHaveLength(1);
    expect(homesAhead(s1, RATES)).toBeLessThan(lead);
    const s2 = step(s1, 1);
    expect(hoodsOf(s2)).toHaveLength(2);
    const g3 = step(s2, 1);
    expect(hoodsOf(g3)).toHaveLength(2);
    expect(homesAhead(g3, RATES)).toBeGreaterThanOrEqual(lead);
    // Each new neighborhood is next to the ring at 0,-1, where the Site put it.
    const plan = planned(g3.layout, g3.clock?.jobs ?? []);
    const ring = Object.keys(plan.tiles).find((k) => plan.tiles[k]?.kind === 'ring');
    expect(ring).toBe('0,-1');
    for (const id of hoodsOf(g3)) {
      const at = id.slice('hood@'.length);
      const [q, r] = at.split(',').map(Number);
      expect(Math.max(Math.abs(q ?? 0), Math.abs((r ?? 0) + 1), Math.abs((q ?? 0) + (r ?? 0) + 1))).toBe(1);
    }
  });
});

describe('from an empty site', () => {
  it('the first month orders the first neighborhood beside the middle, kept for the ring, and the needs follow it with the ring in the middle (ADR-0016)', () => {
    const g1 = months(startRun(emptyLayout(), 3, RATES, RULES, GROW), 1);
    expect(ids(jobs(g1))).toEqual(['hood@0,-1']);
    expect(lastMonth(g1).inferred).toEqual([{ type: 'InferredOrder', why: 'homes', events: [expect.objectContaining({ type: 'JobOrdered', what: 'hood', at: '0,-1' })] }]);
    const g2 = months(g1, 1);
    expect(ids(jobs(g2))).toContain('ring@0,0');
    expect(ids(jobs(g2)).filter((id) => id.startsWith('hood@'))).toHaveLength(2);
  });
});

describe('the player beside the run', () => {
  it('orders nothing for a need the player has already ordered', () => {
    let g = startRun(oneHood(), 7, RATES, RULES, GROW);
    g = order(g, (p) => addPlantUnit(p, '-4,4', 'water', RATES));
    g = months(g, 1);
    const water = ids(jobs(g)).filter((id) => id.startsWith('water@'));
    expect(water).toEqual(['water@-4,4']);
    expect(jobs(g).find((j) => j.what === 'water')?.inferred).toBeUndefined();
  });

  it('a cancelled inferred job is vetoed and never re-ordered; the player ordering it lifts the veto', () => {
    const g1 = months(startRun(oneHood(), 7, RATES, RULES, GROW), 1);
    const index = jobs(g1).findIndex((j) => j.what === 'water');
    expect(index).toBeGreaterThanOrEqual(0);
    const at = jobs(g1)[index]?.at ?? '';
    const vetoed: Game = { layout: g1.layout, clock: cancelOrder(g1.clock!, index) };
    expect(vetoed.clock?.vetoes).toEqual([pieceId('water', at)]);
    expect(jobs(vetoed).some((j) => j.what === 'water')).toBe(false);
    // The veto is of the piece, kind and place (ADR-0015 Decision 5): told of it, the Site proposes water elsewhere
    // on the shore, and the run orders it there (ADR-0016 Phase 4).
    const later = months(vetoed, 6);
    expect(ids(jobs(later))).not.toContain(pieceId('water', at));
    const elsewhere = ids(jobs(later)).concat(later.clock?.built ?? []).filter((id) => id.startsWith('water@'));
    expect(elsewhere).toHaveLength(1);
    expect(elsewhere[0]).not.toBe(pieceId('water', at));
    const there = (elsewhere[0] ?? '').slice('water@'.length);
    expect(shoreTiles('0,0', RATES.outline)).toContain(there);
    expect(later.layout.tiles[at]).toBeUndefined();
    const said = (later.clock?.growth?.months ?? []).flatMap((m) => m.inferred ?? []).filter((f) => f.type === 'InferredOrder' && f.events.some((e) => e.type === 'JobOrdered' && e.what === 'water'));
    expect(said.some((f) => f.type === 'InferredOrder' && f.events.some((e) => e.type === 'JobOrdered' && e.at === there))).toBe(true);
    expect(later.clock?.vetoes).toEqual([pieceId('water', at)]);
    const mine = order(later, (p) => addPlantUnit(p, at, 'water', RATES));
    expect(mine.clock?.vetoes).toEqual([]);
    expect(jobs(mine).find((j) => j.what === 'water' && j.at === at)?.inferred).toBeUndefined();
  });

  it('cancelling the player\'s own job remembers nothing, and the run orders the need again', () => {
    let g = startRun(oneHood(), 7, RATES, RULES, GROW);
    g = order(g, (p) => addPlantUnit(p, '-4,4', 'water', RATES));
    g = months(g, 1);
    const index = jobs(g).findIndex((j) => j.what === 'water');
    g = { layout: g.layout, clock: cancelOrder(g.clock!, index) };
    expect(g.clock?.vetoes).toBeUndefined();
    g = months(g, 1);
    expect(jobs(g).filter((j) => j.what === 'water')).toHaveLength(1);
    expect(jobs(g).find((j) => j.what === 'water')?.inferred).toBe(true);
  });

  it('a player\'s own standing unit taken down is ordered again the next month', () => {
    let g = startRun(starterLayout(), 7, RATES, RULES, GROW);
    const water = allTiles(RATES.outline).find((k) => g.layout.tiles[k]?.kind === 'water');
    if (!water) throw new Error('the starter has water');
    const before = g.layout.tiles[water];
    const n = before && before.kind === 'water' ? before.n : 0;
    g = months(g, 1);
    expect(jobs(g).some((j) => j.what === 'water')).toBe(false);
    g = order(g, (p) => erase(p, water, RATES));
    g = months(g, 1);
    const reordered = jobs(g).filter((j) => j.what === 'water');
    expect(reordered.length).toBeGreaterThanOrEqual(1);
    expect(reordered.every((j) => j.inferred === true)).toBe(true);
    expect(n).toBeGreaterThan(0);
  });
});

describe('vetoes and the homes ahead', () => {
  it('a vetoed neighborhood is never ordered on that tile again, and the run goes on ordering elsewhere', () => {
    const g1 = months(startRun(oneHood(), 7, RATES, RULES, GROW), 1);
    const index = jobs(g1).findIndex((j) => j.what === 'hood');
    const tile = jobs(g1)[index]?.at ?? '';
    const vetoed: Game = { layout: g1.layout, clock: cancelOrder(g1.clock!, index) };
    expect(vetoed.clock?.vetoes).toEqual([pieceId('hood', tile)]);
    const later = months(vetoed, 4);
    expect(ids(jobs(later))).not.toContain(pieceId('hood', tile));
    expect(ids(jobs(later)).filter((id) => id.startsWith('hood@')).length).toBeGreaterThanOrEqual(2);
    expect(later.layout.tiles[tile]).toBeUndefined();
  });

  it('cancelOrder leaves its input alone, names nothing twice, and remembers nothing without infer or off the list', () => {
    const g1 = months(startRun(oneHood(), 7, RATES, RULES, GROW), 1);
    const clock = g1.clock!;
    const before = JSON.stringify(clock);
    const index = jobs(g1).findIndex((j) => j.what === 'waste');
    const once = cancelOrder(clock, index);
    expect(JSON.stringify(clock)).toBe(before);
    expect(once.jobs).toHaveLength(clock.jobs.length - 1);
    expect(cancelOrder(clock, 99)).toBe(clock);
    const again: Game = { layout: g1.layout, clock: { ...once, jobs: [...once.jobs, { what: 'waste', at: jobs(g1)[index]?.at ?? '', left: 2, total: 2, inferred: true }] } };
    const twice = cancelOrder(again.clock!, again.clock!.jobs.length - 1);
    expect(twice.vetoes).toEqual(once.vetoes);
    const plain = months(startRun(oneHood(), 7, RATES, RULES, { growth: true, inOrder: true }), 1);
    const own = order(plain, (p) => addPlantUnit(p, '-4,4', 'water', RATES));
    expect(cancelOrder(own.clock!, 0).vetoes).toBeUndefined();
    const { infer: _off, ...noInfer } = clock;
    expect(cancelOrder(noInfer, index).vetoes).toBeUndefined();
  });

  it('the run\'s own order leaves a veto in place; only the player\'s lifts it', () => {
    const g1 = months(startRun(oneHood(), 7, RATES, RULES, GROW), 1);
    const index = jobs(g1).findIndex((j) => j.what === 'elementary');
    const at = jobs(g1)[index]?.at ?? '';
    const vetoed = cancelOrder(g1.clock!, index);
    const g: Game = { layout: g1.layout, clock: vetoed };
    const later = months(g, 3);
    expect(later.clock?.vetoes).toEqual([pieceId('elementary', at)]);
    expect(ids(jobs(later))).not.toContain(pieceId('elementary', at));
  });

  it('homesAhead is the homes standing or in hand less the people, zero on an empty site, and needs a clock', () => {
    const empty = startRun(emptyLayout(), 1, RATES, RULES, GROW);
    expect(homesAhead(empty, RATES)).toBe(0);
    const g = months(startRun(starterLayout(), 1, RATES, RULES, GROW), 2);
    const hoods = Object.keys(planned(g.layout, g.clock?.jobs ?? []).tiles).filter((k) => planned(g.layout, g.clock?.jobs ?? []).tiles[k]?.kind === 'hood').length;
    const people = Object.values(g.clock?.growth?.occupied ?? {}).reduce((t, n) => t + n, 0);
    expect(homesAhead(g, RATES)).toBeCloseTo(hoods * RATES.hood - people, 6);
    expect(() => homesAhead({ layout: g.layout, clock: null }, RATES)).toThrow();
  });

  it('says there is no room for homes when no tile is open and the next circle is closed; with it open, it opens the circle instead (ADR-0016)', () => {
    const tiles: Record<TileKey, { kind: 'hood'; has: Record<string, never> }> = {};
    for (const k of allTiles(RATES.outline)) tiles[k] = { kind: 'hood', has: {} };
    const everyTile = allTiles(RATES.outline).map((k) => pieceId('hood', k));
    const g0 = startRun(emptyLayout(), 1, RATES, RULES, GROW);
    const opens = months({ layout: g0.layout, clock: { ...g0.clock!, vetoes: everyTile } }, 1);
    expect(lastMonth(opens).inferred).toEqual([{ type: 'CircleOpened', middle: '9,0' }]);
    const g = months({ layout: g0.layout, clock: { ...g0.clock!, vetoes: [...everyTile, 'circle@9,0'] } }, 1);
    expect(lastMonth(g).inferred).toEqual([{ type: 'NoRoom', why: 'homes' }]);
    expect(jobs(g)).toEqual([]);
    expect(Object.keys(tiles)).toHaveLength(everyTile.length);
  });
});

describe('what the run cannot do', () => {
  it('says there is no room for a need the board cannot hold', () => {
    const tiles: Record<TileKey, { kind: 'hood'; has: Record<string, never> }> = {};
    for (const k of allTiles(RATES.outline)) tiles[k] = { kind: 'hood', has: {} };
    const full: Layout = { tiles, lines: {}, circles: ['0,0'] };
    const g = months(startRun(full, 1, RATES, RULES, GROW), 1);
    const facts = lastMonth(g).inferred ?? [];
    expect(facts.some((f) => f.type === 'NoRoom' && f.why === 'ring')).toBe(true);
    expect(jobs(g)).toEqual([]);
    // A board full of neighborhoods takes the run a while to find no room: past vitest's five seconds on the runner.
  }, 60000);

  it('refuses to start without growth and in order', () => {
    expect(() => startRun(oneHood(), 1, RATES, RULES, { infer: true })).toThrow();
    expect(() => startRun(oneHood(), 1, RATES, RULES, { infer: true, growth: true })).toThrow();
    expect(() => startRun(oneHood(), 1, RATES, RULES, { infer: true, inOrder: true })).toThrow();
    expect(startRun(oneHood(), 1, RATES, RULES, GROW).clock?.infer).toBe(true);
  });

  it('orders nothing at the horizon', () => {
    let g = startRun(oneHood(), 7, RATES, RULES, GROW);
    while (g.clock && g.clock.year < RULES.years) g = tick(g, RATES, RULES);
    const twentieth = (g.clock?.growth?.months ?? []).filter((m) => m.year === RULES.years);
    expect(twentieth).toHaveLength(12);
    expect(twentieth[11]?.inferred).toBeUndefined();
    expect(tickMonth(g, RATES, RULES)).toBe(g);
  });
});

describe('a run without infer', () => {
  it('is untouched: no flag, no facts, the same jobs and months as before this decision', () => {
    const g = months(startRun(oneHood(), 7, RATES, RULES, { growth: true, inOrder: true }), 14);
    expect(g.clock?.infer).toBeUndefined();
    expect(g.clock?.vetoes).toBeUndefined();
    expect(jobs(g)).toEqual([]);
    expect((g.clock?.growth?.months ?? []).every((m) => m.inferred === undefined)).toBe(true);
    expect(inferStep(g, RATES, RULES)).toEqual({ game: g, facts: [] });
  });
});

describe('a stored run', () => {
  it('reads back with its flag, its vetoes, its inferred jobs and its facts', () => {
    const g1 = months(startRun(oneHood(), 7, RATES, RULES, GROW), 1);
    const index = jobs(g1).findIndex((j) => j.what === 'sewage');
    const g = months({ layout: g1.layout, clock: cancelOrder(g1.clock!, index) }, 2);
    const stored = JSON.parse(JSON.stringify(g.clock));
    const back = restoreClock(stored, g.layout, RATES, RULES);
    expect(back?.infer).toBe(true);
    expect(back?.vetoes).toEqual(g.clock?.vetoes);
    expect(back?.jobs).toEqual(g.clock?.jobs);
    expect(back?.growth?.months).toEqual(g.clock?.growth?.months);
    const same = months({ layout: g.layout, clock: back }, 3);
    const live = months(g, 3);
    expect(same.clock?.jobs).toEqual(live.clock?.jobs);
  });

  it('restores without vetoes when none were stored, and without infer when stored without in order or growth', () => {
    const g = months(startRun(oneHood(), 7, RATES, RULES, GROW), 1);
    const stored = JSON.parse(JSON.stringify(g.clock));
    expect(restoreClock({ ...stored, vetoes: undefined }, g.layout, RATES, RULES)?.vetoes).toBeUndefined();
    expect(restoreClock({ ...stored, vetoes: ['hood@0,0', 'nothing@9,9', 'line@0,0|0,1', 7] }, g.layout, RATES, RULES)?.vetoes).toEqual(['hood@0,0', 'line@0,0|0,1']);
    expect(restoreClock({ ...stored, inOrder: undefined }, g.layout, RATES, RULES)?.infer).toBeUndefined();
    expect(restoreClock({ ...stored, growth: undefined }, g.layout, RATES, RULES)?.infer).toBeUndefined();
    const tampered = { ...stored, growth: { ...stored.growth, months: [{ ...stored.growth.months[0], inferred: [{ type: 'InferredOrder', why: 'ring', events: [{ type: 'JobOrdered', what: 'ring', at: '0,-1', total: 2 }] }, { type: 'NoRoom', why: 'nope' }, { type: 'InferredOrder', why: 'line', events: [{ type: 'JobOrdered', what: 'tower', at: '0,0', total: 1 }] }] }] } };
    const fixed = restoreClock(tampered, g.layout, RATES, RULES);
    expect(fixed?.growth?.months[0]?.inferred).toEqual([{ type: 'InferredOrder', why: 'ring', events: [{ type: 'JobOrdered', what: 'ring', at: '0,-1', total: 2, startsNow: false, withSite: false }] }]);
  });
});

describe('twenty years from one neighborhood', () => {
  let g = startRun(oneHood(), 42, RATES, RULES, GROW);
  while (g.clock && g.clock.year < RULES.years) g = tick(g, RATES, RULES);
  const record = g.clock?.record ?? [];
  const last = record[record.length - 1];

  it('grows a city of many neighborhoods, lived in, with no order from the player', () => {
    const hoods = Object.keys(g.layout.tiles).filter((k) => g.layout.tiles[k]?.kind === 'hood').length;
    expect(hoods).toBeGreaterThanOrEqual(10);
    expect(last?.pop).toBeGreaterThan(40000);
    expect(g.clock?.jobs.every((j) => j.inferred === true)).toBe(true);
    const everyJob = (g.clock?.growth?.months ?? []).flatMap((m) => orders(m.inferred));
    expect(everyJob.filter((id) => id.startsWith('hood@')).length).toBeGreaterThanOrEqual(hoods - 1);
  });

  it('never lets homes run far behind: every month the homes as built cover the people', () => {
    for (const m of g.clock?.growth?.months ?? []) expect(m.people).toBeLessThanOrEqual(m.homes + 1e-6);
  });

  it('spends what the same city costs: summed over layers equals summed over years, and the capital is what was built', () => {
    const sums = totalSpend(record);
    const overLayers = LAYERS.reduce((t, l) => t + sums.byLayer[l], 0);
    const overYears = sums.byYear.reduce((t, y) => t + y, 0);
    expect(overLayers).toBeCloseTo(overYears, 3);
    const first = record[0];
    if (!last || !first) throw new Error('no record');
    // The neighborhood standing at year 0 was paid before the clock started (ADR-0007 Decision 14).
    for (const layer of LAYERS) if (kindOf(layer) === 'capital') expect(sums.byLayer[layer]).toBeCloseTo(last.standing[layer] - first.standing[layer], 3);
  });
});
