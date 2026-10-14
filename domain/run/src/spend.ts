/**
 * @file What a run spends: each year's outlay by layer, from what stood at the end of the year against the year
 * before, and the twenty-year total (ADR-0007 Decision 6). Facts only; the Board words them.
 * Public interface: Money, noMoney, standingOf, spendOf, totalSpend.
 * Owner context: Run (domain).
 *
 * To build is paid as things finish: a capital layer's spend in a year is what stands at the end of it less what
 * stood a year before, so a piece taken down, or a fleet that shrinks with the people, comes off that year's spend.
 * To run is paid every year: a running layer's spend is that year's bill for what stands. Year 0 spends nothing, as
 * it counts for nothing; what already stood was paid before the clock started.
 */
import { LAYERS, kindOf } from '@city/site';
import type { Layer, SiteCost } from '@city/site';

/** Dollars by layer. */
export type Money = Readonly<Record<Layer, number>>;

/** Nothing in any layer. */
export function noMoney(): Money {
  const out = {} as Record<Layer, number>;
  for (const layer of LAYERS) out[layer] = 0;
  return out;
}

/**
 * What stands costs this year, by layer: the three built layers as the capital standing, the three yearly ones as
 * this year's bill.
 * @param cost - the site priced this year
 */
export function standingOf(cost: SiteCost): Money {
  return cost.layers;
}

/**
 * The year's spend, by layer.
 * @param before - what stood a year before, by layer; null for year 0, which spends nothing
 * @param standing - what stands at the end of this year, by layer
 */
export function spendOf(before: Money | null, standing: Money): Money {
  if (!before) return noMoney();
  const out = {} as Record<Layer, number>;
  for (const layer of LAYERS) {
    const now = standing[layer];
    out[layer] = kindOf(layer) === 'capital' ? now - before[layer] : now;
  }
  return out;
}

/** A run's spend summed: by layer, by year, and in all. Years from 1 on; year 0 is noted and does not count. */
export interface TotalSpend {
  readonly byLayer: Money;
  /** One entry per record row, in record order; year 0's is 0. */
  readonly byYear: readonly number[];
  readonly capital: number;
  readonly running: number;
  readonly total: number;
}

/**
 * Sum a run's spend over its record.
 * @param record - rows carrying each year's spend
 */
export function totalSpend(record: readonly { readonly year: number; readonly spend: Money }[]): TotalSpend {
  const byLayer = {} as Record<Layer, number>;
  for (const layer of LAYERS) byLayer[layer] = 0;
  const byYear: number[] = [];
  for (const r of record) {
    let year = 0;
    if (r.year > 0) {
      for (const layer of LAYERS) {
        byLayer[layer] += r.spend[layer];
        year += r.spend[layer];
      }
    }
    byYear.push(year);
  }
  const capital = byLayer.groundworks + byLayer.buildings + byLayer.fleet;
  const running = byLayer.upkeep + byLayer.civic + byLayer.households;
  return { byLayer, byYear, capital, running, total: capital + running };
}
