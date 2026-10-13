// Runs the clock outside a page: the mechanics one at a time, then two whole runs of twenty years.
const fs = require('fs'), vm = require('vm');
const ctx = { console };
vm.createContext(ctx);
const src = f => fs.readFileSync(__dirname + '/' + f, 'utf8');
vm.runInContext(src('../ledger/model.js') + '\n' + src('engine.js') + '\n' + src('clock.js') + '\nthis.G = CityGame; this.C = CityClock;', ctx);
const G = ctx.G, C = ctx.C;
let fails = 0;
const check = (label, ok, extra) => { if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + label + (extra ? ' :: ' + extra : '')); };
const jobsLine = g => C.inHand(g).list.map(j => j.what + '@' + j.at + ':' + j.left + (j.status === 'working' ? '' : '(' + j.status + ')')).join('  ');

// ---- mechanics ----
let g = C.start(G.empty(), 1), from = null;
const click = (tool, k) => { const r = C.order(g, tool, k, from); g = r.game; if (tool === 'line') from = r.from; return r; };
const line = (a, b) => { from = null; click('line', a); return click('line', b); };
check('a run starts at year 0 with a year-0 row', g.clock.year === 0 && g.clock.record.length === 1 && g.clock.record[0].year === 0);
let r = click('power', '3,-1');
check('the first module takes its site: 3 years', g.clock.jobs[0].total === 3, r.said);
r = click('power', '3,-1');
check('the second module takes 1 year', g.clock.jobs[1].total === 1, r.said);
click('hood', '1,0'); r = click('elementary', '1,0');
check('a school can be ordered on a building site', g.clock.jobs.length === 4 && r.changed, r.said);
check('nothing stands yet', Object.keys(g.state.tiles).length === 0);
g = C.tick(g);
check('year 1: the school is ready and waits for its homes', C.inHand(g).list.some(j => j.what === 'elementary' && j.status === 'ready') && !g.state.tiles['1,0'], jobsLine(g));
check('year 1: the second module is ready but waits for its site', !g.state.tiles['3,-1'] && C.inHand(g).list.some(j => j.what === 'power' && j.status === 'ready'));
g = C.tick(g);
check('year 2: the neighborhood opens with its school', g.state.tiles['1,0'] && g.state.tiles['1,0'].has.elementary === true && g.clock.record[2].pop === 5000, JSON.stringify(g.clock.record[2]));
g = C.tick(g);
check('year 3: two modules stand', g.state.tiles['3,-1'].n === 2 && g.clock.jobs.length === 0);
check('line-years add up the broken lines of years 1 on', g.clock.lineYears === g.clock.record.filter(x => x.year > 0).reduce((t, x) => t + x.bad, 0) && g.clock.lineYears > 0, 'lineYears ' + g.clock.lineYears + ', broken in year 3: ' + g.clock.record[3].broken.join(' '));

// crews: twelve one-year jobs, ten crews
g = C.start(G.empty(), 1);
const ringTiles = ['1,0', '1,-1', '0,-1', '-1,0', '-1,1', '0,1'];
for (const k of ringTiles) line('0,0', k);
for (let i = 0; i < 6; i++) line(ringTiles[i], ringTiles[(i + 1) % 6]);
let hand = C.inHand(g);
check('twelve jobs, ten crews: ten working, two waiting', hand.working === 10 && hand.waiting === 2);
const lastIndex = g.clock.jobs.length - 1, lastAt = g.clock.jobs[lastIndex].at;
g = C.first(g, lastIndex);
check('first() puts a waiting job at the head', g.clock.jobs[0].at === lastAt && C.inHand(g).list[0].status === 'working' && C.inHand(g).list[10].status === 'waiting');
g = C.tick(g);
check('after a year ten stretches stand and two are being built', Object.keys(g.state.lines).length === 10 && C.inHand(g).working === 2);
r = line('0,0', '1,0');
check('clicking a finished stretch again takes it down', r.said.indexOf('Taken down') === 0 && Object.keys(g.state.lines).length === 9, r.said);
const pendingAt = g.clock.jobs[0].at, ends = G.ends(pendingAt);
r = line(ends[0], ends[1]);
check('clicking a stretch in hand cancels it', r.said.indexOf('Canceled') === 0 && g.clock.jobs.length === 1, r.said);

