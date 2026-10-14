/**
 * @file The run: starting and stopping the clock, a year passing, and a clock read back from storage.
 * Public interface: Game, startRun, stopRun, tick, seenIn, restoreClock.
 * Owner context: Run (domain).
 */
import { LAYERS, adjacent, allTiles, assess, costOf, edgeEnds } from '@city/site';
import type { CheckId, CheckStatus, Layer, Layout, SiteRates, Stress } from '@city/site';

import type { Job } from './jobs.ts';
import { addPiece, draftOf, planned } from './pieces.ts';
import { PIECES } from './rules.ts';
import type { PieceKind, RunRules } from './rules.ts';
import { noMoney, spendOf, standingOf } from './spend.ts';
import type { Money } from './spend.ts';
import { beginClock, pickEdge, stressAt } from './timeline.ts';
import type { Clock, EventType, RecordRow, TimelineEvent } from './timeline.ts';

/** A game: what stands, and the clock, or null when the board is a plain plan. */
export interface Game {
  readonly layout: Layout;
  readonly clock: Clock | null;
}

const EXTRA_KINDS: readonly string[] = ['elementary', 'middle', 'high', 'fields'];

/**
 * The city as it stands in one year: who lives there, how many homes there are, which lines are broken, what it all
 * costs, and what the year spent against the year before.
 * @param layout - what stands
 * @param stress - this year's stress
 * @param year - the year
 * @param opened - what opened this year
 * @param rates - the ledger's rates
 * @param before - what stood a year before, by layer; null for year 0, which spends nothing
 */
export function seenIn(
  layout: Layout,
  stress: Stress,
  year: number,
  opened: Readonly<Partial<Record<PieceKind, number>>>,
  rates: SiteRates,
  before: Money | null = null,
): RecordRow {
  const a = assess(layout, rates, { now: stress });
  const t: Record<CheckStatus, number> = { ok: 0, warn: 0, bad: 0, idle: 0 };
  for (const c of a.checks) t[c.status]++;
  const broken: CheckId[] = a.checks.filter((c) => c.status === 'bad').map((c) => c.id);
  const standing = standingOf(costOf(layout, a, rates));
  return {
    year,
    pop: a.score.pop,
    homes: a.score.hoods * rates.hood,
    held: t.ok,
    warn: t.warn,
    bad: t.bad,
    broken,
    opened,
    standing,
    spend: spendOf(before, standing),
  };
}

/**
 * Start a run on whatever stands. Year 0 is noted in the record, and does not count.
 * @param layout - what stands
 * @param seed - the run's seed
 * @param rates - the ledger's rates
 * @param rules - the clock's rules
 */
export function startRun(layout: Layout, seed: number, rates: SiteRates, rules: RunRules): Game {
  const clock = beginClock(seed, rules);
  const record = [seenIn(layout, stressAt(clock, rates.band), 0, {}, rates, null)];
  return { layout, clock: { ...clock, record } };
}

/**
 * Stop the clock: the work in hand is finished at once, and the board is a plain plan again.
 */
export function stopRun(game: Game): Game {
  return { layout: game.clock ? planned(game.layout, game.clock.jobs) : game.layout, clock: null };
}

/** A school waits for its neighborhood, and a further reactor module for its site. Neither takes a crew while it waits. */
function waitsFor(j: Job, rules: RunRules): 'hood' | 'power' | null {
  if (EXTRA_KINDS.includes(j.what)) return 'hood';
  if (j.what === 'power' && j.total < rules.firstModule) return 'power';
  return null;
}

/**
 * One year passes: the crews work, what is finished opens, and the city is checked as it stands that year.
 * At the horizon, or with the clock stopped, the game is returned as it is.
 * @param game - the game
 * @param rates - the ledger's rates
 * @param rules - the clock's rules
 */
