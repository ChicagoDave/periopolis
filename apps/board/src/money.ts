/**
 * @file Money as the page lays it out: the Site's rows gathered by id across every tile and stretch, in layer order,
 * each with its premise and mark; and the spend a run has made so far. Pure; the drawing is in draw/money.ts.
 * Public interface: MoneyLine, linesOf, spentSoFar.
 * Owner context: Board (adapter).
 */
import { COSTS, LAYERS } from '@city/site';
import type { CostFigures, CostId, CostPremiseId, CostRow, Layer, Mark } from '@city/site';
import { totalSpend } from '@city/run';
import type { Clock, TotalSpend } from '@city/run';

/** One line of the money table: a row id summed over everything that stands. */
export interface MoneyLine {
  readonly id: CostId;
  readonly layer: Layer;
  /** How many, summed. */
  readonly count: number;
  readonly premise: CostPremiseId;
  readonly unit: number;
  readonly mark: Mark;
  readonly cost: number;
}

/**
 * Gather priced rows by id, in the order of the six layers and of first appearance within a layer.
 * @param cost - a city's money, from the Site or the Ledger
 */
export function linesOf(cost: CostFigures): MoneyLine[] {
  const seen: Partial<Record<CostId, { count: number; cost: number; row: CostRow }>> = {};
  const order: CostId[] = [];
  for (const r of cost.rows) {
    const got = seen[r.id];
    if (got) {
      got.count += r.count;
      got.cost += r.cost;
    } else {
      seen[r.id] = { count: r.count, cost: r.cost, row: r };
      order.push(r.id);
    }
  }
  const out: MoneyLine[] = [];
  for (const layer of LAYERS) {
    for (const id of order) {
      const got = seen[id];
      if (!got || got.row.layer !== layer) continue;
      out.push({ id, layer, count: got.count, premise: got.row.premise, unit: got.row.unit, mark: COSTS[got.row.premise].mark, cost: got.cost });
    }
  }
  return out;
}

/** What a run has spent so far, years 1 on; null with no clock. */
export function spentSoFar(clock: Clock | null): TotalSpend | null {
  return clock ? totalSpend(clock.record) : null;
}
