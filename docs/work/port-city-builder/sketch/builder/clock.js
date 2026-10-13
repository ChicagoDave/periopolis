// Time for the builder. Crews turn orders into buildings over years, people move in as their homes are finished,
// and the stretches line 18 allows for happen to the city on a timeline dealt at the start of a run.
// A game is { state, clock }: state is what stands, clock holds the year, the work in hand, the events and the record.
// Every function returns new objects and leaves what it was given alone. Nothing in here draws.
const CityClock = (() => {
  const G = CityGame;
  const YEARS = 20;                                         // line 21's horizon
  const CREWS = 10;                                         // assumed: enough to build the ledger's city of 50,000 in eight years
  // Years of one crew's work, assumed. A crew is whatever it takes to finish a neighborhood in two years.
  const BUILD = { hood: 2, ring: 2, elementary: 1, middle: 1, high: 2, fields: 1, line: 1, power: 1, water: 2, sewage: 2, waste: 2 };
  const FIRST_MODULE = 3;                                   // a reactor site with its first module: NuScale targets 30 to 39 months
  const NAME = {
    hood: 'neighborhood', ring: 'ring building', elementary: 'elementary school', middle: 'middle school', high: 'high school',
    fields: 'playing fields', line: 'stretch of mover line', power: 'reactor module', water: 'water plant unit', sewage: 'sewage plant unit', waste: 'waste works unit',
  };
  const MANY = {
    hood: 'neighborhoods', ring: 'ring buildings', elementary: 'elementary schools', middle: 'middle schools', high: 'high schools',
    fields: 'sets of playing fields', line: 'stretches of mover line', power: 'reactor modules', water: 'water plant units', sewage: 'sewage plant units', waste: 'waste works units',
  };
  const EXTRA = G.EXTRAS;                                   // what stands in a neighborhood and opens with it
  const GRADES = { elementary: [0, 5], middle: [6, 8], high: [9, 12] };
  const WAVE = 13;                                          // years until the last child of a K to 5 wave has left high school
  const BAND = G.BAND;

  // ---- a board as a bag of pieces, "what@where" -> how many ----
  const id = (what, at) => what + '@' + at;
  const split = key => { const i = key.indexOf('@'); return [key.slice(0, i), key.slice(i + 1)]; };
  function pieces(state) {
    const bag = {};
    const put = (what, at, n) => { bag[id(what, at)] = (bag[id(what, at)] || 0) + n; };
    for (const k of Object.keys(state.tiles)) {
      const t = state.tiles[k];
      if (t.kind === 'hood') { put('hood', k, 1); for (const x of EXTRA) if (t.has[x]) put(x, k, 1); }
      else put(t.kind, k, t.n);
    }
    for (const e of Object.keys(state.lines)) put('line', e, 1);
    return bag;
  }
  const copy = state => ({ tiles: { ...state.tiles }, lines: { ...state.lines } });
  // Puts one piece on a board that is ours to change. False when it has nowhere to stand yet.
  function add(state, what, at) {
    if (what === 'line') { state.lines[at] = true; return true; }
    const t = state.tiles[at];
    if (what === 'hood') { if (t) return false; state.tiles[at] = { kind: 'hood', has: {} }; return true; }
    if (EXTRA.includes(what)) { if (!t || t.kind !== 'hood') return false; state.tiles[at] = { kind: 'hood', has: { ...t.has, [what]: true } }; return true; }
    if (t && t.kind !== what) return false;
    state.tiles[at] = { kind: what, n: t ? t.n + 1 : 1 };
    return true;
  }
  function remove(state, what, at) {
    if (what === 'line') { delete state.lines[at]; return; }
    const t = state.tiles[at];
    if (!t) return;
    if (what === 'hood') { if (t.kind === 'hood') delete state.tiles[at]; return; }
    if (EXTRA.includes(what)) {
      if (t.kind !== 'hood' || !t.has[what]) return;
      const has = { ...t.has };
      delete has[what];
      state.tiles[at] = { kind: 'hood', has };
      return;
    }
    if (t.kind !== what) return;
    if (t.n > 1) state.tiles[at] = { kind: what, n: t.n - 1 }; else delete state.tiles[at];
  }
  // The board as it will stand when all the work in hand is done. Neighborhoods go in before what stands in them.
  function planned(state, jobs) {
    const plan = copy(state);
    for (const j of jobs) if (!EXTRA.includes(j.what)) add(plan, j.what, j.at);
    for (const j of jobs) if (EXTRA.includes(j.what)) add(plan, j.what, j.at);
    return plan;
  }

  // ---- the timeline ----
  function dice(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // Five things happen in twenty years, each announced ahead of time. Each is one of the four stretch tests come true:
  // the squeeze is over before the wave of children arrives, so no two of them ever push the same line past the band.
  function begin(seed) {
    const roll = dice(seed), pick = (a, b) => a + Math.floor(roll() * (b - a + 1));
    const events = [
      { id: 1, type: 'squeeze', start: pick(4, 5), lasts: 3, notice: 2 },
      { id: 2, type: 'closure', start: pick(6, 9), lasts: 1, notice: 1 },
      { id: 3, type: 'families', start: pick(8, 9), lasts: WAVE, notice: 2 },
      { id: 4, type: 'closure', start: pick(12, 18), lasts: 1, notice: 1 },
      { id: 5, type: 'slump', start: pick(14, 15), lasts: 4, notice: 2 },
    ];
    return { year: 0, seed: seed >>> 0, jobs: [], events, record: [], lineYears: 0 };
  }
  // The share of a school's grades that the wave fills, t years after it arrived in grades K to 5.
  function waveIn(kind, t) {
    const [lo, hi] = GRADES[kind];
    return Math.max(0, Math.min(hi, t + 5) - Math.max(lo, t) + 1) / (hi - lo + 1);
  }
  const active = (e, year) => year >= e.start && year < e.start + e.lasts;
  const announced = (e, year) => year >= e.start - e.notice && year < e.start;
  // What is happening to the city in a given year, as the stress the rules are checked under.
  function stressAt(clock, year = clock.year) {
    const stress = { people: 0, children: 0, kids: { elementary: 0, middle: 0, high: 0 }, closed: [] };
    for (const e of clock.events) {
      if (!active(e, year)) continue;
      if (e.type === 'families') for (const kind of G.SCHOOLS) stress.kids[kind] = BAND * waveIn(kind, year - e.start);
      else if (e.type === 'squeeze') stress.people = BAND;
      else if (e.type === 'slump') stress.people = -BAND;
      else if (e.type === 'closure' && e.edge) stress.closed.push(e.edge);
    }
    return stress;
  }
  const pc = x => Math.round(100 * x) + '%';
  // What the player is told: what is happening now, and what has been announced.
  function notices(clock) {
    const out = [], year = clock.year;
    for (const e of clock.events) {
      const now = active(e, year), soon = announced(e, year);
      if (!now && !soon) continue;
      if (e.type === 'closure' && !e.edge) continue;         // there was no line to close
      const until = e.start + e.lasts, last = until - 1;     // the first year it is over, and the last year it runs
      let text;
      if (e.type === 'families') {
        if (soon) text = 'Year ' + e.start + ': a wave of young families. ' + pc(BAND) + ' more children, first in the elementary schools, then moving up a grade a year.';
        else {
          const k = stressAt(clock).kids, parts = G.SCHOOLS.filter(s => k[s] > 0.0005).map(s => G.NAME[s].toLowerCase() + 's +' + pc(k[s]));
          text = 'The wave of children: ' + parts.join(', ') + '. ' + (until > YEARS ? 'It outlasts the run.' : 'The last of them are out of high school by year ' + until + '.');
        }
      } else if (e.type === 'squeeze') text = soon ? 'Year ' + e.start + ': a housing squeeze. ' + pc(BAND) + ' more people in the same homes for ' + e.lasts + ' years.' : 'A housing squeeze: ' + pc(BAND) + ' more people in the same homes, through year ' + last + '.';
      else if (e.type === 'slump') text = soon ? 'Year ' + e.start + ': a slump. ' + pc(BAND) + ' fewer people for ' + e.lasts + ' years.' : 'A slump: ' + pc(BAND) + ' fewer people, through year ' + last + '.';
      else text = soon ? 'Year ' + e.start + ': a stretch of mover line closes for a year of repairs.' : 'A stretch of mover line is closed this year for repairs.';
      out.push({ id: e.id, type: e.type, when: now ? 'now' : 'soon', start: e.start, until, text, edge: e.type === 'closure' ? e.edge : null });
    }
    return out;
  }

  // ---- work in hand ----
  // Jobs are worked on in the order they stand: the first CREWS of them with work left have a crew.
  function inHand(game) {
    const out = { sites: {}, extras: {}, more: {}, lines: {}, list: [], working: 0, waiting: 0, crews: CREWS };
    if (!game.clock) return out;
    game.clock.jobs.forEach((j, index) => {
      const status = j.left <= 0 ? 'ready' : out.working < CREWS ? 'working' : 'waiting';
      if (status === 'working') out.working++; else if (status === 'waiting') out.waiting++;
      const item = { index, what: j.what, at: j.at, left: j.left, total: j.total, status };
      out.list.push(item);
      if (j.what === 'line') out.lines[j.at] = item;
      else if (EXTRA.includes(j.what)) (out.extras[j.at] = out.extras[j.at] || {})[j.what] = item;
      else if (game.state.tiles[j.at]) out.more[j.at] = (out.more[j.at] || 0) + 1;
      else {
        const s = out.sites[j.at];
        if (!s) out.sites[j.at] = { kind: j.what, n: 1, left: j.left, status };
        else { s.n++; if (status === 'working' && (s.status !== 'working' || j.left < s.left)) { s.left = j.left; s.status = status; } }
      }
    });
    return out;
  }
  const years = n => n + (n === 1 ? ' year' : ' years');
  // One click while the clock runs. The move is made on the plan, and what changed becomes a job or cancels one.
  function order(game, tool, k, from) {
    const before = planned(game.state, game.clock.jobs);
    const res = G.act(before, tool, k, from);
    if (!res.changed) return { game, said: res.said, changed: false, from: res.from };
    const was = pieces(before), will = pieces(res.state), keys = Object.keys({ ...was, ...will });
    const state = copy(game.state), jobs = game.clock.jobs.slice(), said = [];
    // what went: work in hand is canceled, the latest first; otherwise the thing itself comes down
    for (const key of keys) {
      const [what, at] = split(key);
      for (let n = (was[key] || 0) - (will[key] || 0); n > 0; n--) {
        let i = jobs.length - 1;
        while (i >= 0 && !(jobs[i].what === what && jobs[i].at === at)) i--;
        if (i >= 0) { jobs.splice(i, 1); said.push('Canceled: ' + NAME[what] + '.'); }
        else { remove(state, what, at); said.push('Taken down: ' + NAME[what] + '.'); }
      }
    }
    for (const key of keys) {
      const [what, at] = split(key);
      for (let n = (will[key] || 0) - (was[key] || 0); n > 0; n--) {
        const total = what === 'power' && !was[key] ? FIRST_MODULE : BUILD[what];
        const starts = jobs.filter(j => j.left > 0).length < CREWS;
        jobs.push({ what, at, left: total, total });
        said.push('Ordered: ' + NAME[what] + (what === 'power' && !was[key] ? ', with its site' : '') + '. ' + years(total) + ' of work, ' + (starts ? 'starting now.' : 'once a crew is free.'));
      }
    }
    return { game: { state, clock: { ...game.clock, jobs } }, said: said.join(' '), changed: true, from: res.from };
  }
  // Drop one job. Of several alike on one tile the latest goes, so a reactor site is the last of its jobs to be dropped.
  // A neighborhood takes with it whatever was ordered to stand in it.
  function cancel(game, index) {
    const j = game.clock.jobs[index];
    if (!j) return game;
    let last = index;
    game.clock.jobs.forEach((x, i) => { if (x.what === j.what && x.at === j.at) last = i; });
    const jobs = game.clock.jobs.filter((x, i) => i !== last && !(j.what === 'hood' && x.at === j.at && EXTRA.includes(x.what)));
    return { state: game.state, clock: { ...game.clock, jobs } };
  }
  // Put one job at the head of the list. Whatever loses its crew keeps the work already done on it.
  function first(game, index) {
    const j = game.clock.jobs[index];
    if (!j) return game;
    return { state: game.state, clock: { ...game.clock, jobs: [j].concat(game.clock.jobs.filter((x, i) => i !== index)) } };
  }

  function pickEdge(state, seed, eventId) {
    const from = G.closable(state);
    return from.length ? from[Math.floor(dice(seed + 7919 * eventId)() * from.length)] : null;
  }
  // The city as it stands in one year: who lives there, how many homes there are, and which lines are broken.
  function seenIn(state, stress, year, opened) {
    const ev = G.evaluate(state, null, stress), t = { ok: 0, warn: 0, bad: 0, idle: 0 };
    for (const r of ev.rules) t[r.status]++;
    return { year, pop: ev.score.pop, homes: ev.score.hoods * G.HOOD, held: t.ok, warn: t.warn, bad: t.bad, broken: ev.rules.filter(r => r.status === 'bad').map(r => r.id), opened };
  }
  // A school waits for its neighborhood, and a further reactor module for its site. Neither takes a crew while it waits.
  const waitsFor = j => EXTRA.includes(j.what) ? 'hood' : (j.what === 'power' && j.total < FIRST_MODULE) ? 'power' : null;
  // One year passes: the crews work, what is finished opens, and the city is checked as it stands that year.
  function tick(game) {
    const clock = game.clock;
    if (clock.year >= YEARS) return game;
    const year = clock.year + 1, state = copy(game.state), jobs = clock.jobs.map(j => ({ ...j })), opened = {};
    let crews = CREWS;
    for (const j of jobs) if (j.left > 0 && crews > 0) { j.left -= 1; crews--; }
    const open = j => { add(state, j.what, j.at); opened[j.what] = (opened[j.what] || 0) + 1; };
    for (const j of jobs) if (j.left <= 0 && !waitsFor(j)) open(j);
    const ready = j => { const host = state.tiles[j.at]; return Boolean(host) && host.kind === waitsFor(j); };
    const still = [];
    for (const j of jobs) {
      if (j.left <= 0 && !waitsFor(j)) continue;
      if (j.left <= 0 && ready(j)) open(j); else still.push(j);
    }
    const events = clock.events.map(e => (e.type === 'closure' && e.edge === undefined && year >= e.start - e.notice) ? { ...e, edge: pickEdge(state, clock.seed, e.id) } : e);
    const next = { ...clock, year, jobs: still, events };
    const row = seenIn(state, stressAt(next), year, opened);
    next.record = clock.record.concat([row]);
    next.lineYears = clock.lineYears + row.bad;
    return { state, clock: next };
  }
  // Start a run on whatever stands. Year 0 is noted in the record, and does not count.
  function start(state, seed) {
    const clock = begin(seed);
    clock.record = [seenIn(state, stressAt(clock), 0, {})];
    return { state, clock };
  }
  // Stop the clock: the work in hand is finished at once, and the board is a plain plan again.
  const stop = game => ({ state: game.clock ? planned(game.state, game.clock.jobs) : game.state, clock: null });

  const sentence = bag => Object.keys(bag).map(what => bag[what] + ' ' + (bag[what] === 1 ? NAME[what] : MANY[what])).join(', ');

  // Anything read back from storage is rebuilt piece by piece, keeping only what a clock can hold.
  function clean(raw, state) {
    if (!raw || typeof raw !== 'object') return null;
    const whole = (x, lo, hi) => Number.isFinite(x) && Math.round(x) === x && x >= lo && x <= hi;
    if (!whole(raw.year, 0, YEARS) || !Number.isFinite(raw.seed)) return null;
    const tiles = G.allTiles(), types = ['families', 'closure', 'squeeze', 'slump'];
    const edgeOk = e => typeof e === 'string' && e.indexOf('|') > 0 && G.ends(e).every(k => tiles.includes(k)) && G.adjacent(G.ends(e)[0], G.ends(e)[1]);
    const jobs = [];
    for (const j of Array.isArray(raw.jobs) ? raw.jobs : []) {
      if (!j || !(j.what in BUILD) || !whole(j.left, 0, FIRST_MODULE) || !whole(j.total, 1, FIRST_MODULE)) continue;
      if (j.what === 'line' ? !edgeOk(j.at) : !tiles.includes(j.at)) continue;
      jobs.push({ what: j.what, at: j.at, left: j.left, total: j.total });
    }
    // a job that could never open, because the board has no place for it, is dropped
    const plan = copy(state), kept = [];
    for (const j of jobs) if (!EXTRA.includes(j.what) && add(plan, j.what, j.at)) kept.push(j);
    for (const j of jobs) if (EXTRA.includes(j.what) && !(plan.tiles[j.at] && plan.tiles[j.at].has && plan.tiles[j.at].has[j.what]) && add(plan, j.what, j.at)) kept.push(j);
    const inOrder = jobs.filter(j => kept.includes(j));
    const events = [];
    for (const e of Array.isArray(raw.events) ? raw.events : []) {
      if (!e || !types.includes(e.type) || !whole(e.id, 1, 99) || !whole(e.start, 1, YEARS) || !whole(e.lasts, 1, YEARS) || !whole(e.notice, 0, 5)) continue;
      const out = { id: e.id, type: e.type, start: e.start, lasts: e.lasts, notice: e.notice };
      if (e.type === 'closure' && e.edge !== undefined) out.edge = edgeOk(e.edge) ? e.edge : null;
      events.push(out);
    }
    const record = [];
    for (const r of Array.isArray(raw.record) ? raw.record : []) {
      if (!r || !whole(r.year, 0, YEARS) || !Number.isFinite(r.pop) || !whole(r.bad, 0, 99)) continue;
      const opened = {};
      if (r.opened && typeof r.opened === 'object') for (const what of Object.keys(BUILD)) if (whole(r.opened[what], 1, 999)) opened[what] = r.opened[what];
      record.push({ year: r.year, pop: r.pop, homes: Number.isFinite(r.homes) ? r.homes : r.pop, held: whole(r.held, 0, 99) ? r.held : 0, warn: whole(r.warn, 0, 99) ? r.warn : 0, bad: r.bad, broken: Array.isArray(r.broken) ? r.broken.filter(x => typeof x === 'string').slice(0, 40) : [], opened });
    }
    return { year: raw.year, seed: raw.seed >>> 0, jobs: inOrder, events, record, lineYears: record.filter(r => r.year > 0).reduce((t, r) => t + r.bad, 0) };
  }

  return { YEARS, CREWS, BUILD, FIRST_MODULE, NAME, MANY, start, stop, order, cancel, first, tick, inHand, planned, stressAt, notices, waveIn, sentence, clean, pieces };
})();
if (typeof module !== 'undefined') module.exports = CityClock;
