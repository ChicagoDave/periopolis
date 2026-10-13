// Runs the engine outside a page: the starter city should hold every rule, and its numbers should sit near the ledger's.
const fs = require('fs'), vm = require('vm');
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname + '/../ledger/model.js', 'utf8') + '\n' + fs.readFileSync(__dirname + '/engine.js', 'utf8') + '\nthis.G = CityGame;', ctx);
const G = ctx.G, f = (x, d = 1) => x.toLocaleString('en-US', { maximumFractionDigits: d });
console.log('tile: people', f(G.HOOD, 0), '| corner km', f(G.TILE_KM, 3), '| step km', f(G.STEP_KM, 3), '| step on foot min', f(G.STEP_KM * G.FOOT), '| in-tile walk', f(G.IN_TILE), '| acres', f(G.TILE_ACRES), '| 30-min walk km', f(G.LONG_KM, 2), '=', f(G.LONG_KM / G.STEP_KM, 2), 'steps | tiles', G.allTiles().length);
console.log('shares', Object.entries(G.SHARE).map(([k, v]) => k + ' ' + (100 * v).toFixed(1)).join(', '), '| sum', Object.values(G.SHARE).reduce((a, b) => a + b, 0).toFixed(4));
function show(label, state, showing) {
  const ev = G.evaluate(state, showing), s = ev.score;
  console.log('\n== ' + label + ' ==');
  for (const r of ev.rules) console.log(' ', r.status.toUpperCase().padEnd(4), r.lines.padEnd(15), r.title, '::', r.detail, r.tiles.length ? '[' + r.tiles.length + ' tiles]' : '');
  console.log('  score: pop', f(s.pop, 0), '| acres', f(s.acres, 0), 'car', s.car ? f(s.car.acres, 0) : '-', '| foot', (100 * s.foot).toFixed(1), 'bike', (100 * s.bike).toFixed(1), 'ride', (100 * s.ride).toFixed(1), 'stuck', (100 * s.stuck).toFixed(2), 'nowhere', (100 * s.nowhere).toFixed(2), 'sum', (s.foot + s.bike + s.ride + s.stuck + s.nowhere).toFixed(4), '| noRide', (100 * s.noRide).toFixed(1), '| fleet', f(s.fleet, 0), 'car', s.car ? f(s.car.vehicles, 0) : '-', '| door', f(s.door), 'car', s.car ? f(s.car.door) : '-', '| mover km', f(s.moverKm), 'walkway', f(s.walkwayKm), 'pipe', f(s.pipeKm), '| stops', s.stops);
  for (const t of ev.tests) console.log('  stretch:', t.label, '->', t.gives.length ? 'GIVES: ' + t.gives.map(g => g.title + ' (' + g.detail + ')').join(' | ') : 'holds');
  return ev;
}
const start = G.starter();
const ev = show('starter city', start);
console.log('  ledger for comparison: foot', (100 * G.base.walk).toFixed(1), 'bike', (100 * G.base.bike).toFixed(1), 'ride', (100 * G.base.ride).toFixed(1), '| fleet', f(G.base.fleet, 0), '| door', f(G.base.doorMin), '| mover km', f(G.base.moverKm), 'walkway', f(G.base.walkwayKm));
// the ledger's city is short of people for fine dining, as the ledger says; nothing else should be off
const bad = ev.rules.filter(r => r.status !== 'ok').map(r => r.id + '=' + r.status).join(', ');
console.log(bad === 'size=warn' ? 'starter city: every rule holds but the fine-dining watch' : 'STARTER NOT AS EXPECTED: ' + (bad || 'all ok'));
show('starter, shown with 20% more children', start, 'children');
show('empty site', G.empty());
// play a few moves
let s = G.empty(), from = null;
const click = (tool, q, r) => { const res = G.act(s, tool, G.key(q, r), from); s = res.state; if (tool === 'line') from = res.from; console.log('   ', tool, q + ',' + r, '->', res.said, res.changed ? '' : '(no change)'); };
click('hood', 0, 0); click('hood', 0, 0); click('elementary', 0, 0); click('elementary', 1, 0); click('ring', 1, 0); click('ring', 1, 0); click('line', 0, 0); click('line', 1, 0); click('line', 3, 0); click('power', 2, 0); click('power', 2, 0); click('erase', 2, 0); click('erase', 4, 0); click('fields', 1, 0);
show('after a few moves', s);
// a big city: fill three rings of tiles around one ring, no lines
let big = G.empty(); big.tiles['0,0'] = { kind: 'ring', n: 20 };
for (const k of G.allTiles()) { const [q, r] = G.at(k); const d = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)); if (d >= 1 && d <= 4) big.tiles[k] = { kind: 'hood', has: d % 2 ? { elementary: true } : { elementary: true, middle: true, high: true, fields: true } }; }
const t0 = Date.now(); show('sixty neighborhoods, no mover line', big); console.log('  evaluate took', Date.now() - t0, 'ms');
// seating: nearest-first alone strands Y here (X fills the three places Y can reach); moving X on seats everyone
{
  const near = ['S1', 'S2', 'S3'], minutes = (t, p) => t === 'X' ? (near.includes(p) ? 10 : 20) : (near.includes(p) ? 15 : 99);
  const res = G.assign([{ key: 'X', amount: 360 }, { key: 'Y', amount: 360 }], ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'].map(k => ({ key: k, cap: 140 })), minutes, 30);
  const seated = k => res.goes[k].reduce((t, g) => t + g.amount, 0);
  console.log('\nseating trap: X seated', seated('X'), 'left', res.left.X, '| Y seated', seated('Y'), 'left', res.left.Y, '| loads', Object.values(res.load).join(' '), '| Y goes', res.goes.Y.map(g => g.to + ':' + g.amount).join(' '), '| X goes', res.goes.X.map(g => g.to + ':' + g.amount).join(' '));
  console.log(res.left.X < 1e-6 && res.left.Y < 1e-6 && Object.values(res.load).every(v => v <= 140 + 1e-6) ? 'seating: everyone seated, no place over its cap' : 'SEATING FAILED');
  // and when there are too few seats, exactly the shortfall is left out
  const few = G.assign([{ key: 'X', amount: 360 }, { key: 'Y', amount: 360 }], ['S1', 'S2', 'S3', 'S4'].map(k => ({ key: k, cap: 140 })), minutes, 30);
  console.log('too few seats: left out', (few.left.X + few.left.Y).toFixed(1), '(should be 160.0)');
}
// two far neighborhoods with no line: only they should be marked for trips without a way
{
  let far = G.starter();
  far = G.act(far, 'hood', '4,-2', null).state; far = G.act(far, 'hood', '4,-1', null).state;
  const ev2 = G.evaluate(far, null), ways = ev2.rules.find(r => r.id === 'ways'), s2 = ev2.score;
  console.log('\nfar pair, no line: ways', ways.status, '::', ways.detail, '| marked', ways.tiles.join(' '), '| foot', (100 * s2.foot).toFixed(1), 'bike', (100 * s2.bike).toFixed(1), 'ride', (100 * s2.ride).toFixed(1), 'stuck', (100 * s2.stuck).toFixed(1), 'nowhere', (100 * s2.nowhere).toFixed(1), 'sum', (s2.foot + s2.bike + s2.ride + s2.stuck + s2.nowhere).toFixed(4));
  console.log('  4,-2 issues:', ev2.per['4,-2'].issues.join(' / '));
  console.log('  1,0 issues:', ev2.per['1,0'].issues.join(' / ') || 'none');
}
console.log('clean() round trip equal:', JSON.stringify(G.clean(JSON.parse(JSON.stringify(start)))) === JSON.stringify(start), '| clean(garbage):', JSON.stringify(G.clean({ tiles: { '9,9': { kind: 'hood' }, '0,0': { kind: 'zoo' }, '1,0': { kind: 'ring', n: 999 } }, lines: { 'x': true, '0,0|3,3': true, '1,0|0,0': true } })));
