/**
 * @file The Run. Twenty years on the clock: crews, jobs and the work in hand; the timeline of five announced events;
 * the yearly record and its line-years.
 * Public interface: startRun, stopRun, tick, tickMonth, the month clock (growth), placeOrder, cancelJob, putFirst, inHand, the run ordering for itself (inferStep, homesAhead, cancelOrder; ADR-0015), the crew order (classOf, crewed, emergencyOf), who may live where (admit, limitsOf, childlessOf), who the board is checked for (livingOf), stops under construction (stopsBuilding), notices, stressAt, restoreClock,
 * totalSpend, the rules, and the types of games, clocks, jobs, events, records and money.
 * Owner context: Run (domain). Depends on @city/site alone.
 */
export { noMoney, spendOf, standingOf, totalSpend } from './spend.ts';
export type { Money, TotalSpend } from './spend.ts';
export { RULES, PIECES, GRADES } from './rules.ts';
export type { RunRules, PieceKind } from './rules.ts';
export { dice } from './dice.ts';
export type { Roll } from './dice.ts';
export { pieces, planned, pieceId, splitPiece } from './pieces.ts';
export type { PieceId, Placed } from './pieces.ts';
export { inHand, cancelJob, putFirst } from './jobs.ts';
export { classOf, crewed, emergencyOf } from './crews.ts';
export { admit, limitsOf, childlessOf } from './movein.ts';
export type { Admission, HeldBack, Residence } from './movein.ts';
export { livingOf } from './living.ts';
export type { Living } from './living.ts';
export { stopsBuilding } from './building.ts';
export type { PieceClass } from './crews.ts';
export type { Job, JobStatus, JobItem, SiteInHand, WorkInHand } from './jobs.ts';
export { beginClock, waveIn, isActive, isAnnounced, stressAt, notices, pickEdge } from './timeline.ts';
export type { EventType, TimelineEvent, Clock, RecordRow, Notice } from './timeline.ts';
export { placeOrder, circleId } from './order.ts';
export type { OrderEvent, OrderOutcome } from './order.ts';
export { startRun, stopRun, tick, tickMonth, seenIn, restoreClock } from './run.ts';
export type { Game, RunOptions } from './run.ts';
export { growthOn, monthStep, occupiedOf, homesOf } from './growth.ts';
export { inferStep, homesAhead, cancelOrder, vetoCircle } from './infer.ts';
export type { Inferred, InferredWhy } from './infer.ts';
export type { Growth, MonthRow, MoveIn } from './growth.ts';
