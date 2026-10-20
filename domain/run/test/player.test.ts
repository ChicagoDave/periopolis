/**
 * @file The player beside the run (ADR-0015 Decision 5 and 6, Phase 3): a piece the run built and the player takes
 * down is vetoed and not built again there; the player's own pieces taken down are not; an order onto a tile the run
 * holds is refused with the Site's reason; putting an inferred job first moves it within its class; a lived-in city
 * left short of water has a water unit ordered by the run that month and crewed ahead of everything; and a run that
 * orders for itself pays exactly what the same orders cost placed by hand, month for month.
 * Owner context: Run (domain), tests.
 */
import { describe, expect, it } from 'vitest';
import { LAYERS, RATES, addPlantUnit, addRingBuilding, allTiles, edgeEnds, emptyLayout, erase, layStretch, placeNeighborhood, starterLayout, toggleExtra } from '@city/site';
import type { ExtraKind, Layout, Outcome, PlantKind } from '@city/site';
import { RULES, classOf, emergencyOf, inHand, pieceId, placeOrder, putFirst, restoreClock, startRun, tick, tickMonth, totalSpend } from '../src/index.ts';
import type { Game, OrderEvent, OrderOutcome, PieceKind } from '../src/index.ts';

const GROW = { growth: true, inOrder: true, infer: true } as const;
const HAND = { growth: true, inOrder: true } as const;

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

const ids = (g: Game): string[] => (g.clock?.jobs ?? []).map((j) => pieceId(j.what, j.at));

describe('the take-down veto', () => {
  // A run from one neighborhood: by the end of year 5 the run's ring, plants, schools, fields and line stand (the
  // line to the shore's plants is four stretches longer since ADR-0016, so the fields wait a year or two more).
  const g3 = months(startRun(oneHood(), 7, RATES, RULES, GROW), 60);
  const built = g3.clock?.built ?? [];

  it('remembers what the run built once it stands', () => {
    expect(built.length).toBeGreaterThan(5);
    expect(built).toContain('ring@0,-1');
    for (const id of built) {
      const at = id.slice(id.indexOf('@') + 1);
      const kind = id.slice(0, id.indexOf('@'));
      if (kind === 'line') expect(g3.layout.lines[at]).toBe(true);
      else expect(g3.layout.tiles[at]).toBeDefined();
    }
  });

  it('the player taking down a piece the run built vetoes it, and the run does not build it there again', () => {
    const fields = built.find((id) => id.startsWith('fields@'));
    if (!fields) throw new Error('the run built fields');
    const at = fields.slice('fields@'.length);
    const g = order(g3, (p) => toggleExtra(p, at, 'fields', RATES));
    expect(g.layout.tiles[at]).toMatchObject({ kind: 'hood' });
    expect((g.layout.tiles[at] as { has: Record<string, true> }).has['fields']).toBeUndefined();
    expect(g.clock?.vetoes).toContain(fields);
    expect(g.clock?.built).not.toContain(fields);
    expect(g3.clock?.built).toContain(fields);
    expect(g3.clock?.vetoes).toBeUndefined();
    const later = months(g, 6);
    expect(ids(later)).not.toContain(fields);
    expect(later.clock?.vetoes).toContain(fields);
  });

  it('the player taking down their own piece remembers nothing, and the run orders the need again', () => {
    let g = months(startRun(starterLayout(), 7, RATES, RULES, GROW), 1);
    const water = allTiles(RATES.outline).find((k) => g.layout.tiles[k]?.kind === 'water');
    if (!water) throw new Error('the starter has water');
    g = order(g, (p) => erase(p, water, RATES));
    expect(g.clock?.vetoes).toBeUndefined();
    g = months(g, 1);
    expect(g.clock?.jobs.filter((j) => j.what === 'water' && j.inferred).length).toBeGreaterThanOrEqual(1);
  });
});

