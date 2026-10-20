/**
 * @file Where each need goes: a Proposal gives a need the tiles and the ordinary commands that would build it, and its
 * price; nothing here changes the layout it is given (ADR-0008 Decision 4).
 * Public interface: Step, Proposal, proposeFor, applyProposal, proposeNeighborhood.
 * Owner context: Site (domain).
 *
 * Proposals are made one need at a time: the first need is proposed, its steps applied to a scratch layout, and the
 * needs read again, so what one addition calls for in turn (a new plant needs the line) is proposed after it. Every
 * choice is deterministic; ties go to the tile first in the board's order. A need nothing on the board can meet ends
 * the list with a "no room" proposal rather than a tile a command would refuse.
 */
import { assessCore } from './assess.ts';
import { allTiles, edgeKey, kmBetween, neighbors } from './board.ts';
import type { TileKey } from './board.ts';
import { NO_STRESS } from './checks.ts';
import { addPlantUnit, addRingBuilding, layStretch, toggleExtra } from './commands.ts';
import type { SiteEvent, SiteRejection } from './commands.ts';
import { costOf } from './cost.ts';
import type { Layout } from './layout.ts';
import { lineNetwork } from './network.ts';
import { needsOf } from './needs.ts';
import type { Need } from './needs.ts';
import type { ExtraKind, PlantKind, SiteRates } from './rates.ts';

/** One ordinary command a proposal would run. */
export type Step =
  | { readonly command: 'addRingBuilding'; readonly tile: TileKey }
  | { readonly command: 'addPlantUnit'; readonly tile: TileKey; readonly plant: PlantKind }
  | { readonly command: 'toggleExtra'; readonly tile: TileKey; readonly extra: ExtraKind }
  | { readonly command: 'layStretch'; readonly from: TileKey; readonly to: TileKey };

/** A need with where it goes and what it costs, or a need the board has no room for. */
export type Proposal =
  | {
      readonly need: Need;
      readonly room: true;
      readonly steps: readonly Step[];
      /** Dollars to build, and a year to run, that the steps add to the city. */
      readonly build: number;
      readonly run: number;
    }
  | { readonly need: Need; readonly room: false };

const MOST_ROUNDS = 200;

/**
 * Propose where every need of a layout goes, in the order they would be built.
 * @param layout - the board
 * @param rates - the ledger's rates
 * @returns the proposals; empty when the layout needs nothing; the last one has no room when the board cannot hold it
 */
export function proposeFor(layout: Layout, rates: SiteRates): readonly Proposal[] {
  const out: Proposal[] = [];
  let scratch = layout;
  for (let round = 0; round < MOST_ROUNDS; round++) {
    const need = needsOf(scratch, rates)[0];
    if (!need) return out;
    const steps = stepsFor(need, scratch, rates);
    const applied = steps ? applyProposal(scratch, steps, rates) : null;
    if (!steps || !applied || !applied.ok || sameNeeds(needsOf(applied.layout, rates), needsOf(scratch, rates))) {
      out.push({ need, room: false });
      return out;
    }
    const before = priced(scratch, rates);
    const after = priced(applied.layout, rates);
    out.push({ need, room: true, steps, build: after.build - before.build, run: after.run - before.run });
    scratch = applied.layout;
  }
  throw new Error(`proposals did not settle in ${MOST_ROUNDS} rounds`);
}

/**
 * Run a proposal's steps through the ordinary commands, in order.
 * @param layout - the board
 * @param steps - the steps of one proposal
 * @param rates - the ledger's rates
 * @returns the new layout and every step's event, or the first step's rejection; the given layout is not changed
 */
export function applyProposal(
  layout: Layout,
  steps: readonly Step[],
  rates: SiteRates,
): { readonly ok: true; readonly layout: Layout; readonly events: readonly SiteEvent[] } | { readonly ok: false; readonly rejection: SiteRejection } {
  let s = layout;
  const events: SiteEvent[] = [];
  for (const step of steps) {
    const o =
      step.command === 'addRingBuilding'
        ? addRingBuilding(s, step.tile, rates)
        : step.command === 'addPlantUnit'
          ? addPlantUnit(s, step.tile, step.plant, rates)
          : step.command === 'toggleExtra'
            ? toggleExtra(s, step.tile, step.extra, rates)
            : layStretch(s, step.from, step.to, rates);
    if (!o.ok) return { ok: false, rejection: o.rejection };
    s = o.layout;
    events.push(o.event);
  }
  return { ok: true, layout: s, events };
}

