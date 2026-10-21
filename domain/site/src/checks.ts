/**
 * @file What an assessment reports: the sixteen line checks as typed facts, the issues marked on each tile, the score,
 * and the stress a layout is checked under. No sentences; the Board words these.
 * Public interface: CheckStatus, CheckId, CircleShort, Facts, LineCheck, TileIssue, TileLevel, Reach, TileReport, Stress,
 * NO_STRESS, CarComparison, Score, Core.
 * Owner context: Site (domain).
 */
import type { CostFigures } from '@city/ledger';
import type { EdgeKey, TileKey } from './board.ts';
import type { PlantKind, SchoolKind } from './rates.ts';
import type { Seat } from './seating.ts';

/** How a line stands against the layout: nothing to check yet, holds, watch, or broken. */
export type CheckStatus = 'idle' | 'ok' | 'warn' | 'bad';

/** The sixteen checks: the sketch's fifteen and `flow`, line 32 (ADR-0016 Decision 5). */
export type CheckId =
  | 'daily'
  | 'size'
  | 'ring'
  | 'work'
  | 'stops'
  | SchoolKind
  | 'fields'
  | 'ways'
  | PlantKind
  | 'haul'
  | 'flow';

/**
 * One circle short of a thing its own people need (ADR-0016 Decisions 1 and 3: a circle's homes are served by its own
 * ring and its own band): the circle's middle, or null on a layout with no circles, which is judged as one; what it
 * has, and what its people take.
 */
export interface CircleShort {
  readonly circle: TileKey | null;
  readonly has: number;
  readonly needed: number;
}

