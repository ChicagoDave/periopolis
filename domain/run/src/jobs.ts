/**
 * @file The work in hand: jobs in the order they stand, which have a crew, and how to put one first or drop one.
 * Public interface: Job, JobStatus, JobItem, SiteInHand, WorkInHand, inHand, cancelJob, putFirst.
 * Owner context: Run (domain).
 */
import { EXTRAS } from '@city/site';
import type { EdgeKey, ExtraKind, Layout, TileKey } from '@city/site';
import type { PieceKind, RunRules } from './rules.ts';

/** An order that takes years to become a building. */
export interface Job {
  readonly what: PieceKind;
  readonly at: TileKey | EdgeKey;
  /** Crew-years of work left. */
  readonly left: number;
  /** Crew-years it takes in all. */
  readonly total: number;
}

/** Working with a crew; waiting for one; or ready, finished and waiting for the place it stands in. */
export type JobStatus = 'working' | 'waiting' | 'ready';

/** One job as the player sees it. */
export interface JobItem extends Job {
  readonly index: number;
  readonly status: JobStatus;
}

/** A tile with nothing standing on it yet, and the jobs that will put something there. */
export interface SiteInHand {
  readonly kind: PieceKind;
  /** Jobs for this tile. */
  readonly n: number;
  /** Years left on the job nearest done among those working, or the first job's otherwise. */
  readonly left: number;
  readonly status: JobStatus;
}

/** The work in hand, indexed the ways the board needs it. */
export interface WorkInHand {
  /** Open tiles that jobs will build on. */
  readonly sites: Readonly<Record<TileKey, SiteInHand>>;
  /** Schools and fields ordered for neighborhoods. */
  readonly extras: Readonly<Record<TileKey, Readonly<Partial<Record<ExtraKind, JobItem>>>>>;
  /** More units ordered for tiles that already stand. */
  readonly more: Readonly<Record<TileKey, number>>;
  /** Stretches of line ordered. */
  readonly lines: Readonly<Record<EdgeKey, JobItem>>;
  readonly list: readonly JobItem[];
  readonly working: number;
  readonly waiting: number;
  readonly crews: number;
}

function isExtra(what: PieceKind): what is ExtraKind {
  return (EXTRAS as readonly string[]).includes(what);
}

/**
 * Jobs are worked on in the order they stand: the first so many of them with work left have a crew.
 * @param layout - what stands
 * @param jobs - the work in hand, or null when the clock is stopped
 * @param rules - the clock's rules
 */
export function inHand(layout: Layout, jobs: readonly Job[] | null, rules: RunRules): WorkInHand {
  const sites: Record<TileKey, { kind: PieceKind; n: number; left: number; status: JobStatus }> = {};
  const extras: Record<TileKey, Partial<Record<ExtraKind, JobItem>>> = {};
  const more: Record<TileKey, number> = {};
  const lines: Record<EdgeKey, JobItem> = {};
  const list: JobItem[] = [];
  let working = 0;
  let waiting = 0;
  if (jobs) {
    jobs.forEach((j, index) => {
      const status: JobStatus = j.left <= 0 ? 'ready' : working < rules.crews ? 'working' : 'waiting';
      if (status === 'working') working++;
      else if (status === 'waiting') waiting++;
      const item: JobItem = { index, what: j.what, at: j.at, left: j.left, total: j.total, status };
      list.push(item);
      if (j.what === 'line') lines[j.at] = item;
      else if (isExtra(j.what)) (extras[j.at] ??= {})[j.what] = item;
      else if (layout.tiles[j.at]) more[j.at] = (more[j.at] ?? 0) + 1;
      else {
        const s = sites[j.at];
        if (!s) sites[j.at] = { kind: j.what, n: 1, left: j.left, status };
        else {
          s.n++;
          if (status === 'working' && (s.status !== 'working' || j.left < s.left)) {
            s.left = j.left;
            s.status = status;
          }
        }
      }
    });
  }
  return { sites, extras, more, lines, list, working, waiting, crews: rules.crews };
}

/**
 * Drop one job. Of several alike on one tile the latest goes, so a reactor site is the last of its jobs to be dropped.
 * A neighborhood takes with it whatever was ordered to stand in it.
 * @returns the jobs that remain; the same list when the index names nothing
 */
export function cancelJob(jobs: readonly Job[], index: number): readonly Job[] {
  const j = jobs[index];
  if (!j) return jobs;
  let last = index;
  jobs.forEach((x, i) => {
    if (x.what === j.what && x.at === j.at) last = i;
  });
  return jobs.filter((x, i) => i !== last && !(j.what === 'hood' && x.at === j.at && isExtra(x.what)));
}

/**
 * Put one job at the head of the list. Whatever loses its crew keeps the work already done on it.
 * @returns the reordered jobs; the same list when the index names nothing
 */
export function putFirst(jobs: readonly Job[], index: number): readonly Job[] {
  const j = jobs[index];
  if (!j) return jobs;
  return [j, ...jobs.filter((_x, i) => i !== index)];
}
