/**
 * @file Splitting a spread of trip lengths into walks, bike rides and rides.
 * Public interface: TripSplit, SplitLimits, splitTrips.
 * Owner context: Ledger (domain).
 */
import type { DistanceBin } from './geometry.ts';

/** How one kind of trip divides among the ways of making it. Shares sum to 1; rideKm is the mean ride. */
export interface TripSplit {
  readonly walk: number;
  readonly bike: number;
  readonly ride: number;
  /** Trips that wanted a ride and had none to take, so were walked. Already counted in walk. */
  readonly stuck: number;
  /** Mean straight-line length of the rides, in km. 0 when nothing is ridden. */
  readonly rideKm: number;
}

/** The limits a split is made under. */
export interface SplitLimits {
  /** Trips no longer than this are walked. */
  readonly walkKm: number;
  /** Trips no longer than this may be biked. */
  readonly bikeKm: number;
  /** Share of trips that take a ride at any distance. */
  readonly rideAnyway: number;
  /** Share of bikeable trips that are biked. */
  readonly bikeWilling: number;
  /** A ride shorter than this starts and ends at the same stop, so there is nothing to ride. */
  readonly minRideKm: number;
}

/**
 * Walk if it is close enough, bike some of what is bikeable, ride the rest.
 * A trip shorter than minRideKm has no ride to take: whoever wanted one goes on foot, and is counted in stuck.
 * @param bins - the spread of trip lengths
 * @param limits - the walking and biking limits and the shares that bend them
 * @returns the shares and the mean ride
 */
export function splitTrips(bins: readonly DistanceBin[], limits: SplitLimits): TripSplit {
  let walk = 0;
  let bike = 0;
  let ride = 0;
  let rideKm = 0;
  let stuck = 0;
  for (const { km: d, share: pr } of bins) {
    let w = 0;
    let b = 0;
    if (d <= limits.walkKm) w = 1 - limits.rideAnyway;
    else if (d <= limits.bikeKm) b = (1 - limits.rideAnyway) * limits.bikeWilling;
    let r = 1 - w - b;
    if (d < limits.minRideKm) {
      stuck += pr * r;
      w += r;
      r = 0;
    }
    walk += pr * w;
    bike += pr * b;
    ride += pr * r;
    rideKm += pr * r * d;
  }
  return { walk, bike, ride, stuck, rideKm: ride > 0 ? rideKm / ride : 0 };
}
