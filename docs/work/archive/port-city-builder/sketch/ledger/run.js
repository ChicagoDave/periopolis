const M = require('./model.js');
const { shared, old, neu, needs } = M.defaults;
const f = (x, d = 1) => (x === null || x === undefined) ? '-' : Number.isFinite(x) ? x.toLocaleString('en-US', { maximumFractionDigits: d }) : String(x);
const pct = (x, d = 1) => (x === null || x === undefined) ? '-' : (100 * x).toFixed(d) + '%';

const O = M.derive(shared, old), N = M.derive(shared, neu, needs);

// The car column must not have moved.
const expect = { density: 2110, walk: 0.083, bike: 0.030, ride: 0.887, rideKm: 2.61, vehTrips: 107558, movingPeak: 1341, parkingShare: 0.177, goodsRuns: 128, ruleSlack: 14.71, inWalkReach: 0.084 };
let bad = 0;
for (const k of Object.keys(expect)) {
  const got = O[k], want = expect[k];
  const ok = Math.abs(got - want) <= Math.abs(want) * 0.006 + 0.0006;
  if (!ok) { bad++; console.log('CAR COLUMN MOVED', k, got, 'expected', want); }
}
console.log(bad ? 'car column: ' + bad + ' differences' : 'car column: unchanged');

function show(label, o) {
  console.log('\n== ' + label + ' ==');
  console.log('land m2/person', f(o.land), '| footprint', f(o.footprint), '| yards', f(o.yards), '| parking', f(o.parkingGround), '| parks', f(o.parks), '| streets', f(o.streets), '| ring', f(o.ringGround, 2), '| sum', f(o.footprint + o.yards + o.parkingGround + o.parks + o.streets + (o.ringGround || 0)));
  console.log('density /km2', f(o.density, 0), '(/sq mi', f(o.density * 2.58999, 0) + ')', '| area km2', f(o.areaKm2, 2), '(acres', f(o.areaKm2 * 247.105, 0) + ')', '| radius km', f(o.radiusKm, 2), '| rim to middle min', f(o.rimMin, 1));
  console.log('hungriest', f(o.hungriest, 0), o.hungriestId || '', '| center pop', f(o.centerPop, 0), '| centers', f(o.centers, 2), '| far walk min', f(o.farCenterMin, 2), '| typical km', f(o.typicalToCenterKm, 2), '| slack', f(o.ruleSlack, 2));
  console.log('trips/day', f(o.tripsPerDay, 2), '| daily', pct(o.dailyShare), '| shared', pct(o.districtShare), '| middle', pct(o.middleShare), '| elsewhere', pct(o.elsewhereShare));
  console.log('walk', pct(o.walk), 'bike', pct(o.bike), 'ride', pct(o.ride), 'sum', f(o.walk + o.bike + o.ride, 4), '| no ride', pct(o.noRide), '| ride km', f(o.rideKm, 2), '| access', f(o.accessMin), '| vehicle min', f(o.vehicleMin), '| door', f(o.doorMin), '| even', f(o.evenLowMin), 'to', f(o.evenHighMin));
  console.log('veh trips/day', f(o.vehTrips, 0), '| per person', f(o.vehTripsPerPerson, 2), '| seat use', pct(o.seatUse), '| moving at peak', f(o.movingPeak, 0), '| fleet', f(o.fleet, 0), '| per 1000', f(o.fleetPer1000), '| places per 1000', f(o.placesPer1000), '| goods runs', f(o.goodsRuns, 0), pct(o.goodsShare));
}
show('CAR', O); show('YOURS', N);
console.log('middle: floor m2', f(N.middleFloorM2, 0), '(sq ft', f(N.middleFloorM2 * 10.7639, 0) + ')', '| buildings', N.ringBuildings, 'need', f(N.ringNeed, 2), '| serves', f(N.ringServes, 0), '| slack', pct(N.ringSlack), '| across m', f(N.ringAcrossM, 0), '| plaza acres', f(N.plazaM2 / 4046.86), '| condos', f(N.condos, 0));
console.log('reserve acres', f(N.reserveKm2 * 247.105, 0), '| inside the long walk', pct(N.insideLong), '| ceiling pop', f(N.ceilingPop, 0), '=', f(N.ceilingPop / shared.pop, 2) + 'x', '| acres at ceiling', f(N.ceilingPop / N.density * 247.105, 0));
console.log('stops', f(N.stations, 1), '| people per stop', f(N.peoplePerStop, 0), '| far stop min', f(N.farStopMin), '| typical', f(N.stopWalkKm * 1000 / 80), '| berths', N.berths, '| entries', f(N.entries, 0), 'per center', f(N.entriesPerCenter), '| homes/entry', f(N.homesPerEntry, 0), '| walkway km', f(N.walkwayKm), '| mover km', f(N.moverKm), '| sub level', f(N.subLevelKm));
console.log('dumbwaiters', f(N.dumbwaiters, 0), '| pipe km', f(N.pipeKm), '| totes', f(N.totes, 0), '| porters', f(N.porters), '| lanes km', f(N.laneKm), pct(N.laneShare), '| bike line km/h', f(N.bikeLineKmh), '| far lane min', f(N.farLaneMin), '| mix', JSON.stringify(Object.fromEntries(Object.entries(N.mix).map(([k, v]) => [k, +(v * 100).toFixed(1)]))));
console.log('stretch: pupils can grow', pct(N.growPupils), N.growPupilsId, '| people can fall', pct(N.shrinkPeople), N.shrinkPeopleId, '| ring', pct(N.ringSlack), '| short', N.shortIds.join(','), '| districts', N.districts);
console.log('\n== needs ==');
for (const r of N.needs) console.log(r.id.padEnd(11), r.tier.padEnd(8), '| count', f(r.count, 1), '| each', f(r.each, 0), '| shares one', f(r.catch, 0), '| fill', pct(r.fill), r.size ? '| pupils ' + f(r.size, 0) : '', '| slack', pct(r.slack), '| walk min', f(r.walkKm * 1000 / 80, 1));

