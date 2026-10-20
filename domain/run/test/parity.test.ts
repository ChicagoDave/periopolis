/**
 * @file Parity: every step of the clock the port takes matches the sketch's clock, recorded in fixtures/parity.json.
 * The sketch's sentences are in the record for the Board's wording tests; here orders are compared by their effect.
 * Owner context: Run (domain), tests.
 */
import { describe, expect, it } from 'vitest';
import {
  RATES,
  addPlantUnit,
  addRingBuilding,
  erase,
  isPlantKind,
  layStretch,
  placeNeighborhood,
  toggleExtra,
} from '@city/site';
import type { ExtraKind, Layout } from '@city/site';
import {
  RULES,
  cancelJob,
  inHand,
  notices,
  placeOrder,
  putFirst,
  restoreClock,
  startRun,
  stopRun,
  stressAt,
  tick,
  waveIn,
} from '../src/index.ts';
import type { Clock, Game, TimelineEvent } from '../src/index.ts';
import recorded from './fixtures/parity.json';

/** The sketch's game: `state` where the port says `layout`. */
interface SketchGame {
  readonly state: Layout;
  readonly clock: Clock | null;
}

interface Step {
  readonly op: 'start' | 'order' | 'tick' | 'first' | 'cancel' | 'stop';
  readonly args: { tool?: string; k?: string; from?: string | null; index?: number; layout?: string; seed?: number };
  readonly before: SketchGame | null;
  readonly after: SketchGame;
  readonly said: string | null;
  readonly changed: boolean | null;
  readonly inHand: unknown;
}

interface Fixture {
  readonly rules: { YEARS: number; CREWS: number; BUILD: Record<string, number>; FIRST_MODULE: number };
  readonly steps: Step[];
  readonly wave: Record<'elementary' | 'middle' | 'high', number[]>;
  readonly timelines: { seed: number; events: TimelineEvent[] }[];
  readonly cleanCases: { name: string; raw: unknown; layout: Layout; result: Clock | null }[];
  readonly promise: { layout: Layout; runs: { seed: number; lineYears: number; events: TimelineEvent[] }[] };
  readonly leftAlone: { seed: number; final: SketchGame; yearly: { year: number; notices: Record<string, unknown>[]; stress: unknown }[] }[];
}

const fixture = recorded as unknown as Fixture;

const toGame = (g: SketchGame): Game => ({ layout: g.state, clock: g.clock });

/**
 * The sketch's clock has no money: its record rows end at `opened`. Parity compares the old rows only (ADR-0007
 * Decision 7), so the port's `standing` and `spend` are left out here and asserted in spend.test.ts.
 */
function oldClock(clock: Clock | null): Clock | null {
  if (!clock) return null;
  const record = clock.record.map(({ standing: _standing, spend: _spend, ...row }) => row) as unknown as Clock['record'];
  return { ...clock, record };
}
const fromGame = (g: Game): SketchGame => ({ state: g.layout, clock: oldClock(g.clock) });

/** The sketch's inHand, which has no crews field difference; compared whole. */
function order(game: Game, tool: string, k: string, from: string | null | undefined) {
  const extras: readonly string[] = ['elementary', 'middle', 'high', 'fields'];
  if (tool === 'hood') return placeOrder(game, (plan) => placeNeighborhood(plan, k, RATES), RULES);
  if (tool === 'ring') return placeOrder(game, (plan) => addRingBuilding(plan, k, RATES), RULES);
  if (extras.includes(tool)) return placeOrder(game, (plan) => toggleExtra(plan, k, tool as ExtraKind, RATES), RULES);
  if (isPlantKind(tool)) return placeOrder(game, (plan) => addPlantUnit(plan, k, tool, RATES), RULES);
  if (tool === 'erase') return placeOrder(game, (plan) => erase(plan, k, RATES), RULES);
  if (tool === 'line') return from ? placeOrder(game, (plan) => layStretch(plan, from, k, RATES), RULES) : null;
  throw new Error(`no command for ${tool}`);
}

describe('the rules', () => {
  it('match the sketch', () => {
    expect(RULES.years).toBe(fixture.rules.YEARS);
    expect(RULES.crews).toBe(fixture.rules.CREWS);
    expect(RULES.build).toEqual(fixture.rules.BUILD);
    expect(RULES.firstModule).toBe(fixture.rules.FIRST_MODULE);
  });
});