/** The facts behind a check's status. Each check has one shape per case. */
export type Facts =
  | { readonly check: 'daily'; readonly case: 'idle'; readonly hood: number }
  /** pop1 is the fewest people in any neighborhood; uneven when the neighborhoods do not all hold the same (ADR-0009). */
  | { readonly check: 'daily'; readonly case: 'short'; readonly pop1: number; readonly uneven: boolean; readonly short: readonly string[] }
  | { readonly check: 'daily'; readonly case: 'fed'; readonly pop1: number; readonly uneven: boolean; readonly hungriest: number }
  /** Short only in neighborhoods still filling: a watch, not a break (ADR-0009). pop1 is the emptiest of them. */
  | { readonly check: 'daily'; readonly case: 'filling'; readonly pop1: number; readonly count: number; readonly short: readonly string[] }
  | { readonly check: 'size'; readonly case: 'idle'; readonly urgent: number; readonly fine: number }
  | { readonly check: 'size'; readonly case: 'underUrgent'; readonly urgent: number; readonly fine: number; readonly pop: number }
  | { readonly check: 'size'; readonly case: 'underFine'; readonly fine: number; readonly pop: number }
  | { readonly check: 'size'; readonly case: 'enough'; readonly urgent: number; readonly fine: number; readonly pop: number }
  | { readonly check: 'ring'; readonly case: 'idle' }
  /** Neighborhoods with no ring in their circle: the rings standing elsewhere, and each circle without one and the buildings its people take. */
  | { readonly check: 'ring'; readonly case: 'none'; readonly rings: number; readonly short: readonly CircleShort[] }
  | {
      readonly check: 'ring';
      readonly case: 'full';
      readonly rings: number;
      readonly over: number;
      readonly serves: number;
      readonly pop: number;
      readonly needed: number;
    }
  | { readonly check: 'ring'; readonly case: 'room'; readonly buildings: number; readonly serves: number; readonly pop: number }
  | { readonly check: 'work'; readonly case: 'idle' }
  | { readonly check: 'work'; readonly case: 'cut'; readonly count: number }
  | { readonly check: 'work'; readonly case: 'far'; readonly count: number }
  | { readonly check: 'work'; readonly case: 'within'; readonly farthestMin: number }
  | { readonly check: 'stops'; readonly case: 'idle' }
  | { readonly check: 'stops'; readonly case: 'without'; readonly count: number }
  | { readonly check: 'stops'; readonly case: 'all' }
  /** Lacking a stop only in neighborhoods nobody lives in: a watch, not a break (ADR-0012 Decision 8). */
  | { readonly check: 'stops'; readonly case: 'waiting'; readonly count: number }
  | { readonly check: SchoolKind; readonly case: 'idle'; readonly cap: number }
  | { readonly check: SchoolKind; readonly case: 'none'; readonly pupils: number }
  /** No school of the kind and no pupil yet: the neighborhoods are empty or held to households with no school-age
   * children (ADR-0012 Decision 9). A watch. */
  | { readonly check: SchoolKind; readonly case: 'waiting'; readonly hoods: number }
  | { readonly check: SchoolKind; readonly case: 'unseated'; readonly missing: number; readonly hoods: number; readonly cap: number }
  | {
      readonly check: SchoolKind;
      readonly case: 'seated';
      readonly schools: number;
      readonly pupils: number;
      readonly fullest: number;
      readonly cap: number;
      readonly longestMin: number;
    }
  | { readonly check: 'fields'; readonly case: 'idle' }
  | { readonly check: 'fields'; readonly case: 'none' }
  | { readonly check: 'fields'; readonly case: 'far'; readonly count: number; readonly fieldWalk: number }
  | { readonly check: 'fields'; readonly case: 'near'; readonly sets: number; readonly fieldWalk: number }
  /** Only neighborhoods nobody lives in yet are far from fields (or there are none and nobody to miss them): a watch (ADR-0012 Decision 8, amended 2026-10-18). */
  | { readonly check: 'fields'; readonly case: 'waiting'; readonly count: number; readonly sets: number; readonly fieldWalk: number }
  | { readonly check: 'ways'; readonly case: 'idle' }
  | { readonly check: 'ways'; readonly case: 'stuck'; readonly share: number }
  /** Only trips toward neighborhoods nobody lives in yet are stuck: a watch (ADR-0012 Decision 8, amended 2026-10-18). */
  | { readonly check: 'ways'; readonly case: 'waiting'; readonly share: number; readonly count: number }
  | {
      readonly check: 'ways';
      readonly case: 'flowing';
      readonly foot: number;
      readonly bike: number;
      readonly ride: number;
      readonly nowhere: number;
    }
  | { readonly check: 'power'; readonly case: 'idle'; readonly moduleMw: number }
  /** Modules, peak and the modules taken are the city's; `short` names each circle whose own modules fall short. */
  | { readonly check: 'power'; readonly case: 'short'; readonly modules: number; readonly peakMw: number; readonly needed: number; readonly short: readonly CircleShort[] }
  /** The modules carry the peak only while every one runs: people may live here, lines 20 and 21 are broken (ADR-0012 Decision 3, amended 2026-10-18). */
  | { readonly check: 'power'; readonly case: 'noSpare'; readonly modules: number; readonly peakMw: number; readonly needed: number; readonly short: readonly CircleShort[] }
  | { readonly check: 'power'; readonly case: 'carries'; readonly modules: number; readonly firmMw: number; readonly peakMw: number }
  | { readonly check: 'water' | 'sewage' | 'waste'; readonly case: 'idle'; readonly serves: number }
  | {
      readonly check: 'water' | 'sewage' | 'waste';
      readonly case: 'short';
      /** The city's units, what they serve, its people and the units they take; `short` names each circle whose own plants fall short. */
      readonly units: number;
      readonly cap: number;
      readonly pop: number;
      readonly needed: number;
      readonly short: readonly CircleShort[];
    }
  | { readonly check: 'water' | 'waste'; readonly case: 'serves'; readonly units: number; readonly cap: number }
  | {
      readonly check: 'sewage';
      readonly case: 'serves';
      readonly units: number;
      readonly cap: number;
      /** Million gallons a day cleaned, and the cooling the reactors take; null with no modules. */
      readonly cleansMgd: number | null;
      readonly coolingMgd: number | null;
    }
  | { readonly check: 'haul'; readonly case: 'idle' }
  | { readonly check: 'haul'; readonly case: 'loose'; readonly count: number }
  | { readonly check: 'haul'; readonly case: 'reached' }
  /** A circle lacks a water or a sewage plant, so there is no intake and outfall to order. */
  | { readonly check: 'flow'; readonly case: 'idle' }
  /** In every circle the intake is upstream of the outfall; the plants that set them, circle by circle. */
  | { readonly check: 'flow'; readonly case: 'ordered'; readonly circles: number }
  /** An outfall upstream of an intake: the water and sewage plants at fault. */
  | { readonly check: 'flow'; readonly case: 'reversed'; readonly circles: number; readonly water: readonly TileKey[]; readonly sewage: readonly TileKey[] };

/** One line check against the layout. */
export interface LineCheck {
  readonly id: CheckId;
  /** The lines it answers to. */
  readonly lines: readonly number[];
  readonly status: CheckStatus;
  /** The tiles it marks. */
  readonly tiles: readonly TileKey[];
  readonly facts: Facts;
}

