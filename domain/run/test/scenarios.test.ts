/**
 * @file The plan's scenarios for the Run: the job mechanics, a school waiting on its homes and a module on its site,
 * the promise that a city holding all four stretch tests is never broken by a timeline, and a scripted founding.
 * Owner context: Run (domain), tests.
 */
import { describe, expect, it } from 'vitest';
import {
  RATES,
  addPlantUnit,
  addRingBuilding,
  allTiles,
  assess,
  bridges,
  edgeEnds,
  emptyLayout,
  layStretch,
  neighbors,
  placeNeighborhood,
  starterLayout,
  toggleExtra,
} from '@city/site';
import type { EdgeKey, ExtraKind, Layout, Outcome, TileKey } from '@city/site';
import { RULES, cancelJob, inHand, notices, placeOrder, planned, putFirst, startRun, stopRun, tick } from '../src/index.ts';
import type { Game, OrderOutcome } from '../src/index.ts';
import recorded from './fixtures/parity.json';

interface FoundingRecord {
  readonly seed: number;
  readonly react: boolean;
  readonly crewYears: number;
  readonly final: { state: Layout; clock: { lineYears: number; record: { year: number; pop: number; bad: number }[] } };
}

const foundings = (recorded as unknown as { founding: FoundingRecord[] }).founding;

function must(out: OrderOutcome): Game {
  if (!out.ok) throw new Error(`refused: ${out.rejection.reason}`);
  return out.game;
}

/** Order with a layout command, as the Board would. */
const order = (game: Game, command: (plan: Layout) => Outcome): Game => must(placeOrder(game, command, RULES));

function runOut(game: Game): Game {
  while (game.clock && game.clock.year < RULES.years) game = tick(game, RATES, RULES);
  return game;
}

