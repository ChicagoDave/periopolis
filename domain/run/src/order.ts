/**
 * @file Ordering while the clock runs: a layout command is made on the plan, and what changed becomes jobs or cancels them.
 * Public interface: OrderEvent, OrderOutcome, placeOrder.
 * Owner context: Run (domain).
 */
import type { Layout, Outcome, SiteEvent, SiteRejection } from '@city/site';
import { crewed } from './crews.ts';
import type { Job } from './jobs.ts';
import { draftOf, pieces, planned, removePiece, splitPiece } from './pieces.ts';
import type { Game } from './run.ts';
import { PIECES } from './rules.ts';
import type { PieceKind, RunRules } from './rules.ts';

/** What an order did: a job placed, a job in hand canceled, or a standing piece taken down. */
export type OrderEvent =
  | {
      readonly type: 'JobOrdered';
      readonly what: PieceKind;
      readonly at: string;
      readonly total: number;
      /** Whether a crew is free for it now. */
      readonly startsNow: boolean;
      /** A reactor's first module, which brings its site. */
      readonly withSite: boolean;
    }
  | { readonly type: 'JobCanceled'; readonly what: PieceKind; readonly at: string }
  | { readonly type: 'PieceTakenDown'; readonly what: PieceKind; readonly at: string };

/** An order's answer: the new game and what happened, or the layout command's rejection. */
export type OrderOutcome =
  | { readonly ok: true; readonly game: Game; readonly siteEvent: SiteEvent; readonly events: readonly OrderEvent[] }
  | { readonly ok: false; readonly rejection: SiteRejection };

function pieceKind(text: string): PieceKind | null {
  return (PIECES as readonly string[]).includes(text) ? (text as PieceKind) : null;
}

/**
 * Place an order: apply a layout command to the board as it will stand, and turn the difference into work.
 * What went is canceled from the work in hand, the latest first, or taken down if it already stands. What came is
 * ordered, a reactor's first module with its site.
 * @param game - the game, with its clock running
 * @param command - the layout command, applied to the planned board
 * @param rules - the clock's rules
 */
export function placeOrder(game: Game, command: (plan: Layout) => Outcome, rules: RunRules): OrderOutcome {
  if (!game.clock) throw new Error('the clock is not running');
  const before = planned(game.layout, game.clock.jobs);
  const res = command(before);
  if (!res.ok) return res;
  const was = pieces(before);
  const will = pieces(res.layout);
  const keys = Object.keys({ ...was, ...will });
  const draft = draftOf(game.layout);
  const jobs: Job[] = [...game.clock.jobs];
  const events: OrderEvent[] = [];
  for (const key of keys) {
    const [kind, at] = splitPiece(key);
    const what = pieceKind(kind);
    if (!what) continue;
    for (let n = (was[key] ?? 0) - (will[key] ?? 0); n > 0; n--) {
      let i = jobs.length - 1;
      while (i >= 0 && !(jobs[i]?.what === what && jobs[i]?.at === at)) i--;
      if (i >= 0) {
        jobs.splice(i, 1);
        events.push({ type: 'JobCanceled', what, at });
      } else {
        removePiece(draft, what, at);
        events.push({ type: 'PieceTakenDown', what, at });
      }
    }
  }
  for (const key of keys) {
    const [kind, at] = splitPiece(key);
    const what = pieceKind(kind);
    if (!what) continue;
    for (let n = (will[key] ?? 0) - (was[key] ?? 0); n > 0; n--) {
      const withSite = what === 'power' && !was[key];
      const total = withSite ? rules.firstModule : rules.build[what];
      jobs.push({ what, at, left: total, total });
      const startsNow = crewed(jobs, rules.crews, game.clock.inOrder === true)[jobs.length - 1] === true;
      events.push({ type: 'JobOrdered', what, at, total, startsNow, withSite });
    }
  }
  return {
    ok: true,
    game: { layout: { tiles: draft.tiles, lines: draft.lines }, clock: { ...game.clock, jobs } },
    siteEvent: res.event,
    events,
  };
}
