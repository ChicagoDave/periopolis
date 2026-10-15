/**
 * @file A city sized to its people: the same tiles and line, with every ring building and plant unit the lines do not
 * need taken away. The ledger's city on the board carries a ring for 62,170 and three reactor modules for 50,000; sized,
 * it carries what its people need and no more.
 * Public interface: sizedTo, sizedLayout.
 * Owner context: Site (domain).
 *
 * Trimming runs only the ordinary `erase` command, one unit at a time, and keeps a removal only when the layout still
 * needs nothing (ADR-0008) and no check that held breaks. The sketch's `starterLayout` is never changed (ADR-0003).
 */
import { assessCore } from './assess.ts';
import { allTiles } from './board.ts';
import { NO_STRESS } from './checks.ts';
import { erase } from './commands.ts';
import { starterLayout } from './layout.ts';
import type { Layout } from './layout.ts';
import { needsOf } from './needs.ts';
import type { SiteRates } from './rates.ts';

/**
 * Take away every ring building and plant unit the layout's lines do not need, in the board's tile order.
 * @param layout - a layout that needs nothing (`needsOf` empty)
 * @param rates - the ledger's rates
 * @returns the trimmed layout; the given one is not changed
 * @throws Error when the layout needs something already: there is nothing to size a broken city to
 */
export function sizedTo(layout: Layout, rates: SiteRates): Layout {
  if (needsOf(layout, rates).length) throw new Error('a layout that needs something cannot be sized; meet its needs first');
  const held = new Set(okChecks(layout, rates));
  let s = layout;
  for (const k of allTiles(rates.outline)) {
    for (;;) {
      const t = s.tiles[k];
      if (!t || t.kind === 'hood') break;
      const out = erase(s, k, rates);
      if (!out.ok) break;
      const still = new Set(okChecks(out.layout, rates));
      const keeps = needsOf(out.layout, rates).length === 0 && [...held].every((id) => still.has(id));
      if (!keeps) break;
      s = out.layout;
    }
  }
  return s;
}

/**
 * The ledger's city on the board, sized to its 50,000 people.
 * @param rates - the ledger's rates
 */
export function sizedLayout(rates: SiteRates): Layout {
  return sizedTo(starterLayout(), rates);
}

function okChecks(layout: Layout, rates: SiteRates): string[] {
  return assessCore(layout, NO_STRESS, rates)
    .checks.filter((c) => c.status === 'ok')
    .map((c) => c.id);
}
