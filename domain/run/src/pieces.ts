/**
 * @file A layout as a bag of pieces, "what@where" to how many, and the board as it will stand when the work in hand is done.
 * Public interface: PieceId, pieceId, splitPiece, pieces, planned, Draft, draftOf, addPiece, removePiece.
 * Owner context: Run (domain).
 */
import { EXTRAS } from '@city/site';
import type { EdgeKey, ExtraKind, Layout, Tile, TileKey } from '@city/site';
import type { PieceKind } from './rules.ts';

/** "what@where": a kind of piece and the tile or stretch it stands on. */
export type PieceId = string;

/** One job's worth of building: what, and where. */
export interface Placed {
  readonly what: PieceKind;
  readonly at: TileKey | EdgeKey;
}

/** Name a piece. */
export function pieceId(what: PieceKind, at: string): PieceId {
  return `${what}@${at}`;
}

/** Read a piece's kind and place from its id, by walking to the @. */
export function splitPiece(id: PieceId): readonly [string, string] {
  const i = id.indexOf('@');
  if (i < 0) return [id, ''];
  return [id.slice(0, i), id.slice(i + 1)];
}

function isExtra(what: string): what is ExtraKind {
  return (EXTRAS as readonly string[]).includes(what);
}

/**
 * Count the pieces standing on a layout.
 * @param layout - the board
 * @returns piece id to how many
 */
export function pieces(layout: Layout): Record<PieceId, number> {
  const bag: Record<PieceId, number> = {};
  const put = (what: PieceKind, at: string, n: number): void => {
    bag[pieceId(what, at)] = (bag[pieceId(what, at)] ?? 0) + n;
  };
  for (const k of Object.keys(layout.tiles)) {
    const t = layout.tiles[k];
    if (!t) continue;
    if (t.kind === 'hood') {
      put('hood', k, 1);
      for (const x of EXTRAS) if (t.has[x]) put(x, k, 1);
    } else put(t.kind, k, t.n);
  }
  for (const e of Object.keys(layout.lines)) put('line', e, 1);
  return bag;
}

/** A layout that is ours to change while it is being built up. */
export interface Draft {
  tiles: Record<TileKey, Tile>;
  lines: Record<EdgeKey, true>;
  circles: readonly TileKey[];
}

/** A changeable copy of a layout. */
export function draftOf(layout: Layout): Draft {
  return { tiles: { ...layout.tiles }, lines: { ...layout.lines }, circles: layout.circles };
}

/**
 * Put one piece on a draft.
 * @returns false when it has nowhere to stand yet
 */
export function addPiece(draft: Draft, what: PieceKind, at: string): boolean {
  if (what === 'line') {
    draft.lines[at] = true;
    return true;
  }
  const t = draft.tiles[at];
  if (what === 'hood') {
    if (t) return false;
    draft.tiles[at] = { kind: 'hood', has: {} };
    return true;
  }
  if (isExtra(what)) {
    if (!t || t.kind !== 'hood') return false;
    draft.tiles[at] = { kind: 'hood', has: { ...t.has, [what]: true } };
    return true;
  }
  if (t && t.kind !== what) return false;
  const n = t ? t.n + 1 : 1;
  draft.tiles[at] = what === 'ring' ? { kind: 'ring', n } : { kind: what, n };
  return true;
}

/** Take one piece off a draft. Nothing happens when it is not there. */
export function removePiece(draft: Draft, what: PieceKind, at: string): void {
  if (what === 'line') {
    delete draft.lines[at];
    return;
  }
  const t = draft.tiles[at];
  if (!t) return;
  if (what === 'hood') {
    if (t.kind === 'hood') delete draft.tiles[at];
    return;
  }
  if (isExtra(what)) {
    if (t.kind !== 'hood' || !t.has[what]) return;
    const has: Partial<Record<ExtraKind, true>> = { ...t.has };
    delete has[what];
    draft.tiles[at] = { kind: 'hood', has };
    return;
  }
  if (t.kind !== what) return;
  if (t.n > 1) draft.tiles[at] = what === 'ring' ? { kind: 'ring', n: t.n - 1 } : { kind: what, n: t.n - 1 };
  else delete draft.tiles[at];
}

/**
 * The board as it will stand when all the work in hand is done. Neighborhoods go in before what stands in them.
 * @param layout - what stands
 * @param jobs - the work in hand
 */
export function planned(layout: Layout, jobs: readonly Placed[]): Layout {
  const plan = draftOf(layout);
  for (const j of jobs) if (!isExtra(j.what)) addPiece(plan, j.what, j.at);
  for (const j of jobs) if (isExtra(j.what)) addPiece(plan, j.what, j.at);
  return plan;
}
