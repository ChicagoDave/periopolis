/**
 * @file The derivation: one column's premises in, its consequences out. Run once for the car city and once for yours.
 * Public interface: deriveCarCity, deriveWalkingCity.
 * Owner context: Ledger (domain).
 *
 * The nine steps are the ledger's own: built form and land; centers; needs placed; trips; vehicles; where vehicles
 * wait; goods; paths and lanes; stretch. Both columns walk the same steps, and differ where their premises do.
 */
import { CLASSES, CLASS_NAMES, CYCLIST_KG, HEX, PARTIES, SHOPPING, TINY, WALK_M_PER_MIN, WORK } from './constants.ts';
import type { VehicleClassName } from './constants.ts';
import type { CarCityLedger, WalkingCityLedger } from './consequences.ts';
import { cellBins, cityBins, cornerKm, farWalkMin, roundKm } from './geometry.ts';
import type { DistanceBin } from './geometry.ts';
import { lotsLand, townhouseLand } from './land.ts';
import type { LandFigures } from './land.ts';
import { placeNeeds } from './needs.ts';
import type { CountedNeed, Need, PlacedCappedNeed, PlacedCountedNeed } from './needs.ts';
import type { CarCityPremises, SharedPremises, WalkingCityPremises } from './premises.ts';
import { splitTrips } from './trips.ts';

/** The ground a column's land gives: the figures that follow from density alone. */
interface Ground {
  readonly density: number;
  readonly parkingShare: number;
  readonly areaKm2: number;
  readonly radiusKm: number;
  readonly rimMin: number;
  readonly reserveKm2: number;
}

function ground(s: SharedPremises, land: LandFigures, detour: number, band: number): Ground {
  const density = 1e6 / land.land;
  const areaKm2 = s.pop / density;
  const radiusKm = Math.sqrt(areaKm2 / Math.PI);
  return {
    density,
    parkingShare: (land.parkingGround + land.streetParking) / land.land,
    areaKm2,
    radiusKm,
    rimMin: (radiusKm * detour * 1000) / WALK_M_PER_MIN,
    reserveKm2: band * areaKm2,
  };
}

/** One kind of trip: its share of all trips, its spread of lengths, its walking limit, and the walks a ride of it needs. */
interface TripKind {
  readonly share: number;
  readonly bins: readonly DistanceBin[];
  readonly walkKm: number;
  /** Walks to or from a stop: one from home, and a second when the far end is not a stop. */
  readonly walks: number;
}

/** The whole city's trips, by the way they are made. */
interface TripFigures {
  readonly walk: number;
  readonly bike: number;
  readonly ride: number;
  readonly noRide: number;
  readonly rideKm: number;
  readonly rideWalks: number;
}

function tripFigures(
  kinds: readonly TripKind[],
  s: SharedPremises,
  detour: number,
  bikeMaxKm: number,
  bikeWilling: number,
  stopR: number,
): TripFigures {
  let walk = 0;
  let bike = 0;
  let ride = 0;
  let noRide = 0;
  let km = 0;
  let ends = 0;
  for (const kind of kinds) {
    if (!(kind.share > 0)) continue;
    const m = splitTrips(kind.bins, {
      walkKm: kind.walkKm,
      bikeKm: bikeMaxKm,
      rideAnyway: s.rideAnyway,
      bikeWilling,
      minRideKm: stopR,
    });
    walk += kind.share * m.walk;
    bike += kind.share * m.bike;
    ride += kind.share * m.ride;
    noRide += kind.share * m.stuck;
    km += kind.share * m.ride * m.rideKm;
    ends += kind.share * m.ride * kind.walks;
  }
  return {
    walk,
    bike,
    ride,
    noRide,
    rideKm: ride > 0 ? (detour * km) / ride : 0,
    rideWalks: ride > 0 ? ends / ride : 0,
  };
}

/** Minutes a kilometer of riding saves over walking it, and the walk past which a given access time is worth paying. */
function evenWalk(rideKmh: number): (accessMin: number) => number {
  const saved = 1000 / WALK_M_PER_MIN - 60 / rideKmh;
  return (accessMin) => (saved > 0 ? ((accessMin / saved) * 1000) / WALK_M_PER_MIN : Infinity);
}

