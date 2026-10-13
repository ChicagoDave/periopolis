// The rules of the game. The site is a board of hexagons, each the ground of one center, and everything is
// checked against the ledger's premises using the real distances between tiles. Nothing in here draws.
const CityGame = (() => {
  const M = CityModel, D = M.defaults, S = D.shared, C = D.neu, K = M.K;
  const base = M.derive(S, C, D.needs);                    // the ledger's city of 50,000: the tile and the rates come from it

  const BOARD = 5;                                          // tiles from the middle of the site to its edge
  const HOOD = base.centerPop;                              // people in one neighborhood
  const TILE_KM = Math.sqrt(HOOD / base.density / K.HEX);   // middle of a tile to its corner
  const STEP_KM = Math.sqrt(3) * TILE_KM;                   // middle to middle of neighboring tiles
  const FOOT = C.detour * 1000 / K.WALK;                    // minutes on foot per straight-line km
  const BIKE = C.detour * 60 / S.bikeKmh;                   // minutes by bike per straight-line km
  const IN_TILE = base.typicalToCenterKm * 1000 / K.WALK;   // the typical home's walk to the center of its own tile
  const ACROSS_TILE = 1.5 * IN_TILE;                        // a typical walk between two homes in one neighborhood (assumed)
  const TILE_ACRES = HOOD / base.density * 247.105;
  const RING_SERVES = base.ringServes;                      // people one ring building serves
  const LONG_KM = C.longWalkMin / FOOT;                     // the walk to school or work, as a straight line
  const MODULE_MW = 77, PEAK_KW = 1.5;                      // line 20, and the 75 MW peak worked out for 50,000 people
  const COOLING_MGD = 1.44, SEWAGE_GAL = 101;               // per reactor module, and cleaned sewage per person per day
  const PLANT_SERVES = 60000;                               // one unit of a water, sewage or waste plant: 50,000 people plus the band
  const FIELD_WALK = 20;                                    // minutes: my reading of "a slightly longer walk" in line 4
  const BAND = C.band;
  const WALKWAY_KM = base.walkwayKm / base.centers, PIPE_KM = base.pipeKm / base.centers, ENTRIES = base.entriesPerCenter;
  const PER_VEHICLE = base.ridersPerDay / base.vehTrips;    // people on the average mover trip
  const SCHOOLS = ['elementary', 'middle', 'high'];
  const EXTRAS = SCHOOLS.concat(['fields']);
  const PLANTS = ['power', 'water', 'sewage', 'waste'];
  const NAME = {
    hood: 'Neighborhood', ring: 'Ring', power: 'Reactor site', water: 'Water plant', sewage: 'Sewage plant', waste: 'Waste works',
    elementary: 'Elementary school', middle: 'Middle school', high: 'High school', fields: 'Playing fields',
  };
  const DAILY = { bakery: 'the bakery', butcher: 'the butcher', dining: 'the cafés', doctor: 'the doctor\'s office' };

  const num = (x, d = 0) => x.toLocaleString('en-US', { maximumFractionDigits: d });
  const count = (n, one, many) => num(n) + ' ' + (n === 1 ? one : many);
  const list = words => words.length < 2 ? words.join('') : words.slice(0, -1).join(', ') + ' and ' + words[words.length - 1];

  // Tiles are named by two whole numbers, "q,r": q counts east, r counts down and to the right.
  const key = (q, r) => q + ',' + r;
  const at = k => { const i = k.indexOf(','); return [Number(k.slice(0, i)), Number(k.slice(i + 1))]; };
  const onBoard = (q, r) => Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= BOARD;
  const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
  const neighbors = k => { const [q, r] = at(k); return DIRS.map(([dq, dr]) => [q + dq, r + dr]).filter(([a, b]) => onBoard(a, b)).map(([a, b]) => key(a, b)); };
  const adjacent = (a, b) => neighbors(a).includes(b);
  const spots = {};                                         // km east and south of the middle, worked out once for each tile
  const spot = k => spots[k] || (spots[k] = (() => { const [q, r] = at(k); return [STEP_KM * (q + r / 2), STEP_KM * Math.sqrt(3) / 2 * r]; })());
  const km = (a, b) => { const [x1, y1] = spot(a), [x2, y2] = spot(b); return Math.hypot(x2 - x1, y2 - y1); };
  const edge = (a, b) => a < b ? a + '|' + b : b + '|' + a;
  const ends = e => { const i = e.indexOf('|'); return [e.slice(0, i), e.slice(i + 1)]; };
  function allTiles() {
    const out = [];
    for (let r = -BOARD; r <= BOARD; r++) for (let q = -BOARD; q <= BOARD; q++) if (onBoard(q, r)) out.push(key(q, r));
    return out;
  }

  // Where trips go, as shares of the trips still made once the dumbwaiter has replaced most shopping.
  const still = 1 - K.SHOPPING * C.dumbShare;
  const need = id => D.needs.find(n => n.id === id);
  const shareOf = id => need(id).share / 100 / still;
  const officeShare = K.WORK * C.officeJobShare * (1 - C.coworkShare) / still;
  const SHARE = {
    daily: D.needs.filter(n => n.tier === 'center').reduce((t, n) => t + n.share, 0) / 100 / still,
    elementary: shareOf('elementary'), middle: shareOf('middle'), high: shareOf('high'), fields: shareOf('fields'),
    civic: shareOf('finedining') + shareOf('auditorium') + shareOf('government'),
    office: officeShare, otherWork: K.WORK / still - officeShare,
  };
  SHARE.rest = 1 - Object.keys(SHARE).reduce((t, k) => t + SHARE[k], 0);

  // The mover line as drawn: which tiles it touches, and how many segments lie between any two of them.
  function network(state) {
    const next = {};
    for (const e of Object.keys(state.lines)) { const [a, b] = ends(e); (next[a] = next[a] || []).push(b); (next[b] = next[b] || []).push(a); }
    const hops = {};
    for (const from of Object.keys(next)) {
      const seen = {}, queue = [from];
      seen[from] = 0;
      for (let i = 0; i < queue.length; i++) for (const n of next[queue[i]]) if (!(n in seen)) { seen[n] = seen[queue[i]] + 1; queue.push(n); }
      hops[from] = seen;
    }
    return { onLine: k => Boolean(next[k]), segs: (a, b) => (hops[a] && b in hops[a]) ? hops[a][b] : null };
  }

  // Places with room go to the nearest takers first. Anyone still left out is then seated by moving others on to a
  // place farther off, wherever that can be done, so nobody is counted out while a seat for them exists.
  // Returns who goes where, each place's load, and who is left out.
  function assign(takers, places, minutes, limit) {
    const tiny = 1e-9, left = {}, room = {}, seats = {}, reach = {}, time = {}, pairs = [];
    for (const t of takers) { left[t.key] = t.amount; seats[t.key] = {}; reach[t.key] = []; }
    for (const p of places) room[p.key] = p.cap;
    for (const t of takers) for (const p of places) { const m = minutes(t.key, p.key); if (m <= limit) pairs.push({ t: t.key, p: p.key, m }); }
    pairs.sort((x, y) => x.m - y.m || (x.t < y.t ? -1 : x.t > y.t ? 1 : 0) || (x.p < y.p ? -1 : x.p > y.p ? 1 : 0));
    for (const { t, p, m } of pairs) {
      reach[t].push(p); time[t + '>' + p] = m;
      const n = Math.min(left[t], room[p]);
      if (n <= tiny) continue;
      left[t] -= n; room[p] -= n; seats[t][p] = n;
    }
    // A chain of moves: the one left out takes seats at a full place, whoever held them moves on, and so on until
    // someone lands where there is room. Returns [taker, place, taker, place, ...], ending at the place with room.
    const chain = from => {
      const heldAt = { [from]: null }, wantedBy = {}, queue = [from];
      for (let i = 0; i < queue.length; i++) {
        const t = queue[i];
        for (const p of reach[t]) {
          if (p in wantedBy) continue;
          wantedBy[p] = t;
          if (room[p] > tiny) {
            const path = [p];
            let who = t;
            while (true) { path.push(who); const held = heldAt[who]; if (held === null) break; path.push(held); who = wantedBy[held]; }
            return path.reverse();
          }
          for (const other of takers) if (!(other.key in heldAt) && seats[other.key][p] > tiny) { heldAt[other.key] = p; queue.push(other.key); }
        }
      }
      return null;
    };
    for (const t of takers) {
      for (let tries = 0; left[t.key] > tiny && tries < 500; tries++) {
        const path = chain(t.key);
        if (!path) break;
        const last = path[path.length - 1];
        let n = Math.min(left[t.key], room[last]);
        for (let i = 1; i + 1 < path.length; i += 2) n = Math.min(n, seats[path[i + 1]][path[i]]);
        for (let i = 0; i + 1 < path.length; i += 2) seats[path[i]][path[i + 1]] = (seats[path[i]][path[i + 1]] || 0) + n;
        for (let i = 1; i + 1 < path.length; i += 2) seats[path[i + 1]][path[i]] -= n;
        left[t.key] -= n; room[last] -= n;
      }
    }
    const goes = {}, load = {};
    for (const p of places) load[p.key] = p.cap - room[p.key];
    for (const t of takers) goes[t.key] = reach[t.key].filter(p => seats[t.key][p] > tiny).map(p => ({ to: p, amount: seats[t.key][p], minutes: time[t.key + '>' + p] }));
    return { goes, load, left };
  }

  const NONE = { people: 0, children: 0 };

  function evaluateCore(state, stress) {
    const tiles = state.tiles, keys = Object.keys(tiles);
    const of = kind => keys.filter(k => tiles[k].kind === kind);
    const hoods = of('hood'), rings = of('ring');
    const pop1 = HOOD * (1 + stress.people), pop = hoods.length * pop1;
    // a stretch of mover line closed for repairs is still built, but carries nobody this year
    const shut = stress.closed || [];
    const net = network(shut.length ? { tiles, lines: Object.fromEntries(Object.keys(state.lines).filter(e => !shut.includes(e)).map(e => [e, true])) } : state);
    const stop = k => Boolean(tiles[k]) && net.onLine(k);
    const segs = (a, b) => (stop(a) && stop(b)) ? net.segs(a, b) : null;
    const walk = (a, b) => a === b ? IN_TILE : km(a, b) * FOOT;
    const per = {};
    for (const k of keys) per[k] = { issues: [], level: null, stop: stop(k) };
    const flag = (k, level, text) => { const p = per[k]; p.issues.push(text); if (level === 'bad' || !p.level) p.level = level; };
    const rules = [];
    const rule = (id, lines, title, status, detail, where) => rules.push({ id, lines, title, status, detail, tiles: where || [] });
    const some = hoods.length > 0;

    // Lines 3, 13, 14: each neighborhood carries its own daily list.
    {
      const title = 'Every neighborhood feeds its daily list';
      const hungriest = D.needs.filter(x => x.tier === 'center' && x.kind !== 'cap').reduce((a, x) => Math.max(a, x.people), 0);
      if (!some) rule('daily', 'Lines 3, 13, 14', title, 'idle', 'Place a neighborhood to begin. Each is ' + num(HOOD) + ' people with its own bakery, butcher, cafés, library, doctor and park.');
      else {
        const short = D.needs.filter(x => x.tier === 'center' && x.kind !== 'cap' && x.people > pop1 + 1e-6).map(x => DAILY[x.id] || x.id);
        if (short.length) {
          const text = list(short);
          for (const h of hoods) flag(h, 'bad', text.charAt(0).toUpperCase() + text.slice(1) + (short.length > 1 ? ' run' : ' runs') + ' short of people');
          rule('daily', 'Lines 3, 13, 14', title, 'bad', 'With ' + num(pop1) + ' people in a neighborhood, ' + text + (short.length > 1 ? ' run' : ' runs') + ' short of customers.', hoods);
        } else rule('daily', 'Lines 3, 13, 14', title, 'ok', 'Each neighborhood has ' + num(pop1) + ' people. Its hungriest need, the doctor\'s office, wants ' + num(hungriest) + '.');
      }
    }

    // Lines 3, 14: the two needs that take most of a city to feed. Short of people they limp, so this is a watch, not a break.
    {
      const title = 'The city is big enough for urgent care and fine dining';
      const urgent = need('urgent').people, fine = need('finedining').people;
      const both = 'Urgent care wants ' + num(urgent) + ' people in the city and fine dining ' + num(fine) + '.';
      if (!some) rule('size', 'Lines 3, 14', title, 'idle', both);
      else if (pop + 1e-6 < urgent) rule('size', 'Lines 3, 14', title, 'warn', both + ' The city has ' + num(pop) + '.');
      else if (pop + 1e-6 < fine) rule('size', 'Lines 3, 14', title, 'warn', 'Fine dining wants ' + num(fine) + ' people in the city. It has ' + num(pop) + ', which is ' + num(100 * pop / fine) + '% of that.');
      else rule('size', 'Lines 3, 14', title, 'ok', both + ' The city has ' + num(pop) + '.');
    }

    // Lines 10, 19: the ring, and line 16: the walk to work in it.
    const ringOf = {};
    for (const h of hoods) {
      let best = null;
      for (const g of rings) { const d = km(h, g); if (!best || d < best.d - 1e-9) best = { key: g, d }; }
      ringOf[h] = best ? best.key : null;
      per[h].ring = best ? { key: best.key, walk: best.d * FOOT, segs: segs(h, best.key) } : null;
    }
    {
      const title = 'The ring has room for the offices and halls';
      if (!rings.length) rule('ring', 'Lines 10, 19', title, some ? 'bad' : 'idle', some ? 'There is no ring yet. Offices, government, the auditorium and fine dining have nowhere to go.' : 'The ring is the middle: a circle of 25-story buildings.');
      else {
        const over = [];
        let buildings = 0;
        for (const g of rings) {
          const load = hoods.filter(h => ringOf[h] === g).length * pop1, cap = tiles[g].n * RING_SERVES;
          buildings += tiles[g].n;
          per[g].load = load; per[g].cap = cap; per[g].needs = Math.ceil(load / RING_SERVES - 1e-9);
          if (load > cap + 1e-6) { over.push(g); flag(g, 'bad', 'Needs ' + count(per[g].needs, 'building', 'buildings') + ' for ' + num(load) + ' people, and has ' + tiles[g].n); }
        }
        if (over.length) rule('ring', 'Lines 10, 19', title, 'bad', (rings.length > 1 ? count(over.length, 'ring is', 'rings are') : 'The ring is') + ' full. One building holds the offices and halls of ' + num(RING_SERVES) + ' people, so ' + num(pop) + ' people take ' + Math.ceil(pop / RING_SERVES - 1e-9) + '.', over);
        else rule('ring', 'Lines 10, 19', title, some ? 'ok' : 'idle', count(buildings, 'building holds', 'buildings hold') + ' the offices and halls of ' + num(buildings * RING_SERVES) + ' people. The city has ' + num(pop) + '.');
      }
    }
    {
      const title = 'Work is within a 30-minute walk';
      const far = hoods.filter(h => per[h].ring && per[h].ring.walk > C.longWalkMin + 1e-6);
      const cut = far.filter(h => per[h].ring.segs === null);
      if (!some || !rings.length) rule('work', 'Line 16', title, 'idle', 'A dashed circle around each ring marks the 30-minute walk.');
      else if (cut.length) {
        for (const h of cut) flag(h, 'bad', 'A ' + num(per[h].ring.walk) + '-minute walk from the ring, with no mover line to it');
        rule('work', 'Line 16', title, 'bad', count(cut.length, 'neighborhood is', 'neighborhoods are') + ' past the walk to the ring and ' + (cut.length === 1 ? 'has' : 'have') + ' no mover line to it.', cut);
      } else if (far.length) {
        for (const h of far) flag(h, 'warn', 'A ' + num(per[h].ring.walk) + '-minute walk from the ring, so people ride to work');
        rule('work', 'Line 16', title, 'warn', count(far.length, 'neighborhood is', 'neighborhoods are') + ' past the 30-minute walk. Their people ride a mover to work, or the city needs a second ring.', far);
      } else rule('work', 'Line 16', title, 'ok', 'The farthest neighborhood is a ' + num(Math.max(...hoods.map(h => per[h].ring.walk))) + '-minute walk from its ring.');
    }

    // Line 6: people walk to the movers, so every neighborhood needs a stop on a line that reaches its ring.
    {
      const title = 'Every neighborhood has a mover stop';
      const without = hoods.filter(h => per[h].ring ? per[h].ring.segs === null : !stop(h));
      for (const h of without) flag(h, 'bad', stop(h) ? 'Its mover line does not reach the ring' : 'No mover stop');
      if (!some) rule('stops', 'Line 6', title, 'idle', 'A stop sits under the center of any tile the mover line touches.');
      else if (without.length) rule('stops', 'Line 6', title, 'bad', count(without.length, 'neighborhood has', 'neighborhoods have') + ' no stop on a line to the ring. Draw the mover line through ' + (without.length === 1 ? 'it' : 'them') + '.', without);
      else rule('stops', 'Line 6', title, 'ok', 'Every neighborhood has a stop under its center, on a line to the ring.');
    }

    // Lines 15, 16: schools under their caps, a seat for every pupil, inside the 30-minute walk.
    const school = {};
    for (const kind of SCHOOLS) {
      const more = stress.kids ? stress.kids[kind] || 0 : stress.children;      // a wave of children can sit in some grades only
      const spec = need(kind), each = pop1 * spec.grades * S.gradeShare * (1 + more);
      const places = hoods.filter(h => tiles[h].has && tiles[h].has[kind]).map(h => ({ key: h, cap: spec.cap }));
      const res = assign(hoods.map(h => ({ key: h, amount: each })), places, walk, C.longWalkMin + 1e-6);
      school[kind] = res;
      for (const p of places) (per[p.key].schools = per[p.key].schools || {})[kind] = { load: res.load[p.key], cap: spec.cap };
      for (const h of hoods) (per[h].goes = per[h].goes || {})[kind] = { to: res.goes[h], left: res.left[h], each };
      const out = hoods.filter(h => res.left[h] > 0.5), missing = out.reduce((t, h) => t + res.left[h], 0);
      const noun = NAME[kind].toLowerCase(), whose = kind === 'elementary' ? 'elementary' : kind + '-school';
      const title = 'Every ' + whose + ' pupil has a seat within a 30-minute walk';
      for (const h of out) flag(h, 'bad', num(res.left[h]) + ' ' + whose + ' pupils have no seat within a 30-minute walk');
      if (!some) rule(kind, 'Lines 15, 16', title, 'idle', 'A school of this kind holds at most ' + num(spec.cap) + ' pupils.');
      else if (!places.length) rule(kind, 'Lines 15, 16', title, 'bad', 'There is no ' + noun + ' yet. ' + num(each * hoods.length) + ' pupils have nowhere to go.', out);
      else if (out.length) rule(kind, 'Lines 15, 16', title, 'bad', num(missing) + ' pupils in ' + count(out.length, 'neighborhood', 'neighborhoods') + ' have no seat within a 30-minute walk. A school holds at most ' + num(spec.cap) + '.', out);
      else {
        let fullest = 0, longest = 0;
        for (const p of places) fullest = Math.max(fullest, res.load[p.key]);
        for (const h of hoods) for (const g of res.goes[h]) if (g.amount > 0.5) longest = Math.max(longest, g.minutes);
        rule(kind, 'Lines 15, 16', title, 'ok', count(places.length, 'school', 'schools') + ' for ' + num(each * hoods.length) + ' pupils. The fullest has ' + num(fullest) + ' of ' + num(spec.cap) + ' seats, and the longest walk is ' + num(longest) + ' minutes.');
      }
    }

    // Line 4: larger fields a slightly longer walk or a short ride away.
    const fields = hoods.filter(h => tiles[h].has && tiles[h].has.fields);
    {
      const title = 'Playing fields are a longer walk or a short ride away';
      for (const h of hoods) {
        let best = null;
        for (const f of fields) { const d = km(h, f); if (!best || d < best.d - 1e-9) best = { key: f, d }; }
        per[h].fields = best ? { key: best.key, walk: walk(h, best.key), segs: segs(h, best.key) } : null;
      }
      const far = hoods.filter(h => !per[h].fields || (per[h].fields.walk > FIELD_WALK + 1e-6 && per[h].fields.segs === null));
      if (!some) rule('fields', 'Line 4', title, 'idle', 'Fields sit beside a neighborhood and serve the ones around it.');
      else if (!fields.length) rule('fields', 'Line 4', title, 'bad', 'There are no playing fields yet.', []);
      else if (far.length) {
        for (const h of far) flag(h, 'bad', 'Fields are a ' + num(per[h].fields.walk) + '-minute walk away with no mover to them');
        rule('fields', 'Line 4', title, 'bad', count(far.length, 'neighborhood is', 'neighborhoods are') + ' more than a ' + FIELD_WALK + '-minute walk from fields and cannot ride to them.', far);
      } else rule('fields', 'Line 4', title, 'ok', count(fields.length, 'set', 'sets') + ' of fields. Every neighborhood is within a ' + FIELD_WALK + '-minute walk or a mover ride of one.');
    }

    // Trips over the real distances: walk inside the limit, bike some of what is bikeable, ride the rest if a mover runs.
    // A trip past its walk with no mover to take is stuck. A trip with no place to go to (no seat, no fields, no ring)
    // is counted apart, because the line it breaks is the one about that place.
    const total = { foot: 0, bike: 0, ride: 0, stuck: 0, nowhere: 0, noRide: 0, door: 0, inVehicle: 0 };
    const stuckBy = {}, blame = {};
    function leg(a, b, weight, limit, farEnd) {
      if (!(weight > 0)) return;
      const same = a === b;
      const w = same ? (farEnd ? ACROSS_TILE : IN_TILE) : km(a, b) * FOOT;
      const hopsBetween = same ? null : segs(a, b), canRide = hopsBetween !== null;
      let foot = 0, bike = 0, ride = 0, stuck = 0;
      if (w <= limit + 1e-6) {
        if (canRide) { foot = 1 - S.rideAnyway; ride = S.rideAnyway; } else { foot = 1; total.noRide += weight * S.rideAnyway; }
      } else {
        if (w * BIKE / FOOT <= S.bikeMaxMin + 1e-6) bike = (1 - S.rideAnyway) * C.bikeWilling;
        if (canRide) ride = 1 - bike; else stuck = 1 - bike;
      }
      total.foot += weight * foot; total.bike += weight * bike; total.ride += weight * ride;
      if (stuck > 0) {
        total.stuck += weight * stuck;
        stuckBy[a] = (stuckBy[a] || 0) + weight * stuck;
        // the tile to mark is the end with no stop; with a stop at both ends, the two lines do not meet
        const bare = [a, b].filter(k => !stop(k));
        for (const k of bare.length ? bare : [a, b]) blame[k] = (blame[k] || 0) + weight * stuck;
      }
      if (ride > 0) {
        const inVehicle = hopsBetween * STEP_KM / C.rideKmh * 60;
        total.inVehicle += weight * ride * inVehicle;
        total.door += weight * ride * (IN_TILE + C.waitMin + inVehicle + (farEnd ? IN_TILE : 0));
      }
    }
    for (const h of hoods) {
      total.foot += pop1 * SHARE.daily;
      total.noRide += pop1 * SHARE.daily * S.rideAnyway;
      for (const kind of SCHOOLS) {
        const g = per[h].goes[kind];
        for (const way of g.to) leg(h, way.to, pop1 * SHARE[kind] * way.amount / g.each, C.longWalkMin, false);
        if (g.left > 1e-9) total.nowhere += pop1 * SHARE[kind] * g.left / g.each;
      }
      if (per[h].fields) leg(h, per[h].fields.key, pop1 * SHARE.fields, FIELD_WALK, false); else total.nowhere += pop1 * SHARE.fields;
      if (ringOf[h]) { leg(h, ringOf[h], pop1 * SHARE.civic, S.walkMaxMin, false); leg(h, ringOf[h], pop1 * SHARE.office, C.longWalkMin, false); }
      else total.nowhere += pop1 * (SHARE.civic + SHARE.office);
      for (const j of hoods) {
        leg(h, j, pop1 * SHARE.otherWork / hoods.length, C.longWalkMin, true);
        leg(h, j, pop1 * SHARE.rest / hoods.length, S.walkMaxMin, true);
      }
      per[h].stuck = (stuckBy[h] || 0) / pop1;
    }
    {
      const title = 'No trip is left without a way';
      const share = pop > 0 ? total.stuck / pop : 0;
      const where = keys.filter(k => (blame[k] || 0) / pop1 > 0.001);
      if (!some) rule('ways', 'Line 17', title, 'idle', 'Past a 15-minute walk people take a mover, or a bike if it is near enough.');
      else if (share > 0.005) {
        for (const k of where) {
          const own = per[k].stuck || 0;
          flag(k, 'bad', own >= 0.0005 ? num(100 * own, own < 0.1 ? 1 : 0) + '% of its trips are past the walk with no mover to take' : 'Trips to it are past the walk, and no mover runs here');
        }
        rule('ways', 'Line 17', title, 'bad', num(100 * share, 1) + '% of trips are longer than people will walk and have no mover to take. Run the mover line to the tiles marked.', where);
      } else rule('ways', 'Line 17', title, 'ok', num(100 * total.foot / pop) + '% of trips are on foot, ' + num(100 * total.bike / pop) + '% by bike and ' + num(100 * total.ride / pop) + '% by mover.' + (total.nowhere / pop > 0.0005 ? ' Another ' + num(100 * total.nowhere / pop, 1) + '% have no place to go to.' : ''));
    }

    // Lines 20 to 22: power, water and waste, each with a plant on the sub level.
    const units = kind => of(kind).reduce((t, k) => t + tiles[k].n, 0);
    const modules = units('power'), peak = pop * PEAK_KW / 1000;
    const needModules = pop > 0 ? Math.ceil(peak / MODULE_MW - 1e-9) + 1 : 0;
    {
      const title = 'The reactors carry the peak with one module down';
      if (!some && !modules) rule('power', 'Lines 20, 21', title, 'idle', 'A module makes ' + MODULE_MW + ' MW. The city needs enough to carry its peak while one is down for fuel.');
      else if (modules < needModules) rule('power', 'Lines 20, 21', title, 'bad', (modules ? count(modules, 'module', 'modules') + ' cannot' : 'With no modules the city cannot') + ' carry a peak of ' + num(peak) + ' MW with one down for fuel. It takes ' + needModules + '.', of('power'));
      else rule('power', 'Lines 20, 21', title, 'ok', count(modules, 'module', 'modules') + '. With one down for fuel the rest give ' + num(Math.max(0, modules - 1) * MODULE_MW) + ' MW, against a peak of ' + num(peak) + ' MW.');
    }
    const serve = [
      ['water', 'Line 22', 'Everyone has treated drinking water', 'water plant', 'drinking water'],
      ['sewage', 'Line 22', 'All sewage is treated', 'sewage plant', 'sewage treatment'],
      ['waste', 'Line 22', 'Waste is sorted and food waste digested', 'waste works', 'sorting and digesting'],
    ];
    for (const [kind, lines, title, noun, what] of serve) {
      const n = units(kind), cap = n * PLANT_SERVES;
      if (!some && !n) rule(kind, lines, title, 'idle', 'One unit of a ' + noun + ' serves ' + num(PLANT_SERVES) + ' people.');
      else if (cap + 1e-6 < pop) rule(kind, lines, title, 'bad', (n ? count(n, 'unit serves', 'units serve') + ' ' + num(cap) + ' people' : 'There is no ' + noun + ' yet') + '. The city has ' + num(pop) + ', which takes ' + Math.ceil(pop / PLANT_SERVES - 1e-9) + '.', of(kind));
      else {
        let extra = '';
        if (kind === 'sewage' && modules) extra = ' It cleans ' + num(pop * SEWAGE_GAL / 1e6, 1) + ' million gallons a day, and cooling the reactors takes ' + num(modules * COOLING_MGD, 1) + '.';
        rule(kind, lines, title, 'ok', count(n, 'unit', 'units') + ' of ' + what + ' for ' + num(cap) + ' people.' + extra);
      }
    }
    {
      const title = 'Nothing is hauled on the surface';
      const plants = keys.filter(k => PLANTS.includes(tiles[k].kind));
      const loose = plants.filter(p => !hoods.concat(rings).some(t => segs(p, t) !== null));
      for (const p of loose) flag(p, 'bad', 'Not on the mover line, so nothing can reach it below ground');
      if (!plants.length || !some) rule('haul', 'Line 5', title, 'idle', 'Plants are reached through the sub level, so each needs the mover line.');
      else if (loose.length) rule('haul', 'Line 5', title, 'bad', count(loose.length, 'plant is', 'plants are') + ' off the mover line. With no trucks on the surface, nothing can reach ' + (loose.length === 1 ? 'it' : 'them') + '.', loose);
      else rule('haul', 'Line 5', title, 'ok', 'Every plant is on the mover line, so crews and freight reach it below ground.');
    }

    // What has been built, and how the city compares with a car city of the same size.
    const stops = keys.filter(stop).length, segments = Object.keys(state.lines).length;
    const hoodsWithStop = hoods.filter(stop).length;
    const riders = total.ride * base.tripsPerDay, vehicleTrips = riders / PER_VEHICLE;
    const inVehicle = total.ride > 0 ? total.inVehicle / total.ride : 0;
    const fleet = vehicleTrips * S.peakShare * (inVehicle + 2 * C.dwellMin) / 60 * (1 + C.emptyRunning) * (1 + C.reserve);
    const car = pop > 0 ? M.derive({ ...S, pop }, D.old) : null;
    const score = {
      pop, hoods: hoods.length, built: keys.length, acres: keys.length * TILE_ACRES,
      foot: pop > 0 ? total.foot / pop : 0, bike: pop > 0 ? total.bike / pop : 0, ride: pop > 0 ? total.ride / pop : 0,
      noRide: pop > 0 ? total.noRide / pop : 0, stuck: pop > 0 ? total.stuck / pop : 0, nowhere: pop > 0 ? total.nowhere / pop : 0,
      fleet, door: total.ride > 0 ? total.door / total.ride : 0,
      moverKm: segments * STEP_KM, walkwayKm: hoodsWithStop * WALKWAY_KM, pipeKm: hoods.length * PIPE_KM,
      stops, entries: hoods.length * ENTRIES, modules, peak,
      ringBuildings: rings.reduce((t, g) => t + tiles[g].n, 0),
      schools: Object.fromEntries(SCHOOLS.map(kind => [kind, hoods.filter(h => tiles[h].has && tiles[h].has[kind]).length])),
      fields: fields.length,
      units: Object.fromEntries(PLANTS.map(kind => [kind, units(kind)])),
      needModules, firmMW: Math.max(0, modules - 1) * MODULE_MW,
      car: car ? { acres: car.areaKm2 * 247.105, vehicles: car.fleet, ride: car.ride, foot: car.walk, bike: car.bike, door: car.doorMin, places: car.fleet * D.old.spacesPerVeh } : null,
    };
    score.subLevelKm = score.moverKm + score.walkwayKm;
    return { per, rules, score, stress, pop1 };
  }

  // The board as it stands (or under one stress), and how it holds at the edges of the stretch band.
  const TESTS = [
    { id: 'children', label: num(100 * BAND) + '% more children in the same homes', stress: { people: 0, children: BAND } },
    { id: 'fewer', label: num(100 * BAND) + '% fewer people', stress: { people: -BAND, children: 0 } },
    { id: 'more', label: num(100 * BAND) + '% more people on the same land', stress: { people: BAND, children: 0 } },
  ];
  // The stretches of line a repair might close for a year: those with a neighborhood at one end, or any at all if none has.
  function closable(state) {
    const edges = Object.keys(state.lines).sort();
    const felt = edges.filter(e => ends(e).some(k => state.tiles[k] && state.tiles[k].kind === 'hood'));
    return felt.length ? felt : edges;
  }
  // Of those, the ones with no way round them, the stretch that cuts off the most neighborhoods first.
  function bridges(state) {
    const next = {};
    for (const e of Object.keys(state.lines)) { const [a, b] = ends(e); (next[a] = next[a] || []).push({ to: b, e }); (next[b] = next[b] || []).push({ to: a, e }); }
    const side = (from, without) => {
      const seen = { [from]: true }, queue = [from];
      for (let i = 0; i < queue.length; i++) for (const n of next[queue[i]]) if (n.e !== without && !seen[n.to]) { seen[n.to] = true; queue.push(n.to); }
      return seen;
    };
    const is = (k, kind) => Boolean(state.tiles[k]) && state.tiles[k].kind === kind;
    const out = [];
    for (const e of closable(state)) {
      const [a, b] = ends(e), near = side(a, e);
      if (near[b]) continue;
      const sides = [Object.keys(near), Object.keys(side(b, e))].map(keys => ({ hoods: keys.filter(k => is(k, 'hood')).length, ring: keys.some(k => is(k, 'ring')) }));
      // the side cut off is the one without a ring; with a ring on both sides or on neither, the smaller one
      const cut = sides[0].ring !== sides[1].ring ? (sides[0].ring ? sides[1].hoods : sides[0].hoods) : Math.min(sides[0].hoods, sides[1].hoods);
      out.push({ edge: e, cut });
    }
    return out.sort((x, y) => y.cut - x.cut || (x.edge < y.edge ? -1 : 1));
  }

  // `now` is whatever the clock says is happening to the city this year. The stretch tests are always measured
  // from the city in an ordinary year, so they stay a forecast: if they all hold, nothing the clock deals can break a line.
  const RANK = { idle: 0, ok: 0, warn: 1, bad: 2 };
  const CLOSURE = { id: 'closure', label: 'one stretch of mover line closed for repairs' };
  function evaluate(state, showing, now) {
    const plain = evaluateCore(state, NONE), today = now ? evaluateCore(state, now) : plain;
    const was = {};
    for (const r of plain.rules) was[r.id] = RANK[r.status];
    // a line gives when the stretch leaves it worse off than it is in an ordinary year
    const given = then => then.rules.filter(r => RANK[r.status] > was[r.id]).map(r => ({ id: r.id, title: r.title, detail: r.detail, status: r.status }));
    const stretched = {};
    const tests = TESTS.map(t => {
      const then = stretched[t.id] = evaluateCore(state, t.stress);
      return { id: t.id, label: t.label, gives: given(then) };
    });
    // the fourth test: close the stretches with no way round them, worst first, until one breaks something
    const weak = bridges(state);
    let hit = null;
    for (const w of weak) {
      const then = evaluateCore(state, { people: 0, children: 0, closed: [w.edge] }), gives = given(then);
      if (gives.length) { hit = { then, gives, edge: w.edge }; break; }
    }
    if (hit) stretched.closure = hit.then;
    tests.push({ id: CLOSURE.id, label: CLOSURE.label, gives: hit ? hit.gives : [], edge: hit ? hit.edge : null, weak: weak.length, lines: Object.keys(state.lines).length });
    const shown = stretched[showing] || today;
    return { ...shown, tests, showing: stretched[showing] ? showing : null, today: today.score };
  }

  // One click with one tool. Returns the new board, a sentence about what happened, and where a mover line continues from.
  function act(state, tool, k, from) {
    const t = state.tiles[k];
    const next = { tiles: { ...state.tiles }, lines: { ...state.lines } };
    const done = (said, nextFrom) => ({ state: next, said, changed: true, from: nextFrom === undefined ? null : nextFrom });
    const no = (said, nextFrom) => ({ state, said, changed: false, from: nextFrom === undefined ? null : nextFrom });
    if (tool === 'hood') {
      if (t) return no('That tile already holds ' + (t.kind === 'hood' ? 'a neighborhood' : 'something else') + '.');
      next.tiles[k] = { kind: 'hood', has: {} };
      return done('A neighborhood of ' + num(HOOD) + ' people.');
    }
    if (tool === 'ring') {
      if (!t) { next.tiles[k] = { kind: 'ring', n: 1 }; return done('A ring begins, with one 25-story building.'); }
      if (t.kind !== 'ring') return no('A ring needs open ground.');
      if (t.n >= 40) return no('That ring has no room for another building.');
      next.tiles[k] = { ...t, n: t.n + 1 };
      return done('The ring has ' + (t.n + 1) + ' buildings.');
    }
    if (EXTRAS.includes(tool)) {
      if (!t || t.kind !== 'hood') return no(tool === 'fields' ? 'Playing fields go beside a neighborhood. Click one.' : 'A school goes in a neighborhood. Click one.');
      const has = { ...t.has };
      if (has[tool]) delete has[tool]; else has[tool] = true;
      next.tiles[k] = { ...t, has };
      return done(has[tool] ? NAME[tool] + ' added.' : NAME[tool] + ' removed.');
    }
    if (PLANTS.includes(tool)) {
      if (!t) { next.tiles[k] = { kind: tool, n: 1 }; return done(tool === 'power' ? 'A reactor site with one ' + MODULE_MW + ' MW module.' : NAME[tool] + ' with one unit, for ' + num(PLANT_SERVES) + ' people.'); }
      if (t.kind !== tool) return no('That tile is taken. A plant needs open ground.');
      if (t.n >= 12) return no('That site is full.');
      next.tiles[k] = { ...t, n: t.n + 1 };
      return done(tool === 'power' ? (t.n + 1) + ' modules on this site.' : (t.n + 1) + ' units at this plant.');
    }
    if (tool === 'line') {
      if (!from || from === k || !adjacent(from, k)) return no(from && from !== k ? 'The line runs between neighboring tiles. Starting again from here.' : 'Now click a neighboring tile to run the line to it.', k);
      const e = edge(from, k);
      if (next.lines[e]) { delete next.lines[e]; return done('That stretch of mover line is removed.', k); }
      next.lines[e] = true;
      return done('Mover line laid. Click the next tile to carry on.', k);
    }
    if (tool === 'erase') {
      if (!t) {
        const touching = Object.keys(state.lines).filter(e => ends(e).includes(k));
        if (!touching.length) return no('Nothing to remove there.');
        for (const e of touching) delete next.lines[e];
        return done('The mover line through that tile is removed.');
      }
      if ((t.kind === 'ring' || PLANTS.includes(t.kind)) && t.n > 1) { next.tiles[k] = { ...t, n: t.n - 1 }; return done('One removed. ' + (t.n - 1) + ' left.'); }
      delete next.tiles[k];
      return done(NAME[t.kind] + ' removed.');
    }
    return no('');
  }

  // The ledger's city of 50,000, laid out: a ring, ten neighborhoods, their schools, the line and the plants.
  function starter() {
    const tiles = {}, lines = {};
    const hood = (q, r, ...has) => { tiles[key(q, r)] = { kind: 'hood', has: Object.fromEntries(has.map(h => [h, true])) }; };
    const line = (a, b) => { lines[edge(key(a[0], a[1]), key(b[0], b[1]))] = true; };
    tiles[key(0, 0)] = { kind: 'ring', n: 8 };
    hood(1, 0, 'elementary', 'middle'); hood(0, 1, 'elementary'); hood(-1, 1, 'elementary', 'middle');
    hood(-1, 0, 'elementary'); hood(0, -1, 'elementary', 'middle'); hood(1, -1);
    hood(2, -1, 'elementary', 'high', 'fields'); hood(1, 1, 'elementary'); hood(-2, 1, 'elementary', 'high', 'fields'); hood(-1, -1, 'elementary');
    for (const [q, r] of [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]]) line([0, 0], [q, r]);
    line([1, 0], [2, -1]); line([0, 1], [1, 1]); line([-1, 1], [-2, 1]); line([-1, 0], [-1, -1]);
    tiles[key(3, -1)] = { kind: 'power', n: 3 }; tiles[key(3, -2)] = { kind: 'water', n: 1 };
    tiles[key(-3, 1)] = { kind: 'sewage', n: 1 }; tiles[key(-3, 2)] = { kind: 'waste', n: 1 };
    line([2, -1], [3, -1]); line([2, -1], [3, -2]); line([-2, 1], [-3, 1]); line([-2, 1], [-3, 2]);
    return { tiles, lines };
  }
  const empty = () => ({ tiles: {}, lines: {} });

  // Anything loaded from storage is rebuilt from scratch, keeping only what the board allows.
  function clean(raw) {
    const out = empty();
    if (!raw || typeof raw !== 'object') return null;
    const tiles = raw.tiles && typeof raw.tiles === 'object' ? raw.tiles : {}, lines = raw.lines && typeof raw.lines === 'object' ? raw.lines : {};
    const valid = allTiles();
    for (const k of Object.keys(tiles)) {
      const t = tiles[k];
      if (!valid.includes(k) || !t || typeof t !== 'object') continue;
      if (t.kind === 'hood') { const has = {}; for (const x of EXTRAS) if (t.has && t.has[x]) has[x] = true; out.tiles[k] = { kind: 'hood', has }; }
      else if (t.kind === 'ring' || PLANTS.includes(t.kind)) out.tiles[k] = { kind: t.kind, n: Math.max(1, Math.min(t.kind === 'ring' ? 40 : 12, Math.round(Number(t.n) || 1))) };
    }
    for (const e of Object.keys(lines)) { if (e.indexOf('|') < 0) continue; const [a, b] = ends(e); if (valid.includes(a) && valid.includes(b) && adjacent(a, b)) out.lines[edge(a, b)] = true; }
    return out;
  }

  return {
    evaluate, act, starter, empty, clean, assign, closable, bridges, allTiles, neighbors, adjacent, at, key, ends, km,
    BOARD, HOOD, TILE_KM, STEP_KM, TILE_ACRES, IN_TILE, FOOT, LONG_KM, RING_SERVES, MODULE_MW, PEAK_KW, PLANT_SERVES, FIELD_WALK, BAND,
    SCHOOLS, EXTRAS, PLANTS, NAME, SHARE, TESTS, base, need,
  };
})();
if (typeof module !== 'undefined') module.exports = CityGame;