export function tick(game: Game, rates: SiteRates, rules: RunRules): Game {
  const clock = game.clock;
  if (!clock || clock.year >= rules.years) return game;
  const year = clock.year + 1;
  const draft = draftOf(game.layout);
  const jobs: { what: PieceKind; at: string; left: number; total: number }[] = clock.jobs.map((j) => ({ ...j }));
  const opened: Partial<Record<PieceKind, number>> = {};
  let crews = rules.crews;
  for (const j of jobs) {
    if (j.left > 0 && crews > 0) {
      j.left -= 1;
      crews--;
    }
  }
  const open = (j: Job): void => {
    addPiece(draft, j.what, j.at);
    opened[j.what] = (opened[j.what] ?? 0) + 1;
  };
  for (const j of jobs) if (j.left <= 0 && !waitsFor(j, rules)) open(j);
  const ready = (j: Job): boolean => {
    const host = draft.tiles[j.at];
    return Boolean(host) && host?.kind === waitsFor(j, rules);
  };
  const still: Job[] = [];
  for (const j of jobs) {
    if (j.left <= 0 && !waitsFor(j, rules)) continue;
    if (j.left <= 0 && ready(j)) open(j);
    else still.push(j);
  }
  const layout: Layout = { tiles: draft.tiles, lines: draft.lines };
  const events: TimelineEvent[] = clock.events.map((e) =>
    e.type === 'closure' && e.edge === undefined && year >= e.start - e.notice
      ? { ...e, edge: pickEdge(layout, clock.seed, e.id) }
      : e,
  );
  const next: Clock = { ...clock, year, jobs: still, events, record: clock.record, lineYears: clock.lineYears };
  const last = clock.record[clock.record.length - 1];
  const row = seenIn(layout, stressAt(next, rates.band), year, opened, rates, last ? last.standing : null);
  return {
    layout,
    clock: { ...next, record: [...clock.record, row], lineYears: clock.lineYears + row.bad },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function whole(x: unknown, lo: number, hi: number): x is number {
  return typeof x === 'number' && Number.isFinite(x) && Math.round(x) === x && x >= lo && x <= hi;
}

const EVENT_TYPES: readonly EventType[] = ['families', 'closure', 'squeeze', 'slump'];

/** Money by layer read back from storage: every layer a finite number, or nothing at all. */
function moneyOf(raw: unknown): Money {
  if (!isRecord(raw)) return noMoney();
  const out = {} as Record<Layer, number>;
  for (const layer of LAYERS) {
    const v = raw[layer];
    if (typeof v !== 'number' || !Number.isFinite(v)) return noMoney();
    out[layer] = v;
  }
  return out;
}

/**
 * Rebuild a clock from anything read back from storage, keeping only what a clock can hold against the layout it
 * will run on. A job that could never open, because the board has no place for it, is dropped.
 * @param raw - whatever was stored
 * @param layout - what stands
 * @param rates - the ledger's rates
 * @param rules - the clock's rules
 * @returns a clock, or null when the year or seed is not a clock's
 */
export function restoreClock(raw: unknown, layout: Layout, rates: SiteRates, rules: RunRules): Clock | null {
  if (!isRecord(raw)) return null;
  const year = raw['year'];
  const seed = raw['seed'];
  if (!whole(year, 0, rules.years) || typeof seed !== 'number' || !Number.isFinite(seed)) return null;
  const tiles = allTiles(rates.outline);
  const edgeOk = (e: unknown): e is string => {
    if (typeof e !== 'string' || e.indexOf('|') <= 0) return false;
    const [a, b] = edgeEnds(e);
    return tiles.includes(a) && tiles.includes(b) && adjacent(a, b, rates.outline);
  };
  const jobs: Job[] = [];
  const rawJobs = raw['jobs'];
  for (const j of Array.isArray(rawJobs) ? rawJobs : []) {
    if (!isRecord(j)) continue;
    const what = j['what'];
    if (typeof what !== 'string' || !(PIECES as readonly string[]).includes(what)) continue;
    if (!whole(j['left'], 0, rules.firstModule) || !whole(j['total'], 1, rules.firstModule)) continue;
    const at = j['at'];
    if (what === 'line' ? !edgeOk(at) : !(typeof at === 'string' && tiles.includes(at))) continue;
    jobs.push({ what: what as PieceKind, at: at as string, left: j['left'] as number, total: j['total'] as number });
  }
  const plan = draftOf(layout);
  const kept: Job[] = [];
  for (const j of jobs) if (!EXTRA_KINDS.includes(j.what) && addPiece(plan, j.what, j.at)) kept.push(j);
  for (const j of jobs) {
    if (!EXTRA_KINDS.includes(j.what)) continue;
    const host = plan.tiles[j.at];
    const standing = host && host.kind === 'hood' && host.has[j.what as 'elementary' | 'middle' | 'high' | 'fields'];
    if (!standing && addPiece(plan, j.what, j.at)) kept.push(j);
  }
  const inOrder = jobs.filter((j) => kept.includes(j));
  const events: TimelineEvent[] = [];
  const rawEvents = raw['events'];
  for (const e of Array.isArray(rawEvents) ? rawEvents : []) {
    if (!isRecord(e)) continue;
    const type = e['type'];
    if (typeof type !== 'string' || !(EVENT_TYPES as readonly string[]).includes(type)) continue;
    if (!whole(e['id'], 1, 99) || !whole(e['start'], 1, rules.years) || !whole(e['lasts'], 1, rules.years) || !whole(e['notice'], 0, 5)) continue;
    const out: TimelineEvent = {
      id: e['id'] as number,
      type: type as EventType,
      start: e['start'] as number,
      lasts: e['lasts'] as number,
      notice: e['notice'] as number,
    };
    if (type === 'closure' && e['edge'] !== undefined) events.push({ ...out, edge: edgeOk(e['edge']) ? e['edge'] : null });
    else events.push(out);
  }
  const record: RecordRow[] = [];
  const rawRecord = raw['record'];
  for (const r of Array.isArray(rawRecord) ? rawRecord : []) {
    if (!isRecord(r)) continue;
    const pop = r['pop'];
    if (!whole(r['year'], 0, rules.years) || typeof pop !== 'number' || !Number.isFinite(pop) || !whole(r['bad'], 0, 99)) continue;
    const opened: Partial<Record<PieceKind, number>> = {};
    const rawOpened = r['opened'];
    if (isRecord(rawOpened)) for (const what of PIECES) if (whole(rawOpened[what], 1, 999)) opened[what] = rawOpened[what] as number;
    const homes = r['homes'];
    const broken = r['broken'];
    record.push({
      year: r['year'] as number,
      pop,
      homes: typeof homes === 'number' && Number.isFinite(homes) ? homes : pop,
      held: whole(r['held'], 0, 99) ? r['held'] : 0,
      warn: whole(r['warn'], 0, 99) ? r['warn'] : 0,
      bad: r['bad'] as number,
      broken: Array.isArray(broken) ? (broken.filter((x) => typeof x === 'string').slice(0, 40) as CheckId[]) : [],
      opened,
      standing: moneyOf(r['standing']),
      spend: moneyOf(r['spend']),
    });
  }
  return {
    year,
    seed: seed >>> 0,
    jobs: inOrder,
    events,
    record,
    lineYears: record.filter((r) => r.year > 0).reduce((t, r) => t + r.bad, 0),
  };
}


