/**
 * @file Who the board is checked for while a clock runs (ADR-0009, ADR-0012): the people living in each neighborhood,
 * the ones held to the childless share, and what holds the rest back, as the clock last recorded them. Between steps
 * an adapter shows the city under the same people its record was checked for.
 * Public interface: Living, livingOf.
 * Owner context: Run (domain).
 */
import type { Layout, SiteRates, TileKey } from '@city/site';
import { occupiedOf } from './growth.ts';
import { childlessOf, limitsOf } from './movein.ts';
import type { HeldBack } from './movein.ts';
import type { Clock } from './timeline.ts';

/** The people a board is checked for on a clock. */
export interface Living {
  /** People in each standing neighborhood; absent, every neighborhood is full (the sketch's yearly clock). */
  readonly occupied?: Readonly<Record<TileKey, number>>;
  /** Neighborhoods held to the childless share, which send no pupils. */
  readonly childless: readonly TileKey[];
  /** Neighborhoods standing empty or held to the childless share, and what each lacks, as last recorded. */
  readonly held: readonly HeldBack[];
}

/**
 * Who lives on the board now: with growth, the month clock's people; built in order without growth, each admitted
 * neighborhood at what it may hold; on the sketch's yearly clock, everyone (no occupancy given).
 * @param layout - what stands
 * @param clock - the running clock
 * @param rates - the ledger's rates
 * @returns the occupancy and childless neighborhoods to assess the board under, and the latest held-back facts
 */
export function livingOf(layout: Layout, clock: Clock, rates: SiteRates): Living {
  const lived = clock.inOrder ? (clock.lived ?? {}) : null;
  const childless = lived ? childlessOf(layout, lived, rates) : [];
  const occupied = clock.growth ? occupiedOf(layout, clock.growth, rates) : lived ? limitsOf(layout, lived, rates) : undefined;
  return { ...(occupied ? { occupied } : {}), childless, held: lived ? latestHeld(clock) : [] };
}

/** The held-back facts of the clock's latest step: a month passed since the year was recorded, or the year itself. */
function latestHeld(clock: Clock): readonly HeldBack[] {
  const year = clock.record[clock.record.length - 1];
  const months = clock.growth?.months ?? [];
  const month = months[months.length - 1];
  if (month && (!year || month.year > year.year)) return month.heldBack ?? [];
  return year?.heldBack ?? [];
}
