// Records the parity fixtures for @city/site from the sketch's engine.js, the site as published on 2026-10-11.
// Run from the repository root when the fixtures are to be refreshed:
//   node domain/site/test/record-fixtures.mjs
// The sketch is archived with its plan, so after docs/work/port-city-builder/ moves to docs/work/archive/,
// point SKETCH at the archive. The recorded JSON is what the tests read; this script is not run by them.
// The sketch's sentences (rule titles and details, tile issues, what a move said) are recorded too, for the Board's
// wording tests in Phase 4; the site's own tests compare the structure and the figures.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const SKETCH = join(here, '../../../docs/work/port-city-builder/sketch');
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(
  readFileSync(join(SKETCH, 'ledger/model.js'), 'utf8') +
    '\n' +
    readFileSync(join(SKETCH, 'builder/engine.js'), 'utf8') +
    '\nthis.G = CityGame;',
  ctx,
);
const G = ctx.G;
const copy = (x) => JSON.parse(JSON.stringify(x, (_k, v) => (v === Infinity ? 'Infinity' : v === -Infinity ? '-Infinity' : v)));

const rates = {
  HOOD: G.HOOD, TILE_KM: G.TILE_KM, STEP_KM: G.STEP_KM, TILE_ACRES: G.TILE_ACRES, IN_TILE: G.IN_TILE, FOOT: G.FOOT,
  LONG_KM: G.LONG_KM, RING_SERVES: G.RING_SERVES, MODULE_MW: G.MODULE_MW, PEAK_KW: G.PEAK_KW, PLANT_SERVES: G.PLANT_SERVES,
  FIELD_WALK: G.FIELD_WALK, BAND: G.BAND, BOARD: G.BOARD, SHARE: G.SHARE, tiles: G.allTiles().length,
  tests: G.TESTS.map((t) => ({ id: t.id, label: t.label, stress: t.stress })),
};

const evaluations = [];
const record = (name, state, showing, now) =>
  evaluations.push({ name, state: copy(state), showing: showing ?? null, now: now ?? null, result: copy(G.evaluate(state, showing, now)) });

const start = G.starter();
record('starter', start, null);
record('starter shown with more children', start, 'children');
record('starter shown with fewer people', start, 'fewer');
record('starter shown with more people', start, 'more');
record('starter shown with a closure', start, 'closure');
record('empty site', G.empty(), null);

// The clock's way of looking: the board under this year's stress.
const firstEdge = G.closable(start)[0];
record('starter under a squeeze and a closure', start, null, { people: G.BAND, children: 0, kids: { elementary: 0, middle: 0, high: 0 }, closed: [firstEdge] });
record('starter under a wave in the elementary grades', start, null, { people: 0, children: 0, kids: { elementary: G.BAND, middle: G.BAND / 2, high: 0 }, closed: [] });
record('starter under a slump', start, null, { people: -G.BAND, children: 0, kids: { elementary: 0, middle: 0, high: 0 }, closed: [] });

// A few moves, each recorded with what the sketch said.
const acts = [];
const push = (state, tool, k, from) => {
  const res = G.act(state, tool, k, from);
  acts.push({ tool, key: k, from, before: copy(state), after: copy(res.state), said: res.said, changed: res.changed, nextFrom: res.from });
  return res;
};
let s = G.empty();
let from = null;
const click = (tool, q, r) => { const res = push(s, tool, G.key(q, r), from); s = res.state; if (tool === 'line') from = res.from; };
click('hood', 0, 0); click('hood', 0, 0); click('elementary', 0, 0); click('elementary', 1, 0); click('ring', 1, 0); click('ring', 1, 0);
click('line', 0, 0); click('line', 1, 0); click('line', 3, 0); click('power', 2, 0); click('power', 2, 0); click('erase', 2, 0); click('erase', 4, 0); click('fields', 1, 0);
// and the limits and the other refusals
let full = G.empty();
for (let i = 0; i < 40; i++) full = G.act(full, 'ring', '0,0', null).state;
push(full, 'ring', '0,0', null);
let site = G.empty();
for (let i = 0; i < 12; i++) site = G.act(site, 'water', '0,0', null).state;
push(site, 'water', '0,0', null);
push(site, 'sewage', '0,0', null);
push(start, 'line', '0,0', '0,0');
push(start, 'line', '1,0', '0,0');
push(start, 'line', '1,0', null);
push(start, 'erase', '2,0', null);
push(start, 'erase', '1,0', null);
push(start, 'erase', '0,0', null);
push(start, 'erase', '3,-2', null);
push(start, 'hood', '0,0', null);
push(start, 'power', '0,0', null);
push(start, 'ring', '1,0', null);
push(start, 'fields', '0,0', null);
push(start, 'high', '2,-1', null);
record('after a few moves', s, null);

// A big city: three rings of tiles around one ring, no lines.
const big = G.empty();
big.tiles['0,0'] = { kind: 'ring', n: 20 };
for (const k of G.allTiles()) {
  const [q, r] = G.at(k);
  const d = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
  if (d >= 1 && d <= 4) big.tiles[k] = { kind: 'hood', has: d % 2 ? { elementary: true } : { elementary: true, middle: true, high: true, fields: true } };
}
record('sixty neighborhoods, no mover line', big, null);