describe('jobs and crews', () => {
  it('a run starts at year 0 with a year-0 row that does not count', () => {
    const g = startRun(emptyLayout(), 1, RATES, RULES);
    expect(g.clock?.year).toBe(0);
    expect(g.clock?.record.map((r) => r.year)).toEqual([0]);
    expect(g.clock?.lineYears).toBe(0);
  });

  it("a reactor's first module takes three years with its site; the second takes one", () => {
    let g = startRun(emptyLayout(), 1, RATES, RULES);
    const first = placeOrder(g, (plan) => addPlantUnit(plan, '3,-1', 'power', RATES), RULES);
    expect(first.ok && first.events).toEqual([{ type: 'JobOrdered', what: 'power', at: '3,-1', total: 3, startsNow: true, withSite: true }]);
    g = must(first);
    const second = placeOrder(g, (plan) => addPlantUnit(plan, '3,-1', 'power', RATES), RULES);
    expect(second.ok && second.events).toEqual([{ type: 'JobOrdered', what: 'power', at: '3,-1', total: 1, startsNow: true, withSite: false }]);
  });

  it('a school waits for its homes and a module for its site; the neighborhood opens with its school', () => {
    let g = startRun(emptyLayout(), 1, RATES, RULES);
    g = order(g, (p) => addPlantUnit(p, '3,-1', 'power', RATES));
    g = order(g, (p) => addPlantUnit(p, '3,-1', 'power', RATES));
    g = order(g, (p) => placeNeighborhood(p, '1,0', RATES));
    g = order(g, (p) => toggleExtra(p, '1,0', 'elementary', RATES));
    expect(Object.keys(g.layout.tiles)).toEqual([]);
    g = tick(g, RATES, RULES);
    const hand = inHand(g.layout, g.clock?.jobs ?? null, RULES);
    expect(hand.list.filter((j) => j.status === 'ready').map((j) => j.what)).toEqual(['power', 'elementary']);
    expect(g.layout.tiles['1,0']).toBeUndefined();
    g = tick(g, RATES, RULES);
    expect(g.layout.tiles['1,0']).toEqual({ kind: 'hood', has: { elementary: true } });
    expect(g.clock?.record[2]).toMatchObject({ year: 2, pop: 5000, opened: { hood: 1, elementary: 1 } });
    g = tick(g, RATES, RULES);
    expect(g.layout.tiles['3,-1']).toEqual({ kind: 'power', n: 2 });
    expect(g.clock?.jobs).toEqual([]);
    expect(g.clock?.lineYears).toBe(g.clock?.record.filter((r) => r.year > 0).reduce((t, r) => t + r.bad, 0));
  });

  it('twelve one-year jobs on ten crews: ten working, two waiting; putting one first gives it a crew', () => {
    let g = startRun(emptyLayout(), 1, RATES, RULES);
    const ring = ['1,0', '1,-1', '0,-1', '-1,0', '-1,1', '0,1'];
    for (const k of ring) g = order(g, (p) => layStretch(p, '0,0', k, RATES));
    for (let i = 0; i < 6; i++) g = order(g, (p) => layStretch(p, ring[i] ?? '', ring[(i + 1) % 6] ?? '', RATES));
    const hand = inHand(g.layout, g.clock?.jobs ?? null, RULES);
    expect(hand.working).toBe(10);
    expect(hand.waiting).toBe(2);
    const jobs = g.clock?.jobs ?? [];
    const lastAt = jobs[jobs.length - 1]?.at;
    const moved = putFirst(jobs, jobs.length - 1);
    expect(moved[0]?.at).toBe(lastAt);
    g = { layout: g.layout, clock: g.clock && { ...g.clock, jobs: moved } };
    const after = inHand(g.layout, g.clock?.jobs ?? null, RULES);
    expect(after.list[0]?.status).toBe('working');
    expect(after.list[10]?.status).toBe('waiting');
    g = tick(g, RATES, RULES);
    expect(Object.keys(g.layout.lines).length).toBe(10);
    expect(inHand(g.layout, g.clock?.jobs ?? null, RULES).working).toBe(2);
  });

  it('ordering a finished stretch again takes it down; ordering one in hand cancels it', () => {
    let g = startRun(emptyLayout(), 1, RATES, RULES);
    g = order(g, (p) => layStretch(p, '0,0', '1,0', RATES));
    g = order(g, (p) => layStretch(p, '0,0', '0,1', RATES));
    g = tick(g, RATES, RULES);
    const down = placeOrder(g, (p) => layStretch(p, '0,0', '1,0', RATES), RULES);
    expect(down.ok && down.events).toEqual([{ type: 'PieceTakenDown', what: 'line', at: '0,0|1,0' }]);
    g = startRun(emptyLayout(), 1, RATES, RULES);
    g = order(g, (p) => layStretch(p, '0,0', '1,0', RATES));
    const canceled = placeOrder(g, (p) => layStretch(p, '0,0', '1,0', RATES), RULES);
    expect(canceled.ok && canceled.events).toEqual([{ type: 'JobCanceled', what: 'line', at: '0,0|1,0' }]);
    expect(canceled.ok && canceled.game.clock?.jobs).toEqual([]);
  });

  it('canceling a reactor site drops its later module instead; canceling a neighborhood drops its schools', () => {
    let g = startRun(emptyLayout(), 1, RATES, RULES);
    g = order(g, (p) => placeNeighborhood(p, '2,0', RATES));
    g = order(g, (p) => toggleExtra(p, '2,0', 'elementary', RATES));
    g = order(g, (p) => toggleExtra(p, '2,0', 'high', RATES));
    g = order(g, (p) => addPlantUnit(p, '3,0', 'power', RATES));
    g = order(g, (p) => addPlantUnit(p, '3,0', 'power', RATES));
    let jobs = cancelJob(g.clock?.jobs ?? [], 3);
    expect(jobs.filter((j) => j.what === 'power')).toEqual([{ what: 'power', at: '3,0', left: 3, total: 3 }]);
    jobs = cancelJob(jobs, 0);
    expect(jobs).toEqual([{ what: 'power', at: '3,0', left: 3, total: 3 }]);
  });

  it('stopping the clock finishes the work in hand at once', () => {
    let g = startRun(emptyLayout(), 1, RATES, RULES);
    g = order(g, (p) => placeNeighborhood(p, '1,0', RATES));
    g = order(g, (p) => toggleExtra(p, '1,0', 'middle', RATES));
    const stopped = stopRun(g);
    expect(stopped.clock).toBeNull();
    expect(stopped.layout.tiles['1,0']).toEqual({ kind: 'hood', has: { middle: true } });
    expect(planned(g.layout, g.clock?.jobs ?? [])).toEqual(stopped.layout);
  });

  it('refuses nothing the layout allows, and passes on what it refuses', () => {
    const g = startRun(starterLayout(), 1, RATES, RULES);
    const refused = placeOrder(g, (p) => placeNeighborhood(p, '0,0', RATES), RULES);
    expect(refused).toEqual({ ok: false, rejection: { reason: 'TileTaken', tile: '0,0', by: 'ring' } });
  });
});