describe('every step of the mechanics', () => {
  fixture.steps.forEach((s, i) => {
    const label = s.op === 'order' ? `${s.op} ${s.args.tool} at ${s.args.k}${s.changed ? '' : ' (no change)'}` : s.op;
    it(`step ${i + 1}: ${label}`, () => {
      let after: Game;
      if (s.op === 'start') {
        const layout = s.after.state;
        after = startRun(layout, s.args.seed ?? 0, RATES, RULES);
      } else {
        if (!s.before) throw new Error('a step after the first has a before');
        const before = toGame(s.before);
        if (s.op === 'order') {
          const out = order(before, s.args.tool ?? '', s.args.k ?? '', s.args.from);
          if (out === null) {
            expect(s.changed).toBe(false);
            return;
          }
          expect(out.ok).toBe(s.changed);
          after = out.ok ? out.game : before;
        } else if (s.op === 'tick') after = tick(before, RATES, RULES);
        else if (s.op === 'first') after = { layout: before.layout, clock: before.clock && { ...before.clock, jobs: putFirst(before.clock.jobs, s.args.index ?? -1) } };
        else if (s.op === 'cancel') after = { layout: before.layout, clock: before.clock && { ...before.clock, jobs: cancelJob(before.clock.jobs, s.args.index ?? -1) } };
        else after = stopRun(before);
      }
      expect(fromGame(after)).toEqual(s.after);
      expect(inHand(after.layout, after.clock ? after.clock.jobs : null, RULES)).toEqual(s.inHand);
    });
  });
});

describe('the wave of children', () => {
  it('fills each school as the sketch has it, year by year', () => {
    for (const kind of ['elementary', 'middle', 'high'] as const) {
      expect(fixture.wave[kind].map((_x, t) => waveIn(kind, t))).toEqual(fixture.wave[kind]);
    }
  });
});

describe('timelines', () => {
  for (const t of fixture.timelines) {
    it(`seed ${t.seed} deals the same five events`, () => {
      expect(startRun({ tiles: {}, lines: {}, circles: ['0,0'] }, t.seed, RATES, RULES).clock?.events).toEqual(t.events);
    });
  }
});

describe('a clock read back from storage', () => {
  for (const c of fixture.cleanCases) {
    it(c.name, () => {
      expect(oldClock(restoreClock(c.raw, c.layout, RATES, RULES))).toEqual(c.result);
    });
  }
});

describe('the looped city on 25 timelines', () => {
  for (const r of fixture.promise.runs) {
    it(`seed ${r.seed}: ${r.lineYears} broken line-years, the same events`, () => {
      let game = startRun(fixture.promise.layout, r.seed, RATES, RULES);
      while (game.clock && game.clock.year < RULES.years) game = tick(game, RATES, RULES);
      expect(game.clock?.lineYears).toBe(r.lineYears);
      expect(game.clock?.events).toEqual(r.events);
    });
  }
});

describe("the ledger's city left alone for twenty years", () => {
  for (const run of fixture.leftAlone) {
    it(`seed ${run.seed}: the record, the notices and the stress of every year match`, () => {
      let game = startRun(run.final.state, run.seed, RATES, RULES);
      // The final layout is the starting one: nothing was ordered.
      const years = [];
      const noticesOf = (g: Game) =>
        g.clock ? notices(g.clock, RATES.band, RULES).map((n) => ({ id: n.id, type: n.type, when: n.when, start: n.start, until: n.until, edge: n.edge })) : [];
      years.push({ year: 0, notices: noticesOf(game), stress: game.clock && stressAt(game.clock, RATES.band) });
      while (game.clock && game.clock.year < RULES.years) {
        game = tick(game, RATES, RULES);
        years.push({ year: game.clock?.year ?? 0, notices: noticesOf(game), stress: game.clock && stressAt(game.clock, RATES.band) });
      }
      expect(fromGame(game)).toEqual(run.final);
      const wanted = run.yearly.map((y) => ({
        year: y.year,
        notices: y.notices.map((n) => ({ id: n['id'], type: n['type'], when: n['when'], start: n['start'], until: n['until'], edge: n['edge'] })),
        stress: y.stress,
      }));
      expect(years).toEqual(wanted);
    });
  }
});