// Two far neighborhoods with no line.
let far = G.starter();
far = G.act(far, 'hood', '4,-2', null).state;
far = G.act(far, 'hood', '4,-1', null).state;
record('far pair, no line', far, null);

// Growing to 100,000: spokes, fitted out, then loops.
let g = G.starter();
let gFrom = null;
const gClick = (tool, k) => { const res = G.act(g, tool, k, gFrom); g = res.state; if (tool === 'line') gFrom = res.from; };
const gLine = (a, b) => { gFrom = null; gClick('line', a); gClick('line', b); };
const add = [['2,0', '1,0'], ['2,-2', '1,-1'], ['1,-2', '1,-1'], ['0,-2', '0,-1'], ['-2,0', '-1,0'], ['-2,2', '-1,1'], ['-1,2', '-1,1'], ['0,2', '0,1'], ['3,0', '2,0'], ['-3,0', '-2,0']];
for (const [k, via] of add) { gClick('hood', k); gLine(via, k); }
record('twenty neighborhoods, lines only', g, null);
for (const [k] of add) gClick('elementary', k);
for (const k of ['2,-2', '-2,2', '2,0']) gClick('middle', k);
for (const k of ['0,-2', '0,2']) gClick('high', k);
for (const k of ['2,-2', '-2,2']) gClick('fields', k);
for (let i = 0; i < 8; i++) gClick('ring', '0,0');
gClick('power', '3,-1'); gClick('water', '3,-2'); gClick('sewage', '-3,1'); gClick('waste', '-3,2');
record('twenty neighborhoods, fitted out', g, null);
const spokes = copy(g);
const inner = ['1,0', '1,-1', '0,-1', '-1,0', '-1,1', '0,1'];
for (let i = 0; i < 6; i++) gLine(inner[i], inner[(i + 1) % 6]);
const outer = ['2,0', '2,-1', '2,-2', '1,-2', '0,-2', '-1,-1', '-2,0', '-2,1', '-2,2', '-1,2', '0,2', '1,1'];
for (let i = 0; i < 12; i++) gLine(outer[i], outer[(i + 1) % 12]);
gLine('3,-1', '3,-2'); gLine('-3,1', '-3,2'); gLine('3,0', '3,-1'); gLine('-3,0', '-3,1');
record('the same, with loops', g, null);
const loops = copy(g);

// Seating.
const near = ['S1', 'S2', 'S3'];
const minutes = (t, p) => (t === 'X' ? (near.includes(p) ? 10 : 20) : near.includes(p) ? 15 : 99);
const seatingCases = [
  { name: 'seating trap', takers: [{ key: 'X', amount: 360 }, { key: 'Y', amount: 360 }], places: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'].map((k) => ({ key: k, cap: 140 })), limit: 30 },
  { name: 'too few seats', takers: [{ key: 'X', amount: 360 }, { key: 'Y', amount: 360 }], places: ['S1', 'S2', 'S3', 'S4'].map((k) => ({ key: k, cap: 140 })), limit: 30 },
].map((c) => ({ ...c, minutes: { X: { S1: 10, S2: 10, S3: 10, S4: 20, S5: 20, S6: 20 }, Y: { S1: 15, S2: 15, S3: 15, S4: 99, S5: 99, S6: 99 } }, result: copy(G.assign(c.takers, c.places, minutes, c.limit)) }));

const cleanCases = [
  { name: 'round trip', raw: copy(start), result: copy(G.clean(JSON.parse(JSON.stringify(start)))) },
  { name: 'garbage', raw: { tiles: { '9,9': { kind: 'hood' }, '0,0': { kind: 'zoo' }, '1,0': { kind: 'ring', n: 999 } }, lines: { x: true, '0,0|3,3': true, '1,0|0,0': true } } },
  { name: 'not an object', raw: 'city' },
  { name: 'plant over its limit, hood with junk', raw: { tiles: { '2,0': { kind: 'power', n: 40 }, '1,0': { kind: 'hood', has: { zoo: true, high: true } } }, lines: {} } },
].map((c) => ('result' in c ? c : { ...c, result: copy(G.clean(c.raw)) }));

const bridgeCases = [
  { name: 'starter', state: copy(start), result: G.bridges(start), closable: G.closable(start) },
  { name: 'spokes', state: spokes, result: G.bridges(spokes), closable: G.closable(spokes) },
  { name: 'loops', state: loops, result: G.bridges(loops), closable: G.closable(loops) },
  { name: 'empty', state: G.empty(), result: G.bridges(G.empty()), closable: G.closable(G.empty()) },
];

const json = JSON.stringify(
  { recorded: '2026-10-12', source: 'docs/work/port-city-builder/sketch/builder/engine.js', rates, evaluations, acts, seatingCases, cleanCases, bridgeCases },
  null,
  0,
);
writeFileSync(join(here, 'fixtures/parity.json'), json + '\n');
console.log(`recorded ${evaluations.length} evaluations, ${acts.length} moves, ${seatingCases.length} seatings, ${cleanCases.length} restores, ${bridgeCases.length} bridge cases`);