describe('the timeline', () => {
  it('deals five events in order: squeeze, closure, families, closure, slump, each announced ahead', () => {
    const g = startRun(emptyLayout(), 3, RATES, RULES);
    const events = g.clock?.events ?? [];
    expect(events.map((e) => e.type)).toEqual(['squeeze', 'closure', 'families', 'closure', 'slump']);
    expect(events.map((e) => e.notice)).toEqual([2, 1, 2, 1, 2]);
    const squeeze = events[0];
    const families = events[2];
    expect((squeeze?.start ?? 0) + (squeeze?.lasts ?? 0)).toBeLessThanOrEqual(families?.start ?? 0);
  });

  it('a closure picks a stretch when announced, and the notice names it; with no line there is no notice', () => {
    let g = startRun(starterLayout(), 1, RATES, RULES);
    const closure = g.clock?.events.find((e) => e.type === 'closure');
    expect(closure?.edge).toBeUndefined();
    while (g.clock && g.clock.year < (closure?.start ?? 0) - 1) g = tick(g, RATES, RULES);
    const soon = g.clock ? notices(g.clock, RATES.band, RULES).find((n) => n.type === 'closure') : undefined;
    expect(soon?.when).toBe('soon');
    expect(Object.keys(starterLayout().lines)).toContain(soon?.edge);
    let bare = startRun(emptyLayout(), 1, RATES, RULES);
    bare = runOut(bare);
    expect(bare.clock?.events.filter((e) => e.type === 'closure').every((e) => e.edge === null)).toBe(true);
  });
});

describe('the promise', () => {
  const looped = (() => {
    let s = starterLayout();
    const lay = (a: TileKey, b: TileKey): void => {
      const out = layStretch(s, a, b, RATES);
      if (out.ok) s = out.layout;
    };
    const inner = ['1,0', '1,-1', '0,-1', '-1,0', '-1,1', '0,1'];
    for (let i = 0; i < 6; i++) lay(inner[i] ?? '', inner[(i + 1) % 6] ?? '');
    lay('2,-1', '1,-1');
    lay('1,1', '1,0');
    lay('-2,1', '-1,0');
    lay('-1,-1', '0,-1');
    lay('3,-1', '3,-2');
    lay('-3,1', '-3,2');
    return s;
  })();

  it("the ledger's spokes give under a closure; twelve more stretches give every stop a second way", () => {
    const plain = assess(starterLayout(), RATES).tests.find((t) => t.id === 'closure');
    expect(plain && plain.gives.length > 0).toBe(true);
    const a = assess(looped, RATES);
    expect(Object.keys(looped.lines).length).toBe(26);
    expect(bridges(looped)).toEqual([]);
    expect(a.tests.every((t) => t.gives.length === 0)).toBe(true);
    expect(a.checks.every((c) => c.status === 'ok' || c.id === 'size')).toBe(true);
  });

  it('a city holding all four stretch tests, left alone for twenty years on 25 timelines, never breaks a line', () => {
    let worst = 0;
    for (let seed = 1; seed <= 25; seed++) {
      const run = runOut(startRun(looped, seed, RATES, RULES));
      worst = Math.max(worst, run.clock?.lineYears ?? 0);
    }
    expect(worst).toBe(0);
  });

  it("the ledger's city on spokes, left alone, loses 3 or 4 line-years to closures", () => {
    for (const seed of [1, 2]) {
      const run = runOut(startRun(starterLayout(), seed, RATES, RULES));
      expect([3, 4]).toContain(run.clock?.lineYears);
      const closureYears = (run.clock?.events ?? []).filter((e) => e.type === 'closure' && e.edge).map((e) => e.start);
      const brokenYears = (run.clock?.record ?? []).filter((r) => r.bad > 0).map((r) => r.year);
      expect(brokenYears.every((y) => closureYears.includes(y))).toBe(true);
      expect(brokenYears.length).toBe(closureYears.length);
    }
  });
});

