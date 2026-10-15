/**
 * @file The timeline: five things that happen in twenty years, each announced ahead; the stress each puts on the city;
 * and the notices the player is given.
 * Public interface: EventType, TimelineEvent, Clock, beginClock, waveIn, isActive, isAnnounced, stressAt, Notice, notices,
 * pickEdge.
 * Owner context: Run (domain).
 */
import { closable, SCHOOLS } from '@city/site';
import type { CheckId, EdgeKey, Layout, SchoolKind, Stress } from '@city/site';
import { dice } from './dice.ts';
import type { Job } from './jobs.ts';
import { GRADES } from './rules.ts';
import type { PieceKind, RunRules } from './rules.ts';
import type { Growth } from './growth.ts';
import type { Money } from './spend.ts';

/** What can happen: a housing squeeze, a stretch of line closed, a wave of young families, a slump. */
export type EventType = 'squeeze' | 'closure' | 'families' | 'slump';

/** One event on the timeline. */
export interface TimelineEvent {
  readonly id: number;
  readonly type: EventType;
  /** The first year it runs. */
  readonly start: number;
  /** Years it runs. */
  readonly lasts: number;
  /** Years ahead it is announced. */
  readonly notice: number;
  /** A closure's stretch: absent until it is picked at announcement, null when there was no line to close. */
  readonly edge?: EdgeKey | null;
}

/** One row of the yearly record: the city as it stood that year. */
export interface RecordRow {
  readonly year: number;
  readonly pop: number;
  readonly homes: number;
  readonly held: number;
  readonly warn: number;
  readonly bad: number;
  readonly broken: readonly CheckId[];
  readonly opened: Readonly<Partial<Record<PieceKind, number>>>;
  /** What stands costs at the end of the year, by layer: capital standing, and this year's running bill. */
  readonly standing: Money;
  /** The year's outlay by layer: capital as the change in what stands, running as the year's bill. Year 0 spends nothing. */
  readonly spend: Money;
}

/** The clock: the year, the work in hand, the events and the record. */
export interface Clock {
  readonly year: number;
  readonly seed: number;
  readonly jobs: readonly Job[];
  readonly events: readonly TimelineEvent[];
  readonly record: readonly RecordRow[];
  /** Broken line-years: one line broken for one year, summed over years 1 on. */
  readonly lineYears: number;
  /** The month clock (ADR-0009), when the run was started with growth; absent, homes fill the year they finish. */
  readonly growth?: Growth;
}

/**
 * Deal a timeline. Each event is one of the four stretch tests come true: the squeeze is over before the wave of
 * children arrives, so no two of them ever push the same line past the band.
 * @param seed - the run's seed
 * @param rules - the clock's rules
 */
export function beginClock(seed: number, rules: RunRules): Clock {
  const roll = dice(seed);
  const pick = (a: number, b: number): number => a + Math.floor(roll() * (b - a + 1));
  const events: TimelineEvent[] = [
    { id: 1, type: 'squeeze', start: pick(4, 5), lasts: 3, notice: 2 },
    { id: 2, type: 'closure', start: pick(6, 9), lasts: 1, notice: 1 },
    { id: 3, type: 'families', start: pick(8, 9), lasts: rules.wave, notice: 2 },
    { id: 4, type: 'closure', start: pick(12, 18), lasts: 1, notice: 1 },
    { id: 5, type: 'slump', start: pick(14, 15), lasts: 4, notice: 2 },
  ];
  return { year: 0, seed: seed >>> 0, jobs: [], events, record: [], lineYears: 0 };
}

/**
 * The share of a school's grades that the wave fills, t years after it arrived in grades K to 5.
 * @param kind - the school
 * @param t - years since the wave arrived
 */
export function waveIn(kind: SchoolKind, t: number): number {
  const [lo, hi] = GRADES[kind];
  return Math.max(0, Math.min(hi, t + 5) - Math.max(lo, t) + 1) / (hi - lo + 1);
}

/** Whether an event runs in a year. */
export function isActive(e: TimelineEvent, year: number): boolean {
  return year >= e.start && year < e.start + e.lasts;
}

/** Whether an event is announced but not yet running in a year. */
export function isAnnounced(e: TimelineEvent, year: number): boolean {
  return year >= e.start - e.notice && year < e.start;
}

/**
 * What is happening to the city in a year, as the stress the lines are checked under.
 * @param clock - the clock
 * @param band - how far the city must stretch
 * @param year - the year; the clock's own by default
 */
export function stressAt(clock: Clock, band: number, year: number = clock.year): Stress {
  const kids: Record<SchoolKind, number> = { elementary: 0, middle: 0, high: 0 };
  const closed: EdgeKey[] = [];
  let people = 0;
  for (const e of clock.events) {
    if (!isActive(e, year)) continue;
    if (e.type === 'families') for (const kind of SCHOOLS) kids[kind] = band * waveIn(kind, year - e.start);
    else if (e.type === 'squeeze') people = band;
    else if (e.type === 'slump') people = -band;
    else if (e.type === 'closure' && e.edge) closed.push(e.edge);
  }
  return { people, children: 0, kids, closed };
}

/** What the player is told about one event: happening now, or announced for soon. */
export interface Notice {
  readonly id: number;
  readonly type: EventType;
  readonly when: 'now' | 'soon';
  readonly start: number;
  /** The first year it is over. */
  readonly until: number;
  /** Whether it is still running when the run ends. */
  readonly outlastsRun: boolean;
  readonly lasts: number;
  /** A closure's stretch. */
  readonly edge: EdgeKey | null;
  /** A running wave: how much more each school holds this year. */
  readonly kids: Readonly<Record<SchoolKind, number>> | null;
}

/**
 * The notices for a year: what is happening now, and what has been announced.
 * @param clock - the clock
 * @param band - how far the city must stretch
 * @param rules - the clock's rules
 */
export function notices(clock: Clock, band: number, rules: RunRules): Notice[] {
  const out: Notice[] = [];
  const year = clock.year;
  for (const e of clock.events) {
    const now = isActive(e, year);
    const soon = isAnnounced(e, year);
    if (!now && !soon) continue;
    // There was no line to close.
    if (e.type === 'closure' && !e.edge) continue;
    const until = e.start + e.lasts;
    out.push({
      id: e.id,
      type: e.type,
      when: now ? 'now' : 'soon',
      start: e.start,
      until,
      outlastsRun: until > rules.years,
      lasts: e.lasts,
      edge: e.type === 'closure' ? (e.edge ?? null) : null,
      kids: e.type === 'families' && now ? (stressAt(clock, band).kids ?? null) : null,
    });
  }
  return out;
}

/**
 * The stretch a closure closes: one of the closable stretches, picked from the run's seed and the event's id.
 * @returns the edge, or null when there is no line
 */
export function pickEdge(layout: Layout, seed: number, eventId: number): EdgeKey | null {
  const from = closable(layout);
  if (!from.length) return null;
  return from[Math.floor(dice(seed + 7919 * eventId)() * from.length)] ?? null;
}
