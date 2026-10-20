/**
 * @file The months running on their own: one step shared by the tap and the timer, Play remembering one state, the
 * timer stopping itself at the horizon, Pause, and the speed re-arming a timer in flight.
 * Owner context: Board (adapter), tests.
 */
import { describe, expect, it } from 'vitest';
import { RULES, startRun, tick, tickMonth } from '@city/run';
import type { Game } from '@city/run';
import { RATES, emptyLayout, sizedLayout } from '@city/site';
import { SPEED_MS, canStep, monthStep, newAutoRun, yearStep } from '../src/autorun.ts';
import type { Scheduler } from '../src/autorun.ts';
import { newSession } from '../src/session.ts';
import { memoryStore, restoreGame } from '../src/storage.ts';

/** A scheduler fired by hand, recording the interval it was armed with. */
function fakeScheduler(): Scheduler & { fire(): void; readonly armed: number[]; readonly live: number } {
  let fns: { fn: () => void; ms: number }[] = [];
  const armed: number[] = [];
  return {
    every(fn, ms) {
      const entry = { fn, ms };
      fns.push(entry);
      armed.push(ms);
      return () => {
        fns = fns.filter((f) => f !== entry);
      };
    },
    fire() {
      for (const f of [...fns]) f.fn();
    },
    armed,
    get live() {
      return fns.length;
    },
  };
}

const monthRun = (): Game => startRun(sizedLayout(RATES), 7, RATES, RULES, { growth: true, inOrder: true });
const yearRun = (): Game => startRun(sizedLayout(RATES), 7, RATES, RULES, { inOrder: true });

/** The sized city run to the last month before the horizon. */
function atLastMonth(): Game {
  let g = monthRun();
  for (let y = 1; y < RULES.years; y++) g = tick(g, RATES, RULES);
  for (let m = 0; m < 11; m++) g = tickMonth(g, RATES, RULES);
  return g;
}

describe('one month step', () => {
  it('replaces the game with the next month, drops the line cursor, saves, and says the month', () => {
    const store = memoryStore();
    const s = newSession(monthRun(), store);
    s.lineFrom = '1,0';
    const said = monthStep(s);
    expect(s.game.clock?.growth?.month).toBe(1);
    expect(s.game.clock?.growth?.months.length).toBe(1);
    expect(s.lineFrom).toBeNull();
    expect(restoreGame(store.load())).toEqual(s.game);
    expect(said).toContain('Year 1, month 1:');
    expect(s.history).toEqual([]);
  });

  it('says the year too when the month closes one, and the years up at the horizon', () => {
    const s = newSession(monthRun(), memoryStore());
    for (let m = 0; m < 11; m++) monthStep(s);
    const said = monthStep(s);
    expect(s.game.clock?.year).toBe(1);
    expect(said).toContain('Year 1, month 12:');
    expect(said).toContain('Year 1: ');
    expect(said).not.toContain('years are up');
    const end = newSession(atLastMonth(), memoryStore());
    expect(canStep(end)).toBe(true);
    expect(monthStep(end)).toContain(`The ${RULES.years} years are up.`);
    expect(end.game.clock?.year).toBe(RULES.years);
    expect(canStep(end)).toBe(false);
  });

  it('refuses with nothing changed: no clock, a yearly run, or the years up', () => {
    const none = newSession({ layout: emptyLayout(), clock: null }, memoryStore());
    expect(monthStep(none)).toBeNull();
    expect(none.game.clock).toBeNull();
    const yearly = newSession(yearRun(), memoryStore());
    const before = yearly.game;
    expect(monthStep(yearly)).toBeNull();
    expect(yearly.game).toBe(before);
    const over = newSession(atLastMonth(), memoryStore());
    monthStep(over);
    const done = over.game;
    expect(monthStep(over)).toBeNull();
    expect(over.game).toBe(done);
  });
});

describe('one year step', () => {
  it('runs the year on either clock, saves, and says it; refuses with no clock', () => {
    const store = memoryStore();
    const s = newSession(monthRun(), store);
    expect(yearStep(s)).toContain('Year 1: ');
    expect(s.game.clock?.year).toBe(1);
    expect(s.game.clock?.growth?.months.length).toBe(12);
    expect(restoreGame(store.load())).toEqual(s.game);
    const y = newSession(yearRun(), memoryStore());
    expect(yearStep(y)).toContain('Year 1: ');
    expect(y.game.clock?.year).toBe(1);
    const none = newSession({ layout: emptyLayout(), clock: null }, memoryStore());
    expect(yearStep(none)).toBeNull();
  });
});

