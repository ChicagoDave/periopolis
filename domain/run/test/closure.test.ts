/**
 * @file The line holds through a closure (ADR-0021): on a run built in order each closure is announced two years
 * ahead and its stretch drawn then (`beginClock`, notice 2; the sketch's one year without `inOrder`); the named
 * closures of a year are the drawn stretches not yet over (`namedClosures`); and the month the stretch is named the run
 * orders the way round and puts it first in the work in hand, so the closure year loses no stop. Seed 42, one
 * neighborhood, the first closure in year 7 closes `-1,0|0,0`.
 * Owner context: Run (domain), tests.
 */
import { describe, expect, it } from 'vitest';
import { RATES, emptyLayout, placeNeighborhood } from '@city/site';
import { RULES, beginClock, namedClosures, putOrderFirst, restoreClock, startRun, tickMonth } from '../src/index.ts';
import type { Job } from '../src/index.ts';
import type { Game } from '../src/index.ts';

const one = placeNeighborhood(emptyLayout(), '0,0', RATES);
if (!one.ok) throw new Error('refused');

/** Months until the clock has closed the given year. */
function toYear(g0: Game, year: number): Game {
  let g = g0;
  while (g.clock && g.clock.year < year) g = tickMonth(g, RATES, RULES);
  return g;
}

describe('a closure is announced two years ahead on a run built in order (ADR-0021 Decision 3)', () => {
  it('in order each closure carries notice 2; without it the sketch\'s 1, and the other events are unchanged either way', () => {
    const inferring = beginClock(42, RULES, true);
    const sketch = beginClock(42, RULES);
    for (const e of inferring.events) expect(e.notice).toBe(e.type === 'closure' ? 2 : sketch.events.find((s) => s.id === e.id)?.notice);
    for (const e of sketch.events) if (e.type === 'closure') expect(e.notice).toBe(1);
    expect(inferring.events.map((e) => [e.id, e.type, e.start, e.lasts])).toEqual(sketch.events.map((e) => [e.id, e.type, e.start, e.lasts]));
  });

  it('startRun passes the flag: a run built in order, by hand or growing itself, announces its closures two years ahead; the sketch\'s does not', () => {
    const grown = startRun(one.layout, 42, RATES, RULES, { growth: true, inOrder: true, infer: true });
    const byHand = startRun(one.layout, 42, RATES, RULES, { growth: true, inOrder: true });
    const sketch = startRun(one.layout, 42, RATES, RULES, { growth: true });
    expect(grown.clock?.events.filter((e) => e.type === 'closure').map((e) => e.notice)).toEqual([2, 2]);
    expect(byHand.clock?.events.filter((e) => e.type === 'closure').map((e) => e.notice)).toEqual([2, 2]);
    expect(sketch.clock?.events.filter((e) => e.type === 'closure').map((e) => e.notice)).toEqual([1, 1]);
  });
});