console.log('\n== farthest walk by people who share one thing, x stories ==');
for (const p of [500, 2000, 4000, 5000, 10000, 25000, 50000]) console.log(String(p).padStart(6), [2, 3, 4].map(st => st + ' stories: ' + f(M.farWalkMin(p, M.derive(shared, { ...neu, stories: st }, needs).density, neu.detour))).join(' | '));

console.log('\n== band ==');
for (const b of [0, 0.1, 0.2, 0.3]) { const x = M.derive(shared, { ...neu, band: b }, needs); const row = id => { const r = x.needs.find(q => q.id === id); return id + ' ' + f(r.count, 0) + 'x' + f(r.size, 0); }; console.log('band', b, '| center', f(x.centerPop, 0), 'x', f(x.centers, 1), '| far walk', f(x.farCenterMin, 2), '|', row('elementary'), row('middle'), row('high'), '| ring', x.ringBuildings, '| reserve acres', f(x.reserveKm2 * 247.105, 0), '| grow', pct(x.growPupils, 0), 'shrink', pct(x.shrinkPeople, 0), 'ring', pct(x.ringSlack, 0), '| walk', pct(x.walk), 'ride', pct(x.ride), 'fleet', f(x.fleet, 0)); }

console.log('\n== stops in each center ==');
for (const k of [1, 2, 4, 7, N.entriesPerCenter]) { const b = M.derive(shared, { ...neu, stopsPerCenter: k }, needs); console.log('stops/center', f(k, 1), '| stops', f(b.stations, 0), '| far stop', f(b.farStopMin), '| berths', b.berths, '| walk', pct(b.walk), 'bike', pct(b.bike), 'ride', pct(b.ride), '| no ride', pct(b.noRide), '| access', f(b.accessMin), '| door', f(b.doorMin), '| even', f(b.evenLowMin), '-', f(b.evenHighMin), '| fleet', f(b.fleet, 0), '| mover km', f(b.moverKm), '| walkway km', f(b.walkwayKm), '| sub level', f(b.subLevelKm)); }

console.log('\n== scale ==');
for (const p of [50000, 250000, 1000000, 5000000]) {
  const a = M.derive({ ...shared, pop: p }, old), b = M.derive({ ...shared, pop: p }, neu, needs);
  console.log('pop', f(p, 0), '| CAR ride', pct(a.ride), '| YOURS r', f(b.radiusKm, 1), 'centers', f(b.centers, 0), 'rim min', f(b.rimMin, 0), 'inside', pct(b.insideLong, 0), 'walk', pct(b.walk), 'bike', pct(b.bike), 'ride', pct(b.ride), 'fleet/1000', f(b.fleetPer1000), 'vs cars', pct(b.fleet / a.fleet), 'ring', b.ringBuildings);
}
