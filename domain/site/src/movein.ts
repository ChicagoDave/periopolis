/**
 * @file The move-in gate (ADR-0012 Decision 3): what one neighborhood lacks for people to move in, read off the
 * assessment of the city with that neighborhood's people counted. Water, sewage, waste and power are hard: without any
 * of them nobody moves in. Power is lacking when the modules cannot carry the peak with every one running; a city on
 * its last module takes people in and shows lines 20 and 21 broken (Decision 3 as amended 2026-10-18). School seats
 * are soft: without them only households with no school-age children do.
 * Public interface: MoveInGate, moveInGate.
 * Owner context: Site (domain).
 *
 * Like the needs (ADR-0008), the gate is read off the checks, never worked out a second time: a neighborhood lacks a
 * service exactly when that service's check is broken for its own circle (ADR-0016: a circle's homes are served by its
 * own band; for power, broken short of carrying, not short of a spare), and lacks seats of a kind exactly when that
 * school check is broken at its tile. The Site does not know who is waiting or why; the Run says which people to count.
 */
import { assessCore } from './assess.ts';
import type { TileKey } from './board.ts';
import type { CheckId, Stress } from './checks.ts';
import { circleOf } from './circle.ts';
import { NO_STRESS } from './checks.ts';
import type { Layout } from './layout.ts';
import { PLANTS, SCHOOLS } from './rates.ts';
import type { PlantKind, SchoolKind, SiteRates } from './rates.ts';

/** What one neighborhood lacks for people to move in. Both lists empty: everyone may. */
export interface MoveInGate {
  readonly hood: TileKey;
  /** Services the city cannot carry with its people counted (power: with every module running): nobody moves in while any is listed. */
  readonly short: readonly PlantKind[];
  /** Schools whose pupils from it have no seat within the walk: only the childless share moves in while any is listed. */
  readonly seats: readonly SchoolKind[];
}

/**
 * What a neighborhood lacks for people to move in, with the people given counted for it and for every other
 * neighborhood.
 * @param layout - what stands
 * @param rates - the ledger's rates
 * @param hood - the neighborhood asking
 * @param occupied - people to count in each neighborhood, the asking one included; one left out is full
 * @param childless - neighborhoods counted with no pupils
 * @param stress - the stress the city must carry them under; an ordinary year by default
 * @throws Error when the tile is not a standing neighborhood
 */
export function moveInGate(
  layout: Layout,
  rates: SiteRates,
  hood: TileKey,
  occupied: Readonly<Record<TileKey, number>>,
  childless: readonly TileKey[] = [],
  stress: Stress = NO_STRESS,
): MoveInGate {
  if (layout.tiles[hood]?.kind !== 'hood') throw new Error(`${hood} is not a standing neighborhood`);
  const core = assessCore(layout, stress, rates, occupied, childless);
  const circles = layout.circles ?? [];
  const mine = circles.length ? circleOf(circles, hood) : null;
  // A service is short for this neighborhood when its own circle is among those the check names short.
  const shortHere = (id: CheckId): boolean =>
    core.checks.some((c) => {
      if (c.id !== id || c.status !== 'bad') return false;
      const f = c.facts;
      const circleShort = f.check === 'power' || f.check === 'water' || f.check === 'sewage' || f.check === 'waste';
      // A spare module is lines 20 and 21's standard, not the gate's: `noSpare` carries the people.
      if (!circleShort || f.case !== 'short') return false;
      return f.short.some((s) => s.circle === mine);
    });
  const short = PLANTS.filter(shortHere);
  const seats = SCHOOLS.filter((kind) => core.checks.some((c) => c.id === kind && c.status === 'bad' && c.tiles.includes(hood)));
  return { hood, short, seats };
}