// cancel: a neighborhood takes its schools with it; a reactor site goes last
g = C.start(G.empty(), 1);
click('hood', '2,0'); click('elementary', '2,0'); click('high', '2,0'); click('power', '3,0'); click('power', '3,0');
g = C.cancel(g, 3);
check('cancelling the site job drops the later module instead', g.clock.jobs.filter(j => j.what === 'power').length === 1 && g.clock.jobs.find(j => j.what === 'power').total === 3);
g = C.cancel(g, 0);
check('cancelling a neighborhood drops its schools', g.clock.jobs.length === 1 && g.clock.jobs[0].what === 'power');
r = click('erase', '3,0');
check('erase on a site cancels the work', g.clock.jobs.length === 0, r.said);

// the wave, grade by grade
console.log('\nwave of children, share of each school\'s grades it fills, by years since it arrived:');
for (const kind of G.SCHOOLS) console.log('  ' + kind.padEnd(11), Array.from({ length: 14 }, (x, t) => C.waveIn(kind, t).toFixed(2)).join(' '));
check('the wave fills elementary at first and is gone after 13 years', C.waveIn('elementary', 0) === 1 && C.waveIn('middle', 0) === 0 && C.waveIn('high', 12) === 0.25 && G.SCHOOLS.every(k => C.waveIn(k, 13) === 0));

// timelines
console.log('\ntimelines:');
for (const seed of [1, 2, 3, 4, 5]) console.log('  seed', seed, C.start(G.empty(), seed).clock.events.map(e => e.type + ' y' + e.start + (e.lasts > 1 ? '-' + (e.start + e.lasts - 1) : '')).join(', '));

// storage round trip
g = C.start(G.starter(), 7);
click('hood', '2,0'); click('elementary', '2,0'); line('1,0', '2,0'); click('ring', '0,0');
for (let i = 0; i < 9; i++) g = C.tick(g);
const back = C.clean(JSON.parse(JSON.stringify(g.clock)), g.state);
check('a saved clock comes back the same', JSON.stringify(back) === JSON.stringify(g.clock), back ? '' : 'null');
check('rubbish is refused', C.clean({ year: 99 }, g.state) === null && C.clean('x', g.state) === null);
const dirty = C.clean({ year: 3, seed: 5, jobs: [{ what: 'zoo', at: '0,0', left: 1, total: 1 }, { what: 'hood', at: '9,9', left: 1, total: 2 }, { what: 'elementary', at: '4,0', left: 1, total: 1 }, { what: 'line', at: '0,0|3,3', left: 1, total: 1 }, { what: 'hood', at: '4,-4', left: 2, total: 2 }], events: [{ id: 1, type: 'plague', start: 3, lasts: 1, notice: 1 }], record: [] }, g.state);
check('a dirty clock keeps only what can stand', dirty.jobs.length === 1 && dirty.jobs[0].at === '4,-4' && dirty.events.length === 0, JSON.stringify(dirty.jobs));

