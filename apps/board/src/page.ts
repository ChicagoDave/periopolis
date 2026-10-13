/**
 * @file What the drawing modules may ask of the page: say something, redraw, make a move, mark tiles, swap the game.
 * Public interface: Page.
 * Owner context: Board (adapter).
 */
import type { Game } from '@city/run';
import type { TileKey } from '@city/site';
import type { Move } from './moves.ts';
import type { Session } from './session.ts';
import type { ToolId } from './wording.ts';

export interface Page {
  readonly s: Session;
  /** Put a sentence in the status line. */
  say(text: string): void;
  /** Redraw everything from the session. */
  render(): void;
  /** One click with a tool at a tile, with no line cursor. */
  apply(tool: ToolId, key: TileKey): void;
  /** Mark tiles on the board for a moment. */
  highlight(keys: readonly TileKey[]): void;
  /** Replace the game, remembering the old one, and say why. */
  swap(game: Game, words: string): void;
  /** Take a move: keep history, save and redraw if it changed, and say what it said. */
  commit(m: Move): void;
}
