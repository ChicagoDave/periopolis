/**
 * @file Who may live where on a clock built in order (ADR-0012 Decisions 3, 4 and 7). Each finished neighborhood is
 * admitted on its own conditions, in the board's tile order, against the city as it would be with the ones before it
 * admitted: everyone moves in when its water, sewage, waste and power are carried and its pupils have seats; only the
 * childless share when it lacks seats; nobody when a service is short. People who live there stay.
 * Public interface: Residence, HeldBack, Admission, admit, limitsOf, childlessOf.
 * Owner context: Run (domain).
 *
 * What a neighborhood lacks is the Site's to say (`moveInGate`, read off the checks); the Run only decides whom to
 * count and what follows.
 */
import { POPULATION, allTiles, moveInGate } from '@city/site';
import type { Layout, MoveInGate, PlantKind, SchoolKind, SiteRates, Stress, TileKey } from '@city/site';

/** Who may live in an admitted neighborhood: everyone, or only households with no school-age children. */
export type Residence = 'all' | 'childless';

/** A finished neighborhood standing empty or held to the childless share, and what it lacks. */
export interface HeldBack {
  readonly hood: TileKey;
  /** Services the city cannot carry with its people: while any is listed, nobody moves in. */
  readonly short: readonly PlantKind[];
  /** Schools with no seat for its pupils: while any is listed, at most the childless share lives there. */
  readonly seats: readonly SchoolKind[];
}

/** Who may live where, and what holds the rest back. */
export interface Admission {
  readonly lived: Readonly<Record<TileKey, Residence>>;
  readonly held: readonly HeldBack[];
}

function hoodsOf(layout: Layout, rates: SiteRates): TileKey[] {
  return allTiles(rates.outline).filter((k) => layout.tiles[k]?.kind === 'hood');
}

/**
 * The most people each standing neighborhood may hold: its capacity when everyone may live there, the childless share
 * of it when only they may, and nobody when it is not admitted.
 * @param layout - what stands
 * @param lived - who may live where
 * @param rates - the ledger's rates
 */
export function limitsOf(layout: Layout, lived: Readonly<Record<TileKey, Residence>>, rates: SiteRates): Record<TileKey, number> {
  const share = POPULATION.childlessShare.value;
  const out: Record<TileKey, number> = {};
  for (const h of hoodsOf(layout, rates)) {
    const r = lived[h];
    out[h] = r === 'all' ? rates.hood : r === 'childless' ? rates.hood * share : 0;
  }
  return out;
}

/**
 * The standing neighborhoods held to the childless share, in the board's tile order.
 * @param layout - what stands
 * @param lived - who may live where
 * @param rates - the ledger's rates
 */
export function childlessOf(layout: Layout, lived: Readonly<Record<TileKey, Residence>>, rates: SiteRates): TileKey[] {
  return hoodsOf(layout, rates).filter((h) => lived[h] === 'childless');
}

/**
 * Admit the finished neighborhoods that the city can carry. Neighborhoods already lived in by everyone stay so; one
 * held to the childless share stays at least so; the rest are asked in tile order, each counted at what it would hold.
 * A neighborhood no longer standing drops out.
 * @param layout - what stands
 * @param lived - who may live where before
 * @param rates - the ledger's rates
 * @param stress - the stress the city must carry its people under
 * @returns who may live where now, and what holds back each neighborhood not lived in by everyone
 */
export function admit(layout: Layout, lived: Readonly<Record<TileKey, Residence>>, rates: SiteRates, stress: Stress): Admission {
  const hoods = hoodsOf(layout, rates);
  const now: Record<TileKey, Residence> = {};
  for (const h of hoods) {
    const r = lived[h];
    if (r) now[h] = r;
  }
  const held: HeldBack[] = [];
  const ask = (h: TileKey, as: Residence): MoveInGate => {
    const trial = { ...now, [h]: as };
    return moveInGate(layout, rates, h, limitsOf(layout, trial, rates), childlessOf(layout, trial, rates), stress);
  };
  for (const h of hoods) {
    if (now[h] === 'all') continue;
    const full = ask(h, 'all');
    if (!full.short.length && !full.seats.length) {
      now[h] = 'all';
      continue;
    }
    if (!full.seats.length) {
      held.push({ hood: h, short: full.short, seats: [] });
      continue;
    }
    // Without seats its people would be the childless share; the services must carry those.
    const part = ask(h, 'childless');
    if (!part.short.length) now[h] = 'childless';
    held.push({ hood: h, short: part.short, seats: full.seats });
  }
  return { lived: now, held };
}