/** The sketch's founding script: everything else ahead of the homes, and a bypass when a closure is announced. */
function found(seed: number, react: boolean): { game: Game; crewYears: number } {
  let game = startRun(emptyLayout(), seed, RATES, RULES);
  const act = (command: (plan: Layout) => Outcome): void => {
    game = order(game, command);
  };
  const seg = (a: TileKey, b: TileKey): void => act((p) => layStretch(p, a, b, RATES));
  const stage = (hoods: readonly (readonly [TileKey, readonly ExtraKind[]])[], infra: () => void): void => {
    const mark = game.clock?.jobs.length ?? 0;
    for (const [k] of hoods) act((p) => placeNeighborhood(p, k, RATES));
    const hoodsEnd = game.clock?.jobs.length ?? 0;
    infra();
    for (const [k, has] of hoods) for (const x of has) act((p) => toggleExtra(p, k, x, RATES));
    const jobs = game.clock?.jobs ?? [];
    game = { layout: game.layout, clock: game.clock && { ...game.clock, jobs: [...jobs.slice(0, mark), ...jobs.slice(hoodsEnd), ...jobs.slice(mark, hoodsEnd)] } };
  };
  stage(
    [
      ['2,-1', ['elementary', 'high', 'fields']],
      ['1,0', ['elementary', 'middle']],
      ['-2,1', ['elementary', 'high', 'fields']],
      ['-1,1', ['elementary', 'middle']],
      ['0,-1', ['elementary', 'middle']],
      ['0,1', ['elementary']],
      ['-1,0', ['elementary']],
      ['1,-1', []],
      ['1,1', ['elementary']],
      ['-1,-1', ['elementary']],
    ],
    () => {
      for (let i = 0; i < 3; i++) act((p) => addPlantUnit(p, '3,-1', 'power', RATES));
      act((p) => addPlantUnit(p, '3,-2', 'water', RATES));
      act((p) => addPlantUnit(p, '-3,1', 'sewage', RATES));
      act((p) => addPlantUnit(p, '-3,2', 'waste', RATES));
      for (let i = 0; i < 8; i++) act((p) => addRingBuilding(p, '0,0', RATES));
      for (const k of ['1,0', '0,1', '-1,1', '-1,0', '0,-1', '1,-1']) seg('0,0', k);
      seg('1,0', '2,-1'); seg('0,1', '1,1'); seg('-1,1', '-2,1'); seg('-1,0', '-1,-1');
      seg('2,-1', '3,-1'); seg('2,-1', '3,-2'); seg('-2,1', '-3,1'); seg('-2,1', '-3,2');
    },
  );
  stage(
    [
      ['2,-2', ['elementary', 'middle', 'fields']],
      ['0,-2', ['elementary', 'high']],
      ['2,0', ['elementary', 'middle']],
      ['-2,2', ['elementary', 'middle', 'fields']],
      ['0,2', ['elementary', 'high']],
      ['1,-2', ['elementary']],
      ['-2,0', ['elementary']],
      ['-1,2', ['elementary']],
      ['3,0', ['elementary']],
      ['-3,0', ['elementary']],
    ],
    () => {
      act((p) => addPlantUnit(p, '3,-1', 'power', RATES));
      act((p) => addPlantUnit(p, '3,-2', 'water', RATES));
      act((p) => addPlantUnit(p, '-3,1', 'sewage', RATES));
      act((p) => addPlantUnit(p, '-3,2', 'waste', RATES));
      for (let i = 0; i < 8; i++) act((p) => addRingBuilding(p, '0,0', RATES));
      seg('1,0', '2,0'); seg('1,-1', '2,-2'); seg('1,-1', '1,-2'); seg('0,-1', '0,-2'); seg('-1,0', '-2,0');
      seg('-1,1', '-2,2'); seg('-1,1', '-1,2'); seg('0,1', '0,2'); seg('2,0', '3,0'); seg('-2,0', '-3,0');
    },
  );
  const crewYears = (game.clock?.jobs ?? []).reduce((t, j) => t + j.total, 0);
  const handled: Record<number, true> = {};
  while (game.clock && game.clock.year < RULES.years) {
    if (react) {
      for (const n of notices(game.clock, RATES.band, RULES)) {
        if (n.type !== 'closure' || n.when !== 'soon' || handled[n.id] || !n.edge) continue;
        handled[n.id] = true;
        const closing: EdgeKey = n.edge;
        const [a, b] = edgeEnds(closing);
        const plan = planned(game.layout, game.clock?.jobs ?? []);
        // Whether the two ends of the closed stretch stay joined without it.
        const joined = (lines: Readonly<Record<EdgeKey, true>>): boolean => {
          const seen: Record<TileKey, true> = { [a]: true };
          const queue = [a];
          for (let i = 0; i < queue.length; i++) {
            const here = queue[i] ?? '';
            for (const e of Object.keys(lines)) {
              if (e === closing) continue;
              const [p, q] = edgeEnds(e);
              const other = p === here ? q : q === here ? p : null;
              if (other && !seen[other]) {
                seen[other] = true;
                queue.push(other);
              }
            }
          }
          return Boolean(seen[b]);
        };
        if (joined(plan.lines)) continue;
        let done = false;
        for (const p of allTiles(RATES.board)) {
          if (done) break;
          if (!plan.tiles[p]) continue;
          for (const q of neighbors(p, RATES.board)) {
            if (done || !plan.tiles[q] || p > q) continue;
            const e = `${p}|${q}`;
            if (plan.lines[e]) continue;
            if (joined({ ...plan.lines, [e]: true })) {
              seg(p, q);
              const jobs = game.clock?.jobs ?? [];
              game = { layout: game.layout, clock: game.clock && { ...game.clock, jobs: putFirst(jobs, jobs.length - 1) } };
              done = true;
            }
          }
        }
      }
    }
    game = tick(game, RATES, RULES);
  }
  return { game, crewYears };
}

describe('founding 100,000 from nothing', () => {
  for (const f of foundings) {
    it(`seed ${f.seed}${f.react ? ', with a bypass for each closure' : ', no reaction'}: homes for 100,000 by year 20, ${f.final.clock.lineYears} broken line-years`, () => {
      const out = found(f.seed, f.react);
      expect(out.crewYears).toBe(f.crewYears);
      expect(out.crewYears).toBe(151);
      const record = out.game.clock?.record ?? [];
      expect(record[record.length - 1]).toMatchObject({ year: 20, pop: 100000 });
      expect(out.game.clock?.lineYears).toBe(f.final.clock.lineYears);
      expect(out.game.layout).toEqual(f.final.state);
      expect(record.map((r) => ({ year: r.year, pop: r.pop, bad: r.bad }))).toEqual(f.final.clock.record.map((r) => ({ year: r.year, pop: r.pop, bad: r.bad })));
      if (f.react) expect(out.game.clock?.lineYears ?? 9).toBeLessThanOrEqual(1);
    });
  }
});
