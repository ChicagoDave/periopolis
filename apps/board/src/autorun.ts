/**
 * @file The months run on their own: one month step shared by the Next month tap and a timer, and the timer's
 * Play, Pause and speed. The timer lives in memory only, so a reloaded run is paused where it stood. Each Play
 * remembers one state for undo, not one a month.
 * Public interface: Speed, SPEED_MS, Scheduler, windowScheduler, canStep, monthStep, yearStep, AutoRun, newAutoRun.
 * Owner context: Board (adapter) over the Run's clock (ADR-0009 month clock, ADR-0012 built in order).
 */
import { RULES, tick, tickMonth } from '@city/run';
import { RATES } from '@city/site';
import type { Session } from './session.ts';
import { inferredLine, monthLine, yearLine, yearsUp } from './wording.ts';

/** How fast the months run. */
export type Speed = 'slow' | 'steady' | 'fast';

/** Milliseconds a month at each speed. */
export const SPEED_MS: Readonly<Record<Speed, number>> = { slow: 1000, steady: 400, fast: 100 };

/** What runs the timer: the window's interval, or a fake in tests. `every` returns the call that cancels it. */
export interface Scheduler {
  every(fn: () => void, ms: number): () => void;
}

/** The window's own interval. */
export const windowScheduler: Scheduler = {
  every: (fn, ms) => {
    const handle = setInterval(fn, ms);
    return () => clearInterval(handle);
  },
};

/** Whether the clock can take another step: it exists, and the years are not up. */
export function canStep(s: Session): boolean {
  const clock = s.game.clock;
  return clock !== null && clock.year < RULES.years;
}

/**
 * One month passes on the session's run: the game is replaced, the line cursor dropped and the game saved. The caller
 * remembers for undo first, if it wants to.
 * @returns what to say: the month's sentence, what the city ordered for itself (ADR-0015), the year's when the month
 * ended one, and that the years are up at the horizon; or null, with nothing changed, when the clock is absent, not on
 * the month clock, or over. An order the run places pauses nothing (ADR-0013 Decision 3 as amended).
 */
export function monthStep(s: Session): string | null {
  const clock = s.game.clock;
  if (!clock || !clock.growth || !canStep(s)) return null;
  const next = tickMonth(s.game, RATES, RULES);
  const months = next.clock?.growth?.months ?? [];
  const last = months[months.length - 1];
  const yearEnded = (next.clock?.year ?? 0) > clock.year;
  const row = next.clock?.record[next.clock.record.length - 1];
  s.game = next;
  s.lineFrom = null;
  s.save();
  const said = last ? monthLine(last) + (last.inferred ? ` ${inferredLine(last.inferred)}` : '') : '';
  return yearEnded && row ? `${said} ${yearLine(row)}${(next.clock?.year ?? 0) >= RULES.years ? yearsUp(RULES) : ''}` : said;
}

/**
 * One year passes on the session's run (twelve months, on the month clock): the game is replaced, the line cursor
 * dropped and the game saved. The caller remembers for undo first, if it wants to.
 * @returns the year's sentence, with the years up at the horizon; or null, with nothing changed, when the clock is
 * absent or over
 */
export function yearStep(s: Session): string | null {
  if (!canStep(s)) return null;
  const next = tick(s.game, RATES, RULES);
  const row = next.clock?.record[next.clock.record.length - 1];
  s.game = next;
  s.lineFrom = null;
  s.save();
  return row ? yearLine(row) + ((next.clock?.year ?? 0) >= RULES.years ? yearsUp(RULES) : '') : '';
}

/** The timer that runs the months. */
export interface AutoRun {
  /** Whether the months are running. */
  readonly playing: boolean;
  readonly speed: Speed;
  /** Remember one state for undo and start the months running; false, with nothing changed, when the clock cannot
   * step by the month. */
  play(): boolean;
  /** Stop the months; false when they were not running. */
  pause(): boolean;
  /** Run at another speed; a timer in flight is re-armed without resetting the month. */
  setSpeed(speed: Speed): void;
}

/**
 * The months running on a session's clock. After each month `after` is called with what to say; at the horizon, or
 * when the clock cannot step, the timer stops itself and `after` is called once more with nothing to add.
 * @param s - the session whose run plays
 * @param after - called after every step and after the timer stops itself
 * @param scheduler - the window's interval, or a fake
 */
export function newAutoRun(s: Session, after: (said: string | null) => void, scheduler: Scheduler = windowScheduler): AutoRun {
  let cancel: (() => void) | null = null;
  let speed: Speed = 'steady';
  const fire = (): void => {
    const said = monthStep(s);
    if (said === null || !canStep(s)) auto.pause();
    after(said);
  };
  const arm = (): void => {
    if (cancel) cancel();
    cancel = scheduler.every(fire, SPEED_MS[speed]);
  };
  const auto: AutoRun = {
    get playing() {
      return cancel !== null;
    },
    get speed() {
      return speed;
    },
    play() {
      const clock = s.game.clock;
      if (!clock || !clock.growth || !canStep(s)) return false;
      if (cancel) return true;
      s.remember();
      arm();
      return true;
    },
    pause() {
      if (!cancel) return false;
      cancel();
      cancel = null;
      return true;
    },
    setSpeed(next) {
      speed = next;
      if (cancel) arm();
    },
  };
  return auto;
}
