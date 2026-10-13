/**
 * @file The ground plan of one neighborhood, drawn from the Ledger: rows of townhouses, the center, the park and
 * the bike lane on the surface; the entries, the walkway, the goods pipe and the stop underneath.
 * Public interface: planNeighborhood, GroundError, GroundErrorReason.
 * Owner context: Ground (domain). Reads the Ledger; decides nothing the Ledger already fixed.
 *
 * What the Ledger fixes is laid out so the sums come out exactly: the homes and their frontage, the park's
 * area, the lane's length, the entries' count and spacing, the pipe's length. Where the Ledger is silent, a
 * placement is chosen and named in the plan's placeholder list.
 */
import { WALK_M_PER_MIN } from '@city/ledger';
import type { SharedPremises, WalkingCityLedger, WalkingCityPremises } from '@city/ledger';
import { gridPoints, halfWidthAt, hexDistance, hexFrame, segment } from './frame.ts';
import type { Frame, GridPoint, Point, Segment } from './frame.ts';
import type { Disc, Entry, NeighborhoodPlan, Placeholder, Row } from './plan.ts';

/** Why a plan could not be drawn. */
export type GroundErrorReason =
  | 'homes-do-not-fit'
  | 'entries-do-not-fit'
  | 'figure-not-positive'
  | 'no-ring-buildings'
  | 'buildings-overlap';

/** The plan refused: the figures given cannot be laid out. */
export class GroundError extends Error {
  readonly reason: GroundErrorReason;
  constructor(reason: GroundErrorReason) {
    super(reason);
    this.name = 'GroundError';
    this.reason = reason;
  }
}

/** The six neighbors of a grid point, in the order the walkway looks for its way to the stop. */
const DIRECTIONS: readonly (readonly [number, number])[] = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

/** The narrowest spacing of rows the search will try, metres. */
const LEAST_PITCH_M = 8;
/** The search tries pitches this far apart, metres. */
const PITCH_STEP_M = 0.25;
/** Middle of the center to its edge, metres. The Ledger does not size the center: a placeholder. */
const CENTER_RADIUS_M = 80;
/** Open ground between the center and the park, metres. A placeholder. */
const PARK_GAP_M = 20;
/** The placements this plan chooses, in the order the Board lists them. */
const PLACEHOLDERS: readonly Placeholder[] = [
  'row-pitch',
  'row-positions',
  'center-size',
  'park-position',
  'lane-edges',
  'entry-positions',
  'pipe-positions',
];

function positive(...figures: readonly number[]): void {
  for (const f of figures) if (!(f > 0) || !Number.isFinite(f)) throw new GroundError('figure-not-positive');
}

function disc(at: Point, areaM2: number): Disc {
  return { at, radiusM: Math.sqrt(areaM2 / Math.PI), areaM2 };
}

/** The stretches of the line y that lie on the frame and clear the discs, west to east. */
function openSpans(frame: Frame, y: number, discs: readonly Disc[]): (readonly [number, number])[] {
  const w = halfWidthAt(frame, y);
  if (w <= 0) return [];
  let spans: (readonly [number, number])[] = [[-w, w]];
  for (const d of discs) {
    const dy = y - d.at.y;
    if (Math.abs(dy) >= d.radiusM) continue;
    const dx = Math.sqrt(d.radiusM * d.radiusM - dy * dy);
    const next: (readonly [number, number])[] = [];
    for (const [a, b] of spans) {
      if (d.at.x - dx > a) next.push([a, Math.min(b, d.at.x - dx)]);
      if (d.at.x + dx < b) next.push([Math.max(a, d.at.x + dx), b]);
    }
    spans = next;
  }
  return spans;
}

/** Rows at one pitch, top to bottom, holding whole homes until all are placed; null when the tile is too small. */
function layRows(
  frame: Frame,
  discs: readonly Disc[],
  pitchM: number,
  homes: number,
  frontM: number,
  stories: number,
): Row[] | null {
  const rows: Row[] = [];
  let left = homes;
  for (let y = -frame.cornerM + pitchM / 2; y < frame.cornerM && left > 0; y += pitchM) {
    for (const [a, b] of openSpans(frame, y, discs)) {
      if (left <= 0) break;
      const fit = Math.floor((b - a) / frontM);
      if (fit <= 0) continue;
      const n = Math.min(fit, left);
      const frontageM = n * frontM;
      const x0 = (a + b) / 2 - frontageM / 2;
      rows.push({ y, x0, x1: x0 + frontageM, homes: n, frontageM, stories });
      left -= n;
    }
  }
  return left > 0 ? null : rows;
}

