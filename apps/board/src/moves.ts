/**
 * @file A click with a tool, made into a layout command or a crew's order. Holds the line tool's cursor: where the
 * mover line continues from.
 * Public interface: Game, Move, commandFor, move.
 * Owner context: Board (adapter).
 */
import { RULES, placeOrder } from '@city/run';
import type { Game } from '@city/run';
import { RATES, addPlantUnit, addRingBuilding, adjacent, erase, isPlantKind, layStretch, placeNeighborhood, toggleExtra } from '@city/site';
import type { Layout, Outcome, TileKey } from '@city/site';
import { moveSaid, orderSaid } from './wording.ts';
import type { ToolId } from './wording.ts';

export type { Game };

/** What a move did: the game after it, what it said, whether anything changed, and where the line continues from. */
export interface Move {
  readonly game: Game;
  readonly said: string;
  readonly changed: boolean;
  readonly from: TileKey | null;
}

const EXTRAS: readonly string[] = ['elementary', 'middle', 'high', 'fields'];

/**
 * The layout command a tool makes at a tile, or null for the inspect tool and a line click with nothing to continue from.
 * @param tool - the tool
 * @param key - the tile clicked
 * @param from - where the line continues from, for the line tool
 */
export function commandFor(tool: ToolId, key: TileKey, from: TileKey | null): ((layout: Layout) => Outcome) | null {
  if (tool === 'hood') return (l) => placeNeighborhood(l, key, RATES);
  if (tool === 'ring') return (l) => addRingBuilding(l, key, RATES);
  if (tool === 'elementary' || tool === 'middle' || tool === 'high' || tool === 'fields') return (l) => toggleExtra(l, key, tool, RATES);
  if (isPlantKind(tool)) return (l) => addPlantUnit(l, key, tool, RATES);
  if (tool === 'erase') return (l) => erase(l, key, RATES);
  if (tool === 'line') return from ? (l) => layStretch(l, from, key, RATES) : null;
  return null;
}

/**
 * One click with one tool. While the clock runs the click is an order for the crews; otherwise it is built at once.
 * The line tool needs two clicks: the first only sets where the line continues from.
 */
export function move(game: Game, tool: ToolId, key: TileKey, from: TileKey | null): Move {
  const no = (said: string, nextFrom: TileKey | null): Move => ({ game, said, changed: false, from: nextFrom });
  if (tool === 'line') {
    if (!from || from === key) return no('Now click a neighboring tile to run the line to it.', key);
    if (!adjacent(from, key, RATES.board)) return no('The line runs between neighboring tiles. Starting again from here.', key);
  }
  const command = commandFor(tool, key, from);
  if (!command) return no('', null);
  const nextFrom = tool === 'line' ? key : null;
  if (game.clock) {
    const out = placeOrder(game, command, RULES);
    if (!out.ok) return no(moveSaid(tool, out, RATES), nextFrom);
    return { game: out.game, said: orderSaid(out.events), changed: true, from: nextFrom };
  }
  const out = command(game.layout);
  if (!out.ok) return no(moveSaid(tool, out, RATES), nextFrom);
  return { game: { layout: out.layout, clock: null }, said: moveSaid(tool, out, RATES), changed: true, from: nextFrom };
}

void EXTRAS;
