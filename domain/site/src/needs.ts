/**
 * @file What a layout lacks to keep its lines whole, as typed facts: the ring buildings, reactor modules, plant units,
 * schools, playing fields and mover line reach the broken checks call for. Quantities only; where each goes is a
 * Proposal's business, and nothing here changes the layout.
 * Public interface: Need, NEED_CHECKS, HEADROOM_CHECKS, needsOf, headroomOf.
 * Owner context: Site (domain).
 *
 * The needs are read off the assessment, never worked out a second time: a need is the shortfall a broken check
 * already states, so the needs and the checks cannot disagree. A check broken for want of people (the daily list
 * under a stress) or only on watch (the city's size, the walk to work with a mover) asks for nothing to be built.
 *
 * A full circle is read a second time, at the squeeze (ADR-0018): its neighborhoods hold `rates.band` more people, the
 * stretch test's figure, and its ring, plants and schools are needed to that. Every circle's schools, full or growing,
 * are read at the squeeze too (ADR-0020), so they seat the wave of families; a growing circle's ring and plants, and a
 * layout with no circles, are read for an ordinary year only.
 */
import { assessCore } from './assess.ts';
import type { TileKey } from './board.ts';
import type { CheckId, Core, LineCheck } from './checks.ts';
import { NO_STRESS } from './checks.ts';
import type { Stress } from './checks.ts';
import { circleOf, isFull } from './circle.ts';
import type { EdgeKey } from './board.ts';
import type { Layout } from './layout.ts';
import type { PlantKind, SchoolKind, SiteRates } from './rates.ts';

/**
 * Something the layout lacks, with the checks it answers. `squeeze` marks a ring, plant or school need that an
 * ordinary year would not ask for: headroom for the squeeze in a full circle (ADR-0018).
 */
export type Need =
  /** A circle's neighborhoods have no ring: a new ring with this many buildings, in that circle (null: a layout with no circles). */
  | { readonly need: 'ring'; readonly circle: TileKey | null; readonly buildings: number; readonly answers: readonly CheckId[]; readonly squeeze?: true }
  /** A ring is full: this many more buildings on it. */
  | { readonly need: 'ringBuildings'; readonly tile: TileKey; readonly add: number; readonly answers: readonly CheckId[]; readonly squeeze?: true }
  /** A circle's modules cannot carry its peak with one down (`short`, or `noSpare` with all running): this many more, in that circle. */
  | { readonly need: 'modules'; readonly circle: TileKey | null; readonly add: number; readonly answers: readonly CheckId[]; readonly squeeze?: true }
  /** A circle's plants of a kind serve fewer people than it has: this many more units, in that circle. */
  | {
      readonly need: 'plantUnits';
      readonly circle: TileKey | null;
      readonly plant: Exclude<PlantKind, 'power'>;
      readonly add: number;
      readonly answers: readonly CheckId[];
      readonly squeeze?: true;
    }
  /** Pupils with no seat within the walk: at least this many more schools, near these neighborhoods. */
  | {
      readonly need: 'schools';
      readonly school: SchoolKind;
      readonly add: number;
      readonly pupils: number;
      readonly near: readonly TileKey[];
      readonly answers: readonly CheckId[];
      readonly squeeze?: true;
    }
  /** Neighborhoods with no fields within the walk or a ride: fields near them. */
  | { readonly need: 'fields'; readonly near: readonly TileKey[]; readonly answers: readonly CheckId[] }
  /** Tiles the mover line must reach, joined to the ring. */
  | { readonly need: 'line'; readonly reach: readonly TileKey[]; readonly answers: readonly CheckId[] }
  /** An outfall upstream of an intake (line 32): a water unit upstream of these sewage plants, one circle at a time. */
  | { readonly need: 'intake'; readonly sewage: readonly TileKey[]; readonly answers: readonly CheckId[] };

/** The checks a built thing can mend; a broken one always yields a need. */
export const NEED_CHECKS: readonly CheckId[] = [
  'ring',
  'work',
  'stops',
  'elementary',
  'middle',
  'high',
  'fields',
  'ways',
  'power',
  'water',
  'sewage',
  'waste',
  'haul',
  'flow',
];