// ---- the fourth stretch test, and the promise that the tests are the forecast ----
{
  const plain = G.starter(), test = s => G.evaluate(s, null).tests.find(t => t.id === 'closure');
  const t1 = test(plain);
  check('the ledger\'s spokes give when a stretch closes', t1.gives.length > 0 && t1.weak > 0, t1.weak + ' of ' + t1.lines + ' stretches have no way round; closing ' + t1.edge + ' gives: ' + t1.gives.map(x => x.id).join(' '));
  let looped = plain;
  const lay = (a, b) => { let res = G.act(looped, 'line', a, null); res = G.act(res.state, 'line', b, res.from); looped = res.state; };
  const inner = ['1,0', '1,-1', '0,-1', '-1,0', '-1,1', '0,1'];
  for (let i = 0; i < 6; i++) lay(inner[i], inner[(i + 1) % 6]);
  lay('2,-1', '1,-1'); lay('1,1', '1,0'); lay('-2,1', '-1,0'); lay('-1,-1', '0,-1'); lay('3,-1', '3,-2'); lay('-3,1', '-3,2');
  const t2 = test(looped), all = G.evaluate(looped, null);
  check('twelve more stretches give every stop a second way', t2.gives.length === 0 && t2.weak === 0 && Object.keys(looped.lines).length === 26, 'bridges left: ' + G.bridges(looped).map(b => b.edge).join(' '));
  check('and all four tests hold on it', all.tests.every(t => t.gives.length === 0) && all.rules.every(x => x.status === 'ok' || x.id === 'size'));
  // so nothing the clock deals can break a line, on any timeline
  let worst = 0;
  for (let seed = 1; seed <= 25; seed++) { let run = C.start(looped, seed); while (run.clock.year < C.YEARS) run = C.tick(run); worst = Math.max(worst, run.clock.lineYears); }
  check('left alone for twenty years on 25 timelines, the looped city never breaks a line', worst === 0, 'worst run: ' + worst + ' broken line-years');
}

// ---- run 1: the ledger's city, left alone for twenty years ----
function show(label, game) {
  const titles = {};
  for (const x of G.evaluate(game.state, null).rules) titles[x.id] = x.title;
  console.log('\n== ' + label + ' ==');
  console.log('  events:', game.clock.events.map(e => e.type + ' y' + e.start + (e.edge ? ' ' + e.edge : '')).join(', '));
  for (const row of game.clock.record) console.log('  y' + String(row.year).padStart(2), String(row.pop).padStart(7), 'people | broken', row.bad, row.broken.length ? '[' + row.broken.join(' ') + ']' : '', Object.keys(row.opened).length ? '| opened: ' + C.sentence(row.opened) : '');
  const last = game.clock.record[game.clock.record.length - 1];
  console.log('  -> year', game.clock.year, '|', last.pop, 'people |', game.clock.lineYears, 'broken line-years |', game.clock.record.filter(x => x.year > 0 && x.bad === 0).length, 'clean years');
}
for (const seed of [1, 2]) {
  g = C.start(G.starter(), seed);
  while (g.clock.year < C.YEARS) g = C.tick(g);
  show('the ledger\'s city left alone, seed ' + seed, g);
}

