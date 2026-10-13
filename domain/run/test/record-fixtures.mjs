// Records the parity fixtures for @city/run from the sketch's clock.js, the clock as published on 2026-10-11.
// Run from the repository root when the fixtures are to be refreshed:
//   node domain/run/test/record-fixtures.mjs
// The sketch is archived with its plan, so after docs/work/port-city-builder/ moves to docs/work/archive/,
// point SKETCH at the archive. The sketch's sentences (what an order said, the notices' text) are recorded for
// the Board's wording tests in Phase 4; the run's own tests compare the structures and the figures.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const SKETCH = join(here, '../../../docs/work/port-city-builder/sketch');
const ctx = { console };
vm.createContext(ctx);
const src = (f) => readFileSync(join(SKETCH, f), 'utf8');
vm.runInContext(src('ledger/model.js') + '\n' + src('builder/engine.js') + '\n' + src('builder/clock.js') + '\nthis.G = CityGame; this.C = CityClock;', ctx);
const G = ctx.G;
const C = ctx.C;
const copy = (x) => JSON.parse(JSON.stringify(x));

const rules = { YEARS: C.YEARS, CREWS: C.CREWS, BUILD: C.BUILD, FIRST_MODULE: C.FIRST_MODULE };

// ---- mechanics: every step recorded with the game before and after ----
const steps = [];
let g;
let from;
const step = (op, args, fn) => {
  const before = copy(g);
  const out = fn();
  steps.push({ op, args, before, after: copy(g), said: out?.said ?? null, changed: out?.changed ?? null, inHand: copy(C.inHand(g)) });
  return out;
};
const click = (tool, k) =>
  step('order', { tool, k, from }, () => {
    const r = C.order(g, tool, k, from);
    g = r.game;
    if (tool === 'line') from = r.from;
    return r;
  });
const line = (a, b) => {
  from = null;
  click('line', a);
  return click('line', b);
};
const tick = () => step('tick', {}, () => { g = C.tick(g); });
const first = (i) => step('first', { index: i }, () => { g = C.first(g, i); });
const cancel = (i) => step('cancel', { index: i }, () => { g = C.cancel(g, i); });

g = C.start(G.empty(), 1); from = null;
steps.push({ op: 'start', args: { layout: 'empty', seed: 1 }, before: null, after: copy(g), said: null, changed: null, inHand: copy(C.inHand(g)) });
click('power', '3,-1'); click('power', '3,-1'); click('hood', '1,0'); click('elementary', '1,0');
tick(); tick(); tick();

g = C.start(G.empty(), 1); from = null;
steps.push({ op: 'start', args: { layout: 'empty', seed: 1 }, before: null, after: copy(g), said: null, changed: null, inHand: copy(C.inHand(g)) });
const ringTiles = ['1,0', '1,-1', '0,-1', '-1,0', '-1,1', '0,1'];
for (const k of ringTiles) line('0,0', k);
for (let i = 0; i < 6; i++) line(ringTiles[i], ringTiles[(i + 1) % 6]);
first(g.clock.jobs.length - 1);
tick();
line('0,0', '1,0');
const pendingEnds = G.ends(g.clock.jobs[0].at);
line(pendingEnds[0], pendingEnds[1]);

g = C.start(G.empty(), 1); from = null;
steps.push({ op: 'start', args: { layout: 'empty', seed: 1 }, before: null, after: copy(g), said: null, changed: null, inHand: copy(C.inHand(g)) });
click('hood', '2,0'); click('elementary', '2,0'); click('high', '2,0'); click('power', '3,0'); click('power', '3,0');
cancel(3); cancel(0); click('erase', '3,0');

// a run on the starter with orders, ticked to year 9, then stopped
g = C.start(G.starter(), 7); from = null;
steps.push({ op: 'start', args: { layout: 'starter', seed: 7 }, before: null, after: copy(g), said: null, changed: null, inHand: copy(C.inHand(g)) });
click('hood', '2,0'); click('elementary', '2,0'); line('1,0', '2,0'); click('ring', '0,0');
for (let i = 0; i < 9; i++) tick();
const savedGame = copy(g);
step('stop', {}, () => { g = C.stop(g); });

// ---- the wave, timelines, notices ----
const wave = {};
for (const kind of G.SCHOOLS) wave[kind] = Array.from({ length: 15 }, (_x, t) => C.waveIn(kind, t));
const timelines = [1, 2, 3, 4, 5, 7, 11].map((seed) => ({ seed, events: C.start(G.empty(), seed).clock.events }));