describe('the months running on their own', () => {
  it('Play remembers one state, then each firing is one month said to the page', () => {
    const clock = fakeScheduler();
    const s = newSession(monthRun(), memoryStore());
    const said: (string | null)[] = [];
    const auto = newAutoRun(s, (t) => said.push(t), clock);
    expect(auto.playing).toBe(false);
    expect(auto.play()).toBe(true);
    expect(auto.playing).toBe(true);
    expect(s.history.length).toBe(1);
    expect(clock.armed).toEqual([SPEED_MS.steady]);
    clock.fire();
    clock.fire();
    clock.fire();
    expect(s.game.clock?.growth?.month).toBe(3);
    expect(said.map((t) => t?.slice(0, 16))).toEqual(['Year 1, month 1:', 'Year 1, month 2:', 'Year 1, month 3:']);
    expect(s.history.length).toBe(1);
    // A second Play while playing neither remembers again nor arms a second timer.
    expect(auto.play()).toBe(true);
    expect(s.history.length).toBe(1);
    expect(clock.live).toBe(1);
    // Undo goes back to where Play was pressed, not one month.
    auto.pause();
    expect(s.undo()).toBe(true);
    expect(s.game.clock?.growth?.month).toBe(0);
  });

  it('refuses to play a yearly run, a stopped clock, or a run at the horizon, changing nothing', () => {
    const clock = fakeScheduler();
    for (const game of [yearRun(), { layout: emptyLayout(), clock: null } as Game]) {
      const s = newSession(game, memoryStore());
      const auto = newAutoRun(s, () => undefined, clock);
      expect(auto.play()).toBe(false);
      expect(auto.playing).toBe(false);
      expect(s.history).toEqual([]);
      expect(s.game).toBe(game);
    }
    const over = newSession(atLastMonth(), memoryStore());
    monthStep(over);
    const auto = newAutoRun(over, () => undefined, clock);
    expect(auto.play()).toBe(false);
    expect(clock.live).toBe(0);
  });

  it('Pause stops the firing; a firing after Pause changes nothing', () => {
    const clock = fakeScheduler();
    const s = newSession(monthRun(), memoryStore());
    const auto = newAutoRun(s, () => undefined, clock);
    expect(auto.pause()).toBe(false);
    auto.play();
    clock.fire();
    expect(auto.pause()).toBe(true);
    expect(auto.playing).toBe(false);
    expect(clock.live).toBe(0);
    const at = s.game;
    clock.fire();
    expect(s.game).toBe(at);
  });

  it('stops itself at the horizon: the last month says the years are up and the timer is gone', () => {
    const clock = fakeScheduler();
    const s = newSession(atLastMonth(), memoryStore());
    const said: (string | null)[] = [];
    const auto = newAutoRun(s, (t) => said.push(t), clock);
    auto.play();
    clock.fire();
    expect(s.game.clock?.year).toBe(RULES.years);
    expect(auto.playing).toBe(false);
    expect(clock.live).toBe(0);
    expect(said.length).toBe(1);
    expect(said[0]).toContain(`The ${RULES.years} years are up.`);
    const done = s.game;
    clock.fire();
    expect(s.game).toBe(done);
  });

  it('a new speed re-arms a timer in flight at its interval without resetting the month', () => {
    const clock = fakeScheduler();
    const s = newSession(monthRun(), memoryStore());
    const auto = newAutoRun(s, () => undefined, clock);
    auto.setSpeed('fast');
    expect(auto.speed).toBe('fast');
    expect(clock.armed).toEqual([]);
    auto.play();
    clock.fire();
    auto.setSpeed('slow');
    expect(clock.armed).toEqual([SPEED_MS.fast, SPEED_MS.slow]);
    expect(clock.live).toBe(1);
    expect(s.game.clock?.growth?.month).toBe(1);
    clock.fire();
    expect(s.game.clock?.growth?.month).toBe(2);
  });
});

describe('the city growing itself on the Board (ADR-0015)', () => {
  const growRun = (): Game => startRun(emptyLayout(), 7, RATES, RULES, { growth: true, inOrder: true, infer: true });

  it('a month step says what the city ordered after the month, saves the orders, and the timer plays on', () => {
    const clock = fakeScheduler();
    const store = memoryStore();
    const s = newSession(growRun(), store);
    const said: (string | null)[] = [];
    const auto = newAutoRun(s, (t) => said.push(t), clock);
    expect(auto.play()).toBe(true);
    clock.fire();
    expect(said[0]).toBe('Year 1, month 1: no homes stand yet, so nobody lives here. The city ordered a neighborhood for the people arriving.');
    expect(s.game.clock?.jobs.map((j) => [j.what, j.inferred])).toEqual([['hood', true]]);
    expect(auto.playing).toBe(true);
    clock.fire();
    expect(said[1]).toContain('The city ordered');
    expect(s.game.clock?.jobs.length).toBeGreaterThan(5);
    expect(auto.playing).toBe(true);
    expect(restoreGame(store.load())).toEqual(s.game);
    expect(restoreGame(store.load())?.clock?.infer).toBe(true);
    // One undo takes the whole Play back, the city's orders with it.
    auto.pause();
    expect(s.undo()).toBe(true);
    expect(s.game.clock?.jobs).toEqual([]);
    expect(s.game.clock?.growth?.month).toBe(0);
  });

  it('a run without the control says nothing of orders and places none', () => {
    const s = newSession(startRun(emptyLayout(), 7, RATES, RULES, { growth: true, inOrder: true }), memoryStore());
    expect(monthStep(s)).toBe('Year 1, month 1: no homes stand yet, so nobody lives here.');
    expect(s.game.clock?.jobs).toEqual([]);
  });
});
