/**
 * @file The assessment of a layout under one stress: the fifteen line checks over the real distances between tiles,
 * the trips those distances make, and the score.
 * Public interface: assessCore.
 * Owner context: Site (domain).
 */
import { deriveCarCity } from '@city/ledger';
import type { CappedNeed, CountedNeed } from '@city/ledger';
import { kmBetween } from './board.ts';
import type { EdgeKey, TileKey } from './board.ts';
import type { CheckId, CheckStatus, Core, Facts, LineCheck, Score, Stress, TileIssue, TileLevel, TileReport } from './checks.ts';
import type { Layout, Neighborhood } from './layout.ts';
import { lineNetwork } from './network.ts';
import { PLANTS, SCHOOLS } from './rates.ts';
import type { PlantKind, SchoolKind, SiteRates } from './rates.ts';
import { seat } from './seating.ts';
import type { Seat } from './seating.ts';

const TINY = 1e-6;

/** A tile report under construction. */
interface Draft {
  issues: TileIssue[];
  level: TileLevel;
  stop: boolean;
  ring?: TileReport['ring'];
  load?: number;
  cap?: number;
  needs?: number;
  schools?: Partial<Record<SchoolKind, { load: number; cap: number }>>;
  goes?: Partial<Record<SchoolKind, { to: readonly Seat[]; left: number; each: number }>>;
  fields?: TileReport['fields'];
  stuck?: number;
}

function countedNeed(rates: SiteRates, id: string): CountedNeed {
  const n = rates.needs.find((x) => x.id === id);
  if (!n || n.kind !== 'people') throw new Error(`${id} is not a counted need`);
  return n;
}

function cappedNeed(rates: SiteRates, id: SchoolKind): CappedNeed {
  const n = rates.needs.find((x) => x.id === id);
  if (!n || n.kind !== 'cap') throw new Error(`${id} is not a school`);
  return n;
}

/**
 * Check a layout against every line, under a stress.
 * @param layout - the board
 * @param stress - what is happening to the city this year
 * @param rates - the ledger's rates
 */
