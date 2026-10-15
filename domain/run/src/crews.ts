/**
 * @file Which jobs have a crew (ADR-0012). On the sketch's clock the first so many jobs with work left have one, in
 * the order they stand. With `inOrder` the jobs are taken class by class first: what people need before they can live
 * anywhere (the line, ring buildings, reactor modules, plant units and schools), then fields, then neighborhoods; within
 * a class, in the order they stand.
 * Public interface: PieceClass, classOf, crewed.
 * Owner context: Run (domain).
 */
import type { Job } from './jobs.ts';
import type { PieceKind } from './rules.ts';

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
 * @returns one flag per job, in the list's order
 */
export function crewed(jobs: readonly Job[], crews: number, inOrder: boolean): boolean[] {
  if (!Number.isInteger(crews) || crews < 0) throw new Error(`crews must be a whole number, not ${crews}`);
  const open = jobs.map((j, i) => ({ i, c: inOrder ? classOf(j.what) : 0, left: j.left })).filter((x) => x.left > 0);
  open.sort((a, b) => a.c - b.c || a.i - b.i);
  const out = jobs.map(() => false);
  for (const x of open.slice(0, crews)) out[x.i] = true;
  return out;
}
