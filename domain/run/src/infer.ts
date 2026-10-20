/**
 * @file The run orders for itself (ADR-0015): each month, after the people have moved, it reads the city's needs off
 * the planned board and orders what the Site proposes, and keeps homes ahead of arrivals by ordering the next
 * neighborhood where the Site puts it. Every order goes through `placeOrder`, so it is work in hand like the player's.
 * A piece the player vetoed is never ordered again.
 * Public interface: Inferred, inferStep, homesAhead, cancelOrder.
 * Owner context: Run (domain).
 *
 * Nothing here is random: the same game gives the same orders. A clock without `infer` is untouched by it.
 */
import { POPULATION, applyProposal, edgeKey, placeNeighborhood, proposeFor, proposeNeighborhood } from '@city/site';
import type { Layout, Need, Outcome, SiteRates, Step } from '@city/site';
import { cancelJob } from './jobs.ts';
import type { OrderEvent } from './order.ts';
import { placeOrder } from './order.ts';
import { pieceId, planned, splitPiece } from './pieces.ts';
import type { Game } from './run.ts';
import type { RunRules } from './rules.ts';
import type { Clock } from './timeline.ts';

/** Why the run ordered: the need it answers, or homes for the people arriving. */
export type InferredWhy = Need['need'] | 'homes';

/** What the run did for itself in a month: an order placed, or a need the board has no room for. */
export type Inferred =
  | { readonly type: 'InferredOrder'; readonly why: InferredWhy; readonly events: readonly OrderEvent[] }
  | { readonly type: 'NoRoom'; readonly why: InferredWhy };

const MONTHS = 12;

/** The piece one proposal step would build. */
function stepPiece(step: Step): string {
  switch (step.command) {
    case 'addRingBuilding':
      return pieceId('ring', step.tile);
    case 'addPlantUnit':
      return pieceId(step.plant, step.tile);
    case 'toggleExtra':
      return pieceId(step.extra, step.tile);
    case 'layStretch':
      return pieceId('line', edgeKey(step.from, step.to));
  }
}

/** A proposal's steps as one layout command: every step through the ordinary commands, the last step's event. */
function asCommand(steps: readonly Step[], rates: SiteRates): (plan: Layout) => Outcome {
  return (plan) => {
    const out = applyProposal(plan, steps, rates);
    if (!out.ok) return out;
    const event = out.events[out.events.length - 1];
    if (!event) throw new Error('a proposal with no steps');
    return { ok: true, layout: out.layout, event };
  };
}

/**
 * The homes ahead of arrivals: the capacity of every neighborhood standing or in hand, less the people living there
 * (ADR-0015 Decision 2).
 * @param game - the game, with its clock running
 * @param rates - the ledger's rates
 * @returns people's worth of homes; zero on an empty site
 */
export function homesAhead(game: Game, rates: SiteRates): number {
  if (!game.clock) throw new Error('the clock is not running');
  const plan = planned(game.layout, game.clock.jobs);
  const hoods = Object.keys(plan.tiles).filter((k) => plan.tiles[k]?.kind === 'hood').length;
  const occupied = game.clock.growth?.occupied ?? {};
  const people = Object.keys(occupied).reduce((t, k) => t + (occupied[k] ?? 0), 0);
  return hoods * rates.hood - people;
}

/**
 * One month's inference (ADR-0015 Decision 2): every proposal the Site makes on the planned board becomes an order,
 * unless a piece of it is vetoed; then, when the homes ahead of arrivals fall below the lead, one neighborhood is
 * ordered where the Site puts it. Without `infer` on the clock, nothing happens.
 * @param game - the game after the month's people have moved, with its clock running
 * @param rates - the ledger's rates
 * @param rules - the clock's rules, with the lead in months
 * @returns the game with the orders in hand, and what was ordered or could not be, in order
 */
export function inferStep(game: Game, rates: SiteRates, rules: RunRules): { readonly game: Game; readonly facts: readonly Inferred[] } {
  const clock = game.clock;
  if (!clock || !clock.infer) return { game, facts: [] };
  const vetoes = clock.vetoes ?? [];
  const facts: Inferred[] = [];
  let g = game;
  for (const p of proposeFor(planned(g.layout, clock.jobs), rates)) {
    if (!p.room) {
      facts.push({ type: 'NoRoom', why: p.need.need });
      continue;
    }
    if (p.steps.some((s) => vetoes.includes(stepPiece(s)))) continue;
    const out = placeOrder(g, asCommand(p.steps, rates), rules, 'run');
    // A refusal means the planned board no longer holds what the proposal assumed (an earlier proposal was skipped):
    // the need is read again next month, so nothing is recorded for it now.
    if (!out.ok) continue;
    g = out.game;
    facts.push({ type: 'InferredOrder', why: p.need.need, events: out.events });
  }
  const lead = (rules.lead * POPULATION.arrivalsPerYear.value) / MONTHS;
  if (homesAhead(g, rates) < lead && g.clock) {
    const avoid = vetoes.filter((v) => splitPiece(v)[0] === 'hood').map((v) => splitPiece(v)[1]);
    const at = proposeNeighborhood(planned(g.layout, g.clock.jobs), rates, avoid);
    const out = at ? placeOrder(g, (plan) => placeNeighborhood(plan, at, rates), rules, 'run') : null;
    if (out && out.ok) {
      g = out.game;
      facts.push({ type: 'InferredOrder', why: 'homes', events: out.events });
    } else facts.push({ type: 'NoRoom', why: 'homes' });
  }
  return { game: g, facts };
}

/**
 * The player cancels a job. A job the run ordered is vetoed as it goes: the run never orders that piece again
 * (ADR-0015 Decision 5). The player's own jobs are dropped as `cancelJob` drops them, and nothing is remembered.
 * @param clock - the clock
 * @param index - the job's place in the work in hand
 * @returns the clock with the job gone; the same clock when the index names nothing
 */
export function cancelOrder(clock: Clock, index: number): Clock {
  const j = clock.jobs[index];
  if (!j) return clock;
  const jobs = cancelJob(clock.jobs, index);
  if (!j.inferred || !clock.infer) return { ...clock, jobs };
  const id = pieceId(j.what, j.at);
  const vetoes = clock.vetoes ?? [];
  return { ...clock, jobs, vetoes: vetoes.includes(id) ? vetoes : [...vetoes, id] };
}