export function assessCore(layout: Layout, stress: Stress, rates: SiteRates): Core {
  const tiles = layout.tiles;
  const keys = Object.keys(tiles);
  const of = (kind: string): TileKey[] => keys.filter((k) => tiles[k]?.kind === kind);
  const hoods = of('hood');
  const rings = of('ring');
  const hoodAt = (k: TileKey): Neighborhood | null => {
    const t = tiles[k];
    return t && t.kind === 'hood' ? t : null;
  };
  const unitsAt = (k: TileKey): number => {
    const t = tiles[k];
    return t && t.kind !== 'hood' ? t.n : 0;
  };
  const pop1 = rates.hood * (1 + stress.people);
  const pop = hoods.length * pop1;
  // A stretch of mover line closed for repairs is still built, but carries nobody this year.
  const shut = stress.closed ?? [];
  const open: Record<EdgeKey, true> = {};
  for (const e of Object.keys(layout.lines)) if (!shut.includes(e)) open[e] = true;
  const net = lineNetwork(open);
  const stop = (k: TileKey): boolean => Boolean(tiles[k]) && net.onLine(k);
  const segs = (a: TileKey, b: TileKey): number | null => (stop(a) && stop(b) ? net.segments(a, b) : null);
  const km = (a: TileKey, b: TileKey): number => kmBetween(a, b, rates.stepKm);
  const walk = (a: TileKey, b: TileKey): number => (a === b ? rates.inTile : km(a, b) * rates.foot);
  const per: Record<TileKey, Draft> = {};
  for (const k of keys) per[k] = { issues: [], level: null, stop: stop(k) };
  const draft = (k: TileKey): Draft => (per[k] ??= { issues: [], level: null, stop: stop(k) });
  const flag = (k: TileKey, level: 'bad' | 'warn', issue: TileIssue): void => {
    const p = draft(k);
    p.issues.push(issue);
    if (level === 'bad' || !p.level) p.level = level;
  };
  const checks: LineCheck[] = [];
  const check = (id: CheckId, lines: readonly number[], status: CheckStatus, facts: Facts, where: readonly TileKey[] = []): void => {
    checks.push({ id, lines, status, tiles: where, facts });
  };
  const some = hoods.length > 0;
  const walking = rates.walking;
  const shared = rates.shared;

  // Lines 3, 13, 14: each neighborhood carries its own daily list.
  {
    const daily = rates.needs.filter((x): x is CountedNeed => x.tier === 'center' && x.kind === 'people');
    const hungriest = daily.reduce((a, x) => Math.max(a, x.people), 0);
    if (!some) check('daily', [3, 13, 14], 'idle', { check: 'daily', case: 'idle', hood: rates.hood });
    else {
      const short = daily.filter((x) => x.people > pop1 + TINY).map((x) => x.id);
      if (short.length) {
        for (const h of hoods) flag(h, 'bad', { kind: 'dailyShort', needs: short });
        check('daily', [3, 13, 14], 'bad', { check: 'daily', case: 'short', pop1, short }, hoods);
      } else check('daily', [3, 13, 14], 'ok', { check: 'daily', case: 'fed', pop1, hungriest });
    }
  }

  // Lines 3, 14: the two needs that take most of a city to feed. Short of people they limp, so this is a watch.
  {
    const urgent = countedNeed(rates, 'urgent').people;
    const fine = countedNeed(rates, 'finedining').people;
    if (!some) check('size', [3, 14], 'idle', { check: 'size', case: 'idle', urgent, fine });
    else if (pop + TINY < urgent) check('size', [3, 14], 'warn', { check: 'size', case: 'underUrgent', urgent, fine, pop });
    else if (pop + TINY < fine) check('size', [3, 14], 'warn', { check: 'size', case: 'underFine', fine, pop });
    else check('size', [3, 14], 'ok', { check: 'size', case: 'enough', urgent, fine, pop });
  }

  // Lines 10, 19: the ring, and line 16: the walk to work in it.
  const ringOf: Record<TileKey, TileKey | null> = {};
  for (const h of hoods) {
    let best: { key: TileKey; d: number } | null = null;
    for (const g of rings) {
      const d = km(h, g);
      if (!best || d < best.d - 1e-9) best = { key: g, d };
    }
    ringOf[h] = best ? best.key : null;
    draft(h).ring = best ? { key: best.key, walkMin: best.d * rates.foot, segments: segs(h, best.key) } : null;
  }
  {
    if (!rings.length) {
      check('ring', [10, 19], some ? 'bad' : 'idle', some ? { check: 'ring', case: 'none' } : { check: 'ring', case: 'idle' });
    } else {
      const over: TileKey[] = [];
      let buildings = 0;
      for (const g of rings) {
        const n = unitsAt(g);
        const load = hoods.filter((h) => ringOf[h] === g).length * pop1;
        const cap = n * rates.ringServes;
        buildings += n;
        const p = draft(g);
        p.load = load;
        p.cap = cap;
        p.needs = Math.ceil(load / rates.ringServes - 1e-9);
        if (load > cap + TINY) {
          over.push(g);
          flag(g, 'bad', { kind: 'ringFull', needs: p.needs, has: n, load });
        }
      }
      if (over.length) {
        check(
          'ring',
          [10, 19],
          'bad',
          {
            check: 'ring',
            case: 'full',
            rings: rings.length,
            over: over.length,
            serves: rates.ringServes,
            pop,
            needed: Math.ceil(pop / rates.ringServes - 1e-9),
          },
          over,
        );
      } else {
        check('ring', [10, 19], some ? 'ok' : 'idle', { check: 'ring', case: 'room', buildings, serves: rates.ringServes, pop });
      }
    }
  }
  {
    const reachOf = (h: TileKey): NonNullable<TileReport['ring']> | null => draft(h).ring ?? null;
    const far = hoods.filter((h) => {
      const r = reachOf(h);
      return r !== null && r.walkMin > walking.longWalkMin + TINY;
    });
    const cut = far.filter((h) => reachOf(h)?.segments === null);
    if (!some || !rings.length) check('work', [16], 'idle', { check: 'work', case: 'idle' });
    else if (cut.length) {
      for (const h of cut) flag(h, 'bad', { kind: 'farFromRingNoLine', walkMin: reachOf(h)?.walkMin ?? 0 });
      check('work', [16], 'bad', { check: 'work', case: 'cut', count: cut.length }, cut);
    } else if (far.length) {
      for (const h of far) flag(h, 'warn', { kind: 'farFromRing', walkMin: reachOf(h)?.walkMin ?? 0 });
      check('work', [16], 'warn', { check: 'work', case: 'far', count: far.length }, far);
    } else {
      const farthestMin = Math.max(...hoods.map((h) => reachOf(h)?.walkMin ?? 0));
      check('work', [16], 'ok', { check: 'work', case: 'within', farthestMin });
    }
  }

  // Line 6: people walk to the movers, so every neighborhood needs a stop on a line that reaches its ring.
  {
    const without = hoods.filter((h) => {
      const r = draft(h).ring;
      return r ? r.segments === null : !stop(h);
    });
    for (const h of without) flag(h, 'bad', stop(h) ? { kind: 'lineMissesRing' } : { kind: 'noStop' });
    if (!some) check('stops', [6], 'idle', { check: 'stops', case: 'idle' });
    else if (without.length) check('stops', [6], 'bad', { check: 'stops', case: 'without', count: without.length }, without);
    else check('stops', [6], 'ok', { check: 'stops', case: 'all' });
  }

  // Lines 15, 16: schools under their caps, a seat for every pupil, inside the 30-minute walk.
  for (const kind of SCHOOLS) {
    // A wave of children can sit in some grades only.
    const more = stress.kids ? stress.kids[kind] : stress.children;
    const spec = cappedNeed(rates, kind);
    const each = pop1 * spec.grades * shared.gradeShare * (1 + more);
    const places = hoods.filter((h) => hoodAt(h)?.has[kind]).map((h) => ({ key: h, cap: spec.cap }));
    const res = seat(
      hoods.map((h) => ({ key: h, amount: each })),
      places,
      walk,
      walking.longWalkMin + TINY,
    );
    for (const p of places) (draft(p.key).schools ??= {})[kind] = { load: res.load[p.key] ?? 0, cap: spec.cap };
    for (const h of hoods) (draft(h).goes ??= {})[kind] = { to: res.goes[h] ?? [], left: res.left[h] ?? 0, each };
    const out = hoods.filter((h) => (res.left[h] ?? 0) > 0.5);
    const missing = out.reduce((t, h) => t + (res.left[h] ?? 0), 0);
    for (const h of out) flag(h, 'bad', { kind: 'pupilsUnseated', school: kind, pupils: res.left[h] ?? 0 });
    if (!some) check(kind, [15, 16], 'idle', { check: kind, case: 'idle', cap: spec.cap });
    else if (!places.length) check(kind, [15, 16], 'bad', { check: kind, case: 'none', pupils: each * hoods.length }, out);
    else if (out.length) {
      check(kind, [15, 16], 'bad', { check: kind, case: 'unseated', missing, hoods: out.length, cap: spec.cap }, out);
    } else {
      let fullest = 0;
      let longest = 0;
      for (const p of places) fullest = Math.max(fullest, res.load[p.key] ?? 0);
      for (const h of hoods) for (const g of res.goes[h] ?? []) if (g.amount > 0.5) longest = Math.max(longest, g.minutes);
      check(kind, [15, 16], 'ok', {
        check: kind,
        case: 'seated',
        schools: places.length,
        pupils: each * hoods.length,
        fullest,
        cap: spec.cap,
        longestMin: longest,
      });
    }
  }

  // Line 4: larger fields a slightly longer walk or a short ride away.
  const fields = hoods.filter((h) => hoodAt(h)?.has.fields);
  {
    for (const h of hoods) {
      let best: { key: TileKey; d: number } | null = null;
      for (const f of fields) {
        const d = km(h, f);
        if (!best || d < best.d - 1e-9) best = { key: f, d };
      }
      draft(h).fields = best ? { key: best.key, walkMin: walk(h, best.key), segments: segs(h, best.key) } : null;
    }
    const far = hoods.filter((h) => {
      const f = draft(h).fields;
      return !f || (f.walkMin > rates.fieldWalk + TINY && f.segments === null);
    });
    if (!some) check('fields', [4], 'idle', { check: 'fields', case: 'idle' });
    else if (!fields.length) check('fields', [4], 'bad', { check: 'fields', case: 'none' });
    else if (far.length) {
      for (const h of far) flag(h, 'bad', { kind: 'fieldsFar', walkMin: draft(h).fields?.walkMin ?? 0 });
      check('fields', [4], 'bad', { check: 'fields', case: 'far', count: far.length, fieldWalk: rates.fieldWalk }, far);
    } else check('fields', [4], 'ok', { check: 'fields', case: 'near', sets: fields.length, fieldWalk: rates.fieldWalk });
  }

  // Trips over the real distances: walk inside the limit, bike some of what is bikeable, ride the rest if a mover runs.
  // A trip past its walk with no mover to take is stuck. A trip with no place to go to (no seat, no fields, no ring)
  // is counted apart, because the line it breaks is the one about that place.
  const total = { foot: 0, bike: 0, ride: 0, stuck: 0, nowhere: 0, noRide: 0, door: 0, inVehicle: 0 };
  const stuckBy: Record<TileKey, number> = {};
  const blame: Record<TileKey, number> = {};
  const share = rates.share;
  const leg = (a: TileKey, b: TileKey, weight: number, limit: number, farEnd: boolean): void => {
    if (!(weight > 0)) return;
    const same = a === b;
    const w = same ? (farEnd ? rates.acrossTile : rates.inTile) : km(a, b) * rates.foot;
    const hopsBetween = same ? null : segs(a, b);
    const canRide = hopsBetween !== null;
    let foot = 0;
    let bike = 0;
    let ride = 0;
    let stuck = 0;
    if (w <= limit + TINY) {
      if (canRide) {
        foot = 1 - shared.rideAnyway;
        ride = shared.rideAnyway;
      } else {
        foot = 1;
        total.noRide += weight * shared.rideAnyway;
      }
    } else {
      if ((w * rates.bike) / rates.foot <= shared.bikeMaxMin + TINY) bike = (1 - shared.rideAnyway) * walking.bikeWilling;
      if (canRide) ride = 1 - bike;
      else stuck = 1 - bike;
    }
    total.foot += weight * foot;
    total.bike += weight * bike;
    total.ride += weight * ride;
    if (stuck > 0) {
      total.stuck += weight * stuck;
      stuckBy[a] = (stuckBy[a] ?? 0) + weight * stuck;
      // The tile to mark is the end with no stop; with a stop at both ends, the two lines do not meet.
      const bare = [a, b].filter((k) => !stop(k));
      for (const k of bare.length ? bare : [a, b]) blame[k] = (blame[k] ?? 0) + weight * stuck;
    }
    if (ride > 0 && hopsBetween !== null) {
      const inVehicle = ((hopsBetween * rates.stepKm) / walking.rideKmh) * 60;
      total.inVehicle += weight * ride * inVehicle;
      total.door += weight * ride * (rates.inTile + walking.waitMin + inVehicle + (farEnd ? rates.inTile : 0));
    }
  };
  for (const h of hoods) {
    total.foot += pop1 * share.daily;
    total.noRide += pop1 * share.daily * shared.rideAnyway;
    for (const kind of SCHOOLS) {
      const g = draft(h).goes?.[kind];
      if (!g) continue;
      for (const way of g.to) leg(h, way.to, (pop1 * share[kind] * way.amount) / g.each, walking.longWalkMin, false);
      if (g.left > 1e-9) total.nowhere += (pop1 * share[kind] * g.left) / g.each;
    }
    const f = draft(h).fields;
    if (f) leg(h, f.key, pop1 * share.fields, rates.fieldWalk, false);
    else total.nowhere += pop1 * share.fields;
    const g = ringOf[h];
    if (g) {
      leg(h, g, pop1 * share.civic, shared.walkMaxMin, false);
      leg(h, g, pop1 * share.office, walking.longWalkMin, false);
    } else total.nowhere += pop1 * (share.civic + share.office);
    for (const j of hoods) {
      leg(h, j, (pop1 * share.otherWork) / hoods.length, walking.longWalkMin, true);
      leg(h, j, (pop1 * share.rest) / hoods.length, shared.walkMaxMin, true);
    }
    draft(h).stuck = (stuckBy[h] ?? 0) / pop1;
  }
  {
    const stuckShare = pop > 0 ? total.stuck / pop : 0;
    const where = keys.filter((k) => (blame[k] ?? 0) / pop1 > 0.001);
    if (!some) check('ways', [17], 'idle', { check: 'ways', case: 'idle' });
    else if (stuckShare > 0.005) {
      for (const k of where) {
        const own = draft(k).stuck ?? 0;
        flag(k, 'bad', own >= 0.0005 ? { kind: 'tripsStuck', share: own } : { kind: 'tripsToHereStuck' });
      }
      check('ways', [17], 'bad', { check: 'ways', case: 'stuck', share: stuckShare }, where);
    } else {
      check('ways', [17], 'ok', {
        check: 'ways',
        case: 'flowing',
        foot: total.foot / pop,
        bike: total.bike / pop,
        ride: total.ride / pop,
        nowhere: total.nowhere / pop,
      });
    }
  }

  // Lines 20 to 22: power, water and waste, each with a plant on the sub level.
  const units = (kind: PlantKind): number => of(kind).reduce((t, k) => t + unitsAt(k), 0);
  const modules = units('power');
  const peak = (pop * rates.peakKw) / 1000;
  const needModules = pop > 0 ? Math.ceil(peak / rates.moduleMw - 1e-9) + 1 : 0;
  {
    if (!some && !modules) check('power', [20, 21], 'idle', { check: 'power', case: 'idle', moduleMw: rates.moduleMw });
    else if (modules < needModules) {
      check('power', [20, 21], 'bad', { check: 'power', case: 'short', modules, peakMw: peak, needed: needModules }, of('power'));
    } else {
      check('power', [20, 21], 'ok', {
        check: 'power',
        case: 'carries',
        modules,
        firmMw: Math.max(0, modules - 1) * rates.moduleMw,
        peakMw: peak,
      });
    }
  }
  for (const kind of ['water', 'sewage', 'waste'] as const) {
    const n = units(kind);
    const cap = n * rates.plantServes;
    if (!some && !n) check(kind, [22], 'idle', { check: kind, case: 'idle', serves: rates.plantServes });
    else if (cap + TINY < pop) {
      check(
        kind,
        [22],
        'bad',
        { check: kind, case: 'short', units: n, cap, pop, needed: Math.ceil(pop / rates.plantServes - 1e-9) },
        of(kind),
      );
    } else if (kind === 'sewage') {
      check(kind, [22], 'ok', {
        check: 'sewage',
        case: 'serves',
        units: n,
        cap,
        cleansMgd: modules ? (pop * rates.sewageGal) / 1e6 : null,
        coolingMgd: modules ? modules * rates.coolingMgd : null,
      });
    } else check(kind, [22], 'ok', { check: kind, case: 'serves', units: n, cap });
  }
  {
    const plants = keys.filter((k) => (PLANTS as readonly string[]).includes(tiles[k]?.kind ?? ''));
    const loose = plants.filter((p) => !hoods.concat(rings).some((t) => segs(p, t) !== null));
    for (const p of loose) flag(p, 'bad', { kind: 'plantOffLine' });
    if (!plants.length || !some) check('haul', [5], 'idle', { check: 'haul', case: 'idle' });
    else if (loose.length) check('haul', [5], 'bad', { check: 'haul', case: 'loose', count: loose.length }, loose);
    else check('haul', [5], 'ok', { check: 'haul', case: 'reached' });
  }

  // What has been built, and how the city compares with a car city of the same size.
  const stops = keys.filter(stop).length;
  const segments = Object.keys(layout.lines).length;
  const hoodsWithStop = hoods.filter(stop).length;
  const riders = total.ride * rates.base.tripsPerDay;
  const vehicleTrips = riders / rates.perVehicle;
  const inVehicle = total.ride > 0 ? total.inVehicle / total.ride : 0;
  const fleet =
    (((vehicleTrips * shared.peakShare * (inVehicle + 2 * walking.dwellMin)) / 60) * (1 + walking.emptyRunning)) *
    (1 + walking.reserve);
  const car = pop > 0 ? deriveCarCity({ ...shared, pop }, rates.car) : null;
  const moverKm = segments * rates.stepKm;
  const walkwayKm = hoodsWithStop * rates.walkwayKm;
  const score: Score = {
    pop,
    hoods: hoods.length,
    built: keys.length,
    acres: keys.length * rates.tileAcres,
    foot: pop > 0 ? total.foot / pop : 0,
    bike: pop > 0 ? total.bike / pop : 0,
    ride: pop > 0 ? total.ride / pop : 0,
    noRide: pop > 0 ? total.noRide / pop : 0,
    stuck: pop > 0 ? total.stuck / pop : 0,
    nowhere: pop > 0 ? total.nowhere / pop : 0,
    fleet,
    door: total.ride > 0 ? total.door / total.ride : 0,
    moverKm,
    walkwayKm,
    pipeKm: hoods.length * rates.pipeKm,
    subLevelKm: moverKm + walkwayKm,
    stops,
    entries: hoods.length * rates.entries,
    modules,
    peak,
    ringBuildings: rings.reduce((t, g) => t + unitsAt(g), 0),
    schools: {
      elementary: hoods.filter((h) => hoodAt(h)?.has.elementary).length,
      middle: hoods.filter((h) => hoodAt(h)?.has.middle).length,
      high: hoods.filter((h) => hoodAt(h)?.has.high).length,
    },
    fields: fields.length,
    units: { power: modules, water: units('water'), sewage: units('sewage'), waste: units('waste') },
    needModules,
    firmMW: Math.max(0, modules - 1) * rates.moduleMw,
    car: car
      ? {
          acres: car.areaKm2 * 247.105,
          vehicles: car.fleet,
          ride: car.ride,
          foot: car.walk,
          bike: car.bike,
          door: car.doorMin,
          places: car.fleet * rates.car.spacesPerVeh,
        }
      : null,
  };
  const reports: Record<TileKey, TileReport> = {};
  for (const k of Object.keys(per)) {
    const p = per[k];
    if (p) reports[k] = finish(p);
  }
  return { per: reports, checks, score, stress, pop1 };
}

/** Close a draft into a report, carrying only the fields the tile's kind set. */
function finish(p: Draft): TileReport {
  const out: {
    -readonly [K in keyof TileReport]: TileReport[K];
  } = { issues: p.issues, level: p.level, stop: p.stop };
  if (p.ring !== undefined) out.ring = p.ring;
  if (p.load !== undefined) out.load = p.load;
  if (p.cap !== undefined) out.cap = p.cap;
  if (p.needs !== undefined) out.needs = p.needs;
  if (p.schools !== undefined) out.schools = p.schools;
  if (p.goes !== undefined) {
    const goes = p.goes;
    out.goes = {
      elementary: goes.elementary ?? { to: [], left: 0, each: 0 },
      middle: goes.middle ?? { to: [], left: 0, each: 0 },
      high: goes.high ?? { to: [], left: 0, each: 0 },
    };
  }
  if (p.fields !== undefined) out.fields = p.fields;
  if (p.stuck !== undefined) out.stuck = p.stuck;
  return out;
}