describe('what the run built, stored and read back', () => {
  it('restores built, drops what is not a piece of the board, and still vetoes a later take-down', () => {
    const g = months(startRun(oneHood(), 7, RATES, RULES, GROW), 36);
    expect(g.clock?.built?.length).toBeGreaterThan(5);
    const stored = JSON.parse(JSON.stringify(g.clock));
    const back = restoreClock(stored, g.layout, RATES, RULES);
    expect(back?.built).toEqual(g.clock?.built);
    const tampered = restoreClock({ ...stored, built: ['ring@0,-1', 'nothing@9,9', 'line@0,0|0,1', 7] }, g.layout, RATES, RULES);
    expect(tampered?.built).toEqual(['ring@0,-1', 'line@0,0|0,1']);
    const water = (back?.built ?? []).find((id) => id.startsWith('water@')) ?? '';
    const restored: Game = { layout: g.layout, clock: back };
    const taken = order(restored, (p) => erase(p, water.slice('water@'.length), RATES));
    expect(taken.clock?.vetoes).toContain(water);
    expect(taken.clock?.built).not.toContain(water);
    // A player's order that cancels one of the run's jobs is a veto too: the second ring building is still in hand.
    expect(g.clock?.jobs.some((j) => j.what === 'ring' && j.inferred)).toBe(true);
    const cancelled = order(restored, (p) => erase(p, '0,-1', RATES));
    expect(cancelled.clock?.vetoes).toContain('ring@0,-1');
    expect(cancelled.clock?.jobs.some((j) => j.what === 'ring')).toBe(false);
    expect(cancelled.layout.tiles['0,-1']).toEqual(g.layout.tiles['0,-1']);
  });
});

describe('orders and the work in hand', () => {
  it('one order adding several modules to a new reactor brings one site; onto a standing reactor, none', () => {
    const g0 = startRun(oneHood(), 7, RATES, RULES, HAND);
    const three = order(g0, (p) => {
      let l = p;
      for (let i = 0; i < 3; i++) {
        const o = addPlantUnit(l, '0,-4', 'power', RATES);
        if (!o.ok) return o;
        l = o.layout;
      }
      return addPlantUnit(p, '0,-4', 'power', RATES).ok ? { ok: true, layout: l, event: { type: 'PlantUnitAdded', tile: '0,-4', plant: 'power', units: 3 } } : addPlantUnit(p, '0,-4', 'power', RATES);
    });
    expect(three.clock?.jobs.map((j) => j.total)).toEqual([RULES.firstModule, RULES.build.power, RULES.build.power]);
    expect(three.clock?.jobs.map((j) => j.left)).toEqual([RULES.firstModule, RULES.build.power, RULES.build.power]);
    let standing = g0.layout;
    const site = addPlantUnit(standing, '0,-4', 'power', RATES);
    if (!site.ok) throw new Error('refused');
    standing = site.layout;
    const g1 = startRun(standing, 7, RATES, RULES, HAND);
    const two = order(g1, (p) => {
      const first = addPlantUnit(p, '0,-4', 'power', RATES);
      if (!first.ok) return first;
      return addPlantUnit(first.layout, '0,-4', 'power', RATES);
    });
    expect(two.clock?.jobs.map((j) => j.total)).toEqual([RULES.build.power, RULES.build.power]);
  });

  it('an order onto a tile the run holds is refused with the Site\'s reason, and the game is unchanged', () => {
    const g1 = months(startRun(oneHood(), 7, RATES, RULES, GROW), 1);
    const hood = g1.clock?.jobs.find((j) => j.what === 'hood');
    if (!hood) throw new Error('a neighborhood is in hand');
    const out = placeOrder(g1, (p) => addRingBuilding(p, hood.at, RATES), RULES);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.rejection).toEqual({ reason: 'TileTaken', tile: hood.at, by: 'hood' });
    expect(ids(g1)).toContain(pieceId('hood', hood.at));
  });

  it('putting an inferred job first puts it first within its class and keeps it the run\'s', () => {
    const g1 = months(startRun(oneHood(), 7, RATES, RULES, GROW), 1);
    const jobs = g1.clock?.jobs ?? [];
    const index = jobs.findIndex((j) => j.what === 'hood');
    const moved = putFirst(jobs, index);
    expect(moved[0]).toEqual(jobs[index]);
    expect(moved[0]?.inferred).toBe(true);
    const work = inHand(g1.layout, moved, RULES, true, []);
    expect(work.list[0]?.inferred).toBe(true);
    expect(work.list.every((j) => j.inferred === true)).toBe(true);
    const firstHood = work.list.find((j) => j.what === 'hood');
    const lines = work.list.filter((j) => j.what === 'line');
    expect(firstHood?.index).toBe(0);
    expect(classOf('hood')).toBeGreaterThan(classOf('line'));
    expect(lines.some((l) => l.status === 'working')).toBe(true);
    expect(work.working).toBe(RULES.crews);
    expect(firstHood?.status).toBe('waiting');
  });
});

