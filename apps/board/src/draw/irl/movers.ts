/**
 * @file The fleet of movers running the line: a cosmetic layer of the Board that decides no fact of the city
 * (ADR-0023 Decision 4). The line is a graph of stretches between tile middles, the fleet is sized from the Ledger
 * (so many movers per thousand people, split into pods, cabs and shuttles by the Ledger's mix), and each mover is a
 * state (its stretch, which way, how far along, how long it still waits at a stop) stepped by wall-clock seconds:
 * it runs its stretch at its class's speed, dwells at the stop it reaches, then takes an open stretch chosen by a
 * seeded hash of the mover and its leg, never a closed one and never straight back unless the stop is a dead end.
 * Reconciling to a new fleet or a new line adds and removes movers without moving the rest; only a mover standing on
 * a stretch that has gone, or closed, is set down at the nearer stop. Pure and deterministic: no DOM, no clock of
 * its own, the same states and seconds give the same states.
 * Public interface: MoverClass, Fleet, LineGraph, MoverState, Placed, SPEED_M_S, DWELL_S, fleetOf, graphOf, spawn,
 * reconcile, step, placeOf.
 * Owner context: Board (adapter), the IRL view (plan irl-3d-city-view, ADR-0023).
 */
import type { VehicleClassName, WalkingCityLedger } from '@city/ledger';
import { edgeEnds } from '@city/site';
import type { EdgeKey, Layout, SiteRates, TileKey } from '@city/site';
import type { Point } from '@city/ground';
import { tileCenterM } from '../angled/scene.ts';
import { hashOf } from './facade.ts';

/** The three sizes of mover, the Ledger's. */
export type MoverClass = VehicleClassName;

/** How many of each run. */
export type Fleet = Readonly<Record<MoverClass, number>>;

/** Metres a second each class runs at on the guideway (Mine: a pod 36 km/h, a cab 40, a shuttle 30). */
export const SPEED_M_S: Readonly<Record<MoverClass, number>> = { pod: 10, cab: 11, shuttle: 8.3 };

/** Seconds a mover waits at a stop (Mine). */
export const DWELL_S = 12;

/** The order the classes are filled in, the Ledger's. */
const CLASS_ORDER: readonly MoverClass[] = ['pod', 'cab', 'shuttle'];

/** The line as a graph: every stretch with its ends and length, and the open stretches at each stop. */
export interface LineGraph {
  readonly edges: Readonly<Record<EdgeKey, { readonly a: TileKey; readonly b: TileKey; readonly lengthM: number; readonly closed: boolean }>>;
  /** The open stretches leaving each tile the line touches. */
  readonly open: Readonly<Record<TileKey, readonly EdgeKey[]>>;
  /** Tile middles, metres. */
  readonly at: Readonly<Record<TileKey, Point>>;
}

/** One mover: where it is on the line and what it is doing. */
export interface MoverState {
  readonly id: number;
  readonly cls: MoverClass;
  readonly edge: EdgeKey;
  /** True when running from the stretch's `a` end to its `b` end. */
  readonly forward: boolean;
  /** Metres along the stretch from the end it left. */
  readonly alongM: number;
  /** Seconds still to wait at the stop it has reached; 0 while running. */
  readonly dwellS: number;
  /** Stretches run so far, the seed of its next choice. */
  readonly legs: number;
}

/** Where a mover is on the ground, and which way it points (radians, atan2 of its heading in scene metres). */
export interface Placed {
  readonly x: number;
  readonly y: number;
  readonly heading: number;
}

/**
 * The fleet for so many people, from the Ledger: the fleet per thousand, split by the Ledger's mix, the pods taking
 * the rounding so the classes sum to the whole.
 * @param people - living in the city now
 * @param base - the walking city's ledger (`RATES.base`)
 */
export function fleetOf(people: number, base: WalkingCityLedger): Fleet {
  const total = Math.max(0, Math.round((base.fleetPer1000 * people) / 1000));
  const cab = Math.round(total * base.mix.cab);
  const shuttle = Math.round(total * base.mix.shuttle);
  return { pod: Math.max(0, total - cab - shuttle), cab, shuttle };
}

/**
 * The line as a graph from the layout's stretches, with the closed ones marked and left out of what is open.
 * @param layout - what stands
 * @param rates - the Site's rates, for the tile radius
 * @param closed - stretches closed for repairs this year
 */
export function graphOf(layout: Layout, rates: SiteRates, closed: readonly EdgeKey[] = []): LineGraph {
  const shut = new Set(closed);
  const edges: Record<EdgeKey, { a: TileKey; b: TileKey; lengthM: number; closed: boolean }> = {};
  const open: Record<TileKey, EdgeKey[]> = {};
  const at: Record<TileKey, Point> = {};
  for (const edge of Object.keys(layout.lines).sort()) {
    const [a, b] = edgeEnds(edge);
    at[a] ??= tileCenterM(a, rates);
    at[b] ??= tileCenterM(b, rates);
    const pa = at[a] as Point;
    const pb = at[b] as Point;
    const isClosed = shut.has(edge);
    edges[edge] = { a, b, lengthM: Math.hypot(pb.x - pa.x, pb.y - pa.y), closed: isClosed };
    if (!isClosed) {
      (open[a] ??= []).push(edge);
      (open[b] ??= []).push(edge);
    }
  }
  return { edges, open, at };
}

/** A seeded pick among so many choices for a mover's leg. */
function pick(seed: number, id: number, legs: number, among: number): number {
  return hashOf(`${seed}:${id}:${legs}`) % among;
}

/** The stop a mover is heading for. */
function ahead(graph: LineGraph, m: MoverState): TileKey {
  const e = graph.edges[m.edge];
  if (!e) throw new RangeError(`no stretch ${m.edge}`);
  return m.forward ? e.b : e.a;
}