// ---- run 2: found the 100,000 city from nothing, infrastructure ahead of homes, no reaction to events ----
function found(seed, react) {
  let game = C.start(G.empty(), seed), at = null;
  const act = (tool, k) => { const res = C.order(game, tool, k, at); game = res.game; if (tool === 'line') at = res.from; };
  const seg = (a, b) => { at = null; act('line', a); act('line', b); };
  const stage = (hoods, infra) => {
    const mark = game.clock.jobs.length;
    for (const [k] of hoods) act('hood', k);
    const hoodsEnd = game.clock.jobs.length;
    infra();
    for (const [k, has] of hoods) for (const x of has) act(x, k);
    // put the homes of this stage behind everything else in it
    const jobs = game.clock.jobs, homes = jobs.slice(mark, hoodsEnd), rest = jobs.slice(hoodsEnd);
    game = { state: game.state, clock: { ...game.clock, jobs: jobs.slice(0, mark).concat(rest, homes) } };
  };
  // stage 1: the ledger's city. Homes that hold the shared schools come first among the homes.
  stage([['2,-1', ['elementary', 'high', 'fields']], ['1,0', ['elementary', 'middle']], ['-2,1', ['elementary', 'high', 'fields']], ['-1,1', ['elementary', 'middle']], ['0,-1', ['elementary', 'middle']],
    ['0,1', ['elementary']], ['-1,0', ['elementary']], ['1,-1', []], ['1,1', ['elementary']], ['-1,-1', ['elementary']]], () => {
    act('power', '3,-1'); act('power', '3,-1'); act('power', '3,-1'); act('water', '3,-2'); act('sewage', '-3,1'); act('waste', '-3,2');
    for (let i = 0; i < 8; i++) act('ring', '0,0');
    for (const k of ['1,0', '0,1', '-1,1', '-1,0', '0,-1', '1,-1']) seg('0,0', k);
    seg('1,0', '2,-1'); seg('0,1', '1,1'); seg('-1,1', '-2,1'); seg('-1,0', '-1,-1'); seg('2,-1', '3,-1'); seg('2,-1', '3,-2'); seg('-2,1', '-3,1'); seg('-2,1', '-3,2');
  });
  // stage 2: ten more neighborhoods, to 100,000
  stage([['2,-2', ['elementary', 'middle', 'fields']], ['0,-2', ['elementary', 'high']], ['2,0', ['elementary', 'middle']], ['-2,2', ['elementary', 'middle', 'fields']], ['0,2', ['elementary', 'high']],
    ['1,-2', ['elementary']], ['-2,0', ['elementary']], ['-1,2', ['elementary']], ['3,0', ['elementary']], ['-3,0', ['elementary']]], () => {
    act('power', '3,-1'); act('water', '3,-2'); act('sewage', '-3,1'); act('waste', '-3,2');
    for (let i = 0; i < 8; i++) act('ring', '0,0');
    seg('1,0', '2,0'); seg('1,-1', '2,-2'); seg('1,-1', '1,-2'); seg('0,-1', '0,-2'); seg('-1,0', '-2,0'); seg('-1,1', '-2,2'); seg('-1,1', '-1,2'); seg('0,1', '0,2'); seg('2,0', '3,0'); seg('-2,0', '-3,0');
  });
  const crewYears = game.clock.jobs.reduce((t, j) => t + j.total, 0);
  const handled = {};
  while (game.clock.year < C.YEARS) {
    if (react) for (const n of C.notices(game.clock)) {
      if (n.type !== 'closure' || n.when !== 'soon' || handled[n.id]) continue;
      handled[n.id] = true;
      // a bypass: the first new stretch that keeps the two ends of the closed one joined
      const [a, b] = G.ends(n.edge), plan = C.planned(game.state, game.clock.jobs);
      const joined = lines => { const seen = { [a]: true }, queue = [a]; for (let i = 0; i < queue.length; i++) for (const e of Object.keys(lines)) { if (e === n.edge) continue; const [p, q] = G.ends(e), other = p === queue[i] ? q : q === queue[i] ? p : null; if (other && !seen[other]) { seen[other] = true; queue.push(other); } } return Boolean(seen[b]); };
      if (joined(plan.lines)) continue;
      let done = false;
      for (const p of G.allTiles()) { if (done) break; if (!plan.tiles[p]) continue; for (const q of G.neighbors(p)) { if (done || !plan.tiles[q] || p > q) continue; const e = p + '|' + q; if (plan.lines[e]) continue; if (joined({ ...plan.lines, [e]: true })) { seg(p, q); game = C.first(game, game.clock.jobs.length - 1); done = true; } } }
    }
    game = C.tick(game);
  }
  return { game, crewYears };
}
for (const [seed, react] of [[1, false], [1, true], [2, true], [3, true]]) {
  const out = found(seed, react);
  show('found 100,000 from nothing, seed ' + seed + (react ? ', with a bypass for each closure' : ', no reaction') + ' (' + out.crewYears + ' crew-years ordered)', out.game);
}
console.log(fails ? '\n' + fails + ' CHECKS FAILED' : '\nall checks passed');
