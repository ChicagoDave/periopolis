/**
 * @file Where each need goes: a Proposal gives a need the tiles and the ordinary commands that would build it, and its
 * price; nothing here changes the layout it is given (ADR-0008 Decision 4).
 * Public interface: Step, Proposal, Avoided, proposeFor, applyProposal, proposeNeighborhood, proposeCircle.
 * Owner context: Site (domain).
 *
 * Proposals are made one need at a time: the first need is proposed, its steps applied to a scratch layout, and the
 * needs read again, so what one addition calls for in turn is proposed after it; a new plant's own line is not left
 * for later but carried in the plant's proposal, so the plant and its line are one order (ADR-0019). Every
 * choice is deterministic; ties go to the tile first in the board's order. A need nothing on the board can meet ends
 * the list with a "no room" proposal rather than a tile a command would refuse.
 */
import { assessCore } from './assess.ts';
import { allTiles, eastWest, edgeKey, kmBetween, neighbors, tileAt, tileKey } from './board.ts';
import type { EdgeKey, TileKey } from './board.ts';
import { bandRule, circleFits, circleOf, circleTiles, shoreTiles, upstreamOf } from './circle.ts';
import { NO_STRESS } from './checks.ts';
import { addPlantUnit, addRingBuilding, layStretch, toggleExtra } from './commands.ts';
import type { SiteEvent, SiteRejection } from './commands.ts';
import { costOf } from './cost.ts';
import type { Layout } from './layout.ts';
import { lineNetwork } from './network.ts';
import type { LineNetwork } from './network.ts';
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

/** A piece a proposal must not name: a kind of piece at a place (a tile, or a stretch's edge key for the line). */
export interface Avoided {
  readonly what: string;
  readonly at: string;
}

/**
 * Propose where every need of a layout goes, in the order they would be built.
 * @param layout - the board
 * @param rates - the ledger's rates
 * @param avoid - pieces not to name (the run's vetoes, ADR-0015 Decision 5): a need is met elsewhere when it can be,
 * and has no room when every place for it is avoided
 * @param closed - stretches named as closed this year (ADR-0021): the needs are read with them carrying nobody, and
 * the line is laid as if they were not there, so a cut-off neighborhood's proposal is the way round, never the
 * closed stretch itself; none by default
 * @returns the proposals; empty when the layout needs nothing; the last one has no room when the board cannot hold it
 */