/**
 * The car city: a supermarket's worth of people inside a drive, a vehicle in every household, parking everywhere.
 * @param s - the shared premises
 * @param c - the car city's premises
 * @returns every figure of the car column
 */
export function deriveCarCity(s: SharedPremises, c: CarCityPremises): CarCityLedger {
  const band = 0;

  // 1. Built form, and the density it gives.
  const land = lotsLand(s, c);
  const g = ground(s, land, c.detour, band);

  // 2. Centers. The car city's center is a supermarket's worth of people inside a drive.
  const walkDailyKm = (s.walkDailyMin * WALK_M_PER_MIN) / c.detour / 1000;
  const reachKm = ((c.driveMin / 60) * c.rideKmh) / c.detour;
  const reachCellKm2 = HEX * reachKm * reachKm;
  const centerPop = c.anchorPop;
  const ruleSlack = g.density / (c.anchorPop / reachCellKm2);
  const centers = s.pop / centerPop;
  const rc = roundKm(centerPop, g.density);

  // 4. Trips. Daily needs go to the center; everything else goes anywhere in the city. A car comes to the door.
  const walkMaxKm = (s.walkMaxMin * WALK_M_PER_MIN) / c.detour / 1000;
  const bikeMaxKm = ((s.bikeMaxMin / 60) * s.bikeKmh) / c.detour;
  const kinds: TripKind[] = [
    { share: c.basicShare, bins: cellBins(rc), walkKm: walkDailyKm, walks: 0 },
    { share: 1 - c.basicShare, bins: cityBins(g.radiusKm), walkKm: walkMaxKm, walks: 0 },
  ];
  const t = tripFigures(kinds, s, c.detour, bikeMaxKm, c.bikeWilling, 0);
  const rideMin = (t.rideKm / c.rideKmh) * 60;
  const even = evenWalk(c.rideKmh);
  const accessMin = c.handlingMin;
  const vehicleMin = rideMin + c.handlingMin;
  const ridersPerDay = s.pop * s.trips * t.ride;

  // 5. Vehicles: one per driver, whatever the demand.
  const vehTrips = ridersPerDay / c.occupancy;
  const vehTripsPerPerson = vehTrips / s.pop;
  const movingPeak = vehTrips * s.peakShare * (vehicleMin / 60) * (1 + c.emptyRunning);
  const fleet = s.pop * c.vehPerPerson;

  // 6. Where vehicles wait.
  const spaces = fleet * c.spacesPerVeh;
  const storageM2 = spaces * c.stall;

  // 7. Goods: van and truck, to the curb.
  const goodsRuns = (s.pop * s.parcelsPerYear) / 365 / c.parcelsPerRun + (s.pop * s.goodsKg) / c.payloadKg;

  return {
    kind: 'car',
    band,
    ...land,
    stories: c.stories,
    parks: c.parks,
    ...g,
    walkDailyKm,
    hungriest: c.anchorPop,
    hungriestId: null,
    centerPop,
    reachKm,
    reachCellKm2,
    ruleSlack,
    centers,
    centerCellKm2: centerPop / g.density,
    typicalToCenterKm: rc * Math.SQRT1_2 * c.detour,
    farCenterMin: farWalkMin(centerPop, g.density, c.detour),
    inWalkReach: Math.min(1, (walkDailyKm / rc) * (walkDailyKm / rc)),
    peoplePerStop: 0,
    stopWalkKm: 0,
    farStopMin: 0,
    tripsPerDay: s.trips,
    dailyShare: c.basicShare,
    elsewhereShare: 1 - c.basicShare,
    ...t,
    accessMin,
    vehicleMin,
    evenLowMin: even(c.handlingMin),
    evenHighMin: even(c.handlingMin),
    doorMin: rideMin + accessMin,
    ridersPerDay,
    vehTrips,
    seatUse: c.occupancy / c.seats,
    vehTripsPerPerson,
    movingPeak,
    fleet,
    fleetPer1000: (1000 * fleet) / s.pop,
    peakUse: fleet > 0 ? movingPeak / fleet : 0,
    spaces,
    storageM2,
    placesPer1000: 1000 * c.vehPerPerson * c.spacesPerVeh,
    storagePerVeh: fleet > 0 ? storageM2 / fleet : 0,
    goodsRuns,
    goodsShare: goodsRuns / (goodsRuns + vehTrips),
  };
}

