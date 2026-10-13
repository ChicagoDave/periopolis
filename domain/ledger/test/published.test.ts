/**
 * @file The published ledger (Revision 3) for a city of 50,000, figure by figure, as its text export shows them.
 * Owner context: Ledger (domain), tests.
 */
import { describe, expect, it } from 'vitest';
import { CAR_CITY, NEEDS, SHARED, WALKING_CITY, deriveCarCity, deriveWalkingCity } from '../src/index.ts';
import type { PlacedNeed } from '../src/index.ts';

const car = deriveCarCity(SHARED, CAR_CITY);
const yours = deriveWalkingCity(SHARED, WALKING_CITY, NEEDS);

/** The export shows a figure rounded to so many decimals; the derived figure must round to the same. */
function shows(actual: number, published: number, decimals = 0): void {
  const scale = 10 ** decimals;
  expect(Math.round(actual * scale) / scale, `derived ${actual}`).toBe(published);
}

/** A percentage shown to so many decimals. */
function showsPct(actual: number, published: number, decimals = 1): void {
  shows(actual * 100, published, decimals);
}

function placed(id: string): Exclude<PlacedNeed, { tier: 'out' }> {
  const row = yours.needs.find((r) => r.id === id);
  if (!row || row.tier === 'out') throw new Error(`${id} is not placed`);
  return row;
}

describe('2. Buildings and land', () => {
  it('ground per home: the lot, or the townhouse and its share of the courtyard', () => {
    shows(CAR_CITY.lotPerHome, 590);
    shows((SHARED.hh * SHARED.homeFloor) / (WALKING_CITY.stories * WALKING_CITY.siteCoverage), 94);
  });
  it('the middle has 321,700 m² of floor to hold in 8 ring buildings of 7,771 people, 272 m across', () => {
    shows(yours.middleFloorM2, 321700, -2);
    shows(yours.ringBuildings, 8);
    shows(yours.ringServes, 7771);
    shows(yours.ringAcrossM, 272);
  });
  it('land per person: footprints, yards, parking, parks, streets and the ring', () => {
    shows(car.footprint, 64.1, 1);
    shows(yours.footprint, 29.9, 1);
    shows(car.yards, 185.6, 1);
    shows(yours.yards, 19.9, 1);
    shows(car.parkingGround, 67.6, 1);
    expect(yours.parkingGround).toBe(0);
    shows(car.streets, 113.8, 1);
    shows(yours.streets, 15, 1);
    shows(yours.ringGround, 0.6, 1);
    shows(car.land, 474);
    shows(yours.land, 75.5, 1);
  });
  it('density 2,110 against 13,249 people per km²', () => {
    shows(car.density, 2110);
    shows(yours.density, 13249);
  });
  it('land area and radius', () => {
    shows(car.areaKm2, 23.7, 1);
    shows(yours.areaKm2, 3.77, 2);
    shows(car.radiusKm, 2.75, 2);
    shows(yours.radiusKm, 1.1, 1);
  });
  it('75 ha in reserve, every home inside the walk to work, a ceiling of 166,492 people', () => {
    shows(yours.reserveKm2 * 100, 75);
    showsPct(yours.insideLong, 100, 0);
    shows(yours.ceilingPop, 166492);
  });
});

describe('3. What goes where', () => {
  it('10 centers of 5,000 people against 6.7 of 7,500', () => {
    shows(car.hungriest, 7500);
    shows(yours.hungriest, 4000);
    shows(car.centerPop, 7500);
    shows(yours.centerPop, 5000);
    shows(car.centers, 6.7, 1);
    shows(yours.centers, 10);
  });
  it('the ground a center serves and the walk to it', () => {
    shows(car.reachCellKm2, 52.3, 1);
    shows(car.centerCellKm2, 3.56, 2);
    shows(yours.centerCellKm2 * 100, 37.7, 1);
    shows(car.farCenterMin, 19);
    shows(yours.farCenterMin, 5.7, 1);
    shows(car.typicalToCenterKm, 0.98, 2);
    shows(yours.typicalToCenterKm, 0.29, 2);
    shows(car.ruleSlack, 14.7, 1);
  });
  it('every center: bakery, butcher, dining and doctor, with their counts and slack', () => {
    const bakery = placed('bakery');
    shows(bakery.count, 10);
    showsPct(bakery.slack ?? NaN, 58, 0);
    const butcher = placed('butcher');
    shows(butcher.count, 10);
    showsPct(butcher.slack ?? NaN, 26, 0);
    const dining = placed('dining');
    shows(dining.count, 80);
    shows(dining.each, 8);
    showsPct(dining.slack ?? NaN, 20, 0);
    const doctor = placed('doctor');
    shows(doctor.count, 10);
    showsPct(doctor.slack ?? NaN, 20, 0);
    expect(placed('produce').fill).toBeNull();
  });
  it('shared: 9 elementary schools of 400, 3 middle of 600, 2 high of 1,200; 2 fields; 1 urgent care', () => {
    const elementary = placed('elementary');
    const middle = placed('middle');
    const high = placed('high');
    if (!elementary.grows || !middle.grows || !high.grows) throw new Error('schools grow');
    shows(elementary.count, 9);
    shows(elementary.size, 400);
    showsPct(elementary.slack, 25, 0);
    shows(middle.count, 3);
    shows(middle.size, 600);
    showsPct(middle.slack, 67, 0);
    shows(high.count, 2);
    shows(high.size, 1200);
    showsPct(high.slack, 25, 0);
    shows(placed('fields').count, 2);
    shows(placed('urgent').count, 1);
    showsPct(placed('urgent').slack ?? NaN, 53, 0);
    shows(yours.districts, 2);
  });
  it('the middle: fine dining has 70% of what it needs', () => {
    const fine = placed('finedining');
    shows(fine.count, 1);
    showsPct(fine.fill ?? NaN, 70, 0);
    expect(yours.shortIds).toEqual(['finedining']);
  });
  it('trips by where they go', () => {
    shows(car.tripsPerDay, 3.37, 2);
    shows(yours.tripsPerDay, 2.95, 2);
    showsPct(car.dailyShare, 35);
    showsPct(yours.dailyShare, 26.2);
    showsPct(yours.districtShare, 11.4);
    showsPct(yours.middleShare, 8.2);
    showsPct(car.elsewhereShare, 65);
    showsPct(yours.elsewhereShare, 54.1);
  });
});