const LINE_CHECKS: readonly CheckId[] = ['stops', 'work', 'ways', 'haul'];

/** The checks a full circle is held to at the squeeze (ADR-0018): its ring, its plants and its schools. */
export const HEADROOM_CHECKS: readonly CheckId[] = ['ring', 'power', 'water', 'sewage', 'waste', 'elementary', 'middle', 'high'];

/** The needs that answer the headroom checks, which lead the fixed order. */
const HEADROOM_NEEDS: readonly Need['need'][] = ['ring', 'ringBuildings', 'modules', 'plantUnits', 'schools'];

/**
 * Who lives where when the needs are read at the squeeze (ADR-0018): each neighborhood of a full circle holds
 * `rates.hood` more `rates.band`; every other neighborhood is left out, so it holds its capacity, an ordinary year.
 * @param layout - the board
 * @param rates - the ledger's rates
 * @returns the occupancy for `assessCore`, or null when no circle is full
 */
export function headroomOf(layout: Layout, rates: SiteRates): Readonly<Record<TileKey, number>> | null {
  const circles = layout.circles ?? [];
  const full = circles.filter((m) => isFull(layout, m, rates.outline));
  if (!full.length) return null;
  if (!(rates.band >= 0)) throw new RangeError(`the squeeze must be zero or more, not ${rates.band}`);
  const occupied: Record<TileKey, number> = {};
  for (const h of hoodsOf(layout)) {
    const m = circleOf(circles, h);
    if (m !== null && full.includes(m)) occupied[h] = rates.hood * (1 + rates.band);
  }
  return occupied;
}

/**
 * Who lives where when the schools are read at the squeeze (ADR-0020): each neighborhood of every circle, full or
 * growing, holds `rates.hood` more `rates.band`; a neighborhood in no circle is left out, so it holds its capacity.
 */
function schoolsAtSqueeze(layout: Layout, rates: SiteRates): Readonly<Record<TileKey, number>> | null {
  const circles = layout.circles ?? [];
  const occupied: Record<TileKey, number> = {};
  for (const h of hoodsOf(layout)) if (circleOf(circles, h) !== null) occupied[h] = rates.hood * (1 + rates.band);
  if (!Object.keys(occupied).length) return null;
  if (!(rates.band >= 0)) throw new RangeError(`the squeeze must be zero or more, not ${rates.band}`);
  return occupied;
}

/**
 * What the layout lacks, one need per thing to build, in a fixed order: ring, modules, plants, schools, fields,
 * intake, line. Read for an ordinary year; a full circle's ring and plants, and every circle's schools, are read at the
 * squeeze, and a need the squeeze adds is marked `squeeze` (ADR-0018, ADR-0020). Stretches named as closed are read as
 * carrying nobody (ADR-0021): the neighborhoods a closure cuts off break the stops and ways checks, and the line need
 * asks for the way round.
 * @param layout - the board
 * @param rates - the ledger's rates
 * @param closed - stretches of mover line named as closed this year, as `Stress.closed`; none by default
 * @returns the needs; empty when no check a built thing can mend is broken in an ordinary year with the named stretches
 *   closed, no headroom check is broken in a full circle at the squeeze, and no school check is broken with every
 *   circle at the squeeze
 * @throws RangeError when the squeeze (`rates.band`) is negative and a circle has a neighborhood
 */