/**
 * Your city: a center as small as its hungriest daily need allows, everything within a walk, one fleet of movers.
 * @param s - the shared premises
 * @param c - your city's premises
 * @param needs - the needs list
 * @returns every figure of your column
 */
export function deriveWalkingCity(
  s: SharedPremises,
  c: WalkingCityPremises,
  needs: readonly Need[],
): WalkingCityLedger {
  const band = c.band > 0 ? Math.min(c.band, 0.95) : 0;

  // 1. Built form, and the density it gives.
  const land = townhouseLand(s, c, band);
  const g = ground(s, land, c.detour, band);

  // 2. Centers. The center is as small as its hungriest daily need allows, and the walk is whatever that makes it.
  const walkDailyKm = (s.walkDailyMin * WALK_M_PER_MIN) / c.detour / 1000;
  const daily = needs.filter(
    (n): n is CountedNeed => n.tier === 'center' && n.kind === 'people' && n.people > 0,
  );
  const top = daily.reduce<CountedNeed | null>((a, n) => (a && a.people >= n.people ? a : n), null);
  const hungriest = top ? top.people : 0;
  // With nothing hungry on the daily list there is nothing to size a center by, so it falls back to a walk.
  const wants = top ? top.people / (1 - band) : g.density * HEX * walkDailyKm * walkDailyKm;
  const centerPop = Math.min(wants, s.pop);
  const reachKm = cornerKm(centerPop, g.density);
  const centers = s.pop / centerPop;
  const rc = roundKm(centerPop, g.density);

  // 3. Needs placed.
  const placed = placeNeeds(needs, s, c, { centerPop, centers, density: g.density }, band);

  // 4. Trips, by where they go. Each kind has its own spread of distances and its own walking limit.
  const walkMaxKm = (s.walkMaxMin * WALK_M_PER_MIN) / c.detour / 1000;
  const bikeMaxKm = ((s.bikeMaxMin / 60) * s.bikeKmh) / c.detour;
  const longKm = c.longWalkMin > 0 ? (c.longWalkMin * WALK_M_PER_MIN) / c.detour / 1000 : walkMaxKm;
  // A mover comes to a stop, and each stop serves its share of a center's ground.
  const peoplePerStop = centerPop / Math.max(TINY, c.stopsPerCenter);
  const stopKm = cornerKm(peoplePerStop, g.density);
  const stopR = roundKm(peoplePerStop, g.density);
  const stopWalkKm = stopR * Math.SQRT1_2 * c.detour;
  const gone = SHOPPING * c.dumbShare;
  const tripsPerDay = s.trips * (1 - gone);
  const office = WORK * c.officeJobShare * (1 - c.coworkShare);
  const listed = placed.share.center + placed.share.district + placed.share.city + office;
  // A list that claims more trips than are made is scaled to fit.
  const fit = listed > 1 - gone ? (1 - gone) / listed : 1;
  // A share of today's trips, as a share of the trips still made.
  const of = (x: number): number => (x * fit) / (1 - gone);
  const dailyShare = of(placed.share.center);
  const districtShare = of(placed.share.district);
  const middleShare = of(placed.share.city + office);
  const elsewhereShare = Math.max(0, 1 - dailyShare - districtShare - middleShare);
  // One kind of trip for each need, out to the edge of the ground that shares it.
  const kinds: TripKind[] = [];
  needs.forEach((n, i) => {
    const r = placed.rows[i];
    if (n.tier === 'out' || !(n.share > 0) || r === undefined || r.tier === 'out') return;
    kinds.push({
      share: of(n.share / 100),
      bins: cellBins(roundKm(r.catch, g.density)),
      walkKm: n.kind === 'cap' ? longKm : walkMaxKm,
      walks: 1,
    });
  });
  kinds.push({ share: of(office), bins: cellBins(g.radiusKm), walkKm: longKm, walks: 1 });
  const otherWork = Math.min(elsewhereShare, of(WORK - office));
  kinds.push({ share: otherWork, bins: cityBins(g.radiusKm), walkKm: longKm, walks: 2 });
  kinds.push({ share: elsewhereShare - otherWork, bins: cityBins(g.radiusKm), walkKm: walkMaxKm, walks: 2 });
  const t = tripFigures(kinds, s, c.detour, bikeMaxKm, c.bikeWilling, stopR);
  // The rider walks to a stop and waits, and walks again at the far end unless the ride ends at a stop;
  // the mover itself is only tied up for the ride and the boarding.
  const rideMin = (t.rideKm / c.rideKmh) * 60;
  const even = evenWalk(c.rideKmh);
  const toStop = (stopWalkKm * 1000) / WALK_M_PER_MIN;
  const accessMin = t.rideWalks * toStop + c.waitMin;
  const vehicleMin = rideMin + 2 * c.dwellMin;
  const ridersPerDay = s.pop * tripsPerDay * t.ride;

  // 5. Vehicles: sized for the busiest hour.
  const partyMean = PARTIES.reduce((sum, p) => sum + p.size * p.share, 0);
  const privateRides = (ridersPerDay * (1 - c.pooledShare)) / partyMean;
  const pooledRuns = (ridersPerDay * c.pooledShare) / c.pooledLoad;
  const rides: Record<VehicleClassName, number> = { pod: 0, cab: 0, shuttle: pooledRuns };
  for (const p of PARTIES) rides[p.cls] += privateRides * p.share;
  const vehTrips = privateRides + pooledRuns;
  let seats = 0;
  const mix: Record<VehicleClassName, number> = { pod: 0, cab: 0, shuttle: 0 };
  for (const k of CLASS_NAMES) {
    seats += rides[k] * CLASSES[k].seats;
    mix[k] = vehTrips > 0 ? rides[k] / vehTrips : 0;
  }
  const vehTripsPerPerson = vehTrips / s.pop;
  const movingPeak = vehTrips * s.peakShare * (vehicleMin / 60) * (1 + c.emptyRunning);
  const fleet = movingPeak * (1 + c.reserve);

  // 6. Where vehicles wait, and where people meet them.
  let storageM2 = 0;
  for (const k of CLASS_NAMES) storageM2 += fleet * mix[k] * CLASSES[k].body * c.packFactor;
  // Stops: each center's share of them, and one more under the ring.
  const stops = s.pop / peoplePerStop;
  const stations = stops + 1;
  const stopsPerHour = 2 * vehTripsPerPerson * peoplePerStop * s.peakShare;
  const berths = Math.max(1, Math.ceil((stopsPerHour * (c.dwellMin / 60)) / c.berthUse));
  // The sub level: a mover line linking the stops, and a walkway from each group's entry to its stop.
  // An entry that sits on a stop needs no walkway, so stops at every entry leave none.
  const entryKm = (c.entryWalkMin * WALK_M_PER_MIN) / c.detour / 1000;
  const peoplePerEntry = g.density * HEX * entryKm * entryKm;
  const entries = s.pop / peoplePerEntry;
  const walkwayKm = Math.max(0, entries - stops) * entryKm * Math.sqrt(3);
  const moverKm = stops * stopKm * Math.sqrt(3) * c.loopFactor;

  // 7. Goods: pipe and dumbwaiter; a porter for big things.
  const homes = s.pop / s.hh;
  const goodsRuns = (s.pop * s.goodsKg * (1 - c.pipedShare)) / c.payloadKg;
  const porterHours =
    ((homes / 1000) * c.bulkyPer1000 * c.bulkyMin) / 60 + ((homes * c.moveRate) / 365) * 2 * c.moveHours;

  // 8. Bike lanes on the edges between neighborhoods, and the speed at which a bike is no more than a jogger.
  const laneKm = centers * 3 * reachKm;
  const bikeLineKmh = Math.sqrt((2 * c.harmLine) / CYCLIST_KG) * 3.6;

  // 9. Stretch: how far the city can move with nothing rebuilt, and how far its land can grow.
  // The school nearest its cap, and the need nearest running short (ties go to the need that wants more people).
  let foundGrow: PlacedCappedNeed | null = null;
  let foundShrink: PlacedCountedNeed | null = null;
  let shrinkSlack = Infinity;
  let shrinkWants = 0;
  const shortIds: string[] = [];
  for (let i = 0; i < placed.rows.length; i++) {
    const r = placed.rows[i];
    if (r === undefined || r.tier === 'out' || r.slack === null) continue;
    const n = needs[i];
    if (r.grows) {
      if (!foundGrow || r.slack < foundGrow.slack - TINY) foundGrow = r;
    } else if (r.slack < -TINY) {
      shortIds.push(r.id);
    } else {
      const people = n !== undefined && n.kind === 'people' ? n.people : 0;
      if (!foundShrink || r.slack < shrinkSlack - TINY || (r.slack < shrinkSlack + TINY && people > shrinkWants)) {
        foundShrink = r;
        shrinkSlack = r.slack;
        shrinkWants = people;
      }
    }
  }

  return {
    kind: 'walking',
    band,
    ...land,
    stories: c.stories,
    parks: c.parks,
    ...g,
    walkDailyKm,
    hungriest,
    hungriestId: top ? top.id : null,
    centerPop,
    reachKm,
    reachCellKm2: centerPop / g.density,
    ruleSlack: hungriest > 0 ? centerPop / hungriest : Infinity,
    centers,
    centerCellKm2: centerPop / g.density,
    typicalToCenterKm: rc * Math.SQRT1_2 * c.detour,
    farCenterMin: farWalkMin(centerPop, g.density, c.detour),
    inWalkReach: Math.min(1, (walkDailyKm / rc) * (walkDailyKm / rc)),
    needs: placed.rows,
    districts: placed.districts,
    peoplePerStop,
    stopWalkKm,
    farStopMin: (stopKm * c.detour * 1000) / WALK_M_PER_MIN,
    tripsPerDay,
    dailyShare,
    districtShare,
    middleShare,
    elsewhereShare,
    ...t,
    accessMin,
    vehicleMin,
    evenLowMin: even(toStop + c.waitMin),
    evenHighMin: even(2 * toStop + c.waitMin),
    doorMin: rideMin + accessMin,
    ridersPerDay,
    mix,
    vehTrips,
    seatUse: seats > 0 ? ridersPerDay / seats : 0,
    vehTripsPerPerson,
    movingPeak,
    fleet,
    fleetPer1000: (1000 * fleet) / s.pop,
    peakUse: fleet > 0 ? movingPeak / fleet : 0,
    spaces: fleet,
    storageM2,
    stations,
    berths,
    placesPer1000: (1000 * (berths * stations + fleet)) / s.pop,
    peoplePerEntry,
    homesPerEntry: peoplePerEntry / s.hh,
    entries,
    entriesPerCenter: centerPop / peoplePerEntry,
    walkwayKm,
    moverKm,
    subLevelKm: walkwayKm + moverKm,
    storagePerVeh: fleet > 0 ? storageM2 / fleet : 0,
    dumbwaiters: homes,
    pipeKm: (homes * c.frontage) / c.rowsPerPipe / 1000,
    totes: (s.pop * s.parcelsPerYear) / 365 + (homes * c.groceryPerWeek) / 7 + homes * c.trashTotes,
    goodsRuns,
    porters: porterHours / 8,
    laneKm,
    laneShare: (laneKm * c.laneWidth) / 1000 / g.areaKm2,
    bikeLineKmh,
    farLaneMin: ((0.866 * reachKm * c.detour) / bikeLineKmh) * 60,
    goodsShare: goodsRuns / (goodsRuns + vehTrips),
    insideLong: Math.min(1, (longKm / g.radiusKm) * (longKm / g.radiusKm)),
    ceilingPop: Math.PI * longKm * longKm * g.density,
    growPupils: foundGrow ? foundGrow.slack : null,
    growPupilsId: foundGrow ? foundGrow.id : null,
    shrinkPeople: foundShrink ? foundShrink.slack : null,
    shrinkPeopleId: foundShrink ? foundShrink.id : null,
    shortIds,
  };
}