describe('4. Trips', () => {
  it('on foot, by bike, by vehicle: 8.3 / 3 / 88.7 against 76.4 / 8.7 / 14.9', () => {
    showsPct(car.walk, 8.3);
    showsPct(car.bike, 3);
    showsPct(car.ride, 88.7);
    showsPct(yours.walk, 76.4);
    showsPct(yours.bike, 8.7);
    showsPct(yours.ride, 14.9);
    expect(car.walk + car.bike + car.ride).toBeCloseTo(1, 9);
    expect(yours.walk + yours.bike + yours.ride).toBeCloseTo(1, 9);
  });
  it('the farthest walk to a stop, trips with no ride, and the average ride', () => {
    shows(yours.farStopMin, 5.7, 1);
    showsPct(yours.noRide, 3.8);
    shows(car.rideKm, 2.6, 1);
    shows(yours.rideKm, 1.5, 1);
  });
});

describe('5. Movers and the sub level', () => {
  it('the mix, the party, access and the door-to-door ride', () => {
    showsPct(yours.mix.pod, 87, 0);
    showsPct(yours.mix.cab, 7, 0);
    showsPct(yours.mix.shuttle, 6, 0);
    shows(yours.ridersPerDay / yours.vehTrips, 1.76, 2);
    shows(car.accessMin, 3);
    shows(yours.accessMin, 9);
    shows(car.evenLowMin, 3.5, 1);
    shows(yours.evenLowMin, 7);
    shows(yours.evenHighMin, 11.6, 1);
    shows(car.doorMin, 7.5, 1);
    shows(yours.doorMin, 12.5, 1);
  });
  it('42,000 cars against 159 movers', () => {
    shows(car.vehTrips, 107558);
    shows(yours.vehTrips, 12515);
    showsPct(car.seatUse, 28, 0);
    showsPct(yours.seatUse, 59, 0);
    shows(car.movingPeak, 1341);
    shows(yours.movingPeak, 138);
    shows(car.fleetPer1000, 840);
    shows(yours.fleetPer1000, 3.2, 1);
    shows(car.fleet, 42000);
    shows(yours.fleet, 159);
  });
  it('where they wait', () => {
    shows(yours.storagePerVeh, 5);
    shows(car.storageM2 / 10000, 419);
    shows(yours.storageM2 / 10000, 0.08, 2);
    showsPct(car.parkingShare, 17.7);
    expect(yours.parkingShare).toBe(0);
    shows(yours.stations, 11);
    shows(yours.berths, 9);
    shows(car.placesPer1000, 2772);
    shows(yours.placesPer1000, 5.2, 1);
  });
  it('the sub level: 327 entries of 62 homes, 37 km of walkway, 8.3 km of line, 45 km in all', () => {
    shows(yours.homesPerEntry, 62);
    shows(yours.entries, 327);
    shows(yours.walkwayKm, 37);
    shows(yours.moverKm, 8.3, 1);
    shows(yours.subLevelKm, 45);
  });
});

describe('6. Goods', () => {
  it('runs, dumbwaiters, the pipe, totes and porters', () => {
    shows(car.goodsRuns, 128);
    shows(yours.goodsRuns, 280);
    showsPct(car.goodsShare, 0.1);
    showsPct(yours.goodsShare, 2.2);
    shows(yours.dumbwaiters, 20408);
    shows(yours.pipeKm, 61);
    shows(yours.totes, 35006);
    shows(yours.porters, 33);
  });
});

describe('7. Paths, lanes and the harm rule', () => {
  it('a bike is under the line at 9.2 km/h; 11 km of lanes take 1.1% of the land', () => {
    shows(yours.bikeLineKmh, 9.2, 1);
    shows(yours.laneKm, 11);
    showsPct(yours.laneShare, 1.1);
    shows(yours.farLaneMin, 2.6, 1);
  });
});

describe('How far it stretches', () => {
  it('25% more children before the elementary cap; 20% fewer people before the doctor runs short', () => {
    showsPct(yours.growPupils ?? NaN, 25, 0);
    expect(yours.growPupilsId).toBe('elementary');
    showsPct(yours.shrinkPeople ?? NaN, 20, 0);
    expect(yours.shrinkPeopleId).toBe('doctor');
    showsPct(yours.ringSlack, 24, 0);
    shows(yours.ceilingPop / SHARED.pop, 3.3, 1);
    shows((yours.ceilingPop / yours.density) * 247.105, 3105);
  });
});
