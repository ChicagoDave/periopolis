/**
 * @file The Run. Twenty years on the clock: crews, jobs and the work in hand; the timeline of five announced events;
 * the yearly record and its line-years.
 * Public interface: startRun, stopRun, tick, placeOrder, cancelJob, putFirst, inHand, notices, stressAt, restoreClock,
 * the rules, and the types of games, clocks, jobs, events and records.
 * Owner context: Run (domain). Depends on @city/site alone.
 */
export { RULES, PIECES, GRADES } from './rules.ts';
export type { RunRules, PieceKind } from './rules.ts';
export { dice } from './dice.ts';
export type { Roll } from './dice.ts';
export { pieces, planned, pieceId, splitPiece } from './pieces.ts';
export type { PieceId, Placed } from './pieces.ts';
export { inHand, cancelJob, putFirst } from './jobs.ts';
export type { Job, JobStatus, JobItem, SiteInHand, WorkInHand } from './jobs.ts';
export { beginClock, waveIn, isActive, isAnnounced, stressAt, notices, pickEdge } from './timeline.ts';
export type { EventType, TimelineEvent, Clock, RecordRow, Notice } from './timeline.ts';
export { placeOrder } from './order.ts';
export type { OrderEvent, OrderOutcome } from './order.ts';
export { startRun, stopRun, tick, seenIn, restoreClock } from './run.ts';
export type { Game } from './run.ts';