describe('the way round is ordered the month the stretch is named, and put first (ADR-0021 Decisions 2 and 3)', () => {
  const start = startRun(one.layout, 42, RATES, RULES, { growth: true, inOrder: true, infer: true });
  const closure = start.clock?.events.find((e) => e.type === 'closure');
  if (!closure) throw new Error('no closure');
  const atFour = toYear(start, closure.start - 3);
  const named = toYear(atFour, closure.start - 2);

  it('the stretch is not named before the announcement, and nothing is named for the year', () => {
    expect(atFour.clock?.events.find((e) => e.id === closure.id)?.edge).toBeUndefined();
    expect(namedClosures(atFour.clock!, closure.start - 2)).toEqual([]);
  });

  it('at the close of the year two before, the stretch is drawn and named for every year up to the closure, and not after it', () => {
    const edge = named.clock?.events.find((e) => e.id === closure.id)?.edge;
    expect(edge).toBe('-1,0|0,0');
    expect(namedClosures(named.clock!, closure.start - 1)).toEqual([edge]);
    expect(namedClosures(named.clock!, closure.start)).toEqual([edge]);
    expect(namedClosures(named.clock!, closure.start + closure.lasts)).toEqual([]);
  });

  it('that month the run orders the way round as a line need, and it stands first in the work in hand', () => {
    const month = named.clock?.growth?.months.at(-1);
    const orders = (month?.inferred ?? []).filter((f) => f.type === 'InferredOrder' && f.why === 'line');
    expect(orders).toHaveLength(1);
    expect(orders[0]?.type === 'InferredOrder' && orders[0].first).toBe(true);
    expect((month?.inferred ?? []).filter((f) => f.type === 'InferredOrder' && f.why !== 'line').every((f) => f.type === 'InferredOrder' && f.first === undefined)).toBe(true);
    const laid = orders.flatMap((f) => (f.type === 'InferredOrder' ? f.events : [])).filter((e) => e.type === 'JobOrdered');
    expect(laid.map((e) => (e.type === 'JobOrdered' ? e.at : ''))).toEqual(['-1,0|0,-1']);
    expect(named.clock?.jobs[0]?.at).toBe('-1,0|0,-1');
    expect(named.clock?.jobs[0]?.inferred).toBe(true);
    expect(named.clock?.jobs.length).toBeGreaterThan(1);
  });

  it('a stored clock keeps which orders were put first, and reads nothing in for the others', () => {
    const stored = JSON.parse(JSON.stringify(named.clock));
    const back = restoreClock(stored, named.layout, RATES, RULES);
    const facts = back?.growth?.months.at(-1)?.inferred ?? [];
    const line = facts.find((f) => f.type === 'InferredOrder' && f.why === 'line');
    expect(line?.type === 'InferredOrder' && line.first).toBe(true);
    expect(facts.filter((f) => f.type === 'InferredOrder' && f.why !== 'line').every((f) => f.type === 'InferredOrder' && !('first' in f))).toBe(true);
    expect(back?.jobs[0]?.at).toBe('-1,0|0,-1');
    const tampered = JSON.parse(JSON.stringify(named.clock));
    for (const f of tampered.growth.months.at(-1).inferred) if (f.why === 'line') f.first = 'yes';
    const facts2 = restoreClock(tampered, named.layout, RATES, RULES)?.growth?.months.at(-1)?.inferred ?? [];
    expect(facts2.some((f) => f.type === 'InferredOrder' && 'first' in f)).toBe(false);
    expect(back?.events.filter((e) => e.type === 'closure').map((e) => [e.notice, e.edge ?? null])).toEqual(named.clock?.events.filter((e) => e.type === 'closure').map((e) => [e.notice, e.edge ?? null]));
  });

  it('the way round stands before the closure year, and that year loses no stop', () => {
    const before = toYear(named, closure.start - 1);
    expect(before.layout.lines['-1,0|0,-1']).toBe(true);
    const through = toYear(before, closure.start);
    const row = through.clock?.record.find((r) => r.year === closure.start);
    expect(row?.broken).not.toContain('stops');
    expect(row?.broken).not.toContain('ways');
  });
});

describe('an order put first (putOrderFirst)', () => {
  const job = (at: string): Job => ({ what: 'line', at, left: 1, total: 1 });
  const jobs = [job('a'), job('b'), job('c'), job('d')];

  it('moves the last n jobs to the front in their own order, and the rest keep theirs', () => {
    expect(putOrderFirst(jobs, 2).map((j) => j.at)).toEqual(['c', 'd', 'a', 'b']);
    expect(putOrderFirst(jobs, 1).map((j) => j.at)).toEqual(['d', 'a', 'b', 'c']);
    expect(putOrderFirst(jobs, 4).map((j) => j.at)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('is the same list when the order added nothing or names more jobs than are in hand', () => {
    expect(putOrderFirst(jobs, 0)).toBe(jobs);
    expect(putOrderFirst(jobs, -1)).toBe(jobs);
    expect(putOrderFirst(jobs, 5)).toBe(jobs);
  });
});