describe('an emergency', () => {
  it('a lived-in city left short of water has a water unit ordered that month, crewed ahead of everything', () => {
    let g = months(startRun(starterLayout(), 7, RATES, RULES, GROW), 1);
    expect(g.clock?.record[0]?.pop).toBeGreaterThan(40000);
    const water = allTiles(RATES.outline).find((k) => g.layout.tiles[k]?.kind === 'water');
    if (!water) throw new Error('the starter has water');
    // Take the plant down unit by unit until the city is short; the player's own pieces, so nothing is vetoed.
    for (let i = 0; i < 6 && g.layout.tiles[water]; i++) g = order(g, (p) => erase(p, water, RATES));
    expect(g.layout.tiles[water]).toBeUndefined();
    g = months(g, 1);
    const units = (g.clock?.jobs ?? []).filter((j) => j.what === 'water');
    expect(units.length).toBeGreaterThanOrEqual(1);
    expect(units.every((j) => j.inferred === true)).toBe(true);
    // The emergency class is read off the year's record (ADR-0012 Decision 7): from the year's end the unit is first.
    g = months(g, 10);
    expect(g.clock?.record[g.clock.record.length - 1]?.broken).toContain('water');
    expect(emergencyOf(g.clock!)).toContain('water');
    const work = inHand(g.layout, g.clock?.jobs ?? [], RULES, true, emergencyOf(g.clock!));
    const waterJobs = work.list.filter((j) => j.what === 'water');
    expect(waterJobs.length).toBeGreaterThanOrEqual(1);
    expect(waterJobs.every((j) => j.status === 'working' || j.status === 'ready')).toBe(true);
    const g2 = months(g, 24);
    expect(g2.layout.tiles[water] ?? Object.values(g2.layout.tiles).find((t) => t.kind === 'water')).toBeDefined();
    expect(g2.clock?.record[g2.clock.record.length - 1]?.broken).not.toContain('water');
  });
});

describe('the same orders placed by hand', () => {
  /** Replay one of the run's orders as the player's command. */
  function command(e: OrderEvent): (plan: Layout) => Outcome {
    const what: PieceKind = e.what;
    const at = e.at;
    if (what === 'hood') return (p) => placeNeighborhood(p, at, RATES);
    if (what === 'ring') return (p) => addRingBuilding(p, at, RATES);
    if (what === 'line') {
      const [a, b] = edgeEnds(at);
      return (p) => layStretch(p, a, b, RATES);
    }
    if (what === 'elementary' || what === 'middle' || what === 'high' || what === 'fields') return (p) => toggleExtra(p, at, what as ExtraKind, RATES);
    return (p) => addPlantUnit(p, at, what as PlantKind, RATES);
  }

  it('builds the same city and spends the same money, month for month, as the run that inferred them', () => {
    let a = startRun(oneHood(), 42, RATES, RULES, GROW);
    let b = startRun(oneHood(), 42, RATES, RULES, HAND);
    let placed = 0;
    for (let m = 0; m < 240; m++) {
      a = tickMonth(a, RATES, RULES);
      b = tickMonth(b, RATES, RULES);
      const rows = a.clock?.growth?.months ?? [];
      const row = rows[rows.length - 1];
      for (const f of row?.inferred ?? []) {
        if (f.type !== 'InferredOrder') continue;
        for (const e of f.events) {
          if (e.type !== 'JobOrdered') continue;
          b = order(b, command(e));
          placed++;
        }
      }
      expect(b.clock?.jobs.map((j) => ({ what: j.what, at: j.at, left: j.left, total: j.total }))).toEqual(a.clock?.jobs.map((j) => ({ what: j.what, at: j.at, left: j.left, total: j.total })));
    }
    expect(placed).toBeGreaterThan(30);
    expect(b.layout).toEqual(a.layout);
    expect(b.clock?.growth?.occupied).toEqual(a.clock?.growth?.occupied);
    const sa = totalSpend(a.clock?.record ?? []);
    const sb = totalSpend(b.clock?.record ?? []);
    for (const layer of LAYERS) expect(sb.byLayer[layer]).toBeCloseTo(sa.byLayer[layer], 6);
    expect(sb.total).toBeCloseTo(sa.total, 6);
    expect(b.clock?.jobs.every((j) => j.inferred === undefined)).toBe(true);
    expect(a.clock?.jobs.every((j) => j.inferred === true)).toBe(true);
    expect(tick(b, RATES, RULES)).toBe(b);
  });
});
