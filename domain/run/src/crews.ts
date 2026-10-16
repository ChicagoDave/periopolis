/**
 * @file Which jobs have a crew (ADR-0012). On the sketch's clock the first so many jobs with work left have one, in
 * the order they stand. With `inOrder` the jobs are taken class by class first: what people need before they can live
 * anywhere (the line, ring buildings, reactor modules, plant units and schools), then fields, then neighborhoods; within
 * a class, in the order they stand. Above all three, when people already living there are short of water, sewage, waste
 * or power, the jobs that restore it are an emergency (ADR-0012 Decision 7).
 * Public interface: PieceClass, classOf, crewed, emergencyOf.
 * Owner context: Run (domain).
 */
import { PLANTS } from '@city/site';
import type { Job } from './jobs.ts';
import type { PieceKind } from './rules.ts';
import type { Clock } from './timeline.ts';

/** The order classes are crewed in: 0 first. */
export type PieceClass = 0 | 1 | 2;

const CLASS: Readonly<Record<PieceKind, PieceClass>> = {
  line: 0,
  ring: 0,
  power: 0,
  water: 0,
  sewage: 0,
  waste: 0,
  elementary: 0,
  middle: 0,
  high: 0,
  fields: 1,
  hood: 2,
};

/**
 * The class a piece is crewed in.
 * @param what - the piece
 */
export function classOf(what: PieceKind): PieceClass {
  return CLASS[what];
}

/**
 * Which jobs have a crew: for each job in the list, whether one of the crews is on it. Jobs with no work left never
 * have one.
 * @param jobs - the work in hand, in the order it stands
 * @param crews - crews at work at once
 * @param inOrder - take the jobs class by class (ADR-0012); false is the sketch's order
 * @param emergency - pieces that restore a service people living there are short of: crewed ahead of every class, and
 *   only with `inOrder`
 * @returns one flag per job, in the list's order
 */
export function crewed(jobs: readonly Job[], crews: number, inOrder: boolean, emergency: readonly PieceKind[] = []): boolean[] {
  if (!Number.isInteger(crews) || crews < 0) throw new Error(`crews must be a whole number, not ${crews}`);
  const rank = (what: PieceKind): number => (!inOrder ? 0 : emergency.includes(what) ? -1 : classOf(what));
  const open = jobs.map((j, i) => ({ i, c: rank(j.what), left: j.left })).filter((x) => x.left > 0);
  open.sort((a, b) => a.c - b.c || a.i - b.i);
  const out = jobs.map(() => false);
  for (const x of open.slice(0, crews)) out[x.i] = true;
  return out;
}

/**
 * The services people living in the city are short of in the year last recorded, as the pieces that restore them: an
 * emergency for the crews (ADR-0012 Decision 7). Only on a clock built in order, where nobody is counted in a
 * neighborhood not lived in, so a broken service is always a lived-in shortfall.
 * @param clock - the clock
 * @returns the short kinds, empty off a clock built in order or with nothing short
 */
export function emergencyOf(clock: Clock): PieceKind[] {
  if (!clock.inOrder) return [];
  const last = clock.record[clock.record.length - 1];
  return last ? PLANTS.filter((p) => last.broken.includes(p)) : [];
}
