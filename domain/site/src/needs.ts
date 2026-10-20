/**
 * @file What a layout lacks to keep its lines whole, as typed facts: the ring buildings, reactor modules, plant units,
 * schools, playing fields and mover line reach the broken checks call for. Quantities only; where each goes is a
 * Proposal's business, and nothing here changes the layout.
 * Public interface: Need, NEED_CHECKS, needsOf.
 * Owner context: Site (domain).
 *
 * The needs are read off the assessment, never worked out a second time: a need is the shortfall a broken check
 * already states, so the needs and the checks cannot disagree. A check broken for want of people (the daily list
 * under a stress) or only on watch (the city's size, the walk to work with a mover) asks for nothing to be built.
 */
import { assessCore } from './assess.ts';
import type { TileKey } from './board.ts';
import type { CheckId, Core, LineCheck } from './checks.ts';
import { NO_STRESS } from './checks.ts';
import type { Layout } from './layout.ts';
import type { PlantKind, SchoolKind, SiteRates } from './rates.ts';

/** Something the layout lacks, with the checks it answers. */
export type Need =
  /** No ring stands: a new ring with this many buildings. */
  | { readonly need: 'ring'; readonly buildings: number; readonly answers: readonly CheckId[] }
  /** A ring is full: this many more buildings on it. */
  | { readonly need: 'ringBuildings'; readonly tile: TileKey; readonly add: number; readonly answers: readonly CheckId[] }
  /** The modules cannot carry the peak with one down (`short`, or `noSpare` with all running): this many more. */
  | { readonly need: 'modules'; readonly add: number; readonly answers: readonly CheckId[] }
  /** A plant serves fewer people than the city has: this many more units. */
  | {
      readonly need: 'plantUnits';
      readonly plant: Exclude<PlantKind, 'power'>;
      readonly add: number;
      readonly answers: readonly CheckId[];
    }
  /** Pupils with no seat within the walk: at least this many more schools, near these neighborhoods. */
  | {
      readonly need: 'schools';
      readonly school: SchoolKind;
      readonly add: number;
      readonly pupils: number;
      readonly near: readonly TileKey[];
      readonly answers: readonly CheckId[];
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

/**
 * What the layout lacks in an ordinary year, one need per thing to build, in a fixed order: ring, modules, plants,
 * schools, fields, intake, line.
 * @param layout - the board
 * @param rates - the ledger's rates
 * @returns the needs; empty when no check a built thing can mend is broken
 */
export function needsOf(layout: Layout, rates: SiteRates): readonly Need[] {
  return needsFrom(assessCore(layout, NO_STRESS, rates), layout, rates);
}

function needsFrom(core: Core, layout: Layout, rates: SiteRates): readonly Need[] {
  const broken = (id: CheckId): LineCheck | null => core.checks.find((c) => c.id === id && c.status === 'bad') ?? null;
  const out: Need[] = [];

  const ring = broken('ring');
  if (ring && ring.facts.check === 'ring') {
    const f = ring.facts;
    if (f.case === 'none') {
      out.push({ need: 'ring', buildings: Math.max(1, Math.ceil(core.score.pop / rates.ringServes - 1e-9)), answers: ['ring'] });
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
    out.push({ need: 'modules', add: power.facts.needed - power.facts.modules, answers: ['power'] });
  }

  for (const plant of ['water', 'sewage', 'waste'] as const) {
    const c = broken(plant);
    if (c && (c.facts.check === 'water' || c.facts.check === 'sewage' || c.facts.check === 'waste') && c.facts.case === 'short') {
      out.push({ need: 'plantUnits', plant, add: c.facts.needed - c.facts.units, answers: [plant] });
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