/** The middle of every home's front, row by row. */
function homeSpots(rows: readonly Row[], frontM: number): Point[] {
  const out: Point[] = [];
  for (const row of rows) {
    for (let i = 0; i < row.homes; i++) out.push({ x: row.x0 + (i + 0.5) * frontM, y: row.y });
  }
  return out;
}

/** For each home, the index of the nearest of the given points. */
function nearest(homes: readonly Point[], points: readonly Point[]): number[] {
  return homes.map((h) => {
    let best = 0;
    let bestD = Infinity;
    points.forEach((p, i) => {
      const d = (p.x - h.x) ** 2 + (p.y - h.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  });
}

/**
 * The entries: the given count of grid points, chosen where the homes are, the one under the stop always among them.
 * Each entry's walkway runs one grid step toward the stop.
 */
function placeEntries(
  candidates: readonly GridPoint[],
  homes: readonly Point[],
  count: number,
): { entries: Entry[]; walkMins: number[] } {
  if (candidates.length < count || candidates[0] === undefined || hexDistance(candidates[0].q, candidates[0].r) !== 0) {
    throw new GroundError('entries-do-not-fit');
  }
  const first = nearest(homes, candidates);
  const held = candidates.map(() => 0);
  for (const i of first) held[i] = (held[i] ?? 0) + 1;
  // Keep the stop's entry and every inner ring whole, so each entry is one step from the next in; on the
  // outermost ring kept, the points holding the most homes stay. Candidates arrive nearest the stop first.
  const order = candidates.map((_, i) => i).slice(1);
  const steps = (i: number): number => {
    const p = candidates[i] as GridPoint;
    return hexDistance(p.q, p.r);
  };
  order.sort((a, b) => steps(a) - steps(b) || (held[b] ?? 0) - (held[a] ?? 0) || a - b);
  const kept = [0, ...order.slice(0, count - 1)].sort((a, b) => a - b).map((i) => candidates[i] as GridPoint);
  const byKey = new Map<string, number>();
  kept.forEach((p, i) => byKey.set(`${p.q},${p.r}`, i));
  const assigned = nearest(homes, kept);
  const sharing = kept.map(() => 0);
  const walkMins: number[] = [];
  assigned.forEach((i, h) => {
    sharing[i] = (sharing[i] ?? 0) + 1;
    const p = kept[i] as GridPoint;
    const home = homes[h] as Point;
    walkMins.push(Math.hypot(p.x - home.x, p.y - home.y) / WALK_M_PER_MIN);
  });
  const entries = kept.map((p, i): Entry => {
    const steps = hexDistance(p.q, p.r);
    const base = { at: { x: p.x, y: p.y }, homes: sharing[i] ?? 0, steps };
    if (steps === 0) return base;
    for (const [dq, dr] of DIRECTIONS) {
      const q = p.q + dq;
      const r = p.r + dr;
      if (hexDistance(q, r) !== steps - 1) continue;
      const j = byKey.get(`${q},${r}`);
      if (j === undefined) continue;
      const to = kept[j] as GridPoint;
      return { ...base, walkway: segment({ x: p.x, y: p.y }, { x: to.x, y: to.y }) };
    }
    // Inner rings are kept whole, so a kept point always has a kept neighbor one step in.
    throw new GroundError('entries-do-not-fit');
  });
  return { entries, walkMins };
}

/** The goods pipe: one length under each pair of rows, as long as the two rows' fronts together, halved. */
function layPipes(rows: readonly Row[], rowsPerPipe: number): Segment[] {
  const pipes: Segment[] = [];
  const per = Math.max(1, Math.round(rowsPerPipe));
  for (let i = 0; i < rows.length; i += per) {
    const group = rows.slice(i, i + per);
    let frontage = 0;
    let y = 0;
    let x0 = Infinity;
    for (const r of group) {
      frontage += r.frontageM;
      y += r.y;
      x0 = Math.min(x0, r.x0);
    }
    const m = frontage / per;
    y /= group.length;
    pipes.push(segment({ x: x0, y }, { x: x0 + m, y }));
  }
  return pipes;
}

/**
 * The ground plan of one neighborhood.
 * @param s - the shared premises (people per home)
 * @param c - your city's premises (townhouse height and front, entry walk, rows per pipe)
 * @param l - your city derived: the tile, the park, the entries, the lane, the stop
 * @returns the plan, with every sum the Ledger fixes reconciled and every other placement named a placeholder
 * @throws GroundError when a figure is not positive, the homes do not fit the tile at any pitch, or the tile has
 *   too few one-minute cells for the entries
 */
export function planNeighborhood(s: SharedPremises, c: WalkingCityPremises, l: WalkingCityLedger): NeighborhoodPlan {
  positive(s.hh, c.frontage, c.stories, c.entryWalkMin, c.detour, l.centerPop, l.reachKm, l.parks, l.entriesPerCenter);
  const frame = hexFrame(l.reachKm * 1000);
  const homes = Math.round(l.centerPop / s.hh);
  const frontageM = homes * c.frontage;

  // The surface: the center in the middle, the park beside it toward a corner, the rows wherever they fit.
  const center = disc({ x: 0, y: 0 }, Math.PI * CENTER_RADIUS_M * CENTER_RADIUS_M);
  const parkM2 = l.parks * l.centerPop;
  const parkR = Math.sqrt(parkM2 / Math.PI);
  // Toward the top corner, where the tile reaches farthest from the center.
  const park = disc({ x: 0, y: -(CENTER_RADIUS_M + PARK_GAP_M + parkR) }, parkM2);
  const groundPerHome = (l.footprint + l.yards + l.streets) * s.hh;
  let pitchM = Math.floor(groundPerHome / c.frontage / PITCH_STEP_M) * PITCH_STEP_M;
  let rows: Row[] | null = null;
  for (; pitchM >= LEAST_PITCH_M && rows === null; pitchM -= PITCH_STEP_M) {
    rows = layRows(frame, [center, park], pitchM, homes, c.frontage, c.stories);
  }
  if (rows === null) throw new GroundError('homes-do-not-fit');
  pitchM += PITCH_STEP_M;
  const lane: Segment[] = [];
  for (let k = 0; k < 3; k++) lane.push(segment(frame.corners[k] as Point, frame.corners[k + 1] as Point));

  // The sub level: the stop under the center, an entry on each one-minute cell, the pipe under the rows.
  const entryCornerM = (c.entryWalkMin * WALK_M_PER_MIN) / c.detour;
  const spacingM = entryCornerM * Math.sqrt(3);
  const count = Math.max(1, Math.round(l.entriesPerCenter));
  const { entries, walkMins } = placeEntries(gridPoints(frame, spacingM), homeSpots(rows, c.frontage), count);
  const pipes = layPipes(rows, c.rowsPerPipe);

  // The sums, checked against what they were laid out from.
  const rowHomes = rows.reduce((n, r) => n + r.homes, 0);
  const rowFront = rows.reduce((m, r) => m + r.frontageM, 0);
  const laneM = lane.reduce((m, e) => m + e.m, 0);
  const walkwayM = entries.reduce((m, e) => m + (e.walkway ? e.walkway.m : 0), 0);
  const pipeM = pipes.reduce((m, p) => m + p.m, 0);
  const sharing = entries.reduce((n, e) => n + e.homes, 0);
  const close = (a: number, b: number): boolean => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));
  if (rowHomes !== homes || !close(rowFront, frontageM)) throw new GroundError('homes-do-not-fit');
  if (entries.length !== count || sharing !== homes) throw new GroundError('entries-do-not-fit');
  if (!close(walkwayM, (count - 1) * spacingM)) throw new GroundError('entries-do-not-fit');
  if (!close(pipeM, frontageM / Math.max(1, Math.round(c.rowsPerPipe)))) throw new GroundError('homes-do-not-fit');
  if (!close(laneM, 3 * frame.cornerM) || !close(park.areaM2, parkM2)) throw new GroundError('figure-not-positive');

  return {
    kind: 'neighborhood',
    frame,
    figures: {
      people: l.centerPop,
      homes,
      stories: c.stories,
      frontageM,
      rows: rows.length,
      parkM2,
      laneM,
      entries: count,
      homesPerEntry: homes / count,
      walkwayM,
      pipeM,
      farthestEntryWalkMin: walkMins.reduce((a, b) => Math.max(a, b), 0),
      rowPitchM: pitchM,
    },
    surface: { of: 'neighborhood', level: 'surface', rows, center, park, lane },
    sub: { of: 'neighborhood', level: 'sub', stop: { at: { x: 0, y: 0 }, berths: l.berths }, entries, pipes },
    placeholders: PLACEHOLDERS,
  };
}