export function needsOf(layout: Layout, rates: SiteRates, closed: readonly EdgeKey[] = []): readonly Need[] {
  const stress: Stress = closed.length ? { ...NO_STRESS, closed } : NO_STRESS;
  const ordinary = needsFrom(assessCore(layout, stress, rates), layout, rates);
  const full = headroomOf(layout, rates);
  const schooled = schoolsAtSqueeze(layout, rates);
  if (!full && !schooled) return ordinary;
  const isSchools = (n: Need): boolean => n.need === 'schools';
  const ringAndPlants = (full ? needsFrom(assessCore(layout, stress, rates, full), layout, rates) : ordinary).filter(
    (n) => HEADROOM_NEEDS.includes(n.need) && !isSchools(n),
  );
  const schools = (schooled ? needsFrom(assessCore(layout, stress, rates, schooled), layout, rates) : ordinary).filter(isSchools);
  const same = (a: Need, b: Need): boolean => JSON.stringify(a) === JSON.stringify(b);
  const marked = (n: Need): Need => (ordinary.some((o) => same(o, n)) ? n : ({ ...n, squeeze: true } as Need));
  return [...ringAndPlants.map(marked), ...schools.map(marked), ...ordinary.filter((n) => !HEADROOM_NEEDS.includes(n.need))];
}

function needsFrom(core: Core, layout: Layout, rates: SiteRates): readonly Need[] {
  const broken = (id: CheckId): LineCheck | null => core.checks.find((c) => c.id === id && c.status === 'bad') ?? null;
  const out: Need[] = [];

  const ring = broken('ring');
  if (ring && ring.facts.check === 'ring') {
    const f = ring.facts;
    if (f.case === 'none') {
      for (const s of f.short) out.push({ need: 'ring', circle: s.circle, buildings: s.needed, answers: ['ring'] });
    } else if (f.case === 'full') {
      for (const tile of ring.tiles) {
        const report = core.per[tile];
        const t = layout.tiles[tile];
        const has = t && t.kind === 'ring' ? t.n : 0;
        const add = (report?.needs ?? has) - has;
        if (add > 0) out.push({ need: 'ringBuildings', tile, add, answers: ['ring'] });
      }
    }
  }

  const power = broken('power');
  if (power && power.facts.check === 'power' && (power.facts.case === 'short' || power.facts.case === 'noSpare')) {
    for (const s of power.facts.short) out.push({ need: 'modules', circle: s.circle, add: s.needed - s.has, answers: ['power'] });
  }

  for (const plant of ['water', 'sewage', 'waste'] as const) {
    const c = broken(plant);
    if (c && (c.facts.check === 'water' || c.facts.check === 'sewage' || c.facts.check === 'waste') && c.facts.case === 'short') {
      for (const s of c.facts.short) out.push({ need: 'plantUnits', circle: s.circle, plant, add: s.needed - s.has, answers: [plant] });
    }
  }

  for (const school of ['elementary', 'middle', 'high'] as const) {
    const c = broken(school);
    if (!c || c.facts.check !== school) continue;
    const f = c.facts;
    const pupils = f.case === 'none' ? f.pupils : f.case === 'unseated' ? f.missing : 0;
    const cap = schoolCap(rates, school);
    const near = f.case === 'none' ? hoodsOf(layout) : c.tiles;
    out.push({ need: 'schools', school, add: Math.max(1, Math.ceil(pupils / cap - 1e-9)), pupils, near, answers: [school] });
  }

  const fields = broken('fields');
  if (fields) out.push({ need: 'fields', near: fields.tiles.length ? fields.tiles : hoodsOf(layout), answers: ['fields'] });

  const flow = broken('flow');
  if (flow && flow.facts.check === 'flow' && flow.facts.case === 'reversed') out.push({ need: 'intake', sewage: flow.facts.sewage, answers: ['flow'] });

  const lineBroken = LINE_CHECKS.map(broken).filter((c): c is LineCheck => c !== null);
  if (lineBroken.length) {
    const reach: TileKey[] = [];
    for (const c of lineBroken) for (const t of c.tiles) if (!reach.includes(t)) reach.push(t);
    out.push({ need: 'line', reach, answers: lineBroken.map((c) => c.id) });
  }
  return out;
}

function schoolCap(rates: SiteRates, school: SchoolKind): number {
  const n = rates.needs.find((x) => x.id === school);
  if (!n || n.kind !== 'cap' || !(n.cap > 0)) throw new Error(`${school} has no cap`);
  return n.cap;
}

function hoodsOf(layout: Layout): TileKey[] {
  return Object.keys(layout.tiles).filter((k) => layout.tiles[k]?.kind === 'hood');
}
