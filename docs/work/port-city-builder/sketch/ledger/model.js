// One derivation, run once per column. Premises in, consequences out.
// Lengths in km unless a name says otherwise; land in square meters per person.
const CityModel = (() => {
  const HEX = 3 * Math.sqrt(3) / 2;   // area of a hexagon whose corners are 1 from its middle
  const WALK = 80;                    // meters a minute on foot, 4.8 km/h
  const SHOPPING = 0.184;             // share of US trips that are shopping (NHTS 2017: 0.62 of 3.37 a day)
  const WORK = 0.19;                  // share that are work or work-related (17.4% + 1.6%)
  const CYCLIST_KG = 95;              // rider and bike
  const RING_GAP = 1;                 // gap between two ring buildings, in building widths
  const TINY = 1e-9;                  // keeps a count that lands exactly on a whole number from rounding the wrong way

  // Los Angeles County, 2010: 5.5M spaces at homes, 9.6M at destinations, 3.6M on the street.
  const PARK = { home: 5.5 / 18.7, away: 9.6 / 18.7, street: 3.6 / 18.7 };

  // Who rides together. Mean party 1.39, the trip-weighted occupancy in the 2017 NHTS.
  const PARTIES = [
    { size: 1, share: 0.74, cls: 'pod' },
    { size: 2, share: 0.18, cls: 'pod' },
    { size: 3.4, share: 0.07, cls: 'cab' },
    { size: 5.5, share: 0.01, cls: 'shuttle' },
  ];
  const CLASSES = {
    pod: { seats: 2, body: 2.41 * 1.39 },      // Citroen Ami
    cab: { seats: 4, body: 3.63 * 1.9 },       // Zoox robotaxi
    shuttle: { seats: 15, body: 4.75 * 2.11 }, // Navya Autonom Shuttle
  };

  // Chance that two random points in a disc of radius 1 are no more than t apart.
  function discCdf(t) {
    if (t <= 0) return 0;
    if (t >= 2) return 1;
    return 1 + (2 / Math.PI) * (t * t - 1) * Math.acos(t / 2)
      - (t / Math.PI) * (1 + t * t / 2) * Math.sqrt(1 - t * t / 4);
  }

  // Trip lengths between two random points in a city of radius r: [distance, probability] bins.
  function cityBins(r) {
    const n = 400, bins = [];
    for (let i = 0; i < n; i++) {
      const a = 2 * i / n, b = 2 * (i + 1) / n;
      bins.push([r * (a + b) / 2, discCdf(b) - discCdf(a)]);
    }
    return bins;
  }

  // Trip lengths from a random home to the middle of the area it belongs to (radius rc).
  function cellBins(rc) {
    const n = 200, bins = [];
    for (let i = 0; i < n; i++) {
      const a = i / n, b = (i + 1) / n;
      bins.push([rc * (a + b) / 2, b * b - a * a]);
    }
    return bins;
  }

  // Walk if it is close enough, bike some of what is bikeable, ride the rest.
  // A trip shorter than minRideKm starts and ends at the same stop, so there is nothing to ride:
  // whoever wanted a ride goes on foot, and is counted in 'stuck'.
  function split(bins, walkKm, bikeKm, rideAnyway, bikeWilling, minRideKm) {
    let walk = 0, bike = 0, ride = 0, rideKm = 0, stuck = 0;
    for (const [d, pr] of bins) {
      let w = 0, b = 0;
      if (d <= walkKm) w = 1 - rideAnyway;
      else if (d <= bikeKm) b = (1 - rideAnyway) * bikeWilling;
      let r = 1 - w - b;
      if (d < minRideKm) { stuck += pr * r; w += r; r = 0; }
      walk += pr * w; bike += pr * b; ride += pr * r; rideKm += pr * r * d;
    }
    return { walk, bike, ride, stuck, rideKm: ride > 0 ? rideKm / ride : 0 };
  }

  // Ground that holds a number of people, as a hexagon (its corner is the farthest home) and as a circle.
  const corner = (people, density) => Math.sqrt(people / density / HEX);
  const round = (people, density) => Math.sqrt(people / density / Math.PI);
  const farWalkMin = (people, density, detour) => corner(people, density) * detour * 1000 / WALK;

  // Where each need lands, how many the city gets, and how far each can stretch.
  // Three tiers: every center, shared between centers ('district'), and the middle of the city.
  // The band is the stretch the city must hold its rules across: schools are counted with the pupils at the
  // top of it, and everything that needs customers is counted with the people at the bottom of it.
  function placeNeeds(needs, s, c, o, band) {
    const low = 1 - band, high = 1 + band;
    const pupils = n => s.pop * n.grades * s.gradeShare;
    const schools = n => Math.max(1, Math.ceil(pupils(n) * high / n.cap - TINY));
    const fed = (people, wants) => Math.max(1, Math.floor(people * low / wants + TINY));
    const shared = needs.filter(n => n.tier === 'district');
    const sharedSchools = shared.filter(n => n.kind === 'cap');
    // A district is the ground that shares the kind of school the city has fewest of.
    const districts = sharedSchools.length ? Math.min(...sharedSchools.map(schools)) : shared.length ? 1 : 0;
    const share = { center: 0, district: 0, city: 0 };
    const rows = needs.map(n => {
      const r = { id: n.id, tier: n.tier };
      if (n.tier === 'out') return r;
      share[n.tier] += n.share / 100;
      if (n.kind === 'cap') {
        r.grows = true;                                         // a school stretches upward: more pupils
        if (n.tier === 'center') {
          const here = o.centerPop * n.grades * s.gradeShare;
          r.each = Math.max(1, Math.ceil(here * high / n.cap - TINY));
          r.count = o.centers * r.each; r.size = here / r.each; r.catch = o.centerPop;
        } else {
          r.each = schools(n); r.count = r.each; r.size = pupils(n) / r.count;
          r.catch = n.tier === 'district' ? s.pop / r.count : s.pop;   // shared schools spread out; the middle's stay together
        }
        r.fill = r.size / n.cap;
        r.slack = r.size > 0 ? n.cap / r.size - 1 : Infinity;   // how far the pupils can grow
      } else {
        const place = n.tier === 'center' ? o.centerPop : s.pop; // the people one center, or the whole city, brings
        r.each = n.people > 0 ? fed(place, n.people) : n.tier === 'district' ? Math.max(1, districts) : 1;
        r.count = (n.tier === 'center' ? o.centers : 1) * r.each;
        r.catch = n.tier === 'district' ? s.pop / r.each : place;
        const customers = place / r.each;
        r.fill = n.people > 0 ? customers / n.people : null;
        r.slack = n.people > 0 ? 1 - n.people / customers : null; // how far the people can fall
      }
      r.walkKm = round(r.catch, o.density) * Math.SQRT1_2 * c.detour;
      return r;
    });
    return { rows, share, districts };
  }

  function derive(s, c, needs) {
    const o = {};
    const owned = c.fleet === 'owned';
    const band = c.band > 0 ? Math.min(c.band, 0.95) : 0;
    o.band = band;

    // 1. Built form, and the density it gives.
    if (c.form === 'lots') {
      const perVeh = c.vehPerPerson * c.spacesPerVeh * c.stall;
      const stallHome = perVeh * PARK.home, stallAway = perVeh * PARK.away;
      const homeFoot = s.homeFloor / c.stories, otherFoot = s.otherFloor / c.stories;
      const resGround = Math.max(c.lotPerHome / s.hh, homeFoot + stallHome);
      const otherGround = (otherFoot + stallAway) / c.siteCoverage;
      o.footprint = homeFoot + otherFoot;
      o.parkingGround = stallHome + stallAway;
      o.yards = (resGround - homeFoot - stallHome) + (otherGround - otherFoot - stallAway);
      o.land = (resGround + otherGround + c.parks) / (1 - c.moveShare);
      o.streets = o.land * c.moveShare;
      o.streetParking = perVeh * PARK.street;
    } else {
      // Townhouses, and a circle of taller buildings in the middle for the offices, the civic floors and a few homes.
      const office = s.otherFloor * c.officeShare * (1 - c.coworkShare);
      const perPerson = office + c.civicFloor + s.homeFloor * c.condoShare;
      o.middleFloorM2 = s.pop * perPerson;
      o.condos = s.pop * c.condoShare / s.hh;
      const each = c.floorPlate * c.ringStories;                 // floor in one ring building
      o.ringStories = c.ringStories;
      o.ringNeed = o.middleFloorM2 / each;                       // buildings' worth of floor today
      o.ringBuildings = Math.max(1, Math.ceil(o.ringNeed * (1 + band) - TINY));
      o.ringServes = perPerson > 0 ? each / perPerson : Infinity; // people one building serves
      o.ringSlack = perPerson > 0 ? o.ringBuildings * o.ringServes / s.pop - 1 : Infinity;
      const side = Math.sqrt(c.floorPlate);
      const ringR = o.ringBuildings * (1 + RING_GAP) * side / (2 * Math.PI);   // middle of the circle to the middle of a building
      o.ringAcrossM = 2 * (ringR + side / 2);
      o.plazaM2 = Math.PI * Math.max(0, ringR - side / 2) ** 2;
      o.ringGround = o.ringBuildings * (1 + RING_GAP) * c.floorPlate / s.pop;   // buildings and the gaps between them; the plaza comes out of the parks
      const fabric = s.homeFloor * (1 - c.condoShare) + s.otherFloor - office - c.civicFloor;
      o.footprint = fabric / c.stories;
      const sites = o.footprint / c.siteCoverage;
      o.yards = sites - o.footprint;
      o.parkingGround = 0;
      o.streetParking = 0;
      const fabricLand = (sites + c.parks) / (1 - c.moveShare);
      o.streets = fabricLand * c.moveShare;
      o.land = fabricLand + o.ringGround;
    }
    o.stories = c.stories;
    o.parks = c.parks;
    o.density = 1e6 / o.land;
    o.parkingShare = (o.parkingGround + o.streetParking) / o.land;
    o.areaKm2 = s.pop / o.density;
    o.radiusKm = Math.sqrt(o.areaKm2 / Math.PI);
    o.rimMin = o.radiusKm * c.detour * 1000 / WALK;              // rim to middle, on foot
    o.reserveKm2 = band * o.areaKm2;

    // 2. Centers. The car city's center is a supermarket's worth of people inside a drive. The walking city's
    //    center is as small as its hungriest daily need allows, and the walk is whatever that makes it.
    o.walkDailyKm = s.walkDailyMin * WALK / c.detour / 1000;
    if (c.access === 'walk') {
      const daily = (needs || []).filter(n => n.tier === 'center' && n.kind !== 'cap' && n.people > 0);
      const top = daily.reduce((a, n) => (a && a.people >= n.people ? a : n), null);
      o.hungriest = top ? top.people : 0;
      o.hungriestId = top ? top.id : null;
      // With nothing hungry on the daily list there is nothing to size a center by, so it falls back to a walk.
      const wants = top ? top.people / (1 - band) : o.density * HEX * o.walkDailyKm * o.walkDailyKm;
      o.centerPop = Math.min(wants, s.pop);
      o.reachKm = corner(o.centerPop, o.density);
      o.reachCellKm2 = o.centerPop / o.density;
      o.ruleSlack = o.hungriest > 0 ? o.centerPop / o.hungriest : Infinity;
    } else {
      o.reachKm = (c.driveMin / 60) * c.rideKmh / c.detour;
      o.reachCellKm2 = HEX * o.reachKm * o.reachKm;
      o.hungriest = c.anchorPop;
      o.hungriestId = null;
      o.centerPop = c.anchorPop;
      o.ruleSlack = o.density / (c.anchorPop / o.reachCellKm2);
    }
    o.centers = s.pop / o.centerPop;
    o.centerCellKm2 = o.centerPop / o.density;
    const rc = round(o.centerPop, o.density);
    o.typicalToCenterKm = rc * Math.SQRT1_2 * c.detour;
    o.farCenterMin = farWalkMin(o.centerPop, o.density, c.detour);
    o.inWalkReach = Math.min(1, (o.walkDailyKm / rc) * (o.walkDailyKm / rc));

    // 3. Needs placed.
    const tiers = needs ? placeNeeds(needs, s, c, o, band) : null;
    if (tiers) { o.needs = tiers.rows; o.districts = tiers.districts; }

    // 4. Trips, by where they go. Each kind has its own spread of distances, its own walking limit, and a
    //    count of the walks a ride of that kind needs: one from home, and a second when the far end is not a stop.
    const walkMaxKm = s.walkMaxMin * WALK / c.detour / 1000;      // where people switch from walking to a ride
    const bikeMaxKm = (s.bikeMaxMin / 60) * s.bikeKmh / c.detour;
    const longKm = c.longWalkMin > 0 ? c.longWalkMin * WALK / c.detour / 1000 : walkMaxKm;   // school and work
    // A car comes to the door. A mover comes to a stop, and each stop serves its share of a center's ground.
    o.peoplePerStop = owned ? 0 : o.centerPop / Math.max(TINY, c.stopsPerCenter);
    const stopKm = owned ? 0 : corner(o.peoplePerStop, o.density);
    const stopR = owned ? 0 : round(o.peoplePerStop, o.density);
    o.stopWalkKm = stopR * Math.SQRT1_2 * c.detour;               // the median home's walk to its stop
    o.farStopMin = stopKm * c.detour * 1000 / WALK;
    let kinds;
    if (tiers) {
      const gone = SHOPPING * c.dumbShare;                    // shopping trips the dumbwaiter replaces
      o.tripsPerDay = s.trips * (1 - gone);
      const office = WORK * c.officeJobShare * (1 - c.coworkShare);
      const listed = tiers.share.center + tiers.share.district + tiers.share.city + office;
      const fit = listed > 1 - gone ? (1 - gone) / listed : 1;  // a list that claims more trips than are made is scaled to fit
      const of = x => x * fit / (1 - gone);                     // a share of today's trips, as a share of the trips still made
      o.dailyShare = of(tiers.share.center); o.districtShare = of(tiers.share.district);
      o.middleShare = of(tiers.share.city + office);
      o.elsewhereShare = Math.max(0, 1 - o.dailyShare - o.districtShare - o.middleShare);
      // One kind of trip for each need, out to the edge of the ground that shares it.
      kinds = [];
      needs.forEach((n, i) => {
        const r = tiers.rows[i];
        if (n.tier === 'out' || !(n.share > 0)) return;
        kinds.push([of(n.share / 100), cellBins(round(r.catch, o.density)), n.kind === 'cap' ? longKm : walkMaxKm, 1]);
      });
      kinds.push([of(office), cellBins(o.radiusKm), longKm, 1]);
      const otherWork = Math.min(o.elsewhereShare, of(WORK - office));
      kinds.push([otherWork, cityBins(o.radiusKm), longKm, 2]);
      kinds.push([o.elsewhereShare - otherWork, cityBins(o.radiusKm), walkMaxKm, 2]);
    } else {
      o.tripsPerDay = s.trips;
      o.dailyShare = c.basicShare; o.elsewhereShare = 1 - c.basicShare;
      kinds = [[c.basicShare, cellBins(rc), o.walkDailyKm, 0], [1 - c.basicShare, cityBins(o.radiusKm), walkMaxKm, 0]];
    }
    o.walk = 0; o.bike = 0; o.ride = 0; o.noRide = 0;
    let km = 0, ends = 0;
    for (const [share, bins, walkKm, walks] of kinds) {
      if (!(share > 0)) continue;
      const m = split(bins, walkKm, bikeMaxKm, s.rideAnyway, c.bikeWilling, stopR);
      o.walk += share * m.walk; o.bike += share * m.bike; o.ride += share * m.ride; o.noRide += share * m.stuck;
      km += share * m.ride * m.rideKm; ends += share * m.ride * walks;
    }
    o.rideKm = o.ride > 0 ? c.detour * km / o.ride : 0;
    o.rideWalks = o.ride > 0 ? ends / o.ride : 0;               // walks to or from a stop on the average ride
    // Getting to and from a ride. The owner parks and walks. The mover rider walks to a stop and waits,
    // and walks again at the far end unless the ride ends at a stop; the mover itself is only tied up
    // for the ride and the boarding. 'even' is the walk past which the ride is the quicker way.
    const rideMin = o.rideKm / c.rideKmh * 60;
    const saved = 1000 / WALK - 60 / c.rideKmh;                   // minutes a kilometer of riding saves over walking it
    const even = access => saved > 0 ? access / saved * 1000 / WALK : Infinity;
    if (owned) {
      o.accessMin = c.handlingMin; o.vehicleMin = rideMin + c.handlingMin;
      o.evenLowMin = even(c.handlingMin); o.evenHighMin = o.evenLowMin;
    } else {
      const toStop = o.stopWalkKm * 1000 / WALK;
      o.accessMin = o.rideWalks * toStop + c.waitMin; o.vehicleMin = rideMin + 2 * c.dwellMin;
      o.evenLowMin = even(toStop + c.waitMin); o.evenHighMin = even(2 * toStop + c.waitMin);
    }
    o.doorMin = rideMin + o.accessMin;
    o.ridersPerDay = s.pop * o.tripsPerDay * o.ride;

    // 5. Vehicles. Owned: one per driver, whatever the demand. Movers: sized for the busiest hour.
    o.mix = {};
    if (owned) {
      o.vehTrips = o.ridersPerDay / c.occupancy;
      o.seatUse = c.occupancy / c.seats;
    } else {
      const privateRides = o.ridersPerDay * (1 - c.pooledShare) / PARTIES.reduce((t, p) => t + p.size * p.share, 0);
      const pooledRuns = o.ridersPerDay * c.pooledShare / c.pooledLoad;
      const rides = { pod: 0, cab: 0, shuttle: pooledRuns };
      for (const p of PARTIES) rides[p.cls] += privateRides * p.share;
      o.vehTrips = privateRides + pooledRuns;
      let seats = 0;
      for (const k of Object.keys(rides)) { seats += rides[k] * CLASSES[k].seats; o.mix[k] = o.vehTrips > 0 ? rides[k] / o.vehTrips : 0; }
      o.seatUse = seats > 0 ? o.ridersPerDay / seats : 0;
    }
    o.vehTripsPerPerson = o.vehTrips / s.pop;
    o.movingPeak = o.vehTrips * s.peakShare * (o.vehicleMin / 60) * (1 + c.emptyRunning);
    o.fleet = owned ? s.pop * c.vehPerPerson : o.movingPeak * (1 + c.reserve);
    o.fleetPer1000 = 1000 * o.fleet / s.pop;
    o.peakUse = o.fleet > 0 ? o.movingPeak / o.fleet : 0;

    // 6. Where vehicles wait, and where people meet them.
    if (owned) {
      o.spaces = o.fleet * c.spacesPerVeh;
      o.storageM2 = o.spaces * c.stall;
      o.placesPer1000 = 1000 * c.vehPerPerson * c.spacesPerVeh;
    } else {
      o.spaces = o.fleet;
      o.storageM2 = 0;
      for (const k of Object.keys(o.mix)) o.storageM2 += o.fleet * o.mix[k] * CLASSES[k].body * c.packFactor;
      // Stops: each center's share of them, and one more under the ring.
      const stops = s.pop / o.peoplePerStop;
      o.stations = stops + 1;
      const stopsPerHour = 2 * o.vehTripsPerPerson * o.peoplePerStop * s.peakShare;
      o.berths = Math.max(1, Math.ceil(stopsPerHour * (c.dwellMin / 60) / c.berthUse));
      o.placesPer1000 = 1000 * (o.berths * o.stations + o.fleet) / s.pop;
      // The sub level: a mover line linking the stops, and a walkway from each group's entry to its stop.
      // An entry that sits on a stop needs no walkway, so stops at every entry leave none.
      const entryKm = c.entryWalkMin * WALK / c.detour / 1000;
      o.peoplePerEntry = o.density * HEX * entryKm * entryKm;
      o.homesPerEntry = o.peoplePerEntry / s.hh;
      o.entries = s.pop / o.peoplePerEntry;
      o.entriesPerCenter = o.centerPop / o.peoplePerEntry;
      o.walkwayKm = Math.max(0, o.entries - stops) * entryKm * Math.sqrt(3);
      o.moverKm = stops * stopKm * Math.sqrt(3) * c.loopFactor;
      o.subLevelKm = o.walkwayKm + o.moverKm;
    }
    o.storagePerVeh = o.fleet > 0 ? o.storageM2 / o.fleet : 0;

    // 7. Goods.
    if (owned) {
      o.goodsRuns = s.pop * s.parcelsPerYear / 365 / c.parcelsPerRun + s.pop * s.goodsKg / c.payloadKg;
    } else {
      const homes = s.pop / s.hh;
      o.dumbwaiters = homes;
      o.pipeKm = homes * c.frontage / c.rowsPerPipe / 1000;
      o.totes = s.pop * s.parcelsPerYear / 365 + homes * c.groceryPerWeek / 7 + homes * c.trashTotes;
      o.goodsRuns = s.pop * s.goodsKg * (1 - c.pipedShare) / c.payloadKg;
      const hours = homes / 1000 * c.bulkyPer1000 * c.bulkyMin / 60 + homes * c.moveRate / 365 * 2 * c.moveHours;
      o.porters = hours / 8;
      // 8. Bike lanes on the edges between neighborhoods, and the speed at which a bike is no more than a jogger.
      o.laneKm = o.centers * 3 * o.reachKm;
      o.laneShare = o.laneKm * c.laneWidth / 1000 / o.areaKm2;
      o.bikeLineKmh = Math.sqrt(2 * c.harmLine / CYCLIST_KG) * 3.6;
      o.farLaneMin = 0.866 * o.reachKm * c.detour / o.bikeLineKmh * 60;
    }
    o.goodsShare = o.goodsRuns / (o.goodsRuns + o.vehTrips);

    // 9. Stretch: how far the city can move with nothing rebuilt, and how far its land can grow.
    if (tiers) {
      o.insideLong = Math.min(1, (longKm / o.radiusKm) * (longKm / o.radiusKm));   // homes inside the walk to work in the middle
      o.ceilingPop = Math.PI * longKm * longKm * o.density;      // people a circle of that walk holds
      let grow = null, shrink = null;
      const short = [];
      tiers.rows.forEach((r, i) => {
        if (r.tier === 'out' || r.slack === null || r.slack === undefined) return;
        if (r.grows) { if (!grow || r.slack < grow.slack - TINY) grow = r; }
        else if (r.slack < -TINY) short.push(r.id);
        else if (!shrink || r.slack < shrink.slack - TINY || (r.slack < shrink.slack + TINY && needs[i].people > shrink.wants)) { shrink = r; shrink.wants = needs[i].people; }
      });
      o.growPupils = grow ? grow.slack : null; o.growPupilsId = grow ? grow.id : null;
      o.shrinkPeople = shrink ? shrink.slack : null; o.shrinkPeopleId = shrink ? shrink.id : null;
      o.shortIds = short;
    }
    return o;
  }

  const defaults = {
    shared: {
      pop: 50000, trips: 3.37, hh: 2.45, homeFloor: 68.8, otherFloor: 27.4, gradeShare: 0.012,
      walkDailyMin: 5, walkMaxMin: 15, bikeMaxMin: 15, bikeKmh: 15, rideAnyway: 0.10,
      peakShare: 0.10, parcelsPerYear: 64, goodsKg: 7,
    },
    old: {
      access: 'drive', driveMin: 10, rideKmh: 35, detour: 1.3, form: 'lots', fleet: 'owned',
      basicShare: 0.35, anchorPop: 7500,
      lotPerHome: 590, stories: 1.5, siteCoverage: 0.8, parks: 42.9, moveShare: 0.24,
      vehPerPerson: 0.84, spacesPerVeh: 3.3, stall: 30.2, seats: 5, occupancy: 1.39,
      bikeWilling: 0.05, handlingMin: 3, emptyRunning: 0, parcelsPerRun: 150, payloadKg: 5000,
    },
    neu: {
      access: 'walk', rideKmh: 25, detour: 1.2, form: 'townhouses', fleet: 'movers',
      stories: 3, siteCoverage: 0.6, parks: 10, moveShare: 0.20,
      officeShare: 0.17, coworkShare: 0, civicFloor: 0.4, condoShare: 0.02, ringStories: 25, floorPlate: 2000, officeJobShare: 0.30,
      longWalkMin: 30, band: 0.20,
      dumbShare: 0.67, stopsPerCenter: 1, waitMin: 2, entryWalkMin: 1, loopFactor: 1.25,
      reserve: 0.15, emptyRunning: 0.20, pooledShare: 0.25, pooledLoad: 8, packFactor: 1.25,
      bikeWilling: 0.5, dwellMin: 1, berthUse: 0.5,
      payloadKg: 500, pipedShare: 0.6, frontage: 6, rowsPerPipe: 2, groceryPerWeek: 2, trashTotes: 1,
      bulkyPer1000: 10, bulkyMin: 30, moveRate: 0.09, moveHours: 16,
      harmLine: 310, laneWidth: 3.5,
    },
    // people: how many one of these needs. share: percent of the car city's trips that go to it.
    needs: [
      { id: 'bakery', tier: 'center', people: 2100, share: 2 },
      { id: 'butcher', tier: 'center', people: 3700, share: 2 },
      { id: 'produce', tier: 'center', people: 0, share: 2 },
      { id: 'dining', tier: 'center', people: 500, share: 6 },
      { id: 'library', tier: 'center', people: 0, share: 1 },
      { id: 'doctor', tier: 'center', people: 4000, share: 2 },
      { id: 'park', tier: 'center', people: 0, share: 8 },
      { id: 'elementary', tier: 'district', kind: 'cap', cap: 500, grades: 6, share: 5 },
      { id: 'middle', tier: 'district', kind: 'cap', cap: 1000, grades: 3, share: 2 },
      { id: 'high', tier: 'district', kind: 'cap', cap: 1500, grades: 4, share: 2 },
      { id: 'fields', tier: 'district', people: 0, share: 1 },
      { id: 'urgent', tier: 'district', people: 23300, share: 0 },
      { id: 'finedining', tier: 'city', people: 71300, share: 0.5 },
      { id: 'auditorium', tier: 'city', people: 0, share: 0.5 },
      { id: 'government', tier: 'city', people: 0, share: 0.5 },
    ],
  };

  return { derive, discCdf, farWalkMin, defaults, CLASSES, PARTIES, PARK, CYCLIST_KG, K: { HEX, WALK, SHOPPING, WORK } };
})();
if (typeof module !== 'undefined') module.exports = CityModel;