export function proposeFor(layout: Layout, rates: SiteRates, avoid: readonly Avoided[] = [], closed: readonly EdgeKey[] = []): readonly Proposal[] {
  const out: Proposal[] = [];
  let scratch = layout;
  for (let round = 0; round < MOST_ROUNDS; round++) {
    const need = needsOf(scratch, rates, closed)[0];
    if (!need) return out;
    const steps = joinedToLine(stepsFor(need, scratch, rates, avoid, closed), scratch, rates, avoid);
    const applied = steps ? applyProposal(scratch, steps, rates) : null;
    if (!steps || !applied || !applied.ok || sameNeeds(needsOf(applied.layout, rates, closed), needsOf(scratch, rates, closed))) {
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
 * Where the next neighborhood goes (ADR-0015 Decision 3, narrowed by ADR-0016 to the tiles inside a circle's band):
 * in the first circle, in the layout's order, with an open home tile, the open tile nearest that circle's ring, or
 * nearest its standing neighborhoods when it has no ring, or beside its middle when nothing stands in it (the middle
 * is the ring's); first in the board's tile order among equals. A circle fills before the next is used. On a layout
 * with no circles, the sketch's rule: the open tile nearest the ring, the neighborhoods, or the middle itself.
 * Nothing here changes the layout.
 * @param layout - the board
 * @param rates - the ledger's rates
 * @param avoid - tiles not to name, whatever else they are
 * @returns the tile `placeNeighborhood` would accept, or null when no tile is open in any circle
 */
export function proposeNeighborhood(layout: Layout, rates: SiteRates, avoid: readonly TileKey[] = []): TileKey | null {
  const tiles = allTiles(rates.outline);
  const circles = layout.circles ?? [];
  const ofKind = (kind: string, m: TileKey | null): TileKey[] => tiles.filter((k) => layout.tiles[k]?.kind === kind && (m === null || circleOf(circles, k) === m));
  const nearestTo = (open: readonly TileKey[], targets: readonly TileKey[]): TileKey | null => {
    let best: { key: TileKey; km: number } | null = null;
    for (const k of open) {
      const km = targets.reduce((m, t) => Math.min(m, kmBetween(k, t, rates.stepKm)), Infinity);
      if (!best || km < best.km - 1e-9) best = { key: k, km };
    }
    return best ? best.key : null;
  };
  if (!circles.length) {
    const open = tiles.filter((k) => !layout.tiles[k] && !avoid.includes(k));
    const rings = ofKind('ring', null);
    const hoods = ofKind('hood', null);
    return nearestTo(open, rings.length ? rings : hoods.length ? hoods : ['0,0']);
  }
  for (const m of circles) {
    const open = tiles.filter((k) => !layout.tiles[k] && !avoid.includes(k) && k !== m && circleOf(circles, k) === m && !bandRule(circles, k, 'home'));
    if (!open.length) continue;
    const rings = ofKind('ring', m);
    const hoods = ofKind('hood', m);
    return nearestTo(open, rings.length ? rings : hoods.length ? hoods : [m]);
  }
  return null;
}

/** How far apart two circles' middles stand along the shore, so that their bands touch and no tile is in both (ADR-0016 Decision 3). */
export const CIRCLE_STEP = 9;

/**
 * Where the next circle goes (ADR-0016 Decision 3): along the shore, its middle 9 steps east of the easternmost
 * standing circle's, on the same row, so the bands touch at a seam; never between a circle's intake and its outfall.
 * Nothing here changes the layout.
 * @param layout - the board
 * @param rates - the ledger's rates
 * @param avoid - middles not to name (the run's vetoed circles)
 * @returns the middle `openCircle` would accept, or null when the board has no room for another circle or the layout
 * has no circles to stand beside
 */
export function proposeCircle(layout: Layout, rates: SiteRates, avoid: readonly TileKey[] = []): TileKey | null {
  const circles = layout.circles ?? [];
  const last = circles.reduce<TileKey | null>((b, m) => (b === null || eastWest(m) > eastWest(b) ? m : b), null);
  if (last === null) return null;
  const [q, r] = tileAt(last);
  const middle = tileKey(q + CIRCLE_STEP, r);
  if (avoid.includes(middle) || !circleFits(middle, rates.outline)) return null;
  if (circleTiles(middle).some((k) => circleOf(circles, k) !== null)) return null;
  return middle;
}

/**
 * A proposal's steps with the line that joins any plant they put where the line does not reach (ADR-0019): the plant
 * and its line are one proposal, so one order. A plant the line cannot reach is not proposed alone.
 * @returns the steps, with the joining stretches after them; null when the steps are null or the line cannot be laid
 */
function joinedToLine(steps: Step[] | null, layout: Layout, rates: SiteRates, avoid: readonly Avoided[]): Step[] | null {
  if (!steps || !steps.some((s) => s.command === 'addPlantUnit')) return steps;
  const applied = applyProposal(layout, steps, rates);
  if (!applied.ok) return steps;
  const loose = (l: Layout): readonly TileKey[] => {
    const haul = assessCore(l, NO_STRESS, rates).checks.find((c) => c.id === 'haul');
    return haul && haul.status === 'bad' ? haul.tiles : [];
  };
  const before = loose(layout);
  const added = loose(applied.layout).filter((k) => !before.includes(k));
  if (!added.length) return steps;
  const line = lineSteps(added, applied.layout, rates, (e) => avoid.some((a) => a.what === 'line' && a.at === e));
  return line ? [...steps, ...line] : null;
}

function priced(layout: Layout, rates: SiteRates): { build: number; run: number } {
  const c = costOf(layout, assessCore(layout, NO_STRESS, rates), rates);
  return { build: c.capitalTotal, run: c.runningTotal };
}

function sameNeeds(a: readonly Need[], b: readonly Need[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** The steps that would meet one need, or null when the board has no room for it. */
function stepsFor(need: Need, layout: Layout, rates: SiteRates, avoid: readonly Avoided[], closed: readonly EdgeKey[] = []): Step[] | null {
  const tiles = allTiles(rates.outline);
  const avoided = (what: string, at: string): boolean => avoid.some((a) => a.what === what && a.at === at);
  const open = tiles.filter((k) => !layout.tiles[k]);
  const openFor = (piece: 'plant' | 'home'): TileKey[] => open.filter((k) => !bandRule(layout.circles, k, piece));
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
      // The circle's middle holds its ring (ADR-0016 Decision 1) when it is open; else the open tile in that circle
      // nearest its homes. On a layout with no circles, the open tile nearest the homes.
      const inCircle = (k: TileKey): boolean => need.circle === null || circleOf(layout.circles, k) === need.circle;
      const hoods = ofKind('hood').filter(inCircle);
      const middle = need.circle;
      const kept = middle !== null && open.includes(middle) && !avoided('ring', middle) ? middle : null;
      const at = kept ?? nearest(openFor('home').filter((k) => inCircle(k) && !avoided('ring', k)), (k) => hoods.reduce((t, h) => t + km(k, h), 0));
      return at && need.buildings <= rates.ringMax ? times(need.buildings, () => ({ command: 'addRingBuilding', tile: at })) : null;
    }
    case 'ringBuildings': {
      const t = layout.tiles[need.tile];
      const has = t && t.kind === 'ring' ? t.n : 0;
      if (avoided('ring', need.tile)) return null;
      return has + need.add <= rates.ringMax ? times(need.add, () => ({ command: 'addRingBuilding', tile: need.tile })) : null;
    }
    case 'modules':
      return plantSteps('power', need.add, need.circle, layout, rates, openFor('plant').filter((k) => !avoided('power', k)), avoided);
    case 'plantUnits':
      return plantSteps(need.plant, need.add, need.circle, layout, rates, openFor('plant').filter((k) => !avoided(need.plant, k)), avoided);
    case 'intake': {
      // A water unit on the open shore tile farthest upstream of the outfall in the first faulted circle, or on the
      // band when the shore has none (ADR-0016 Decision 5).
      const outfall = need.sewage[0];
      const m = outfall === undefined ? null : circleOf(layout.circles, outfall);
      if (outfall === undefined || m === null) return null;
      const band = openFor('plant').filter((k) => circleOf(layout.circles, k) === m && upstreamOf(k, outfall, rates.current));
      const shore = band.filter((k) => shoreTiles(m, rates.outline).includes(k));
      const allowed = (shore.length ? shore : band).filter((k) => !avoided('water', k));
      const candidates = allowed.length ? allowed : band.filter((k) => !avoided('water', k));
      const at = candidates.reduce<TileKey | null>((best, k) => (best === null || upstreamOf(k, best, rates.current) ? k : best), null);
      return at ? [{ command: 'addPlantUnit', tile: at, plant: 'water' }] : null;
    }
    case 'schools':
    case 'fields': {
      const extra: ExtraKind = need.need === 'schools' ? need.school : 'fields';
      const lacking = ofKind('hood').filter((h) => {
        const t = layout.tiles[h];
        return t && t.kind === 'hood' && !t.has[extra] && !avoided(extra, h);
      });
      const at = nearest(lacking, (k) => need.near.reduce((sum, n) => sum + km(k, n), 0));
      return at ? [{ command: 'toggleExtra', tile: at, extra }] : null;
    }
    case 'line':
      return lineSteps(need.reach, layout, rates, (e) => avoided('line', e) || closed.includes(e), closed);
  }
}

/**
 * Units on the circle's plants of a kind that have room, then a new plant on its band. A circle's people are served
 * by its own band (ADR-0016 Decisions 1 and 3), so the need names the circle and nothing goes in another. On a circle
 * board (Decision 5) the new plant goes on the band's shore side: water on the open shore tile farthest upstream,
 * sewage on the one farthest downstream of every water plant in its circle, a reactor or waste works on the open tile
 * nearest the circle's sewage plant; a tile off the shore only when the shore is full; no room when the band is full.
 * Without circles (the need's circle null), the sketch's rule: an open tile that borders no neighborhood or ring when
 * there is one, nearest the line, and farthest from the ring among equals.
 */
function plantSteps(
  plant: PlantKind,
  add: number,
  circle: TileKey | null,
  layout: Layout,
  rates: SiteRates,
  open: readonly TileKey[],
  avoided: (what: string, at: string) => boolean = () => false,
): Step[] | null {
  const tiles = allTiles(rates.outline);
  const steps: Step[] = [];
  let left = add;
  for (const k of tiles) {
    const t = layout.tiles[k];
    if (!t || t.kind !== plant || avoided(plant, k) || (circle !== null && circleOf(layout.circles, k) !== circle)) continue;
    const room = rates.plantMax - t.n;
    for (let i = 0; i < Math.min(room, left); i++) steps.push({ command: 'addPlantUnit', tile: k, plant });
    left -= Math.min(room, left);
  }
  if (left <= 0) return steps;
  if (left > rates.plantMax) return null;
  if (circle !== null) {
    const shoreAt = shorePlantTile(plant, circle, layout, rates, open);
    if (!shoreAt) return null;
    for (let i = 0; i < left; i++) steps.push({ command: 'addPlantUnit', tile: shoreAt, plant });
    return steps;
  }
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
  if (!best) return null;
  const at = best.key;
  for (let i = 0; i < left; i++) steps.push({ command: 'addPlantUnit', tile: at, plant });
  return steps;
}

/**
 * Where a new plant goes on one circle's band: the shore side, intake upstream of outfall, the reactor and the waste
 * works beside the sewage plant (ADR-0016 Decision 5). The circle's shore tiles come first, the rest of its band when
 * the shore is full.
 * @returns the tile, or null when no band tile of the circle is open
 */
function shorePlantTile(plant: PlantKind, m: TileKey, layout: Layout, rates: SiteRates, open: readonly TileKey[]): TileKey | null {
  const circles = layout.circles ?? [];
  const current = rates.current;
  const ofKindIn = (kind: PlantKind): TileKey[] => allTiles(rates.outline).filter((k) => layout.tiles[k]?.kind === kind && circleOf(circles, k) === m);
  const band = open.filter((k) => circleOf(circles, k) === m);
  if (!band.length) return null;
  const shore = shoreTiles(m, rates.outline).filter((k) => band.includes(k));
  const pool = shore.length ? shore : band;
  const upstreamMost = (ks: readonly TileKey[]): TileKey | null => ks.reduce<TileKey | null>((b, k) => (b === null || upstreamOf(k, b, current) ? k : b), null);
  const downstreamMost = (ks: readonly TileKey[]): TileKey | null => ks.reduce<TileKey | null>((b, k) => (b === null || upstreamOf(b, k, current) ? k : b), null);
  if (plant === 'water') return upstreamMost(pool);
  if (plant === 'sewage') {
    const waters = ofKindIn('water');
    const below = pool.filter((k) => waters.every((w) => upstreamOf(w, k, current)));
    return downstreamMost(below.length ? below : pool);
  }
  const sewage = ofKindIn('sewage');
  if (!sewage.length) return downstreamMost(pool);
  let best: { key: TileKey; km: number } | null = null;
  for (const k of pool) {
    const km = sewage.reduce((t, s) => Math.min(t, kmBetween(k, s, rates.stepKm)), Infinity);
    if (!best || km < best.km - 1e-9) best = { key: k, km };
  }
  return best ? best.key : null;
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

/**
 * The line that reaches each tile, laid by the fewest stretches, never over an avoided stretch. On a circle board each
 * tile is joined first to its own circle's ring (ADR-0016 Decision 3: a circle's homes walk to their own ring) and then,
 * when its network is not the first circle's ring's, that whole network is joined to it by the shortest run, so the
 * line is one line and crosses the seam from band to band. On a layout with no circles, the sketch's rule: the line
 * that joins any ring. A stretch named as closed is read as not there (ADR-0021): a tile it alone joined is routed
 * round it, and `avoidedEdge` keeps the route off it, so the way round is never the closed stretch laid again.
 * @returns the stretches, or null when no ring stands or a tile cannot be reached
 */
function lineSteps(
  reach: readonly TileKey[],
  layout: Layout,
  rates: SiteRates,
  avoidedEdge: (e: string) => boolean = () => false,
  closed: readonly EdgeKey[] = [],
): Step[] | null {
  const tiles = allTiles(rates.outline);
  const circles = layout.circles ?? [];
  const rings = tiles.filter((k) => layout.tiles[k]?.kind === 'ring');
  if (!rings.length) return null;
  const main = (circles.length ? rings.find((g) => circleOf(circles, g) === circles[0]) : undefined) ?? rings[0];
  if (main === undefined) return null;
  const steps: Step[] = [];
  let lines: Record<string, true> = {};
  for (const e of Object.keys(layout.lines)) if (!closed.includes(e)) lines[e] = true;
  const joined = (net: LineNetwork, k: TileKey, goals: readonly TileKey[]): boolean => goals.some((g) => k === g || net.segments(k, g) !== null);
  const lay = (path: readonly TileKey[]): void => {
    for (let i = path.length - 1; i > 0; i--) {
      const a = path[i];
      const b = path[i - 1];
      if (a === undefined || b === undefined) continue;
      const e = edgeKey(a, b);
      if (lines[e]) continue;
      lines = { ...lines, [e]: true };
      steps.push({ command: 'layStretch', from: a, to: b });
    }
  };
  for (const from of reach) {
    // First, the tile's own ring: the rings of its circle, or any ring on a layout with no circles.
    const own = circles.length ? rings.filter((g) => circleOf(circles, g) === circleOf(circles, from)) : rings;
    const goals = own.length ? own : [main];
    let net = lineNetwork(lines);
    if (!joined(net, from, goals)) {
      const path = route([from], tiles.filter((k) => joined(net, k, goals)), layout, rates, avoidedEdge);
      if (!path) return null;
      lay(path);
      net = lineNetwork(lines);
    }
    // Then one line: its network joined to the first ring's by the shortest run, across the seam when it must.
    if (!joined(net, from, [main])) {
      const sources = tiles.filter((k) => k === from || net.segments(from, k) !== null);
      const path = route(sources, tiles.filter((k) => joined(net, k, [main])), layout, rates, avoidedEdge);
      if (!path) return null;
      lay(path);
    }
  }
  return steps.length ? steps : null;
}

/**
 * The shortest run of tiles from any source to any target, one neighbor after another, never onto a tile the band rule
 * keeps the line off nor over an avoided stretch; the target first, the source last.
 * @returns the tiles, or null when no target can be reached
 */
function route(
  sources: readonly TileKey[],
  targets: readonly TileKey[],
  layout: Layout,
  rates: SiteRates,
  avoidedEdge: (e: string) => boolean,
): TileKey[] | null {
  if (!targets.length) return null;
  const back: Record<TileKey, TileKey | null> = {};
  const queue: TileKey[] = [];
  for (const s of sources) {
    back[s] = null;
    queue.push(s);
  }
  let hit: TileKey | null = null;
  for (let i = 0; i < queue.length && !hit; i++) {
    const here = queue[i];
    if (here === undefined) break;
    for (const n of neighbors(here, rates.outline)) {
      if (n in back || bandRule(layout.circles, n, 'line') || avoidedEdge(edgeKey(here, n))) continue;
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
  return path;
}
