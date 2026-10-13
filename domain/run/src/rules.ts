/**
 * @file The rules of the clock: the horizon, the crews, how long each piece takes, and the shape of the wave of children.
 * Public interface: PieceKind, PIECES, RunRules, RULES, GRADES.
 * Owner context: Run (domain).
 */
import { EXTRAS, PLANTS } from '@city/site';
import type { ExtraKind, PlantKind, SchoolKind } from '@city/site';

/** Anything a crew builds: a neighborhood, a ring building, what stands in a neighborhood, a stretch of line, a module or unit. */
export type PieceKind = 'hood' | 'ring' | ExtraKind | 'line' | PlantKind;

/** Every kind of piece. */
export const PIECES: readonly PieceKind[] = ['hood', 'ring', ...EXTRAS, 'line', ...PLANTS];

/** The clock's constants. */
export interface RunRules {
  /** Line 21's horizon, years. */
  readonly years: number;
  /** Crews at work at once. Assumed: enough to build the ledger's city of 50,000 in eight years. */
  readonly crews: number;
  /** Years of one crew's work for each piece. A crew is whatever it takes to finish a neighborhood in two years. */
  readonly build: Readonly<Record<PieceKind, number>>;
  /** A reactor site with its first module. NuScale targets 30 to 39 months from first concrete to fuel load. */
  readonly firstModule: number;
  /** Years until the last child of a K to 5 wave has left high school. */
  readonly wave: number;
}

/** The rules as published. */
export const RULES: RunRules = {
  years: 20,
  crews: 10,
  build: { hood: 2, ring: 2, elementary: 1, middle: 1, high: 2, fields: 1, line: 1, power: 1, water: 2, sewage: 2, waste: 2 },
  firstModule: 3,
  wave: 13,
};

/** The grades each school covers, first and last. */
export const GRADES: Readonly<Record<SchoolKind, readonly [number, number]>> = {
  elementary: [0, 5],
  middle: [6, 8],
  high: [9, 12],
};