/** Something wrong at one tile. */
export type TileIssue =
  | { readonly kind: 'dailyShort'; readonly needs: readonly string[] }
  | { readonly kind: 'ringFull'; readonly needs: number; readonly has: number; readonly load: number }
  | { readonly kind: 'farFromRingNoLine'; readonly walkMin: number }
  | { readonly kind: 'farFromRing'; readonly walkMin: number }
  | { readonly kind: 'lineMissesRing' }
  | { readonly kind: 'flowReversed' }
  | { readonly kind: 'noStop' }
  | { readonly kind: 'pupilsUnseated'; readonly school: SchoolKind; readonly pupils: number }
  | { readonly kind: 'fieldsFar'; readonly walkMin: number }
  | { readonly kind: 'tripsStuck'; readonly share: number }
  | { readonly kind: 'tripsToHereStuck' }
  | { readonly kind: 'plantOffLine' };

/** The worst of a tile's issues. */
export type TileLevel = 'bad' | 'warn' | null;

/** How a neighborhood reaches something: the tile, the walk, and the stretches of line between, or null for none. */
export interface Reach {
  readonly key: TileKey;
  readonly walkMin: number;
  readonly segments: number | null;
}

/** Everything the assessment knows about one tile. Fields a tile's kind does not use are absent. */
export interface TileReport {
  readonly issues: readonly TileIssue[];
  readonly level: TileLevel;
  /** Whether a mover stop sits under it this year. */
  readonly stop: boolean;
  /** A neighborhood's nearest ring. */
  readonly ring?: Reach | null;
  /** A ring tile: people it serves, people it could serve, buildings it would take. */
  readonly load?: number;
  readonly cap?: number;
  readonly needs?: number;
  /** A neighborhood with schools: each school's load against its cap. */
  readonly schools?: Readonly<Partial<Record<SchoolKind, { readonly load: number; readonly cap: number }>>>;
  /** A neighborhood's pupils: where each kind goes, how many have no seat, and how many there are. */
  readonly goes?: Readonly<Record<SchoolKind, { readonly to: readonly Seat[]; readonly left: number; readonly each: number }>>;
  /** A neighborhood's nearest fields. */
  readonly fields?: Reach | null;
  /** Share of a neighborhood's trips past the walk with no mover to take. */
  readonly stuck?: number;
}

/** What is happening to the city in the year it is checked. */
export interface Stress {
  /** More (or fewer) people in the same homes, as a share. */
  readonly people: number;
  /** More children in every grade, as a share. */
  readonly children: number;
  /** More children in some grades only; overrides `children` when present. */
  readonly kids?: Readonly<Record<SchoolKind, number>>;
  /** Stretches of mover line closed for repairs this year. */
  readonly closed?: readonly EdgeKey[];
}

/** An ordinary year. */
export const NO_STRESS: Stress = { people: 0, children: 0 };

/** A car city of the same population, from the ledger. */
export interface CarComparison {
  readonly acres: number;
  readonly vehicles: number;
  readonly ride: number;
  readonly foot: number;
  readonly bike: number;
  readonly door: number;
  readonly places: number;
  /** What the car city costs to build and run, by layer (ADR-0007), for the Board to set beside this city's. */
  readonly cost: CostFigures;
}

/** What has been built, how trips are made, and how the city compares with a car city of the same size. */
export interface Score {
  readonly pop: number;
  readonly hoods: number;
  readonly built: number;
  readonly acres: number;
  readonly foot: number;
  readonly bike: number;
  readonly ride: number;
  readonly noRide: number;
  readonly stuck: number;
  readonly nowhere: number;
  readonly fleet: number;
  readonly door: number;
  /** Mover trips a day. */
  readonly vehicleTrips: number;
  /** The average ride along the line, km. */
  readonly rideKm: number;
  readonly moverKm: number;
  readonly walkwayKm: number;
  readonly pipeKm: number;
  readonly subLevelKm: number;
  readonly stops: number;
  readonly entries: number;
  readonly modules: number;
  readonly peak: number;
  readonly ringBuildings: number;
  readonly schools: Readonly<Record<SchoolKind, number>>;
  readonly fields: number;
  readonly units: Readonly<Record<PlantKind, number>>;
  readonly needModules: number;
  readonly firmMW: number;
  readonly car: CarComparison | null;
}

/** A layout assessed under one stress. */
export interface Core {
  readonly per: Readonly<Record<TileKey, TileReport>>;
  readonly checks: readonly LineCheck[];
  readonly score: Score;
  readonly stress: Stress;
  /** People in one full neighborhood this year: its capacity under the stress. */
  readonly pop1: number;
  /** People living in each neighborhood this year, under the stress (ADR-0009); full ones hold pop1. */
  readonly people: Readonly<Record<TileKey, number>>;
}