/**
 * Where the next neighborhood goes (ADR-0015 Decision 3): the open tile nearest the ring, or nearest the standing
 * neighborhoods when there is no ring, or the middle of the board when nothing stands; first in the board's tile order
 * among equals. Nothing here changes the layout.
 * @param layout - the board
 * @param rates - the ledger's rates
 * @param avoid - tiles not to name, whatever else they are
 * @returns the tile `placeNeighborhood` would accept, or null when no tile is open
 */
export function proposeNeighborhood(layout: Layout, rates: SiteRates, avoid: readonly TileKey[] = []): TileKey | null {
  const tiles = allTiles(rates.outline);
  const open = tiles.filter((k) => !layout.tiles[k] && !avoid.includes(k));
  const rings = tiles.filter((k) => layout.tiles[k]?.kind === 'ring');
  const hoods = tiles.filter((k) => layout.tiles[k]?.kind === 'hood');
  const targets = rings.length ? rings : hoods.length ? hoods : ['0,0'];
  let best: { key: TileKey; km: number } | null = null;
  for (const k of open) {
    const km = targets.reduce((m, t) => Math.min(m, kmBetween(k, t, rates.stepKm)), Infinity);
    if (!best || km < best.km - 1e-9) best = { key: k, km };
  }
  return best ? best.key : null;
}

function priced(layout: Layout, rates: SiteRates): { build: number; run: number } {
  const c = costOf(layout, assessCore(layout, NO_STRESS, rates), rates);
  return { build: c.capitalTotal, run: c.runningTotal };
}

