/**
 * @file The mover line as drawn: which tiles it touches, how many stretches lie between two of them, and which stretches
 * have no way round them.
 * Public interface: LineNetwork, lineNetwork, closable, bridges, Bridge.
 * Owner context: Site (domain).
 */
import { edgeEnds } from './board.ts';
import type { EdgeKey, TileKey } from './board.ts';
import type { Layout } from './layout.ts';

/** The line as a graph. */
export interface LineNetwork {
  /** Whether the line touches a tile, so a stop sits under it. */
  readonly onLine: (key: TileKey) => boolean;
  /** Stretches between two tiles along the line, or null when the line does not join them. */
  readonly segments: (a: TileKey, b: TileKey) => number | null;
}

/**
 * Build the network from a set of stretches.
 * @param lines - the stretches, as keys
 */
export function lineNetwork(lines: Readonly<Record<EdgeKey, true>>): LineNetwork {
  const next: Record<TileKey, TileKey[]> = {};
  for (const e of Object.keys(lines)) {
    const [a, b] = edgeEnds(e);
    (next[a] ??= []).push(b);
    (next[b] ??= []).push(a);
  }
  const hops: Record<TileKey, Record<TileKey, number>> = {};
  for (const from of Object.keys(next)) {
    const seen: Record<TileKey, number> = { [from]: 0 };
    const queue = [from];
    for (let i = 0; i < queue.length; i++) {
      const here = queue[i];
      if (here === undefined) break;
      const far = seen[here] ?? 0;
      for (const n of next[here] ?? []) {
        if (!(n in seen)) {
          seen[n] = far + 1;
          queue.push(n);
        }
      }
    }
    hops[from] = seen;
  }
  return {
    onLine: (k) => Boolean(next[k]),
    segments: (a, b) => {
      const from = hops[a];
      if (!from) return null;
      const n = from[b];
      return n === undefined ? null : n;
    },
  };
}

/**
 * The stretches a repair might close for a year: those with a neighborhood at one end, or any at all if none has.
 * @param layout - the board
 * @returns edge keys, sorted
 */
export function closable(layout: Layout): EdgeKey[] {
  const edges = Object.keys(layout.lines).sort();
  const felt = edges.filter((e) => edgeEnds(e).some((k) => layout.tiles[k]?.kind === 'hood'));
  return felt.length ? felt : edges;
}

/** A stretch with no way round it, and how many neighborhoods closing it cuts off. */
export interface Bridge {
  readonly edge: EdgeKey;
  readonly cut: number;
}

/**
 * Of the closable stretches, the ones with no way round them, the stretch that cuts off the most neighborhoods first.
 * @param layout - the board
 */
export function bridges(layout: Layout): Bridge[] {
  const next: Record<TileKey, { to: TileKey; e: EdgeKey }[]> = {};
  for (const e of Object.keys(layout.lines)) {
    const [a, b] = edgeEnds(e);
    (next[a] ??= []).push({ to: b, e });
    (next[b] ??= []).push({ to: a, e });
  }
  const side = (from: TileKey, without: EdgeKey): Record<TileKey, true> => {
    const seen: Record<TileKey, true> = { [from]: true };
    const queue = [from];
    for (let i = 0; i < queue.length; i++) {
      const here = queue[i];
      if (here === undefined) break;
      for (const n of next[here] ?? []) {
        if (n.e !== without && !seen[n.to]) {
          seen[n.to] = true;
          queue.push(n.to);
        }
      }
    }
    return seen;
  };
  const is = (k: TileKey, kind: string): boolean => layout.tiles[k]?.kind === kind;
  const out: Bridge[] = [];
  for (const e of closable(layout)) {
    const [a, b] = edgeEnds(e);
    const near = side(a, e);
    if (near[b]) continue;
    const sides = [Object.keys(near), Object.keys(side(b, e))].map((keys) => ({
      hoods: keys.filter((k) => is(k, 'hood')).length,
      ring: keys.some((k) => is(k, 'ring')),
    }));
    const first = sides[0];
    const second = sides[1];
    if (!first || !second) continue;
    // The side cut off is the one without a ring; with a ring on both sides or on neither, the smaller one.
    const cut =
      first.ring !== second.ring ? (first.ring ? second.hoods : first.hoods) : Math.min(first.hoods, second.hoods);
    out.push({ edge: e, cut });
  }
  return out.sort((x, y) => y.cut - x.cut || (x.edge < y.edge ? -1 : 1));
}
