/**
 * @file The month clock (ADR-0009): who lives in the finished neighborhoods, month by month. Each month the city's
 * people change by the Ledger's `monthOf` (births, deaths, movers who leave, arrivals into empty homes at no more than
 * the citywide pace); the change is shared among the neighborhoods, and arrivals fill empty homes in the board's tile
 * order. Construction stays a yearly step; a month records its people and its share of the running bill.
 * Public interface: Growth, MonthRow, growthOn, monthStep, occupiedOf, homesOf.
 * Owner context: Run (domain).
 *
 * Nothing here is random: the same layout and rates give the same months. A clock without growth is the sketch's
 * clock, untouched (ADR-0003); growth is opt-in when a run starts.
 */
import { LAYERS, allTiles, assessCore, costOf, kindOf, monthOf } from '@city/site';
import type { Layer, Layout, PopulationMonth, SiteRates, Stress, TileKey } from '@city/site';

import type { Money } from './spend.ts';

/** One month of the city's people, and what the month spent. */
export interface MonthRow {
  readonly year: number;
  /** Months completed in the year, 1 to 12. */
  readonly month: number;
  readonly births: number;
  readonly deaths: number;
  readonly left: number;
  readonly arrived: number;
  /** People living in the city at the month's end. */
  readonly people: number;
  /** Homes as built, in people. */
  readonly homes: number;
  /** The month's spend by layer: a twelfth of the running bill for the people living there, and, in month 12, the
   * year's change in what stands. */
  readonly spend: Money;
}

/** The month clock on a run. */
export interface Growth {
  /** Months completed in the current year, 0 to 11. */
  readonly month: number;
  /** People living in each finished neighborhood. */
  readonly occupied: Readonly<Record<TileKey, number>>;
  /** Every month so far, in order. */
  readonly months: readonly MonthRow[];
}

/** The neighborhoods that stand, in the board's tile order. */
function hoodsOf(layout: Layout, rates: SiteRates): TileKey[] {
  return allTiles(rates.outline).filter((k) => layout.tiles[k]?.kind === 'hood');
}

/**
 * The homes as built, in people: a neighborhood's capacity times the neighborhoods that stand.
 * @param layout - what stands
 * @param rates - the ledger's rates
 */
export function homesOf(layout: Layout, rates: SiteRates): number {
  return hoodsOf(layout, rates).length * rates.hood;
}

/**
 * Growth starting on what stands: every neighborhood that already stands is lived in, full; the clock starts at month 0.
 * @param layout - what stands when the run starts
 * @param rates - the ledger's rates
 */
export function growthOn(layout: Layout, rates: SiteRates): Growth {
  const occupied: Record<TileKey, number> = {};
  for (const h of hoodsOf(layout, rates)) occupied[h] = rates.hood;
  return { month: 0, occupied, months: [] };
}

/**
 * The occupancy to check a layout under: every standing neighborhood with its occupants, a new one empty.
 * @param layout - what stands
 * @param growth - the month clock
 * @param rates - the ledger's rates
 */
export function occupiedOf(layout: Layout, growth: Growth, rates: SiteRates): Record<TileKey, number> {
  const out: Record<TileKey, number> = {};
  for (const h of hoodsOf(layout, rates)) out[h] = growth.occupied[h] ?? 0;
  return out;
}

/** The running layers of what stands, for the people living there under this stress. */
function billOf(layout: Layout, occupied: Readonly<Record<TileKey, number>>, stress: Stress, rates: SiteRates): Record<Layer, number> {
  const core = assessCore(layout, stress, rates, occupied);
  return { ...costOf(layout, core, rates).layers };
}

/**
 * One month passes for the city's people: births, deaths and movers who leave are shared among the neighborhoods by
 * their occupants; arrivals fill empty homes in tile order, no more than the citywide pace allows.
 * @param layout - what stands this month
 * @param growth - the month clock before the month
 * @param year - the year the month belongs to
 * @param stress - this year's stress, for the month's bill
 * @param rates - the ledger's rates
 * @param capital - the year's change in what stands, paid in month 12; nothing in other months
 * @returns the month clock after the month, with the month's row appended
 * @throws Error when the month clock has already completed the year (month 12 belongs to the yearly step)
 */
export function monthStep(
  layout: Layout,
  growth: Growth,
  year: number,
  stress: Stress,
  rates: SiteRates,
  capital: Money | null = null,
): Growth {
  if (growth.month >= 12) throw new Error(`the year is complete at month ${growth.month}; start the next year first`);
  const hoods = hoodsOf(layout, rates);
  const before = occupiedOf(layout, growth, rates);
  const people = hoods.reduce((t, h) => t + (before[h] ?? 0), 0);
  const homes = hoods.length * rates.hood;
  const m: PopulationMonth = monthOf(people, homes);
  // Births, deaths and leavers fall on each neighborhood by its share of the people.
  const kept = people > 0 ? (people + m.births - m.deaths - m.left) / people : 0;
  const occupied: Record<TileKey, number> = {};
  for (const h of hoods) occupied[h] = Math.max(0, (before[h] ?? 0) * kept);
  let toPlace = m.arrived;
  for (const h of hoods) {
    if (toPlace <= 0) break;
    const room = Math.max(0, rates.hood - (occupied[h] ?? 0));
    const take = Math.min(room, toPlace);
    occupied[h] = (occupied[h] ?? 0) + take;
    toPlace -= take;
  }
  const bill = billOf(layout, occupied, stress, rates);
  const spend = {} as Record<Layer, number>;
  for (const layer of LAYERS) spend[layer] = kindOf(layer) === 'capital' ? (capital ? capital[layer] : 0) : bill[layer] / 12;
  const month = growth.month + 1;
  const row: MonthRow = {
    year,
    month,
    births: m.births,
    deaths: m.deaths,
    left: m.left,
    arrived: m.arrived,
    people: hoods.reduce((t, h) => t + (occupied[h] ?? 0), 0),
    homes,
    spend,
  };
  return { month, occupied, months: [...growth.months, row] };
}