function sameNeeds(a: readonly Need[], b: readonly Need[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** The steps that would meet one need, or null when the board has no room for it. */
function stepsFor(need: Need, layout: Layout, rates: SiteRates): Step[] | null {
  const tiles = allTiles(rates.outline);
  const open = tiles.filter((k) => !layout.tiles[k]);
  const ofKind = (kind: string): TileKey[] => tiles.filter((k) => layout.tiles[k]?.kind === kind);
  const km = (a: TileKey, b: TileKey): number => kmBetween(a, b, rates.stepKm);
  const nearest = (candidates: readonly TileKey[], score: (k: TileKey) => number): TileKey | null => {
    let best: { key: TileKey; s: number } | null = null;
    for (const k of candidates) {
      const s = score(k);
      if (!best || s < best.s - 1e-9) best = { key: k, s };
    }
    return best ? best.key : null;
  };
  const times = <T>(n: number, make: () => T): T[] => Array.from({ length: n }, make);

  switch (need.need) {
    case 'ring': {
      const hoods = ofKind('hood');
      const at = nearest(open, (k) => hoods.reduce((t, h) => t + km(k, h), 0));
      return at && need.buildings <= rates.ringMax ? times(need.buildings, () => ({ command: 'addRingBuilding', tile: at })) : null;
    }
    case 'ringBuildings': {
      const t = layout.tiles[need.tile];
      const has = t && t.kind === 'ring' ? t.n : 0;
      return has + need.add <= rates.ringMax ? times(need.add, () => ({ command: 'addRingBuilding', tile: need.tile })) : null;
    }
    case 'modules':
      return plantSteps('power', need.add, layout, rates, open);
    case 'plantUnits':
      return plantSteps(need.plant, need.add, layout, rates, open);
    case 'schools':
    case 'fields': {
      const extra: ExtraKind = need.need === 'schools' ? need.school : 'fields';
      const lacking = ofKind('hood').filter((h) => {
        const t = layout.tiles[h];
        return t && t.kind === 'hood' && !t.has[extra];
      });
      const at = nearest(lacking, (k) => need.near.reduce((sum, n) => sum + km(k, n), 0));
      return at ? [{ command: 'toggleExtra', tile: at, extra }] : null;
    }
    case 'line':
      return lineSteps(need.reach, layout, rates);
  }
}

/**
 * Units on the plants of a kind that have room, then a new plant on an open tile that borders no neighborhood or ring
 * when there is one, nearest the line, and farthest from the ring among equals, so plants keep to the edge and leave
 * the ground beside the homes for homes.
 */
function plantSteps(plant: PlantKind, add: number, layout: Layout, rates: SiteRates, open: readonly TileKey[]): Step[] | null {
  const tiles = allTiles(rates.outline);
  const steps: Step[] = [];
  let left = add;
  for (const k of tiles) {
    const t = layout.tiles[k];
    if (!t || t.kind !== plant) continue;
    const room = rates.plantMax - t.n;
    for (let i = 0; i < Math.min(room, left); i++) steps.push({ command: 'addPlantUnit', tile: k, plant });
    left -= Math.min(room, left);
  }
  if (left <= 0) return steps;
  const rings = tiles.filter((k) => layout.tiles[k]?.kind === 'ring');
  const onLine = served(layout, rates);
  const hops = hopsTo(onLine.length ? onLine : rings, layout, rates);
  const crowds = (k: TileKey): number =>
    neighbors(k, rates.outline).some((n) => {
      const kind = layout.tiles[n]?.kind;
      return kind === 'hood' || kind === 'ring';
    })
      ? 1
      : 0;
  let best: { key: TileKey; crowds: number; hops: number; far: number } | null = null;
  for (const k of open) {
    const c = crowds(k);
    const h = hops[k] ?? Infinity;
    const far = rings.reduce((m, g) => Math.min(m, kmBetween(k, g, rates.stepKm)), Infinity);
    const better =
      !best || c < best.crowds || (c === best.crowds && (h < best.hops || (h === best.hops && far > best.far + 1e-9)));
    if (better) best = { key: k, crowds: c, hops: h, far };
  }
  if (!best || left > rates.plantMax) return null;
  const at = best.key;
  for (let i = 0; i < left; i++) steps.push({ command: 'addPlantUnit', tile: at, plant });
  return steps;
}

/** For each tile reached through the board, the tiles from it to the nearest target, or absent when none. */
function hopsTo(targets: readonly TileKey[], layout: Layout, rates: SiteRates): Record<TileKey, number> {
  void layout;
  const seen: Record<TileKey, number> = {};
  const queue: TileKey[] = [];
  for (const t of targets) {
    seen[t] = 0;
    queue.push(t);
  }
  for (let i = 0; i < queue.length; i++) {
    const here = queue[i];
    if (here === undefined) break;
    for (const n of neighbors(here, rates.outline)) {
      if (!(n in seen)) {
        seen[n] = (seen[here] ?? 0) + 1;
        queue.push(n);
      }
    }
  }
  return seen;
}

/** The ring tiles and every tile the line joins to a ring. */
function served(layout: Layout, rates: SiteRates): TileKey[] {
  const tiles = allTiles(rates.outline);
  const rings = tiles.filter((k) => layout.tiles[k]?.kind === 'ring');
  const net = lineNetwork(layout.lines);
  return tiles.filter((k) => rings.includes(k) || rings.some((g) => net.segments(k, g) !== null));
}

/** The shortest run of stretches from each tile to reach to the line that joins the ring, one tile after another. */
function lineSteps(reach: readonly TileKey[], layout: Layout, rates: SiteRates): Step[] | null {
  const steps: Step[] = [];
  let lines: Record<string, true> = { ...layout.lines };
  for (const from of reach) {
    const targets = served({ ...layout, lines }, rates);
    if (!targets.length) return null;
    if (targets.includes(from)) continue;
    const back: Record<TileKey, TileKey | null> = { [from]: null };
    const queue = [from];
    let hit: TileKey | null = null;
    for (let i = 0; i < queue.length && !hit; i++) {
      const here = queue[i];
      if (here === undefined) break;
      for (const n of neighbors(here, rates.outline)) {
        if (n in back) continue;
        back[n] = here;
        if (targets.includes(n)) {
          hit = n;
          break;
        }
        queue.push(n);
      }
    }
    if (!hit) return null;
    const path: TileKey[] = [];
    for (let k: TileKey | null = hit; k !== null; k = back[k] ?? null) path.push(k);
    for (let i = path.length - 1; i > 0; i--) {
      const a = path[i];
      const b = path[i - 1];
      if (a === undefined || b === undefined) continue;
      const e = edgeKey(a, b);
      if (lines[e]) continue;
      lines = { ...lines, [e]: true };
      steps.push({ command: 'layStretch', from: a, to: b });
    }
  }
  return steps.length ? steps : null;
}