// ---- storage ----
const cleanCases = [
  { name: 'round trip', raw: copy(savedGame.clock), layout: savedGame.state, result: copy(C.clean(copy(savedGame.clock), savedGame.state)) },
  { name: 'year out of range', raw: { year: 99 }, layout: savedGame.state, result: C.clean({ year: 99 }, savedGame.state) },
  { name: 'not an object', raw: 'x', layout: savedGame.state, result: C.clean('x', savedGame.state) },
];
{
  const raw = { year: 3, seed: 5, jobs: [{ what: 'zoo', at: '0,0', left: 1, total: 1 }, { what: 'hood', at: '9,9', left: 1, total: 2 }, { what: 'elementary', at: '4,0', left: 1, total: 1 }, { what: 'line', at: '0,0|3,3', left: 1, total: 1 }, { what: 'hood', at: '4,-4', left: 2, total: 2 }], events: [{ id: 1, type: 'plague', start: 3, lasts: 1, notice: 1 }], record: [] };
  cleanCases.push({ name: 'dirty clock', raw, layout: savedGame.state, result: copy(C.clean(raw, savedGame.state)) });
  const raw2 = { year: 4, seed: 9.5, jobs: [], events: [], record: [] };
  cleanCases.push({ name: 'fractional seed is floored by >>> 0', raw: raw2, layout: savedGame.state, result: copy(C.clean(raw2, savedGame.state)) });
  const raw3 = { year: 2, seed: 3, jobs: [{ what: 'elementary', at: '1,0', left: 0, total: 1 }, { what: 'high', at: '1,0', left: 1, total: 2 }, { what: 'power', at: '3,-1', left: 1, total: 1 }], events: [{ id: 2, type: 'closure', start: 6, lasts: 1, notice: 1, edge: '0,0|1,0' }, { id: 4, type: 'closure', start: 12, lasts: 1, notice: 1, edge: 'nope' }, { id: 5, type: 'slump', start: 14, lasts: 4, notice: 2 }], record: [{ year: 0, pop: 50000, bad: 0, opened: {} }, { year: 1, pop: 50000, homes: 50000, held: 14, warn: 1, bad: 2, broken: ['ring', 7, 'ways'], opened: { hood: 2, zoo: 1, line: 0 } }, { year: 'x' }] };
  cleanCases.push({ name: 'schools already standing are dropped, edges checked, record rows kept or dropped', raw: raw3, layout: savedGame.state, result: copy(C.clean(raw3, savedGame.state)) });
}

// ---- the promise: the looped city on 25 timelines ----
let looped = G.starter();
const lay = (a, b) => { let res = G.act(looped, 'line', a, null); res = G.act(res.state, 'line', b, res.from); looped = res.state; };
const inner = ['1,0', '1,-1', '0,-1', '-1,0', '-1,1', '0,1'];
for (let i = 0; i < 6; i++) lay(inner[i], inner[(i + 1) % 6]);
lay('2,-1', '1,-1'); lay('1,1', '1,0'); lay('-2,1', '-1,0'); lay('-1,-1', '0,-1'); lay('3,-1', '3,-2'); lay('-3,1', '-3,2');
const promise = { layout: copy(looped), runs: [] };
for (let seed = 1; seed <= 25; seed++) {
  let run = C.start(looped, seed);
  while (run.clock.year < C.YEARS) run = C.tick(run);
  promise.runs.push({ seed, lineYears: run.clock.lineYears, events: copy(run.clock.events) });
}

// ---- the ledger's city left alone, with the notices of every year ----
const leftAlone = [];
for (const seed of [1, 2]) {
  let run = C.start(G.starter(), seed);
  const yearly = [{ year: 0, notices: copy(C.notices(run.clock)), stress: copy(C.stressAt(run.clock)) }];
  while (run.clock.year < C.YEARS) { run = C.tick(run); yearly.push({ year: run.clock.year, notices: copy(C.notices(run.clock)), stress: copy(C.stressAt(run.clock)) }); }
  leftAlone.push({ seed, final: copy(run), yearly });
}