/** The stop a mover left. */
function behind(graph: LineGraph, m: MoverState): TileKey {
  const e = graph.edges[m.edge];
  if (!e) throw new RangeError(`no stretch ${m.edge}`);
  return m.forward ? e.a : e.b;
}

/**
 * A new mover on an open stretch leaving a stop, both chosen by its seed, already some seeded way along it so a fleet
 * that has just appeared is spread over the line rather than bunched at the stops.
 * @returns null when the line has no open stretch to run
 */
export function spawn(graph: LineGraph, id: number, cls: MoverClass, seed: number): MoverState | null {
  const stops = Object.keys(graph.open).sort();
  if (!stops.length) return null;
  const stop = stops[pick(seed, id, -1, stops.length)] as TileKey;
  const choices = graph.open[stop] ?? [];
  const edge = choices[pick(seed, id, 0, choices.length)] as EdgeKey;
  const e = graph.edges[edge];
  if (!e) return null;
  const alongM = (pick(seed, id, -2, 1000) / 1000) * e.lengthM;
  return { id, cls, edge, forward: e.a === stop, alongM, dwellS: 0, legs: 0 };
}

/**
 * The movers brought to a fleet and a line: those whose class has fewer than wanted are added (new ids, set down at
 * stops), those over are removed (highest ids first), a mover on a stretch that is gone or closed is set down at the
 * nearer stop, and every other mover is untouched.
 */
export function reconcile(graph: LineGraph, movers: readonly MoverState[], fleet: Fleet, seed: number): MoverState[] {
  const out: MoverState[] = [];
  const byClass: Record<MoverClass, MoverState[]> = { pod: [], cab: [], shuttle: [] };
  for (const m of [...movers].sort((p, q) => p.id - q.id)) byClass[m.cls].push(m);
  let nextId = movers.reduce((t, m) => Math.max(t, m.id + 1), 0);
  for (const cls of CLASS_ORDER) {
    const kept = byClass[cls].slice(0, fleet[cls]);
    for (const m of kept) {
      const e = graph.edges[m.edge];
      if (e && !e.closed) {
        out.push(m);
        continue;
      }
      // The stretch is gone or closed: set the mover down at the nearer of its ends that still has an open stretch.
      const ends = e ? [e.a, e.b] : [];
      const nearer = e && m.alongM > e.lengthM / 2 ? (m.forward ? e.b : e.a) : m.forward ? e?.a : e?.b;
      const stop = [nearer, ...ends].find((k): k is TileKey => k !== undefined && (graph.open[k]?.length ?? 0) > 0);
      if (!stop) continue;
      const choices = graph.open[stop] as readonly EdgeKey[];
      const edge = choices[pick(seed, m.id, m.legs, choices.length)] as EdgeKey;
      out.push({ ...m, edge, forward: graph.edges[edge]?.a === stop, alongM: 0, dwellS: DWELL_S });
    }
    for (let i = kept.length; i < fleet[cls]; i++) {
      const born = spawn(graph, nextId++, cls, seed);
      if (born) out.push(born);
    }
  }
  return out;
}

/**
 * One mover so many seconds on: it waits out its dwell, runs its stretch at its class's speed, and at the stop takes an
 * open stretch chosen by its seed and leg, not the one it came by unless that is the only one; at a stop with
 * nothing open it waits.
 */
function stepOne(graph: LineGraph, m: MoverState, seconds: number, seed: number): MoverState {
  let s = m;
  let left = seconds;
  for (let guard = 0; guard < 64 && left > 0; guard++) {
    if (s.dwellS > 0) {
      const wait = Math.min(s.dwellS, left);
      s = { ...s, dwellS: s.dwellS - wait };
      left -= wait;
      continue;
    }
    const e = graph.edges[s.edge];
    if (!e) return s;
    const speed = SPEED_M_S[s.cls];
    const toGo = e.lengthM - s.alongM;
    const run = speed * left;
    if (run < toGo) return { ...s, alongM: s.alongM + run };
    left -= toGo / speed;
    const stop = ahead(graph, s);
    const choices = (graph.open[stop] ?? []).filter((k) => k !== s.edge);
    const among = choices.length ? choices : (graph.open[stop] ?? []);
    if (!among.length) return { ...s, alongM: e.lengthM, dwellS: Number.POSITIVE_INFINITY };
    const legs = s.legs + 1;
    const edge = among[pick(seed, s.id, legs, among.length)] as EdgeKey;
    s = { ...s, edge, forward: graph.edges[edge]?.a === stop, alongM: 0, dwellS: DWELL_S, legs };
  }
  return s;
}

/**
 * Every mover so many seconds on. Seconds that are not positive leave the fleet as it is.
 * @param graph - the line, with the closed stretches left out of what is open
 * @param movers - the fleet as it stands
 * @param seconds - wall-clock seconds since the last step
 * @param seed - the run's seed, so the same fleet takes the same turns
 */
export function step(graph: LineGraph, movers: readonly MoverState[], seconds: number, seed: number): MoverState[] {
  if (!(seconds > 0)) return [...movers];
  return movers.map((m) => stepOne(graph, m, seconds, seed));
}

/** Where a mover is on the ground, metres, and the way it faces (along its stretch; at a stop, the way it arrived). */
export function placeOf(graph: LineGraph, m: MoverState): Placed {
  const from = graph.at[behind(graph, m)];
  const to = graph.at[ahead(graph, m)];
  if (!from || !to) throw new RangeError(`no stop for ${m.edge}`);
  const len = graph.edges[m.edge]?.lengthM ?? 1;
  const t = Math.max(0, Math.min(1, m.alongM / len));
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, heading: Math.atan2(to.y - from.y, to.x - from.x) };
}
