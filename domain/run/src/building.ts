/**
 * @file Stops under construction (ADR-0012 Decision 6): a standing neighborhood's stop is under construction when the
 * board as planned (what stands plus the work in hand) gives it a stop on a line to the ring and the board as it
 * stands does not. Read off the Site's line 6 marks on both boards (ADR-0008); the Site never sees the jobs.
 * Public interface: stopsBuilding.
 * Owner context: Run (domain).
 */
import { NO_STRESS, allTiles, assessCore } from '@city/site';
import type { Layout, SiteRates, TileKey } from '@city/site';
import { planned } from './pieces.ts';
import type { Placed } from './pieces.ts';

/** The neighborhoods line 6 marks: no stop, or a stop on a line that misses the ring. */
function withoutStop(layout: Layout, rates: SiteRates): Set<TileKey> {
  const per = assessCore(layout, NO_STRESS, rates).per;
  const out = new Set<TileKey>();
  for (const [k, t] of Object.entries(per)) {
    if (t?.issues.some((i) => i.kind === 'noStop' || i.kind === 'lineMissesRing')) out.add(k);
  }
  return out;
}

/**
 * The standing neighborhoods whose stop is under construction, in the board's tile order.
 * @param layout - what stands
 * @param jobs - the work in hand
 * @param rates - the ledger's rates
 * @returns neighborhoods without a stop on a line to the ring now that will have one when the work in hand is done
 */
export function stopsBuilding(layout: Layout, jobs: readonly Placed[], rates: SiteRates): TileKey[] {
  if (!jobs.some((j) => j.what === 'line' || j.what === 'ring')) return [];
  const now = withoutStop(layout, rates);
  if (!now.size) return [];
  const then = withoutStop(planned(layout, jobs), rates);
  return allTiles(rates.outline).filter((k) => now.has(k) && !then.has(k));
}