// ---- founding 100,000 from nothing ----
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
    const jobs = game.clock.jobs, homes = jobs.slice(mark, hoodsEnd), rest = jobs.slice(hoodsEnd);
    game = { state: game.state, clock: { ...game.clock, jobs: jobs.slice(0, mark).concat(rest, homes) } };
  };
  stage([['2,-1', ['elementary', 'high', 'fields']], ['1,0', ['elementary', 'middle']], ['-2,1', ['elementary', 'high', 'fields']], ['-1,1', ['elementary', 'middle']], ['0,-1', ['elementary', 'middle']],
    ['0,1', ['elementary']], ['-1,0', ['elementary']], ['1,-1', []], ['1,1', ['elementary']], ['-1,-1', ['elementary']]], () => {
    act('power', '3,-1'); act('power', '3,-1'); act('power', '3,-1'); act('water', '3,-2'); act('sewage', '-3,1'); act('waste', '-3,2');
    for (let i = 0; i < 8; i++) act('ring', '0,0');
    for (const k of ['1,0', '0,1', '-1,1', '-1,0', '0,-1', '1,-1']) seg('0,0', k);
    seg('1,0', '2,-1'); seg('0,1', '1,1'); seg('-1,1', '-2,1'); seg('-1,0', '-1,-1'); seg('2,-1', '3,-1'); seg('2,-1', '3,-2'); seg('-2,1', '-3,1'); seg('-2,1', '-3,2');
  });
  stage([['2,-2', ['elementary', 'middle', 'fields']], ['0,-2', ['elementary', 'high']], ['2,0', ['elementary', 'middle']], ['-2,2', ['elementary', 'middle', 'fields']], ['0,2', ['elementary', 'high']],
    ['1,-2', ['elementary']], ['-2,0', ['elementary']], ['-1,2', ['elementary']], ['3,0', ['elementary']], ['-3,0', ['elementary']]], () => {
    act('power', '3,-1'); act('water', '3,-2'); act('sewage', '-3,1'); act('waste', '-3,2');
    for (let i = 0; i < 8; i++) act('ring', '0,0');
    seg('1,0', '2,0'); seg('1,-1', '2,-2'); seg('1,-1', '1,-2'); seg('0,-1', '0,-2'); seg('-1,0', '-2,0'); seg('-1,1', '-2,2'); seg('-1,1', '-1,2'); seg('0,1', '0,2'); seg('2,0', '3,0'); seg('-2,0', '-3,0');
  });
  const ordered = copy(game);
  const crewYears = game.clock.jobs.reduce((t, j) => t + j.total, 0);
  const handled = {};
  const bypasses = [];
  while (game.clock.year < C.YEARS) {
    if (react) for (const n of C.notices(game.clock)) {
      if (n.type !== 'closure' || n.when !== 'soon' || handled[n.id]) continue;
      handled[n.id] = true;
      const [a, b] = G.ends(n.edge), plan = C.planned(game.state, game.clock.jobs);
      const joined = (lines) => { const seen = { [a]: true }, queue = [a]; for (let i = 0; i < queue.length; i++) for (const e of Object.keys(lines)) { if (e === n.edge) continue; const [p, q] = G.ends(e), other = p === queue[i] ? q : q === queue[i] ? p : null; if (other && !seen[other]) { seen[other] = true; queue.push(other); } } return Boolean(seen[b]); };
      if (joined(plan.lines)) continue;
      let done = false;
      for (const p of G.allTiles()) { if (done) break; if (!plan.tiles[p]) continue; for (const q of G.neighbors(p)) { if (done || !plan.tiles[q] || p > q) continue; const e = p + '|' + q; if (plan.lines[e]) continue; if (joined({ ...plan.lines, [e]: true })) { seg(p, q); game = C.first(game, game.clock.jobs.length - 1); bypasses.push({ year: game.clock.year, edge: e, closing: n.edge }); done = true; } } }
    }
    game = C.tick(game);
  }
  return { seed, react, ordered, crewYears, bypasses, final: copy(game) };
}
const founding = [[1, false], [1, true], [2, true], [3, true]].map(([seed, react]) => found(seed, react));

writeFileSync(
  join(here, 'fixtures/parity.json'),
  JSON.stringify({ recorded: '2026-10-12', source: 'docs/work/port-city-builder/sketch/builder/clock.js', rules, steps, wave, timelines, cleanCases, promise, leftAlone, founding }, null, 0) + '\n',
);
console.log(`recorded ${steps.length} steps, ${timelines.length} timelines, ${cleanCases.length} restores, ${promise.runs.length} promise runs, ${leftAlone.length} left-alone runs, ${founding.length} foundings`);
